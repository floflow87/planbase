import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, RefreshCw, Inbox, Send, Mail, ChevronLeft,
  Paperclip, ArrowLeft, ArrowRight, Reply, Forward, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";

interface EmailMessage {
  id: string;
  gmailMessageId: string;
  gmailThreadId: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  fromEmail: string;
  fromName: string | null;
  sentAt: string;
  direction: "sent" | "received";
  hasAttachments: number;
  labels: string[] | null;
}

interface GmailStatus {
  connected: boolean;
  email?: string;
  messageCount?: number;
  canSend?: boolean;
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

function AvatarCircle({ name, email, size = "md" }: { name: string | null; email: string; size?: "sm" | "md" }) {
  const colors = [
    "bg-violet-100 text-violet-700",
    "bg-cyan-100 text-cyan-700",
    "bg-green-100 text-green-700",
    "bg-orange-100 text-orange-700",
    "bg-pink-100 text-pink-700",
    "bg-blue-100 text-blue-700",
  ];
  const idx = (email.charCodeAt(0) + email.charCodeAt(1)) % colors.length;
  const sizeClass = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={cn("rounded-full flex items-center justify-center font-semibold shrink-0", colors[idx], sizeClass)}>
      {getInitials(name, email)}
    </div>
  );
}

export default function Emails() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "received" | "sent">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

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
        variant: "success",
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Synchronisation échouée.", variant: "destructive" });
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
  }

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

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — email list */}
      <div className={cn(
        "flex flex-col border-r bg-background transition-all",
        selected ? "hidden md:flex md:w-80 lg:w-96 shrink-0" : "flex-1"
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          <Inbox className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-sm flex-1">Boîte mail</span>
          {gmailStatus?.email && (
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{gmailStatus.email}</span>
          )}
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
            <TooltipContent>Synchroniser</TooltipContent>
          </Tooltip>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Rechercher..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              data-testid="input-email-search"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-3 py-2 border-b shrink-0">
          {(["all", "received", "sent"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "secondary" : "ghost"}
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => handleFilterChange(f)}
              data-testid={`button-filter-${f}`}
            >
              {f === "all" ? "Tous" : f === "received" ? "Reçus" : "Envoyés"}
            </Button>
          ))}
          {gmailStatus?.messageCount !== undefined && (
            <span className="ml-auto text-xs text-muted-foreground self-center">
              {gmailStatus.messageCount} emails
            </span>
          )}
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <Mail className="w-8 h-8 opacity-30" />
              <p className="text-sm">Aucun email trouvé</p>
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((msg) => (
                <button
                  key={msg.id}
                  className={cn(
                    "w-full text-left px-4 py-3 hover-elevate flex gap-3 items-start transition-colors",
                    selected?.id === msg.id && "bg-accent/60"
                  )}
                  onClick={() => setSelected(msg)}
                  data-testid={`email-item-${msg.id}`}
                >
                  <AvatarCircle name={msg.fromName} email={msg.fromEmail} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">
                        {msg.direction === "sent" ? "Moi" : (msg.fromName || msg.fromEmail)}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatEmailDate(msg.sentAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground truncate">{msg.subject || "(Sans objet)"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.snippet}</p>
                    {(msg.hasAttachments === 1 || msg.direction === "sent") && (
                      <div className="flex gap-1.5 mt-1">
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
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {messages.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t">
              <Button
                size="sm"
                variant="ghost"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {offset + 1}–{offset + messages.length}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={messages.length < limit}
                onClick={() => setOffset(offset + limit)}
                data-testid="button-next-page"
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — email detail */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Detail header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              onClick={() => setSelected(null)}
              data-testid="button-back-emails"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm truncate">{selected.subject || "(Sans objet)"}</h2>
            </div>
            <div className="flex gap-1">
              {gmailStatus?.canSend && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid="button-reply-email">
                        <Reply className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Répondre</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid="button-forward-email">
                        <Forward className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Transférer</TooltipContent>
                  </Tooltip>
                </>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${selected.gmailMessageId}`, "_blank")}
                    data-testid="button-open-gmail"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ouvrir dans Gmail</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Email meta */}
          <div className="px-5 py-4 border-b shrink-0">
            <div className="flex items-start gap-3">
              <AvatarCircle name={selected.fromName} email={selected.fromEmail} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                  <span className="font-medium text-sm">
                    {selected.direction === "sent" ? "Moi" : (selected.fromName || selected.fromEmail)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(selected.sentAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </span>
                </div>
                {selected.direction !== "sent" && (
                  <span className="text-xs text-muted-foreground">{selected.fromEmail}</span>
                )}
                {selected.direction === "sent" && (
                  <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1.5">
                    <Send className="w-2.5 h-2.5 mr-0.5" />Envoyé
                  </Badge>
                )}
              </div>
            </div>
            {selected.hasAttachments === 1 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Paperclip className="w-3 h-3" />
                <span>Contient des pièces jointes</span>
              </div>
            )}
          </div>

          {/* Email body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {selected.bodyText ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                {selected.bodyText}
              </pre>
            ) : selected.snippet ? (
              <p className="text-sm text-muted-foreground italic">{selected.snippet}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Corps de l'email non disponible.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center gap-3 text-muted-foreground">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Mail className="w-7 h-7 opacity-50" />
          </div>
          <p className="text-sm">Sélectionnez un email pour le lire</p>
        </div>
      )}
    </div>
  );
}
