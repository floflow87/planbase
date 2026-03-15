import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  Search, RefreshCw, Inbox, Send, Mail,
  ChevronLeft, Paperclip, ArrowLeft, ArrowRight,
  Reply, Forward, ExternalLink, Plus, Trash2,
  MailOpen, MailCheck, X, PanelRightClose,
} from "lucide-react";
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
  hasAttachments: number;
  labels: string[] | null;
}

interface GmailStatus {
  connected: boolean;
  email?: string;
  messageCount?: number;
  canSend?: boolean;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
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

const WT = "bg-white text-gray-900 border border-gray-200 dark:bg-gray-900 dark:text-white dark:border-gray-700";

type ComposeMode = "new" | "reply" | "forward";

export default function Emails() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "received" | "sent">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [offset, setOffset] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<any>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
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
    queryKey: ["/api/gmail/messages", filter, search, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        ...(filter !== "all" ? { direction: filter } : {}),
        ...(search ? { search } : {}),
      });
      const res = await apiRequest(`/api/gmail/messages?${params}`, "GET");
      return res.json();
    },
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const composeContacts = clients
    .filter(c => c.email)
    .map(c => ({ id: c.id, fullName: c.name, email: c.email }));

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
      return apiRequest("/api/gmail/send", "POST", data);
    },
    onSuccess: () => {
      setComposeOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
      setSelectedIds(new Set());
      if (selected && ids.includes(selected.id)) setSelected(null);
      toast({
        title: `${ids.length} email(s) supprimé(s)`,
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
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

  function handleFilterChange(f: typeof filter) {
    setFilter(f);
    setOffset(0);
    setSelected(null);
    setSelectedIds(new Set());
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
    setComposeInitial({
      to: msg.fromEmail,
      subject: `Re: ${decodeHTMLEntities(msg.subject) || ""}`,
      body: `\n\n---\nDe : ${msg.fromName || msg.fromEmail}\nDate : ${format(new Date(msg.sentAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}\n\n${decodeHTMLEntities(msg.bodyText) || ""}`,
      replyToMessageId: msg.gmailMessageId,
      threadId: msg.gmailThreadId || undefined,
    });
    setComposeOpen(true);
  }

  function openForward(msg: EmailMessage) {
    setComposeInitial({
      to: "",
      subject: `Fwd: ${decodeHTMLEntities(msg.subject) || ""}`,
      body: `\n\n---\nDe : ${msg.fromName || msg.fromEmail}\nDate : ${format(new Date(msg.sentAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}\nSujet : ${decodeHTMLEntities(msg.subject) || ""}\n\n${decodeHTMLEntities(msg.bodyText) || ""}`,
    });
    setComposeOpen(true);
  }

  const TABS: { key: typeof filter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "received", label: "Reçus" },
    { key: "sent", label: "Envoyés" },
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

  return (
    <div className="flex h-full overflow-hidden">
      {/* ---- Left panel ---- */}
      <div className={cn(
        "flex flex-col transition-all bg-background shrink-0",
        selected
          ? "hidden md:flex md:w-64 lg:w-72"
          : "w-full md:w-auto md:flex-1 md:max-w-xl"
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                <Inbox className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-semibold text-sm">Boîte mail</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className={WT}>
              {gmailStatus?.email || "Non connecté"}
            </TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          {/* Sync button */}
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

          {/* Nouveau button — main color */}
          {gmailStatus?.canSend && (
            <Button
              size="sm"
              onClick={() => { setComposeInitial(undefined); setComposeOpen(true); }}
              data-testid="button-new-email"
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouveau
            </Button>
          )}
        </div>

        {/* White area */}
        <div className="flex flex-col flex-1 overflow-hidden bg-white dark:bg-background">
          {/* Filter tabs + search row */}
          <div className="flex items-center px-3 border-b shrink-0">
            <div className="flex items-center -mb-px">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleFilterChange(key)}
                  className={cn(
                    "px-2.5 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
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
            <div className="flex-1" />
            <div className="relative w-28 py-1.5 shrink-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                className="pl-5 h-6 text-[11px]"
                placeholder="Chercher..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                data-testid="input-email-search"
              />
            </div>
          </div>

          {/* Multi-select action bar */}
          {someSelected && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b shrink-0">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
                className="shrink-0"
                data-testid="checkbox-select-all"
              />
              <span className="text-xs text-muted-foreground flex-1">{selectedIds.size} sélectionné(s)</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => markReadMutation.mutate({ ids: Array.from(selectedIds), isRead: true })}
                    data-testid="button-mark-read"
                  >
                    <MailOpen className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className={WT}>Marquer comme lu</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => markReadMutation.mutate({ ids: Array.from(selectedIds), isRead: false })}
                    data-testid="button-mark-unread"
                  >
                    <MailCheck className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className={WT}>Marquer comme non lu</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => setDeleteConfirmOpen(true)}
                    data-testid="button-delete-selected"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className={WT}>Supprimer</TooltipContent>
              </Tooltip>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setSelectedIds(new Set())}
                data-testid="button-clear-selection"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* Select-all row (when none selected yet) */}
          {!someSelected && messages.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0 bg-white dark:bg-background">
              <Checkbox
                checked={false}
                onCheckedChange={toggleSelectAll}
                className="shrink-0"
                data-testid="checkbox-select-all-idle"
              />
              <span className="text-[11px] text-muted-foreground">Tout sélectionner</span>
              {gmailStatus?.messageCount !== undefined && (
                <span className="ml-auto text-[11px] text-muted-foreground">{gmailStatus.messageCount} emails</span>
              )}
            </div>
          )}

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-4">
                <RocketLoader size="sm" />
                <span className="text-xs text-muted-foreground">Chargement...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                <Mail className="w-8 h-8 opacity-30" />
                <p className="text-sm">Aucun email trouvé</p>
              </div>
            ) : (
              <div className="divide-y">
                {messages.map((msg) => {
                  const isUnread = msg.isRead === 0 && msg.direction === "received";
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
                          markReadMutation.mutate({ ids: [msg.id], isRead: true });
                        }
                      }}
                      data-testid={`email-item-${msg.id}`}
                    >
                      {/* Checkbox */}
                      <div
                        className="mt-0.5 shrink-0"
                        style={{ visibility: isChecked || someSelected ? "visible" : undefined }}
                        onClick={(e) => toggleSelect(msg.id, e)}
                      >
                        <Checkbox
                          checked={isChecked}
                          className={cn("group-hover:opacity-100", !isChecked && !someSelected && "opacity-0")}
                          data-testid={`checkbox-email-${msg.id}`}
                        />
                      </div>

                      {/* Avatar */}
                      <AvatarCircle name={msg.fromName} email={msg.fromEmail} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 mb-0.5">
                          <span className={cn("text-[11px] truncate", isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                            {msg.direction === "sent" ? "Moi" : (decodeHTMLEntities(msg.fromName) || msg.fromEmail)}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isUnread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {formatEmailDate(msg.sentAt)}
                            </span>
                          </div>
                        </div>
                        <p className={cn("text-[11px] truncate", isUnread ? "font-medium text-foreground" : "text-foreground/70")}>
                          {decodeHTMLEntities(msg.subject) || "(Sans objet)"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-relaxed">
                          {decodeHTMLEntities(msg.snippet)}
                        </p>
                        {(msg.hasAttachments === 1 || msg.direction === "sent") && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {msg.direction === "sent" && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                <Send className="w-2.5 h-2.5 mr-0.5" />Envoyé
                              </Badge>
                            )}
                            {msg.hasAttachments === 1 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                <Paperclip className="w-2.5 h-2.5 mr-0.5" />PJ
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
              <div className="flex items-center justify-center gap-2 py-2.5 border-t">
                <Button size="sm" variant="ghost" disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  data-testid="button-prev-page">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground">{offset + 1}–{offset + messages.length}</span>
                <Button size="sm" variant="ghost" disabled={messages.length < limit}
                  onClick={() => setOffset(offset + limit)}
                  data-testid="button-next-page">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Right panel ---- */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-background border-l-2 border-primary min-w-0">
          {/* Detail header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0 bg-white dark:bg-background">
            {/* Back (mobile) */}
            <Button size="icon" variant="ghost" className="md:hidden shrink-0"
              onClick={() => setSelected(null)} data-testid="button-back-emails">
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-xs truncate">{decodeHTMLEntities(selected.subject) || "(Sans objet)"}</h2>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              {gmailStatus?.canSend && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={() => openReply(selected)} data-testid="button-reply-email">
                        <Reply className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className={WT}>Répondre</TooltipContent>
                  </Tooltip>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="hidden md:flex"
                    onClick={() => setSelected(null)} data-testid="button-close-detail">
                    <PanelRightClose className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className={WT}>Fermer l'aperçu</TooltipContent>
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
                  <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1.5">
                    <Send className="w-2.5 h-2.5 mr-0.5" />Envoyé
                  </Badge>
                )}
              </div>
            </div>
            {selected.hasAttachments === 1 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Paperclip className="w-3 h-3" />
                <span>Contient des pièces jointes</span>
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
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center gap-3 text-muted-foreground bg-white dark:bg-background border-l border-border">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Mail className="w-6 h-6 opacity-50" />
          </div>
          <p className="text-xs">Sélectionnez un email pour le lire</p>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectedIds.size} email(s) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les emails sélectionnés seront définitivement supprimés de Planbase (pas de Gmail).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                deleteMutation.mutate(Array.from(selectedIds));
                setDeleteConfirmOpen(false);
              }}
              data-testid="button-confirm-delete"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
