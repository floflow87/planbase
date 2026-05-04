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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { apiRequest } from "@/lib/queryClient";
import {
  MessageSquare, Copy, ExternalLink, Link2, Plus, Check, Trash2,
  MoreHorizontal, Zap, BarChart2, Search, Archive, ThumbsDown,
  Ticket, Tag, RefreshCw, ChevronRight, TrendingUp, Filter, X,
  Sparkles, Brain, Layers, AlertTriangle, CheckCircle2,
  GitMerge, ChevronDown, ChevronUp, Minus,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// ── Types ────────────────────────────────────────────────────────────────────

interface FeedbackSettings {
  id: string; backlogId: string; shareToken: string;
  isEnabled: boolean; showExistingFeedbacks: boolean; allowAttachments: boolean;
}

interface FeedbackV3 {
  id: string;
  contributorName: string; contributorEmail: string | null;
  type: string; title: string; description: string;
  importance: string; internalStatus: string; publicStatus: string; source: string;
  impactUser: string | null; frequency: string | null; urgency: string | null;
  segment: string | null; productArea: string | null; tags: string[] | null;
  qualificationNotes: string | null; score: number | null;
  linkedTicketId: string | null; linkedTicketTitle: string | null; linkedTicketState: string | null;
  // V3 AI fields
  aiSummary: string | null; aiDetectedProblem: string | null; aiDetectedNeed: string | null;
  aiSentiment: string | null; aiUrgency: string | null; aiProductArea: string | null;
  aiKeywords: string[] | null; aiSuggestedTags: string[] | null;
  aiConfidenceScore: number | null; analyzedAt: string | null;
  createdAt: string; archivedAt: string | null;
}

interface FeedbackCluster {
  id: string; backlogId: string; title: string; description: string | null;
  detectedProblem: string | null; detectedNeed: string | null;
  productArea: string | null; sentiment: string | null; impactLevel: string | null;
  frequencyCount: number; priorityScore: number | null;
  scoreLabel: string | null; scoreReason: string | null;
  linkedTicketId: string | null; linkedTicketTitle: string | null;
  linkedEpicId: string | null; linkedEpicTitle: string | null;
  linkedRoadmapItemId: string | null; status: string;
  confidenceScore: number | null; feedbackCount: number;
  items: ClusterItem[];
  archivedAt: string | null; createdAt: string; updatedAt: string;
}

interface ClusterItem {
  feedbackId: string; feedbackTitle: string; type: string; importance: string;
  internalStatus: string; contributorName: string; description?: string;
  feedbackCreatedAt?: string; similarityScore: number | null;
}

interface UserStoryItem {
  id: string; title: string; state: string; priority: string;
}

interface AiAnalysis {
  summary: string; detectedProblem: string; detectedNeed: string;
  sentiment: string; urgency: string; productArea: string;
  keywords: string[]; suggestedTags: string[]; confidenceScore: number;
}

interface AddFeedbackResponse {
  id: string; title: string; type: string; importance: string;
  internal_status: string; created_at: string;
  suggestedClusterId: string | null;
  suggestedClusterTitle: string | null;
  similarCount: number;
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
const CLUSTER_STATUS_LABELS: Record<string, string> = {
  suggested: "Suggéré", validated: "Validé", linked: "Relié", dismissed: "Ignoré", archived: "Archivé",
};
const CLUSTER_STATUS_BADGE: Record<string, string> = {
  suggested: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  validated: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  linked: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  dismissed: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted text-muted-foreground border-border",
};
const SENTIMENT_LABELS: Record<string, string> = {
  positive: "Positif", neutral: "Neutre", frustrated: "Frustré", angry: "Mécontent", confused: "Confus",
};
const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-muted-foreground",
  frustrated: "text-orange-600 dark:text-orange-400",
  angry: "text-red-600 dark:text-red-400",
  confused: "text-amber-600 dark:text-amber-400",
};

// ── Score utils ───────────────────────────────────────────────────────────────

const IMPACT_SCORE: Record<string, number> = { low: 1, medium: 2, high: 3 };
const FREQ_SCORE: Record<string, number> = { isolated: 1, recurring: 3 };
const URGENCY_SCORE: Record<string, number> = { low: 1, medium: 2, high: 3 };
const IMPORTANCE_SCORE: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

function calcScore(fb: FeedbackV3): number {
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

function calcClusterPriorityLabel(count: number, impactLevel: string | null): { label: string; cls: string } {
  const impact = { critical: 4, high: 3, medium: 2, low: 1 }[impactLevel ?? ""] ?? 1;
  const score = count * impact;
  if (score >= 12 || (count >= 5 && impact >= 3)) return { label: "Signal critique", cls: "text-red-700 border-red-400 dark:text-red-400" };
  if (score >= 6 || count >= 3) return { label: "Signal fort", cls: "text-violet-700 border-violet-500 dark:text-violet-400" };
  if (score >= 3) return { label: "Signal moyen", cls: "text-amber-700 border-amber-500 dark:text-amber-400" };
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
  impactUser: z.string().optional(), frequency: z.string().optional(),
  urgency: z.string().optional(), segment: z.string().optional(),
  productArea: z.string().optional(), tagsRaw: z.string().optional(),
  qualificationNotes: z.string().optional(), internalStatus: z.string(),
});

const createTicketSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
});

const createClusterSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  detectedProblem: z.string().optional(),
  detectedNeed: z.string().optional(),
  productArea: z.string().optional(),
  sentiment: z.string().optional(),
  impactLevel: z.string().optional(),
});

const createFromClusterSchema = z.object({
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

function ClusterStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${CLUSTER_STATUS_BADGE[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {CLUSTER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ScoreBadge({ feedback }: { feedback: FeedbackV3 }) {
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

  // View state
  const [activeView, setActiveView] = useState<"inbox" | "clusters" | "insights">("inbox");

  // Feedback drawer state
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackV3 | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAiSection, setShowAiSection] = useState(false);

  // Cluster state
  const [selectedCluster, setSelectedCluster] = useState<FeedbackCluster | null>(null);
  const [isGeneratingClusters, setIsGeneratingClusters] = useState(false);

  // Dialog/sheet state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [isLinkTicketOpen, setIsLinkTicketOpen] = useState(false);
  const [isCreateClusterOpen, setIsCreateClusterOpen] = useState(false);
  const [isCreateFromClusterOpen, setIsCreateFromClusterOpen] = useState(false);
  const [createFromClusterMode, setCreateFromClusterMode] = useState<"ticket" | "epic">("ticket");
  const [isLinkTicketToClusterOpen, setIsLinkTicketToClusterOpen] = useState(false);
  const [isAddToClusterOpen, setIsAddToClusterOpen] = useState(false);
  const [clusterSearchForFeedback, setClusterSearchForFeedback] = useState("");
  const [selectedClusterIdForFeedback, setSelectedClusterIdForFeedback] = useState<string | null>(null);

  // Filters
  const [showArchived, setShowArchived] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterImportance, setFilterImportance] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterCluster, setFilterCluster] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [clusterTicketSearch, setClusterTicketSearch] = useState("");
  const [selectedClusterTicketId, setSelectedClusterTicketId] = useState<string | null>(null);

  // ── Queries ──
  const { data: feedbacks = [], isLoading: feedbacksLoading } = useQuery<FeedbackV3[]>({
    queryKey: [`/api/backlogs/${backlogId}/feedbacks`],
  });
  const { data: settings, isLoading: settingsLoading } = useQuery<FeedbackSettings>({
    queryKey: [`/api/backlogs/${backlogId}/feedback-settings`],
  });
  const { data: userStories = [], isLoading: storiesLoading } = useQuery<UserStoryItem[]>({
    queryKey: [`/api/backlogs/${backlogId}/user-stories`],
    enabled: isLinkTicketOpen || isLinkTicketToClusterOpen,
  });
  const { data: clusters = [], isLoading: clustersLoading, refetch: refetchClusters } = useQuery<FeedbackCluster[]>({
    queryKey: [`/api/backlogs/${backlogId}/feedback-clusters`],
    enabled: activeView === "inbox" || activeView === "clusters" || activeView === "insights" || isAddToClusterOpen,
  });
  const { data: similarFeedbacks = [] } = useQuery<(FeedbackV3 & { similarityScore: number })[]>({
    queryKey: [`/api/backlogs/${backlogId}/feedbacks/${selectedFeedback?.id}/similar`],
    enabled: !!selectedFeedback?.id && showAiSection,
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
  const createClusterForm = useForm<z.infer<typeof createClusterSchema>>({
    resolver: zodResolver(createClusterSchema),
    defaultValues: { title: "", description: "", detectedProblem: "", detectedNeed: "", productArea: "", sentiment: "", impactLevel: "" },
  });
  const createFromClusterForm = useForm<z.infer<typeof createFromClusterSchema>>({
    resolver: zodResolver(createFromClusterSchema),
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
    mutationFn: async (data: z.infer<typeof addFeedbackSchema>): Promise<AddFeedbackResponse> => {
      const res = await apiRequest(`/api/backlogs/${backlogId}/feedbacks`, "POST", data);
      return res.json();
    },
    onSuccess: (result: AddFeedbackResponse) => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      setIsAddOpen(false); addForm.reset();
      if (result.suggestedClusterId && result.suggestedClusterTitle) {
        const clusterId = result.suggestedClusterId;
        const clusterTitle = result.suggestedClusterTitle;
        const feedbackId = result.id;
        const count = result.similarCount;
        toast({
          title: "Feedback ajouté",
          description: `Ce feedback ressemble à ${count} autre${count > 1 ? "s" : ""} dans le cluster « ${clusterTitle} »`,
          action: (
            <div className="flex flex-col gap-1.5 shrink-0">
              <ToastAction
                altText="Ajouter au cluster"
                data-testid="button-add-to-cluster-toast"
                onClick={async () => {
                  try {
                    await apiRequest(
                      `/api/backlogs/${backlogId}/feedback-clusters/${clusterId}/add-feedback`,
                      "POST",
                      { feedbackId }
                    );
                    qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedback-clusters`] });
                    toast({ title: "Ajouté au cluster", description: `Feedback ajouté au cluster « ${clusterTitle} »` });
                  } catch {
                    toast({ title: "Erreur", description: "Impossible d'ajouter au cluster", variant: "destructive" });
                  }
                }}
              >
                Ajouter au cluster
              </ToastAction>
              <ToastAction
                altText="Voir le cluster"
                data-testid="button-view-cluster-toast"
                onClick={async () => {
                  setActiveView("clusters");
                  const refreshed = await refetchClusters();
                  const found = (refreshed.data ?? []).find((c) => c.id === clusterId);
                  if (found) setSelectedCluster(found);
                }}
              >
                Voir le cluster
              </ToastAction>
            </div>
          ) as any,
        });
      } else {
        toast({ title: "Feedback ajouté" });
      }
    },
    onError: () => toast({ title: "Erreur", description: "Impossible d'ajouter le feedback", variant: "destructive" }),
  });

  const saveQualifMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: z.infer<typeof qualifSchema> }) => {
      const tags = data.tagsRaw ? data.tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
      return apiRequest(`/api/backlogs/${backlogId}/feedbacks/${id}`, "PATCH", {
        impactUser: data.impactUser || null, frequency: data.frequency || null,
        urgency: data.urgency || null, segment: data.segment || null,
        productArea: data.productArea || null, tags,
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

  const applyAiSuggestionsMutation = useMutation({
    mutationFn: ({ id, analysis }: { id: string; analysis: AiAnalysis }) =>
      apiRequest(`/api/backlogs/${backlogId}/feedbacks/${id}/apply-ai-suggestions`, "POST", analysis),
    onSuccess: (updated: any) => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      setSelectedFeedback((prev) => prev ? { ...prev, ...updated } : null);
      // Prefill qualification form with AI suggestions
      qualifForm.setValue("productArea", updated.aiProductArea ?? qualifForm.getValues("productArea"));
      if (updated.aiSuggestedTags?.length) {
        qualifForm.setValue("tagsRaw", updated.aiSuggestedTags.join(", "));
      }
      toast({ title: "Suggestions IA appliquées", description: "La zone produit et les tags ont été mis à jour." });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
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
      setIsCreateTicketOpen(false); createTicketForm.reset();
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
      setIsLinkTicketOpen(false); setSelectedTicketId(null); setTicketSearch("");
      setSelectedFeedback((prev) => prev ? { ...prev, internalStatus: "linked_to_ticket", linkedTicketId: result.ticketId, linkedTicketTitle: result.ticketTitle } : null);
      toast({ title: "Ticket lié avec succès" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de lier le ticket", variant: "destructive" }),
  });

  const deleteFeedbackMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/backlogs/${backlogId}/feedbacks/${id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      setSelectedFeedback(null); toast({ title: "Feedback supprimé" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const addFeedbackToClusterMutation = useMutation({
    mutationFn: ({ clusterId, feedbackId }: { clusterId: string; feedbackId: string }) =>
      apiRequest(`/api/backlogs/${backlogId}/feedback-clusters/${clusterId}/add-feedback`, "POST", { feedbackId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedback-clusters`] });
      setIsAddToClusterOpen(false);
      setSelectedClusterIdForFeedback(null);
      setClusterSearchForFeedback("");
      toast({ title: "Feedback ajouté au cluster" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible d'ajouter au cluster", variant: "destructive" }),
  });

  // Cluster mutations
  const createClusterMutation = useMutation({
    mutationFn: (data: z.infer<typeof createClusterSchema>) =>
      apiRequest(`/api/backlogs/${backlogId}/feedback-clusters`, "POST", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedback-clusters`] });
      setIsCreateClusterOpen(false); createClusterForm.reset();
      toast({ title: "Cluster créé" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de créer le cluster", variant: "destructive" }),
  });

  const updateClusterMutation = useMutation({
    mutationFn: ({ clusterId, patch }: { clusterId: string; patch: any }) =>
      apiRequest(`/api/backlogs/${backlogId}/feedback-clusters/${clusterId}`, "PATCH", patch),
    onSuccess: (updated: any) => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedback-clusters`] });
      setSelectedCluster((prev) => prev ? { ...prev, ...updated } : null);
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const removeFeedbackFromClusterMutation = useMutation({
    mutationFn: ({ clusterId, feedbackId }: { clusterId: string; feedbackId: string }) =>
      apiRequest(`/api/backlogs/${backlogId}/feedback-clusters/${clusterId}/remove-feedback`, "POST", { feedbackId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedback-clusters`] });
      if (selectedCluster) {
        setSelectedCluster((prev) => prev ? { ...prev, items: prev.items.filter((i) => i.feedbackId !== removeFeedbackFromClusterMutation.variables?.feedbackId), feedbackCount: prev.feedbackCount - 1 } : null);
      }
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const createFromClusterMutation = useMutation({
    mutationFn: ({ clusterId, mode, data }: { clusterId: string; mode: "ticket" | "epic"; data: z.infer<typeof createFromClusterSchema> }) => {
      const endpoint = mode === "ticket"
        ? `/api/backlogs/${backlogId}/feedback-clusters/${clusterId}/create-ticket`
        : `/api/backlogs/${backlogId}/feedback-clusters/${clusterId}/create-epic`;
      return apiRequest(endpoint, "POST", data);
    },
    onSuccess: (result: any, vars) => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedback-clusters`] });
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      if (vars.mode === "ticket") qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/user-stories`] });
      setIsCreateFromClusterOpen(false); createFromClusterForm.reset();
      setSelectedCluster((prev) => prev ? { ...prev, status: "linked" } : null);
      toast({ title: vars.mode === "ticket" ? "Ticket créé depuis le cluster" : "Epic créée depuis le cluster" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const linkTicketToClusterMutation = useMutation({
    mutationFn: ({ clusterId, ticketId }: { clusterId: string; ticketId: string }) =>
      apiRequest(`/api/backlogs/${backlogId}/feedback-clusters/${clusterId}/link-ticket`, "POST", { ticketId }),
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedback-clusters`] });
      setIsLinkTicketToClusterOpen(false); setSelectedClusterTicketId(null); setClusterTicketSearch("");
      setSelectedCluster((prev) => prev ? { ...prev, linkedTicketId: result.ticketId, linkedTicketTitle: result.ticketTitle, status: "linked" } : null);
      toast({ title: "Ticket lié au cluster" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  // ── Handlers ──

  const openFeedback = (fb: FeedbackV3) => {
    setSelectedFeedback(fb);
    setAiAnalysis(null);
    setShowAiSection(!!fb.analyzedAt);
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

  const handleAnalyzeFeedback = async () => {
    if (!selectedFeedback) return;
    setIsAnalyzing(true);
    setShowAiSection(true);
    try {
      const result = await apiRequest(`/api/backlogs/${backlogId}/feedbacks/${selectedFeedback.id}/analyze`, "POST", {}) as AiAnalysis;
      setAiAnalysis(result);
    } catch {
      toast({ title: "Erreur d'analyse", description: "Impossible d'analyser ce feedback avec l'IA.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openCreateTicket = (fromCluster?: FeedbackCluster) => {
    if (fromCluster) {
      const priorityMap: Record<string, "low" | "medium" | "high" | "critical"> = { critical: "critical", high: "high", medium: "medium", low: "low" };
      const feedbackVerbatims = fromCluster.items.slice(0, 3).map((i) => `- "${i.feedbackTitle}"`).join("\n");
      const desc = [
        `En tant qu'utilisateur,`,
        `je souhaite ${fromCluster.detectedNeed ?? fromCluster.title.toLowerCase()},`,
        `afin d'améliorer mon expérience.`,
        ``,
        `**Contexte :**`,
        `Ce ticket est issu d'un cluster de ${fromCluster.feedbackCount} feedbacks utilisateurs.`,
        ``,
        `**Problème observé :**`,
        fromCluster.detectedProblem ?? "(à compléter)",
        ``,
        `**Verbatims représentatifs :**`,
        feedbackVerbatims || "(aucun verbatim disponible)",
        ``,
        `**Zone produit :** ${fromCluster.productArea ?? "non renseignée"}`,
        `**Impact estimé :** ${fromCluster.impactLevel ? IMPORTANCE_LABELS[fromCluster.impactLevel] ?? fromCluster.impactLevel : "non renseigné"}`,
        ``,
        `**Critères d'acceptation :**`,
        `- [ ] À compléter`,
      ].join("\n");
      createFromClusterForm.reset({
        title: fromCluster.title,
        description: desc,
        priority: priorityMap[fromCluster.impactLevel ?? ""] ?? "medium",
      });
      setCreateFromClusterMode("ticket");
      setIsCreateFromClusterOpen(true);
      return;
    }
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
      `**Source :** Feedback reçu de ${selectedFeedback.contributorName} le ${new Date(selectedFeedback.createdAt).toLocaleDateString("fr-FR")}`,
      ``,
      `**Qualification :**`,
      `- Impact utilisateur : ${selectedFeedback.impactUser ? ({ low: "Faible", medium: "Moyen", high: "Élevé" }[selectedFeedback.impactUser] ?? selectedFeedback.impactUser) : "Non renseigné"}`,
      `- Fréquence : ${selectedFeedback.frequency ? ({ isolated: "Isolé", recurring: "Récurrent" }[selectedFeedback.frequency] ?? selectedFeedback.frequency) : "Non renseignée"}`,
      `- Urgence : ${selectedFeedback.urgency ? ({ low: "Faible", medium: "Moyen", high: "Élevé" }[selectedFeedback.urgency] ?? selectedFeedback.urgency) : "Non renseignée"}`,
      ``,
      `**Critères d'acceptation :**`,
      `- [ ] À compléter`,
    ].join("\n");
    const priorityMap: Record<string, "low" | "medium" | "high" | "critical"> = { critical: "critical", high: "high", medium: "medium", low: "low" };
    createTicketForm.reset({ title: selectedFeedback.title, description: desc, priority: priorityMap[selectedFeedback.importance] ?? "medium" });
    setIsCreateTicketOpen(true);
  };

  const openCreateEpicFromCluster = (cluster: FeedbackCluster) => {
    const feedbackSources = cluster.items.slice(0, 3).map((i) => `- "${i.feedbackTitle}"`).join("\n");
    const desc = [
      `**Problème :**`,
      cluster.detectedProblem ?? "(à compléter)",
      ``,
      `**Objectif :**`,
      cluster.detectedNeed ?? "(à compléter)",
      ``,
      `**User stories suggérées :**`,
      `1. En tant qu'utilisateur, je souhaite...`,
      `2. En tant qu'utilisateur, je souhaite...`,
      ``,
      `**Critères de succès :**`,
      `- Réduction du nombre de feedbacks similaires`,
      `- Amélioration du taux d'adoption`,
      ``,
      `**Sources :**`,
      `Cluster basé sur ${cluster.feedbackCount} feedbacks.`,
      feedbackSources,
    ].join("\n");
    const priorityMap: Record<string, "low" | "medium" | "high" | "critical"> = { critical: "critical", high: "high", medium: "medium", low: "low" };
    createFromClusterForm.reset({ title: cluster.title, description: desc, priority: priorityMap[cluster.impactLevel ?? ""] ?? "medium" });
    setCreateFromClusterMode("epic");
    setIsCreateFromClusterOpen(true);
  };

  const handleGenerateClusters = async () => {
    setIsGeneratingClusters(true);
    try {
      const result = await apiRequest(`/api/backlogs/${backlogId}/feedback-clusters/generate`, "POST", {}) as any;
      await refetchClusters();
      if (result.generated === 0) {
        toast({ title: "Aucun cluster généré", description: "Les feedbacks ne semblent pas former de groupes distincts." });
      } else {
        toast({ title: `${result.generated} cluster${result.generated > 1 ? "s" : ""} suggéré${result.generated > 1 ? "s" : ""}`, description: "Vous pouvez maintenant les valider ou les ignorer." });
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de générer des clusters.", variant: "destructive" });
    } finally {
      setIsGeneratingClusters(false);
    }
  };

  // ── Computed ──
  const filteredFeedbacks = useMemo(() => {
    const clusterFeedbackIds = filterCluster !== "all"
      ? new Set(clusters.find((c) => c.id === filterCluster)?.items.map((item) => item.feedbackId) ?? [])
      : null;
    return feedbacks.filter((fb) => {
      if (showArchived ? fb.internalStatus !== "archived" : fb.internalStatus === "archived") return false;
      if (filterType !== "all" && fb.type !== filterType) return false;
      if (filterImportance !== "all" && fb.importance !== filterImportance) return false;
      if (filterStatus !== "all" && fb.internalStatus !== filterStatus) return false;
      if (filterSource !== "all" && fb.source !== filterSource) return false;
      if (clusterFeedbackIds && !clusterFeedbackIds.has(fb.id)) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!fb.title.toLowerCase().includes(q) && !fb.description.toLowerCase().includes(q) && !fb.contributorName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [feedbacks, showArchived, filterType, filterImportance, filterStatus, filterSource, filterCluster, clusters, searchText]);

  const nonArchivedCount = feedbacks.filter((fb) => fb.internalStatus !== "archived").length;

  // Map feedbackId → cluster titles (active clusters only)
  const feedbackClusterMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    clusters
      .filter((c) => c.status !== "dismissed" && c.status !== "archived")
      .forEach((c) => {
        c.items.forEach((item) => {
          if (!map[item.feedbackId]) map[item.feedbackId] = [];
          map[item.feedbackId].push(c.title);
        });
      });
    return map;
  }, [clusters]);

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
    const topByScore = [...active].map((fb) => ({ ...fb, _score: calcScore(fb) })).filter((fb) => fb._score > 0).sort((a, b) => b._score - a._score).slice(0, 5);
    const productAreas = Object.entries(productAreaMap).sort(([, a], [, b]) => b - a).slice(0, 6).map(([area, count]) => ({ area, count }));
    const topTickets = Object.values(ticketMap).sort((a, b) => b.count - a.count).slice(0, 5);
    const toQualifyCount = (byStatus["new"] ?? 0) + (byStatus["to_qualify"] ?? 0) + (byStatus["to_review"] ?? 0);
    const linkedCount = (byStatus["linked_to_ticket"] ?? 0) + (byStatus["converted_to_ticket"] ?? 0);
    const recurringCount = active.filter((fb) => fb.frequency === "recurring").length;
    const criticalBugsCount = active.filter((fb) => fb.type === "bug" && fb.importance === "critical").length;
    const criticalWithoutTicket = active.filter((fb) => (fb.importance === "critical" || fb.urgency === "high") && !fb.linkedTicketId);
    const analyzedCount = active.filter((fb) => !!fb.analyzedAt).length;
    return { byStatus, byType, topByScore, productAreas, topTickets, toQualifyCount, linkedCount, recurringCount, criticalBugsCount, criticalWithoutTicket, analyzedCount };
  }, [feedbacks]);

  const strongClusters = useMemo(() => clusters.filter((c) => c.feedbackCount >= 3 && !c.linkedTicketId && c.status !== "dismissed"), [clusters]);

  const publicUrl = settings ? `${window.location.origin}/feedback/${settings.shareToken}` : null;
  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Lien copié !" });
  };

  const hasActiveFilters = filterType !== "all" || filterImportance !== "all" || filterStatus !== "all" || filterSource !== "all" || filterCluster !== "all" || searchText;

  if (settingsLoading || feedbacksLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  // Displayed AI analysis (either from fresh analysis or stored on feedback)
  const displayedAnalysis: Partial<AiAnalysis> | null = aiAnalysis ?? (selectedFeedback?.analyzedAt ? {
    summary: selectedFeedback.aiSummary ?? undefined,
    detectedProblem: selectedFeedback.aiDetectedProblem ?? undefined,
    detectedNeed: selectedFeedback.aiDetectedNeed ?? undefined,
    sentiment: selectedFeedback.aiSentiment ?? undefined,
    urgency: selectedFeedback.aiUrgency ?? undefined,
    productArea: selectedFeedback.aiProductArea ?? undefined,
    keywords: selectedFeedback.aiKeywords ?? undefined,
    suggestedTags: selectedFeedback.aiSuggestedTags ?? undefined,
    confidenceScore: selectedFeedback.aiConfidenceScore ?? undefined,
  } : null);

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold font-heading">Feedback Intelligence</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Centralisez, analysez et transformez vos retours terrain en décisions produit.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="inbox" className="text-xs gap-1.5" data-testid="tab-feedback-inbox">
                <MessageSquare className="w-3 h-3" />
                Inbox
                {nonArchivedCount > 0 && <span className="ml-0.5 bg-primary/10 text-primary text-[10px] font-medium px-1 rounded">{nonArchivedCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="clusters" className="text-xs gap-1.5" data-testid="tab-feedback-clusters">
                <Layers className="w-3 h-3" />
                Clusters
                {clusters.length > 0 && <span className="ml-0.5 bg-primary/10 text-primary text-[10px] font-medium px-1 rounded">{clusters.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="insights" className="text-xs gap-1.5" data-testid="tab-feedback-insights">
                <BarChart2 className="w-3 h-3" />
                Insights
              </TabsTrigger>
            </TabsList>
          </Tabs>
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

      {/* ═══════════════════════ INBOX VIEW ═══════════════════════ */}
      {activeView === "inbox" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 flex-wrap justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Filtres</span>
                {Object.keys(feedbackClusterMap).length > 0 && (
                  <Badge variant="outline" className="gap-1 text-[10px] text-cyan-600 dark:text-cyan-400 border-cyan-500/30" data-testid="badge-clustered-count">
                    <Layers className="w-2.5 h-2.5" />
                    {Object.keys(feedbackClusterMap).length} dans des clusters
                  </Badge>
                )}
              </div>
              <Button
                size="sm" variant={showArchived ? "default" : "outline"}
                onClick={() => { setShowArchived((v) => !v); setFilterStatus("all"); }}
                className="gap-1.5 text-xs" data-testid="button-toggle-archived"
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
              {clusters.filter((c) => c.status !== "dismissed" && c.status !== "archived").length > 0 && (
                <Select value={filterCluster} onValueChange={setFilterCluster}>
                  <SelectTrigger className="h-7 text-xs w-40" data-testid="select-filter-cluster"><SelectValue placeholder="Cluster" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les clusters</SelectItem>
                    {clusters
                      .filter((c) => c.status !== "dismissed" && c.status !== "archived")
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
              {hasActiveFilters && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1"
                  onClick={() => { setFilterType("all"); setFilterImportance("all"); setFilterStatus("all"); setFilterSource("all"); setFilterCluster("all"); setSearchText(""); }}
                  data-testid="button-clear-filters">
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
                <p className="text-xs text-muted-foreground mb-4">Ajoutez des retours manuellement ou partagez le lien public.</p>
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
                          <div className="flex items-center gap-1.5">
                            {fb.analyzedAt && <Brain className="w-3 h-3 text-violet-500 shrink-0" title="Analysé par l'IA" />}
                            {feedbackClusterMap[fb.id] && (
                              <Layers
                                className="w-3 h-3 text-cyan-500 shrink-0"
                                title={`Dans le cluster : ${feedbackClusterMap[fb.id].join(", ")}`}
                                data-testid={`icon-clustered-${fb.id}`}
                              />
                            )}
                            <span className="truncate block">{fb.title}</span>
                          </div>
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

      {/* ═══════════════════════ CLUSTERS VIEW ═══════════════════════ */}
      {activeView === "clusters" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Regroupez les feedbacks similaires en clusters pour identifier les signaux produit récurrents.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleGenerateClusters} disabled={isGeneratingClusters} className="gap-1.5" data-testid="button-generate-clusters">
                {isGeneratingClusters ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Générer avec l'IA
              </Button>
              <Button size="sm" onClick={() => { createClusterForm.reset(); setIsCreateClusterOpen(true); }} className="gap-1.5" data-testid="button-create-cluster">
                <Plus className="w-3.5 h-3.5" />Créer manuellement
              </Button>
            </div>
          </div>

          {clustersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
            </div>
          ) : clusters.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">Aucun cluster pour le moment</p>
                <p className="text-xs text-muted-foreground mb-4">Générez des clusters avec l'IA ou créez-en un manuellement.</p>
                <Button size="sm" onClick={handleGenerateClusters} disabled={isGeneratingClusters} className="gap-1.5" data-testid="button-generate-clusters-empty">
                  {isGeneratingClusters ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Générer avec l'IA
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Cluster</th>
                    <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Feedbacks</th>
                    <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Signal</th>
                    <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Zone produit</th>
                    <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Sentiment</th>
                    <th className="px-3 py-2 text-left font-medium">Statut</th>
                    <th className="px-3 py-2 text-left font-medium hidden xl:table-cell">Lié à</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clusters.map((cluster) => {
                    const priority = calcClusterPriorityLabel(cluster.feedbackCount, cluster.impactLevel);
                    return (
                      <tr key={cluster.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedCluster(cluster)} data-testid={`cluster-row-${cluster.id}`}>
                        <td className="px-3 py-2.5 font-medium text-foreground max-w-[200px]">
                          <span className="truncate block">{cluster.title}</span>
                          {cluster.description && <span className="text-[10px] text-muted-foreground truncate block">{cluster.description}</span>}
                        </td>
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          <Badge variant="outline" className="text-[10px]">{cluster.feedbackCount}</Badge>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <Badge variant="outline" className={`text-[10px] ${priority.cls}`}>{priority.label}</Badge>
                        </td>
                        <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground">
                          {cluster.productArea ?? <span className="text-[10px] italic">—</span>}
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          {cluster.sentiment ? (
                            <span className={`text-[10px] ${SENTIMENT_COLORS[cluster.sentiment] ?? ""}`}>
                              {SENTIMENT_LABELS[cluster.sentiment] ?? cluster.sentiment}
                            </span>
                          ) : <span className="text-[10px] text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5"><ClusterStatusBadge status={cluster.status} /></td>
                        <td className="px-3 py-2.5 hidden xl:table-cell">
                          {cluster.linkedTicketTitle ? (
                            <span className="text-violet-600 dark:text-violet-400 flex items-center gap-1">
                              <Ticket className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[100px] block">{cluster.linkedTicketTitle}</span>
                            </span>
                          ) : cluster.linkedEpicTitle ? (
                            <span className="text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                              <GitMerge className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[100px] block">{cluster.linkedEpicTitle}</span>
                            </span>
                          ) : <span className="text-[10px] text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`button-cluster-menu-${cluster.id}`}><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedCluster(cluster)}>Voir le détail</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setFilterCluster(cluster.id); setActiveView("inbox"); }} data-testid={`button-view-in-inbox-${cluster.id}`}>
                                <Filter className="w-3.5 h-3.5 mr-1.5" />Voir dans l'Inbox
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => updateClusterMutation.mutate({ clusterId: cluster.id, patch: { status: "validated" } })} disabled={cluster.status === "validated"}>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Valider
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateClusterMutation.mutate({ clusterId: cluster.id, patch: { status: "dismissed" } })} disabled={cluster.status === "dismissed"}>
                                <Minus className="w-3.5 h-3.5 mr-1.5" />Ignorer
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSelectedCluster(cluster); openCreateTicket(cluster); }}>
                                <Ticket className="w-3.5 h-3.5 mr-1.5" />Créer un ticket
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedCluster(cluster); openCreateEpicFromCluster(cluster); }}>
                                <GitMerge className="w-3.5 h-3.5 mr-1.5" />Créer une epic
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ INSIGHTS VIEW ═══════════════════════ */}
      {activeView === "insights" && (
        <div className="space-y-4">
          {/* KPI cards */}
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
              <p className="text-xs text-muted-foreground mb-1">Clusters actifs</p>
              <p className="text-2xl font-bold text-primary">{clusters.filter((c) => c.status !== "dismissed" && c.status !== "archived").length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Feedbacks critiques</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{insights.criticalWithoutTicket.length}</p>
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Signaux forts (clusters) */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-violet-500" />Signaux forts à traiter</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {strongClusters.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucun cluster fort sans ticket pour le moment.</p>
                ) : (
                  <div className="space-y-2">
                    {strongClusters.slice(0, 5).map((c) => {
                      const priority = calcClusterPriorityLabel(c.feedbackCount, c.impactLevel);
                      return (
                        <div key={c.id} className="flex items-start gap-2 rounded-md p-1.5 hover-elevate"
                          data-testid={`insight-cluster-${c.id}`}>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setActiveView("clusters"); setSelectedCluster(c); }}>
                            <p className="text-xs font-medium truncate">{c.title}</p>
                            <p className="text-[10px] text-muted-foreground">{c.feedbackCount} feedbacks{c.productArea ? ` · ${c.productArea}` : ""}</p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${priority.cls}`}>{priority.label}</Badge>
                          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" title="Voir dans l'Inbox"
                            onClick={() => { setFilterCluster(c.id); setActiveView("inbox"); }}
                            data-testid={`button-insight-inbox-${c.id}`}>
                            <Filter className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top signaux feedbacks */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Top feedbacks qualifiés</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {insights.topByScore.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Qualifiez des feedbacks pour voir leurs signaux.</p>
                ) : (
                  <div className="space-y-2">
                    {insights.topByScore.map((fb, i) => {
                      const info = getScoreInfo(fb._score);
                      return (
                        <div key={fb.id} className="flex items-start gap-2 cursor-pointer hover-elevate rounded-md p-1.5"
                          onClick={() => { setActiveView("inbox"); openFeedback(fb); }}
                          data-testid={`insight-top-${i}`}>
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

            {/* Feedbacks critiques sans ticket */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" />Feedbacks critiques sans ticket</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {insights.criticalWithoutTicket.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucun feedback critique non traité.</p>
                ) : (
                  <div className="space-y-2">
                    {insights.criticalWithoutTicket.slice(0, 5).map((fb) => (
                      <div key={fb.id} className="flex items-start gap-2 cursor-pointer hover-elevate rounded-md p-1.5"
                        onClick={() => { setActiveView("inbox"); openFeedback(fb); }}
                        data-testid={`insight-critical-${fb.id}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{fb.title}</p>
                          <p className="text-[10px] text-muted-foreground">{fb.contributorName} · {IMPORTANCE_LABELS[fb.importance]}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${TYPE_COLORS[fb.type] ?? ""}`}>{TYPE_LABELS[fb.type]}</Badge>
                      </div>
                    ))}
                    {insights.criticalWithoutTicket.length > 5 && (
                      <p className="text-[10px] text-muted-foreground text-center pt-1">+{insights.criticalWithoutTicket.length - 5} autres</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tickets les plus soutenus */}
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

            {/* Zones produit */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Tag className="w-4 h-4 text-primary" />Zones produit les plus remontées</CardTitle></CardHeader>
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

            {/* Répartition par type */}
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

      {/* ═══════ FEEDBACK DETAIL DRAWER ═══════ */}
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
                  {selectedFeedback.analyzedAt && <Badge variant="outline" className="text-[10px] text-violet-600 border-violet-400 gap-0.5"><Brain className="w-2.5 h-2.5" />Analysé</Badge>}
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto">
                {/* Section 1: Original */}
                <div className="px-5 py-4 space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Feedback original</p>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selectedFeedback.description}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div><p className="text-muted-foreground text-[10px]">Contributeur</p><p className="font-medium">{selectedFeedback.contributorName}</p></div>
                    {selectedFeedback.contributorEmail && <div><p className="text-muted-foreground text-[10px]">Email</p><p className="font-medium">{selectedFeedback.contributorEmail}</p></div>}
                    <div><p className="text-muted-foreground text-[10px]">Source</p><p className="font-medium">{SOURCE_LABELS[selectedFeedback.source] ?? selectedFeedback.source}</p></div>
                    <div><p className="text-muted-foreground text-[10px]">Date</p><p className="font-medium">{new Date(selectedFeedback.createdAt).toLocaleDateString("fr-FR")}</p></div>
                    <div><p className="text-muted-foreground text-[10px]">Importance initiale</p>
                      <Badge variant="outline" className={`text-[10px] mt-0.5 ${selectedFeedback.importance === "critical" ? "text-red-600 border-red-400" : selectedFeedback.importance === "high" ? "text-orange-600 border-orange-400" : ""}`}>
                        {IMPORTANCE_LABELS[selectedFeedback.importance] ?? selectedFeedback.importance}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Separator />

                {/* Section 2: Analyse IA */}
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Brain className="w-3 h-3" />Analyse suggérée
                    </p>
                    <div className="flex items-center gap-1.5">
                      {showAiSection && (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" onClick={() => setShowAiSection((v) => !v)}>
                          {showAiSection ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {showAiSection ? "Réduire" : "Voir"}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1.5" onClick={handleAnalyzeFeedback} disabled={isAnalyzing} data-testid="button-analyze-feedback">
                        {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {selectedFeedback.analyzedAt && !aiAnalysis ? "Ré-analyser" : "Analyser"}
                      </Button>
                    </div>
                  </div>

                  {showAiSection && displayedAnalysis && (
                    <div className="rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 p-3 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] text-violet-500 font-medium">
                          Score de confiance : {displayedAnalysis.confidenceScore ? `${Math.round(displayedAnalysis.confidenceScore * 100)}%` : "—"}
                        </p>
                        <span className="text-[10px] text-violet-500 italic">Score indicatif basé sur les signaux disponibles.</span>
                      </div>
                      {displayedAnalysis.summary && (
                        <div>
                          <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Résumé</p>
                          <p className="text-xs">{displayedAnalysis.summary}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {displayedAnalysis.detectedProblem && (
                          <div>
                            <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Problème détecté</p>
                            <p className="text-xs">{displayedAnalysis.detectedProblem}</p>
                          </div>
                        )}
                        {displayedAnalysis.detectedNeed && (
                          <div>
                            <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Besoin utilisateur</p>
                            <p className="text-xs">{displayedAnalysis.detectedNeed}</p>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {displayedAnalysis.sentiment && (
                          <div>
                            <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Sentiment</p>
                            <span className={`text-xs font-medium ${SENTIMENT_COLORS[displayedAnalysis.sentiment] ?? ""}`}>
                              {SENTIMENT_LABELS[displayedAnalysis.sentiment] ?? displayedAnalysis.sentiment}
                            </span>
                          </div>
                        )}
                        {displayedAnalysis.urgency && (
                          <div>
                            <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Urgence IA</p>
                            <span className={`text-xs font-medium ${displayedAnalysis.urgency === "high" ? "text-red-600 dark:text-red-400" : displayedAnalysis.urgency === "medium" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                              {{ low: "Faible", medium: "Moyen", high: "Élevé" }[displayedAnalysis.urgency] ?? displayedAnalysis.urgency}
                            </span>
                          </div>
                        )}
                        {displayedAnalysis.productArea && (
                          <div>
                            <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Zone produit</p>
                            <span className="text-xs">{displayedAnalysis.productArea}</span>
                          </div>
                        )}
                      </div>
                      {(displayedAnalysis.suggestedTags?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground font-medium mb-1">Tags suggérés</p>
                          <div className="flex flex-wrap gap-1">
                            {displayedAnalysis.suggestedTags!.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px] text-violet-600 border-violet-300">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {(displayedAnalysis.keywords?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground font-medium mb-1">Mots-clés</p>
                          <div className="flex flex-wrap gap-1">
                            {displayedAnalysis.keywords!.map((kw) => (
                              <span key={kw} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {aiAnalysis && (
                        <Button size="sm" className="w-full gap-1.5 text-xs mt-1" onClick={() => applyAiSuggestionsMutation.mutate({ id: selectedFeedback.id, analysis: aiAnalysis })} disabled={applyAiSuggestionsMutation.isPending} data-testid="button-apply-ai-suggestions">
                          {applyAiSuggestionsMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Appliquer les suggestions
                        </Button>
                      )}
                    </div>
                  )}

                  {showAiSection && !displayedAnalysis && !isAnalyzing && (
                    <p className="text-xs text-muted-foreground italic">Cliquez sur "Analyser" pour obtenir des suggestions IA.</p>
                  )}
                  {isAnalyzing && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <RefreshCw className="w-3 h-3 animate-spin" />Analyse en cours…
                    </div>
                  )}
                  {!showAiSection && !isAnalyzing && (
                    <p className="text-xs text-muted-foreground italic">Cliquez sur "Analyser" pour obtenir une analyse IA de ce feedback.</p>
                  )}
                </div>
                <Separator />

                {/* Section 3: Qualification */}
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

                {/* Section 4: Liaison ticket */}
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
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={() => openCreateTicket()} data-testid="button-create-ticket">
                      <Plus className="w-3.5 h-3.5" />Créer un ticket
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={() => { setIsLinkTicketOpen(true); setTicketSearch(""); setSelectedTicketId(null); }} data-testid="button-link-ticket">
                      <Link2 className="w-3.5 h-3.5" />Lier un ticket existant
                    </Button>
                  </div>
                </div>
                <Separator />

                {/* Section 5: Actions */}
                <div className="px-5 py-4 space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setClusterSearchForFeedback(""); setSelectedClusterIdForFeedback(null); setIsAddToClusterOpen(true); }} data-testid="button-add-to-cluster">
                      <Layers className="w-3.5 h-3.5" />Ajouter à un cluster
                    </Button>
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

                {/* Section 6: Feedbacks similaires */}
                {showAiSection && similarFeedbacks.length > 0 && (
                  <>
                    <Separator />
                    <div className="px-5 py-4 space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Feedbacks similaires</p>
                      {similarFeedbacks.map((fb) => (
                        <div key={fb.id} className="flex items-start gap-2 cursor-pointer hover-elevate rounded-md p-2" onClick={() => openFeedback(fb)}>
                          <Badge variant="outline" className={`text-[10px] shrink-0 mt-0.5 ${TYPE_COLORS[fb.type] ?? ""}`}>{TYPE_LABELS[fb.type] ?? fb.type}</Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{fb.title}</p>
                            <p className="text-[10px] text-muted-foreground">{fb.contributorName}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {fb.similarityScore >= 3 && <span className="text-[10px] text-violet-600 dark:text-violet-400">Similaire</span>}
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══════ CLUSTER DETAIL DRAWER ═══════ */}
      <Sheet open={!!selectedCluster} onOpenChange={(open) => !open && setSelectedCluster(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          {selectedCluster && (
            <>
              <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
                <SheetTitle className="text-sm font-heading leading-snug line-clamp-2">{selectedCluster.title}</SheetTitle>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <Badge variant="outline" className="text-[10px]">{selectedCluster.feedbackCount} feedback{selectedCluster.feedbackCount > 1 ? "s" : ""}</Badge>
                  <ClusterStatusBadge status={selectedCluster.status} />
                  <Badge variant="outline" className={`text-[10px] ${calcClusterPriorityLabel(selectedCluster.feedbackCount, selectedCluster.impactLevel).cls}`}>
                    {calcClusterPriorityLabel(selectedCluster.feedbackCount, selectedCluster.impactLevel).label}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto">
                {/* Cluster info */}
                <div className="px-5 py-4 space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Signal consolidé</p>
                  {selectedCluster.description && <p className="text-xs text-foreground leading-relaxed">{selectedCluster.description}</p>}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {selectedCluster.detectedProblem && (
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Problème détecté</p>
                        <p>{selectedCluster.detectedProblem}</p>
                      </div>
                    )}
                    {selectedCluster.detectedNeed && (
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Besoin détecté</p>
                        <p>{selectedCluster.detectedNeed}</p>
                      </div>
                    )}
                    {selectedCluster.productArea && (
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Zone produit</p>
                        <p>{selectedCluster.productArea}</p>
                      </div>
                    )}
                    {selectedCluster.sentiment && (
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Sentiment dominant</p>
                        <span className={`${SENTIMENT_COLORS[selectedCluster.sentiment] ?? ""}`}>{SENTIMENT_LABELS[selectedCluster.sentiment] ?? selectedCluster.sentiment}</span>
                      </div>
                    )}
                  </div>
                  {selectedCluster.confidenceScore && (
                    <p className="text-[10px] text-muted-foreground italic">Score de confiance IA : {Math.round(selectedCluster.confidenceScore * 100)}% — Score indicatif basé sur les signaux disponibles.</p>
                  )}
                </div>
                <Separator />

                {/* Linked entities */}
                {(selectedCluster.linkedTicketId || selectedCluster.linkedEpicId) && (
                  <>
                    <div className="px-5 py-4 space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Liaison</p>
                      {selectedCluster.linkedTicketTitle && (
                        <div className="rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-2.5 flex items-center gap-2">
                          <Ticket className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                          <p className="text-xs font-medium text-violet-700 dark:text-violet-300 truncate">{selectedCluster.linkedTicketTitle}</p>
                        </div>
                      )}
                      {selectedCluster.linkedEpicTitle && (
                        <div className="rounded-md border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 p-2.5 flex items-center gap-2">
                          <GitMerge className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          <p className="text-xs font-medium text-cyan-700 dark:text-cyan-300 truncate">{selectedCluster.linkedEpicTitle}</p>
                        </div>
                      )}
                    </div>
                    <Separator />
                  </>
                )}

                {/* Feedbacks list */}
                <div className="px-5 py-4 space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Feedbacks inclus ({selectedCluster.feedbackCount})</p>
                  {selectedCluster.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Aucun feedback dans ce cluster.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedCluster.items.map((item) => (
                        <div key={item.feedbackId} className="flex items-start gap-2 p-2 rounded-md border border-border">
                          <Badge variant="outline" className={`text-[10px] shrink-0 mt-0.5 ${TYPE_COLORS[item.type] ?? ""}`}>{TYPE_LABELS[item.type] ?? item.type}</Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{item.feedbackTitle}</p>
                            <p className="text-[10px] text-muted-foreground">{item.contributorName} · {IMPORTANCE_LABELS[item.importance] ?? item.importance}</p>
                          </div>
                          <Button size="icon" variant="ghost" className="shrink-0 h-6 w-6"
                            onClick={() => removeFeedbackFromClusterMutation.mutate({ clusterId: selectedCluster.id, feedbackId: item.feedbackId })}
                            data-testid={`button-remove-from-cluster-${item.feedbackId}`}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Separator />

                {/* Cluster actions */}
                <div className="px-5 py-4 space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                      onClick={() => updateClusterMutation.mutate({ clusterId: selectedCluster.id, patch: { status: "validated" } })}
                      disabled={selectedCluster.status === "validated" || updateClusterMutation.isPending}
                      data-testid="button-validate-cluster">
                      <CheckCircle2 className="w-3.5 h-3.5" />Valider
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                      onClick={() => updateClusterMutation.mutate({ clusterId: selectedCluster.id, patch: { status: "dismissed" } })}
                      disabled={selectedCluster.status === "dismissed" || updateClusterMutation.isPending}
                      data-testid="button-dismiss-cluster">
                      <Minus className="w-3.5 h-3.5" />Ignorer
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openCreateTicket(selectedCluster)} data-testid="button-cluster-create-ticket">
                      <Ticket className="w-3.5 h-3.5" />Créer un ticket
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openCreateEpicFromCluster(selectedCluster)} data-testid="button-cluster-create-epic">
                      <GitMerge className="w-3.5 h-3.5" />Créer une epic
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                      onClick={() => { setIsLinkTicketToClusterOpen(true); setClusterTicketSearch(""); setSelectedClusterTicketId(null); }}
                      data-testid="button-cluster-link-ticket">
                      <Link2 className="w-3.5 h-3.5" />Lier un ticket
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive border-destructive/30"
                      onClick={() => updateClusterMutation.mutate({ clusterId: selectedCluster.id, patch: { status: "archived" } })}
                      disabled={selectedCluster.status === "archived" || updateClusterMutation.isPending}
                      data-testid="button-archive-cluster">
                      <Archive className="w-3.5 h-3.5" />Archiver
                    </Button>
                  </div>
                </div>
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

      {/* ── Create cluster dialog ── */}
      <Dialog open={isCreateClusterOpen} onOpenChange={setIsCreateClusterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm font-heading">Créer un cluster</DialogTitle></DialogHeader>
          <Form {...createClusterForm}>
            <form id="create-cluster-form" onSubmit={createClusterForm.handleSubmit((data) => createClusterMutation.mutate(data))} className="space-y-3">
              <FormField control={createClusterForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Titre *</FormLabel>
                  <FormControl><Input className="text-sm" data-testid="input-cluster-title" {...field} /></FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
              <FormField control={createClusterForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Description</FormLabel>
                  <FormControl><Textarea className="text-xs min-h-[60px] resize-none" data-testid="textarea-cluster-description" {...field} /></FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={createClusterForm.control} name="productArea" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Zone produit</FormLabel>
                    <FormControl><Input className="text-xs" placeholder="Ex : Facturation" data-testid="input-cluster-product-area" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={createClusterForm.control} name="impactLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Impact</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl><SelectTrigger className="text-xs"><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem><SelectItem value="low">Faible</SelectItem>
                        <SelectItem value="medium">Moyen</SelectItem><SelectItem value="high">Élevé</SelectItem><SelectItem value="critical">Critique</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCreateClusterOpen(false)}>Annuler</Button>
            <Button size="sm" form="create-cluster-form" type="submit" disabled={createClusterMutation.isPending} data-testid="button-confirm-create-cluster">
              {createClusterMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />}Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create ticket dialog (from feedback) ── */}
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

      {/* ── Create ticket/epic from cluster dialog ── */}
      <Dialog open={isCreateFromClusterOpen} onOpenChange={setIsCreateFromClusterOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-heading">
              {createFromClusterMode === "ticket" ? "Créer un ticket depuis ce cluster" : "Créer une epic depuis ce cluster"}
            </DialogTitle>
          </DialogHeader>
          <Form {...createFromClusterForm}>
            <form id="create-from-cluster-form" onSubmit={createFromClusterForm.handleSubmit((data) => selectedCluster && createFromClusterMutation.mutate({ clusterId: selectedCluster.id, mode: createFromClusterMode, data }))} className="space-y-3">
              <FormField control={createFromClusterForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Titre *</FormLabel>
                  <FormControl><Input className="text-sm" data-testid="input-from-cluster-title" {...field} /></FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
              <FormField control={createFromClusterForm.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Priorité</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="text-xs"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="critical">Critique</SelectItem><SelectItem value="high">Élevé</SelectItem>
                      <SelectItem value="medium">Moyen</SelectItem><SelectItem value="low">Faible</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={createFromClusterForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Description (pré-remplie depuis le cluster)</FormLabel>
                  <FormControl><Textarea className="text-xs min-h-[180px] resize-none font-mono" data-testid="textarea-from-cluster-description" {...field} /></FormControl>
                </FormItem>
              )} />
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCreateFromClusterOpen(false)}>Annuler</Button>
            <Button size="sm" form="create-from-cluster-form" type="submit" disabled={createFromClusterMutation.isPending} data-testid="button-confirm-create-from-cluster">
              {createFromClusterMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {createFromClusterMode === "ticket" ? "Créer le ticket" : "Créer l'epic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Link existing ticket dialog (feedback) ── */}
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
                  {userStories.filter((us) => !ticketSearch || us.title.toLowerCase().includes(ticketSearch.toLowerCase())).slice(0, 20).map((us) => (
                    <div key={us.id}
                      className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover-elevate ${selectedTicketId === us.id ? "bg-primary/10" : ""}`}
                      onClick={() => setSelectedTicketId(us.id)} data-testid={`ticket-option-${us.id}`}>
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
              data-testid="button-confirm-link-ticket">
              {linkTicketMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />}Lier ce ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add feedback to existing cluster dialog ── */}
      <Dialog open={isAddToClusterOpen} onOpenChange={(open) => { setIsAddToClusterOpen(open); if (!open) { setSelectedClusterIdForFeedback(null); setClusterSearchForFeedback(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm font-heading">Ajouter à un cluster</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input placeholder="Rechercher un cluster..." className="pl-8 text-xs" value={clusterSearchForFeedback} onChange={(e) => setClusterSearchForFeedback(e.target.value)} data-testid="input-cluster-search-for-feedback" />
            </div>
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {clustersLoading ? (
                <div className="p-4 text-center"><RefreshCw className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></div>
              ) : (
                <div className="divide-y divide-border">
                  {clusters
                    .filter((c) => c.status !== "dismissed" && c.status !== "archived")
                    .filter((c) => !clusterSearchForFeedback || c.title.toLowerCase().includes(clusterSearchForFeedback.toLowerCase()))
                    .filter((c) => !c.items.some((i) => i.feedbackId === selectedFeedback?.id))
                    .map((c) => {
                      const priority = calcClusterPriorityLabel(c.feedbackCount, c.impactLevel);
                      return (
                        <div key={c.id}
                          className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer hover-elevate ${selectedClusterIdForFeedback === c.id ? "bg-primary/10" : ""}`}
                          onClick={() => setSelectedClusterIdForFeedback(c.id)}
                          data-testid={`cluster-option-${c.id}`}>
                          {selectedClusterIdForFeedback === c.id && <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{c.title}</p>
                            <p className="text-[10px] text-muted-foreground">{c.feedbackCount} feedback{c.feedbackCount !== 1 ? "s" : ""}{c.productArea ? ` · ${c.productArea}` : ""}</p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${priority.cls}`}>{priority.label}</Badge>
                        </div>
                      );
                    })}
                  {clusters.filter((c) => c.status !== "dismissed" && c.status !== "archived").length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground">Aucun cluster actif. Créez-en un depuis l'onglet Clusters.</div>
                  )}
                  {clusters.filter((c) => c.status !== "dismissed" && c.status !== "archived")
                    .filter((c) => !clusterSearchForFeedback || c.title.toLowerCase().includes(clusterSearchForFeedback.toLowerCase()))
                    .filter((c) => !c.items.some((i) => i.feedbackId === selectedFeedback?.id))
                    .length === 0 && clusters.filter((c) => c.status !== "dismissed" && c.status !== "archived").length > 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      {clusterSearchForFeedback ? "Aucun cluster trouvé." : "Ce feedback est déjà dans tous les clusters actifs."}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddToClusterOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={!selectedClusterIdForFeedback || addFeedbackToClusterMutation.isPending}
              onClick={() => selectedFeedback && selectedClusterIdForFeedback && addFeedbackToClusterMutation.mutate({ clusterId: selectedClusterIdForFeedback, feedbackId: selectedFeedback.id })}
              data-testid="button-confirm-add-to-cluster">
              {addFeedbackToClusterMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />}Ajouter au cluster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Link existing ticket dialog (cluster) ── */}
      <Dialog open={isLinkTicketToClusterOpen} onOpenChange={setIsLinkTicketToClusterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm font-heading">Lier le cluster à un ticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input placeholder="Rechercher un ticket..." className="pl-8 text-xs" value={clusterTicketSearch} onChange={(e) => setClusterTicketSearch(e.target.value)} data-testid="input-cluster-ticket-search" />
            </div>
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {storiesLoading ? (
                <div className="p-4 text-center"><RefreshCw className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></div>
              ) : (
                <div className="divide-y divide-border">
                  {userStories.filter((us) => !clusterTicketSearch || us.title.toLowerCase().includes(clusterTicketSearch.toLowerCase())).slice(0, 20).map((us) => (
                    <div key={us.id}
                      className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover-elevate ${selectedClusterTicketId === us.id ? "bg-primary/10" : ""}`}
                      onClick={() => setSelectedClusterTicketId(us.id)} data-testid={`cluster-ticket-option-${us.id}`}>
                      {selectedClusterTicketId === us.id && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{us.title}</p>
                        <p className="text-[10px] text-muted-foreground">{us.state?.replace(/_/g, " ") ?? "—"}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{us.priority ?? "medium"}</Badge>
                    </div>
                  ))}
                  {userStories.filter((us) => !clusterTicketSearch || us.title.toLowerCase().includes(clusterTicketSearch.toLowerCase())).length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground">Aucun ticket trouvé.</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsLinkTicketToClusterOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={!selectedClusterTicketId || linkTicketToClusterMutation.isPending}
              onClick={() => selectedCluster && selectedClusterTicketId && linkTicketToClusterMutation.mutate({ clusterId: selectedCluster.id, ticketId: selectedClusterTicketId })}
              data-testid="button-confirm-link-cluster-ticket">
              {linkTicketToClusterMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />}Lier ce ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
