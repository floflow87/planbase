import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Save, Trash2, Download, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import NoteEditor from "@/components/NoteEditor";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Document } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>({ type: 'doc', content: [] });
  const [status, setStatus] = useState<"draft" | "signed">("draft");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: document, isLoading } = useQuery<Document>({
    queryKey: ["/api/documents", id],
    enabled: !!id,
  });

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setContent(document.content || { type: 'doc', content: [] });
      setStatus(document.status);
    }
  }, [document]);

  const debouncedContent = useDebounce(content, 1000);

  const updateDocumentMutation = useMutation({
    mutationFn: async (data: Partial<Document>) => {
      return await apiRequest("PATCH", `/api/documents/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setIsSaving(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder le document",
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès",
      });
      navigate("/documents");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le document",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    setIsSaving(true);
    const plainText = typeof content === 'string' ? content : JSON.stringify(content);
    updateDocumentMutation.mutate({ title, content, plainText });
  };

  const handleExportPDF = () => {
    toast({
      title: "Export PDF",
      description: "Fonctionnalité à venir - Export en PDF du document",
    });
  };

  const handleMarkSigned = () => {
    const newStatus = status === "draft" ? "signed" : "draft";
    setStatus(newStatus);
    updateDocumentMutation.mutate({ 
      status: newStatus,
      signedAt: newStatus === "signed" ? new Date().toISOString() : null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Document non trouvé</p>
        <Button onClick={() => navigate("/documents")}>Retour aux documents</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/documents")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 flex-1"
              placeholder="Titre du document"
              data-testid="input-document-title"
            />
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={status === "draft" ? "bg-gray-100 text-gray-700" : "bg-green-50 text-green-700"}>
              {status === "draft" ? "Brouillon" : "Signé"}
            </Badge>
            
            <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-export-pdf">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            
            <Button variant="outline" size="sm" onClick={handleMarkSigned} data-testid="button-mark-signed">
              <FileSignature className="h-4 w-4 mr-2" />
              {status === "draft" ? "Marquer signé" : "Marquer brouillon"}
            </Button>
            
            <Button size="sm" onClick={handleSave} disabled={isSaving} data-testid="button-save">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
            
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(true)} data-testid="button-delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <NoteEditor
          content={content}
          onChange={setContent}
          placeholder="Commencez à rédiger votre document..."
        />
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le document</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDocumentMutation.mutate()}
              disabled={deleteDocumentMutation.isPending}
            >
              {deleteDocumentMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
