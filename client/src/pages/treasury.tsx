import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Filter,
  RefreshCw,
  X,
  Pencil,
  Trash2,
  Bot,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────

type TreasuryFlow = {
  id: string;
  type: "income" | "expense";
  sourceType: "project_payment" | "project_resource" | "manual";
  status: string;
  date: string;
  amount: number;
  label: string;
  description?: string;
  categoryId?: string | null;
  categoryName?: string;
  categoryColor?: string;
  projectId?: string | null;
  projectName?: string;
  clientId?: string | null;
  clientName?: string;
  resourceId?: string | null;
  resourceName?: string;
  tags: string[];
  manualId?: string;
};

type TreasuryKpis = {
  currentBalance: number;
  projectedBalance: number;
  incomeTotal: number;
  expenseTotal: number;
  netVariation: number;
  lowestPoint: number;
  alertLevel: "ok" | "warning" | "critical";
};

type ChartPoint = {
  key: string;
  label: string;
  income: number;
  expense: number;
  cumulativeCash: number;
};

type TreasuryCategory = {
  id: string;
  name: string;
  type: string;
  color: string | null;
};

type TreasuryData = {
  flows: TreasuryFlow[];
  kpis: TreasuryKpis;
  chartData: ChartPoint[];
  categories: TreasuryCategory[];
  projects: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  settings: { startingCash: string; alertThreshold: string | null; defaultViewRange: string };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const STATUS_LABELS: Record<string, string> = {
  planned: "Prévu",
  confirmed: "Confirmé",
  received: "Reçu",
  paid: "Payé",
  cancelled: "Annulé",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  received: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  trend,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  highlight?: "green" | "red" | "amber";
}) {
  const highlightCls =
    highlight === "green"
      ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/20"
      : highlight === "red"
      ? "border-red-500/30 bg-red-50/50 dark:bg-red-950/20"
      : highlight === "amber"
      ? "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"
      : "";

  return (
    <Card className={cn("gap-2", highlightCls)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : trend === "down" ? (
              <TrendingDown className="h-3 w-3 text-red-500" />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Add/Edit Transaction Modal ────────────────────────────────────────────────

type TxFormData = {
  type: "income" | "expense";
  date: string;
  amount: string;
  label: string;
  description: string;
  categoryId: string;
  projectId: string;
  status: string;
  tags: string;
};

const EMPTY_FORM: TxFormData = {
  type: "income",
  date: new Date().toISOString().split("T")[0],
  amount: "",
  label: "",
  description: "",
  categoryId: "",
  projectId: "",
  status: "planned",
  tags: "",
};

function TxModal({
  open,
  onClose,
  editFlow,
  categories,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  editFlow: TreasuryFlow | null;
  categories: TreasuryCategory[];
  projects: { id: string; name: string }[];
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<TxFormData>(EMPTY_FORM);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      if (editFlow && editFlow.manualId) {
        setForm({
          type: editFlow.type,
          date: editFlow.date,
          amount: editFlow.amount.toString(),
          label: editFlow.label,
          description: editFlow.description ?? "",
          categoryId: editFlow.categoryId ?? "",
          projectId: editFlow.projectId ?? "",
          status: editFlow.status,
          tags: (editFlow.tags ?? []).join(", "),
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, editFlow]);

  const isEdit = !!(editFlow?.manualId);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("/api/treasury/transactions", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/flows"] });
      toast({ title: "Flux ajouté", className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest(`/api/treasury/transactions/${editFlow?.manualId}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/flows"] });
      toast({ title: "Flux mis à jour", className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!form.amount || !form.label || !form.date) {
      toast({ title: "Champs requis", description: "Date, libellé et montant sont obligatoires.", variant: "destructive" });
      return;
    }
    const payload: Record<string, unknown> = {
      type: form.type,
      date: form.date,
      amount: parseFloat(form.amount).toFixed(2),
      label: form.label,
      description: form.description || null,
      categoryId: form.categoryId || null,
      projectId: form.projectId || null,
      status: form.status,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    };
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const filteredCats = categories.filter((c) => c.type === form.type);
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le flux" : "Nouveau flux manuel"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "income" | "expense", categoryId: "" }))}>
              <SelectTrigger data-testid="select-tx-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Entrée</SelectItem>
                <SelectItem value="expense">Sortie</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Statut</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger data-testid="select-tx-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Prévu</SelectItem>
                <SelectItem value="confirmed">Confirmé</SelectItem>
                {form.type === "income" && <SelectItem value="received">Reçu</SelectItem>}
                {form.type === "expense" && <SelectItem value="paid">Payé</SelectItem>}
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} data-testid="input-tx-date" />
          </div>
          <div>
            <Label className="text-xs">Montant (€)</Label>
            <Input type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} data-testid="input-tx-amount" />
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Libellé</Label>
            <Input placeholder="Description courte" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} data-testid="input-tx-label" />
          </div>

          <div>
            <Label className="text-xs">Catégorie</Label>
            <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
              <SelectTrigger data-testid="select-tx-category"><SelectValue placeholder="— Catégorie —" /></SelectTrigger>
              <SelectContent>
                {filteredCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Projet (optionnel)</Label>
            <Select value={form.projectId} onValueChange={(v) => setForm((f) => ({ ...f, projectId: v === "_none" ? "" : v }))}>
              <SelectTrigger data-testid="select-tx-project"><SelectValue placeholder="— Projet —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Aucun</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Tags (séparés par virgule)</Label>
            <Input placeholder="ex: récurrent, Q1, urgent" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} data-testid="input-tx-tags" />
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Note (optionnel)</Label>
            <Textarea placeholder="Détails additionnels…" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} data-testid="input-tx-desc" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending} data-testid="button-tx-save">
            {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isEdit ? "Enregistrer" : "Ajouter")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TreasuryPage() {
  const { toast } = useToast();

  // Filters state
  const [periodTab, setPeriodTab] = useState<"3m" | "6m" | "12m" | "all">("6m");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState<string>("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editFlow, setEditFlow] = useState<TreasuryFlow | null>(null);

  // Data
  const { data, isLoading, error } = useQuery<TreasuryData>({
    queryKey: ["/api/treasury/flows"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/treasury/transactions/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/flows"] });
      toast({ title: "Flux supprimé" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Period window
  const periodWindow = useMemo(() => {
    const now = new Date();
    if (periodTab === "all") return null;
    const months = periodTab === "3m" ? 3 : periodTab === "6m" ? 6 : 12;
    const from = new Date(now.getFullYear(), now.getMonth() - Math.floor(months / 2), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + Math.ceil(months / 2), 0);
    return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
  }, [periodTab]);

  // Filter flows
  const filteredFlows = useMemo(() => {
    if (!data) return [];
    return data.flows.filter((f) => {
      if (periodWindow && (f.date < periodWindow.from || f.date > periodWindow.to)) return false;
      if (filterType !== "all" && f.type !== filterType) return false;
      if (filterStatus !== "all" && f.status !== filterStatus) return false;
      if (filterProject !== "all" && f.projectId !== filterProject) return false;
      if (filterSource !== "all" && f.sourceType !== filterSource) return false;
      if (filterCategory !== "all" && f.categoryId !== filterCategory) return false;
      if (filterSearch && !f.label.toLowerCase().includes(filterSearch.toLowerCase()) && !(f.projectName?.toLowerCase().includes(filterSearch.toLowerCase()))) return false;
      return true;
    });
  }, [data, periodWindow, filterType, filterStatus, filterProject, filterSource, filterCategory, filterSearch]);

  // Chart data filtered by period
  const chartData = useMemo(() => {
    if (!data) return [];
    if (!periodWindow) return data.chartData;
    return data.chartData.filter((d) => d.key >= periodWindow.from.substring(0, 7) && d.key <= periodWindow.to.substring(0, 7));
  }, [data, periodWindow]);

  // Period-specific KPIs
  const periodKpis = useMemo(() => {
    const active = filteredFlows.filter((f) => f.status !== "cancelled");
    const income = active.filter((f) => f.type === "income").reduce((s, f) => s + f.amount, 0);
    const expense = active.filter((f) => f.type === "expense").reduce((s, f) => s + f.amount, 0);
    return { income, expense, net: income - expense };
  }, [filteredFlows]);

  const kpis = data?.kpis;
  const categories = data?.categories ?? [];
  const projects = data?.projects ?? [];

  const hasActiveFilters = filterType !== "all" || filterStatus !== "all" || filterProject !== "all" || filterSource !== "all" || filterCategory !== "all" || filterSearch !== "";

  const clearFilters = () => {
    setFilterType("all");
    setFilterStatus("all");
    setFilterProject("all");
    setFilterSource("all");
    setFilterCategory("all");
    setFilterSearch("");
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Erreur de chargement du module Trésorerie.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Trésorerie</h1>
          {kpis?.alertLevel === "critical" && (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 gap-1">
              <AlertTriangle className="h-3 w-3" /> Trésorerie négative
            </Badge>
          )}
          {kpis?.alertLevel === "warning" && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 gap-1">
              <AlertTriangle className="h-3 w-3" /> Seuil d'alerte
            </Badge>
          )}
        </div>
        <Button onClick={() => { setEditFlow(null); setModalOpen(true); }} data-testid="button-add-flow">
          <Plus className="h-4 w-4" /> Ajouter un flux
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
          ) : (
            <>
              <KpiCard
                label="Solde actuel"
                value={fmt(kpis?.currentBalance ?? 0)}
                icon={<Wallet className="h-4 w-4" />}
                highlight={kpis && kpis.currentBalance < 0 ? "red" : kpis && kpis.currentBalance > 0 ? "green" : undefined}
                sub="Flux encaissés / décaissés"
              />
              <KpiCard
                label="Entrées (période)"
                value={fmt(periodKpis.income)}
                icon={<ArrowDownLeft className="h-4 w-4 text-green-500" />}
                trend="up"
                highlight="green"
              />
              <KpiCard
                label="Sorties (période)"
                value={fmt(periodKpis.expense)}
                icon={<ArrowUpRight className="h-4 w-4 text-red-500" />}
                trend="down"
                highlight="red"
              />
              <KpiCard
                label="Solde projeté"
                value={fmt(kpis?.projectedBalance ?? 0)}
                icon={<TrendingUp className="h-4 w-4" />}
                sub="Tous flux actifs"
                highlight={kpis && kpis.projectedBalance < 0 ? "red" : undefined}
              />
              <KpiCard
                label="Variation nette"
                value={fmt(periodKpis.net)}
                icon={periodKpis.net >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                highlight={periodKpis.net >= 0 ? "green" : "red"}
              />
            </>
          )}
        </div>

        {/* Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap pb-3">
            <CardTitle className="text-base">Trésorerie prévisionnelle</CardTitle>
            <Tabs value={periodTab} onValueChange={(v) => setPeriodTab(v as typeof periodTab)}>
              <TabsList>
                <TabsTrigger value="3m" data-testid="tab-3m">3 mois</TabsTrigger>
                <TabsTrigger value="6m" data-testid="tab-6m">6 mois</TabsTrigger>
                <TabsTrigger value="12m" data-testid="tab-12m">12 mois</TabsTrigger>
                <TabsTrigger value="all" data-testid="tab-all">Tout</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée pour cette période
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    className="text-muted-foreground"
                  />
                  <ReTooltip
                    formatter={(value: number, name: string) => [fmt(value), name === "income" ? "Entrées" : name === "expense" ? "Sorties" : "Trésorerie cumulée"]}
                    labelClassName="font-semibold"
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend formatter={(v) => v === "income" ? "Entrées" : v === "expense" ? "Sorties" : "Trésorerie cumulée"} />
                  <Bar dataKey="income" fill="#10b981" opacity={0.85} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" fill="#ef4444" opacity={0.85} radius={[3, 3, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="cumulativeCash"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

          <Input
            placeholder="Rechercher…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="h-8 w-40 text-sm"
            data-testid="input-filter-search"
          />

          <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="h-8 w-32 text-xs" data-testid="select-filter-type"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              <SelectItem value="income">Entrées</SelectItem>
              <SelectItem value="expense">Sorties</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-filter-status"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="h-8 w-40 text-xs" data-testid="select-filter-project"><SelectValue placeholder="Projet" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous projets</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-filter-source"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes sources</SelectItem>
              <SelectItem value="project_payment">Paiement projet</SelectItem>
              <SelectItem value="project_resource">Ressource projet</SelectItem>
              <SelectItem value="manual">Manuel</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-8 w-44 text-xs" data-testid="select-filter-category"><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1" data-testid="button-clear-filters">
              <X className="h-3 w-3" /> Effacer
            </Button>
          )}

          <span className="ml-auto text-xs text-muted-foreground">
            {filteredFlows.length} flux
          </span>
        </div>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Date</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Type</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Libellé</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Projet</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Catégorie</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Tags</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Statut</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Source</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground text-xs">Montant</th>
                  <th className="py-2 px-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="py-2 px-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredFlows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-muted-foreground text-sm">
                      Aucun flux pour les filtres sélectionnés
                    </td>
                  </tr>
                ) : (
                  filteredFlows.map((flow) => (
                    <tr
                      key={flow.id}
                      className="border-b hover-elevate transition-colors group"
                      data-testid={`row-flow-${flow.id}`}
                    >
                      <td className="py-2 px-3 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(flow.date).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-2 px-3">
                        {flow.type === "income" ? (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium">
                            <ArrowDownLeft className="h-3 w-3" /> Entrée
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-medium">
                            <ArrowUpRight className="h-3 w-3" /> Sortie
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 max-w-48">
                        <span className="font-medium truncate block">{flow.label}</span>
                        {flow.clientName && <span className="text-xs text-muted-foreground">{flow.clientName}</span>}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground max-w-36 truncate">
                        {flow.projectName ?? "—"}
                      </td>
                      <td className="py-2 px-3">
                        {flow.categoryName ? (
                          <span className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: flow.categoryColor ?? "#6366f1" }}
                            />
                            <span className="text-xs truncate">{flow.categoryName}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(flow.tags ?? []).slice(0, 2).map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
                          ))}
                          {(flow.tags ?? []).length > 2 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{flow.tags.length - 2}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[flow.status] ?? STATUS_COLORS.planned)}>
                          {STATUS_LABELS[flow.status] ?? flow.status}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {flow.sourceType === "manual" ? (
                            <><User className="h-3 w-3" /> Manuel</>
                          ) : (
                            <><Bot className="h-3 w-3" /> Auto</>
                          )}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <span className={cn("font-semibold", flow.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                          {flow.type === "income" ? "+" : "−"}{fmt(flow.amount)}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {flow.sourceType === "manual" && flow.manualId && (
                          <div className="flex items-center gap-1 invisible group-hover:visible">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => { setEditFlow(flow); setModalOpen(true); }}
                              data-testid={`button-edit-flow-${flow.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive"
                              onClick={() => { if (confirm("Supprimer ce flux ?")) deleteMutation.mutate(flow.manualId!); }}
                              data-testid={`button-delete-flow-${flow.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Low cash alert */}
        {kpis && kpis.lowestPoint < 0 && (
          <Card className="border-red-500/30 bg-red-50/50 dark:bg-red-950/20">
            <CardContent className="py-3 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Point bas de trésorerie négatif</p>
                <p className="text-xs text-red-700 dark:text-red-400">
                  La trésorerie cumulée atteindra un minimum de <strong>{fmt(kpis.lowestPoint)}</strong>. Anticipez un financement ou décalez des sorties.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal */}
      <TxModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditFlow(null); }}
        editFlow={editFlow}
        categories={categories}
        projects={projects}
      />
    </div>
  );
}
