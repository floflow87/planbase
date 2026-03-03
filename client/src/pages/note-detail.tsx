import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft, Save, Trash2, Lock, LockOpen, Globe, ChevronDown, Star, MoreVertical, FolderKanban, Users, Menu, Share2, FileDown, History, Settings2, Eye, EyeOff, Ticket, ExternalLink } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import type { Note, InsertNote, Project, NoteLink, Client, Epic, UserStory, BacklogTask, NoteCategory } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, Plus, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";

// Combined ticket type for note linking
interface TicketItem {
  id: string;
  type: 'epic' | 'user_story' | 'task';
  title: string;
  backlogName?: string;
}
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNoteSync } from "@/hooks/use-note-sync";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, X } from "lucide-react";
import { VoiceRecordingButton } from "@/components/VoiceRecordingButton";
import { Input } from "@/components/ui/input";

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entitySelectorOpen, setEntitySelectorOpen] = useState(false);
  const [entitySelectorTab, setEntitySelectorTab] = useState<"project" | "client" | "ticket">("project");
  const [isFavorite, setIsFavorite] = useState(false);
  // contentReady: true only after resolved content (pending or server) has been set in state.
  // NoteEditor is not rendered until this is true, ensuring useEditor() initializes with the
  // correct content directly rather than relying on a post-mount setContent() sync.
  const [contentReady, setContentReady] = useState(false);

  // Editor ref for voice recording
  const editorRef = useRef<NoteEditorRef>(null);
  // Ref to track interim transcript length for deletion
  const interimLengthRef = useRef(0);
  // Ref: note was already initialized — prevents server re-fetch from overwriting local edits
  const initializedRef = useRef(false);

  // Reset initialization + contentReady when navigating between notes
  useEffect(() => {
    initializedRef.current = false;
    setContentReady(false);
  }, [id]);

  // State sync hook — local-first, operation queue, retry with backoff
  const { queueUpdate, flushImmediate, syncState, getPendingSnapshot } = useNoteSync(id);

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

  // Fetch note categories
  const { data: noteCategories = [] } = useQuery<NoteCategory[]>({
    queryKey: ["/api/note-categories"],
  });

  // State for new category creation
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);

  // Fetch all backlogs with their tickets for linking
  interface BacklogWithItems {
    id: string;
    name: string;
    epics: Epic[];
    userStories: UserStory[];
    tasks: BacklogTask[];
  }
  const { data: backlogs = [] } = useQuery<BacklogWithItems[]>({
    queryKey: ["/api/backlogs-with-items"],
  });

  // Flatten all tickets from backlogs for easier searching
  const allTickets: TicketItem[] = backlogs.flatMap(backlog => [
    ...backlog.epics.map(e => ({ id: e.id, type: 'epic' as const, title: e.title, backlogName: backlog.name })),
    ...backlog.userStories.map(us => ({ id: us.id, type: 'user_story' as const, title: us.title, backlogName: backlog.name })),
    ...backlog.tasks.map(t => ({ id: t.id, type: 'task' as const, title: t.title, backlogName: backlog.name })),
  ]);

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

  // Find linked ticket (epic, user_story, or task)
  const linkedTicket = noteLinks.find(link => 
    link.targetType === "epic" || link.targetType === "user_story" || link.targetType === "backlog_task"
  );
  const currentTicket = linkedTicket ? allTickets.find(t => t.id === linkedTicket.targetId) : null;

  // Initialize form with note data — once per note ID, merging any pending local changes
  useEffect(() => {
    if (!note || initializedRef.current) return;
    initializedRef.current = true;

    // Prefer pending local data (typed but not yet flushed) over server data
    const pending = getPendingSnapshot();

    const resolvedTitle = pending?.title ?? note.title ?? "";
    const rawContent = pending?.content ?? note.content ?? null;

    // Validate ProseMirror doc format: must be { type: 'doc', content: [...] }
    const isValidDoc = (c: any): boolean =>
      c != null && typeof c === 'object' && c.type === 'doc' && Array.isArray(c.content);

    let resolvedContent: any;
    if (isValidDoc(rawContent)) {
      resolvedContent = rawContent;
    } else {
      console.warn('[NoteDetail] content is not a valid ProseMirror doc — using empty fallback', {
        rawType: typeof rawContent,
        rawKeys: rawContent ? Object.keys(rawContent) : null,
        rawPreview: JSON.stringify(rawContent)?.slice(0, 120),
      });
      resolvedContent = { type: 'doc', content: [] };
    }

    // Debug: confirm resolved content exists in React state before editor renders
    const plainTextPreview = (() => {
      const getText = (node: any): string => {
        if (!node) return '';
        if (node.type === 'text') return node.text || '';
        if (Array.isArray(node.content)) return node.content.map(getText).join('');
        return '';
      };
      return getText(resolvedContent).slice(0, 80);
    })();

    console.debug('[NoteDetail] content resolved — handing to editor', {
      noteId: note.id,
      hasPending: !!pending,
      pendingKeys: pending ? Object.keys(pending) : [],
      docNodeCount: resolvedContent.content?.length ?? 0,
      plainTextPreview,
      resolvedContentJSON: JSON.stringify(resolvedContent).slice(0, 200),
    });

    setTitle(resolvedTitle);
    setContent(resolvedContent);
    setStatus(note.status as any);
    setVisibility(note.visibility as any);
    setIsFavorite(note.isFavorite || false);
    // Signal that the correct content is now in state — NoteEditor can mount
    setContentReady(true);
  }, [note, getPendingSnapshot]);

  // Update note mutation (used for status/visibility changes with toast feedback)
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
    onError: (error: any, _variables, context) => {
      if (context?.prevSingle) rollbackOptimistic(["/api/notes", id!], context.prevSingle);
      if (context?.prevList) rollbackOptimistic(["/api/notes"], context.prevList);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder la note",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    try {
      await apiRequest(`/api/notes/${id}`, "DELETE");
      await queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
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
    flushImmediate();
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
  }, [title, content, visibility, updateMutation, toast, flushImmediate]);

  const handlePublish = useCallback(() => {
    flushImmediate();
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
  }, [title, content, visibility, status, updateMutation, toast, flushImmediate]);

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
  // Create note category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("/api/note-categories", "POST", { name });
      return await response.json();
    },
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ["/api/note-categories"] });
      // Also update the note with this category
      updateNoteCategoryMutation.mutate(newCategory.id);
      setCategoryPopoverOpen(false);
      setNewCategoryName("");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la catégorie",
        variant: "destructive",
      });
    },
  });

  // Update note category mutation
  const updateNoteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string | null) => {
      const response = await apiRequest(`/api/notes/${id}`, "PATCH", { categoryId });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour la catégorie",
        variant: "destructive",
      });
    },
  });

  // Update note date mutation with optimistic update
  const updateNoteDateMutation = useMutation({
    mutationFn: async (noteDate: string | null) => {
      const response = await apiRequest(`/api/notes/${id}`, "PATCH", { noteDate });
      return await response.json();
    },
    onMutate: async (noteDate) => {
      await queryClient.cancelQueries({ queryKey: ["/api/notes", id] });
      const previousNote = queryClient.getQueryData<Note>(["/api/notes", id]);
      queryClient.setQueryData<Note>(["/api/notes", id], (old) => 
        old ? { ...old, noteDate } : old
      );
      return { previousNote };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousNote) {
        queryClient.setQueryData(["/api/notes", id], context.previousNote);
      }
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour la date",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });

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

  // Ticket linking mutations
  const linkTicketMutation = useMutation({
    mutationFn: async ({ ticketId, ticketType }: { ticketId: string; ticketType: 'epic' | 'user_story' | 'task' }) => {
      // Map type to targetType format used in noteLinks
      const targetType = ticketType === 'task' ? 'backlog_task' : ticketType;
      const response = await apiRequest(`/api/notes/${id}/links`, "POST", {
        targetType,
        targetId: ticketId,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id, "links"] });
      toast({
        title: "Ticket lié",
        description: "La note a été liée au ticket avec succès",
        className: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de lier le ticket",
        variant: "destructive",
      });
    },
  });

  const unlinkTicketMutation = useMutation({
    mutationFn: async () => {
      if (!linkedTicket) return;
      const response = await apiRequest(
        `/api/notes/${id}/links/${linkedTicket.targetType}/${linkedTicket.targetId}`,
        "DELETE"
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id, "links"] });
      toast({
        title: "Ticket délié",
        description: "La note n'est plus liée au ticket",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de délier le ticket",
        variant: "destructive",
      });
    },
  });

  const handleSelectTicket = useCallback(async (ticket: TicketItem) => {
    try {
      // If already linked to a ticket, unlink first
      if (linkedTicket) {
        await unlinkTicketMutation.mutateAsync();
      }
      // Link to new ticket
      await linkTicketMutation.mutateAsync({ ticketId: ticket.id, ticketType: ticket.type });
      setEntitySelectorOpen(false);
    } catch (error) {
      // Errors are already handled by the mutations
    }
  }, [linkedTicket, linkTicketMutation, unlinkTicketMutation]);

  const handleUnlinkTicket = useCallback(() => {
    unlinkTicketMutation.mutate();
  }, [unlinkTicketMutation]);

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
    <div className="h-full flex flex-col bg-[#F8FAFC] dark:bg-background">
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
                onClick={() => navigate("/notes")}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              
              {/* Inline editable title */}
              <Input
                value={title}
                onChange={(e) => { setTitle(e.target.value); queueUpdate({ title: e.target.value }); }}
                onBlur={flushImmediate}
                placeholder="Sans titre"
                className="flex-1 h-8 text-base font-semibold border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:ring-offset-0 truncate"
                data-testid="input-title-mobile"
                readOnly={false}
              />
              
              {/* Discrete save status indicator */}
              <span className="text-[10px] text-muted-foreground flex-shrink-0 min-w-[50px] text-right">
                {syncState.isSyncing ? "..." : syncState.hasPending ? "•" : "✓"}
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
                  
                  {/* Autosave indicator (always on) */}
                  <DropdownMenuItem disabled data-testid="menu-item-autosave-mobile">
                    <Save className="w-4 h-4 mr-2" />
                    Auto-sauvegarde
                    <span className="ml-auto text-xs text-emerald-500">ON</span>
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
                  onClick={() => navigate("/notes")}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 mb-2">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); queueUpdate({ title: e.target.value }); }}
                      onBlur={flushImmediate}
                      className="flex-1 min-w-0 text-xl font-bold bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
                      placeholder="Sans titre"
                      data-testid="input-note-title-header"
                    />
                    {status !== "draft" && (
                      <Badge 
                        variant="outline" 
                        className={`shrink-0 ${
                          status === "archived"
                            ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
                            : "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                        }`}
                        data-testid="badge-status"
                      >
                        {status === "archived" ? "Archivée" : "Active"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Project selector */}
                    <div className="flex items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900 ${currentProject ? 'rounded-none border-r-0' : ''}`}
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
                        <>
                          <Link href={`/projects/${currentProject.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0 rounded-none border-r-0 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 dark:hover:bg-violet-950"
                              data-testid="button-go-to-project"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </Link>
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
                        </>
                      )}
                    </div>
                    {/* Client selector */}
                    <div className="flex items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900 ${currentClient ? 'rounded-r-none border-r-0' : ''}`}
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
                    
                    {/* Tag/Category selector */}
                    <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900"
                          data-testid="button-category-selector"
                        >
                          <Tag className="w-3 h-3 text-violet-500" />
                          <span className="truncate max-w-[100px]">
                            {note?.categoryId 
                              ? noteCategories.find(c => c.id === note.categoryId)?.name || "Tag"
                              : "Tag"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2 bg-white dark:bg-gray-900" align="start">
                        <div className="flex flex-col gap-2">
                          <div className="text-xs font-medium text-muted-foreground px-1">Choisir un tag</div>
                          <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                            {/* No tag option */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`justify-start h-7 px-2 text-xs ${!note?.categoryId ? 'bg-violet-100 dark:bg-violet-900/30' : ''}`}
                              onClick={() => {
                                updateNoteCategoryMutation.mutate(null);
                                setCategoryPopoverOpen(false);
                              }}
                              data-testid="button-category-none"
                            >
                              <span className="text-muted-foreground">Aucun</span>
                              {!note?.categoryId && <Check className="w-3 h-3 ml-auto" />}
                            </Button>
                            {noteCategories.map((category) => (
                              <Button
                                key={category.id}
                                variant="ghost"
                                size="sm"
                                className={`justify-start h-7 px-2 text-xs ${note?.categoryId === category.id ? 'bg-violet-100 dark:bg-violet-900/30' : ''}`}
                                onClick={() => {
                                  updateNoteCategoryMutation.mutate(category.id);
                                  setCategoryPopoverOpen(false);
                                }}
                                data-testid={`button-category-${category.id}`}
                              >
                                {category.name}
                                {note?.categoryId === category.id && <Check className="w-3 h-3 ml-auto" />}
                              </Button>
                            ))}
                          </div>
                          <div className="border-t pt-2 mt-1">
                            <div className="flex gap-1">
                              <Input
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Nouveau tag..."
                                className="h-7 text-xs bg-white dark:bg-gray-800"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newCategoryName.trim()) {
                                    createCategoryMutation.mutate(newCategoryName.trim());
                                  }
                                }}
                                data-testid="input-new-category"
                              />
                              <Button
                                size="sm"
                                className="h-7 px-2"
                                disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                                onClick={() => {
                                  if (newCategoryName.trim()) {
                                    createCategoryMutation.mutate(newCategoryName.trim());
                                  }
                                }}
                                data-testid="button-create-category"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Date picker */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900"
                          data-testid="button-date-selector"
                        >
                          <CalendarIcon className="w-3 h-3 text-amber-500" />
                          <span className="truncate">
                            {note?.noteDate 
                              ? new Date(note.noteDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                              : "Date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-900" align="start">
                        <Calendar
                          mode="single"
                          selected={note?.noteDate ? new Date(note.noteDate) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              updateNoteDateMutation.mutate(format(date, 'yyyy-MM-dd'));
                            }
                          }}
                          initialFocus
                          locale={fr}
                          classNames={{
                            day_selected: "bg-violet-600 text-white hover:bg-violet-700 focus:bg-violet-700",
                            day_today: "bg-accent text-accent-foreground",
                          }}
                        />
                        {note?.noteDate && (
                          <div className="p-2 border-t">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-xs text-muted-foreground"
                              onClick={() => updateNoteDateMutation.mutate(null)}
                              data-testid="button-clear-date"
                            >
                              Effacer la date
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>

                    {syncState.isSyncing ? (
                      <span className="text-xs text-muted-foreground">Sauvegarde...</span>
                    ) : syncState.lastSynced ? (
                      <span className="text-xs text-muted-foreground">
                        Sauvegardé {formatDistanceToNow(syncState.lastSynced, { addSuffix: true, locale: fr })}
                      </span>
                    ) : syncState.error ? (
                      <span className="text-xs text-red-500">Erreur de sync</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Modifié {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true, locale: fr })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Auto save status indicator */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground cursor-default select-none" data-testid="autosave-status">
                      {syncState.isSyncing ? "Sauvegarde..." : syncState.hasPending ? "En attente..." : syncState.lastSynced ? "Sauvegardé" : ""}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border">Auto-sauvegarde activée</TooltipContent>
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
                <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border">Enregistrer</TooltipContent>
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
                <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border">Supprimer</TooltipContent>
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
                  
                  {/* Attach to ticket */}
                  <DropdownMenuItem
                    onClick={() => {
                      setEntitySelectorTab("ticket");
                      setEntitySelectorOpen(true);
                    }}
                    data-testid="menu-item-attach-ticket"
                  >
                    <Ticket className="w-4 h-4 mr-2 text-orange-500" />
                    {currentTicket ? `Ticket: ${currentTicket.title}` : "Rattacher à un ticket"}
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
          <Tabs value={entitySelectorTab} onValueChange={(v) => setEntitySelectorTab(v as "project" | "client" | "ticket")} className="w-full overflow-hidden">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="project" className="gap-1 text-xs" data-testid="tab-project">
                <FolderKanban className="w-3 h-3" />
                Projets
              </TabsTrigger>
              <TabsTrigger value="client" className="gap-1 text-xs" data-testid="tab-client">
                <Users className="w-3 h-3" />
                Clients
              </TabsTrigger>
              <TabsTrigger value="ticket" className="gap-1 text-xs" data-testid="tab-ticket">
                <Ticket className="w-3 h-3" />
                Tickets
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
            
            <TabsContent value="ticket" className="mt-0">
              <Command className="rounded-lg border shadow-md bg-white dark:bg-gray-900">
                <CommandInput placeholder="Rechercher un ticket..." data-testid="input-search-ticket" />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty>Aucun ticket trouvé.</CommandEmpty>
                  <CommandGroup>
                    {currentTicket && (
                      <CommandItem
                        onSelect={() => {
                          handleUnlinkTicket();
                          setEntitySelectorOpen(false);
                        }}
                        data-testid="option-unlink-ticket"
                        className="text-destructive"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Délier du ticket
                      </CommandItem>
                    )}
                    {allTickets.map((ticket) => (
                      <CommandItem
                        key={ticket.id}
                        onSelect={() => handleSelectTicket(ticket)}
                        data-testid={`option-ticket-${ticket.id}`}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            currentTicket?.id === ticket.id ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              {ticket.type === 'epic' ? 'Epic' : ticket.type === 'user_story' ? 'US' : 'Task'}
                            </Badge>
                            <span className="font-medium truncate">{ticket.title}</span>
                          </div>
                          {ticket.backlogName && (
                            <div className="text-xs text-muted-foreground truncate">
                              {ticket.backlogName}
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
          {/* Editor — only mounted after resolved content is ready in state.
               key={id} forces a full remount when navigating between notes, so
               useEditor() always initialises with the correct content directly. */}
          {contentReady ? (
            <NoteEditor
              key={id}
              ref={editorRef}
              content={content}
              onChange={(c) => { setContent(c); queueUpdate({ content: c }); }}
              onBlur={flushImmediate}
              editable={isEditMode}
              placeholder="Commencez à écrire votre note..."
            />
          ) : (
            <div className="min-h-[400px] flex items-center justify-center text-muted-foreground text-sm">
              Chargement de l'éditeur...
            </div>
          )}
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
