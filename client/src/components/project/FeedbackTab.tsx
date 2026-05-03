import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  MessageSquare, Copy, ExternalLink, Link2, Plus, Check, Trash2,
  MoreHorizontal, Zap, BarChart2, Search, Archive, ThumbsDown,
  Ticket, Tag, RefreshCw, ChevronRight, TrendingUp, Filter, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// ── Types ────────────────────────────────────────────────────────────────────

interface FeedbackSettings {
  id: string;
  backlogId: string;
  shareToken: string;
  isEnabled: boolean;
  showExistingFeedbacks: boolean;
  allowAttachments: boolean;
}

interface FeedbackV2 {
  id: string;
  contributorName: string;
  contributorEmail: string | null;
  type: string;
  title: string;
  description: string;
  importance: string;
  internalStatus: string;
  publicStatus: string;
  source: string;
  impactUser: string | null;
  frequency: string | null;
  urgency: string | null;
  segment: string | null;
  productArea: string | null;
  tags: string[] | null;
  qualificationNotes: string | null;
  score: number | null;
  linkedTicketId: string | null;
  linkedTicketTitle: string | null;
  linkedTicketState: string | null;
  createdAt: string;
  archivedAt: string | null;
}

interface UserStoryItem {
  id: string;
  title: string;
  state: string;
  priority: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  bug: "Bug", improvement: "Amélioration", idea: "Idée",
  question: "Question", pain_point: "Point de douleur", other: "Autre",
};
const TYPE_COLORS: Record<string, string> = {
  bug: "text-red-600 border-red-400 dark:text-red-400",
  improvement: "text-emerald-600 border-emerald-400 dark:text-emerald-400",
  idea: "text-violet-600 border-violet-400 dark:text-violet-400",
  question: "text-cyan-600 border-cyan-400 dark:text-cyan-400",
  pain_point: "text-orange-600 border-orange-400 dark:text-orange-400",
  other: "text-muted-foreground",
};
const IMPORTANCE_LABELS: Record<string, string> = {
  low: "Faible", medium: "Moyen", high: "Élevé", critical: "Critique",
};
const STATUS_LABELS: Record<string, string> = {
  new: "Nouveau", to_qualify: "À qualifier", qualified: "Qualifié",
  linked_to_ticket: "Lié à un ticket", rejected: "Rejeté", archived: "Archivé",
  to_review: "À analyser", accepted: "Retenu", converted_to_ticket: "Converti",
};
const STATUS_BADGE: Record<string, string> = {
  new: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
  to_qualify: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  qualified: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  linked_to_ticket: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  archived: "bg-muted text-muted-foreground border-border",
  to_review: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  accepted: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  converted_to_ticket: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
};
const SOURCE_LABELS: Record<string, string> = {
  manual: "Manuel", external_feedback_page: "Lien public",
  client_call: "Appel client", support: "Support", sales: "Commercial", other: "Autre",
};

// ── Score utils ───────────────────────────────────────────────────────────────

const IMPACT_SCORE: Record<string, number> = { low: 1, medium: 2, high: 3 };
const FREQ_SCORE: Record<string, number> = { isolated: 1, recurring: 3 };
const URGENCY_SCORE: Record<string, number> = { low: 1, medium: 2, high: 3 };
const IMPORTANCE_SCORE: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

function calcScore(fb: FeedbackV2): number {
  if (!fb.impactUser && !fb.frequency && !fb.urgency) return 0;
  return (IMPACT_SCORE[fb.impactUser ?? ""] ?? 0)
    + (FREQ_SCORE[fb.frequency ?? ""] ?? 0)
    + (URGENCY_SCORE[fb.urgency ?? ""] ?? 0)
    + (IMPORTANCE_SCORE[fb.importance] ?? 0);
}

function getScoreInfo(score: number): { label: string; cls: string } | null {
  if (score <= 0) return null;
  if (score >= 9) return { label: "Signal fort", cls: "text-violet-700 border-violet-500 dark:text-violet-400" };
  if (score >= 5) return { label: "Signal moyen", cls: "text-amber-700 border-amber-500 dark:text-amber-400" };
  return { label: "Signal faible", cls: "text-muted-foreground" };
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const addFeedbackSchema = z.object({
  contributorName: z.string().min(1, "Le nom est requis"),
  contributorEmail: z.string().email("Email invalide").optional().or(z.literal("")),
  type: z.enum(["bug", "improvement", "idea", "question", "pain_point", "other"]),
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().min(1, "La description est requise"),
  importance: z.enum(["low", "medium", "high", "critical"]),
  source: z.enum(["manual", "client_call", "support", "sales", "other"]),
});

const qualifSchema = z.object({
  impactUser: z.string().optional(),
  frequency: z.string().optional(),
  urgency: z.string().optional(),
  segment: z.string().optional(),
  productArea: z.string().optional(),
  tagsRaw: z.string().optional(),
  qualificationNotes: z.string().optional(),
  internalStatus: z.string(),
});

const createTicketSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
});

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${STATUS_BADGE[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ScoreBadge({ feedback }: { feedback: FeedbackV2 }) {
  const score = calcScore(feedback);
  const info = getScoreInfo(score);
  if (!info) return <span className="text-[10px] text-muted-foreground italic">Non qualifié</span>;
  return (
    <Badge variant="outline" className={`text-[10px] ${info.cls}`}>
      {score} — {info.label}
    </Badge>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { backlogId: string; }

export function FeedbackTab({ backlogId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeView, setActiveView] = useState<"inbox" | "insights">("inbox");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackV2 | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [isLinkTicketOpen, setIsLinkTicketOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterImportance, setFilterImportance] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // ── Queries ──
  const { data: feedbacks = [], isLoading: feedbacksLoading } = useQuery<FeedbackV2[]>({
    queryKey: [`/api/backlogs/${backlogId}/feedbacks`],
  });
  const { data: settings, isLoading: settingsLoading } = useQuery<FeedbackSettings>({
    queryKey: [`/api/backlogs/${backlogId}/feedback-settings`],
  });
  const { data: userStories = [], isLoading: storiesLoading } = useQuery<UserStoryItem[]>({
    queryKey: [`/api/backlogs/${backlogId}/user-stories`],
    enabled: isLinkTicketOpen,
  });

  // ── Forms ──
  const addForm = useForm<z.infer<typeof addFeedbackSchema>>({
    resolver: zodResolver(addFeedbackSchema),
    defaultValues: { contributorName: "", contributorEmail: "", type: "idea", title: "", description: "", importance: "medium", source: "manual" },
  });
  const qualifForm = useForm<z.infer<typeof qualifSchema>>({
    resolver: zodResolver(qualifSchema),
    defaultValues: { impactUser: "", frequency: "", urgency: "", segment: "", productArea: "", tagsRaw: "", qualificationNotes: "", internalStatus: "new" },
  });
  const createTicketForm = useForm<z.infer<typeof createTicketSchema>>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { title: "", description: "", priority: "medium" },
  });

  // ── Mutations ──
  const saveSettingsMutation = useMutation({
    mutationFn: (patch: Partial<FeedbackSettings>) =>
      apiRequest(`/api/backlogs/${backlogId}/feedback-settings`, "POST", patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedback-settings`] }),
    onError: () => toast({ title: "Erreur", description: "Impossible de sauvegarder les paramètres", variant: "destructive" }),
  });

  const addFeedbackMutation = useMutation({
    mutationFn: (data: z.infer<typeof addFeedbackSchema>) =>
      apiRequest(`/api/backlogs/${backlogId}/feedbacks`, "POST", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      setIsAddOpen(false);
      addForm.reset();
      toast({ title: "Feedback ajouté" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible d'ajouter le feedback", variant: "destructive" }),
  });

  const saveQualifMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: z.infer<typeof qualifSchema> }) => {
      const tags = data.tagsRaw ? data.tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
      return apiRequest(`/api/backlogs/${backlogId}/feedbacks/${id}`, "PATCH", {
        impactUser: data.impactUser || null,
        frequency: data.frequency || null,
        urgency: data.urgency || null,
        segment: data.segment || null,
        productArea: data.productArea || null,
        tags,
        qualificationNotes: data.qualificationNotes || null,
        internalStatus: data.internalStatus || undefined,
      });
    },
    onSuccess: (updated: any) => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      setSelectedFeedback((prev) => prev ? { ...prev, ...updated } : null);
      toast({ title: "Qualification sauvegardée" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, internalStatus }: { id: string; internalStatus: string }) =>
      apiRequest(`/api/backlogs/${backlogId}/feedbacks/${id}`, "PATCH", { internalStatus }),
    onSuccess: (updated: any) => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      setSelectedFeedback((prev) => prev ? { ...prev, ...updated } : null);
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const createTicketMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: z.infer<typeof createTicketSchema> }) =>
      apiRequest(`/api/backlogs/${backlogId}/feedbacks/${id}/create-ticket`, "POST", data),
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/user-stories`] });
      setIsCreateTicketOpen(false);
      createTicketForm.reset();
      setSelectedFeedback((prev) => prev ? { ...prev, internalStatus: "linked_to_ticket", linkedTicketId: result.ticketId, linkedTicketTitle: result.ticketTitle } : null);
      toast({ title: "Ticket créé", description: `"${result.ticketTitle}" créé depuis ce feedback` });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de créer le ticket", variant: "destructive" }),
  });

  const linkTicketMutation = useMutation({
    mutationFn: ({ feedbackId, ticketId }: { feedbackId: string; ticketId: string }) =>
      apiRequest(`/api/backlogs/${backlogId}/feedbacks/${feedbackId}/link-ticket`, "POST", { ticketId }),
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      setIsLinkTicketOpen(false);
      setSelectedTicketId(null);
      setTicketSearch("");
      setSelectedFeedback((prev) => prev ? { ...prev, internalStatus: "linked_to_ticket", linkedTicketId: result.ticketId, linkedTicketTitle: result.ticketTitle } : null);
      toast({ title: "Ticket lié avec succès" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de lier le ticket", variant: "destructive" }),
  });

  const deleteFeedbackMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/backlogs/${backlogId}/feedbacks/${id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      setSelectedFeedback(null);
      toast({ title: "Feedback supprimé" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  // ── Computed ──
  const openFeedback = (fb: FeedbackV2) => {
    setSelectedFeedback(fb);
    qualifForm.reset({
      impactUser: fb.impactUser ?? "",
      frequency: fb.frequency ?? "",
      urgency: fb.urgency ?? "",
      segment: fb.segment ?? "",
      productArea: fb.productArea ?? "",
      tagsRaw: fb.tags?.join(", ") ?? "",
      qualificationNotes: fb.qualificationNotes ?? "",
      internalStatus: STATUS_LABELS[fb.internalStatus] ? fb.internalStatus : "new",
    });
  };

  const openCreateTicket = () => {
    if (!selectedFeedback) return;
    const seg = selectedFeedback.segment
      ? ({ freelance: "freelance", agency: "une agence", client: "un client", internal: "un membre de l'équipe", other: "utilisateur" }[selectedFeedback.segment] ?? "utilisateur")
      : "utilisateur";
    const desc = [
      `En tant que ${seg},`,
      `je souhaite ${selectedFeedback.title.toLowerCase()},`,
      `afin d'améliorer mon expérience.`,
      ``,
      `**Contexte :**`,
      selectedFeedback.description,
      ``,
      `**Source :**`,
      `Feedback reçu de ${selectedFeedback.contributorName} le ${new Date(selectedFeedback.createdAt).toLocaleDateString("fr-FR")}`,
      ``,
      `**Qualification :**`,
      `- Impact utilisateur : ${selectedFeedback.impactUser ? ({ low: "Faible", medium: "Moyen", high: "Élevé" }[selectedFeedback.impactUser] ?? selectedFeedback.impactUser) : "Non renseigné"}`,
      `- Fréquence : ${selectedFeedback.frequency ? ({ isolated: "Isolé", recurring: "Récurrent" }[selectedFeedback.frequency] ?? selectedFeedback.frequency) : "Non renseignée"}`,
      `- Urgence : ${selectedFeedback.urgency ? ({ low: "Faible", medium: "Moyen", high: "Élevé" }[selectedFeedback.urgency] ?? selectedFeedback.urgency) : "Non renseignée"}`,
      `- Importance initiale : ${IMPORTANCE_LABELS[selectedFeedback.importance] ?? selectedFeedback.importance}`,
      ``,
      `**Critères d'acceptation :**`,
      `- [ ] À compléter`,
    ].join("\n");
    const priorityMap: Record<string, "low" | "medium" | "high" | "critical"> = { critical: "critical", high: "high", medium: "medium", low: "low" };
    createTicketForm.reset({
      title: selectedFeedback.title,
      description: desc,
      priority: priorityMap[selectedFeedback.importance] ?? "medium",
    });
    setIsCreateTicketOpen(true);
  };

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((fb) => {
      if (showArchived ? fb.internalStatus !== "archived" : fb.internalStatus === "archived") return false;
      if (filterType !== "all" && fb.type !== filterType) return false;
      if (filterImportance !== "all" && fb.importance !== filterImportance) return false;
      if (filterStatus !== "all" && fb.internalStatus !== filterStatus) return false;
      if (filterSource !== "all" && fb.source !== filterSource) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!fb.title.toLowerCase().includes(q) && !fb.description.toLowerCase().includes(q) && !fb.contributorName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [feedbacks, showArchived, filterType, filterImportance, filterStatus, filterSource, searchText]);

  const nonArchivedCount = feedbacks.filter((fb) => fb.internalStatus !== "archived").length;

  const insights = useMemo(() => {
    const active = feedbacks.filter((fb) => fb.internalStatus !== "archived");
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const productAreaMap: Record<string, number> = {};
    const ticketMap: Record<string, { id: string; title: string; count: number }> = {};
    active.forEach((fb) => {
      byStatus[fb.internalStatus] = (byStatus[fb.internalStatus] ?? 0) + 1;
      byType[fb.type] = (byType[fb.type] ?? 0) + 1;
      if (fb.productArea) productAreaMap[fb.productArea] = (productAreaMap[fb.productArea] ?? 0) + 1;
      if (fb.linkedTicketId && fb.linkedTicketTitle) {
        ticketMap[fb.linkedTicketId] = { id: fb.linkedTicketId, title: fb.linkedTicketTitle, count: (ticketMap[fb.linkedTicketId]?.count ?? 0) + 1 };
      }
    });
    const topByScore = [...active]
      .map((fb) => ({ ...fb, _score: calcScore(fb) }))
      .filter((fb) => fb._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 5);
    const productAreas = Object.entries(productAreaMap).sort(([, a], [, b]) => b - a).slice(0, 6).map(([area, count]) => ({ area, count }));
    const topTickets = Object.values(ticketMap).sort((a, b) => b.count - a.count).slice(0, 5);
    const toQualifyCount = (byStatus["new"] ?? 0) + (byStatus["to_qualify"] ?? 0) + (byStatus["to_review"] ?? 0);
    const linkedCount = (byStatus["linked_to_ticket"] ?? 0) + (byStatus["converted_to_ticket"] ?? 0);
    const recurringCount = active.filter((fb) => fb.frequency === "recurring").length;
    const criticalBugsCount = active.filter((fb) => fb.type === "bug" && fb.importance === "critical").length;
    return { byStatus, byType, topByScore, productAreas, topTickets, toQualifyCount, linkedCount, recurringCount, criticalBugsCount };
  }, [feedbacks]);

  const publicUrl = settings ? `${window.location.origin}/feedback/${settings.shareToken}` : null;
  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Lien copié !" });
  };

  const hasActiveFilters = filterType !== "all" || filterImportance !== "all" || filterStatus !== "all" || filterSource !== "all" || searchText;

  if (settingsLoading || feedbacksLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold font-heading">Feedbacks</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Centralisez les retours terrain et transformez-les en tickets priorisables.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={activeView === "inbox" ? "default" : "outline"}
            onClick={() => setActiveView("inbox")}
            className="gap-1.5"
            data-testid="button-view-inbox"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Inbox
            {nonArchivedCount > 0 && <Badge variant="secondary" className="text-[10px] ml-0.5">{nonArchivedCount}</Badge>}
          </Button>
          <Button
            size="sm"
            variant={activeView === "insights" ? "default" : "outline"}
            onClick={() => setActiveView("insights")}
            className="gap-1.5"
            data-testid="button-view-insights"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Insights
          </Button>
          <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1.5" data-testid="button-add-feedback">
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* ── Share settings card ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Link2 className="w-4 h-4 text-primary shrink-0" />
            <CardTitle className="text-sm">Page externe de feedback</CardTitle>
            <Badge variant={settings?.isEnabled ? "default" : "secondary"} className="text-[10px]">
              {settings?.isEnabled ? "Active" : "Désactivée"}
            </Badge>
          </div>
          <CardDescription className="text-xs">Partagez un lien public pour collecter des retours sans compte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch id="feedback-enabled" checked={settings?.isEnabled ?? false} onCheckedChange={(v) => saveSettingsMutation.mutate({ isEnabled: v })} data-testid="switch-feedback-enabled" />
              <Label htmlFor="feedback-enabled" className="text-xs">Activer la page publique</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="feedback-show" checked={settings?.showExistingFeedbacks ?? false} onCheckedChange={(v) => saveSettingsMutation.mutate({ showExistingFeedbacks: v })} data-testid="switch-feedback-show" />
              <Label htmlFor="feedback-show" className="text-xs">Afficher les feedbacks aux visiteurs</Label>
            </div>
          </div>
          {publicUrl && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-0 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground truncate">{publicUrl}</div>
              <Button size="sm" variant="outline" onClick={copyLink} className="gap-1.5 shrink-0" data-testid="button-copy-feedback-link"><Copy className="w-3 h-3" />Copier</Button>
              <Button size="sm" variant="ghost" asChild className="shrink-0"><a href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a></Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Inbox view ── */}
      {activeView === "inbox" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 flex-wrap justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Filtres</span>
              </div>
              <Button
                size="sm"
                variant={showArchived ? "default" : "outline"}
                onClick={() => { setShowArchived((v) => !v); setFilterStatus("all"); }}
                className="gap-1.5 text-xs"
                data-testid="button-toggle-archived"
              >
                <Archive className="w-3 h-3" />
                {showArchived ? "Voir les actifs" : "Voir les archivés"}
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                <Input placeholder="Rechercher..." className="pl-7 h-7 text-xs w-44" value={searchText} onChange={(e) => setSearchText(e.target.value)} data-testid="input-feedback-search" />
              </div>
              {!showArchived && (
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-7 text-xs w-36" data-testid="select-filter-status"><SelectValue placeholder="Statut" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="new">Nouveau</SelectItem>
                    <SelectItem value="to_qualify">À qualifier</SelectItem>
                    <SelectItem value="qualified">Qualifié</SelectItem>
                    <SelectItem value="linked_to_ticket">Lié à un ticket</SelectItem>
                    <SelectItem value="rejected">Rejeté</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-7 text-xs w-36" data-testid="select-filter-type"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="improvement">Amélioration</SelectItem>
                  <SelectItem value="idea">Idée</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="pain_point">Point de douleur</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterImportance} onValueChange={setFilterImportance}>
                <SelectTrigger className="h-7 text-xs w-36" data-testid="select-filter-importance"><SelectValue placeholder="Importance" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes importances</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                  <SelectItem value="high">Élevé</SelectItem>
                  <SelectItem value="medium">Moyen</SelectItem>
                  <SelectItem value="low">Faible</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="h-7 text-xs w-36" data-testid="select-filter-source"><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes sources</SelectItem>
                  <SelectItem value="manual">Manuel</SelectItem>
                  <SelectItem value="external_feedback_page">Lien public</SelectItem>
                  <SelectItem value="client_call">Appel client</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="sales">Commercial</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => { setFilterType("all"); setFilterImportance("all"); setFilterStatus("all"); setFilterSource("all"); setSearchText(""); }} data-testid="button-clear-filters">
                  <X className="w-3 h-3" />Effacer
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {feedbacks.filter((fb) => showArchived ? fb.internalStatus === "archived" : fb.internalStatus !== "archived").length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">Aucun feedback pour le moment</p>
                <p className="text-xs text-muted-foreground mb-4">Ajoutez des retours manuellement ou partagez le lien public pour alimenter votre backlog avec des signaux terrain.</p>
                <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1.5" data-testid="button-add-feedback-empty">
                  <Plus className="w-3.5 h-3.5" />Ajouter un feedback
                </Button>
              </div>
            ) : filteredFeedbacks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-8">Aucun feedback ne correspond aux filtres.</p>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Titre</th>
                      <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Type</th>
                      <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Signal</th>
                      <th className="px-3 py-2 text-left font-medium">Statut</th>
                      <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Contributeur</th>
                      <th className="px-3 py-2 text-left font-medium hidden xl:table-cell">Ticket lié</th>
                      <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Date</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFeedbacks.map((fb) => (
                      <tr key={fb.id} className="hover-elevate cursor-pointer" onClick={() => openFeedback(fb)} data-testid={`feedback-row-${fb.id}`}>
                        <td className="px-3 py-2.5 font-medium text-foreground max-w-[180px]">
                          <span className="truncate block">{fb.title}</span>
                        </td>
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[fb.type] ?? ""}`}>{TYPE_LABELS[fb.type] ?? fb.type}</Badge>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell"><ScoreBadge feedback={fb} /></td>
                        <td className="px-3 py-2.5"><StatusBadge status={fb.internalStatus} /></td>
                        <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground">{fb.contributorName}</td>
                        <td className="px-3 py-2.5 hidden xl:table-cell">
                          {fb.linkedTicketTitle ? (
                            <span className="text-violet-600 dark:text-violet-400 flex items-center gap-1">
                              <Ticket className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[120px] block">{fb.linkedTicketTitle}</span>
                            </span>
                          ) : <span className="text-[10px] text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground">
                          {new Date(fb.createdAt).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`button-feedback-menu-${fb.id}`}><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openFeedback(fb)}>Voir le détail</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {["new", "to_qualify", "qualified", "rejected"].map((s) => (
                                <DropdownMenuItem key={s} disabled={fb.internalStatus === s} onClick={() => updateStatusMutation.mutate({ id: fb.id, internalStatus: s })}>
                                  {fb.internalStatus === s && <Check className="w-3 h-3 mr-1.5" />}{STATUS_LABELS[s]}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: fb.id, internalStatus: "archived" })}>
                                <Archive className="w-3.5 h-3.5 mr-1.5" />Archiver
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteFeedbackMutation.mutate(fb.id)}>
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Insights view ── */}
      {activeView === "insights" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">À qualifier</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{insights.toQualifyCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Liés à un ticket</p>
              <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{insights.linkedCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Récurrents</p>
              <p className="text-2xl font-bold text-primary">{insights.recurringCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Bugs critiques</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{insights.criticalBugsCount}</p>
            </CardContent></Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Top signaux</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {insights.topByScore.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Qualifiez des feedbacks pour voir leurs signaux.</p>
                ) : (
                  <div className="space-y-2">
                    {insights.topByScore.map((fb, i) => {
                      const info = getScoreInfo(fb._score);
                      return (
                        <div key={fb.id} className="flex items-start gap-2 cursor-pointer hover-elevate rounded-md p-1.5" onClick={() => { setActiveView("inbox"); openFeedback(fb); }} data-testid={`insight-top-${i}`}>
                          <span className="text-xs text-muted-foreground w-4 shrink-0 mt-0.5">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{fb.title}</p>
                            <p className="text-[10px] text-muted-foreground">{fb.contributorName}</p>
                          </div>
                          {info && <Badge variant="outline" className={`text-[10px] shrink-0 ${info.cls}`}>{fb._score}</Badge>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Ticket className="w-4 h-4 text-primary" />Tickets les plus soutenus</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {insights.topTickets.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucun feedback lié à un ticket pour le moment.</p>
                ) : (
                  <div className="space-y-2">
                    {insights.topTickets.map((t) => (
                      <div key={t.id} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{t.title}</p></div>
                        <Badge variant="outline" className="text-[10px] text-violet-600 border-violet-400 shrink-0">{t.count} feedback{t.count > 1 ? "s" : ""}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Tag className="w-4 h-4 text-primary" />Zones produit</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {insights.productAreas.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Renseignez la zone produit lors de la qualification.</p>
                ) : (
                  <div className="space-y-2">
                    {insights.productAreas.map(({ area, count }) => (
                      <div key={area} className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs">{area}</span>
                            <span className="text-xs text-muted-foreground">{count}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${(count / (insights.productAreas[0]?.count ?? 1)) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-primary" />Répartition par type</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {Object.keys(insights.byType).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucun feedback.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(insights.byType).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                      <div key={type} className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${TYPE_COLORS[type] ?? ""}`}>{TYPE_LABELS[type] ?? type}</Badge>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(count / (nonArchivedCount || 1)) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-4 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Feedback detail drawer ── */}
      <Sheet open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          {selectedFeedback && (
            <>
              <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
                <SheetTitle className="text-sm font-heading leading-snug line-clamp-2">{selectedFeedback.title}</SheetTitle>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[selectedFeedback.type] ?? ""}`}>{TYPE_LABELS[selectedFeedback.type] ?? selectedFeedback.type}</Badge>
                  <StatusBadge status={selectedFeedback.internalStatus} />
                  <ScoreBadge feedback={selectedFeedback} />
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto">
                {/* Section 1: Original */}
                <div className="px-5 py-4 space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Feedback original</p>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selectedFeedback.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><p className="text-muted-foreground text-[10px]">Contributeur</p><p className="font-medium">{selectedFeedback.contributorName}</p></div>
                    {selectedFeedback.contributorEmail && <div><p className="text-muted-foreground text-[10px]">Email</p><p className="font-medium">{selectedFeedback.contributorEmail}</p></div>}
                    <div><p className="text-muted-foreground text-[10px]">Source</p><p className="font-medium">{SOURCE_LABELS[selectedFeedback.source] ?? selectedFeedback.source}</p></div>
                    <div><p className="text-muted-foreground text-[10px]">Date</p><p className="font-medium">{new Date(selectedFeedback.createdAt).toLocaleDateString("fr-FR")}</p></div>
                    <div><p className="text-muted-foreground text-[10px]">Importance initiale</p>
                      <Badge variant="outline" className={`text-[10px] mt-0.5 ${selectedFeedback.importance === "critical" ? "text-red-600 border-red-400" : selectedFeedback.importance === "high" ? "text-orange-600 border-orange-400" : ""}`}>{IMPORTANCE_LABELS[selectedFeedback.importance] ?? selectedFeedback.importance}</Badge>
                    </div>
                  </div>
                </div>
                <Separator />

                {/* Section 2: Qualification */}
                <div className="px-5 py-4 space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Qualification</p>
                  <Form {...qualifForm}>
                    <form id="qualif-form" onSubmit={qualifForm.handleSubmit((data) => saveQualifMutation.mutate({ id: selectedFeedback.id, data }))} className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <FormField control={qualifForm.control} name="impactUser" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] text-muted-foreground">Impact utilisateur</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl><SelectTrigger className="h-7 text-xs" data-testid="select-impact-user"><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                              <SelectContent><SelectItem value="">—</SelectItem><SelectItem value="low">Faible</SelectItem><SelectItem value="medium">Moyen</SelectItem><SelectItem value="high">Élevé</SelectItem></SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={qualifForm.control} name="frequency" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] text-muted-foreground">Fréquence</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl><SelectTrigger className="h-7 text-xs" data-testid="select-frequency"><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                              <SelectContent><SelectItem value="">—</SelectItem><SelectItem value="isolated">Isolé</SelectItem><SelectItem value="recurring">Récurrent</SelectItem></SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={qualifForm.control} name="urgency" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] text-muted-foreground">Urgence</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl><SelectTrigger className="h-7 text-xs" data-testid="select-urgency"><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                              <SelectContent><SelectItem value="">—</SelectItem><SelectItem value="low">Faible</SelectItem><SelectItem value="medium">Moyen</SelectItem><SelectItem value="high">Élevé</SelectItem></SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <FormField control={qualifForm.control} name="segment" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] text-muted-foreground">Segment</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl><SelectTrigger className="h-7 text-xs" data-testid="select-segment"><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="">—</SelectItem><SelectItem value="freelance">Freelance</SelectItem>
                                <SelectItem value="agency">Agence</SelectItem><SelectItem value="client">Client</SelectItem>
                                <SelectItem value="internal">Interne</SelectItem><SelectItem value="other">Autre</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={qualifForm.control} name="productArea" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] text-muted-foreground">Zone produit</FormLabel>
                            <FormControl><Input placeholder="Ex : Onboarding" className="h-7 text-xs" data-testid="input-product-area" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={qualifForm.control} name="tagsRaw" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] text-muted-foreground">Tags (séparés par une virgule)</FormLabel>
                          <FormControl><Input placeholder="mobile, performance, UX" className="h-7 text-xs" data-testid="input-tags" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={qualifForm.control} name="qualificationNotes" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] text-muted-foreground">Notes internes</FormLabel>
                          <FormControl><Textarea placeholder="Notes de qualification..." className="text-xs min-h-[60px] resize-none" data-testid="textarea-qualification-notes" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={qualifForm.control} name="internalStatus" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] text-muted-foreground">Statut</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-7 text-xs" data-testid="select-internal-status"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="new">Nouveau</SelectItem><SelectItem value="to_qualify">À qualifier</SelectItem>
                              <SelectItem value="qualified">Qualifié</SelectItem><SelectItem value="linked_to_ticket">Lié à un ticket</SelectItem>
                              <SelectItem value="rejected">Rejeté</SelectItem><SelectItem value="archived">Archivé</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <Button type="submit" size="sm" className="w-full gap-1.5" disabled={saveQualifMutation.isPending} data-testid="button-save-qualification">
                        {saveQualifMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Sauvegarder la qualification
                      </Button>
                    </form>
                  </Form>
                </div>
                <Separator />

                {/* Section 3: Liaison ticket */}
                <div className="px-5 py-4 space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Liaison backlog</p>
                  {selectedFeedback.linkedTicketId && selectedFeedback.linkedTicketTitle ? (
                    <div className="rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-3">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-violet-700 dark:text-violet-300 truncate">{selectedFeedback.linkedTicketTitle}</p>
                          {selectedFeedback.linkedTicketState && <p className="text-[10px] text-muted-foreground">{selectedFeedback.linkedTicketState}</p>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Aucun ticket lié.</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={openCreateTicket} data-testid="button-create-ticket">
                      <Plus className="w-3.5 h-3.5" />Créer un ticket
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={() => { setIsLinkTicketOpen(true); setTicketSearch(""); setSelectedTicketId(null); }} data-testid="button-link-ticket">
                      <Link2 className="w-3.5 h-3.5" />Lier un ticket existant
                    </Button>
                  </div>
                </div>
                <Separator />

                {/* Section 4: Actions */}
                <div className="px-5 py-4 space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => updateStatusMutation.mutate({ id: selectedFeedback.id, internalStatus: "archived" })} disabled={selectedFeedback.internalStatus === "archived"} data-testid="button-archive-feedback">
                      <Archive className="w-3.5 h-3.5" />Archiver
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => updateStatusMutation.mutate({ id: selectedFeedback.id, internalStatus: "rejected" })} disabled={selectedFeedback.internalStatus === "rejected"} data-testid="button-reject-feedback">
                      <ThumbsDown className="w-3.5 h-3.5" />Rejeter
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30" onClick={() => deleteFeedbackMutation.mutate(selectedFeedback.id)} disabled={deleteFeedbackMutation.isPending} data-testid="button-delete-feedback">
                      <Trash2 className="w-3.5 h-3.5" />Supprimer
                    </Button>
                  </div>
                </div>

                {/* Feedbacks similaires */}
                {(() => {
                  const similar = feedbacks.filter((fb) =>
                    fb.id !== selectedFeedback.id &&
                    fb.internalStatus !== "archived" &&
                    (fb.type === selectedFeedback.type || (fb.productArea && fb.productArea === selectedFeedback.productArea))
                  ).slice(0, 3);
                  if (!similar.length) return null;
                  return (
                    <>
                      <Separator />
                      <div className="px-5 py-4 space-y-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Feedbacks similaires</p>
                        {similar.map((fb) => (
                          <div key={fb.id} className="flex items-start gap-2 cursor-pointer hover-elevate rounded-md p-2" onClick={() => openFeedback(fb)}>
                            <Badge variant="outline" className={`text-[10px] shrink-0 mt-0.5 ${TYPE_COLORS[fb.type] ?? ""}`}>{TYPE_LABELS[fb.type] ?? fb.type}</Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{fb.title}</p>
                              <p className="text-[10px] text-muted-foreground">{fb.contributorName}</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Add feedback sheet ── */}
      <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
            <SheetTitle className="text-sm font-heading">Ajouter un feedback</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <Form {...addForm}>
              <form id="add-feedback-form" onSubmit={addForm.handleSubmit((v) => addFeedbackMutation.mutate(v))} className="space-y-4">
                <FormField control={addForm.control} name="contributorName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Nom du contributeur *</FormLabel>
                    <FormControl><Input placeholder="Marie Dupont" className="text-sm" data-testid="input-contributor-name" {...field} /></FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="contributorEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Email (optionnel)</FormLabel>
                    <FormControl><Input type="email" placeholder="marie@example.com" className="text-sm" data-testid="input-contributor-email" {...field} /></FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={addForm.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="text-xs" data-testid="select-feedback-type"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="bug">Bug</SelectItem><SelectItem value="improvement">Amélioration</SelectItem>
                          <SelectItem value="idea">Idée</SelectItem><SelectItem value="question">Question</SelectItem>
                          <SelectItem value="pain_point">Point de douleur</SelectItem><SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="importance" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Importance</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="text-xs" data-testid="select-feedback-importance"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="critical">Critique</SelectItem><SelectItem value="high">Élevé</SelectItem>
                          <SelectItem value="medium">Moyen</SelectItem><SelectItem value="low">Faible</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <FormField control={addForm.control} name="source" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Source</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="text-xs" data-testid="select-feedback-source"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manuel (interne)</SelectItem><SelectItem value="client_call">Appel client</SelectItem>
                        <SelectItem value="support">Support</SelectItem><SelectItem value="sales">Commercial</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Titre *</FormLabel>
                    <FormControl><Input placeholder="Résumé en une ligne" className="text-sm" data-testid="input-feedback-title" {...field} /></FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Description *</FormLabel>
                    <FormControl><Textarea placeholder="Décrivez le retour en détail..." className="text-sm min-h-[100px] resize-none" data-testid="textarea-feedback-description" {...field} /></FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </form>
            </Form>
          </div>
          <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)} className="flex-1">Annuler</Button>
            <Button size="sm" form="add-feedback-form" type="submit" disabled={addFeedbackMutation.isPending} className="flex-1" data-testid="button-submit-add-feedback">
              {addFeedbackMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Ajouter"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Create ticket dialog ── */}
      <Dialog open={isCreateTicketOpen} onOpenChange={setIsCreateTicketOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-sm font-heading">Créer un ticket depuis ce feedback</DialogTitle></DialogHeader>
          <Form {...createTicketForm}>
            <form id="create-ticket-form" onSubmit={createTicketForm.handleSubmit((data) => selectedFeedback && createTicketMutation.mutate({ id: selectedFeedback.id, data }))} className="space-y-3">
              <FormField control={createTicketForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Titre du ticket *</FormLabel>
                  <FormControl><Input className="text-sm" data-testid="input-ticket-title" {...field} /></FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
              <FormField control={createTicketForm.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Priorité</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="text-xs" data-testid="select-ticket-priority"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="critical">Critique</SelectItem><SelectItem value="high">Élevé</SelectItem>
                      <SelectItem value="medium">Moyen</SelectItem><SelectItem value="low">Faible</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={createTicketForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Description (pré-remplie depuis le feedback)</FormLabel>
                  <FormControl><Textarea className="text-xs min-h-[160px] resize-none font-mono" data-testid="textarea-ticket-description" {...field} /></FormControl>
                </FormItem>
              )} />
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCreateTicketOpen(false)}>Annuler</Button>
            <Button size="sm" form="create-ticket-form" type="submit" disabled={createTicketMutation.isPending} data-testid="button-confirm-create-ticket">
              {createTicketMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />}Créer le ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Link existing ticket dialog ── */}
      <Dialog open={isLinkTicketOpen} onOpenChange={setIsLinkTicketOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm font-heading">Lier à un ticket existant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input placeholder="Rechercher un ticket..." className="pl-8 text-xs" value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)} data-testid="input-ticket-search" />
            </div>
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {storiesLoading ? (
                <div className="p-4 text-center"><RefreshCw className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></div>
              ) : (
                <div className="divide-y divide-border">
                  {userStories
                    .filter((us) => !ticketSearch || us.title.toLowerCase().includes(ticketSearch.toLowerCase()))
                    .slice(0, 20)
                    .map((us) => (
                      <div
                        key={us.id}
                        className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover-elevate ${selectedTicketId === us.id ? "bg-primary/10" : ""}`}
                        onClick={() => setSelectedTicketId(us.id)}
                        data-testid={`ticket-option-${us.id}`}
                      >
                        {selectedTicketId === us.id && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{us.title}</p>
                          <p className="text-[10px] text-muted-foreground">{us.state?.replace(/_/g, " ") ?? "—"}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">{us.priority ?? "medium"}</Badge>
                      </div>
                    ))}
                  {userStories.filter((us) => !ticketSearch || us.title.toLowerCase().includes(ticketSearch.toLowerCase())).length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground">Aucun ticket trouvé.</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsLinkTicketOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={!selectedTicketId || linkTicketMutation.isPending}
              onClick={() => selectedFeedback && selectedTicketId && linkTicketMutation.mutate({ feedbackId: selectedFeedback.id, ticketId: selectedTicketId })}
              data-testid="button-confirm-link-ticket"
            >
              {linkTicketMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />}Lier le ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
