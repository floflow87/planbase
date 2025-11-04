import { useState, useCallback, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Save, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import NoteEditor from "@/components/NoteEditor";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Note, InsertNote } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>({ type: 'doc', content: [] });
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [visibility, setVisibility] = useState<"private" | "account" | "client_ro">("private");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Fetch note
  const { data: note, isLoading } = useQuery<Note>({
    queryKey: ["/api/notes", id],
    enabled: !!id,
  });

  // Initialize form with note data
  useEffect(() => {
    if (note) {
      setTitle(note.title || "");
      setContent(note.content || { type: 'doc', content: [] });
      setStatus(note.status as any);
      setVisibility(note.visibility as any);
    }
  }, [note]);

  // Debounced values for autosave
  const debouncedTitle = useDebounce(title, 1000);
  const debouncedContent = useDebounce(content, 1000);

  // Update note mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertNote>) => {
      return apiRequest(`/api/notes/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
      setLastSaved(new Date());
      setIsSaving(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder la note",
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  // Autosave effect
  useEffect(() => {
    if (!note || !isEditMode) return;
    
    // Check if anything changed
    const titleChanged = debouncedTitle !== note.title;
    const contentChanged = JSON.stringify(debouncedContent) !== JSON.stringify(note.content);
    const statusChanged = status !== note.status;
    const visibilityChanged = visibility !== note.visibility;
    
    if (!titleChanged && !contentChanged && !statusChanged && !visibilityChanged) {
      return;
    }

    setIsSaving(true);

    // Extract plain text from content for search
    const extractPlainText = (content: any): string => {
      if (!content) return "";
      
      const getText = (node: any): string => {
        if (node.type === "text") {
          return node.text || "";
        }
        if (node.content && Array.isArray(node.content)) {
          return node.content.map(getText).join(" ");
        }
        return "";
      };

      return getText(content);
    };

    const plainText = extractPlainText(debouncedContent);

    updateMutation.mutate({
      title: debouncedTitle || "Sans titre",
      content: debouncedContent,
      plainText,
      status,
      visibility,
    });
  }, [debouncedTitle, debouncedContent, status, visibility, note, isEditMode]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette note ?")) {
      return;
    }

    try {
      await apiRequest(`/api/notes/${id}`, "DELETE");
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({
        title: "Note supprimée",
        description: "La note a été supprimée avec succès",
        variant: "success",
      });
      navigate("/notes");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la note",
        variant: "destructive",
      });
    }
  }, [id, navigate, queryClient, toast]);

  const handleSaveDraft = useCallback(() => {
    // Extract plain text from content for search
    const extractPlainText = (content: any): string => {
      if (!content) return "";
      
      const getText = (node: any): string => {
        if (node.type === "text") {
          return node.text || "";
        }
        if (node.content && Array.isArray(node.content)) {
          return node.content.map(getText).join(" ");
        }
        return "";
      };

      return getText(content);
    };

    const plainText = extractPlainText(content);

    updateMutation.mutate({ 
      title: title || "Sans titre",
      content,
      plainText,
      status: "draft",
      visibility,
    });
    toast({
      title: "Brouillon enregistré",
      description: "La note a été enregistrée en brouillon",
      variant: "success",
    });
  }, [title, content, visibility, updateMutation, toast]);

  const handlePublish = useCallback(() => {
    const newStatus = status === "active" ? "draft" : "active";
    setStatus(newStatus);
    
    // Extract plain text from content for search
    const extractPlainText = (content: any): string => {
      if (!content) return "";
      
      const getText = (node: any): string => {
        if (node.type === "text") {
          return node.text || "";
        }
        if (node.content && Array.isArray(node.content)) {
          return node.content.map(getText).join(" ");
        }
        return "";
      };

      return getText(content);
    };

    const plainText = extractPlainText(content);

    updateMutation.mutate({ 
      title: title || "Sans titre",
      content,
      plainText,
      status: newStatus,
      visibility,
    });
    toast({
      title: newStatus === "active" ? "Note publiée" : "Note en brouillon",
      description: newStatus === "active" 
        ? "La note est maintenant active" 
        : "La note est de retour en brouillon",
      variant: "success",
    });
  }, [title, content, visibility, status, updateMutation, toast]);

  if (isLoading) {
    return (
      <div className="h-full overflow-auto">
        <div className="p-6 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="h-full overflow-auto">
        <div className="p-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                Note introuvable
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/notes">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 mt-2">
                <Badge 
                  variant="outline" 
                  className={
                    status === "draft" 
                      ? "bg-gray-100 text-gray-700 border-gray-200"
                      : status === "archived"
                      ? "bg-orange-50 text-orange-700 border-orange-200"
                      : "bg-green-50 text-green-700 border-green-200"
                  }
                >
                  {status === "draft" ? "Brouillon" : status === "archived" ? "Archivée" : "Active"}
                </Badge>
                {isSaving ? (
                  <span className="text-xs text-muted-foreground">Sauvegarde en cours...</span>
                ) : lastSaved ? (
                  <span className="text-xs text-muted-foreground">
                    Sauvegardé {formatDistanceToNow(lastSaved, { addSuffix: true, locale: fr })}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Modifié {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true, locale: fr })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditMode(!isEditMode)}
              data-testid="button-toggle-edit"
            >
              {isEditMode ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
              {isEditMode ? "Aperçu" : "Modifier"}
            </Button>
            <select
              value={visibility}
              onChange={(e) => {
                const newVisibility = e.target.value as any;
                setVisibility(newVisibility);
                updateMutation.mutate({ visibility: newVisibility });
              }}
              className="border border-border rounded-md px-3 h-9 text-sm bg-background"
              data-testid="select-visibility"
            >
              <option value="private">Privée</option>
              <option value="account">Partagée (équipe)</option>
              <option value="client_ro">Partagée (client)</option>
            </select>
            {status === "draft" && (
              <>
                <Button variant="outline" onClick={handleSaveDraft} data-testid="button-save-draft">
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </Button>
                <Button onClick={handlePublish} data-testid="button-publish">
                  <Save className="w-4 h-4 mr-2" />
                  Publier
                </Button>
              </>
            )}
            <Button variant="destructive" onClick={handleDelete} data-testid="button-delete">
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </Button>
          </div>
        </div>

        {/* Editor */}
        <NoteEditor
          content={content}
          onChange={setContent}
          title={title}
          onTitleChange={setTitle}
          editable={isEditMode}
          placeholder="Commencez à écrire votre note..."
        />

        {/* AI Summary */}
        {note.summary && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="text-[10px]">Résumé IA</Badge>
                <p className="text-sm text-muted-foreground flex-1">{note.summary}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
