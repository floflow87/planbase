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
  Plus,
  Filter,
  RefreshCw,
  X,
  Pencil,
  Trash2,
  Bot,
  User,
  BarChart2,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  received: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

// Pastel chart colors
const PASTEL_GREEN = "#86efac";
const PASTEL_RED = "#fca5a5";
const PASTEL_VIOLET = "#c4b5fd";

// Build chart series from raw flows — fills every month in the period with 0 if no data
function buildChartData(
  flows: TreasuryFlow[],
  statuses: string[],
  startingCash: number,
  periodRange?: { from: string; to: string }
): ChartPoint[] {
  const filtered = flows.filter((f) => statuses.includes(f.status));
  const chartMap: Record<string, { income: number; expense: number }> = {};

  // Pre-fill all months in the period so empty months still appear
  if (periodRange) {
    let cur = new Date(periodRange.from.substring(0, 7) + "-01");
    const end = new Date(periodRange.to.substring(0, 7) + "-01");
    while (cur <= end) {
      const key = cur.toISOString().substring(0, 7);
      chartMap[key] = { income: 0, expense: 0 };
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }

  for (const f of filtered) {
    const key = f.date.substring(0, 7);
    if (!chartMap[key]) chartMap[key] = { income: 0, expense: 0 };
    if (f.type === "income") chartMap[key].income += f.amount;
    else chartMap[key].expense += f.amount;
  }

  let cumulative = startingCash;
  return Object.entries(chartMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { income, expense }]) => {
      cumulative += income - expense;
      const [year, month] = key.split("-");
      const label = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString("fr-FR", {
        month: "short",
        year: "2-digit",
      });
      return {
        key,
        label,
        income: Math.round(income),
        expense: Math.round(expense),
        cumulativeCash: Math.round(cumulative),
      };
    });
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  highlight?: "green" | "red" | "amber";
}) {
  const highlightCls =
    highlight === "green"
      ? "border-green-400/30 bg-green-50/50 dark:bg-green-950/20"
      : highlight === "red"
      ? "border-red-400/30 bg-red-50/50 dark:bg-red-950/20"
      : highlight === "amber"
      ? "border-amber-400/30 bg-amber-50/50 dark:bg-amber-950/20"
      : "";

  return (
    <Card className={cn(highlightCls)}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">{label}</span>
          <span className="text-muted-foreground shrink-0">{icon}</span>
        </div>
        <div className="text-base font-bold leading-tight">{value}</div>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Add/Edit Transaction Form (side panel) ────────────────────────────────────

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

const mkEmptyForm = (): TxFormData => ({
  type: "income",
  date: new Date().toISOString().split("T")[0],
  amount: "",
  label: "",
  description: "",
  categoryId: "",
  projectId: "",
  status: "planned",
  tags: "",
});

function TxPanel({
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
  const [form, setForm] = useState<TxFormData>(mkEmptyForm);

  useEffect(() => {
    if (open) {
      if (editFlow?.manualId) {
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
        setForm(mkEmptyForm());
      }
    }
  }, [open, editFlow]);

  const isEdit = !!(editFlow?.manualId);

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => apiRequest("/api/treasury/transactions", "POST", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/flows"] });
      toast({ title: "Flux ajouté", className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) =>
      apiRequest(`/api/treasury/transactions/${editFlow?.manualId}`, "PATCH", d),
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

  if (!open) return null;

  return (
    <aside className="w-80 border-l bg-card shadow-sm overflow-y-auto shrink-0 flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <span className="text-sm font-semibold text-foreground">
          {isEdit ? "Modifier le flux" : "Nouveau flux"}
        </span>
        <Button size="icon" variant="ghost" onClick={onClose} className="h-6 w-6" data-testid="button-panel-close">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-3 p-4 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "income" | "expense", categoryId: "" }))}>
              <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-tx-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Entrée</SelectItem>
                <SelectItem value="expense">Sortie</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Statut</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-tx-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Prévu</SelectItem>
                <SelectItem value="confirmed">Confirmé</SelectItem>
                {form.type === "income" && <SelectItem value="received">Reçu</SelectItem>}
                {form.type === "expense" && <SelectItem value="paid">Payé</SelectItem>}
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Date</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="text-xs mt-0.5" data-testid="input-tx-date" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Montant (€)</Label>
            <Input type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="h-7 text-xs mt-0.5" data-testid="input-tx-amount" />
          </div>
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Libellé</Label>
          <Input placeholder="Description courte" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="h-7 text-xs mt-0.5" data-testid="input-tx-label" />
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Catégorie</Label>
          <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
            <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-tx-category"><SelectValue placeholder="— Catégorie —" /></SelectTrigger>
            <SelectContent>
              {filteredCats.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Projet (optionnel)</Label>
          <Select value={form.projectId} onValueChange={(v) => setForm((f) => ({ ...f, projectId: v === "_none" ? "" : v }))}>
            <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-tx-project"><SelectValue placeholder="— Projet —" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Aucun</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tags (virgule)</Label>
          <Input placeholder="récurrent, Q1…" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} className="h-7 text-xs mt-0.5" data-testid="input-tx-tags" />
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Note</Label>
          <Textarea placeholder="Détails…" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="text-xs mt-0.5" data-testid="input-tx-desc" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-3 border-t">
        <Button variant="outline" size="sm" onClick={onClose} className="flex-1">Annuler</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isPending} className="flex-1" data-testid="button-tx-save">
          {isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : (isEdit ? "Enregistrer" : "Ajouter")}
        </Button>
      </div>
    </aside>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TreasuryPage() {
  const { toast } = useToast();

  const [periodTab, setPeriodTab] = useState<"3m" | "6m" | "12m" | "all">("6m");
  const [chartMode, setChartMode] = useState<"real" | "projected">("projected");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState<string>("");

  const [panelOpen, setPanelOpen] = useState(false);
  const [editFlow, setEditFlow] = useState<TreasuryFlow | null>(null);

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

  // Period window — forward-looking: 3m/6m/12m = les N prochains mois à partir de maintenant
  const periodWindow = useMemo(() => {
    const now = new Date();
    if (periodTab === "all") return null;
    const months = periodTab === "3m" ? 3 : periodTab === "6m" ? 6 : 12;
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + months, 0);
    return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
  }, [periodTab]);

  const filteredFlows = useMemo(() => {
    if (!data) return [];
    return data.flows.filter((f) => {
      if (periodWindow && (f.date < periodWindow.from || f.date > periodWindow.to)) return false;
      if (filterType !== "all" && f.type !== filterType) return false;
      if (filterStatus !== "all" && f.status !== filterStatus) return false;
      if (filterProject !== "all" && f.projectId !== filterProject) return false;
      if (filterSource !== "all" && f.sourceType !== filterSource) return false;
      if (filterCategory !== "all" && f.categoryId !== filterCategory) return false;
      if (
        filterSearch &&
        !f.label.toLowerCase().includes(filterSearch.toLowerCase()) &&
        !(f.projectName?.toLowerCase().includes(filterSearch.toLowerCase()))
      )
        return false;
      return true;
    });
  }, [data, periodWindow, filterType, filterStatus, filterProject, filterSource, filterCategory, filterSearch]);

  // Chart data by mode — period fills empty months so all months always appear
  const chartData = useMemo(() => {
    if (!data) return [];
    const startingCash = parseFloat(data.settings?.startingCash ?? "0");
    const realStatuses = ["received", "paid"];
    const projectedStatuses = ["confirmed", "received", "paid"];
    const statuses = chartMode === "real" ? realStatuses : projectedStatuses;
    return buildChartData(data.flows, statuses, startingCash, periodWindow ?? undefined);
  }, [data, chartMode, periodWindow]);

  const periodKpis = useMemo(() => {
    const active = filteredFlows.filter((f) => f.status !== "cancelled");
    const income = active.filter((f) => f.type === "income").reduce((s, f) => s + f.amount, 0);
    const expense = active.filter((f) => f.type === "expense").reduce((s, f) => s + f.amount, 0);
    return { income, expense, net: income - expense };
  }, [filteredFlows]);

  // Running balance per row (sorted by date asc, starting from startingCash)
  const flowsWithBalance = useMemo(() => {
    const startingCash = parseFloat(data?.settings?.startingCash ?? "0");
    const sorted = [...filteredFlows].sort((a, b) => a.date.localeCompare(b.date));
    let running = startingCash;
    return sorted.map((f) => {
      if (f.status !== "cancelled") {
        running += f.type === "income" ? f.amount : -f.amount;
      }
      return { ...f, runningBalance: running };
    });
  }, [filteredFlows, data]);

  const kpis = data?.kpis;
  const categories = data?.categories ?? [];
  const projects = data?.projects ?? [];

  const hasActiveFilters =
    filterType !== "all" ||
    filterStatus !== "all" ||
    filterProject !== "all" ||
    filterSource !== "all" ||
    filterCategory !== "all" ||
    filterSearch !== "";

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
          <p className="text-xs text-muted-foreground">Erreur de chargement du module Trésorerie.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold">Trésorerie</h1>
          {kpis?.alertLevel === "critical" && (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 gap-1 text-[10px]">
              <AlertTriangle className="h-2.5 w-2.5" /> Trésorerie négative
            </Badge>
          )}
          {kpis?.alertLevel === "warning" && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 gap-1 text-[10px]">
              <AlertTriangle className="h-2.5 w-2.5" /> Seuil d'alerte
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => { setEditFlow(null); setPanelOpen(true); }}
          data-testid="button-add-flow"
          className="h-7 text-xs gap-1 px-3"
        >
          <Plus className="h-3 w-3" /> Ajouter un flux
        </Button>
      </div>

      {/* ── Body: main + side panel ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Main content ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
            ) : (
              <>
                <KpiCard
                  label="Solde actuel"
                  value={fmt(kpis?.currentBalance ?? 0)}
                  icon={<Wallet className="h-3 w-3" />}
                  highlight={kpis && kpis.currentBalance < 0 ? "red" : kpis && kpis.currentBalance > 0 ? "green" : undefined}
                  sub="Encaissé / décaissé"
                />
                <KpiCard
                  label="Entrées (période)"
                  value={fmt(periodKpis.income)}
                  icon={<ArrowDownLeft className="h-3 w-3 text-green-500" />}
                  highlight="green"
                />
                <KpiCard
                  label="Sorties (période)"
                  value={fmt(periodKpis.expense)}
                  icon={<ArrowUpRight className="h-3 w-3 text-red-500" />}
                  highlight="red"
                />
                <KpiCard
                  label="Solde projeté"
                  value={fmt(kpis?.projectedBalance ?? 0)}
                  icon={<TrendingUp className="h-3 w-3" />}
                  sub="Tous flux actifs"
                  highlight={kpis && kpis.projectedBalance < 0 ? "red" : undefined}
                />
                <KpiCard
                  label="Variation nette"
                  value={fmt(periodKpis.net)}
                  icon={
                    periodKpis.net >= 0
                      ? <TrendingUp className="h-3 w-3 text-green-500" />
                      : <TrendingDown className="h-3 w-3 text-red-500" />
                  }
                  highlight={periodKpis.net >= 0 ? "green" : "red"}
                />
              </>
            )}
          </div>

          {/* Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap py-2 px-4">
              <CardTitle className="text-xs font-semibold">Trésorerie</CardTitle>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Réelle / Prévisionnelle toggle */}
                <div className="flex items-center rounded-md border overflow-hidden">
                  <button
                    onClick={() => setChartMode("real")}
                    data-testid="toggle-chart-real"
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium transition-colors",
                      chartMode === "real"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Eye className="h-2.5 w-2.5" /> Réelle
                  </button>
                  <button
                    onClick={() => setChartMode("projected")}
                    data-testid="toggle-chart-projected"
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium transition-colors border-l",
                      chartMode === "projected"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <BarChart2 className="h-2.5 w-2.5" /> Prévisionnelle
                  </button>
                </div>

                {/* Period tabs */}
                <Tabs value={periodTab} onValueChange={(v) => setPeriodTab(v as typeof periodTab)}>
                  <TabsList className="h-6">
                    <TabsTrigger value="3m" className="text-[10px] px-2 h-5" data-testid="tab-3m">3m</TabsTrigger>
                    <TabsTrigger value="6m" className="text-[10px] px-2 h-5" data-testid="tab-6m">6m</TabsTrigger>
                    <TabsTrigger value="12m" className="text-[10px] px-2 h-5" data-testid="tab-12m">12m</TabsTrigger>
                    <TabsTrigger value="all" className="text-[10px] px-2 h-5" data-testid="tab-all">Tout</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>

            <CardContent className="px-4 pb-4">
              {isLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : chartData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-muted-foreground text-xs">
                  Aucune donnée pour cette période
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      width={32}
                    />
                    <ReTooltip
                      formatter={(value: number, name: string) => [
                        fmt(value),
                        name === "income" ? "Entrées" : name === "expense" ? "Sorties" : "Trésorerie cumulée",
                      ]}
                      contentStyle={{ fontSize: 11 }}
                    />
                    <Legend
                      formatter={(v) => v === "income" ? "Entrées" : v === "expense" ? "Sorties" : "Trésorerie cumulée"}
                      wrapperStyle={{ fontSize: 10 }}
                    />
                    <Bar dataKey="income" fill={PASTEL_GREEN} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expense" fill={PASTEL_RED} radius={[3, 3, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="cumulativeCash"
                      stroke={PASTEL_VIOLET}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <Filter className="h-3 w-3 text-muted-foreground shrink-0" />

            <Input
              placeholder="Rechercher…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="h-7 w-36 text-[10px] placeholder:text-[10px]"
              data-testid="input-filter-search"
            />

            <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
              <SelectTrigger className="h-7 w-28 text-[10px]" data-testid="select-filter-type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="income">Entrées</SelectItem>
                <SelectItem value="expense">Sorties</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-7 w-32 text-[10px]" data-testid="select-filter-status">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="h-7 w-36 text-[10px]" data-testid="select-filter-project">
                <SelectValue placeholder="Projet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous projets</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="h-7 w-32 text-[10px]" data-testid="select-filter-source">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes sources</SelectItem>
                <SelectItem value="project_payment">Paiement projet</SelectItem>
                <SelectItem value="project_resource">Ressource</SelectItem>
                <SelectItem value="manual">Manuel</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-7 w-36 text-[10px]" data-testid="select-filter-category">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-[10px] gap-1 px-2" data-testid="button-clear-filters">
                <X className="h-2.5 w-2.5" /> Effacer
              </Button>
            )}

            <span className="ml-auto text-[10px] text-muted-foreground">
              {filteredFlows.length} flux
            </span>
          </div>

          {/* Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Date</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Type</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[9px]">Libellé</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Projet</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Catégorie</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Tags</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Statut</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Source</th>
                    <th className="text-right py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Montant</th>
                    <th className="text-right py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Balance</th>
                    <th className="py-1.5 px-3 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 11 }).map((_, j) => (
                          <td key={j} className="py-1.5 px-3"><Skeleton className="h-3 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  ) : flowsWithBalance.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-muted-foreground text-xs">
                        Aucun flux pour les filtres sélectionnés
                      </td>
                    </tr>
                  ) : (
                    flowsWithBalance.map((flow) => (
                      <tr
                        key={flow.id}
                        className="border-b hover:bg-muted/30 transition-colors group"
                        data-testid={`row-flow-${flow.id}`}
                      >
                        <td className="py-1.5 px-3 text-muted-foreground text-[10px] whitespace-nowrap">
                          {new Date(flow.date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-1.5 px-3">
                          {flow.type === "income" ? (
                            <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400 text-[10px] font-medium">
                              <ArrowDownLeft className="h-2.5 w-2.5" /> Entrée
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 text-[10px] font-medium">
                              <ArrowUpRight className="h-2.5 w-2.5" /> Sortie
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 max-w-44">
                          <span className="text-xs font-medium truncate block leading-tight">{flow.label}</span>
                          {flow.clientName && (
                            <span className="text-[10px] text-muted-foreground leading-tight">{flow.clientName}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-[10px] text-muted-foreground max-w-32 truncate">
                          {flow.projectName ?? "—"}
                        </td>
                        <td className="py-1.5 px-3">
                          {flow.categoryName ? (
                            <span className="flex items-center gap-1">
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: flow.categoryColor ?? "#6366f1" }}
                              />
                              <span className="text-[10px] truncate">{flow.categoryName}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3">
                          <div className="flex flex-wrap gap-0.5">
                            {(flow.tags ?? []).slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="text-[9px] px-1 py-0 rounded border border-border bg-muted/50 text-muted-foreground whitespace-nowrap"
                              >
                                {t}
                              </span>
                            ))}
                            {(flow.tags ?? []).length > 2 && (
                              <span className="text-[9px] px-1 py-0 rounded border border-border bg-muted/50 text-muted-foreground">
                                +{flow.tags.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-3">
                          <span
                            className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap",
                              STATUS_COLORS[flow.status] ?? STATUS_COLORS.planned
                            )}
                          >
                            {STATUS_LABELS[flow.status] ?? flow.status}
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            {flow.sourceType === "manual" ? (
                              <><User className="h-2.5 w-2.5" /> Manuel</>
                            ) : (
                              <><Bot className="h-2.5 w-2.5" /> Auto</>
                            )}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-right whitespace-nowrap">
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              flow.type === "income"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            )}
                          >
                            {flow.type === "income" ? "+" : "−"}{fmt(flow.amount)}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-right whitespace-nowrap">
                          <span
                            className={cn(
                              "text-[10px] font-medium tabular-nums",
                              flow.status === "cancelled"
                                ? "text-muted-foreground"
                                : flow.runningBalance >= 0
                                ? "text-foreground"
                                : "text-red-600 dark:text-red-400"
                            )}
                          >
                            {fmt(flow.runningBalance)}
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          {flow.sourceType === "manual" && flow.manualId && (
                            <div className="flex items-center gap-0.5 invisible group-hover:visible">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5"
                                onClick={() => { setEditFlow(flow); setPanelOpen(true); }}
                                data-testid={`button-edit-flow-${flow.id}`}
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 text-destructive"
                                onClick={() => {
                                  if (confirm("Supprimer ce flux ?")) deleteMutation.mutate(flow.manualId!);
                                }}
                                data-testid={`button-delete-flow-${flow.id}`}
                              >
                                <Trash2 className="h-2.5 w-2.5" />
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
            <Card className="border-red-400/30 bg-red-50/50 dark:bg-red-950/20">
              <CardContent className="py-2.5 px-4 flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-800 dark:text-red-300">
                    Point bas de trésorerie négatif
                  </p>
                  <p className="text-[10px] text-red-700 dark:text-red-400">
                    Minimum projeté : <strong>{fmt(kpis.lowestPoint)}</strong>. Anticipez un financement ou décalez des sorties.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Side panel (add / edit flow) ── */}
        <TxPanel
          open={panelOpen}
          onClose={() => { setPanelOpen(false); setEditFlow(null); }}
          editFlow={editFlow}
          categories={categories}
          projects={projects}
        />
      </div>
    </div>
  );
}
