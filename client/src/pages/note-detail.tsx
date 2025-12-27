import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Save, Trash2, Lock, LockOpen, Globe, ChevronDown, Star, MoreVertical, FolderKanban, Users, Menu, Share2, FileDown, History, Settings2, Eye, EyeOff } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NoteEditor, { type NoteEditorRef } from "@/components/NoteEditor";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, optimisticUpdate, optimisticUpdateSingle, rollbackOptimistic, queryClient as qc } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader } from "@/components/Loader";
import type { Note, InsertNote, Project, NoteLink, Client } from "@shared/schema";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, X } from "lucide-react";
import { VoiceRecordingButton } from "@/components/VoiceRecordingButton";
import { Input } from "@/components/ui/input";

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  // Wrap wouter's navigate to intercept route changes
  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    // This will be checked by our guard before allowing navigation
    setLocation(path, options);
  }, [setLocation]);
  
  // Persist edit mode preference in localStorage
  const [isEditMode, setIsEditMode] = useState(() => {
    const saved = localStorage.getItem("noteEditMode");
    return saved !== null ? saved === "true" : true; // Default to edit mode
  });
  
  // Persist edit mode changes
  useEffect(() => {
    localStorage.setItem("noteEditMode", String(isEditMode));
  }, [isEditMode]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>({ type: 'doc', content: [] });
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [visibility, setVisibility] = useState<"private" | "account" | "client_ro">("private");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastPersistedState, setLastPersistedState] = useState<{title: string, content: any, status: string, visibility: string} | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false); // Default OFF - no localStorage memory
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entitySelectorOpen, setEntitySelectorOpen] = useState(false);
  const [entitySelectorTab, setEntitySelectorTab] = useState<"project" | "client">("project");
  const [saveBeforeLeaveDialogOpen, setSaveBeforeLeaveDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // Editor ref for voice recording
  const editorRef = useRef<NoteEditorRef>(null);
  // Ref to track interim transcript length for deletion
  const interimLengthRef = useRef(0);
  
  // Refs to track current values for save-on-unmount (to avoid stale closures)
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const statusRef = useRef(status);
  const visibilityRef = useRef(visibility);
  const lastPersistedStateRef = useRef(lastPersistedState);
  const noteIdRef = useRef(id);
  const autoSaveEnabledRef = useRef(autoSaveEnabled);
  // Track if the note originally had content (to prevent saving empty content over existing data)
  const originalHadContentRef = useRef(false);
  
  // Keep refs in sync with state
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { visibilityRef.current = visibility; }, [visibility]);
  useEffect(() => { lastPersistedStateRef.current = lastPersistedState; }, [lastPersistedState]);
  useEffect(() => { noteIdRef.current = id; }, [id]);
  useEffect(() => { autoSaveEnabledRef.current = autoSaveEnabled; }, [autoSaveEnabled]);
  
  // Save immediately on unmount (tab change, navigation, etc.) if there are unsaved changes
  useEffect(() => {
    return () => {
      // Only save if autosave is enabled
      if (!autoSaveEnabledRef.current) return;
      
      const currentPersisted = lastPersistedStateRef.current;
      if (!currentPersisted) return;
      
      // Check for unsaved changes using refs (to get latest values)
      const hasChanges = 
        titleRef.current !== currentPersisted.title ||
        JSON.stringify(contentRef.current) !== JSON.stringify(currentPersisted.content) ||
        statusRef.current !== currentPersisted.status ||
        visibilityRef.current !== currentPersisted.visibility;
      
      if (!hasChanges) return;
      
      // Extract plain text from content
      const extractPlainText = (content: any): string => {
        if (!content) return "";
        const getText = (node: any): string => {
          if (node.type === "text") return node.text || "";
          if (node.content && Array.isArray(node.content)) {
            return node.content.map(getText).join(" ");
          }
          return "";
        };
        return getText(content);
      };
      
      const plainText = extractPlainText(contentRef.current);
      
      // SAFETY CHECK: Don't save if content becomes empty and note originally had content
      // This prevents accidental data loss from editor state bugs on unmount
      const hasContentNow = plainText && plainText.trim().length > 0;
      const titleChanged = titleRef.current !== currentPersisted.title;
      
      if (originalHadContentRef.current && !hasContentNow && !titleChanged) {
        // Content disappeared but title didn't change - likely a bug, don't save
        console.warn('Save on unmount blocked: content became empty unexpectedly');
        return;
      }
      
      // Use sendBeacon for reliable save on page unload/navigation
      const payload = JSON.stringify({
        title: titleRef.current || "Sans titre",
        content: contentRef.current,
        plainText,
        status: statusRef.current,
        visibility: visibilityRef.current,
      });
      
      // Save using fetch with keepalive (reliable for page unload)
      const url = `/api/notes/${noteIdRef.current}`;
      
      // Use fetch with keepalive to allow request to complete after page unload
      if (typeof fetch !== 'undefined') {
        // Note: sendBeacon doesn't support PATCH, so we use a regular fetch as fallback
        // The fetch may not complete if the page unloads, but it's better than nothing
        fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true, // This allows the request to outlive the page
        }).catch(() => {
          // Silently fail - the request may not complete on page unload
        });
      }
    };
  }, []); // Empty deps - only run cleanup on unmount

  // Memoized callbacks for voice recording to prevent re-renders
  const handleVoiceTranscript = useCallback((text: string, isFinal: boolean) => {
    if (!text) return;

    if (isFinal) {
      // Delete interim text if exists
      if (interimLengthRef.current > 0) {
        editorRef.current?.deleteLastCharacters(interimLengthRef.current);
        interimLengthRef.current = 0;
      }
      // Insert final text with space
      editorRef.current?.insertText(' ' + text);
    } else {
      // Delete previous interim text if exists
      if (interimLengthRef.current > 0) {
        editorRef.current?.deleteLastCharacters(interimLengthRef.current);
      }
      // Insert new interim text
      editorRef.current?.insertText(text);
      interimLengthRef.current = text.length;
    }
  }, []);

  const handleVoiceError = useCallback((error: string) => {
    toast({
      title: "Erreur de transcription",
      description: error,
      variant: "destructive",
    });
  }, [toast]);

  // Fetch note
  const { data: note, isLoading } = useQuery<Note>({
    queryKey: ["/api/notes", id],
    enabled: !!id,
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch note links
  const { data: noteLinks = [] } = useQuery<NoteLink[]>({
    queryKey: ["/api/notes", id, "links"],
    enabled: !!id,
  });

  // Find linked project
  const linkedProject = noteLinks.find(link => link.targetType === "project");
  const currentProject = linkedProject ? projects.find(p => p.id === linkedProject.targetId) : null;

  // Find linked client
  const linkedClient = noteLinks.find(link => link.targetType === "client");
  const currentClient = linkedClient ? clients.find(c => c.id === linkedClient.targetId) : null;

  // Initialize form with note data ONLY on first load, not during autosave
  useEffect(() => {
    if (note && !title && !content.content?.length) {
      // Only initialize if form is empty (first load)
      setTitle(note.title || "");
      setContent(note.content || { type: 'doc', content: [] });
      setStatus(note.status as any);
      setVisibility(note.visibility as any);
      setIsFavorite(note.isFavorite || false);
      // Track the initial persisted state
      setLastPersistedState({
        title: note.title || "",
        content: note.content || { type: 'doc', content: [] },
        status: note.status,
        visibility: note.visibility,
      });
      // SAFETY: Track if note originally had content to prevent saving empty content over it
      const hadContent = note.plainText && note.plainText.trim().length > 0;
      originalHadContentRef.current = hadContent;
    }
  }, [note]);

  // Removed: No longer saving autosave preference to localStorage
  // Autosave is now OFF by default for every note

  // Debounced values for autosave (3 seconds)
  const debouncedTitle = useDebounce(title, 3000);
  const debouncedContent = useDebounce(content, 3000);

  // Update note mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertNote>) => {
      const response = await apiRequest(`/api/notes/${id}`, "PATCH", data);
      return await response.json();
    },
    onMutate: async (data) => {
      // Optimistic update for both single and list queries
      const { previousData: prevSingle } = optimisticUpdateSingle<Note>(["/api/notes", id!], data as Partial<Note>);
      const { previousData: prevList } = optimisticUpdate<Note>(["/api/notes"], id!, data as Partial<Note>);
      return { prevSingle, prevList };
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
      
      // SAFETY: Update originalHadContentRef based on the saved content
      // This ensures newly created content is protected from empty overwrites
      const savedPlainText = updatedNote.plainText;
      if (savedPlainText && savedPlainText.trim().length > 0) {
        originalHadContentRef.current = true;
      }
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.prevSingle) {
        rollbackOptimistic(["/api/notes", id!], context.prevSingle);
      }
      if (context?.prevList) {
        rollbackOptimistic(["/api/notes"], context.prevList);
      }
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder la note",
        variant: "destructive",
      });
      setIsSaving(false);
    },
    onSettled: () => {
      // Sync with server truth
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
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

    // SAFETY CHECK: Don't save if content becomes empty and note originally had content
    // This prevents accidental data loss from autosave bugs (e.g., editor state not initialized)
    const hasContentNow = plainText && plainText.trim().length > 0;
    
    if (originalHadContentRef.current && !hasContentNow && !titleChanged) {
      // Content disappeared but title didn't change - likely an editor bug, don't save
      console.warn('Autosave blocked: content became empty unexpectedly (note originally had content)');
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
      setEntitySelectorOpen(false);
    } catch (error) {
      // Errors are already handled by the mutations
    }
  }, [linkedProject, linkProjectMutation, unlinkProjectMutation]);

  const handleUnlinkProject = useCallback(() => {
    unlinkProjectMutation.mutate();
  }, [unlinkProjectMutation]);

  // Client link mutation
  const linkClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest(`/api/notes/${id}/links`, "POST", {
        targetType: "client",
        targetId: clientId,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id, "links"] });
      toast({
        title: "Client lié",
        description: "La note a été liée au client avec succès",
        className: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de lier le client",
        variant: "destructive",
      });
    },
  });

  const unlinkClientMutation = useMutation({
    mutationFn: async () => {
      if (!linkedClient) return;
      const response = await apiRequest(
        `/api/notes/${id}/links/${linkedClient.targetType}/${linkedClient.targetId}`,
        "DELETE"
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id, "links"] });
      toast({
        title: "Client délié",
        description: "La note n'est plus liée au client",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de délier le client",
        variant: "destructive",
      });
    },
  });

  const handleSelectClient = useCallback(async (clientId: string) => {
    try {
      // If already linked to a client, unlink first
      if (linkedClient) {
        await unlinkClientMutation.mutateAsync();
      }
      // Link to new client
      await linkClientMutation.mutateAsync(clientId);
      setEntitySelectorOpen(false);
    } catch (error) {
      // Errors are already handled by the mutations
    }
  }, [linkedClient, linkClientMutation, unlinkClientMutation]);

  const handleUnlinkClient = useCallback(() => {
    unlinkClientMutation.mutate();
  }, [unlinkClientMutation]);

  // Toggle favorite handler
  const handleToggleFavorite = useCallback(() => {
    const previousFavoriteState = isFavorite;
    const newFavoriteState = !isFavorite;
    setIsFavorite(newFavoriteState);
    updateMutation.mutate({ isFavorite: newFavoriteState }, {
      onSuccess: () => {
        toast({
          title: newFavoriteState ? "Ajouté aux favoris" : "Retiré des favoris",
          description: newFavoriteState 
            ? "La note a été ajoutée à vos favoris" 
            : "La note a été retirée de vos favoris",
        });
      },
      onError: () => {
        setIsFavorite(previousFavoriteState);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de mettre à jour les favoris",
        });
      }
    });
  }, [isFavorite, updateMutation, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader size="lg" />
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
        {/* MOBILE HEADER: Compact single line */}
        {isMobile ? (
          <div className="px-2 py-2 space-y-1.5">
            {/* Line 1: Back + Title (editable) + Actions dropdown */}
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                data-testid="button-back" 
                className="h-8 w-8 flex-shrink-0"
                onClick={() => interceptNavigation("/notes")}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              
              {/* Inline editable title */}
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sans titre"
                className="flex-1 h-8 text-base font-semibold border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:ring-offset-0 truncate"
                data-testid="input-title-mobile"
                readOnly={!isEditMode}
              />
              
              {/* Discrete save status indicator */}
              <span className="text-[10px] text-muted-foreground flex-shrink-0 min-w-[50px] text-right">
                {isSaving ? "..." : (hasUnsavedChanges() ? "•" : "✓")}
              </span>
              
              {/* Mobile Actions Dropdown (⋯) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    data-testid="button-mobile-actions"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* Edition Section */}
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Édition</div>
                  
                  {/* Autosave toggle */}
                  <DropdownMenuItem
                    onClick={() => {
                      setAutoSaveEnabled(!autoSaveEnabled);
                      toast({
                        title: autoSaveEnabled ? "Auto-sauvegarde désactivée" : "Auto-sauvegarde activée",
                        variant: "default",
                      });
                    }}
                    data-testid="menu-item-autosave-mobile"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Auto-sauvegarde
                    <span className="ml-auto text-xs text-muted-foreground">{autoSaveEnabled ? "ON" : "OFF"}</span>
                  </DropdownMenuItem>
                  
                  {/* Lock/Unlock */}
                  <DropdownMenuItem
                    onClick={() => {
                      const newEditMode = !isEditMode;
                      setIsEditMode(newEditMode);
                      if (newEditMode && status === "active") {
                        setStatus("draft");
                        updateMutation.mutate({ status: "draft" });
                      }
                      toast({
                        title: newEditMode ? "Note déverrouillée" : "Note verrouillée",
                        variant: "default",
                      });
                    }}
                    data-testid="menu-item-lock-mobile"
                  >
                    {isEditMode ? <LockOpen className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                    {isEditMode ? "Verrouiller" : "Déverrouiller"}
                  </DropdownMenuItem>
                  
                  {/* Favorite toggle */}
                  <DropdownMenuItem
                    onClick={() => {
                      handleToggleFavorite();
                    }}
                    data-testid="menu-item-favorite-mobile"
                  >
                    <Star className={`w-4 h-4 mr-2 ${isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
                    {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Linking Section */}
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Liaison</div>
                  
                  <DropdownMenuItem
                    onClick={() => {
                      setEntitySelectorTab("project");
                      setEntitySelectorOpen(true);
                    }}
                    data-testid="menu-item-project-mobile"
                  >
                    <FolderKanban className="w-4 h-4 mr-2 text-violet-500" />
                    {currentProject ? currentProject.name : "Lier à un projet"}
                    {currentProject && <Check className="w-3 h-3 ml-auto" />}
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem
                    onClick={() => {
                      setEntitySelectorTab("client");
                      setEntitySelectorOpen(true);
                    }}
                    data-testid="menu-item-client-mobile"
                  >
                    <Users className="w-4 h-4 mr-2 text-cyan-500" />
                    {currentClient ? currentClient.name : "Lier à un client"}
                    {currentClient && <Check className="w-3 h-3 ml-auto" />}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Save button */}
                  <DropdownMenuItem
                    onClick={handleSaveDraft}
                    data-testid="menu-item-save-mobile"
                  >
                    <Save className="w-4 h-4 mr-2 text-green-600" />
                    Enregistrer
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Status Section */}
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Statut</div>
                  
                  <DropdownMenuItem
                    onClick={() => {
                      setStatus("draft");
                      updateMutation.mutate({ status: "draft" });
                      toast({ title: "Statut: Brouillon", variant: "default" });
                    }}
                    data-testid="menu-item-status-draft-mobile"
                  >
                    <Badge variant="outline" className="mr-2 h-4 px-1 text-[10px] bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300">●</Badge>
                    Brouillon
                    {status === "draft" && <Check className="w-3 h-3 ml-auto" />}
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem
                    onClick={() => {
                      setStatus("active");
                      updateMutation.mutate({ status: "active" });
                      toast({ title: "Statut: Publiée", variant: "success" });
                    }}
                    data-testid="menu-item-status-active-mobile"
                  >
                    <Badge variant="outline" className="mr-2 h-4 px-1 text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300">●</Badge>
                    Publiée
                    {status === "active" && <Check className="w-3 h-3 ml-auto" />}
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem
                    onClick={() => {
                      setStatus("archived");
                      updateMutation.mutate({ status: "archived" });
                      toast({ title: "Statut: Archivée", variant: "default" });
                    }}
                    data-testid="menu-item-status-archived-mobile"
                  >
                    <Badge variant="outline" className="mr-2 h-4 px-1 text-[10px] bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300">●</Badge>
                    Archivée
                    {status === "archived" && <Check className="w-3 h-3 ml-auto" />}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Visibility Section */}
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Visibilité</div>
                  
                  <DropdownMenuItem
                    onClick={() => {
                      setVisibility("private");
                      updateMutation.mutate({ visibility: "private" });
                      toast({ title: "Visibilité: Privée", variant: "default" });
                    }}
                    data-testid="menu-item-visibility-private-mobile"
                  >
                    <EyeOff className="w-4 h-4 mr-2" />
                    Privée
                    {visibility === "private" && <Check className="w-3 h-3 ml-auto" />}
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem
                    onClick={() => {
                      setVisibility("account");
                      updateMutation.mutate({ visibility: "account" });
                      toast({ title: "Visibilité: Équipe", variant: "default" });
                    }}
                    data-testid="menu-item-visibility-account-mobile"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Équipe
                    {visibility === "account" && <Check className="w-3 h-3 ml-auto" />}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Danger Zone */}
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    data-testid="menu-item-delete-mobile"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer la note
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          /* DESKTOP HEADER: Original layout */
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
                  <h1 className="text-xl font-bold text-foreground truncate mb-2">
                    {title || "Sans titre"}
                  </h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge 
                      variant="outline" 
                      className={`${
                        status === "draft" 
                          ? "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800"
                          : status === "archived"
                          ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
                          : "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                      }`}
                      data-testid="badge-status"
                    >
                      {status === "draft" ? "Brouillon" : status === "archived" ? "Archivée" : "Active"}
                    </Badge>
                    {/* Project selector */}
                    <div className="flex items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-6 px-2 text-xs gap-1 ${currentProject ? 'rounded-r-none border-r-0' : ''}`}
                        onClick={() => {
                          setEntitySelectorTab("project");
                          setEntitySelectorOpen(true);
                        }}
                        data-testid="button-project-selector"
                      >
                        <FolderKanban className="w-3 h-3 text-violet-500" />
                        <span className="truncate max-w-[100px]">
                          {currentProject ? currentProject.name : "Projet"}
                        </span>
                      </Button>
                      {currentProject && linkedProject && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0 rounded-l-none hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                          onClick={(e) => {
                            e.stopPropagation();
                            unlinkProjectMutation.mutate();
                          }}
                          data-testid="button-unlink-project"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    {/* Client selector */}
                    <div className="flex items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-6 px-2 text-xs gap-1 ${currentClient ? 'rounded-r-none border-r-0' : ''}`}
                        onClick={() => {
                          setEntitySelectorTab("client");
                          setEntitySelectorOpen(true);
                        }}
                        data-testid="button-client-selector"
                      >
                        <Users className="w-3 h-3 text-cyan-500" />
                        <span className="truncate max-w-[100px]">
                          {currentClient ? currentClient.name : "Client"}
                        </span>
                      </Button>
                      {currentClient && linkedClient && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0 rounded-l-none hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                          onClick={(e) => {
                            e.stopPropagation();
                            unlinkClientMutation.mutate();
                          }}
                          data-testid="button-unlink-client"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    {isSaving ? (
                      <span className="text-xs text-muted-foreground">Sauvegarde...</span>
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
                {/* Auto Save Toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <Switch
                        id="autosave"
                        checked={autoSaveEnabled}
                        onCheckedChange={setAutoSaveEnabled}
                        data-testid="switch-autosave"
                      />
                      <Label htmlFor="autosave" className="cursor-pointer text-[11px]">
                        {autoSaveEnabled ? "ON" : "OFF"}
                      </Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Auto-sauvegarde {autoSaveEnabled ? "activée" : "désactivée"}</TooltipContent>
                </Tooltip>
                
                {/* Save button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      onClick={handleSaveDraft} 
                      size="icon"
                      className="bg-green-50 hover:bg-white dark:hover:bg-muted text-green-700 border-green-200"
                      data-testid="button-save-draft"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Enregistrer</TooltipContent>
              </Tooltip>
              
              {/* Delete button - always visible */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteClick} 
                    size="icon"
                    className="hover:bg-red-600 dark:hover:bg-red-600"
                    data-testid="button-delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Supprimer</TooltipContent>
              </Tooltip>
              
              {/* Actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    data-testid="button-actions-menu"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* Lock/Unlock */}
                  <DropdownMenuItem
                    onClick={() => {
                      const newEditMode = !isEditMode;
                      setIsEditMode(newEditMode);
                      
                      if (newEditMode && status === "active") {
                        setStatus("draft");
                        updateMutation.mutate({ status: "draft" });
                        toast({
                          title: "Retour en brouillon",
                          description: "La note est repassée en brouillon pour édition",
                          variant: "default",
                        });
                      }
                    }}
                    data-testid="menu-item-toggle-edit"
                  >
                    {isEditMode ? <LockOpen className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                    {isEditMode ? "Verrouiller" : "Déverrouiller"}
                  </DropdownMenuItem>
                  
                  {/* Favorite */}
                  <DropdownMenuItem
                    onClick={handleToggleFavorite}
                    data-testid="menu-item-toggle-favorite"
                  >
                    <Star className={`w-4 h-4 mr-2 ${isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
                    {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  </DropdownMenuItem>
                  
                  {/* Publish */}
                  <DropdownMenuItem
                    onClick={handlePublish}
                    data-testid="menu-item-publish"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    {status === "active" ? "Dépublier" : "Publier"}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Status submenu */}
                  <DropdownMenuItem
                    onClick={() => {
                      setStatus("draft");
                      updateMutation.mutate({ status: "draft" });
                    }}
                    data-testid="menu-item-status-draft"
                  >
                    <Badge 
                      variant="outline" 
                      className="mr-2 bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 text-[10px]"
                    >
                      ●
                    </Badge>
                    Brouillon
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setStatus("active");
                      updateMutation.mutate({ status: "active" });
                    }}
                    data-testid="menu-item-status-active"
                  >
                    <Badge 
                      variant="outline" 
                      className="mr-2 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-[10px]"
                    >
                      ●
                    </Badge>
                    Active
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setStatus("archived");
                      updateMutation.mutate({ status: "archived" });
                    }}
                    data-testid="menu-item-status-archived"
                  >
                    <Badge 
                      variant="outline" 
                      className="mr-2 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800 text-[10px]"
                    >
                      ●
                    </Badge>
                    Archivée
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Attach to project */}
                  <DropdownMenuItem
                    onClick={() => {
                      setEntitySelectorTab("project");
                      setEntitySelectorOpen(true);
                    }}
                    data-testid="menu-item-attach-project"
                  >
                    <FolderKanban className="w-4 h-4 mr-2 text-violet-500" />
                    {currentProject ? `Projet: ${currentProject.name}` : "Rattacher à un projet"}
                  </DropdownMenuItem>
                  
                  {/* Attach to client */}
                  <DropdownMenuItem
                    onClick={() => {
                      setEntitySelectorTab("client");
                      setEntitySelectorOpen(true);
                    }}
                    data-testid="menu-item-attach-client"
                  >
                    <Users className="w-4 h-4 mr-2 text-cyan-500" />
                    {currentClient ? `Client: ${currentClient.name}` : "Rattacher à un client"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        )}
      </div>
      
      {/* Entity Selector Dialog (Project / Client) */}
      <Dialog open={entitySelectorOpen} onOpenChange={setEntitySelectorOpen}>
        <DialogContent className="sm:max-w-[450px] overflow-hidden" data-testid="dialog-select-entity">
          <DialogHeader>
            <DialogTitle>Rattacher à une entité</DialogTitle>
          </DialogHeader>
          <Tabs value={entitySelectorTab} onValueChange={(v) => setEntitySelectorTab(v as "project" | "client")} className="w-full overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="project" className="gap-2" data-testid="tab-project">
                <FolderKanban className="w-4 h-4" />
                Projets
              </TabsTrigger>
              <TabsTrigger value="client" className="gap-2" data-testid="tab-client">
                <Users className="w-4 h-4" />
                Clients
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="project" className="mt-0">
              <Command className="rounded-lg border shadow-md bg-white dark:bg-gray-900">
                <CommandInput placeholder="Rechercher un projet..." data-testid="input-search-project" />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                  <CommandGroup>
                    {currentProject && (
                      <CommandItem
                        onSelect={() => {
                          handleUnlinkProject();
                          setEntitySelectorOpen(false);
                        }}
                        data-testid="option-unlink-project"
                        className="text-destructive"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Délier du projet
                      </CommandItem>
                    )}
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
                </CommandList>
              </Command>
            </TabsContent>
            
            <TabsContent value="client" className="mt-0">
              <Command className="rounded-lg border shadow-md bg-white dark:bg-gray-900">
                <CommandInput placeholder="Rechercher un client..." data-testid="input-search-client" />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                  <CommandGroup>
                    {currentClient && (
                      <CommandItem
                        onSelect={() => {
                          handleUnlinkClient();
                          setEntitySelectorOpen(false);
                        }}
                        data-testid="option-unlink-client"
                        className="text-destructive"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Délier du client
                      </CommandItem>
                    )}
                    {clients.map((client) => (
                      <CommandItem
                        key={client.id}
                        onSelect={() => handleSelectClient(client.id)}
                        data-testid={`option-client-${client.id}`}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            currentClient?.id === client.id ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{client.name}</div>
                          {client.email && (
                            <div className="text-xs text-muted-foreground truncate">
                              {client.email}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Scrollable Content - maximize height on mobile */}
      <div className="flex-1 overflow-auto">
        <div className="px-1 py-0 md:p-6">
          {/* Editor */}
          <NoteEditor
            ref={editorRef}
            content={content}
            onChange={setContent}
            title={title}
            onTitleChange={setTitle}
            editable={isEditMode}
            placeholder="Commencez à écrire votre note..."
          />
        </div>

        {/* AI Summary - hidden on mobile to maximize text zone */}
        {note.summary && !isMobile && (
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
        <DialogContent className="sm:max-w-[600px]" data-testid="dialog-save-before-leave">
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

      {/* Voice Recording Button */}
      {isEditMode && (
        <VoiceRecordingButton
          onTranscript={handleVoiceTranscript}
          onError={handleVoiceError}
        />
      )}
    </div>
  );
}
