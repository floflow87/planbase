import { useState, useCallback, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Save, Trash2, Eye, EyeOff, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import NoteEditor from "@/components/NoteEditor";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Note, InsertNote, Project, NoteLink } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Start in edit mode by default (notes created from /notes/new should be editable immediately)
  const [isEditMode, setIsEditMode] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>({ type: 'doc', content: [] });
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [visibility, setVisibility] = useState<"private" | "account" | "client_ro">("private");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

  // Fetch note
  const { data: note, isLoading } = useQuery<Note>({
    queryKey: ["/api/notes", id],
    enabled: !!id,
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch note links
  const { data: noteLinks = [] } = useQuery<NoteLink[]>({
    queryKey: ["/api/notes", id, "links"],
    enabled: !!id,
  });

  // Find linked project
  const linkedProject = noteLinks.find(link => link.targetType === "project");
  const currentProject = linkedProject ? projects.find(p => p.id === linkedProject.targetId) : null;

  // Initialize form with note data ONLY on first load, not during autosave
  useEffect(() => {
    if (note && !title && !content.content?.length) {
      // Only initialize if form is empty (first load)
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
      const response = await apiRequest(`/api/notes/${id}`, "PATCH", data);
      return await response.json();
    },
    onSuccess: (updatedNote) => {
      // Update local state to match server response to avoid UI flicker
      setLastSaved(new Date());
      setIsSaving(false);
      
      // Invalidate both the individual note and the list (for status/visibility changes)
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
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
    if (!note || !isEditMode || !autoSaveEnabled) return;
    
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
  }, [debouncedTitle, debouncedContent, status, visibility, note, isEditMode, autoSaveEnabled]);

  const handleDeleteClick = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
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
    } finally {
      setDeleteDialogOpen(false);
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

  // Project link mutation
  const linkProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest(`/api/notes/${id}/links`, "POST", {
        targetType: "project",
        targetId: projectId,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id, "links"] });
      toast({
        title: "Projet lié",
        description: "La note a été liée au projet avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de lier le projet",
        variant: "destructive",
      });
    },
  });

  const unlinkProjectMutation = useMutation({
    mutationFn: async () => {
      if (!linkedProject) return;
      const response = await apiRequest(
        `/api/notes/${id}/links/${linkedProject.targetType}/${linkedProject.targetId}`,
        "DELETE"
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id, "links"] });
      toast({
        title: "Projet délié",
        description: "La note n'est plus liée au projet",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de délier le projet",
        variant: "destructive",
      });
    },
  });

  const handleSelectProject = useCallback(async (projectId: string) => {
    try {
      // If already linked to a project, unlink first
      if (linkedProject) {
        await unlinkProjectMutation.mutateAsync();
      }
      // Link to new project
      await linkProjectMutation.mutateAsync(projectId);
      setProjectSelectorOpen(false);
    } catch (error) {
      // Errors are already handled by the mutations
    }
  }, [linkedProject, linkProjectMutation, unlinkProjectMutation]);

  const handleUnlinkProject = useCallback(() => {
    unlinkProjectMutation.mutate();
  }, [unlinkProjectMutation]);

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
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-none border-b border-border bg-background">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <Link href="/notes">
                <Button variant="ghost" size="icon" data-testid="button-back" className="mt-1">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-foreground truncate mb-2">
                  {title || "Sans titre"}
                </h1>
                <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-4">
            {/* Auto Save Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="autosave"
                  checked={autoSaveEnabled}
                  onCheckedChange={setAutoSaveEnabled}
                  data-testid="switch-autosave"
                />
                <Label htmlFor="autosave" className="text-sm cursor-pointer">
                  Auto save {autoSaveEnabled ? "ON" : "OFF"}
                </Label>
              </div>
              
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        onClick={handleSaveDraft} 
                        size="icon"
                        className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                        data-testid="button-save-draft"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Enregistrer</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={handlePublish} 
                        size="icon"
                        data-testid="button-publish"
                      >
                        <Globe className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Publier</TooltipContent>
                  </Tooltip>
                </>
              )}
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteClick} 
                    size="icon"
                    data-testid="button-delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Supprimer</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Projet:</Label>
            <Popover open={projectSelectorOpen} onOpenChange={setProjectSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={projectSelectorOpen}
                  className="justify-between min-w-[200px]"
                  data-testid="button-select-project"
                >
                  {currentProject ? currentProject.name : "Sélectionner un projet"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Rechercher un projet..." />
                  <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                  <CommandGroup className="max-h-[300px] overflow-y-auto">
                    {projects.map((project) => (
                      <CommandItem
                        key={project.id}
                        onSelect={() => handleSelectProject(project.id)}
                        data-testid={`option-project-${project.id}`}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            currentProject?.id === project.id ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{project.name}</div>
                          {project.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {project.description}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            {currentProject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnlinkProject}
                data-testid="button-unlink-project"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-note">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette note ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              data-testid="button-confirm-delete"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
