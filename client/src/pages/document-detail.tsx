import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  ArrowLeft, Trash2, Download, Save, Lock, LockOpen, MoreVertical,
  FolderKanban, ExternalLink, Users, CalendarDays, MessageSquare,
  Lightbulb, Share2, X, Check, ChevronDown, CheckCircle2, Circle,
  Trash, Send, UserPlus, PanelRight, GitPullRequest,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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

type DocComment = {
  id: string;
  document_id: string;
  author_user_id: string;
  selected_text?: string;
  comment_text: string;
  status: string;
  parent_id?: string | null;
  created_at: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
};

type DocSuggestion = {
  id: string;
  document_id: string;
  author_user_id: string;
  selected_text: string;
  replacement_text: string;
  status: string;
  created_at: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
};

type DocShare = {
  id: string;
  document_id: string;
  shared_with_user_id: string;
  permission: string;
  created_at: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
};

type TeamMember = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role?: string;
};

function getUserLabel(m: { first_name?: string; last_name?: string; email?: string }) {
  const name = [m.first_name, m.last_name].filter(Boolean).join(" ");
  return name || m.email || "?";
}

function getInitials(m: { first_name?: string; last_name?: string; email?: string }) {
  if (m.first_name && m.last_name) return (m.first_name[0] + m.last_name[0]).toUpperCase();
  if (m.first_name) return m.first_name[0].toUpperCase();
  if (m.email) return m.email[0].toUpperCase();
  return "?";
}

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

  // Collab panel
  const [collabPanelOpen, setCollabPanelOpen] = useState(false);
  const [collabTab, setCollabTab] = useState<"comments" | "suggestions">("comments");
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<DocComment | null>(null);
  const [replyText, setReplyText] = useState("");
  const [suggestionOrig, setSuggestionOrig] = useState("");
  const [suggestionReplace, setSuggestionReplace] = useState("");

  // Share dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareSearch, setShareSearch] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<string>("comment");

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

  const { data: docComments = [] } = useQuery<DocComment[]>({
    queryKey: ["/api/documents", id, "comments"],
    enabled: !!id && collabPanelOpen,
  });

  const { data: docSuggestions = [] } = useQuery<DocSuggestion[]>({
    queryKey: ["/api/documents", id, "suggestions"],
    enabled: !!id && collabPanelOpen,
  });

  const { data: docShares = [] } = useQuery<DocShare[]>({
    queryKey: ["/api/documents", id, "shares"],
    enabled: !!id && shareDialogOpen,
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
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

  const handleSelectDate = useCallback(async (date: Date | undefined) => {
    const newDate = date ?? null;
    setDocumentDate(newDate);
    setDateSelectorOpen(false);
    await apiRequest(`/api/documents/${id}`, "PATCH", { documentDate: newDate ? formatDate(newDate, "yyyy-MM-dd") : null });
    queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
  }, [id, queryClient]);

  const handleUnlinkClient = useCallback(() => { unlinkClientMutation.mutate(); }, [unlinkClientMutation]);

  // ── COMMENT MUTATIONS ──
  const addCommentMutation = useMutation({
    mutationFn: async (data: { comment_text: string; parent_id?: string }) => {
      const response = await apiRequest(`/api/documents/${id}/comments`, "POST", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "comments"] });
      setNewComment("");
      setReplyTo(null);
      setReplyText("");
    },
    onError: (error: any) => { toast({ title: "Erreur", description: error.message, variant: "destructive" }); },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: async ({ cid, status }: { cid: string; status: string }) => {
      const response = await apiRequest(`/api/documents/${id}/comments/${cid}`, "PATCH", { status });
      return await response.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "comments"] }); },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (cid: string) => {
      const response = await apiRequest(`/api/documents/${id}/comments/${cid}`, "DELETE");
      return await response.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "comments"] }); },
  });

  // ── SUGGESTION MUTATIONS ──
  const addSuggestionMutation = useMutation({
    mutationFn: async (data: { selected_text: string; replacement_text: string }) => {
      const response = await apiRequest(`/api/documents/${id}/suggestions`, "POST", data);
      return await response.json();
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
      const response = await apiRequest(`/api/documents/${id}/suggestions/${sid}`, "PATCH", { status });
      return await response.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "suggestions"] }); },
  });

  // ── SHARE MUTATIONS ──
  const addShareMutation = useMutation({
    mutationFn: async (data: { shared_with_user_id: string; permission: string }) => {
      const response = await apiRequest(`/api/documents/${id}/shares`, "POST", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "shares"] });
      setSelectedMember(null);
      setSelectedPermission("comment");
    },
    onError: (error: any) => { toast({ title: "Erreur", description: error.message, variant: "destructive" }); },
  });

  const updateShareMutation = useMutation({
    mutationFn: async ({ shareId, permission }: { shareId: string; permission: string }) => {
      const response = await apiRequest(`/api/documents/${id}/shares/${shareId}`, "PATCH", { permission });
      return await response.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "shares"] }); },
  });

  const removeShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      await apiRequest(`/api/documents/${id}/shares/${shareId}`, "DELETE");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "shares"] }); },
  });

  const openComments = docComments.filter(c => c.status === "open" && !c.parent_id);
  const resolvedComments = docComments.filter(c => c.status === "resolved" && !c.parent_id);
  const pendingSuggestions = docSuggestions.filter(s => s.status === "pending");
  const closedSuggestions = docSuggestions.filter(s => s.status !== "pending");

  const filteredMembers = teamMembers.filter(m => {
    const label = getUserLabel(m).toLowerCase();
    const email = (m.email || "").toLowerCase();
    const q = shareSearch.toLowerCase();
    return label.includes(q) || email.includes(q);
  });

  const alreadySharedIds = docShares.map(s => s.shared_with_user_id);

  const permissionLabel = (p: string) => ({ read: "Lecture", comment: "Commentaire", edit: "Édition" }[p] || p);

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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={collabPanelOpen ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCollabPanelOpen(!collabPanelOpen)}
                    data-testid="button-collab-panel"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Commentaires & Suggestions</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShareDialogOpen(true)} data-testid="button-share">
                    <Share2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Partager</TooltipContent>
              </Tooltip>
              <ActionsDropdown align="end" />
            </div>
          </div>
        ) : (
          <div className="px-6 pt-4 pb-3">
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" onClick={() => navigate("/documents")} data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground mr-2">
                {isSaving ? "Enregistrement..." : lastSaved ? `Sauvegardé ${formatDistanceToNow(lastSaved, { addSuffix: true, locale: fr })}` : ""}
              </span>
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
                <TooltipContent>Commentaires & Suggestions</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => setShareDialogOpen(true)} data-testid="button-share">
                    <Share2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Partager le document</TooltipContent>
              </Tooltip>
              <ActionsDropdown align="end" />
            </div>

            {/* Toolbar row */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {/* Client selector */}
              <div className="flex items-center">
                <Popover open={clientSelectorOpen} onOpenChange={setClientSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={`h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900 ${currentClient ? 'rounded-r-none border-r-0' : ''}`} data-testid="button-client-selector">
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
                    <Button variant="outline" size="sm" className={`h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900 ${currentProject ? 'rounded-r-none border-r-0' : ''}`} data-testid="button-project-selector">
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
              <Badge variant="outline" className={`text-[10px] ${status === "draft" ? "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800" : "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"}`} data-testid="badge-status">
                {status === "draft" ? "Brouillon" : "Publié"}
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* Main area: editor + collab panel */}
      <div className="flex-1 flex min-h-0">
        {/* Editor */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="flex-1 overflow-auto">
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
        </div>

        {/* Collab Panel */}
        {collabPanelOpen && (
          <div className="w-80 flex-shrink-0 border-l bg-background flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-sm">Collaboration</span>
              <Button variant="ghost" size="icon" onClick={() => setCollabPanelOpen(false)} data-testid="button-close-collab">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <Tabs value={collabTab} onValueChange={(v) => setCollabTab(v as any)} className="flex flex-col flex-1 min-h-0">
              <TabsList className="mx-4 mt-3 mb-1 grid grid-cols-2">
                <TabsTrigger value="comments" className="text-xs gap-1" data-testid="tab-comments">
                  <MessageSquare className="w-3 h-3" />
                  Commentaires
                  {openComments.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{openComments.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="text-xs gap-1" data-testid="tab-suggestions">
                  <GitPullRequest className="w-3 h-3" />
                  Suggestions
                  {pendingSuggestions.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{pendingSuggestions.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* COMMENTS TAB */}
              <TabsContent value="comments" className="flex-1 flex flex-col min-h-0 mt-0 px-4">
                <ScrollArea className="flex-1">
                  <div className="space-y-3 pb-3">
                    {openComments.length === 0 && resolvedComments.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">Aucun commentaire pour l'instant.</p>
                    )}
                    {openComments.map(comment => {
                      const replies = docComments.filter(c => c.parent_id === comment.id);
                      return (
                        <div key={comment.id} className="bg-muted/40 rounded-md p-3 space-y-2" data-testid={`comment-${comment.id}`}>
                          <div className="flex items-start gap-2">
                            <Avatar className="h-6 w-6 flex-shrink-0">
                              <AvatarImage src={comment.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">{getInitials(comment)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-medium truncate">{getUserLabel(comment)}</span>
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}
                                </span>
                              </div>
                              {comment.selected_text && (
                                <blockquote className="text-[10px] text-muted-foreground italic border-l-2 border-violet-300 pl-2 my-1 line-clamp-2">
                                  {comment.selected_text}
                                </blockquote>
                              )}
                              <p className="text-xs mt-0.5">{comment.comment_text}</p>
                            </div>
                          </div>
                          {replies.map(reply => (
                            <div key={reply.id} className="ml-8 bg-background rounded p-2" data-testid={`reply-${reply.id}`}>
                              <div className="flex items-center gap-1 mb-0.5">
                                <Avatar className="h-4 w-4">
                                  <AvatarImage src={reply.avatar_url || undefined} />
                                  <AvatarFallback className="text-[8px]">{getInitials(reply)}</AvatarFallback>
                                </Avatar>
                                <span className="text-[10px] font-medium">{getUserLabel(reply)}</span>
                              </div>
                              <p className="text-[11px]">{reply.comment_text}</p>
                            </div>
                          ))}
                          <div className="flex items-center gap-1 pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-muted-foreground"
                              onClick={() => setReplyTo(replyTo?.id === comment.id ? null : comment)}
                              data-testid={`button-reply-${comment.id}`}
                            >
                              Répondre
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-green-600"
                              onClick={() => resolveCommentMutation.mutate({ cid: comment.id, status: "resolved" })}
                              data-testid={`button-resolve-${comment.id}`}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-0.5" />Résoudre
                            </Button>
                            {comment.author_user_id === user?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1.5 text-[10px] text-destructive"
                                onClick={() => deleteCommentMutation.mutate(comment.id)}
                                data-testid={`button-delete-comment-${comment.id}`}
                              >
                                <Trash className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          {replyTo?.id === comment.id && (
                            <div className="mt-1 ml-8 flex gap-1">
                              <Textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Votre réponse..."
                                className="text-xs min-h-[52px] resize-none"
                                data-testid="input-reply-text"
                              />
                              <Button
                                size="icon"
                                className="h-9 w-9 flex-shrink-0"
                                disabled={!replyText.trim() || addCommentMutation.isPending}
                                onClick={() => addCommentMutation.mutate({ comment_text: replyText, parent_id: comment.id })}
                                data-testid="button-send-reply"
                              >
                                <Send className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {resolvedComments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Résolus ({resolvedComments.length})</p>
                        {resolvedComments.map(comment => (
                          <div key={comment.id} className="bg-muted/20 rounded-md p-2 opacity-60" data-testid={`comment-resolved-${comment.id}`}>
                            <div className="flex items-start gap-2">
                              <Avatar className="h-5 w-5 flex-shrink-0">
                                <AvatarFallback className="text-[9px]">{getInitials(comment)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs line-through text-muted-foreground">{comment.comment_text}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-muted-foreground mt-1"
                              onClick={() => resolveCommentMutation.mutate({ cid: comment.id, status: "open" })}
                              data-testid={`button-reopen-${comment.id}`}
                            >
                              <Circle className="w-3 h-3 mr-0.5" />Rouvrir
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* New comment input */}
                <div className="border-t pt-3 pb-2 space-y-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Ajouter un commentaire..."
                    className="text-xs min-h-[60px] resize-none"
                    data-testid="input-new-comment"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && newComment.trim()) {
                        e.preventDefault();
                        addCommentMutation.mutate({ comment_text: newComment });
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                    onClick={() => addCommentMutation.mutate({ comment_text: newComment })}
                    data-testid="button-add-comment"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    {addCommentMutation.isPending ? "Envoi..." : "Commenter"}
                  </Button>
                </div>
              </TabsContent>

              {/* SUGGESTIONS TAB */}
              <TabsContent value="suggestions" className="flex-1 flex flex-col min-h-0 mt-0 px-4">
                <ScrollArea className="flex-1">
                  <div className="space-y-3 pb-3">
                    {pendingSuggestions.length === 0 && closedSuggestions.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">Aucune suggestion pour l'instant.</p>
                    )}
                    {pendingSuggestions.map(sug => (
                      <div key={sug.id} className="bg-muted/40 rounded-md p-3 space-y-2" data-testid={`suggestion-${sug.id}`}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 flex-shrink-0">
                            <AvatarImage src={sug.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">{getInitials(sug)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium flex-1 truncate">{getUserLabel(sug)}</span>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {formatDistanceToNow(new Date(sug.created_at), { addSuffix: true, locale: fr })}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="rounded bg-red-50 dark:bg-red-950/30 px-2 py-1">
                            <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">Texte original</p>
                            <p className="text-xs line-through text-red-600 dark:text-red-400">{sug.selected_text}</p>
                          </div>
                          <div className="rounded bg-green-50 dark:bg-green-950/30 px-2 py-1">
                            <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">Remplacement proposé</p>
                            <p className="text-xs text-green-700 dark:text-green-400">{sug.replacement_text}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs h-6 text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => respondSuggestionMutation.mutate({ sid: sug.id, status: "accepted" })}
                            data-testid={`button-accept-${sug.id}`}
                          >
                            <Check className="w-3 h-3 mr-1" />Accepter
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs h-6 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => respondSuggestionMutation.mutate({ sid: sug.id, status: "rejected" })}
                            data-testid={`button-reject-${sug.id}`}
                          >
                            <X className="w-3 h-3 mr-1" />Rejeter
                          </Button>
                        </div>
                      </div>
                    ))}

                    {closedSuggestions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Traitées ({closedSuggestions.length})</p>
                        {closedSuggestions.map(sug => (
                          <div key={sug.id} className={`rounded-md p-2 opacity-60 ${sug.status === 'accepted' ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-muted/20'}`} data-testid={`suggestion-closed-${sug.id}`}>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className={`text-[9px] ${sug.status === 'accepted' ? 'text-green-700 border-green-200' : 'text-muted-foreground'}`}>
                                {sug.status === 'accepted' ? 'Acceptée' : 'Rejetée'}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground truncate">{sug.selected_text} → {sug.replacement_text}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* New suggestion form */}
                <div className="border-t pt-3 pb-2 space-y-2">
                  <p className="text-[10px] text-muted-foreground font-medium">Proposer une modification</p>
                  <Textarea
                    value={suggestionOrig}
                    onChange={(e) => setSuggestionOrig(e.target.value)}
                    placeholder="Texte original à modifier..."
                    className="text-xs min-h-[44px] resize-none"
                    data-testid="input-suggestion-orig"
                  />
                  <Textarea
                    value={suggestionReplace}
                    onChange={(e) => setSuggestionReplace(e.target.value)}
                    placeholder="Texte de remplacement proposé..."
                    className="text-xs min-h-[44px] resize-none"
                    data-testid="input-suggestion-replace"
                  />
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    disabled={!suggestionOrig.trim() || !suggestionReplace.trim() || addSuggestionMutation.isPending}
                    onClick={() => addSuggestionMutation.mutate({ selected_text: suggestionOrig, replacement_text: suggestionReplace })}
                    data-testid="button-add-suggestion"
                  >
                    <GitPullRequest className="w-3 h-3 mr-1" />
                    {addSuggestionMutation.isPending ? "Envoi..." : "Proposer la modification"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

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

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />Partager le document
            </DialogTitle>
            <DialogDescription>Invitez des membres de votre équipe à accéder à ce document.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add member row */}
            <div className="flex gap-2">
              <Popover open={shareOpen} onOpenChange={setShareOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-sm font-normal h-9" data-testid="button-share-member-picker">
                    <UserPlus className="w-4 h-4 mr-2 text-muted-foreground" />
                    {selectedMember ? getUserLabel(selectedMember) : "Ajouter un membre..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher..." value={shareSearch} onValueChange={setShareSearch} />
                    <CommandList>
                      <CommandEmpty>Aucun membre trouvé.</CommandEmpty>
                      <CommandGroup>
                        {filteredMembers.filter(m => !alreadySharedIds.includes(m.id)).map(m => (
                          <CommandItem key={m.id} onSelect={() => { setSelectedMember(m); setShareOpen(false); setShareSearch(""); }} data-testid={`option-member-${m.id}`}>
                            <Avatar className="h-5 w-5 mr-2">
                              <AvatarImage src={m.avatar_url || undefined} />
                              <AvatarFallback className="text-[9px]">{getInitials(m)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-medium">{getUserLabel(m)}</p>
                              <p className="text-[10px] text-muted-foreground">{m.email}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Select value={selectedPermission} onValueChange={setSelectedPermission}>
                <SelectTrigger className="w-32 h-9 text-xs" data-testid="select-permission">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Lecture</SelectItem>
                  <SelectItem value="comment">Commentaire</SelectItem>
                  <SelectItem value="edit">Édition</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                disabled={!selectedMember || addShareMutation.isPending}
                onClick={() => { if (selectedMember) addShareMutation.mutate({ shared_with_user_id: selectedMember.id, permission: selectedPermission }); }}
                data-testid="button-add-share"
              >
                <Check className="w-4 h-4" />
              </Button>
            </div>

            {/* Current shares */}
            {docShares.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Accès partagés</p>
                {docShares.map(share => (
                  <div key={share.id} className="flex items-center gap-2 py-1" data-testid={`share-row-${share.id}`}>
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={share.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">{getInitials(share)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{getUserLabel(share)}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{share.email}</p>
                    </div>
                    <Select
                      value={share.permission}
                      onValueChange={(v) => updateShareMutation.mutate({ shareId: share.id, permission: v })}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs" data-testid={`select-share-perm-${share.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">Lecture</SelectItem>
                        <SelectItem value="comment">Commentaire</SelectItem>
                        <SelectItem value="edit">Édition</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeShareMutation.mutate(share.id)}
                      data-testid={`button-remove-share-${share.id}`}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {docShares.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Ce document n'est pas encore partagé.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
