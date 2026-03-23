import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  ArrowLeft, Trash2, Download, Save, Lock, LockOpen, MoreVertical,
  FolderKanban, ExternalLink, Users, CalendarDays, MessageSquare,
  Share2, X, Check, Send, UserPlus, GitPullRequest, CheckCircle2,
  CornerDownRight, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList,
} from "@/components/ui/command";
import NoteEditor from "@/components/NoteEditor";
import { VoiceRecordingButton } from "@/components/VoiceRecordingButton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader } from "@/components/Loader";
import type { Document, Project, NoteLink, UpdateDocument } from "@shared/schema";
import type { Client } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDistanceToNow, format as formatDate } from "date-fns";
import { fr } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { useAuth } from "@/contexts/AuthContext";

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const [isEditMode, setIsEditMode] = useState(() => {
    const saved = localStorage.getItem("documentEditMode");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("documentEditMode", String(isEditMode));
  }, [isEditMode]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>({ type: 'doc', content: [] });
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
  const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
  const [dateSelectorOpen, setDateSelectorOpen] = useState(false);
  const [documentDate, setDocumentDate] = useState<Date | null>(null);

  // Collab state
  const [collabPanelOpen, setCollabPanelOpen] = useState(false);
  const [collabTab, setCollabTab] = useState<"comments" | "suggestions">("comments");
  const [newComment, setNewComment] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentInput, setEditCommentInput] = useState("");
  const [suggestionOrig, setSuggestionOrig] = useState("");
  const [suggestionReplace, setSuggestionReplace] = useState("");

  // Share state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState("");
  const [shareNewPermission, setShareNewPermission] = useState<"read" | "comment" | "edit">("comment");
  const [shareSelectedUser, setShareSelectedUser] = useState<any>(null);

  // — Queries —
  const { data: document, isLoading } = useQuery<Document>({
    queryKey: ["/api/documents", id],
    enabled: !!id,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: documentLinks = [] } = useQuery<NoteLink[]>({
    queryKey: ["/api/documents", id, "links"],
    enabled: !!id,
  });

  const { data: docComments = [] } = useQuery<any[]>({
    queryKey: ["/api/documents", id, "comments"],
    queryFn: async () => { const r = await apiRequest(`/api/documents/${id}/comments`, "GET"); return r.json(); },
    enabled: !!id && collabPanelOpen,
  });

  const { data: docSuggestions = [] } = useQuery<any[]>({
    queryKey: ["/api/documents", id, "suggestions"],
    queryFn: async () => { const r = await apiRequest(`/api/documents/${id}/suggestions`, "GET"); return r.json(); },
    enabled: !!id && collabPanelOpen,
  });

  const { data: docShares = [], refetch: refetchShares } = useQuery<any[]>({
    queryKey: ["/api/documents", id, "shares"],
    queryFn: async () => { const r = await apiRequest(`/api/documents/${id}/shares`, "GET"); return r.json(); },
    enabled: !!id && shareDialogOpen,
  });

  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/team-members"],
    enabled: shareDialogOpen,
  });

  const linkedProject = documentLinks.find(link => link.targetType === "project");
  const currentProject = linkedProject ? projects.find(p => p.id === linkedProject.targetId) : null;
  const linkedClient = documentLinks.find(link => link.targetType === "client");
  const currentClient = linkedClient ? clients.find(c => c.id === linkedClient.targetId) : null;

  useEffect(() => {
    if (document && !title && !content.content?.length) {
      setTitle(document.name || "");
      let parsedContent = { type: 'doc', content: [] };
      if (document.content) {
        try {
          parsedContent = typeof document.content === 'string'
            ? JSON.parse(document.content)
            : document.content;
        } catch (e) {
          parsedContent = { type: 'doc', content: [] };
        }
      }
      setContent(parsedContent);
      setStatus((document.status === "signed" ? "published" : document.status) as any);
      if ((document as any).documentDate) {
        setDocumentDate(new Date((document as any).documentDate));
      }
    }
  }, [document]);

  const debouncedTitle = useDebounce(title, 1000);
  const debouncedContent = useDebounce(content, 1000);

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateDocument) => {
      const response = await apiRequest(`/api/documents/${id}`, "PATCH", data);
      return await response.json();
    },
    onSuccess: () => {
      setLastSaved(new Date());
      setIsSaving(false);
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Impossible de sauvegarder le document", variant: "destructive" });
      setIsSaving(false);
    },
  });

  useEffect(() => {
    if (!document || !isEditMode) return;
    const titleChanged = debouncedTitle !== document.name;
    const normalizedDocContent = typeof document.content === 'string' ? document.content : JSON.stringify(document.content);
    const normalizedCurrentContent = typeof debouncedContent === 'string' ? debouncedContent : JSON.stringify(debouncedContent);
    const contentChanged = normalizedCurrentContent !== normalizedDocContent;
    if (!titleChanged && !contentChanged) return;
    setIsSaving(true);
    const extractPlainText = (content: any): string => {
      if (!content) return "";
      const getText = (node: any): string => {
        if (node.type === "text") return node.text || "";
        if (node.content && Array.isArray(node.content)) return node.content.map(getText).join(" ");
        return "";
      };
      return getText(content);
    };
    const plainText = extractPlainText(debouncedContent);
    updateMutation.mutate({
      name: debouncedTitle || "Sans titre",
      content: typeof debouncedContent === 'string' ? debouncedContent : JSON.stringify(debouncedContent),
      plainText,
      status,
    });
  }, [debouncedTitle, debouncedContent, document, isEditMode]);

  const deleteDocumentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/documents/${id}`, "DELETE");
      return await response.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/documents"] });
      navigate("/documents");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document supprimé", description: "Le document a été supprimé avec succès", variant: "success" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Impossible de supprimer le document", variant: "destructive" });
    },
  });

  const handleDeleteClick = useCallback(() => { setDeleteDialogOpen(true); }, []);
  const handleDeleteConfirm = useCallback(async () => {
    try { await deleteDocumentMutation.mutateAsync(); } finally { setDeleteDialogOpen(false); }
  }, [deleteDocumentMutation]);

  const exportPDFMutation = useMutation({
    mutationFn: async () => {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: HeadersInit = session?.access_token
        ? { 'Authorization': `Bearer ${session.access_token}` }
        : import.meta.env.DEV
          ? { 'x-test-account-id': '67a3cb31-7755-43f2-81e0-4436d5d0684f', 'x-test-user-id': '9fe4ddc0-6d3f-4d69-9c77-fc9cb2e79c8d' }
          : {};
      const response = await fetch(`/api/documents/${id}/export-pdf`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) { const text = await response.text(); throw new Error(`${response.status}: ${text}`); }
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = 'document.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) fileName = match[1];
      }
      const blob = await response.blob();
      return { blob, fileName };
    },
    onSuccess: ({ blob, fileName }: { blob: Blob; fileName: string }) => {
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url; link.download = fileName;
      window.document.body.appendChild(link); link.click(); window.document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      toast({ title: "PDF exporté", description: "Le document a été exporté en PDF avec succès", variant: "success" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Impossible d'exporter le document en PDF", variant: "destructive" });
    },
  });

  const handleExportPDF = useCallback(() => { if (!id) return; exportPDFMutation.mutate(); }, [id, exportPDFMutation]);

  const handleManualSave = useCallback(() => {
    setIsSaving(true);
    const extractPlainText = (content: any): string => {
      if (!content) return "";
      const getText = (node: any): string => {
        if (node.type === "text") return node.text || "";
        if (node.content && Array.isArray(node.content)) return node.content.map(getText).join(" ");
        return "";
      };
      return getText(content);
    };
    updateMutation.mutate({ name: title || "Sans titre", content: typeof content === 'string' ? content : JSON.stringify(content), plainText: extractPlainText(content), status });
  }, [title, content, status, updateMutation]);

  const linkProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest(`/api/documents/${id}/links`, "POST", { targetType: "project", targetId: projectId });
      return await response.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "links"] }); },
    onError: (error: any) => { toast({ title: "Erreur", description: error.message || "Impossible de lier le projet", variant: "destructive" }); },
  });

  const unlinkProjectMutation = useMutation({
    mutationFn: async () => {
      if (!linkedProject) return;
      const response = await apiRequest(`/api/documents/${id}/links/${linkedProject.targetType}/${linkedProject.targetId}`, "DELETE");
      return await response.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "links"] }); },
    onError: (error: any) => { toast({ title: "Erreur", description: error.message || "Impossible de délier le projet", variant: "destructive" }); },
  });

  const handleSelectProject = useCallback(async (projectId: string) => {
    try {
      if (linkedProject) await unlinkProjectMutation.mutateAsync();
      await linkProjectMutation.mutateAsync(projectId);
      setProjectSelectorOpen(false);
    } catch (error) {}
  }, [linkedProject, linkProjectMutation, unlinkProjectMutation]);

  const handleUnlinkProject = useCallback(() => { unlinkProjectMutation.mutate(); }, [unlinkProjectMutation]);

  const linkClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest(`/api/documents/${id}/links`, "POST", { targetType: "client", targetId: clientId });
      return await response.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "links"] }); },
    onError: (error: any) => { toast({ title: "Erreur", description: error.message || "Impossible de lier le client", variant: "destructive" }); },
  });

  const unlinkClientMutation = useMutation({
    mutationFn: async () => {
      if (!linkedClient) return;
      const response = await apiRequest(`/api/documents/${id}/links/${linkedClient.targetType}/${linkedClient.targetId}`, "DELETE");
      return await response.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "links"] }); },
    onError: (error: any) => { toast({ title: "Erreur", description: error.message || "Impossible de délier le client", variant: "destructive" }); },
  });

  const handleSelectClient = useCallback(async (clientId: string) => {
    try {
      if (linkedClient) await unlinkClientMutation.mutateAsync();
      await linkClientMutation.mutateAsync(clientId);
      setClientSelectorOpen(false);
    } catch (error) {}
  }, [linkedClient, linkClientMutation, unlinkClientMutation]);

  const handleUnlinkClient = useCallback(() => { unlinkClientMutation.mutate(); }, [unlinkClientMutation]);

  const handleSelectDate = useCallback(async (date: Date | undefined) => {
    const newDate = date ?? null;
    setDocumentDate(newDate);
    setDateSelectorOpen(false);
    await apiRequest(`/api/documents/${id}`, "PATCH", { documentDate: newDate ? formatDate(newDate, "yyyy-MM-dd") : null });
    queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
  }, [id, queryClient]);

  // — Comment mutations —
  const createCommentMutation = useMutation({
    mutationFn: async (data: { comment_text: string; parent_id?: string }) => {
      const r = await apiRequest(`/api/documents/${id}/comments`, "POST", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "comments"] });
      setNewComment("");
      setReplyingToId(null);
      setReplyInput("");
    },
    onError: (error: any) => { toast({ title: "Erreur", description: error.message, variant: "destructive" }); },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: async ({ cid, status }: { cid: string; status: string }) => {
      const r = await apiRequest(`/api/documents/${id}/comments/${cid}`, "PATCH", { status });
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "comments"] }); },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (cid: string) => {
      const r = await apiRequest(`/api/documents/${id}/comments/${cid}`, "DELETE");
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "comments"] }); },
  });

  const editCommentMutation = useMutation({
    mutationFn: async ({ cid, comment_text }: { cid: string; comment_text: string }) => {
      const r = await apiRequest(`/api/documents/${id}/comments/${cid}`, "PATCH", { comment_text });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "comments"] });
      setEditingCommentId(null);
      setEditCommentInput("");
    },
  });

  // — Suggestion mutations —
  const createSuggestionMutation = useMutation({
    mutationFn: async (data: { selected_text: string; replacement_text: string }) => {
      const r = await apiRequest(`/api/documents/${id}/suggestions`, "POST", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "suggestions"] });
      setSuggestionOrig("");
      setSuggestionReplace("");
    },
    onError: (error: any) => { toast({ title: "Erreur", description: error.message, variant: "destructive" }); },
  });

  const respondSuggestionMutation = useMutation({
    mutationFn: async ({ sid, status }: { sid: string; status: string }) => {
      const r = await apiRequest(`/api/documents/${id}/suggestions/${sid}`, "PATCH", { status });
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "suggestions"] }); },
  });

  // — Share mutations —
  const addShareMutation = useMutation({
    mutationFn: async (data: { shared_with_user_id: string; permission: string }) => {
      const r = await apiRequest(`/api/documents/${id}/shares`, "POST", data);
      return r.json();
    },
    onSuccess: () => {
      refetchShares();
      setShareSelectedUser(null);
      setShareSearchQuery("");
      toast({ title: "Membre invité", variant: "success" });
    },
    onError: (error: any) => { toast({ title: "Erreur", description: error.message, variant: "destructive" }); },
  });

  const updateShareMutation = useMutation({
    mutationFn: async ({ shareId, permission }: { shareId: string; permission: string }) => {
      const r = await apiRequest(`/api/documents/${id}/shares/${shareId}`, "PATCH", { permission });
      return r.json();
    },
    onSuccess: () => refetchShares(),
  });

  const removeShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      await apiRequest(`/api/documents/${id}/shares/${shareId}`, "DELETE");
    },
    onSuccess: () => { refetchShares(); toast({ title: "Accès retiré", variant: "default" }); },
  });

  // — Collab helpers —
  const fmtDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' à ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const topLevelComments = docComments.filter((c: any) => !c.parent_id);
  const getReplies = (parentId: string) => docComments.filter((c: any) => c.parent_id === parentId);
  const openComments = topLevelComments.filter((c: any) => c.status === 'open');
  const pendingSuggestions = docSuggestions.filter((s: any) => s.status === 'pending');
  const openCount = openComments.length + pendingSuggestions.length;

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

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader size="lg" /></div>;
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Document non trouvé</p>
        <Button onClick={() => navigate("/documents")}>Retour aux documents</Button>
      </div>
    );
  }

  const ActionsDropdown = ({ align = "end" as "end" | "start" }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" data-testid="button-actions-menu">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuItem onClick={handleManualSave} data-testid="menu-item-save" className="text-xs">
          <Save className="w-4 h-4 mr-2 text-green-600" />Enregistrer
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF} data-testid="menu-item-export-pdf" className="text-xs" disabled={exportPDFMutation.isPending}>
          <Download className="w-4 h-4 mr-2 text-blue-600" />
          {exportPDFMutation.isPending ? "Export en cours..." : "Exporter en PDF"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive focus:text-destructive focus:bg-destructive/10 text-xs" data-testid="menu-item-delete">
          <Trash2 className="w-4 h-4 mr-2" />Supprimer le document
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            const newEditMode = !isEditMode;
            setIsEditMode(newEditMode);
            if (newEditMode && status === "published") { setStatus("draft"); updateMutation.mutate({ status: "draft" }); }
          }}
          data-testid="menu-item-toggle-edit" className="text-xs"
        >
          {isEditMode ? <LockOpen className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
          {isEditMode ? "Verrouiller" : "Déverrouiller"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { setStatus("draft"); updateMutation.mutate({ status: "draft" }); }} data-testid="menu-item-status-draft" className="text-xs">
          <Badge variant="outline" className="mr-2 bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 text-[10px]">●</Badge>
          Brouillon{status === "draft" && <Check className="w-3 h-3 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setStatus("published"); updateMutation.mutate({ status: "published" }); }} data-testid="menu-item-status-published" className="text-xs">
          <Badge variant="outline" className="mr-2 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-[10px]">●</Badge>
          Publié{status === "published" && <Check className="w-3 h-3 ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] dark:bg-background">
      {/* Fixed Header */}
      <div className="flex-none bg-background">
        {isMobile ? (
          /* MOBILE HEADER */
          <div className="px-2 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => navigate("/documents")} data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sans titre"
                className="flex-1 h-8 text-base font-semibold border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:ring-offset-0 truncate"
                data-testid="input-title-mobile"
              />
              <span className="text-[10px] text-muted-foreground flex-shrink-0 min-w-[50px] text-right">
                {isSaving ? "..." : lastSaved ? "✓" : ""}
              </span>
              <ActionsDropdown align="end" />
            </div>
          </div>
        ) : (
          /* DESKTOP HEADER */
          <div className="px-6 pt-4 pb-3">
            {/* Row 1: Back + sync status + spacer + share + collab + actions */}
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" onClick={() => navigate("/documents")} data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-default select-none" data-testid="autosave-status">
                    {isSaving ? "Sauvegarde..." : lastSaved ? "Sauvegardé" : ""}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border">Auto-sauvegarde activée</TooltipContent>
              </Tooltip>

              <div className="flex-1" />

              {/* Selectors — moved here, left of Share */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Client selector */}
                <div className="flex items-center">
                  <Popover open={clientSelectorOpen} onOpenChange={setClientSelectorOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900 ${currentClient ? 'rounded-r-none border-r-0' : ''}`}
                        data-testid="button-client-selector"
                      >
                        <Users className="w-3 h-3 text-cyan-500" />
                        <span className="truncate max-w-[100px]">{currentClient ? currentClient.name : "Client"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0 bg-popover" align="start">
                      <Command>
                        <CommandInput placeholder="Rechercher un client..." />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                          <CommandGroup>
                            {currentClient && (
                              <CommandItem onSelect={() => { handleUnlinkClient(); setClientSelectorOpen(false); }} className="text-destructive" data-testid="option-unlink-client">
                                <X className="mr-2 h-4 w-4" />Délier du client
                              </CommandItem>
                            )}
                            {clients.map((client) => (
                              <CommandItem key={client.id} onSelect={() => handleSelectClient(client.id)} data-testid={`option-client-${client.id}`}>
                                <Check className={`mr-2 h-4 w-4 ${currentClient?.id === client.id ? "opacity-100" : "opacity-0"}`} />
                                {client.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {currentClient && (
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0 rounded-l-none hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                      onClick={(e) => { e.stopPropagation(); unlinkClientMutation.mutate(); }} data-testid="button-unlink-client-x">
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* Project selector */}
                <div className="flex items-center">
                  <Popover open={projectSelectorOpen} onOpenChange={setProjectSelectorOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900 ${currentProject ? 'rounded-none border-r-0' : ''}`}
                        data-testid="button-project-selector"
                      >
                        <FolderKanban className="w-3 h-3 text-violet-500" />
                        <span className="truncate max-w-[100px]">{currentProject ? currentProject.name : "Projet"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0 bg-popover" align="start">
                      <Command>
                        <CommandInput placeholder="Rechercher un projet..." />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                          <CommandGroup>
                            {currentProject && (
                              <CommandItem onSelect={() => { handleUnlinkProject(); setProjectSelectorOpen(false); }} className="text-destructive" data-testid="option-unlink-project">
                                <X className="mr-2 h-4 w-4" />Délier du projet
                              </CommandItem>
                            )}
                            {projects.map((project) => (
                              <CommandItem key={project.id} onSelect={() => handleSelectProject(project.id)} data-testid={`option-project-${project.id}`}>
                                <Check className={`mr-2 h-4 w-4 ${currentProject?.id === project.id ? "opacity-100" : "opacity-0"}`} />
                                {project.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {currentProject && linkedProject && (
                    <>
                      <Link href={`/projects/${currentProject.id}`}>
                        <Button variant="outline" size="sm" className="h-6 w-6 p-0 rounded-none border-r-0 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 dark:hover:bg-violet-950" data-testid="button-go-to-project">
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 rounded-l-none hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                        onClick={(e) => { e.stopPropagation(); handleUnlinkProject(); }} data-testid="button-unlink-project-x">
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Date selector */}
                <Popover open={dateSelectorOpen} onOpenChange={setDateSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900" data-testid="button-date-selector">
                      <CalendarDays className="w-3 h-3 text-muted-foreground" />
                      <span className="truncate max-w-[100px]">
                        {documentDate ? formatDate(documentDate, "dd MMM yyyy", { locale: fr }) : "Date"}
                      </span>
                      {documentDate && (
                        <span className="ml-0.5 hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleSelectDate(undefined); }}>
                          <X className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarWidget mode="single" selected={documentDate ?? undefined} onSelect={handleSelectDate} locale={fr} initialFocus />
                  </PopoverContent>
                </Popover>

                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={`text-[10px] ${status === "draft"
                    ? "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800"
                    : "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                  }`}
                  data-testid="badge-status"
                >
                  {status === "draft" ? "Brouillon" : "Publié"}
                </Badge>
              </div>

              {/* Share button — identical to note-detail */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setShareDialogOpen(true)}
                data-testid="button-share"
              >
                <Share2 className="w-3.5 h-3.5" />
                Partager
                {docShares.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">{docShares.length}</Badge>
                )}
              </Button>

              {/* Collab panel toggle — identical to note-detail */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={collabPanelOpen ? "default" : "outline"}
                    size="icon"
                    onClick={() => setCollabPanelOpen(!collabPanelOpen)}
                    data-testid="button-collab-panel"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">Commentaires &amp; suggestions</TooltipContent>
              </Tooltip>

              <ActionsDropdown align="end" />
            </div>

          </div>
        )}
      </div>

      {/* Main content row: editor + optional collab panel */}
      <div className="flex-1 overflow-hidden flex">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto relative">
          <div className={isMobile ? "px-1 py-0" : ""}>
            <NoteEditor
              key={id}
              content={content}
              onChange={setContent}
              editable={isEditMode}
              placeholder="Commencez à rédiger votre document..."
              borderless={!isMobile}
              {...(!isMobile ? { title, onTitleChange: setTitle } : {})}
            />
          </div>
        </div>

        {/* Collab Panel — right sidebar, same style as note-detail */}
        {collabPanelOpen && !isMobile && (
          <div className="w-80 flex-shrink-0 border-l bg-background flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Collaboration</span>
                {openCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">{openCount}</Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollabPanelOpen(false)} data-testid="button-close-collab">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Tabs */}
            <Tabs value={collabTab} onValueChange={(v) => setCollabTab(v as any)} className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="mx-3 mt-2.5 mb-1 grid grid-cols-2 h-8">
                <TabsTrigger value="comments" className="text-xs gap-1 h-7" data-testid="tab-comments">
                  <MessageSquare className="w-3 h-3" />
                  Commentaires
                  {openComments.length > 0 && <Badge variant="secondary" className="ml-0.5 h-3.5 min-w-3.5 px-1 text-[9px]">{openComments.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="text-xs gap-1 h-7" data-testid="tab-suggestions">
                  <GitPullRequest className="w-3 h-3" />
                  Suggestions
                  {pendingSuggestions.length > 0 && <Badge variant="secondary" className="ml-0.5 h-3.5 min-w-3.5 px-1 text-[9px]">{pendingSuggestions.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              {/* COMMENTS */}
              <TabsContent value="comments" className="flex-1 flex flex-col overflow-hidden mt-0">
                <ScrollArea className="flex-1 px-3">
                  <div className="space-y-2 pb-2 pt-1">
                    {topLevelComments.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">Aucun commentaire pour l'instant.</p>
                    )}
                    {topLevelComments.map((comment: any) => {
                      const replies = getReplies(comment.id);
                      const isEditing = editingCommentId === comment.id;
                      const isReplying = replyingToId === comment.id;
                      const isOwn = comment.author_user_id === user?.id;
                      return (
                        <div key={comment.id} className={`rounded-md text-xs border bg-white dark:bg-gray-900 shadow-sm ${comment.status === 'resolved' ? 'opacity-60' : ''}`} data-testid={`comment-${comment.id}`}>
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <div className="flex items-start gap-1.5 min-w-0">
                                {renderAvatar(comment)}
                                <div className="min-w-0">
                                  <span className="font-medium block truncate leading-tight">{comment.first_name || comment.email?.split('@')[0] || 'Inconnu'}</span>
                                  <span className="text-[10px] text-muted-foreground">{fmtDate(comment.created_at)}</span>
                                </div>
                              </div>
                              {comment.status === 'resolved'
                                ? <span className="text-[9px] h-4 px-1.5 py-0.5 flex-shrink-0 rounded-sm font-medium bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/60 dark:text-green-400 dark:border-green-800">Résolu</span>
                                : <span className="text-[9px] h-4 px-1.5 py-0.5 flex-shrink-0 rounded-sm font-medium bg-primary text-primary-foreground">Ouvert</span>
                              }
                            </div>
                            {comment.selected_text && (
                              <div className="text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5 mb-1.5 truncate flex items-center gap-1">
                                <CornerDownRight className="w-2.5 h-2.5 flex-shrink-0" />
                                « {comment.selected_text.slice(0, 50)} »
                              </div>
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
                                  <Button size="sm" variant="default" className="h-5 text-[10px] px-2" disabled={editCommentMutation.isPending}
                                    onClick={() => editCommentMutation.mutate({ cid: comment.id, comment_text: editCommentInput })}>Sauvegarder</Button>
                                  <Button size="sm" variant="ghost" className="h-5 text-[10px] px-2"
                                    onClick={() => { setEditingCommentId(null); setEditCommentInput(''); }}>Annuler</Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-foreground leading-relaxed mt-1">{comment.comment_text}</p>
                            )}
                          </div>

                          {/* Replies */}
                          {replies.length > 0 && (
                            <div className="border-t mx-3 py-2 space-y-2">
                              {replies.map((reply: any) => (
                                <div key={reply.id} className="flex items-start gap-1.5">
                                  {renderAvatar(reply, 'xs')}
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium text-[10px]">{reply.first_name || reply.email?.split('@')[0] || 'Inconnu'}</span>
                                    <p className="text-[11px] text-foreground">{reply.comment_text}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex items-center gap-1 px-3 pb-2">
                            {comment.status === 'open' ? (
                              <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 gap-0.5 text-green-700"
                                onClick={() => resolveCommentMutation.mutate({ cid: comment.id, status: 'resolved' })} data-testid={`button-resolve-${comment.id}`}>
                                <CheckCircle2 className="w-3 h-3" />Résoudre
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 gap-0.5"
                                onClick={() => resolveCommentMutation.mutate({ cid: comment.id, status: 'open' })} data-testid={`button-reopen-${comment.id}`}>
                                Rouvrir
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5"
                              onClick={() => { setReplyingToId(isReplying ? null : comment.id); setReplyInput(""); }} data-testid={`button-reply-${comment.id}`}>
                              Répondre
                            </Button>
                            {isOwn && !isEditing && (
                              <>
                                <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5"
                                  onClick={() => { setEditingCommentId(comment.id); setEditCommentInput(comment.comment_text); }}>Modifier</Button>
                                <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-destructive hover:text-destructive"
                                  onClick={() => deleteCommentMutation.mutate(comment.id)} data-testid={`button-delete-comment-${comment.id}`}>Supprimer</Button>
                              </>
                            )}
                          </div>

                          {/* Reply input */}
                          {isReplying && (
                            <div className="px-3 pb-3 flex gap-1.5">
                              <textarea
                                autoFocus
                                className="flex-1 text-xs border rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-gray-900 min-h-[52px]"
                                placeholder="Votre réponse..."
                                value={replyInput}
                                onChange={e => setReplyInput(e.target.value)}
                                data-testid="input-reply-text"
                              />
                              <Button size="icon" className="h-9 w-8 flex-shrink-0"
                                disabled={!replyInput.trim() || createCommentMutation.isPending}
                                onClick={() => createCommentMutation.mutate({ comment_text: replyInput, parent_id: comment.id })}
                                data-testid="button-send-reply">
                                <Send className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* New comment */}
                <div className="border-t p-3 space-y-2">
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Ajouter un commentaire..."
                    className="w-full text-xs border rounded-md px-2 py-1.5 resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary min-h-[56px]"
                    data-testid="input-new-comment"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && newComment.trim()) {
                        e.preventDefault();
                        createCommentMutation.mutate({ comment_text: newComment });
                      }
                    }}
                  />
                  <Button size="sm" className="w-full text-xs gap-1" disabled={!newComment.trim() || createCommentMutation.isPending}
                    onClick={() => createCommentMutation.mutate({ comment_text: newComment })} data-testid="button-add-comment">
                    <Send className="w-3 h-3" />
                    {createCommentMutation.isPending ? "Envoi..." : "Commenter"}
                  </Button>
                </div>
              </TabsContent>

              {/* SUGGESTIONS */}
              <TabsContent value="suggestions" className="flex-1 flex flex-col overflow-hidden mt-0">
                <ScrollArea className="flex-1 px-3">
                  <div className="space-y-2 pb-2 pt-1">
                    {docSuggestions.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">Aucune suggestion pour l'instant.</p>
                    )}
                    {docSuggestions.map((sug: any) => (
                      <div key={sug.id} className={`rounded-md text-xs border bg-white dark:bg-gray-900 shadow-sm ${sug.status !== 'pending' ? 'opacity-60' : ''}`} data-testid={`suggestion-${sug.id}`}>
                        <div className="p-3">
                          <div className="flex items-start gap-1.5 mb-2">
                            {renderAvatar(sug)}
                            <div className="min-w-0 flex-1">
                              <span className="font-medium block truncate">{sug.first_name || sug.email?.split('@')[0] || 'Inconnu'}</span>
                              <span className="text-[10px] text-muted-foreground">{fmtDate(sug.created_at)}</span>
                            </div>
                            <Badge variant="outline" className={`text-[9px] flex-shrink-0 ${sug.status === 'accepted' ? 'text-green-700 border-green-200' : sug.status === 'rejected' ? 'text-destructive border-destructive/30' : 'text-primary border-primary/30'}`}>
                              {sug.status === 'accepted' ? 'Acceptée' : sug.status === 'rejected' ? 'Rejetée' : 'En attente'}
                            </Badge>
                          </div>
                          <div className="space-y-1 mb-2">
                            <div className="rounded bg-red-50 dark:bg-red-950/30 px-2 py-1">
                              <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Texte original</p>
                              <p className="text-xs line-through text-red-600 dark:text-red-400">{sug.selected_text}</p>
                            </div>
                            <div className="rounded bg-green-50 dark:bg-green-950/30 px-2 py-1">
                              <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Remplacement</p>
                              <p className="text-xs text-green-700 dark:text-green-400">{sug.replacement_text}</p>
                            </div>
                          </div>
                          {sug.status === 'pending' && (
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="outline" className="flex-1 text-xs h-6 text-green-700 border-green-300 hover:bg-green-50"
                                onClick={() => respondSuggestionMutation.mutate({ sid: sug.id, status: "accepted" })} data-testid={`button-accept-${sug.id}`}>
                                <Check className="w-3 h-3 mr-1" />Accepter
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 text-xs h-6 text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => respondSuggestionMutation.mutate({ sid: sug.id, status: "rejected" })} data-testid={`button-reject-${sug.id}`}>
                                <X className="w-3 h-3 mr-1" />Rejeter
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* New suggestion form */}
                <div className="border-t p-3 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Proposer une modification</p>
                  <textarea
                    value={suggestionOrig}
                    onChange={e => setSuggestionOrig(e.target.value)}
                    placeholder="Texte original..."
                    className="w-full text-xs border rounded-md px-2 py-1.5 resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
                    data-testid="input-suggestion-orig"
                  />
                  <textarea
                    value={suggestionReplace}
                    onChange={e => setSuggestionReplace(e.target.value)}
                    placeholder="Remplacement proposé..."
                    className="w-full text-xs border rounded-md px-2 py-1.5 resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
                    data-testid="input-suggestion-replace"
                  />
                  <Button size="sm" className="w-full text-xs gap-1"
                    disabled={!suggestionOrig.trim() || !suggestionReplace.trim() || createSuggestionMutation.isPending}
                    onClick={() => createSuggestionMutation.mutate({ selected_text: suggestionOrig, replacement_text: suggestionReplace })}
                    data-testid="button-add-suggestion">
                    <GitPullRequest className="w-3 h-3" />
                    {createSuggestionMutation.isPending ? "Envoi..." : "Proposer"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Voice Recording Button */}
      {isEditMode && (
        <VoiceRecordingButton
          onTranscript={(text) => {
            setContent((prev: any) => {
              const existingContent = prev?.content || [];
              return { type: 'doc', content: [...existingContent, { type: 'paragraph', content: [{ type: 'text', text }] }] };
            });
          }}
          onError={(msg) => toast({ variant: "destructive", title: "Erreur de transcription", description: msg })}
        />
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le document</DialogTitle>
            <DialogDescription>Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteDocumentMutation.isPending}>
              {deleteDocumentMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog — identical to note-detail */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Partager le document
            </DialogTitle>
            <DialogDescription>
              Invitez des membres à consulter ou modifier ce document.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add member section */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inviter un membre</p>
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
                      <CommandInput placeholder="Nom ou email..." value={shareSearchQuery} onValueChange={setShareSearchQuery} />
                      <CommandList>
                        <CommandEmpty>Aucun membre trouvé</CommandEmpty>
                        <CommandGroup>
                          {teamMembers
                            .filter((m: any) => !docShares.find((s: any) => s.shared_with_user_id === m.id))
                            .filter((m: any) => {
                              const q = shareSearchQuery.toLowerCase();
                              return !q || m.email?.toLowerCase().includes(q) || m.first_name?.toLowerCase().includes(q) || m.last_name?.toLowerCase().includes(q);
                            })
                            .map((m: any) => (
                              <CommandItem key={m.id} value={m.email} onSelect={() => { setShareSelectedUser(m); setShareSearchQuery(""); }} className="flex items-center gap-2 cursor-pointer">
                                <Avatar className="w-5 h-5">
                                  {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                                  <AvatarFallback className="text-[9px]">{(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate">{m.first_name ? `${m.first_name} ${m.last_name || ''}`.trim() : m.email}</div>
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
            {docShares.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accès actuels</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {docShares.map((share: any) => {
                    const name = share.first_name ? `${share.first_name} ${share.last_name || ''}`.trim() : share.email;
                    const initials = (share.first_name?.[0] || share.email?.[0] || '?').toUpperCase();
                    return (
                      <div key={share.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/30" data-testid={`share-row-${share.id}`}>
                        <Avatar className="w-7 h-7">
                          {share.avatar_url && <AvatarImage src={share.avatar_url} />}
                          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{name}</div>
                          {share.first_name && <div className="text-[10px] text-muted-foreground truncate">{share.email}</div>}
                        </div>
                        <Select value={share.permission} onValueChange={(v) => updateShareMutation.mutate({ shareId: share.id, permission: v })}>
                          <SelectTrigger className="h-6 text-[10px] w-28 border-0 bg-muted/40" data-testid={`select-share-perm-${share.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-900">
                            <SelectItem value="read">Lecture</SelectItem>
                            <SelectItem value="comment">Commentaire</SelectItem>
                            <SelectItem value="edit">Modification</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeShareMutation.mutate(share.id)} data-testid={`button-remove-share-${share.id}`}>
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
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href).then(() => {
                    toast({ title: "Lien copié dans le presse-papier", variant: "default" });
                  });
                }}
                data-testid="button-copy-link">
                <ExternalLink className="w-3.5 h-3.5" />
                Copier le lien direct
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
