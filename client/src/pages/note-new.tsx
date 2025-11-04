import { useState, useCallback, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NoteEditor from "@/components/NoteEditor";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertNote } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";

export default function NoteNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>({ type: 'doc', content: [] });
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [visibility, setVisibility] = useState<"private" | "account" | "client_ro">("private");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isManualSaving, setIsManualSaving] = useState(false);

  // Debounced values for autosave
  const debouncedTitle = useDebounce(title, 1000);
  const debouncedContent = useDebounce(content, 1000);

  // Create note mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<InsertNote>) => {
      return apiRequest("/api/notes", "POST", data);
    },
    onSuccess: (data) => {
      setNoteId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setLastSaved(new Date());
      setIsSaving(false);
      setIsManualSaving(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la note",
        variant: "destructive",
      });
      setIsSaving(false);
      setIsManualSaving(false);
    },
  });

  // Update note mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertNote> }) => {
      return apiRequest(`/api/notes/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setLastSaved(new Date());
      setIsSaving(false);
      setIsManualSaving(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder la note",
        variant: "destructive",
      });
      setIsSaving(false);
      setIsManualSaving(false);
    },
  });

  // Autosave effect
  useEffect(() => {
    // Skip autosave if manual save is in progress
    if (isManualSaving) {
      return;
    }

    if (!debouncedTitle && !debouncedContent.content?.length) {
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

    const noteData = {
      title: debouncedTitle || "Sans titre",
      content: debouncedContent,
      plainText,
      status,
      visibility,
    };

    if (noteId) {
      updateMutation.mutate({ id: noteId, data: noteData });
    } else {
      createMutation.mutate(noteData);
    }
  }, [debouncedTitle, debouncedContent, status, visibility, isManualSaving]);

  const handleDelete = useCallback(async () => {
    if (!noteId) {
      navigate("/notes");
      return;
    }

    if (!confirm("Êtes-vous sûr de vouloir supprimer cette note ?")) {
      return;
    }

    try {
      await apiRequest(`/api/notes/${noteId}`, "DELETE");
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({
        title: "Note supprimée",
        description: "La note a été supprimée avec succès",
      });
      navigate("/notes");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la note",
        variant: "destructive",
      });
    }
  }, [noteId, navigate, queryClient, toast]);

  const handleSaveDraft = useCallback(() => {
    setIsManualSaving(true);
    
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

    if (noteId) {
      // Update existing note with all fields including content
      updateMutation.mutate({ 
        id: noteId, 
        data: { 
          title: title || "Sans titre",
          content,
          plainText,
          status: "draft",
          visibility,
        } 
      });
      toast({
        title: "Brouillon enregistré",
        description: "La note a été enregistrée en brouillon",
      });
    } else {
      // Create note with draft status
      createMutation.mutate({
        title: title || "Sans titre",
        content,
        plainText,
        status: "draft",
        visibility,
      });
      toast({
        title: "Brouillon enregistré",
        description: "La note a été créée en brouillon",
      });
    }
  }, [noteId, title, content, visibility, updateMutation, createMutation, toast]);

  const handlePublish = useCallback(() => {
    setIsManualSaving(true);
    setStatus("active");
    
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

    if (noteId) {
      // Update existing note with all fields including content
      updateMutation.mutate({ 
        id: noteId, 
        data: { 
          title: title || "Sans titre",
          content,
          plainText,
          status: "active",
          visibility,
        } 
      });
      toast({
        title: "Note publiée",
        description: "La note est maintenant active",
      });
    } else {
      // Create note with active status
      createMutation.mutate({
        title: title || "Sans titre",
        content,
        plainText,
        status: "active",
        visibility,
      });
      toast({
        title: "Note publiée",
        description: "La note a été créée et publiée",
      });
    }
  }, [noteId, title, content, visibility, updateMutation, createMutation, toast]);

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
              <h1 className="text-3xl font-heading font-bold text-foreground">
                {title || "Nouvelle note"}
              </h1>
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
                    Sauvegardé à {lastSaved.toLocaleTimeString()}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as any)}
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
          placeholder="Commencez à écrire votre note..."
        />
      </div>
    </div>
  );
}
