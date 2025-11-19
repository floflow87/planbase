import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Save, Trash2, Eye, EyeOff, Globe, FileText, StickyNote } from "lucide-react";
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

// Convert to document button component with proper state management
function ConvertToDocumentButton({ noteId }: { noteId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  
  const convertMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/notes/${noteId}/convert-to-document`, "POST");
      
      // Parse JSON response once
      const data = await response.json().catch(() => ({ error: response.statusText || "Conversion failed" }));
      
      // Check response status after parsing
      if (!response.ok) {
        throw new Error(data.error || "Conversion failed");
      }
      
      return data;
    },
    onSuccess: async (document) => {
      // Refetch the note to update UI immediately with new type before navigation
      await queryClient.refetchQueries({ queryKey: ["/api/notes", noteId] });
      
      // Also invalidate the list
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      
      toast({
        title: "Note convertie en document",
        description: "La note a été convertie en document avec succès",
        variant: "success",
      });
      
      // Navigate to documents page
      navigate("/documents");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de convertir la note",
        variant: "destructive",
      });
    },
  });
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant="outline"
          onClick={() => convertMutation.mutate()}
          disabled={convertMutation.isPending}
          size="icon"
          data-testid="button-convert-to-document"
        >
          <FileText className="w-4 h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {convertMutation.isPending ? "Conversion en cours..." : "Transformer en document"}
      </TooltipContent>
    </Tooltip>
  );
}

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Wrap wouter's navigate to intercept route changes
  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    // This will be checked by our guard before allowing navigation
    setLocation(path, options);
  }, [setLocation]);
  
  // Start in edit mode by default (notes created from /notes/new should be editable immediately)
  const [isEditMode, setIsEditMode] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>({ type: 'doc', content: [] });
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [visibility, setVisibility] = useState<"private" | "account" | "client_ro">("private");
  const [hasModifiedPublishedNote, setHasModifiedPublishedNote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastPersistedState, setLastPersistedState] = useState<{title: string, content: any, status: string, visibility: string} | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false); // Default OFF - no localStorage memory
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
  const [saveBeforeLeaveDialogOpen, setSaveBeforeLeaveDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [allowNavigation, setAllowNavigation] = useState(false);

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
      // Track the initial persisted state
      setLastPersistedState({
        title: note.title || "",
        content: note.content || { type: 'doc', content: [] },
        status: note.status,
        visibility: note.visibility,
      });
    }
  }, [note]);

  // Removed: No longer saving autosave preference to localStorage
  // Autosave is now OFF by default for every note

  // When user modifies a published note, automatically switch to draft
  useEffect(() => {
    if (!note || !lastPersistedState) return;
    
    // If note was published (active) and user makes changes, switch to draft
    if (lastPersistedState.status === "active" && isEditMode) {
      const hasChanges = 
        title !== lastPersistedState.title ||
        JSON.stringify(content) !== JSON.stringify(lastPersistedState.content);
      
      if (hasChanges && status === "active") {
        setStatus("draft");
        setHasModifiedPublishedNote(true);
        toast({
          title: "Note repassée en brouillon",
          description: "Vos modifications sont en brouillon. Publiez pour les rendre actives.",
          variant: "default",
        });
      }
    }
  }, [title, content, note, lastPersistedState, isEditMode, status, toast]);

  // Debounced values for autosave (3 seconds)
  const debouncedTitle = useDebounce(title, 3000);
  const debouncedContent = useDebounce(content, 3000);

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
      
      // Update persisted state to reflect successful save
      setLastPersistedState({
        title: updatedNote.title || "",
        content: updatedNote.content || { type: 'doc', content: [] },
        status: updatedNote.status,
        visibility: updatedNote.visibility,
      });
      
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

    // SAFETY CHECK: Don't save if content becomes empty and note had content before
    // This prevents accidental data loss from autosave bugs
    const hadContent = note.plainText && note.plainText.trim().length > 0;
    const hasContentNow = plainText && plainText.trim().length > 0;
    
    if (hadContent && !hasContentNow && !titleChanged) {
      // Content disappeared but title didn't change - likely a bug, don't save
      console.warn('Autosave blocked: content became empty unexpectedly');
      return;
    }

    setIsSaving(true);

    updateMutation.mutate({
      title: debouncedTitle || "Sans titre",
      content: debouncedContent,
      plainText,
      status,
      visibility,
    });
  }, [debouncedTitle, debouncedContent, status, visibility, note, isEditMode, autoSaveEnabled]);

  // Check if there are unsaved changes (compare with last persisted state, not original note)
  const hasUnsavedChanges = useCallback(() => {
    if (!lastPersistedState) return false;
    
    // Check if saving is in progress (mutations are pending)
    if (updateMutation.isPending || isSaving) return true;
    
    return (
      title !== lastPersistedState.title ||
      JSON.stringify(content) !== JSON.stringify(lastPersistedState.content) ||
      status !== lastPersistedState.status ||
      visibility !== lastPersistedState.visibility
    );
  }, [lastPersistedState, title, content, status, visibility, updateMutation.isPending, isSaving]);

  // Warn before closing browser tab/window if there are unsaved changes (regardless of autosave)
  useEffect(() => {
    if (!lastPersistedState || allowNavigation) return;
    
    if (!hasUnsavedChanges()) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [lastPersistedState, hasUnsavedChanges, allowNavigation]);

  // Intercept ALL navigation attempts to show save dialog if needed
  const interceptNavigation = useCallback((targetPath: string) => {
    // If navigation is already allowed or no unsaved changes, proceed
    if (allowNavigation || !hasUnsavedChanges()) {
      navigate(targetPath);
      return;
    }
    
    // Otherwise, show dialog
    setPendingNavigation(targetPath);
    setSaveBeforeLeaveDialogOpen(true);
  }, [allowNavigation, hasUnsavedChanges, navigate]);

  // Track current location to detect changes
  const previousLocationRef = useRef(location);

  // Guard navigation: Intercept route changes BEFORE they happen
  useEffect(() => {
    // If location changed and we have unsaved changes and navigation is not allowed
    if (location !== previousLocationRef.current && !allowNavigation && hasUnsavedChanges()) {
      // Navigation attempted! Revert it immediately
      const targetPath = location;
      setLocation(previousLocationRef.current, { replace: true });
      
      // Show dialog
      setPendingNavigation(targetPath);
      setSaveBeforeLeaveDialogOpen(true);
    } else {
      // Update previous location
      previousLocationRef.current = location;
    }
  }, [location, allowNavigation, hasUnsavedChanges, setLocation]);

  // Global click interceptor for ALL links
  useEffect(() => {
    if (allowNavigation || !hasUnsavedChanges()) return;

    const handleClick = (e: MouseEvent) => {
      // Find the link element
      let target = e.target as HTMLElement;
      while (target && target !== document.body) {
        if (target.tagName === 'A' || target.getAttribute('role') === 'link') {
          const href = target.getAttribute('href');
          if (href && href.startsWith('/') && href !== location) {
            // It's an internal link to a different page, intercept it
            e.preventDefault();
            e.stopPropagation();
            setPendingNavigation(href);
            setSaveBeforeLeaveDialogOpen(true);
            return;
          }
        }
        target = target.parentElement as HTMLElement;
      }
    };

    document.addEventListener('click', handleClick, true); // Use capture phase
    return () => document.removeEventListener('click', handleClick, true);
  }, [allowNavigation, hasUnsavedChanges, location]);

  // Intercept browser back/forward buttons
  useEffect(() => {
    if (allowNavigation || !hasUnsavedChanges()) return;

    const handlePopState = () => {
      // Popstate already changed the URL, revert it
      if (hasUnsavedChanges() && !allowNavigation) {
        // Store the target location before reverting
        const targetPath = window.location.pathname;
        
        // Revert to current note URL immediately
        window.history.pushState(null, '', `/notes/${id}`);
        
        // Show dialog
        setPendingNavigation(targetPath);
        setSaveBeforeLeaveDialogOpen(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [allowNavigation, hasUnsavedChanges, id]);

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

  // Save before leave handlers
  const handleSaveAndLeave = useCallback(() => {
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

    // Save and then navigate
    updateMutation.mutate({ 
      title: title || "Sans titre",
      content,
      plainText,
      status,
      visibility,
    }, {
      onSuccess: () => {
        setSaveBeforeLeaveDialogOpen(false);
        setAllowNavigation(true); // Allow navigation after successful save
        if (pendingNavigation) {
          // Use setTimeout to ensure state updates before navigation
          setTimeout(() => {
            navigate(pendingNavigation);
            setPendingNavigation(null);
          }, 0);
        }
      }
    });
  }, [title, content, status, visibility, updateMutation, navigate, pendingNavigation]);

  const handleLeaveWithoutSaving = useCallback(() => {
    setSaveBeforeLeaveDialogOpen(false);
    setAllowNavigation(true); // Allow navigation without saving
    if (pendingNavigation) {
      // Use setTimeout to ensure state updates before navigation
      setTimeout(() => {
        navigate(pendingNavigation);
        setPendingNavigation(null);
      }, 0);
    }
  }, [navigate, pendingNavigation]);

  const handleCancelLeave = useCallback(() => {
    setSaveBeforeLeaveDialogOpen(false);
    setPendingNavigation(null);
  }, []);

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
        className: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
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
              <Button 
                variant="ghost" 
                size="icon" 
                data-testid="button-back" 
                className="mt-1"
                onClick={() => interceptNavigation("/notes")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-foreground truncate mb-2">
                  {title || "Sans titre"}
                </h1>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className="bg-blue-50 text-blue-700 border-blue-200"
                    data-testid="badge-type"
                  >
                    {note.type === "document" ? (
                      <><FileText className="w-3 h-3 mr-1 inline" /> Document</>
                    ) : (
                      <><StickyNote className="w-3 h-3 mr-1 inline" /> Note</>
                    )}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={
                      status === "draft" 
                        ? "bg-gray-100 text-gray-700 border-gray-200"
                        : status === "archived"
                        ? "bg-orange-50 text-orange-700 border-orange-200"
                        : "bg-green-50 text-green-700 border-green-200"
                    }
                    data-testid="badge-status"
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
                <Label htmlFor="autosave" className="cursor-pointer text-[12px]">
                  Auto save {autoSaveEnabled ? "ON" : "OFF"}
                </Label>
              </div>
              
              <Button
                variant="outline"
                onClick={() => setIsEditMode(!isEditMode)}
                data-testid="button-toggle-edit"
                className="text-[12px]"
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
              
              {/* Show Save button in edit mode */}
              {isEditMode && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      onClick={handleSaveDraft} 
                      size="icon"
                      className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                      data-testid="button-save"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Enregistrer</TooltipContent>
                </Tooltip>
              )}
              
              {/* Convert to document button (only for notes) */}
              {note.type === "note" && (
                <ConvertToDocumentButton noteId={id} />
              )}
              
              {/* Publish/Unpublish button */}
              {status === "draft" && (
                <>
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
                  className="justify-between min-w-[200px] text-[12px]"
                  data-testid="button-select-project"
                >
                  {currentProject ? currentProject.name : "Sélectionner un projet"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 bg-white dark:bg-background">
                <Command>
                  <CommandInput placeholder="Rechercher un projet..." />
                  <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                  <CommandGroup className="max-h-[300px] overflow-y-auto bg-[#ffffff]">
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
        <div className="p-6">
          {/* Editor */}
          <NoteEditor
            content={content}
            onChange={setContent}
            title={title}
            onTitleChange={setTitle}
            editable={isEditMode}
            placeholder="Commencez à écrire votre note..."
          />
        </div>

        {/* AI Summary */}
        {note.summary && (
          <div className="px-6 pb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <Badge variant="secondary" className="text-[10px]">Résumé IA</Badge>
                  <p className="text-sm text-muted-foreground flex-1">{note.summary}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {/* Save Before Leave Dialog */}
      <Dialog open={saveBeforeLeaveDialogOpen} onOpenChange={setSaveBeforeLeaveDialogOpen}>
        <DialogContent data-testid="dialog-save-before-leave">
          <DialogHeader>
            <DialogTitle>Modifications non enregistrées</DialogTitle>
            <DialogDescription>
              Vous avez des modifications non enregistrées. Que souhaitez-vous faire ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleCancelLeave}
              data-testid="button-cancel-leave"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleLeaveWithoutSaving}
              data-testid="button-leave-without-saving"
            >
              Quitter sans enregistrer
            </Button>
            <Button
              onClick={handleSaveAndLeave}
              data-testid="button-save-and-leave"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Enregistrement..." : "Enregistrer et quitter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
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
