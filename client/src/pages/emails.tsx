import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmailComposeModal } from "@/components/EmailComposeModal";
import { RocketLoader } from "@/design-system/primitives/RocketLoader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, RefreshCw, Mail, Paperclip, ArrowLeft, ArrowRight,
  Reply, ReplyAll, Forward, ExternalLink, Plus, Trash2, RotateCcw,
  MailOpen, MailCheck, X, PanelRightClose, Settings, Send,
  ChevronLeft, MoreHorizontal, UserPlus, Archive, ArchiveRestore,
  ClipboardList, FileText, ChevronDown, Download, Building2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";

interface EmailMessage {
  id: string;
  gmailMessageId: string;
  gmailThreadId: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  fromEmail: string;
  fromName: string | null;
  sentAt: string;
  direction: "sent" | "received";
  isRead: number;
  isDeleted: number;
  isArchived: number;
  hasAttachments: number;
  labels: string[] | null;
  linkedClientId: string | null;
  linkedClientName: string | null;
}

interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

interface TaskColumn {
  id: string;
  name: string;
}

interface GmailStatus {
  connected: boolean;
  email?: string;
  messageCount?: number;
  canSend?: boolean;
}

interface CrmContact {
  id: string;
  fullName: string;
  email: string | null;
}

interface SignatureConfig {
  newMessage: string;
  reply: string;
  useForNew: boolean;
  useForReply: boolean;
}

const SIGNATURE_KEY = "planbase_email_signature";

function loadSignature(): SignatureConfig {
  try {
    const raw = localStorage.getItem(SIGNATURE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { newMessage: "", reply: "", useForNew: false, useForReply: false };
}

function saveSignature(config: SignatureConfig) {
  localStorage.setItem(SIGNATURE_KEY, JSON.stringify(config));
}

function decodeHTMLEntities(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, "\u00A0")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function formatEmailDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Hier";
  return format(date, "d MMM", { locale: fr });
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(" ");
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  }
  return email[0].toUpperCase();
}

function AvatarCircle({ name, email }: { name: string | null; email: string }) {
  const colors = [
    "bg-violet-100 text-violet-700",
    "bg-cyan-100 text-cyan-700",
    "bg-green-100 text-green-700",
    "bg-orange-100 text-orange-700",
    "bg-pink-100 text-pink-700",
    "bg-blue-100 text-blue-700",
  ];
  const idx = (email.charCodeAt(0) + email.charCodeAt(1)) % colors.length;
  return (
    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-semibold shrink-0 text-xs", colors[idx])}>
      {getInitials(name, email)}
    </div>
  );
}

const WT = "bg-white text-gray-900 border border-gray-200 text-[10px] dark:bg-gray-900 dark:text-white dark:border-gray-700";

type FilterType = "received" | "sent" | "trash" | "archived";

export default function Emails() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterType>("received");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchField, setSearchField] = useState<string>("all");
  const [crmFilter, setCrmFilter] = useState<string>("all");
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [offset, setOffset] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<any>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [permanentDeleteConfirmOpen, setPermanentDeleteConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [singleDeleteOpen, setSingleDeleteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingSelectFirst, setPendingSelectFirst] = useState(false);
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set());
  const [signature, setSignature] = useState<SignatureConfig>(loadSignature);
  const [sigDraft, setSigDraft] = useState<SignatureConfig>(loadSignature);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addContactName, setAddContactName] = useState("");
  const [addContactEmail, setAddContactEmail] = useState("");
  const [addContactCompany, setAddContactCompany] = useState("");
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskTitle, setCreateTaskTitle] = useState("");
  const [createTaskMsg, setCreateTaskMsg] = useState<EmailMessage | null>(null);
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [createNoteTitle, setCreateNoteTitle] = useState("");
  const [createNoteMsg, setCreateNoteMsg] = useState<EmailMessage | null>(null);
  const [attachmentEmail, setAttachmentEmail] = useState<string | null>(null);
  const limit = 50;
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    document.title = "Emails | Planbase";
    return () => { document.title = "Planbase"; };
  }, []);

  const { data: gmailStatus } = useQuery<GmailStatus>({
    queryKey: ["/api/gmail/status"],
  });

  const { data: messages = [], isLoading } = useQuery<EmailMessage[]>({
    queryKey: ["/api/gmail/messages", filter, search, searchField, crmFilter, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        direction: filter,
        ...(search ? { search } : {}),
        ...(searchField !== "all" ? { searchField } : {}),
        ...(crmFilter !== "all" ? { crmFilter } : {}),
      });
      const res = await apiRequest(`/api/gmail/messages?${params}`, "GET");
      return res.json();
    },
  });

  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery<EmailAttachment[]>({
    queryKey: ["/api/gmail/messages", attachmentEmail, "attachments"],
    queryFn: async () => {
      const res = await apiRequest(`/api/gmail/messages/${attachmentEmail}/attachments`, "GET");
      return res.json();
    },
    enabled: !!attachmentEmail,
  });

  const { data: taskColumns = [] } = useQuery<TaskColumn[]>({
    queryKey: ["/api/task-columns"],
  });

  useEffect(() => {
    if (pendingSelectFirst && messages.length > 0) {
      setSelected(messages[0]);
      setPendingSelectFirst(false);
    }
  }, [messages, pendingSelectFirst]);

  const { data: crmContacts = [] } = useQuery<CrmContact[]>({
    queryKey: ["/api/contacts"],
  });

  const composeContacts = crmContacts
    .filter(c => c.email)
    .map(c => ({ id: c.id, fullName: c.fullName, email: c.email }));

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/gmail/sync", "POST");
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
      toast({
        title: "Synchronisation terminée",
        description: `${data.synced} emails synchronisés.`,
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Synchronisation échouée.", variant: "destructive" });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("/api/gmail/send", "POST", data);
      return res.json();
    },
    onSuccess: () => {
      setComposeOpen(false);
      setFilter("sent");
      setOffset(0);
      setSearch("");
      setSearchInput("");
      setPendingSelectFirst(true);
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/messages"] });
      toast({
        title: "Email envoyé",
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Envoi échoué.", variant: "destructive" });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async ({ ids, isRead }: { ids: string[]; isRead: boolean }) => {
      return apiRequest("/api/gmail/messages/read", "PATCH", { ids, isRead });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/messages"] });
      setSelectedIds(new Set());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("/api/gmail/messages", "DELETE", { ids });
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/messages"] });
      setSelectedIds(new Set());
      if (selected && ids.includes(selected.id)) setSelected(null);
      toast({
        title: `${ids.length} email(s) déplacé(s) en corbeille`,
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("/api/gmail/messages/restore", "PATCH", { ids });
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/messages"] });
      setSelectedIds(new Set());
      if (selected && ids.includes(selected.id)) setSelected(null);
      toast({
        title: `${ids.length} email(s) restauré(s)`,
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("/api/gmail/messages/permanent", "DELETE", { ids });
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/messages"] });
      setSelectedIds(new Set());
      if (selected && ids.includes(selected.id)) setSelected(null);
      toast({
        title: `${ids.length} email(s) supprimé(s) définitivement`,
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ ids, archive }: { ids: string[]; archive: boolean }) => {
      return apiRequest("/api/gmail/messages/archive", "PATCH", { ids, archive });
    },
    onSuccess: (_, { ids, archive }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/messages"] });
      setSelectedIds(new Set());
      if (selected && ids.includes(selected.id)) setSelected(null);
      toast({
        title: archive ? `${ids.length} email(s) archivé(s)` : `${ids.length} email(s) désarchivé(s)`,
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'archiver.", variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ title, columnId }: { title: string; columnId?: string }) => {
      const payload: any = { title };
      if (columnId) payload.columnId = columnId;
      const res = await apiRequest("/api/tasks", "POST", payload);
      return res.json();
    },
    onSuccess: () => {
      setCreateTaskOpen(false);
      setCreateTaskTitle("");
      setCreateTaskMsg(null);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Tâche créée",
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer la tâche.", variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async ({ title }: { title: string }) => {
      const res = await apiRequest("/api/notes", "POST", { title, content: "" });
      return res.json();
    },
    onSuccess: () => {
      setCreateNoteOpen(false);
      setCreateNoteTitle("");
      setCreateNoteMsg(null);
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({
        title: "Note créée",
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer la note.", variant: "destructive" });
    },
  });

  const addContactMutation = useMutation({
    mutationFn: async ({ name, email, company }: { name: string; email: string; company?: string }) => {
      const clientRes = await apiRequest("/api/clients", "POST", {
        name: name || email,
        type: "person",
        ...(company ? { company } : {}),
      });
      const client = await clientRes.json();
      const contactRes = await apiRequest("/api/contacts", "POST", {
        clientId: client.id,
        fullName: name || email,
        email,
        isPrimary: 1,
      });
      return contactRes.json();
    },
    onSuccess: () => {
      setAddContactOpen(false);
      setAddContactName("");
      setAddContactEmail("");
      setAddContactCompany("");
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Contact ajouté au CRM",
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'ajouter le contact.", variant: "destructive" });
    },
  });

  function handleSearchChange(val: string) {
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val);
      setOffset(0);
    }, 400);
  }

  function handleFilterChange(f: FilterType) {
    setFilter(f);
    setOffset(0);
    setCrmFilter("all");
    setSelected(null);
    setSelectedIds(new Set());
    setLocalReadIds(new Set());
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === messages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(messages.map(m => m.id)));
    }
  }

  function openReply(msg: EmailMessage) {
    const sig = loadSignature();
    const signaturePart = sig.useForReply && sig.reply ? `\n\n-- \n${sig.reply}` : "";
    setComposeInitial({
      to: msg.fromEmail,
      subject: `Re: ${decodeHTMLEntities(msg.subject) || ""}`,
      body: `${signaturePart}\n\n---\nDe : ${msg.fromName || msg.fromEmail}\nDate : ${format(new Date(msg.sentAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}\n\n${decodeHTMLEntities(msg.bodyText) || ""}`,
      replyToMessageId: msg.gmailMessageId,
      threadId: msg.gmailThreadId || undefined,
    });
    setComposeOpen(true);
  }

  function openForward(msg: EmailMessage) {
    const sig = loadSignature();
    const signaturePart = sig.useForReply && sig.reply ? `\n\n-- \n${sig.reply}` : "";
    setComposeInitial({
      to: "",
      subject: `Fwd: ${decodeHTMLEntities(msg.subject) || ""}`,
      body: `${signaturePart}\n\n---\nDe : ${msg.fromName || msg.fromEmail}\nDate : ${format(new Date(msg.sentAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}\nSujet : ${decodeHTMLEntities(msg.subject) || ""}\n\n${decodeHTMLEntities(msg.bodyText) || ""}`,
    });
    setComposeOpen(true);
  }

  function openNew() {
    const sig = loadSignature();
    const signaturePart = sig.useForNew && sig.newMessage ? `\n\n-- \n${sig.newMessage}` : "";
    setComposeInitial({ to: "", subject: "", body: signaturePart });
    setComposeOpen(true);
  }

  function openSettings() {
    setSigDraft(loadSignature());
    setSettingsOpen(true);
  }

  function saveSettings() {
    saveSignature(sigDraft);
    setSignature(sigDraft);
    setSettingsOpen(false);
    toast({
      title: "Paramètres sauvegardés",
      className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
    });
  }

  function openAddContact(msg: EmailMessage) {
    setAddContactName(msg.fromName || "");
    setAddContactEmail(msg.fromEmail);
    setAddContactCompany("");
    setAddContactOpen(true);
  }

  const { data: allClients = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/clients"],
  });

  const TABS: { key: FilterType; label: string }[] = [
    { key: "received", label: "Reçus" },
    { key: "sent", label: "Envoyés" },
    { key: "archived", label: "Archives" },
    { key: "trash", label: "Corbeille" },
  ];

  if (!gmailStatus?.connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Mail className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Gmail non connecté</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Connectez Gmail depuis les intégrations pour voir vos emails ici.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = "/integrations/gmail"}>
          Connecter Gmail
        </Button>
      </div>
    );
  }

  const allSelected = messages.length > 0 && selectedIds.size === messages.length;
  const someSelected = selectedIds.size > 0;
  const isTrash = filter === "trash";
  const isArchived = filter === "archived";

  return (
    <div className="flex h-full overflow-hidden">
      {/* ==================== LEFT PANEL ==================== */}
      <div className={cn(
        "flex flex-col bg-background shrink-0 border-r border-border transition-all duration-150",
        selected
          ? "hidden md:flex md:w-80 lg:w-[400px]"
          : "flex w-full"
      )}>
        {/* Header */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1.5 hover:opacity-75 transition-opacity min-w-0">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-semibold text-sm truncate">Boîte mail</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className={WT}>
              {gmailStatus?.email || "Non connecté"}
            </TooltipContent>
          </Tooltip>
          <div className="flex-1" />
          <div className="flex items-center gap-1 shrink-0">
            <div className="relative w-32">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 pr-2 text-xs h-8 bg-white dark:bg-background placeholder:text-[10px]"
                placeholder="Chercher..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                data-testid="input-email-search"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" data-testid="button-search-field">
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs min-w-[130px]">
                {[
                  { value: "all", label: "Tout" },
                  { value: "subject", label: "Objet" },
                  { value: "name", label: "Nom" },
                  { value: "email", label: "Email" },
                  { value: "content", label: "Contenu" },
                  { value: "company", label: "Société" },
                ].map(opt => (
                  <DropdownMenuItem key={opt.value} className={cn("text-xs", searchField === opt.value && "font-semibold")} onSelect={() => { setSearchField(opt.value); setOffset(0); }}>
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={openSettings}
                data-testid="button-email-settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className={WT}>Paramètres</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                data-testid="button-sync-emails"
              >
                <RefreshCw className={cn("w-4 h-4", syncMutation.isPending && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent className={WT}>Synchroniser</TooltipContent>
          </Tooltip>
          {gmailStatus?.canSend && (
            <Button
              size="sm"
              onClick={openNew}
              data-testid="button-new-email"
              className="gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouveau
            </Button>
          )}
        </div>

        {/* White area */}
        <div className="flex flex-col flex-1 overflow-hidden bg-white dark:bg-background">
          {/* Tabs */}
          <div className="flex items-center px-2 border-b shrink-0 overflow-x-auto">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleFilterChange(key)}
                className={cn(
                  "px-2 py-2.5 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap shrink-0",
                  filter === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                data-testid={`button-filter-${key}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* CRM filter bar */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b shrink-0 overflow-x-auto bg-muted/20">
            {[
              { value: "all", label: "Tous" },
              { value: "linked", label: "Liés CRM" },
              { value: "unlinked", label: "Non liés" },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => { setCrmFilter(opt.value); setOffset(0); }}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap shrink-0",
                  crmFilter === opt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground bg-background"
                )}
                data-testid={`button-crm-filter-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
            {allClients.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1",
                      crmFilter.startsWith("client:") || allClients.some(c => c.id === crmFilter)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground bg-background"
                    )}
                  >
                    <Building2 className="w-2.5 h-2.5" />
                    {allClients.find(c => c.id === crmFilter)?.name || "Client..."}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="text-xs max-h-48 overflow-y-auto">
                  <DropdownMenuItem className="text-xs" onSelect={() => { setCrmFilter("all"); setOffset(0); }}>
                    Tous les clients
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {allClients.map(c => (
                    <DropdownMenuItem key={c.id} className={cn("text-xs", crmFilter === c.id && "font-semibold")} onSelect={() => { setCrmFilter(c.id); setOffset(0); }}>
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Multi-select action bar */}
          {someSelected ? (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-primary/5 border-b shrink-0">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
                className="shrink-0"
                data-testid="checkbox-select-all"
              />
              <span className="text-[10px] text-muted-foreground flex-1 ml-1">{selectedIds.size} sélect.</span>
              {isTrash ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => restoreMutation.mutate(Array.from(selectedIds))} data-testid="button-restore">
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className={WT}>Restaurer</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                        onClick={() => setPermanentDeleteConfirmOpen(true)} data-testid="button-permanent-delete">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className={WT}>Supprimer définitivement</TooltipContent>
                  </Tooltip>
                </>
              ) : isArchived ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => archiveMutation.mutate({ ids: Array.from(selectedIds), archive: false })} data-testid="button-unarchive">
                        <ArchiveRestore className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className={WT}>Désarchiver</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                        onClick={() => setDeleteConfirmOpen(true)} data-testid="button-delete-selected">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className={WT}>Supprimer</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => markReadMutation.mutate({ ids: Array.from(selectedIds), isRead: true })} data-testid="button-mark-read">
                        <MailOpen className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className={WT}>Marquer comme lu</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => markReadMutation.mutate({ ids: Array.from(selectedIds), isRead: false })} data-testid="button-mark-unread">
                        <MailCheck className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className={WT}>Marquer non lu</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => setArchiveConfirmOpen(true)} data-testid="button-archive-selected">
                        <Archive className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className={WT}>Archiver</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                        onClick={() => setDeleteConfirmOpen(true)} data-testid="button-delete-selected">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className={WT}>Supprimer</TooltipContent>
                  </Tooltip>
                </>
              )}
              <Button size="icon" variant="ghost" className="h-6 w-6"
                onClick={() => setSelectedIds(new Set())}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            messages.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0 bg-white dark:bg-background">
                <Checkbox checked={false} onCheckedChange={toggleSelectAll} className="shrink-0" data-testid="checkbox-select-all-idle" />
                <span className="text-[10px] text-muted-foreground flex-1">Tout sélectionner</span>
                {gmailStatus?.messageCount !== undefined && !isTrash && (
                  <span className="text-[10px] text-muted-foreground px-1">{gmailStatus.messageCount}</span>
                )}
              </div>
            )
          )}

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <RocketLoader size="sm" />
                <span className="text-[11px] text-muted-foreground">Chargement...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                <Mail className="w-8 h-8 opacity-30" />
                <p className="text-xs">Aucun email</p>
              </div>
            ) : (
              <div className="divide-y">
                {messages.map((msg) => {
                  const isUnread = msg.isRead === 0 && msg.direction === "received" && !localReadIds.has(msg.id);
                  const isChecked = selectedIds.has(msg.id);
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "group relative flex gap-2 items-start px-3 py-2.5 hover-elevate transition-colors cursor-pointer",
                        selected?.id === msg.id && "bg-accent/60"
                      )}
                      onClick={() => {
                        setSelected(msg);
                        if (isUnread) {
                          setLocalReadIds(prev => new Set([...prev, msg.id]));
                          markReadMutation.mutate({ ids: [msg.id], isRead: true });
                        }
                      }}
                      data-testid={`email-item-${msg.id}`}
                    >
                      {/* Checkbox */}
                      <div
                        className="mt-0.5 shrink-0"
                        onClick={(e) => toggleSelect(msg.id, e)}
                      >
                        <Checkbox
                          checked={isChecked}
                          className={cn("transition-opacity", !isChecked && !someSelected ? "opacity-0 group-hover:opacity-100" : "opacity-100")}
                          data-testid={`checkbox-email-${msg.id}`}
                        />
                      </div>

                      {/* Unread dot — left of avatar */}
                      <span
                        className={cn(
                          "self-center w-1.5 h-1.5 rounded-full shrink-0 flex-shrink-0",
                          isUnread ? "bg-primary" : "invisible"
                        )}
                      />

                      <AvatarCircle name={msg.fromName} email={msg.fromEmail} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-[11px] truncate leading-none font-semibold text-foreground">
                            {msg.direction === "sent" ? "Moi" : (decodeHTMLEntities(msg.fromName) || msg.fromEmail)}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-muted-foreground leading-none">
                              {formatEmailDate(msg.sentAt)}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] truncate leading-tight font-semibold text-foreground/90">
                          {decodeHTMLEntities(msg.subject) || "(Sans objet)"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-relaxed">
                          {decodeHTMLEntities(msg.snippet)}
                        </p>
                        {(msg.hasAttachments === 1 || msg.direction === "sent" || msg.linkedClientName) && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {msg.linkedClientName && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-violet-200 text-violet-700 dark:border-violet-700 dark:text-violet-400 max-w-[80px] truncate" title={msg.linkedClientName}>
                                <Building2 className="w-2 h-2 mr-0.5 shrink-0" /><span className="truncate">{msg.linkedClientName}</span>
                              </Badge>
                            )}
                            {msg.direction === "sent" && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                                <Send className="w-2 h-2 mr-0.5" />Envoyé
                              </Badge>
                            )}
                            {msg.hasAttachments === 1 && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                                <Paperclip className="w-2 h-2 mr-0.5" />PJ
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {messages.length > 0 && (
              <div className="flex items-center justify-center gap-2 py-2 border-t">
                <Button size="sm" variant="ghost" disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))} data-testid="button-prev-page">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-[10px] text-muted-foreground">{offset + 1}–{offset + messages.length}</span>
                <Button size="sm" variant="ghost" disabled={messages.length < limit}
                  onClick={() => setOffset(offset + limit)} data-testid="button-next-page">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== RIGHT PANEL (flex-1) ==================== */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden bg-white dark:bg-background min-w-0",
        selected ? "flex" : "hidden"
      )}>
        {selected ? (
          <>
            {/* Detail header */}
            <div className="flex items-center gap-1 px-4 py-2.5 border-b shrink-0 bg-white dark:bg-background">
              <Button size="icon" variant="ghost" className="md:hidden shrink-0"
                onClick={() => setSelected(null)} data-testid="button-back-emails">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-xs truncate">{decodeHTMLEntities(selected.subject) || "(Sans objet)"}</h2>
              </div>
              <div className="flex items-center gap-0 shrink-0">
                {gmailStatus?.canSend && !isTrash && !isArchived && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => openReply(selected)} data-testid="button-reply-email">
                          <Reply className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className={WT}>Répondre</TooltipContent>
                    </Tooltip>
                    {selected.direction === "received" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={() => openReply(selected)} data-testid="button-reply-all-email">
                            <ReplyAll className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className={WT}>Répondre à tous</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => openForward(selected)} data-testid="button-forward-email">
                          <Forward className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className={WT}>Transférer</TooltipContent>
                    </Tooltip>
                  </>
                )}
                {isTrash && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={() => restoreMutation.mutate([selected.id])} data-testid="button-restore-single">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className={WT}>Restaurer</TooltipContent>
                  </Tooltip>
                )}
                {isArchived && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={() => archiveMutation.mutate({ ids: [selected.id], archive: false })} data-testid="button-unarchive-single">
                        <ArchiveRestore className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className={WT}>Désarchiver</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost"
                      onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${selected.gmailMessageId}`, "_blank")}
                      data-testid="button-open-gmail">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className={WT}>Ouvrir dans Gmail</TooltipContent>
                </Tooltip>

                {/* "..." dropdown menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" data-testid="button-email-more">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {selected.direction === "received" && (
                      <DropdownMenuItem
                        onClick={() => openAddContact(selected)}
                        data-testid="button-add-contact"
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-2" />
                        Ajouter ce contact
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => { setCreateTaskMsg(selected); setCreateTaskTitle(decodeHTMLEntities(selected.subject) || ""); setCreateTaskOpen(true); }} data-testid="button-create-task">
                      <ClipboardList className="w-3.5 h-3.5 mr-2" />
                      Créer une tâche
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setCreateNoteMsg(selected); setCreateNoteTitle(decodeHTMLEntities(selected.subject) || ""); setCreateNoteOpen(true); }} data-testid="button-create-note">
                      <FileText className="w-3.5 h-3.5 mr-2" />
                      Créer une note
                    </DropdownMenuItem>
                    {!isTrash && !isArchived && (
                      <DropdownMenuItem onClick={() => archiveMutation.mutate({ ids: [selected.id], archive: true })} data-testid="button-archive-single">
                        <Archive className="w-3.5 h-3.5 mr-2" />
                        Archiver
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setSingleDeleteOpen(true)}
                      data-testid="button-delete-single"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      {isTrash ? "Supprimer définitivement" : "Supprimer"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="hidden md:flex"
                      onClick={() => setSelected(null)} data-testid="button-close-detail">
                      <PanelRightClose className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className={WT}>Fermer</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Email meta */}
            <div className="px-4 py-3 border-b shrink-0 bg-white dark:bg-background">
              <div className="flex items-start gap-3">
                <AvatarCircle name={selected.fromName} email={selected.fromEmail} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <span className="font-medium text-xs">
                      {selected.direction === "sent" ? "Moi" : (decodeHTMLEntities(selected.fromName) || selected.fromEmail)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(selected.sentAt), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                    </span>
                  </div>
                  {selected.direction !== "sent" && (
                    <span className="text-[10px] text-muted-foreground">{selected.fromEmail}</span>
                  )}
                  {selected.direction === "sent" && (
                    <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1">
                      <Send className="w-2 h-2 mr-0.5" />Envoyé
                    </Badge>
                  )}
                </div>
              </div>
              {selected.linkedClientName && (
                <div className="mt-1.5">
                  <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-700 dark:border-violet-700 dark:text-violet-400">
                    <Building2 className="w-2.5 h-2.5 mr-1" />{selected.linkedClientName}
                  </Badge>
                </div>
              )}
              {selected.direction === "sent" && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400">
                  <MailCheck className="w-3 h-3" />
                  <span>Livré</span>
                </div>
              )}
              {selected.hasAttachments === 1 && (
                <div className="mt-1.5">
                  {attachmentEmail !== selected.id ? (
                    <button
                      className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setAttachmentEmail(selected.id)}
                    >
                      <Paperclip className="w-3 h-3" />
                      <span>Voir les pièces jointes</span>
                    </button>
                  ) : attachmentsLoading ? (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <Paperclip className="w-3 h-3 animate-pulse" />
                      Chargement des pièces jointes...
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {attachments.map((att) => (
                        <div key={att.attachmentId} className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-muted/40 text-[10px] max-w-[200px]">
                          <Paperclip className="w-2.5 h-2.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-foreground">{att.filename}</span>
                          <span className="shrink-0 text-muted-foreground">{att.size > 1024 * 1024 ? `${(att.size / 1024 / 1024).toFixed(1)}MB` : att.size > 1024 ? `${Math.round(att.size / 1024)}KB` : `${att.size}B`}</span>
                          <a
                            href={`/api/gmail/messages/${selected.id}/attachments/${att.attachmentId}/download?filename=${encodeURIComponent(att.filename)}`}
                            download={att.filename}
                            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                            title="Télécharger"
                          >
                            <Download className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      ))}
                      {attachments.length === 0 && (
                        <span className="text-[10px] text-muted-foreground">Aucune pièce jointe trouvée</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Email body */}
            <div className="flex-1 overflow-hidden bg-white dark:bg-background">
              {selected.bodyHtml ? (
                <iframe
                  srcDoc={selected.bodyHtml}
                  sandbox="allow-same-origin allow-popups"
                  className="w-full h-full border-0"
                  title="Email content"
                  data-testid="email-body-iframe"
                />
              ) : selected.bodyText ? (
                <div className="h-full overflow-y-auto px-4 py-4">
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
                    {decodeHTMLEntities(selected.bodyText)}
                  </pre>
                </div>
              ) : selected.snippet ? (
                <div className="px-4 py-4">
                  <p className="text-xs text-muted-foreground italic">{decodeHTMLEntities(selected.snippet)}</p>
                </div>
              ) : (
                <div className="px-4 py-4">
                  <p className="text-xs text-muted-foreground italic">Corps de l'email non disponible.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground border-l border-border">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Mail className="w-6 h-6 opacity-40" />
            </div>
            <p className="text-xs">Sélectionnez un email pour le lire</p>
          </div>
        )}
      </div>

      {/* ==================== SETTINGS SHEET ==================== */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-[360px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-sm font-semibold">Paramètres des emails</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Signature nouveau message */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium">Signature — nouveau message</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ajoutée en bas de chaque nouveau message</p>
                </div>
                <Switch
                  checked={sigDraft.useForNew}
                  onCheckedChange={(v) => setSigDraft(d => ({ ...d, useForNew: v }))}
                  data-testid="switch-signature-new"
                />
              </div>
              {sigDraft.useForNew && (
                <Textarea
                  value={sigDraft.newMessage}
                  onChange={(e) => setSigDraft(d => ({ ...d, newMessage: e.target.value }))}
                  placeholder="Votre signature..."
                  className="text-xs resize-none min-h-[120px]"
                  data-testid="textarea-signature-new"
                />
              )}
            </div>

            {/* Signature réponse */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium">Signature — réponse & transfert</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ajoutée lors des réponses et transferts</p>
                </div>
                <Switch
                  checked={sigDraft.useForReply}
                  onCheckedChange={(v) => setSigDraft(d => ({ ...d, useForReply: v }))}
                  data-testid="switch-signature-reply"
                />
              </div>
              {sigDraft.useForReply && (
                <Textarea
                  value={sigDraft.reply}
                  onChange={(e) => setSigDraft(d => ({ ...d, reply: e.target.value }))}
                  placeholder="Votre signature pour les réponses..."
                  className="text-xs resize-none min-h-[120px]"
                  data-testid="textarea-signature-reply"
                />
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <Button onClick={saveSettings} className="w-full" data-testid="button-save-settings">
              Sauvegarder
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ==================== ADD CONTACT SHEET ==================== */}
      <Sheet open={addContactOpen} onOpenChange={(open) => {
        if (!open) {
          setAddContactOpen(false);
          setAddContactName("");
          setAddContactEmail("");
          setAddContactCompany("");
        }
      }}>
        <SheetContent side="right" className="w-[380px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-sm font-semibold">Ajouter au CRM</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nom complet *</Label>
              <Input
                value={addContactName}
                onChange={(e) => setAddContactName(e.target.value)}
                placeholder="Jean Dupont"
                className="text-xs h-8"
                data-testid="input-add-contact-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <Input
                value={addContactEmail}
                onChange={(e) => setAddContactEmail(e.target.value)}
                placeholder="jean@exemple.com"
                className="text-xs h-8"
                data-testid="input-add-contact-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Entreprise</Label>
              <Input
                value={addContactCompany}
                onChange={(e) => setAddContactCompany(e.target.value)}
                placeholder="Nom de l'entreprise (optionnel)"
                className="text-xs h-8"
                data-testid="input-add-contact-company"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Un nouveau client et un contact seront créés dans votre CRM.
            </p>
          </div>
          <div className="border-t pt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setAddContactOpen(false)}
            >
              Annuler
            </Button>
            <Button
              className="flex-1"
              disabled={!addContactName.trim() || addContactMutation.isPending}
              onClick={() => addContactMutation.mutate({
                name: addContactName.trim(),
                email: addContactEmail.trim(),
                company: addContactCompany.trim() || undefined,
              })}
              data-testid="button-save-contact"
            >
              {addContactMutation.isPending ? "Ajout..." : "Ajouter"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ==================== DIALOGS ==================== */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déplacer {selectedIds.size} email(s) vers la corbeille ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous pourrez les restaurer depuis le filtre Corbeille.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { deleteMutation.mutate(Array.from(selectedIds)); setDeleteConfirmOpen(false); }}
              data-testid="button-confirm-delete"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={permanentDeleteConfirmOpen} onOpenChange={setPermanentDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement {selectedIds.size} email(s) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les emails seront définitivement supprimés de Planbase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => { permanentDeleteMutation.mutate(Array.from(selectedIds)); setPermanentDeleteConfirmOpen(false); }}
              data-testid="button-confirm-permanent-delete"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single email delete from "..." button */}
      <AlertDialog open={singleDeleteOpen} onOpenChange={setSingleDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isTrash ? "Supprimer définitivement cet email ?" : "Déplacer cet email vers la corbeille ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isTrash
                ? "Cette action est irréversible."
                : "Vous pourrez le restaurer depuis le filtre Corbeille."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={isTrash ? "bg-destructive text-destructive-foreground" : ""}
              onClick={() => {
                if (selected) {
                  if (isTrash) {
                    permanentDeleteMutation.mutate([selected.id]);
                  } else {
                    deleteMutation.mutate([selected.id]);
                  }
                }
                setSingleDeleteOpen(false);
              }}
              data-testid="button-confirm-single-delete"
            >
              {isTrash ? "Supprimer définitivement" : "Déplacer en corbeille"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirm */}
      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver {selectedIds.size} email(s) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les emails archivés restent accessibles dans l'onglet Archives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                archiveMutation.mutate({ ids: Array.from(selectedIds), archive: true });
                setArchiveConfirmOpen(false);
              }}
              data-testid="button-confirm-archive"
            >
              Archiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create task sheet */}
      <Sheet open={createTaskOpen} onOpenChange={(open) => { if (!open) { setCreateTaskOpen(false); setCreateTaskTitle(""); setCreateTaskMsg(null); } }}>
        <SheetContent side="right" className="w-[360px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-sm font-semibold">Créer une tâche</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {createTaskMsg && (
              <div className="text-[10px] text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                Depuis: {decodeHTMLEntities(createTaskMsg.fromName) || createTaskMsg.fromEmail} — {decodeHTMLEntities(createTaskMsg.subject) || "(Sans objet)"}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Titre de la tâche *</Label>
              <Input
                value={createTaskTitle}
                onChange={(e) => setCreateTaskTitle(e.target.value)}
                placeholder="Titre de la tâche..."
                className="text-xs h-8"
                autoFocus
                data-testid="input-create-task-title"
              />
            </div>
            {taskColumns.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Colonne</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                      {taskColumns[0]?.name || "Aucune"}
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full min-w-[200px]">
                    {taskColumns.map(col => (
                      <DropdownMenuItem key={col.id} className="text-xs">{col.name}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          <div className="border-t pt-4 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => { setCreateTaskOpen(false); setCreateTaskTitle(""); }}>Annuler</Button>
            <Button
              className="flex-1"
              disabled={!createTaskTitle.trim() || createTaskMutation.isPending}
              onClick={() => createTaskMutation.mutate({ title: createTaskTitle.trim(), columnId: taskColumns[0]?.id })}
              data-testid="button-save-task"
            >
              {createTaskMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create note sheet */}
      <Sheet open={createNoteOpen} onOpenChange={(open) => { if (!open) { setCreateNoteOpen(false); setCreateNoteTitle(""); setCreateNoteMsg(null); } }}>
        <SheetContent side="right" className="w-[360px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-sm font-semibold">Créer une note</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {createNoteMsg && (
              <div className="text-[10px] text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                Depuis: {decodeHTMLEntities(createNoteMsg.fromName) || createNoteMsg.fromEmail} — {decodeHTMLEntities(createNoteMsg.subject) || "(Sans objet)"}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Titre de la note *</Label>
              <Input
                value={createNoteTitle}
                onChange={(e) => setCreateNoteTitle(e.target.value)}
                placeholder="Titre de la note..."
                className="text-xs h-8"
                autoFocus
                data-testid="input-create-note-title"
              />
            </div>
          </div>
          <div className="border-t pt-4 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => { setCreateNoteOpen(false); setCreateNoteTitle(""); }}>Annuler</Button>
            <Button
              className="flex-1"
              disabled={!createNoteTitle.trim() || createNoteMutation.isPending}
              onClick={() => createNoteMutation.mutate({ title: createNoteTitle.trim() })}
              data-testid="button-save-note"
            >
              {createNoteMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Compose modal */}
      <EmailComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        contacts={composeContacts}
        senderEmail={gmailStatus?.email}
        initialData={composeInitial}
        onSend={(data) => sendEmailMutation.mutate(data)}
        isSending={sendEmailMutation.isPending}
      />
    </div>
  );
}
