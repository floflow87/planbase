import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft, Save, Trash2, Lock, LockOpen, Globe, ChevronDown, Star, MoreVertical, FolderKanban, Users, Menu, Share2, FileDown, History, Settings2, Eye, EyeOff, Ticket, ExternalLink, MessageSquare, GitPullRequest, CheckCircle2, XCircle, CornerDownRight, Pencil, Reply, UserPlus, Bot, Sparkles, Wand2, Lightbulb, Loader2, Crown, ChevronsLeft, ChevronsRight, ImagePlus, Trash, Link2, Move } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
import NoteEditor, { type NoteEditorRef, type NoteSelectionInfo } from "@/components/NoteEditor";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, optimisticUpdate, optimisticUpdateSingle, rollbackOptimistic, queryClient as qc } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
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
import { CoverGalleryModal } from "@/components/CoverGalleryModal";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, X } from "lucide-react";
import { VoiceRecordingButton } from "@/components/VoiceRecordingButton";
import { Input } from "@/components/ui/input";
import { useBilling } from "@/hooks/useBilling";

type AiAction = "summarize" | "improve" | "recommendations";

function NoteAiActions({
  noteTitle,
  content,
  collapsed,
  onToggle,
}: {
  noteTitle: string;
  content: unknown;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { hasFeature } = useBilling();
  const [, setLocation] = useLocation();
  const [activeAction, setActiveAction] = useState<AiAction | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractText = (doc: unknown): string => {
    if (!doc) return "";
    const parts: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (n.type === "text" && typeof n.text === "string") parts.push(n.text);
      if (Array.isArray(n.content)) n.content.forEach(walk);
    };
    walk(doc);
    return parts.join(" ").trim();
  };

  const handleAction = async (action: AiAction) => {
    const text = extractText(content);
    if (!text) { setError("La note est vide"); return; }
    setActiveAction(action);
    setResult(null);
    setError(null);
    setIsLoading(true);
    try {
      const endpoint =
        action === "summarize" ? "/api/ai/summarize"
        : action === "improve" ? "/api/ai/improve"
        : "/api/ai/recommendations";
      const res = await apiRequest(endpoint, "POST", { content, title: noteTitle, type: "note" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de l'IA");
    } finally {
      setIsLoading(false);
    }
  };

  const actionLabels: Record<AiAction, string> = {
    summarize: "Synthétiser",
    improve: "Améliorer",
    recommendations: "Recommandations",
  };
  const actionIcons: Record<AiAction, typeof Bot> = {
    summarize: Sparkles,
    improve: Wand2,
    recommendations: Lightbulb,
  };

  if (collapsed) return null;

  const noAi = !hasFeature("ai_assistant");

  return (
    <div className="border-l bg-background flex flex-col flex-shrink-0 w-64" data-testid="note-ai-panel">
      <div className="flex items-center justify-between border-b px-3 py-1.5 flex-shrink-0">
        <span className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
          <Bot className="w-3.5 h-3.5 text-violet-500" />
          Infos IA
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={onToggle} data-testid="button-toggle-ai-panel-close">
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md text-xs">
            Réduire le panneau IA
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {noAi ? (
          <div className="space-y-2" data-testid="note-ai-actions-upgrade">
            <div className="flex flex-col gap-1.5 rounded-md border px-3 py-2.5 bg-muted/30">
              <div className="flex items-center gap-2">
                <Crown className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <span className="text-xs font-medium">Plan Agence requis</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Les actions IA sont réservées au plan Agence.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={() => setLocation("/pricing")}
              data-testid="button-upgrade-note-ai"
            >
              Passer au plan Agence
            </Button>
          </div>
        ) : (
          <div className="space-y-2" data-testid="note-ai-actions">
            <p className="text-[11px] text-muted-foreground px-0.5">Actions IA sur cette note :</p>
            <div className="space-y-1.5">
              {(["summarize", "improve", "recommendations"] as AiAction[]).map((action) => {
                const Icon = actionIcons[action];
                return (
                  <Button
                    key={action}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs h-7 gap-2"
                    onClick={() => handleAction(action)}
                    disabled={isLoading}
                    data-testid={`button-ai-note-${action}`}
                  >
                    {isLoading && activeAction === action
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Icon className="w-3 h-3" />
                    }
                    {actionLabels[action]}
                  </Button>
                );
              })}
            </div>
            {(result || error) && (
              <Card className="mt-1">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {activeAction ? actionLabels[activeAction] : "IA"} — Résultat
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] text-muted-foreground px-1"
                      onClick={() => { setResult(null); setError(null); setActiveAction(null); }}
                      data-testid="button-ai-result-close"
                    >
                      Fermer
                    </Button>
                  </div>
                  {error
                    ? <p className="text-xs text-destructive">{error}</p>
                    : <p className="text-xs text-foreground whitespace-pre-wrap">{result}</p>
                  }
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
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
  const [accessLevel, setAccessLevel] = useState<"read" | "comment">("comment");
  const [collabPanelOpen, setCollabPanelOpen] = useState(false);
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(true);
  const [activeSelection, setActiveSelection] = useState<NoteSelectionInfo | null>(null);
  const [selectionPopoverOpen, setSelectionPopoverOpen] = useState(false);
  const [collabMode, setCollabMode] = useState<"comment" | "suggest" | null>(null);
  const [collabInput, setCollabInput] = useState("");
  const [suggestionInput, setSuggestionInput] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentInput, setEditCommentInput] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState("");
  const [shareNewPermission, setShareNewPermission] = useState<"read" | "comment" | "edit">("comment");
  const [shareSelectedUser, setShareSelectedUser] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entitySelectorOpen, setEntitySelectorOpen] = useState(false);
  const [entitySelectorTab, setEntitySelectorTab] = useState<"project" | "client" | "ticket">("project");
  const [isFavorite, setIsFavorite] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverImageHovered, setCoverImageHovered] = useState(false);
  const [coverImageUploading, setCoverImageUploading] = useState(false);
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const [coverImagePositionY, setCoverImagePositionY] = useState(50);
  const [repositionMode, setRepositionMode] = useState(false);
  const [coverImageBlobUrl, setCoverImageBlobUrl] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const isDraggingRef = useRef(false);
  const [lierPopoverOpen, setLierPopoverOpen] = useState(false);
  const [metaRowHovered, setMetaRowHovered] = useState(false);
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
    setAccessLevel(((note as any).accessLevel || (note as any).access_level || "comment") as "read" | "comment");
    setIsFavorite(note.isFavorite || false);
    setCoverImageUrl((note as any).coverImageUrl ?? null);
    // Load cover position from localStorage
    const savedPos = id ? localStorage.getItem(`coverPos_${id}`) : null;
    setCoverImagePositionY(savedPos !== null ? Number(savedPos) : 50);
    // Signal that the correct content is now in state — NoteEditor can mount
    setContentReady(true);
  }, [note, getPendingSnapshot, id]);

  // Fetch cover image as blob URL (avoids auth header issues with <img> tags)
  // Skip for color:, gradient:, /covers/ (served statically), or external http URLs
  useEffect(() => {
    if (!coverImageUrl || !id) {
      setCoverImageBlobUrl(null);
      return;
    }
    // These types don't need a proxy fetch
    if (
      coverImageUrl.startsWith("color:") ||
      coverImageUrl.startsWith("gradient:") ||
      coverImageUrl.startsWith("/covers/") ||
      coverImageUrl.startsWith("http://") ||
      coverImageUrl.startsWith("https://")
    ) {
      setCoverImageBlobUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/notes/${id}/cover-image-file`, {
          credentials: "include",
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setCoverImageBlobUrl(objectUrl);
      } catch {
        if (!cancelled) setCoverImageBlobUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [coverImageUrl, id]);

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
    setDeleteDialogOpen(false);
    // Optimistically remove from cache then navigate immediately
    queryClient.setQueryData<Note[]>(["/api/notes"], (old) =>
      old ? old.filter((n) => n.id !== id) : []
    );
    navigate("/notes");
    try {
      await apiRequest(`/api/notes/${id}`, "DELETE");
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({
        title: "Note supprimée",
        description: "La note a été supprimée avec succès",
        variant: "success",
      });
    } catch (error: any) {
      // Rollback on failure
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la note",
        variant: "destructive",
      });
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

  // ─── Collaboration: Comments & Suggestions ──────────────────────────────────

  const { data: noteComments = [], refetch: refetchComments } = useQuery<any[]>({
    queryKey: ["/api/notes", id, "comments"],
    queryFn: async () => { const r = await apiRequest(`/api/notes/${id}/comments`, "GET"); return r.json(); },
    enabled: !!id && collabPanelOpen,
  });

  const { data: noteSuggestions = [], refetch: refetchSuggestions } = useQuery<any[]>({
    queryKey: ["/api/notes", id, "suggestions"],
    queryFn: async () => { const r = await apiRequest(`/api/notes/${id}/suggestions`, "GET"); return r.json(); },
    enabled: !!id && collabPanelOpen,
  });

  const createCommentMutation = useMutation({
    mutationFn: async (data: { selected_text: string; selection_from?: number; selection_to?: number; comment_text: string }) => {
      const r = await apiRequest(`/api/notes/${id}/comments`, "POST", data);
      return r.json();
    },
    onSuccess: () => { refetchComments(); setCollabInput(""); setCollabMode(null); setSelectionPopoverOpen(false); toast({ title: "Commentaire ajouté", variant: "success" }); },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: async ({ cid, status }: { cid: string; status: string }) => {
      const r = await apiRequest(`/api/notes/${id}/comments/${cid}`, "PATCH", { status });
      return r.json();
    },
    onSuccess: () => refetchComments(),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (cid: string) => {
      const r = await apiRequest(`/api/notes/${id}/comments/${cid}`, "DELETE");
      return r.json();
    },
    onSuccess: () => refetchComments(),
  });

  const editCommentMutation = useMutation({
    mutationFn: async ({ cid, comment_text }: { cid: string; comment_text: string }) => {
      const r = await apiRequest(`/api/notes/${id}/comments/${cid}`, "PATCH", { comment_text });
      return r.json();
    },
    onSuccess: () => { refetchComments(); setEditingCommentId(null); setEditCommentInput(""); },
  });

  const addReplyMutation = useMutation({
    mutationFn: async ({ parent_id, comment_text }: { parent_id: string; comment_text: string }) => {
      const r = await apiRequest(`/api/notes/${id}/comments`, "POST", { comment_text, parent_id });
      return r.json();
    },
    onSuccess: () => { refetchComments(); setReplyingToId(null); setReplyInput(""); },
  });

  // Note shares queries and mutations
  const { data: noteShares = [], refetch: refetchShares } = useQuery<any[]>({
    queryKey: ["/api/notes", id, "shares"],
    queryFn: async () => { const r = await apiRequest(`/api/notes/${id}/shares`, "GET"); return r.json(); },
    enabled: !!id && shareDialogOpen,
  });

  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/team-members"],
    queryFn: async () => { const r = await apiRequest("/api/team-members", "GET"); return r.json(); },
    enabled: shareDialogOpen,
  });

  const addShareMutation = useMutation({
    mutationFn: async ({ shared_with_user_id, permission }: { shared_with_user_id: string; permission: string }) => {
      const r = await apiRequest(`/api/notes/${id}/shares`, "POST", { shared_with_user_id, permission });
      return r.json();
    },
    onSuccess: () => { refetchShares(); setShareSelectedUser(null); setShareSearchQuery(""); toast({ title: "Membre invité", variant: "success" }); },
  });

  const updateShareMutation = useMutation({
    mutationFn: async ({ shareId, permission }: { shareId: string; permission: string }) => {
      const r = await apiRequest(`/api/notes/${id}/shares/${shareId}`, "PATCH", { permission });
      return r.json();
    },
    onSuccess: () => refetchShares(),
  });

  const removeShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      await apiRequest(`/api/notes/${id}/shares/${shareId}`, "DELETE");
    },
    onSuccess: () => { refetchShares(); toast({ title: "Accès retiré", variant: "default" }); },
  });

  const createSuggestionMutation = useMutation({
    mutationFn: async (data: { selected_text: string; replacement_text: string; selection_from?: number; selection_to?: number }) => {
      const r = await apiRequest(`/api/notes/${id}/suggestions`, "POST", data);
      return r.json();
    },
    onSuccess: () => { refetchSuggestions(); setSuggestionInput(""); setCollabMode(null); setSelectionPopoverOpen(false); toast({ title: "Suggestion envoyée", variant: "success" }); },
  });

  const resolveSuggestionMutation = useMutation({
    mutationFn: async ({ sid, status }: { sid: string; status: string }) => {
      const r = await apiRequest(`/api/notes/${id}/suggestions/${sid}`, "PATCH", { status });
      return r.json();
    },
    onSuccess: (_, vars) => {
      refetchSuggestions();
      if (vars.status === 'accepted') {
        const sugg = noteSuggestions.find((s: any) => s.id === vars.sid);
        if (sugg && editorRef.current) {
          const replaced = editorRef.current.replaceText(sugg.selected_text, sugg.replacement_text);
          if (replaced) toast({ title: "Suggestion appliquée", variant: "success" });
          else toast({ title: "Texte non trouvé dans l'éditeur", variant: "default" });
        }
      }
    },
  });

  const openCollabPanel = useCallback(() => {
    setCollabPanelOpen(true);
    refetchComments();
    refetchSuggestions();
  }, [refetchComments, refetchSuggestions]);

  const handleSelectionChange = useCallback((info: NoteSelectionInfo | null) => {
    setActiveSelection(info);
    if (info) {
      setSelectionPopoverOpen(true);
    } else {
      setSelectionPopoverOpen(false);
      setCollabMode(null);
    }
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

  const handleCoverImageUpload = useCallback(async (file: File) => {
    if (!id || !file) return;
    setCoverImageUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/notes/${id}/cover-image`, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setCoverImageUrl(data.coverImageUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'uploader l'image de couverture" });
    } finally {
      setCoverImageUploading(false);
    }
  }, [id, queryClient, toast]);

  const handleRemoveCoverImage = useCallback(async () => {
    if (!id) return;
    setCoverImageUrl(null);
    try {
      await fetch(`/api/notes/${id}/cover-image`, { method: "DELETE", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'image" });
    }
  }, [id, queryClient, toast]);

  // Apply a color or gradient cover (saves as special URL value, no file upload needed)
  const handleApplyCoverValue = useCallback(async (value: string) => {
    if (!id) return;
    setCoverImageUrl(value);
    setCoverImageBlobUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/notes/${id}/cover-image-value`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ coverImageUrl: value }),
        credentials: "include",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'appliquer la couverture" });
    }
  }, [id, queryClient, toast]);

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
      <div className="flex-none bg-background">
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
          /* DESKTOP: cover image banner + overlaid action buttons */
          <div
            className={`relative w-full group overflow-hidden ${coverImageUrl ? 'min-h-[220px]' : ''}`}
            onMouseEnter={() => setCoverImageHovered(true)}
            onMouseLeave={() => setCoverImageHovered(false)}
          >
            {/* Cover image background */}
            {coverImageUrl && (() => {
              // Solid color
              if (coverImageUrl.startsWith("color:")) {
                const hex = coverImageUrl.slice(6);
                return (
                  <div className="absolute inset-0" style={{ backgroundColor: hex }} />
                );
              }
              // Gradient
              if (coverImageUrl.startsWith("gradient:")) {
                const grad = coverImageUrl.slice(9);
                return (
                  <div className="absolute inset-0" style={{ background: grad }} />
                );
              }
              // Static gallery image (/covers/...) or external http URL
              const staticSrc =
                coverImageUrl.startsWith("/covers/") ||
                coverImageUrl.startsWith("http://") ||
                coverImageUrl.startsWith("https://")
                  ? coverImageUrl
                  : null;
              // Uploaded file (blob URL from proxy)
              const imgSrc = staticSrc ?? coverImageBlobUrl;
              return (
                <>
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                      style={{ objectPosition: `center ${coverImagePositionY}%` }}
                      draggable={false}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-muted/30 animate-pulse" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />
                </>
              );
            })()}
            {/* Reposition drag overlay */}
            {coverImageUrl && repositionMode && (
              <div
                className="absolute inset-0 z-30 flex items-end justify-center pb-6 cursor-ns-resize select-none"
                style={{ background: 'rgba(0,0,0,0.15)' }}
                onMouseDown={() => { isDraggingRef.current = true; }}
                onMouseUp={() => { isDraggingRef.current = false; }}
                onMouseLeave={() => { isDraggingRef.current = false; }}
                onMouseMove={(e) => {
                  if (!isDraggingRef.current) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                  setCoverImagePositionY(Math.max(0, Math.min(100, y)));
                }}
              >
                <div className="flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-lg px-5 py-2.5 pointer-events-auto">
                  <span className="text-white text-xs font-medium">Faites glisser pour repositionner</span>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-white text-black hover:bg-white/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRepositionMode(false);
                      if (id) localStorage.setItem(`coverPos_${id}`, String(coverImagePositionY));
                    }}
                    data-testid="button-reposition-done"
                  >
                    Terminé
                  </Button>
                </div>
              </div>
            )}
            {/* Upload spinner */}
            {coverImageUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-40">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
            {/* Row 1: Back + sync status + spacer + selectors + action menu */}
            <div className={`relative z-10 flex items-center gap-1.5 px-4 py-3 ${coverImageUrl ? 'text-white' : ''}`}>
              <Button 
                variant="ghost" 
                size="icon" 
                data-testid="button-back" 
                onClick={() => navigate("/notes")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`text-xs cursor-default select-none ${coverImageUrl ? 'text-white/70' : 'text-muted-foreground'}`} data-testid="autosave-status">
                    {syncState.isSyncing ? "Sauvegarde..." : syncState.hasPending ? "En attente..." : syncState.lastSynced ? "Sauvegardé" : ""}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border">Auto-sauvegarde activée</TooltipContent>
              </Tooltip>

              <div className="flex-1" />

              {syncState.error ? (
                <span className="text-xs text-red-500">Erreur de sync</span>
              ) : null}

              {/* Share Dialog */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setShareDialogOpen(true)}
                data-testid="button-share"
              >
                <Share2 className="w-3.5 h-3.5" />
                Partager
                {noteShares.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">{noteShares.length}</Badge>
                )}
              </Button>

              <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogContent className="max-w-md bg-white dark:bg-gray-900">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Share2 className="w-4 h-4" />
                      Partager la note
                    </DialogTitle>
                    <DialogDescription>
                      Invitez des membres à consulter ou modifier ce document.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    {/* Add member section */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inviter un membre</p>
                      {/* Member search */}
                      {shareSelectedUser ? (
                        <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30">
                          <Avatar className="w-6 h-6">
                            {shareSelectedUser.avatar_url && <AvatarImage src={shareSelectedUser.avatar_url} />}
                            <AvatarFallback className="text-[10px]">{(shareSelectedUser.first_name?.[0] || shareSelectedUser.email?.[0] || '?').toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs flex-1 font-medium">
                            {shareSelectedUser.first_name ? `${shareSelectedUser.first_name} ${shareSelectedUser.last_name || ''}`.trim() : shareSelectedUser.email}
                          </span>
                          <button type="button" onClick={() => setShareSelectedUser(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs text-muted-foreground" data-testid="button-search-member">
                              <UserPlus className="w-3.5 h-3.5" />
                              Rechercher un membre...
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-0 bg-white dark:bg-gray-900" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Nom ou email..."
                                value={shareSearchQuery}
                                onValueChange={setShareSearchQuery}
                              />
                              <CommandList>
                                <CommandEmpty>Aucun membre trouvé</CommandEmpty>
                                <CommandGroup>
                                  {teamMembers
                                    .filter((m: any) => !noteShares.find((s: any) => s.shared_with_user_id === m.id))
                                    .filter((m: any) => {
                                      const q = shareSearchQuery.toLowerCase();
                                      return !q || m.email?.toLowerCase().includes(q) ||
                                        m.first_name?.toLowerCase().includes(q) ||
                                        m.last_name?.toLowerCase().includes(q);
                                    })
                                    .map((m: any) => (
                                      <CommandItem
                                        key={m.id}
                                        value={m.email}
                                        onSelect={() => { setShareSelectedUser(m); setShareSearchQuery(""); }}
                                        className="flex items-center gap-2 cursor-pointer"
                                      >
                                        <Avatar className="w-5 h-5">
                                          {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                                          <AvatarFallback className="text-[9px]">{(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-medium truncate">
                                            {m.first_name ? `${m.first_name} ${m.last_name || ''}`.trim() : m.email}
                                          </div>
                                          {m.first_name && <div className="text-[10px] text-muted-foreground truncate">{m.email}</div>}
                                        </div>
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}

                      {/* Permission selector + invite button */}
                      <div className="flex gap-2">
                        <Select value={shareNewPermission} onValueChange={(v: any) => setShareNewPermission(v)}>
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-900">
                            <SelectItem value="read">Lecture seule</SelectItem>
                            <SelectItem value="comment">Commentaire</SelectItem>
                            <SelectItem value="edit">Modification</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={!shareSelectedUser || addShareMutation.isPending}
                          onClick={() => {
                            if (shareSelectedUser) {
                              addShareMutation.mutate({ shared_with_user_id: shareSelectedUser.id, permission: shareNewPermission });
                            }
                          }}
                          data-testid="button-invite-member"
                        >
                          Inviter
                        </Button>
                      </div>
                    </div>

                    {/* Current shares list */}
                    {noteShares.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accès actuels</p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {noteShares.map((share: any) => {
                            const name = share.first_name ? `${share.first_name} ${share.last_name || ''}`.trim() : share.email;
                            const initials = (share.first_name?.[0] || share.email?.[0] || '?').toUpperCase();
                            return (
                              <div key={share.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/30">
                                <Avatar className="w-7 h-7">
                                  {share.avatar_url && <AvatarImage src={share.avatar_url} />}
                                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate">{name}</div>
                                  {share.first_name && <div className="text-[10px] text-muted-foreground truncate">{share.email}</div>}
                                </div>
                                <Select
                                  value={share.permission}
                                  onValueChange={(v) => updateShareMutation.mutate({ shareId: share.id, permission: v })}
                                >
                                  <SelectTrigger className="h-6 text-[10px] w-28 border-0 bg-muted/40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white dark:bg-gray-900">
                                    <SelectItem value="read">Lecture</SelectItem>
                                    <SelectItem value="comment">Commentaire</SelectItem>
                                    <SelectItem value="edit">Modification</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-6 h-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeShareMutation.mutate(share.id)}
                                  data-testid={`button-remove-share-${share.id}`}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Copy link */}
                    <div className="border-t pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href).then(() => {
                            toast({ title: "Lien copié dans le presse-papier", variant: "default" });
                          });
                        }}
                        data-testid="button-copy-link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Copier le lien direct
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Collab Panel Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={collabPanelOpen ? "default" : "outline"}
                    size="icon"
                    onClick={() => collabPanelOpen ? setCollabPanelOpen(false) : openCollabPanel()}
                    data-testid="button-collab-panel"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">Commentaires &amp; suggestions</TooltipContent>
              </Tooltip>

              {/* AI Panel Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={!aiPanelCollapsed ? "default" : "outline"}
                    size="icon"
                    onClick={() => setAiPanelCollapsed(v => !v)}
                    data-testid="button-toggle-ai-panel"
                  >
                    <Bot className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
                  {aiPanelCollapsed ? "Afficher le panneau IA" : "Masquer le panneau IA"}
                </TooltipContent>
              </Tooltip>

              {/* Actions dropdown — Save + Delete at top */}
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
                  {/* Save */}
                  <DropdownMenuItem
                    onClick={handleSaveDraft}
                    data-testid="menu-item-save-draft"
                    className="text-xs"
                  >
                    <Save className="w-4 h-4 mr-2 text-green-600" />
                    Enregistrer
                  </DropdownMenuItem>

                  {/* Delete */}
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 text-xs"
                    data-testid="menu-item-delete"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer la note
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

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
                    className="text-xs"
                  >
                    {isEditMode ? <LockOpen className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                    {isEditMode ? "Verrouiller" : "Déverrouiller"}
                  </DropdownMenuItem>
                  
                  {/* Favorite */}
                  <DropdownMenuItem
                    onClick={handleToggleFavorite}
                    data-testid="menu-item-toggle-favorite"
                    className="text-xs"
                  >
                    <Star className={`w-4 h-4 mr-2 ${isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
                    {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  </DropdownMenuItem>
                  
                  {/* Publish */}
                  <DropdownMenuItem
                    onClick={handlePublish}
                    data-testid="menu-item-publish"
                    className="text-xs"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    {status === "active" ? "Dépublier" : "Publier"}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Status items */}
                  <DropdownMenuItem
                    onClick={() => {
                      setStatus("draft");
                      updateMutation.mutate({ status: "draft" });
                    }}
                    data-testid="menu-item-status-draft"
                    className="text-xs"
                  >
                    <Badge 
                      variant="outline" 
                      className="mr-2 bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 text-[10px]"
                    >
                      ●
                    </Badge>
                    Brouillon
                    {status === "draft" && <Check className="w-3 h-3 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setStatus("active");
                      updateMutation.mutate({ status: "active" });
                    }}
                    data-testid="menu-item-status-active"
                    className="text-xs"
                  >
                    <Badge 
                      variant="outline" 
                      className="mr-2 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-[10px]"
                    >
                      ●
                    </Badge>
                    Active
                    {status === "active" && <Check className="w-3 h-3 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setStatus("archived");
                      updateMutation.mutate({ status: "archived" });
                    }}
                    data-testid="menu-item-status-archived"
                    className="text-xs"
                  >
                    <Badge 
                      variant="outline" 
                      className="mr-2 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800 text-[10px]"
                    >
                      ●
                    </Badge>
                    Archivée
                    {status === "archived" && <Check className="w-3 h-3 ml-auto" />}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Attach to project */}
                  <DropdownMenuItem
                    onClick={() => {
                      setEntitySelectorTab("project");
                      setEntitySelectorOpen(true);
                    }}
                    data-testid="menu-item-attach-project"
                    className="text-xs"
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
                    className="text-xs"
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
                    className="text-xs"
                  >
                    <Ticket className="w-4 h-4 mr-2 text-orange-500" />
                    {currentTicket ? `Ticket: ${currentTicket.title}` : "Rattacher à un ticket"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Cover image bottom controls — hover reveal when cover exists */}
            {coverImageUrl && !repositionMode && (
              <div
                className="absolute bottom-3 right-3 flex gap-2 z-20 transition-opacity duration-150"
                style={{ opacity: coverImageHovered ? 1 : 0 }}
              >
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs bg-black/50 text-white border border-white/20 hover:bg-black/70 gap-1.5"
                  onClick={() => setRepositionMode(true)}
                  data-testid="button-reposition-cover"
                >
                  <Move className="w-3.5 h-3.5" />
                  Repositionner
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs bg-black/50 text-white border border-white/20 hover:bg-black/70 gap-1.5"
                  onClick={() => setGalleryOpen(true)}
                  disabled={coverImageUploading}
                  data-testid="button-change-cover"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Changer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs bg-black/50 text-white border border-white/20 hover:bg-red-600 gap-1.5"
                  onClick={handleRemoveCoverImage}
                  data-testid="button-remove-cover"
                >
                  <Trash className="w-3.5 h-3.5" />
                  Supprimer
                </Button>
              </div>
            )}
            {/* No cover: small hover-reveal "add cover" strip below action bar */}
            {!coverImageUrl && (
              <div className="h-8 px-4 flex items-center">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground gap-1.5"
                  style={{ visibility: coverImageHovered ? 'visible' : 'hidden' }}
                  onClick={() => setGalleryOpen(true)}
                  disabled={coverImageUploading}
                  data-testid="button-add-cover"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Ajouter une couverture
                </Button>
              </div>
            )}
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

      {/* Main content row: editor + optional collab panel */}
      <div className="flex-1 overflow-hidden flex">
        {/* Scrollable editor area */}
        <div className="flex-1 overflow-auto relative">

          {/* Selection Popover — floating toolbar on text selection */}
          {activeSelection && selectionPopoverOpen && isEditMode && !isMobile && (
            <div
              className="fixed z-50"
              style={{ bottom: 80, left: '50%', transform: 'translateX(-50%)' }}
              data-testid="selection-popover"
            >
              <Card className="shadow-lg border border-border/60">
                <CardContent className="p-2 flex flex-col gap-2">
                  {collabMode === null && (
                    <div className="flex gap-1 items-center">
                      <span className="text-xs text-muted-foreground max-w-[160px] truncate mr-1">
                        « {activeSelection.selectedText.slice(0, 40)}{activeSelection.selectedText.length > 40 ? '…' : ''} »
                      </span>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setCollabMode("comment")} data-testid="btn-add-comment">
                        <MessageSquare className="w-3 h-3" />Commenter
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setCollabMode("suggest")} data-testid="btn-add-suggestion">
                        <GitPullRequest className="w-3 h-3" />Suggérer
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSelectionPopoverOpen(false); setCollabMode(null); }}>
                        <XCircle className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  {collabMode === "comment" && (
                    <div className="flex flex-col gap-2 w-72">
                      <div className="text-xs font-medium flex items-center gap-1"><MessageSquare className="w-3 h-3" />Ajouter un commentaire</div>
                      <div className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1 truncate">« {activeSelection.selectedText.slice(0, 60)} »</div>
                      <textarea
                        autoFocus
                        value={collabInput}
                        onChange={e => setCollabInput(e.target.value)}
                        placeholder="Votre commentaire..."
                        className="w-full text-sm border rounded-md px-2 py-1.5 resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px]"
                        data-testid="textarea-comment"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCollabMode(null)}>Annuler</Button>
                        <Button size="sm" className="h-7 text-xs" disabled={!collabInput.trim() || createCommentMutation.isPending}
                          onClick={() => {
                            if (!collabInput.trim()) return;
                            createCommentMutation.mutate({ selected_text: activeSelection.selectedText, selection_from: activeSelection.from, selection_to: activeSelection.to, comment_text: collabInput });
                            if (!collabPanelOpen) openCollabPanel();
                          }}
                          data-testid="btn-submit-comment"
                        >Envoyer</Button>
                      </div>
                    </div>
                  )}
                  {collabMode === "suggest" && (
                    <div className="flex flex-col gap-2 w-72">
                      <div className="text-xs font-medium flex items-center gap-1"><GitPullRequest className="w-3 h-3" />Suggérer une modification</div>
                      <div className="text-[11px] text-muted-foreground bg-red-50 dark:bg-red-950/30 rounded px-2 py-1 line-through">« {activeSelection.selectedText.slice(0, 60)} »</div>
                      <textarea
                        autoFocus
                        value={suggestionInput}
                        onChange={e => setSuggestionInput(e.target.value)}
                        placeholder="Nouveau texte proposé..."
                        className="w-full text-sm border rounded-md px-2 py-1.5 resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px]"
                        data-testid="textarea-suggestion"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCollabMode(null)}>Annuler</Button>
                        <Button size="sm" className="h-7 text-xs" disabled={!suggestionInput.trim() || createSuggestionMutation.isPending}
                          onClick={() => {
                            if (!suggestionInput.trim()) return;
                            createSuggestionMutation.mutate({ selected_text: activeSelection.selectedText, replacement_text: suggestionInput, selection_from: activeSelection.from, selection_to: activeSelection.to });
                            if (!collabPanelOpen) openCollabPanel();
                          }}
                          data-testid="btn-submit-suggestion"
                        >Soumettre</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Cover image — hidden file input (kept for direct upload flow) */}
          <input
            ref={coverImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCoverImageUpload(file);
              e.target.value = "";
            }}
          />

          {/* Cover gallery modal */}
          <CoverGalleryModal
            open={galleryOpen}
            onClose={() => setGalleryOpen(false)}
            onSelectColor={handleApplyCoverValue}
            onSelectGradient={handleApplyCoverValue}
            onSelectImage={handleApplyCoverValue}
            onUploadFile={(file) => { handleCoverImageUpload(file); }}
            onRemove={handleRemoveCoverImage}
            hasCover={!!coverImageUrl}
            uploading={coverImageUploading}
          />

          {/* ClickUp-style metadata row — desktop only, hover-reveal */}
          {!isMobile && (
            <div
              className="px-6 pb-1 flex items-center gap-1 min-h-[32px]"
              onMouseEnter={() => setMetaRowHovered(true)}
              onMouseLeave={() => setMetaRowHovered(false)}
            >
              {/* Combined "Lier" button — project + client */}
              <Popover open={lierPopoverOpen} onOpenChange={setLierPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1.5 text-muted-foreground"
                    style={{ visibility: (metaRowHovered || !!currentProject || !!currentClient || lierPopoverOpen) ? 'visible' : 'hidden' }}
                    data-testid="button-lier"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {currentProject && currentClient
                      ? `${currentProject.name} · ${currentClient.name}`
                      : currentProject
                      ? currentProject.name
                      : currentClient
                      ? currentClient.name
                      : "Lier"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 bg-white dark:bg-gray-900" align="start" style={{ zIndex: 10001 }}>
                  <div className="flex flex-col gap-1">
                    <div className="text-xs font-medium text-muted-foreground px-1 pb-1">Liaisons</div>
                    {/* Projet row */}
                    <div className="flex items-center justify-between px-1 py-1 rounded-md">
                      <div className="flex items-center gap-1.5">
                        <FolderKanban className="w-3 h-3 text-violet-500 shrink-0" />
                        {currentProject
                          ? <span className="text-xs font-medium">{currentProject.name}</span>
                          : <span className="text-xs text-muted-foreground">Aucun projet</span>}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {currentProject ? (
                          <>
                            <Link href={`/projects/${currentProject.id}`}>
                              <Button size="icon" variant="ghost" className="h-5 w-5" data-testid="button-go-to-project">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </Link>
                            <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive"
                              onClick={() => { unlinkProjectMutation.mutate(); setLierPopoverOpen(false); }}
                              data-testid="button-unlink-project">
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] text-violet-500"
                            onClick={() => { setLierPopoverOpen(false); setEntitySelectorTab("project"); setEntitySelectorOpen(true); }}
                            data-testid="button-link-project">
                            Lier
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Client row */}
                    <div className="flex items-center justify-between px-1 py-1 rounded-md">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-cyan-500 shrink-0" />
                        {currentClient
                          ? <span className="text-xs font-medium">{currentClient.name}</span>
                          : <span className="text-xs text-muted-foreground">Aucun client</span>}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {currentClient ? (
                          <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive"
                            onClick={() => { unlinkClientMutation.mutate(); setLierPopoverOpen(false); }}
                            data-testid="button-unlink-client">
                            <X className="w-3 h-3" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] text-cyan-500"
                            onClick={() => { setLierPopoverOpen(false); setEntitySelectorTab("client"); setEntitySelectorOpen(true); }}
                            data-testid="button-link-client">
                            Lier
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Tag/Category selector */}
              <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1.5 text-muted-foreground"
                    style={{ visibility: (metaRowHovered || !!note?.categoryId || categoryPopoverOpen) ? 'visible' : 'hidden' }}
                    data-testid="button-category-selector"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    {note?.categoryId
                      ? noteCategories.find(c => c.id === note.categoryId)?.name || "Tag"
                      : "Tag"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2 bg-white dark:bg-gray-900" align="start" style={{ zIndex: 10001 }}>
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-medium text-muted-foreground px-1">Choisir un tag</div>
                    <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                      <Button variant="ghost" size="sm"
                        className={`justify-start h-6 px-2 text-[11px] ${!note?.categoryId ? 'bg-violet-100 dark:bg-violet-900/30' : ''}`}
                        onClick={() => { updateNoteCategoryMutation.mutate(null); setCategoryPopoverOpen(false); }}
                        data-testid="button-category-none">
                        <span className="text-muted-foreground">Aucun</span>
                        {!note?.categoryId && <Check className="w-3 h-3 ml-auto" />}
                      </Button>
                      {noteCategories.map((category) => (
                        <Button key={category.id} variant="ghost" size="sm"
                          className={`justify-start h-6 px-2 text-[11px] ${note?.categoryId === category.id ? 'bg-violet-100 dark:bg-violet-900/30' : ''}`}
                          onClick={() => { updateNoteCategoryMutation.mutate(category.id); setCategoryPopoverOpen(false); }}
                          data-testid={`button-category-${category.id}`}>
                          {category.name}
                          {note?.categoryId === category.id && <Check className="w-3 h-3 ml-auto" />}
                        </Button>
                      ))}
                    </div>
                    <div className="border-t pt-2 mt-1">
                      <div className="flex gap-1">
                        <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Nouveau tag..." className="h-6 text-[11px] bg-white dark:bg-gray-800"
                          onKeyDown={(e) => { if (e.key === 'Enter' && newCategoryName.trim()) createCategoryMutation.mutate(newCategoryName.trim()); }}
                          data-testid="input-new-category" />
                        <Button size="sm" className="h-6 px-2"
                          disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                          onClick={() => { if (newCategoryName.trim()) createCategoryMutation.mutate(newCategoryName.trim()); }}
                          data-testid="button-create-category">
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
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1.5 text-muted-foreground"
                    style={{ visibility: (metaRowHovered || !!note?.noteDate) ? 'visible' : 'hidden' }}
                    data-testid="button-date-selector"
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {note?.noteDate
                      ? new Date(note.noteDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                      : "Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-900" align="start" style={{ zIndex: 10001 }}>
                  <Calendar mode="single" selected={note?.noteDate ? new Date(note.noteDate) : undefined}
                    onSelect={(date) => { if (date) updateNoteDateMutation.mutate(format(date, 'yyyy-MM-dd')); }}
                    initialFocus locale={fr}
                    classNames={{
                      day_selected: "bg-violet-600 text-white hover:bg-violet-700 focus:bg-violet-700",
                      day_today: "bg-accent text-accent-foreground",
                    }}
                  />
                  {note?.noteDate && (
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground"
                        onClick={() => updateNoteDateMutation.mutate(null)} data-testid="button-clear-date">
                        Effacer la date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className={isMobile ? "px-1 py-0" : ""}>
            {contentReady ? (
              <NoteEditor
                key={id}
                ref={editorRef}
                content={content}
                onChange={(c) => { setContent(c); queueUpdate({ content: c }); }}
                onBlur={flushImmediate}
                editable={isEditMode}
                placeholder="Commencez à écrire votre note..."
                borderless={!isMobile}
                onSelectionChange={!isMobile ? handleSelectionChange : undefined}
                {...(!isMobile ? {
                  title,
                  onTitleChange: (newTitle: string) => { setTitle(newTitle); queueUpdate({ title: newTitle }); },
                } : {})}
              />
            ) : (
              <div className="min-h-[400px] flex items-center justify-center text-muted-foreground text-sm">
                Chargement de l'éditeur...
              </div>
            )}
          </div>

          {/* AI Summary */}
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

        {/* Collab Panel — right sidebar */}
        {collabPanelOpen && !isMobile && (() => {
          const fmtDate = (d: string) => {
            if (!d) return '';
            const dt = new Date(d);
            return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' à ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          };
          const topLevelComments = noteComments.filter((c: any) => !c.parent_id);
          const getReplies = (parentId: string) => noteComments
            .filter((c: any) => c.parent_id === parentId)
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const openCount = noteComments.filter((c: any) => c.status === 'open' && !c.parent_id).length + noteSuggestions.filter((s: any) => s.status === 'pending').length;

          const renderAvatar = (item: any, size = 'sm') => {
            const initials = (item.first_name?.[0] || item.email?.[0] || '?').toUpperCase();
            const name = item.first_name || item.email?.split('@')[0] || 'Inconnu';
            return (
              <Avatar className={size === 'sm' ? 'w-6 h-6' : 'w-5 h-5'}>
                {item.avatar_url && <AvatarImage src={item.avatar_url} alt={name} />}
                <AvatarFallback className="text-[9px] font-bold bg-primary/20 text-primary">{initials}</AvatarFallback>
              </Avatar>
            );
          };

          const commentBadge = (status: string) => {
            if (status === 'resolved') return (
              <span className="text-[9px] h-4 px-1.5 py-0.5 flex-shrink-0 rounded-sm font-medium bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/60 dark:text-green-400 dark:border-green-800">Résolu</span>
            );
            return (
              <span className="text-[9px] h-4 px-1.5 py-0.5 flex-shrink-0 rounded-sm font-medium bg-primary text-primary-foreground">Ouvert</span>
            );
          };

          const renderComment = (comment: any, isReply = false) => {
            const replies = isReply ? [] : getReplies(comment.id);
            const isEditing = editingCommentId === comment.id;
            const isReplying = replyingToId === comment.id;
            const isOwn = comment.author_user_id === user?.id;
            return (
              <div key={comment.id} className={`rounded-md mb-2 text-xs border bg-white dark:bg-gray-900 shadow-sm ${comment.status === 'resolved' ? 'opacity-60' : ''}`} data-testid={`comment-${comment.id}`}>
                {/* Main comment body */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="flex items-start gap-1.5 min-w-0">
                      {renderAvatar(comment)}
                      <div className="min-w-0">
                        <span className="font-medium block truncate leading-tight">{comment.first_name || comment.email?.split('@')[0] || 'Inconnu'}</span>
                        <span className="text-[10px] text-muted-foreground">{fmtDate(comment.created_at)}</span>
                      </div>
                    </div>
                    {!isReply && commentBadge(comment.status)}
                  </div>
                  {comment.selected_text && (
                    <button
                      type="button"
                      className="w-full text-left text-[10px] text-muted-foreground bg-muted/40 hover:bg-primary/10 hover:text-primary rounded px-1.5 py-0.5 mb-1.5 truncate flex items-center gap-1 transition-colors cursor-pointer"
                      title="Cliquer pour localiser dans le document"
                      onClick={() => {
                        if (comment.selection_from != null && comment.selection_to != null) {
                          editorRef.current?.scrollToPosition(comment.selection_from, comment.selection_to);
                        } else if (comment.selected_text) {
                          // Fallback: find by text content
                          const editor = editorRef.current?.getEditor();
                          if (editor) {
                            const content = editor.state.doc.textContent;
                            const idx = content.indexOf(comment.selected_text);
                            if (idx !== -1) {
                              editorRef.current?.scrollToPosition(idx + 1, idx + 1 + comment.selected_text.length);
                            }
                          }
                        }
                      }}
                    >
                      <CornerDownRight className="w-2.5 h-2.5 flex-shrink-0" />
                      « {comment.selected_text.slice(0, 50)} »
                    </button>
                  )}
                  {isEditing ? (
                    <div className="mt-1.5 space-y-1.5">
                      <textarea
                        className="w-full text-xs border rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-gray-900"
                        rows={2}
                        value={editCommentInput}
                        onChange={e => setEditCommentInput(e.target.value)}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button size="sm" variant="default" className="h-5 text-[10px] px-2"
                          disabled={editCommentMutation.isPending}
                          onClick={() => editCommentMutation.mutate({ cid: comment.id, comment_text: editCommentInput })}
                        >Sauvegarder</Button>
                        <Button size="sm" variant="ghost" className="h-5 text-[10px] px-2"
                          onClick={() => { setEditingCommentId(null); setEditCommentInput(''); }}
                        >Annuler</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-foreground leading-relaxed mt-1">{comment.comment_text}</p>
                  )}
                  {!isEditing && (
                    <div className="flex gap-0.5 mt-2 flex-wrap">
                      {comment.status === 'open' && !isReply && (
                        <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-green-600"
                          onClick={() => resolveCommentMutation.mutate({ cid: comment.id, status: 'resolved' })}
                          data-testid={`btn-resolve-comment-${comment.id}`}
                        ><CheckCircle2 className="w-3 h-3 mr-0.5" />Résoudre</Button>
                      )}
                      {!isReply && (
                        <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-muted-foreground"
                          onClick={() => { setReplyingToId(isReplying ? null : comment.id); setReplyInput(''); }}
                          data-testid={`btn-reply-comment-${comment.id}`}
                        ><Reply className="w-3 h-3 mr-0.5" />Répondre</Button>
                      )}
                      {isOwn && (
                        <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-muted-foreground"
                          onClick={() => { setEditingCommentId(comment.id); setEditCommentInput(comment.comment_text); }}
                          data-testid={`btn-edit-comment-${comment.id}`}
                        ><Pencil className="w-3 h-3 mr-0.5" />Modifier</Button>
                      )}
                      {isOwn && (
                        <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-red-500"
                          onClick={() => deleteCommentMutation.mutate(comment.id)}
                          data-testid={`btn-delete-comment-${comment.id}`}
                        ><XCircle className="w-3 h-3 mr-0.5" />Supprimer</Button>
                      )}
                    </div>
                  )}
                </div>
                {/* Replies — inside the same card */}
                {(replies.length > 0 || isReplying) && (
                  <div className="border-t border-border/40 pt-2 pb-2 px-3 space-y-2">
                    {replies.map((reply: any) => {
                      const replyOwn = reply.author_user_id === user?.id;
                      const replyEditing = editingCommentId === reply.id;
                      return (
                        <div key={reply.id} className="flex gap-1.5">
                          <div className="flex-shrink-0 mt-0.5">{renderAvatar(reply, 'xs')}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1 flex-wrap">
                              <span className="text-[10px] font-semibold">{reply.first_name || reply.email?.split('@')[0] || 'Inconnu'}</span>
                              <span className="text-[9px] text-muted-foreground">{fmtDate(reply.created_at)}</span>
                            </div>
                            {replyEditing ? (
                              <div className="mt-1 space-y-1">
                                <textarea
                                  className="w-full text-[10px] border rounded p-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-gray-900"
                                  rows={2}
                                  value={editCommentInput}
                                  onChange={e => setEditCommentInput(e.target.value)}
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <Button size="sm" variant="default" className="h-4 text-[9px] px-1.5"
                                    disabled={editCommentMutation.isPending}
                                    onClick={() => editCommentMutation.mutate({ cid: reply.id, comment_text: editCommentInput })}
                                  >Sauvegarder</Button>
                                  <Button size="sm" variant="ghost" className="h-4 text-[9px] px-1.5"
                                    onClick={() => { setEditingCommentId(null); setEditCommentInput(''); }}
                                  >Annuler</Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[10px] text-foreground mt-0.5 leading-relaxed">{reply.comment_text}</p>
                            )}
                            {!replyEditing && replyOwn && (
                              <div className="flex gap-0.5 mt-0.5">
                                <Button size="sm" variant="ghost" className="h-4 text-[9px] px-1 text-muted-foreground"
                                  onClick={() => { setEditingCommentId(reply.id); setEditCommentInput(reply.comment_text); }}
                                ><Pencil className="w-2.5 h-2.5 mr-0.5" />Modifier</Button>
                                <Button size="sm" variant="ghost" className="h-4 text-[9px] px-1 text-red-500"
                                  onClick={() => deleteCommentMutation.mutate(reply.id)}
                                ><XCircle className="w-2.5 h-2.5 mr-0.5" />Suppr.</Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* Reply form inside the card */}
                    {isReplying && (
                      <div className="flex gap-1.5 pt-1 border-t border-border/30">
                        <div className="flex-shrink-0 mt-0.5">{renderAvatar({ first_name: user?.user_metadata?.firstName, email: user?.email, avatar_url: user?.user_metadata?.avatar_url }, 'xs')}</div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <textarea
                            className="w-full text-[10px] border rounded p-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-gray-900 placeholder:text-[9px]"
                            rows={2}
                            placeholder="Votre réponse..."
                            value={replyInput}
                            onChange={e => setReplyInput(e.target.value)}
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <Button size="sm" variant="default" className="h-4 text-[9px] px-1.5"
                              disabled={addReplyMutation.isPending || !replyInput.trim()}
                              onClick={() => addReplyMutation.mutate({ parent_id: comment.id, comment_text: replyInput })}
                            >Envoyer</Button>
                            <Button size="sm" variant="ghost" className="h-4 text-[9px] px-1.5"
                              onClick={() => { setReplyingToId(null); setReplyInput(''); }}
                            >Annuler</Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          };

          return (
            <div className="w-80 border-l border-border/60 flex flex-col overflow-hidden bg-white dark:bg-gray-950" data-testid="collab-panel">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-white dark:bg-gray-950">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Collaboration</span>
                  {openCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className="h-4 px-1 text-[10px] cursor-default">{openCount}</Badge>
                      </TooltipTrigger>
                      <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md text-xs max-w-[200px]">
                        {noteComments.filter((c: any) => c.status === 'open' && !c.parent_id).length} commentaire{noteComments.filter((c: any) => c.status === 'open' && !c.parent_id).length !== 1 ? 's' : ''} ouvert{noteComments.filter((c: any) => c.status === 'open' && !c.parent_id).length !== 1 ? 's' : ''} et {noteSuggestions.filter((s: any) => s.status === 'pending').length} suggestion{noteSuggestions.filter((s: any) => s.status === 'pending').length !== 1 ? 's' : ''} en attente.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCollabPanelOpen(false)}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Comments Section */}
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Commentaires ({noteComments.filter((c: any) => c.status === 'open' && !c.parent_id).length} ouverts)
                    </span>
                  </div>
                  {topLevelComments.length === 0 && (
                    <p className="text-xs text-muted-foreground italic px-1">Aucun commentaire</p>
                  )}
                  {topLevelComments.map((comment: any) => renderComment(comment))}
                </div>

                {/* Suggestions Section */}
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <GitPullRequest className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Suggestions ({noteSuggestions.filter((s: any) => s.status === 'pending').length} en attente)
                    </span>
                  </div>
                  {noteSuggestions.length === 0 && (
                    <p className="text-xs text-muted-foreground italic px-1">Aucune suggestion</p>
                  )}
                  {noteSuggestions.map((sugg: any) => {
                    const suggOwn = sugg.author_user_id === user?.id;
                    const suggBadge = () => {
                      if (sugg.status === 'accepted') return (
                        <span className="text-[9px] px-1.5 py-0.5 flex-shrink-0 rounded-sm font-medium bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/60 dark:text-green-400 dark:border-green-800">Acceptée</span>
                      );
                      if (sugg.status === 'rejected') return (
                        <span className="text-[9px] px-1.5 py-0.5 flex-shrink-0 rounded-sm font-medium bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/60 dark:text-red-400 dark:border-red-800">Refusée</span>
                      );
                      return (
                        <span className="text-[9px] px-1.5 py-0.5 flex-shrink-0 rounded-sm font-medium bg-primary text-primary-foreground">En attente</span>
                      );
                    };
                    return (
                      <div key={sugg.id} className={`rounded-md p-3 mb-2 text-xs border bg-white dark:bg-gray-900 shadow-sm ${sugg.status !== 'pending' ? 'opacity-60' : ''}`} data-testid={`suggestion-${sugg.id}`}>
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <div className="flex items-start gap-1.5 min-w-0">
                            {renderAvatar(sugg)}
                            <div className="min-w-0">
                              <span className="font-medium block truncate leading-tight">{sugg.first_name || sugg.email?.split('@')[0] || 'Inconnu'}</span>
                              <span className="text-[10px] text-muted-foreground">{fmtDate(sugg.created_at)}</span>
                            </div>
                          </div>
                          {suggBadge()}
                        </div>
                        <div className="space-y-1 mb-1.5 mt-1">
                          <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-1.5 py-0.5 line-through truncate">
                            « {sugg.selected_text.slice(0, 50)} »
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded px-1.5 py-0.5">
                            <CornerDownRight className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate">{sugg.replacement_text.slice(0, 50)}</span>
                          </div>
                        </div>
                        {sugg.status === 'pending' && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-green-600"
                              onClick={() => resolveSuggestionMutation.mutate({ sid: sugg.id, status: 'accepted' })}
                              data-testid={`btn-accept-suggestion-${sugg.id}`}
                            ><CheckCircle2 className="w-3 h-3 mr-0.5" />Accepter</Button>
                            <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-red-500"
                              onClick={() => resolveSuggestionMutation.mutate({ sid: sugg.id, status: 'rejected' })}
                              data-testid={`btn-reject-suggestion-${sugg.id}`}
                            ><XCircle className="w-3 h-3 mr-0.5" />Refuser</Button>
                            {suggOwn && (
                              <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-red-500"
                                onClick={() => deleteCommentMutation.mutate(sugg.id)}
                                data-testid={`btn-delete-suggestion-${sugg.id}`}
                              ><XCircle className="w-3 h-3 mr-0.5" />Supprimer</Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Access level control (for public notes) */}
              {visibility === 'account' && (
                <div className="border-t border-border/60 px-4 py-3 bg-white dark:bg-gray-950">
                  <div className="text-xs text-muted-foreground mb-2">Accès note publique</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={accessLevel === 'read' ? 'default' : 'outline'}
                      className="h-7 text-xs flex-1"
                      onClick={() => { setAccessLevel('read'); updateMutation.mutate({ access_level: 'read' } as any); }}
                      data-testid="btn-access-read"
                    ><Eye className="w-3 h-3 mr-1" />Lecture</Button>
                    <Button
                      size="sm"
                      variant={accessLevel === 'comment' ? 'default' : 'outline'}
                      className="h-7 text-xs flex-1"
                      onClick={() => { setAccessLevel('comment'); updateMutation.mutate({ access_level: 'comment' } as any); }}
                      data-testid="btn-access-comment"
                    ><MessageSquare className="w-3 h-3 mr-1" />Commentaire</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* AI Actions — collapsible right panel */}
        {!isMobile && contentReady && (
          <NoteAiActions
            noteTitle={title}
            content={content}
            collapsed={aiPanelCollapsed}
            onToggle={() => setAiPanelCollapsed(v => !v)}
          />
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
