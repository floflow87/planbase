import { useState, useMemo, useEffect, Fragment } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
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
  BarChart2,
  Eye,
  Repeat,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Check,
  Table2,
  Info,
  Copy,
  Tag,
  Sparkles,
  FolderKanban,
  Loader2,
  ArrowRightLeft,
  MapPin,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parse } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";

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
  scenarioId?: string | null;
  recurrence?: string;
};

type TreasuryScenario = {
  id: string;
  name: string;
  color: string | null;
  description?: string | null;
  isBase: number;
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
  scenarios: TreasuryScenario[];
  projects: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  settings: { startingCash: string; alertThreshold: string | null; defaultViewRange: string };
};

// ── Plan de trésorerie types ──────────────────────────────────────────────────

type PlanLine = {
  id: string;
  rubrique: string;
  label: string;
  position: number;
  source_type: string;
  source_id?: string | null;
};

type PlanCell = {
  id: string;
  line_id: string;
  period_key: string;
  amount: number;
  formula?: string | null;
  cell_color?: string | null;
};

const CELL_COLORS: Array<{ key: string; bg: string; text: string; label: string }> = [
  { key: "red", bg: "#fee2e2", text: "#b91c1c", label: "Rouge" },
  { key: "orange", bg: "#ffedd5", text: "#c2410c", label: "Orange" },
  { key: "gray", bg: "#f3f4f6", text: "#4b5563", label: "Gris" },
  { key: "green", bg: "#dcfce7", text: "#15803d", label: "Vert" },
];

type PlanSettings = {
  initialBalance: number;
  granularity: "week" | "month";
};

type PlanScenario = {
  id: string;
  name: string;
  initial_balance: number;
  granularity: string;
};

type PlanData = {
  lines: PlanLine[];
  cells: PlanCell[];
  settings: PlanSettings;
  planScenarios: PlanScenario[];
};

const RUBRIQUES: Array<{ key: string; label: string; type: "income" | "expense" }> = [
  { key: "entrees_clients", label: "Entrées clients", type: "income" },
  { key: "entrees_exceptionnelles", label: "Entrées exceptionnelles", type: "income" },
  { key: "sorties_ressources", label: "Sorties ressources", type: "expense" },
  { key: "sorties_abonnement", label: "Sorties abonnement", type: "expense" },
  { key: "sorties_charges", label: "Sorties charges", type: "expense" },
  { key: "sorties_exceptionnelles", label: "Sorties exceptionnelles", type: "expense" },
];

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
    // If a period range is set, only include flows within it
    if (periodRange && (f.date < periodRange.from || f.date > periodRange.to)) continue;
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

// ── Synthesis data builder ────────────────────────────────────────────────────

type SynthesisMonth = {
  key: string;       // "YYYY-MM"
  label: string;     // "Août 25"
  isCurrent: boolean;
  startBalance: number;
  income: number;
  expense: number;
  endBalance: number;
};

function buildSynthesisData(
  flows: TreasuryFlow[],
  statuses: string[],
  startingCash: number,
  periodRange?: { from: string; to: string }
): SynthesisMonth[] {
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const filtered = flows.filter((f) => statuses.includes(f.status));
  const monthMap: Record<string, { income: number; expense: number }> = {};

  // Pre-fill months in period
  if (periodRange) {
    let cur = new Date(periodRange.from.substring(0, 7) + "-01");
    const end = new Date(periodRange.to.substring(0, 7) + "-01");
    while (cur <= end) {
      const key = cur.toISOString().substring(0, 7);
      monthMap[key] = { income: 0, expense: 0 };
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }

  for (const f of filtered) {
    if (periodRange && (f.date < periodRange.from || f.date > periodRange.to)) continue;
    const key = f.date.substring(0, 7);
    if (!monthMap[key]) monthMap[key] = { income: 0, expense: 0 };
    if (f.type === "income") monthMap[key].income += f.amount;
    else monthMap[key].expense += f.amount;
  }

  let running = startingCash;
  return Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { income, expense }]) => {
      const startBalance = running;
      running += income - expense;
      const endBalance = running;
      const [year, month] = key.split("-");
      const label = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString("fr-FR", {
        month: "short",
        year: "2-digit",
      });
      return {
        key,
        label,
        isCurrent: key === currentKey,
        startBalance: Math.round(startBalance),
        income: Math.round(income),
        expense: Math.round(expense),
        endBalance: Math.round(endBalance),
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
  white,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  highlight?: "green" | "red" | "amber";
  white?: boolean;
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
    <Card className={cn(highlightCls, white && "bg-white dark:bg-card")}>
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
  recurrence: string;
  recurrenceEnd: string;
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
  recurrence: "none",
  recurrenceEnd: "",
});

function expandRecurrenceDates(startDate: string, recurrence: string, endDate: string): string[] {
  if (recurrence === "none" || !endDate) return [startDate];
  const dates: string[] = [];
  let cur = new Date(startDate);
  const end = new Date(endDate);
  const MAX = 60;
  while (cur <= end && dates.length < MAX) {
    dates.push(cur.toISOString().split("T")[0]);
    if (recurrence === "weekly") cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7);
    else if (recurrence === "monthly") cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate());
    else if (recurrence === "quarterly") cur = new Date(cur.getFullYear(), cur.getMonth() + 3, cur.getDate());
    else if (recurrence === "yearly") cur = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate());
    else break;
  }
  return dates;
}

function TxPanel({
  open,
  onClose,
  editFlow,
  categories,
  projects,
  activeScenarioId,
}: {
  open: boolean;
  onClose: () => void;
  editFlow: TreasuryFlow | null;
  categories: TreasuryCategory[];
  projects: { id: string; name: string }[];
  activeScenarioId: string | null;
}) {
  const { t } = useLanguage();
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
          recurrence: editFlow.recurrence ?? "none",
          recurrenceEnd: "",
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

  const handleSubmit = async () => {
    if (!form.amount || !form.label || !form.date) {
      toast({ title: "Champs requis", description: "Date, libellé et montant sont obligatoires.", variant: "destructive" });
      return;
    }

    const basePayload: Record<string, unknown> = {
      type: form.type,
      amount: parseFloat(form.amount).toFixed(2),
      label: form.label,
      description: form.description || null,
      categoryId: form.categoryId || null,
      projectId: form.projectId || null,
      status: form.status,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      recurrence: form.recurrence,
      scenarioId: activeScenarioId || null,
    };

    if (isEdit) {
      updateMutation.mutate({ ...basePayload, date: form.date });
    } else {
      const dates = expandRecurrenceDates(form.date, form.recurrence, form.recurrenceEnd);
      for (const d of dates) {
        await apiRequest("/api/treasury/transactions", "POST", { ...basePayload, date: d });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/flows"] });
      const count = dates.length;
      toast({
        title: count > 1 ? `${count} flux ajoutés` : "Flux ajouté",
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
      onClose();
    }
  };

  const filteredCats = categories.filter((c) => c.type === form.type);
  const isPending = createMutation.isPending || updateMutation.isPending;
  const isRecurring = form.recurrence !== "none";

  if (!open) return null;

  return (
    <aside className="w-80 border-l bg-card shadow-sm overflow-y-auto shrink-0 flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <span className="text-base font-semibold text-foreground">
          {isEdit ? t.treasury.editFlow : t.treasury.newFlow}
        </span>
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-panel-close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-3 p-4 flex-1">

        {/* Type + Statut */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "income" | "expense", categoryId: "" }))}>
              <SelectTrigger className="h-8 text-xs mt-0.5" data-testid="select-tx-type"><SelectValue /></SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="income" className="text-xs">Entrée</SelectItem>
                <SelectItem value="expense" className="text-xs">Sortie</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Statut</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger className="h-8 text-xs mt-0.5" data-testid="select-tx-status"><SelectValue /></SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="planned" className="text-xs">Prévu</SelectItem>
                <SelectItem value="confirmed" className="text-xs">Confirmé</SelectItem>
                {form.type === "income" && <SelectItem value="received" className="text-xs">Reçu</SelectItem>}
                {form.type === "expense" && <SelectItem value="paid" className="text-xs">Payé</SelectItem>}
                <SelectItem value="cancelled" className="text-xs">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date + Montant */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 text-xs mt-0.5 w-full justify-start font-normal" data-testid="input-tx-date" type="button">
                  <CalendarIcon className="mr-1.5 h-3 w-3" />
                  {form.date ? format(parse(form.date, "yyyy-MM-dd", new Date()), "d MMM yyyy", { locale: fr }) : <span className="text-muted-foreground">Date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.date ? parse(form.date, "yyyy-MM-dd", new Date()) : undefined}
                  onSelect={(date) => setForm((f) => ({ ...f, date: date ? format(date, "yyyy-MM-dd") : "" }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Montant (€)</Label>
            <Input type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="h-8 text-xs mt-0.5" data-testid="input-tx-amount" />
          </div>
        </div>

        {/* Libellé */}
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Libellé</Label>
          <Input placeholder={t.common.ph.shortDescription} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="h-8 text-xs mt-0.5" data-testid="input-tx-label" />
        </div>

        {/* Catégorie */}
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.treasury.category}</Label>
          <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
            <SelectTrigger className="h-8 text-xs mt-0.5" data-testid="select-tx-category"><SelectValue placeholder={t.treasury.categoryPlaceholder} /></SelectTrigger>
            <SelectContent className="text-xs">
              {filteredCats.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Projet */}
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Projet (optionnel)</Label>
          <Select value={form.projectId} onValueChange={(v) => setForm((f) => ({ ...f, projectId: v === "_none" ? "" : v }))}>
            <SelectTrigger className="h-8 text-xs mt-0.5" data-testid="select-tx-project"><SelectValue placeholder={t.common.ph.selectProject} /></SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="_none" className="text-xs">Aucun</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Récurrence */}
        {!isEdit && (
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Repeat className="h-3 w-3" /> Récurrence
            </Label>
            <Select value={form.recurrence} onValueChange={(v) => setForm((f) => ({ ...f, recurrence: v }))}>
              <SelectTrigger className="h-8 text-xs mt-0.5" data-testid="select-tx-recurrence"><SelectValue /></SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="none" className="text-xs">Ponctuelle</SelectItem>
                <SelectItem value="weekly" className="text-xs">Hebdomadaire</SelectItem>
                <SelectItem value="monthly" className="text-xs">Mensuelle</SelectItem>
                <SelectItem value="quarterly" className="text-xs">Trimestrielle</SelectItem>
                <SelectItem value="yearly" className="text-xs">Annuelle</SelectItem>
              </SelectContent>
            </Select>
            {isRecurring && (
              <div className="mt-2">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 text-xs mt-0.5 w-full justify-start font-normal" data-testid="input-tx-recurrence-end" type="button">
                      <CalendarIcon className="mr-1.5 h-3 w-3" />
                      {form.recurrenceEnd ? format(parse(form.recurrenceEnd, "yyyy-MM-dd", new Date()), "d MMM yyyy", { locale: fr }) : <span className="text-muted-foreground">Date de fin</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.recurrenceEnd ? parse(form.recurrenceEnd, "yyyy-MM-dd", new Date()) : undefined}
                      onSelect={(date) => setForm((f) => ({ ...f, recurrenceEnd: date ? format(date, "yyyy-MM-dd") : "" }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {form.recurrenceEnd && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {expandRecurrenceDates(form.date, form.recurrence, form.recurrenceEnd).length} occurrence(s)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tags (virgule)</Label>
          <Input placeholder={t.common.ph.tagsExample} value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} className="h-8 text-xs mt-0.5" data-testid="input-tx-tags" />
        </div>

        {/* Note */}
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Note</Label>
          <Textarea placeholder={t.common.ph.description} rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="text-xs mt-0.5" data-testid="input-tx-desc" />
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

// ── Plan cell component (click-to-select, dbl-click-to-edit, fill handle) ─────

function PlanCell({
  lineId, periodKey, value, isFillRange, isSelected, hasValue, colW, fmt,
  cellColor, hasClipboard,
  onSelect, onStartEdit, onFillDragStart, onCopy, onPaste, onSetColor,
}: {
  lineId: string; periodKey: string; value: number; isFillRange: boolean;
  isSelected: boolean; hasValue: boolean; colW: number;
  fmt: (n: number) => string;
  cellColor?: string | null;
  hasClipboard: boolean;
  onSelect: () => void; onStartEdit: () => void; onFillDragStart: () => void;
  onCopy: () => void; onPaste: () => void; onSetColor: (color: string | null) => void;
}) {
  const colorDef = cellColor ? CELL_COLORS.find((c) => c.key === cellColor) : null;
  const cellStyle = colorDef ? { backgroundColor: colorDef.bg, color: colorDef.text } : undefined;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="relative group/cell" style={cellStyle ? { borderRadius: 3 } : undefined}>
          <button
            onClick={onSelect}
            onDoubleClick={onStartEdit}
            className={cn(
              "w-full text-right text-[11px] tabular-nums px-1 py-1 rounded transition-colors block outline-none",
              isFillRange ? "text-blue-700 dark:text-blue-300 font-medium" : "",
              isSelected ? "ring-1 ring-primary bg-primary/10" : !colorDef ? "hover:bg-muted/60" : "",
            )}
            style={{ minWidth: colW - 8, ...(colorDef && !isSelected ? cellStyle : {}) }}
            data-testid={`cell-plan-${lineId}-${periodKey}`}
          >
            {value !== 0 ? (
              <span>{fmt(value)}</span>
            ) : (
              <span className={isSelected ? "text-muted-foreground/60" : colorDef ? "" : "text-border/50"}>—</span>
            )}
          </button>
          {hasValue && (
            <div
              onMouseDown={(e) => { e.preventDefault(); onFillDragStart(); }}
              className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 bg-primary rounded-sm cursor-crosshair opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 flex items-center justify-center"
              title="Glisser pour étirer la valeur"
              data-testid={`fill-handle-${lineId}-${periodKey}`}
            />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={onCopy} className="text-xs gap-2">
          <Copy className="h-3 w-3" />
          Copier
        </ContextMenuItem>
        <ContextMenuItem onClick={onPaste} disabled={!hasClipboard} className="text-xs gap-2">
          <Copy className="h-3 w-3 opacity-50 scale-x-[-1]" />
          Coller
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger className="text-xs gap-2">
            <span className="h-3 w-3 rounded-sm inline-block border border-border" style={{ background: colorDef?.bg ?? "transparent" }} />
            Mise en forme
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-36">
            {CELL_COLORS.map((c) => (
              <ContextMenuItem
                key={c.key}
                className="text-xs gap-2"
                onClick={() => onSetColor(cellColor === c.key ? null : c.key)}
              >
                <span className="h-3.5 w-3.5 rounded-sm shrink-0 border" style={{ backgroundColor: c.bg, borderColor: c.text + "40" }} />
                {c.label}
                {cellColor === c.key && <Check className="h-3 w-3 ml-auto" />}
              </ContextMenuItem>
            ))}
            {cellColor && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem className="text-xs text-muted-foreground gap-2" onClick={() => onSetColor(null)}>
                  <X className="h-3 w-3" />
                  Effacer
                </ContextMenuItem>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ── Plan de trésorerie View ────────────────────────────────────────────────────

function TreasuryPlanView({ projects, flows }: { projects: Array<{ id: string; name: string }>; flows: TreasuryFlow[] }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [expandedRubriques, setExpandedRubriques] = useState<Set<string>>(
    new Set(RUBRIQUES.map((r) => r.key))
  );
  const [editingCell, setEditingCell] = useState<{ lineId: string; periodKey: string } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ lineId: string; periodKey: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addingToRubrique, setAddingToRubrique] = useState<string | null>(null);
  const [newLineLabel, setNewLineLabel] = useState("");
  const [localCells, setLocalCells] = useState<Record<string, Record<string, number>>>({});
  const [localFormulas, setLocalFormulas] = useState<Record<string, Record<string, string>>>({});
  const [localColors, setLocalColors] = useState<Record<string, Record<string, string>>>({});
  const [cellClipboard, setCellClipboard] = useState<{ formula: string; amount: number } | null>(null);
  const [localSettings, setLocalSettings] = useState<PlanSettings>({ initialBalance: 0, granularity: "month" });
  const [editingInitBalance, setEditingInitBalance] = useState(false);
  const [initBalanceValue, setInitBalanceValue] = useState("");
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingLineLabel, setEditingLineLabel] = useState("");
  const [fillDrag, setFillDrag] = useState<{ lineId: string; startIdx: number; value: number } | null>(null);
  const [fillEndIdx, setFillEndIdx] = useState<number | null>(null);

  // Undo/redo history
  type CellSnapshot = { lineId: string; periodKey: string; prevAmount: number; nextAmount: number };
  const [undoStack, setUndoStack] = useState<CellSnapshot[][]>([]);
  const [redoStack, setRedoStack] = useState<CellSnapshot[][]>([]);

  // Plan scenarios
  const [activePlanScenarioId, setActivePlanScenarioId] = useState<string | null>(null);
  const [showCreatePlanScenario, setShowCreatePlanScenario] = useState(false);
  const [newPlanScenarioName, setNewPlanScenarioName] = useState("");
  const [deletePlanScenarioConfirm, setDeletePlanScenarioConfirm] = useState<{ id: string; name: string } | null>(null);
  const [renamePlanScenarioId, setRenamePlanScenarioId] = useState<string | null>(null);
  const [renamePlanScenarioName, setRenamePlanScenarioName] = useState("");

  // Sync entrées dialog
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncSelectedProjects, setSyncSelectedProjects] = useState<Set<string>>(new Set());

  const planQueryKey = activePlanScenarioId
    ? ["/api/treasury/plan", activePlanScenarioId]
    : ["/api/treasury/plan"];

  const planQueryUrl = activePlanScenarioId
    ? `/api/treasury/plan?planScenarioId=${activePlanScenarioId}`
    : "/api/treasury/plan";

  const { data: planData, isLoading } = useQuery<PlanData>({
    queryKey: planQueryKey,
    queryFn: () => apiRequest(planQueryUrl, "GET").then((r) => r.json()),
    refetchOnMount: true,
    staleTime: 0,
  });

  useEffect(() => {
    if (!planData) return;
    const cm: Record<string, Record<string, number>> = {};
    const fm: Record<string, Record<string, string>> = {};
    const colm: Record<string, Record<string, string>> = {};
    for (const c of planData.cells) {
      if (!cm[c.line_id]) cm[c.line_id] = {};
      cm[c.line_id][c.period_key] = Number(c.amount);
      if (c.formula) {
        if (!fm[c.line_id]) fm[c.line_id] = {};
        fm[c.line_id][c.period_key] = c.formula;
      }
      if (c.cell_color) {
        if (!colm[c.line_id]) colm[c.line_id] = {};
        colm[c.line_id][c.period_key] = c.cell_color;
      }
    }
    setLocalCells(cm);
    setLocalFormulas(fm);
    setLocalColors(colm);
    setLocalSettings(planData.settings);
  }, [planData]);

  const createPlanScenarioMutation = useMutation({
    mutationFn: (name: string) => apiRequest("/api/treasury/plan/scenarios", "POST", { name }),
    onSuccess: (res: any) => res.json().then((s: PlanScenario) => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/plan"] });
      setActivePlanScenarioId(s.id);
      setNewPlanScenarioName("");
      setShowCreatePlanScenario(false);
      toast({ title: `Scénario "${s.name}" créé`, className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100" });
    }),
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deletePlanScenarioMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/treasury/plan/scenarios/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/plan"] });
      setActivePlanScenarioId(null);
      setDeletePlanScenarioConfirm(null);
    },
  });

  const renamePlanScenarioMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiRequest(`/api/treasury/plan/scenarios/${id}`, "PATCH", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/plan"] });
      setRenamePlanScenarioId(null);
      setRenamePlanScenarioName("");
      toast({ title: "Scénario renommé", className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const duplicatePlanScenarioMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/treasury/plan/scenarios/${id}/duplicate`, "POST", {}),
    onSuccess: (res: any) => res.json().then((s: PlanScenario) => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/plan"] });
      setActivePlanScenarioId(s.id);
      toast({ title: `Scénario "${s.name}" créé`, className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100" });
    }),
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const saveCellColorMutation = useMutation({
    mutationFn: ({ lineId, periodKey, cell_color }: { lineId: string; periodKey: string; cell_color: string | null }) =>
      apiRequest("/api/treasury/plan/cells/color", "PUT", { lineId, periodKey, cell_color }),
    onError: (_err, { lineId, periodKey, cell_color }) => {
      // Revert optimistic local update: restore previous color (inverse of what we applied)
      setLocalColors((prev) => {
        const next = { ...prev };
        if (cell_color === null) {
          // We tried to clear; the old color is unknown — invalidate query to re-sync from server
        } else {
          // We tried to set a color; clear it locally to resync
          const lc = { ...(next[lineId] ?? {}) };
          delete lc[periodKey];
          next[lineId] = lc;
        }
        return next;
      });
      queryClient.invalidateQueries({ queryKey: planQueryKey });
    },
  });

  const createLineMutation = useMutation({
    mutationFn: (body: { rubrique: string; label: string; planScenarioId?: string | null }) =>
      apiRequest("/api/treasury/plan/lines", "POST", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planQueryKey });
      toast({ title: "Ligne ajoutée", className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600" });
      setAddingToRubrique(null);
      setNewLineLabel("");
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/treasury/plan/lines/${id}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planQueryKey }),
  });

  type CellPayload = { lineId: string; periodKey: string; amount: number; formula?: string | null; cell_color?: string | null };
  const saveCellMutation = useMutation({
    mutationFn: (cells: Array<CellPayload>) =>
      apiRequest("/api/treasury/plan/cells", "PUT", { cells }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planQueryKey }),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (s: PlanSettings) =>
      apiRequest("/api/treasury/plan/settings", "PUT", { ...s, planScenarioId: activePlanScenarioId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planQueryKey }),
  });

  const updateLineLabelMutation = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      apiRequest(`/api/treasury/plan/lines/${id}`, "PATCH", { label }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planQueryKey }),
  });

  const moveLineRubriqueMutation = useMutation({
    mutationFn: ({ id, rubrique }: { id: string; rubrique: string }) =>
      apiRequest(`/api/treasury/plan/lines/${id}`, "PATCH", { rubrique }),
    onMutate: async ({ id, rubrique }) => {
      await queryClient.cancelQueries({ queryKey: planQueryKey });
      const prev = queryClient.getQueryData<PlanData>(planQueryKey);
      if (prev) {
        queryClient.setQueryData<PlanData>(planQueryKey, {
          ...prev,
          lines: prev.lines.map((l) => l.id === id ? { ...l, rubrique } : l),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(planQueryKey, ctx.prev);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planQueryKey });
      toast({ title: "Ligne déplacée", className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600" });
    },
  });

  const duplicateLineMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/treasury/plan/lines/${id}/duplicate`, "POST", {}),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: planQueryKey });
      const prev = queryClient.getQueryData<PlanData>(planQueryKey);
      const srcLine = prev?.lines?.find((l) => l.id === id);
      if (srcLine && prev) {
        const tempId = `temp-dup-${Date.now()}`;
        const srcCells = localCells[id] ?? {};
        setLocalCells((lc) => ({ ...lc, [tempId]: { ...srcCells } }));
        queryClient.setQueryData<PlanData>(planQueryKey, {
          ...prev,
          lines: [...(prev.lines ?? []), { ...srcLine, id: tempId, label: `${srcLine.label} (copie)` }],
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(planQueryKey, ctx.prev);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planQueryKey });
      toast({ title: "Ligne dupliquée", className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600" });
    },
  });

  const syncEntriesMutation = useMutation({
    mutationFn: async (projectIds: string[]) => {
      // Helper: compute period key from a date string based on granularity
      const toPeriodKey = (dateStr: string): string => {
        if (localSettings.granularity === "month") {
          return dateStr.substring(0, 7); // "YYYY-MM"
        }
        // Weekly: find the Monday of the week containing the date
        const d = new Date(dateStr);
        const day = d.getDay();
        d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
        const year = d.getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
        return `${year}-W${String(weekNum).padStart(2, "0")}`;
      };

      // Priority 1: project_payment flows (individual échéances with their dates)
      const paymentFlows = flows.filter(
        (f) => f.sourceType === "project_payment" && f.projectId && projectIds.includes(f.projectId)
      );

      // Group payment flows by project, then by period
      const byProject: Record<string, { name: string; periodAmounts: Record<string, number> }> = {};
      for (const f of paymentFlows) {
        if (!byProject[f.projectId!]) byProject[f.projectId!] = { name: f.projectName ?? f.projectId!, periodAmounts: {} };
        const pk = toPeriodKey(f.date);
        byProject[f.projectId!].periodAmounts[pk] = (byProject[f.projectId!].periodAmounts[pk] ?? 0) + f.amount;
      }

      // Priority 2: for selected projects with no project_payment flows, use total income flows at current period
      const now = new Date();
      const currentPeriodKey = toPeriodKey(now.toISOString().substring(0, 10));
      const projectsWithPayments = new Set(Object.keys(byProject));
      const fallbackFlows = flows.filter(
        (f) => f.type === "income" && f.projectId && projectIds.includes(f.projectId) && !projectsWithPayments.has(f.projectId!)
      );
      for (const f of fallbackFlows) {
        if (!byProject[f.projectId!]) byProject[f.projectId!] = { name: f.projectName ?? f.projectId!, periodAmounts: {} };
        byProject[f.projectId!].periodAmounts[currentPeriodKey] = (byProject[f.projectId!].periodAmounts[currentPeriodKey] ?? 0) + f.amount;
      }

      let count = 0;
      for (const [, { name, periodAmounts }] of Object.entries(byProject)) {
        const lineRes = await apiRequest("/api/treasury/plan/lines", "POST", {
          rubrique: "entrees_clients",
          label: name,
          planScenarioId: activePlanScenarioId,
        });
        const created = await lineRes.json();
        if (created?.id) {
          const cells = Object.entries(periodAmounts)
            .filter(([, amount]) => amount > 0)
            .map(([periodKey, amount]) => ({ lineId: created.id, periodKey, amount }));
          if (cells.length > 0) {
            await apiRequest("/api/treasury/plan/cells", "PUT", { cells });
          }
          count++;
        }
      }
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: planQueryKey });
      setSyncDialogOpen(false);
      toast({
        title: `${count} ligne${count > 1 ? "s" : ""} importée${count > 1 ? "s" : ""}`,
        description: "Les entrées clients ont été synchronisées avec le plan.",
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
    },
    onError: (e: any) => toast({ title: "Erreur sync", description: e.message, variant: "destructive" }),
  });

  const periods = useMemo(() => {
    const result: Array<{ key: string; label: string; isCurrent: boolean; subtitle?: string }> = [];
    const now = new Date();
    if (localSettings.granularity === "month") {
      for (let i = -2; i <= 9; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        result.push({
          key,
          label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
          isCurrent: i === 0,
        });
      }
    } else {
      const getMonday = (d: Date) => {
        const copy = new Date(d);
        const day = copy.getDay();
        copy.setDate(copy.getDate() - day + (day === 0 ? -6 : 1));
        return copy;
      };
      const monday = getMonday(new Date());
      for (let i = -2; i <= 17; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i * 7);
        const year = d.getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
        const sun = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6);
        const subtitle = d.getMonth() === sun.getMonth()
          ? `${d.getDate()}-${sun.getDate()} ${sun.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}`
          : `${d.getDate()} ${d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")} - ${sun.getDate()} ${sun.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}`;
        result.push({
          key: `${year}-W${String(weekNum).padStart(2, "0")}`,
          label: `S${weekNum} '${String(year).slice(2)}`,
          isCurrent: i === 0,
          subtitle,
        });
      }
    }
    return result;
  }, [localSettings.granularity]);

  useEffect(() => {
    if (!fillDrag) return;
    const onMouseUp = () => {
      if (fillDrag && fillEndIdx !== null && fillEndIdx > fillDrag.startIdx) {
        const cells: Array<CellPayload> = [];
        const snapshots: Array<{ lineId: string; periodKey: string; prevAmount: number; nextAmount: number }> = [];
        const affected: Array<{ lineId: string; periodKey: string }> = [];
        const ps = periods;
        for (let i = fillDrag.startIdx + 1; i <= fillEndIdx; i++) {
          if (ps[i]) {
            const prevAmount = localCells[fillDrag.lineId]?.[ps[i].key] ?? 0;
            cells.push({ lineId: fillDrag.lineId, periodKey: ps[i].key, amount: fillDrag.value, formula: null });
            snapshots.push({ lineId: fillDrag.lineId, periodKey: ps[i].key, prevAmount, nextAmount: fillDrag.value });
            affected.push({ lineId: fillDrag.lineId, periodKey: ps[i].key });
            setLocalCells((lc) => ({
              ...lc,
              [fillDrag.lineId]: { ...(lc[fillDrag.lineId] ?? {}), [ps[i].key]: fillDrag.value },
            }));
          }
        }
        if (cells.length > 0) {
          clearFormulasForEntries(affected);
          saveCellMutation.mutate(cells);
          setUndoStack((prev) => [...prev, snapshots]);
          setRedoStack([]);
        }
      }
      setFillDrag(null);
      setFillEndIdx(null);
    };
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [fillDrag, fillEndIdx, periods]);

  const getCellValue = (lineId: string, periodKey: string): number =>
    localCells[lineId]?.[periodKey] ?? 0;

  const getRubriqueTotal = (rubriqKey: string, periodKey: string): number =>
    (planData?.lines ?? [])
      .filter((l) => l.rubrique === rubriqKey)
      .reduce((sum, l) => sum + getCellValue(l.id, periodKey), 0);

  const getTotalEntrees = (periodKey: string): number =>
    ["entrees_clients", "entrees_exceptionnelles"].reduce((s, k) => s + getRubriqueTotal(k, periodKey), 0);

  const getTotalSorties = (periodKey: string): number =>
    ["sorties_ressources", "sorties_abonnement", "sorties_charges", "sorties_exceptionnelles"].reduce((s, k) => s + getRubriqueTotal(k, periodKey), 0);

  const balances = useMemo(() => {
    let balance = localSettings.initialBalance;
    const result: Record<string, { variation: number; balance: number }> = {};
    for (const p of periods) {
      const variation = getTotalEntrees(p.key) - getTotalSorties(p.key);
      balance += variation;
      result[p.key] = { variation, balance };
    }
    return result;
  }, [periods, localCells, localSettings.initialBalance, planData?.lines]);

  const evalFormula = (raw: string): number => {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("=")) return parseFloat(trimmed) || 0;
    const expr = trimmed.slice(1).replace(/,/g, ".");
    if (!/^[\d\s+\-*/().%]+$/.test(expr)) return 0;
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict"; return (${expr})`)();
      return typeof result === "number" && isFinite(result) ? Math.round(result * 100) / 100 : 0;
    } catch {
      return 0;
    }
  };

  const handleCellSave = (lineId: string, periodKey: string) => {
    const amount = evalFormula(editValue);
    const prevAmount = getCellValue(lineId, periodKey);
    const rawIsFormula = editValue.trim().startsWith("=");
    const formula = rawIsFormula ? editValue.trim() : null;
    setLocalCells((prev) => ({ ...prev, [lineId]: { ...(prev[lineId] ?? {}), [periodKey]: amount } }));
    if (formula) {
      setLocalFormulas((prev) => ({ ...prev, [lineId]: { ...(prev[lineId] ?? {}), [periodKey]: formula } }));
    } else {
      setLocalFormulas((prev) => {
        const next = { ...prev };
        if (next[lineId]) {
          const lineCopy = { ...next[lineId] };
          delete lineCopy[periodKey];
          next[lineId] = lineCopy;
        }
        return next;
      });
    }
    saveCellMutation.mutate([{ lineId, periodKey, amount, formula, cell_color: localColors[lineId]?.[periodKey] ?? null }]);
    setEditingCell(null);
    if (prevAmount !== amount) {
      setUndoStack((prev) => [...prev, [{ lineId, periodKey, prevAmount, nextAmount: amount }]]);
      setRedoStack([]);
    }
  };

  const clearFormulasForEntries = (entries: Array<{ lineId: string; periodKey: string }>) => {
    setLocalFormulas((prev) => {
      const next = { ...prev };
      for (const e of entries) {
        if (next[e.lineId]?.[e.periodKey] !== undefined) {
          const lc = { ...next[e.lineId] };
          delete lc[e.periodKey];
          next[e.lineId] = lc;
        }
      }
      return next;
    });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const entries = undoStack[undoStack.length - 1];
    const cells = entries.map((e) => ({ lineId: e.lineId, periodKey: e.periodKey, amount: e.prevAmount, formula: null as null }));
    setLocalCells((prev) => {
      const next = { ...prev };
      for (const e of entries) {
        next[e.lineId] = { ...(next[e.lineId] ?? {}), [e.periodKey]: e.prevAmount };
      }
      return next;
    });
    clearFormulasForEntries(entries);
    saveCellMutation.mutate(cells);
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, entries]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const entries = redoStack[redoStack.length - 1];
    const cells = entries.map((e) => ({ lineId: e.lineId, periodKey: e.periodKey, amount: e.nextAmount, formula: null as null }));
    setLocalCells((prev) => {
      const next = { ...prev };
      for (const e of entries) {
        next[e.lineId] = { ...(next[e.lineId] ?? {}), [e.periodKey]: e.nextAmount };
      }
      return next;
    });
    clearFormulasForEntries(entries);
    saveCellMutation.mutate(cells);
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, entries]);
  };

  const handleDeleteSelectedCell = () => {
    if (!selectedCell || editingCell) return;
    const { lineId, periodKey } = selectedCell;
    const prevAmount = getCellValue(lineId, periodKey);
    if (prevAmount === 0 && !localFormulas[lineId]?.[periodKey]) return;
    setLocalCells((prev) => ({ ...prev, [lineId]: { ...(prev[lineId] ?? {}), [periodKey]: 0 } }));
    setLocalFormulas((prev) => {
      const next = { ...prev };
      if (next[lineId]) {
        const lc = { ...next[lineId] };
        delete lc[periodKey];
        next[lineId] = lc;
      }
      return next;
    });
    saveCellMutation.mutate([{ lineId, periodKey, amount: 0, formula: null }]);
    setUndoStack((prev) => [...prev, [{ lineId, periodKey, prevAmount, nextAmount: 0 }]]);
    setRedoStack([]);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea/contenteditable
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;

      // Ctrl+Z = undo (always, even in inputs except native undo)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (isInput) return; // let the browser handle native undo in inputs
        e.preventDefault();
        handleUndo();
        return;
      }
      // Ctrl+Y or Ctrl+Shift+Z = redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        if (isInput) return;
        e.preventDefault();
        handleRedo();
        return;
      }
      // Delete/Suppr = clear selected cell (only when not editing)
      if ((e.key === "Delete") && !isInput && selectedCell && !editingCell) {
        e.preventDefault();
        handleDeleteSelectedCell();
        return;
      }
      // Enter or F2 = open editor on selected cell (formula-first, consistent with double-click)
      if ((e.key === "Enter" || e.key === "F2") && !isInput && selectedCell && !editingCell) {
        e.preventDefault();
        const rawFormula = localFormulas[selectedCell.lineId]?.[selectedCell.periodKey];
        const val = getCellValue(selectedCell.lineId, selectedCell.periodKey);
        setEditingCell(selectedCell);
        setEditValue(rawFormula ?? (val !== 0 ? String(val) : ""));
        setSelectedCell(null);
        return;
      }
      // Escape = deselect cell
      if (e.key === "Escape" && selectedCell && !editingCell) {
        setSelectedCell(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undoStack, redoStack, selectedCell, editingCell]);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  const COL_W = 92;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Granularity selector */}
        <div className="flex items-center rounded-md border overflow-hidden shrink-0">
          {(["month", "week"] as const).map((g) => (
            <button
              key={g}
              onClick={() => {
                const prev = localSettings.granularity;
                const s = { ...localSettings, granularity: g };
                setLocalSettings(s);
                saveSettingsMutation.mutate(s);
                if (prev === "month" && g === "week") {
                  const getWeekKey = (d: Date) => {
                    const year = d.getFullYear();
                    const startOfYear = new Date(year, 0, 1);
                    const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
                    return `${year}-W${String(weekNum).padStart(2, "0")}`;
                  };
                  const newCells: Array<CellPayload> = [];
                  const nextLocalCells: Record<string, Record<string, number>> = {};
                  for (const [lineId, lineCells] of Object.entries(localCells)) {
                    nextLocalCells[lineId] = {};
                    for (const [pk, amount] of Object.entries(lineCells)) {
                      if (amount === 0) continue;
                      if (/^\d{4}-\d{2}$/.test(pk)) {
                        const [yr, mo] = pk.split("-").map(Number);
                        const lastDay = new Date(yr, mo, 0);
                        const weekKey = getWeekKey(lastDay);
                        nextLocalCells[lineId][weekKey] = (nextLocalCells[lineId][weekKey] ?? 0) + amount;
                        newCells.push({ lineId, periodKey: weekKey, amount, formula: null });
                      } else {
                        nextLocalCells[lineId][pk] = amount;
                      }
                    }
                  }
                  setLocalCells(nextLocalCells);
                  setLocalFormulas({});
                  if (newCells.length > 0) saveCellMutation.mutate(newCells);
                } else if (prev === "week" && g === "month") {
                  const newCells: Array<CellPayload> = [];
                  const monthTotals: Record<string, Record<string, number>> = {};
                  for (const [lineId, lineCells] of Object.entries(localCells)) {
                    for (const [pk, amount] of Object.entries(lineCells)) {
                      if (amount === 0) continue;
                      if (/^\d{4}-W\d{2}$/.test(pk)) {
                        const [yr, wStr] = pk.split("-W");
                        const year = parseInt(yr); const weekNum = parseInt(wStr);
                        const jan1 = new Date(year, 0, 1);
                        const daysOff = (1 - jan1.getDay() + 7) % 7;
                        const firstMon = new Date(jan1.getTime() + daysOff * 86400000);
                        const mon = new Date(firstMon.getTime() + (weekNum - 1) * 7 * 86400000);
                        const mKey = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}`;
                        if (!monthTotals[lineId]) monthTotals[lineId] = {};
                        monthTotals[lineId][mKey] = (monthTotals[lineId][mKey] ?? 0) + amount;
                      }
                    }
                  }
                  const nextLocalCells: Record<string, Record<string, number>> = {};
                  for (const [lineId, months] of Object.entries(monthTotals)) {
                    nextLocalCells[lineId] = {};
                    for (const [mKey, amount] of Object.entries(months)) {
                      nextLocalCells[lineId][mKey] = amount;
                      newCells.push({ lineId, periodKey: mKey, amount, formula: null });
                    }
                  }
                  setLocalCells(nextLocalCells);
                  setLocalFormulas({});
                  if (newCells.length > 0) saveCellMutation.mutate(newCells);
                }
              }}
              className={cn(
                "px-3 py-1.5 text-[11px] font-medium transition-colors",
                localSettings.granularity === g
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
              data-testid={`btn-granularity-${g}`}
            >
              {g === "month" ? "Mois" : "Semaine"}
            </button>
          ))}
        </div>

        {/* Plan scenario selector */}
        <div className="flex items-center gap-1.5">
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 px-2" data-testid="btn-plan-scenario-select">
                {activePlanScenarioId && <MapPin className="h-2.5 w-2.5 text-violet-500" />}
                {activePlanScenarioId
                  ? (planData?.planScenarios?.find((s) => s.id === activePlanScenarioId)?.name ?? "Scénario")
                  : "Plan de base"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-[10px]">Scénarios du plan</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setActivePlanScenarioId(null)}
                className="text-xs gap-2"
              >
                {!activePlanScenarioId
                  ? <MapPin className="h-3 w-3 text-violet-500" />
                  : <span className="w-3" />}
                <span className={!activePlanScenarioId ? "font-medium" : ""}>Plan de base</span>
              </DropdownMenuItem>
              {(planData?.planScenarios ?? []).map((s) => (
                <DropdownMenuItem key={s.id} className="text-xs gap-2 justify-between group" onClick={() => { setActivePlanScenarioId(s.id); setRenamePlanScenarioId(null); }}>
                  {renamePlanScenarioId === s.id ? (
                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={renamePlanScenarioName}
                        onChange={(e) => setRenamePlanScenarioName(e.target.value)}
                        className="h-5 text-[11px] flex-1 px-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && renamePlanScenarioName.trim()) renamePlanScenarioMutation.mutate({ id: s.id, name: renamePlanScenarioName.trim() });
                          if (e.key === "Escape") { setRenamePlanScenarioId(null); setRenamePlanScenarioName(""); }
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => { if (renamePlanScenarioName.trim()) renamePlanScenarioMutation.mutate({ id: s.id, name: renamePlanScenarioName.trim() }); }}>
                        <Check className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="flex items-center gap-2 flex-1 min-w-0">
                        {activePlanScenarioId === s.id
                          ? <MapPin className="h-3 w-3 text-violet-500 shrink-0" />
                          : <span className="w-3 shrink-0" />}
                        <span className={`truncate ${activePlanScenarioId === s.id ? "font-medium" : ""}`}>{s.name}</span>
                      </span>
                      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-4 w-4"
                          onClick={(e) => { e.stopPropagation(); setRenamePlanScenarioId(s.id); setRenamePlanScenarioName(s.name); }}
                          data-testid={`btn-rename-plan-scenario-${s.id}`}
                          title="Renommer"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-4 w-4"
                          onClick={(e) => { e.stopPropagation(); duplicatePlanScenarioMutation.mutate(s.id); }}
                          data-testid={`btn-duplicate-plan-scenario-${s.id}`}
                          title="Dupliquer"
                          disabled={duplicatePlanScenarioMutation.isPending}
                        >
                          <Copy className="h-2.5 w-2.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-4 w-4"
                          onClick={(e) => { e.stopPropagation(); setDeletePlanScenarioConfirm({ id: s.id, name: s.name }); }}
                          data-testid={`btn-delete-plan-scenario-${s.id}`}
                          title="Supprimer"
                        >
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </span>
                    </>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {showCreatePlanScenario ? (
                <div className="px-2 py-1.5 flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={newPlanScenarioName}
                    onChange={(e) => setNewPlanScenarioName(e.target.value)}
                    placeholder={t.common.ph.scenarioName}
                    className="h-6 text-[11px] flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newPlanScenarioName.trim()) createPlanScenarioMutation.mutate(newPlanScenarioName.trim());
                      if (e.key === "Escape") setShowCreatePlanScenario(false);
                    }}
                    data-testid="input-new-plan-scenario"
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { if (newPlanScenarioName.trim()) createPlanScenarioMutation.mutate(newPlanScenarioName.trim()); }} disabled={createPlanScenarioMutation.isPending}>
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <DropdownMenuItem className="text-xs gap-1.5" onClick={(e) => { e.preventDefault(); setShowCreatePlanScenario(true); }} data-testid="btn-create-plan-scenario">
                  <Plus className="h-3 w-3" />
                  {t.treasury.newScenario}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Delete plan scenario confirmation dialog */}
        <Dialog open={!!deletePlanScenarioConfirm} onOpenChange={(o) => { if (!o) setDeletePlanScenarioConfirm(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Supprimer le scénario</DialogTitle>
              <DialogDescription>
                Supprimer <strong>"{deletePlanScenarioConfirm?.name}"</strong> ? Cette action est irréversible et supprimera toutes les données associées.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDeletePlanScenarioConfirm(null)}>Annuler</Button>
              <Button variant="destructive" size="sm" onClick={() => { if (deletePlanScenarioConfirm) deletePlanScenarioMutation.mutate(deletePlanScenarioConfirm.id); }} disabled={deletePlanScenarioMutation.isPending}>
                {deletePlanScenarioMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Supprimer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Initial balance */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-muted-foreground shrink-0">{t.treasury.initialBalance} :</span>
          {editingInitBalance ? (
            <Input
              type="number"
              value={initBalanceValue}
              onChange={(e) => setInitBalanceValue(e.target.value)}
              onBlur={() => {
                const v = parseFloat(initBalanceValue) || 0;
                const s = { ...localSettings, initialBalance: v };
                setLocalSettings(s);
                saveSettingsMutation.mutate(s);
                setEditingInitBalance(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditingInitBalance(false);
              }}
              className="h-7 w-32 text-[11px]"
              autoFocus
              data-testid="input-init-balance"
            />
          ) : (
            <button
              onClick={() => { setEditingInitBalance(true); setInitBalanceValue(String(localSettings.initialBalance)); }}
              className="text-[11px] font-semibold text-foreground hover:text-primary transition-colors px-2 py-1 rounded border border-dashed border-border hover:border-primary"
              data-testid="btn-edit-init-balance"
            >
              {fmt(localSettings.initialBalance)}
            </button>
          )}
        </div>
      </div>

      {/* Plan table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 200 + COL_W * periods.length }}>
            <thead>
              <tr className="border-b bg-muted/30">
                <th
                  className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sticky left-0 bg-muted/30 z-10"
                  style={{ minWidth: 200 }}
                >
                  Postes
                </th>
                {periods.map((p) => (
                  <th
                    key={p.key}
                    className={cn(
                      "text-right py-2 px-2 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap",
                      p.isCurrent ? "text-primary bg-primary/5" : "text-muted-foreground"
                    )}
                    style={{ minWidth: COL_W }}
                  >
                    {p.label}
                    {p.subtitle && <span className="block text-[9px] font-normal normal-case text-muted-foreground/60">{p.subtitle}</span>}
                    {p.isCurrent && <span className="block text-[8px] font-normal text-primary/60 normal-case">en cours</span>}
                  </th>
                ))}
                <th
                  className="text-right py-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-l border-border/50 bg-muted/20"
                  style={{ minWidth: COL_W }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {RUBRIQUES.map((rubrique) => {
                const lines = (planData?.lines ?? []).filter((l) => l.rubrique === rubrique.key);
                const isExpanded = expandedRubriques.has(rubrique.key);
                return (
                  <Fragment key={rubrique.key}>
                    {/* Rubrique header row */}
                    <tr
                      className="border-t border-border/50 bg-muted/10 cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() =>
                        setExpandedRubriques((prev) => {
                          const next = new Set(prev);
                          if (next.has(rubrique.key)) next.delete(rubrique.key);
                          else next.add(rubrique.key);
                          return next;
                        })
                      }
                    >
                      <td className="py-2 px-3 sticky left-0 bg-inherit z-10">
                        <div className="flex items-center gap-1.5">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-[11px] font-semibold text-foreground">{rubrique.label}</span>
                          <Badge variant="secondary" className="text-[9px] ml-1 px-1.5 h-4">{lines.length}</Badge>
                          {rubrique.key === "entrees_clients" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[10px] gap-1 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 ml-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                const incomeFlows = flows.filter((f) => f.type === "income" && f.projectId);
                                const grouped: Record<string, { name: string; total: number }> = {};
                                for (const f of incomeFlows) {
                                  if (!grouped[f.projectId!]) grouped[f.projectId!] = { name: f.projectName ?? f.projectId!, total: 0 };
                                  grouped[f.projectId!].total += f.amount;
                                }
                                setSyncSelectedProjects(new Set(Object.keys(grouped)));
                                setSyncDialogOpen(true);
                              }}
                              data-testid="btn-sync-entrees"
                            >
                              <Sparkles className="h-3 w-3" />
                              Synchroniser les entrées
                            </Button>
                          )}
                        </div>
                      </td>
                      {periods.map((p) => {
                        const total = getRubriqueTotal(rubrique.key, p.key);
                        return (
                          <td
                            key={p.key}
                            className={cn(
                              "py-2 px-2 text-right tabular-nums text-[11px] font-semibold",
                              p.isCurrent ? "bg-primary/5" : ""
                            )}
                          >
                            {total !== 0 && (
                              <span className={rubrique.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                {fmt(total)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 px-2 text-right tabular-nums text-[11px] font-semibold border-l border-border/50 bg-muted/20">
                        {(() => {
                          const t = periods.reduce((sum, p) => sum + getRubriqueTotal(rubrique.key, p.key), 0);
                          return t !== 0 ? <span className={rubrique.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{fmt(t)}</span> : null;
                        })()}
                      </td>
                    </tr>

                    {/* Child lines */}
                    {isExpanded && (
                      <>
                        {lines.map((line) => (
                          <tr key={line.id} className="border-t border-border/20 group hover:bg-muted/5 transition-colors">
                            <td className="py-1 px-3 sticky left-0 bg-card z-10 group-hover:bg-muted/5">
                              <div className="flex items-center gap-1 pl-5">
                                {editingLineId === line.id ? (
                                  <input
                                    value={editingLineLabel}
                                    onChange={(e) => setEditingLineLabel(e.target.value)}
                                    onBlur={() => {
                                      if (editingLineLabel.trim() && editingLineLabel !== line.label) {
                                        updateLineLabelMutation.mutate({ id: line.id, label: editingLineLabel.trim() });
                                      }
                                      setEditingLineId(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") e.currentTarget.blur();
                                      if (e.key === "Escape") setEditingLineId(null);
                                    }}
                                    className="text-[11px] text-foreground flex-1 bg-primary/10 rounded px-1 py-0.5 outline-none border border-primary/30 min-w-0"
                                    autoFocus
                                    data-testid={`input-edit-plan-line-${line.id}`}
                                  />
                                ) : (
                                  <span
                                    className="text-[11px] text-foreground flex-1 truncate cursor-text hover:text-primary transition-colors"
                                    onDoubleClick={() => { setEditingLineId(line.id); setEditingLineLabel(line.label); }}
                                    title="Double-clic pour renommer"
                                  >{line.label}</span>
                                )}
                                <button
                                  onClick={() => { setEditingLineId(line.id); setEditingLineLabel(line.label); }}
                                  className="invisible group-hover:visible text-muted-foreground hover:text-primary transition-colors"
                                  title="Renommer la ligne"
                                  data-testid={`btn-rename-plan-line-${line.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => duplicateLineMutation.mutate(line.id)}
                                  className="invisible group-hover:visible text-muted-foreground hover:text-primary transition-colors"
                                  title="Dupliquer la ligne"
                                  data-testid={`btn-duplicate-plan-line-${line.id}`}
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      className="invisible group-hover:visible text-muted-foreground hover:text-violet-600 transition-colors"
                                      title="Déplacer vers une autre rubrique"
                                      data-testid={`btn-move-plan-line-${line.id}`}
                                    >
                                      <ArrowRightLeft className="h-3 w-3" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="w-52">
                                    <DropdownMenuLabel className="text-[10px]">Déplacer vers</DropdownMenuLabel>
                                    {RUBRIQUES.filter((r) => r.key !== line.rubrique).map((r) => (
                                      <DropdownMenuItem
                                        key={r.key}
                                        className="text-xs gap-2"
                                        onClick={() => moveLineRubriqueMutation.mutate({ id: line.id, rubrique: r.key })}
                                        data-testid={`move-line-to-${r.key}`}
                                      >
                                        <span className={r.type === "income" ? "text-green-600" : "text-red-500"}>{r.type === "income" ? "+" : "−"}</span>
                                        {r.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <button
                                  onClick={() => deleteLineMutation.mutate(line.id)}
                                  className="invisible group-hover:visible text-muted-foreground hover:text-destructive transition-colors"
                                  data-testid={`btn-delete-plan-line-${line.id}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            {periods.map((p, pIdx) => {
                              const isEditing = editingCell?.lineId === line.id && editingCell?.periodKey === p.key;
                              const isFillRange = fillDrag?.lineId === line.id && fillEndIdx !== null && pIdx > fillDrag.startIdx && pIdx <= fillEndIdx;
                              const value = isFillRange ? fillDrag!.value : getCellValue(line.id, p.key);
                              const hasValue = getCellValue(line.id, p.key) !== 0;
                              return (
                                <td
                                  key={p.key}
                                  className={cn("py-0.5 px-1 relative", p.isCurrent ? "bg-primary/5" : "", isFillRange ? "bg-blue-50 dark:bg-blue-900/20" : "")}
                                  onMouseEnter={() => { if (fillDrag?.lineId === line.id) setFillEndIdx(pIdx); }}
                                >
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={() => handleCellSave(line.id, p.key)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleCellSave(line.id, p.key);
                                        if (e.key === "Escape") setEditingCell(null);
                                      }}
                                      placeholder="0 ou =1200+800"
                                      className="w-full text-right text-[11px] tabular-nums bg-primary/10 rounded px-1 py-1 outline-none border border-primary/30 placeholder:text-[9px]"
                                      style={{ minWidth: 60 }}
                                      autoFocus
                                    />
                                  ) : (
                                    <PlanCell
                                      lineId={line.id}
                                      periodKey={p.key}
                                      value={value}
                                      isFillRange={isFillRange}
                                      isSelected={selectedCell?.lineId === line.id && selectedCell?.periodKey === p.key}
                                      hasValue={hasValue}
                                      colW={COL_W}
                                      fmt={fmt}
                                      cellColor={localColors[line.id]?.[p.key] ?? null}
                                      hasClipboard={cellClipboard !== null}
                                      onSelect={() => setSelectedCell({ lineId: line.id, periodKey: p.key })}
                                      onStartEdit={() => {
                                        setEditingCell({ lineId: line.id, periodKey: p.key });
                                        const rawFormula = localFormulas[line.id]?.[p.key];
                                        setEditValue(rawFormula ?? (value !== 0 ? String(value) : ""));
                                        setSelectedCell(null);
                                      }}
                                      onFillDragStart={() => {
                                        setFillDrag({ lineId: line.id, startIdx: pIdx, value: getCellValue(line.id, p.key) });
                                        setFillEndIdx(pIdx);
                                      }}
                                      onCopy={() => {
                                        const rawFormula = localFormulas[line.id]?.[p.key];
                                        setCellClipboard({ formula: rawFormula ?? String(getCellValue(line.id, p.key)), amount: getCellValue(line.id, p.key) });
                                      }}
                                      onPaste={() => {
                                        if (!cellClipboard) return;
                                        const amount = evalFormula(cellClipboard.formula);
                                        const prevAmount = getCellValue(line.id, p.key);
                                        const formula = cellClipboard.formula.startsWith("=") ? cellClipboard.formula : null;
                                        setLocalCells((prev) => ({ ...prev, [line.id]: { ...(prev[line.id] ?? {}), [p.key]: amount } }));
                                        if (formula) {
                                          setLocalFormulas((prev) => ({ ...prev, [line.id]: { ...(prev[line.id] ?? {}), [p.key]: formula } }));
                                        } else {
                                          setLocalFormulas((prev) => {
                                            const next = { ...prev };
                                            if (next[line.id]) {
                                              const lc = { ...next[line.id] };
                                              delete lc[p.key];
                                              next[line.id] = lc;
                                            }
                                            return next;
                                          });
                                        }
                                        saveCellMutation.mutate([{ lineId: line.id, periodKey: p.key, amount, formula, cell_color: localColors[line.id]?.[p.key] ?? null }]);
                                        if (prevAmount !== amount) {
                                          setUndoStack((prev) => [...prev, [{ lineId: line.id, periodKey: p.key, prevAmount, nextAmount: amount }]]);
                                          setRedoStack([]);
                                        }
                                      }}
                                      onSetColor={(color) => {
                                        setLocalColors((prev) => {
                                          const next = { ...prev };
                                          if (color) {
                                            next[line.id] = { ...(next[line.id] ?? {}), [p.key]: color };
                                          } else {
                                            const lineCopy = { ...(next[line.id] ?? {}) };
                                            delete lineCopy[p.key];
                                            next[line.id] = lineCopy;
                                          }
                                          return next;
                                        });
                                        saveCellColorMutation.mutate({ lineId: line.id, periodKey: p.key, cell_color: color });
                                      }}
                                    />
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-0.5 px-2 text-right tabular-nums text-[11px] font-semibold border-l border-border/50 bg-muted/10 whitespace-nowrap">
                              {(() => {
                                const t = periods.reduce((sum, p) => sum + getCellValue(line.id, p.key), 0);
                                return t !== 0 ? <span className="text-foreground">{fmt(t)}</span> : <span className="text-border/50">—</span>;
                              })()}
                            </td>
                          </tr>
                        ))}

                        {/* Add line */}
                        {addingToRubrique === rubrique.key ? (
                          <tr className="border-t border-border/20 bg-muted/5">
                            <td className="py-1.5 px-3 sticky left-0 bg-muted/5 z-10">
                              <div className="flex items-center gap-1.5 pl-5">
                                <Input
                                  value={newLineLabel}
                                  onChange={(e) => setNewLineLabel(e.target.value)}
                                  placeholder={t.common.ph.lineLabel}
                                  className="h-6 text-[10px] placeholder:text-[9px] w-36"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && newLineLabel.trim()) {
                                      createLineMutation.mutate({ rubrique: rubrique.key, label: newLineLabel.trim(), planScenarioId: activePlanScenarioId });
                                    }
                                    if (e.key === "Escape") { setAddingToRubrique(null); setNewLineLabel(""); }
                                  }}
                                  data-testid="input-new-plan-line"
                                />
                                <Button
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => { if (newLineLabel.trim()) createLineMutation.mutate({ rubrique: rubrique.key, label: newLineLabel.trim(), planScenarioId: activePlanScenarioId }); }}
                                  disabled={!newLineLabel.trim()}
                                >OK</Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => { setAddingToRubrique(null); setNewLineLabel(""); }}
                                >Annuler</Button>
                              </div>
                            </td>
                            {periods.map((p) => <td key={p.key} className={p.isCurrent ? "bg-primary/5" : ""} />)}
                          <td className="border-l border-border/50 bg-muted/10" />
                          </tr>
                        ) : (
                          <tr className="border-t border-border/10">
                            <td className="py-1 px-3 sticky left-0 bg-card z-10">
                              <button
                                onClick={(e) => { e.stopPropagation(); setAddingToRubrique(rubrique.key); setNewLineLabel(""); }}
                                className="flex items-center gap-1 pl-5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                                data-testid={`btn-add-plan-line-${rubrique.key}`}
                              >
                                <Plus className="h-3 w-3" /> Ajouter une ligne
                              </button>
                            </td>
                            {periods.map((p) => <td key={p.key} className={p.isCurrent ? "bg-primary/5" : ""} />)}
                            <td className="border-l border-border/50 bg-muted/10" />
                          </tr>
                        )}
                      </>
                    )}
                  </Fragment>
                );
              })}

              {/* ── Summary rows ── */}
              <tr className="border-t-2 border-border">
                <td className="py-2 px-3 sticky left-0 bg-card z-10">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
                    <span className="text-[11px] font-semibold text-foreground">Total Entrées</span>
                  </div>
                </td>
                {periods.map((p) => {
                  const t = getTotalEntrees(p.key);
                  return (
                    <td key={p.key} className={cn("py-2 px-2 text-right tabular-nums text-[11px] font-semibold", p.isCurrent ? "bg-primary/5" : "")}>
                      <span className={t > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>{t !== 0 ? fmt(t) : "—"}</span>
                    </td>
                  );
                })}
                <td className="py-2 px-2 text-right tabular-nums text-[11px] font-semibold border-l border-border/50 bg-muted/20">
                  {(() => { const t = periods.reduce((s, p) => s + getTotalEntrees(p.key), 0); return <span className={t > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>{t !== 0 ? fmt(t) : "—"}</span>; })()}
                </td>
              </tr>
              <tr className="border-t border-border/50">
                <td className="py-2 px-3 sticky left-0 bg-card z-10">
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
                    <span className="text-[11px] font-semibold text-foreground">Total Sorties</span>
                  </div>
                </td>
                {periods.map((p) => {
                  const t = getTotalSorties(p.key);
                  return (
                    <td key={p.key} className={cn("py-2 px-2 text-right tabular-nums text-[11px] font-semibold", p.isCurrent ? "bg-primary/5" : "")}>
                      <span className={t > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>{t !== 0 ? fmt(t) : "—"}</span>
                    </td>
                  );
                })}
                <td className="py-2 px-2 text-right tabular-nums text-[11px] font-semibold border-l border-border/50 bg-muted/20">
                  {(() => { const t = periods.reduce((s, p) => s + getTotalSorties(p.key), 0); return <span className={t > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>{t !== 0 ? fmt(t) : "—"}</span>; })()}
                </td>
              </tr>
              <tr className="border-t border-border/50 bg-muted/5">
                <td className="py-2 px-3 sticky left-0 bg-muted/5 z-10">
                  <span className="text-[11px] font-semibold text-foreground">Variation nette</span>
                </td>
                {periods.map((p) => {
                  const v = balances[p.key]?.variation ?? 0;
                  return (
                    <td key={p.key} className={cn("py-2 px-2 text-right tabular-nums text-[11px] font-bold", p.isCurrent ? "bg-primary/5" : "")}>
                      <span className={v > 0 ? "text-green-600 dark:text-green-400" : v < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                        {v !== 0 ? `${v > 0 ? "+" : ""}${fmt(v)}` : "—"}
                      </span>
                    </td>
                  );
                })}
                <td className="py-2 px-2 text-right tabular-nums text-[11px] font-bold border-l border-border/50 bg-muted/20">
                  {(() => { const t = periods.reduce((s, p) => s + (balances[p.key]?.variation ?? 0), 0); return <span className={t > 0 ? "text-green-600 dark:text-green-400" : t < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>{t !== 0 ? `${t > 0 ? "+" : ""}${fmt(t)}` : "—"}</span>; })()}
                </td>
              </tr>
              <tr className="border-t-2 border-border bg-muted/10">
                <td className="py-2.5 px-3 sticky left-0 bg-muted/10 z-10">
                  <div className="flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-[11px] font-bold text-foreground">Balance cumulée</span>
                  </div>
                </td>
                {periods.map((p) => {
                  const bal = balances[p.key]?.balance ?? localSettings.initialBalance;
                  return (
                    <td key={p.key} className={cn("py-2.5 px-2 text-right tabular-nums text-[11px] font-bold", p.isCurrent ? "bg-primary/5" : "")}>
                      <span className={bal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{fmt(bal)}</span>
                    </td>
                  );
                })}
                <td className="py-2.5 px-2 border-l border-border/50 bg-muted/20" />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sync dialog */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Synchroniser les entrées clients
            </DialogTitle>
            <DialogDescription>
              Sélectionnez les projets à importer. Les échéances de règlement seront importées aux bonnes dates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-64 overflow-y-auto">
            {(() => {
              const incomeFlows = flows.filter((f) => f.type === "income" && f.projectId);
              const grouped: Record<string, { name: string; total: number; echeances: number }> = {};
              for (const f of incomeFlows) {
                if (!grouped[f.projectId!]) grouped[f.projectId!] = { name: f.projectName ?? f.projectId!, total: 0, echeances: 0 };
                grouped[f.projectId!].total += f.amount;
                if (f.sourceType === "project_payment") grouped[f.projectId!].echeances += 1;
              }
              const entries = Object.entries(grouped);
              if (entries.length === 0) {
                return <p className="text-sm text-muted-foreground text-center py-4">Aucun flux de revenus avec projet trouvé.</p>;
              }
              return entries.map(([projectId, { name, total, echeances }]) => (
                <div key={projectId} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover-elevate cursor-pointer" onClick={() => {
                  setSyncSelectedProjects((prev) => {
                    const next = new Set(prev);
                    if (next.has(projectId)) next.delete(projectId);
                    else next.add(projectId);
                    return next;
                  });
                }}>
                  <input type="checkbox" checked={syncSelectedProjects.has(projectId)} readOnly className="accent-violet-600 h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {fmt(total)}{echeances > 0 ? ` · ${echeances} échéance${echeances > 1 ? "s" : ""}` : " · montant facturé"}
                    </span>
                  </div>
                </div>
              ));
            })()}
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setSyncDialogOpen(false)}>Annuler</Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={syncSelectedProjects.size === 0 || syncEntriesMutation.isPending}
              onClick={() => syncEntriesMutation.mutate(Array.from(syncSelectedProjects))}
              data-testid="btn-confirm-sync-entrees"
            >
              {syncEntriesMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Importer {syncSelectedProjects.size > 0 ? `(${syncSelectedProjects.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

import { PremiumGate } from "@/components/billing/PremiumGate";

function TreasuryPageInner() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [mainTab, setMainTab] = useState<"flux" | "plan">("flux");
  const [periodTab, setPeriodTab] = useState<"3m" | "6m" | "12m" | "all">("6m");
  const [chartMode, setChartMode] = useState<"real" | "projected">("projected");
  const [viewMode, setViewMode] = useState<"chart" | "synthesis">("synthesis");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [projectComboOpen, setProjectComboOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [showScenarioCreate, setShowScenarioCreate] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState("");
  const [deleteScenarioConfirm, setDeleteScenarioConfirm] = useState<{ id: string; name: string } | null>(null);
  const [renameScenarioId, setRenameScenarioId] = useState<string | null>(null);
  const [renameScenarioName, setRenameScenarioName] = useState("");

  const [deleteFlowConfirm, setDeleteFlowConfirm] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editFlow, setEditFlow] = useState<TreasuryFlow | null>(null);
  const [tagPopoverOpen, setTagPopoverOpen] = useState<Record<string, boolean>>({});
  const [tagInput, setTagInput] = useState("");

  const { data, isLoading, error } = useQuery<TreasuryData>({
    queryKey: ["/api/treasury/flows"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/treasury/transactions/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/flows"] });
      setDeleteFlowConfirm(null);
      toast({ title: "Flux supprimé" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const createScenarioMutation = useMutation({
    mutationFn: async (name: string) => { const r = await apiRequest("/api/treasury/scenarios", "POST", { name }); return r.json() as Promise<TreasuryScenario>; },
    onSuccess: (s: TreasuryScenario) => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/flows"] });
      setSelectedScenarioId(s.id);
      setNewScenarioName("");
      setShowScenarioCreate(false);
      toast({ title: `Scénario "${s.name}" créé`, className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteScenarioMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/treasury/scenarios/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/flows"] });
      setSelectedScenarioId(null);
      setDeleteScenarioConfirm(null);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const renameScenarioMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiRequest(`/api/treasury/scenarios/${id}`, "PATCH", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/flows"] });
      setRenameScenarioId(null);
      setRenameScenarioName("");
      toast({ title: "Scénario renommé", className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const resourceStatusMutation = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: string }) =>
      apiRequest(`/api/treasury/resources/${id}/payment-status`, "PATCH", { paymentStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/flows"] });
      toast({ title: "Statut mis à jour", className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateFlowTagsMutation = useMutation({
    mutationFn: ({ manualId, tags }: { manualId: string; tags: string[] }) =>
      apiRequest(`/api/treasury/transactions/${manualId}`, "PATCH", { tags }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/treasury/flows"] }),
    onError: (e: any) => toast({ title: "Erreur tags", description: e.message, variant: "destructive" }),
  });

  const updateAutoFlowTagsMutation = useMutation({
    mutationFn: ({ flowId, tags }: { flowId: string; tags: string[] }) =>
      apiRequest("/api/treasury/flow-tags", "PATCH", { flowId, tags }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/treasury/flows"] }),
    onError: (e: any) => toast({ title: "Erreur tags", description: e.message, variant: "destructive" }),
  });

  const allFlowTags = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.flows.flatMap((f) => f.tags ?? []))].sort();
  }, [data]);

  const applyFlowTagsOptimistic = (flowId: string, next: string[]) => {
    queryClient.setQueryData(["/api/treasury/flows"], (old: TreasuryData | undefined) => {
      if (!old) return old;
      return { ...old, flows: old.flows.map((f) => f.id === flowId ? { ...f, tags: next } : f) };
    });
  };

  const handleToggleFlowTag = (flow: TreasuryFlow, tag: string) => {
    const current = flow.tags ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    applyFlowTagsOptimistic(flow.id, next);
    if (flow.manualId) {
      updateFlowTagsMutation.mutate({ manualId: flow.manualId, tags: next });
    } else {
      updateAutoFlowTagsMutation.mutate({ flowId: flow.id, tags: next });
    }
  };

  const handleAddNewFlowTag = (flow: TreasuryFlow, rawTag: string) => {
    const trimmed = rawTag.trim();
    if (!trimmed) return;
    const current = flow.tags ?? [];
    if (current.includes(trimmed)) return;
    const next = [...current, trimmed];
    applyFlowTagsOptimistic(flow.id, next);
    if (flow.manualId) {
      updateFlowTagsMutation.mutate({ manualId: flow.manualId, tags: next });
    } else {
      updateAutoFlowTagsMutation.mutate({ flowId: flow.id, tags: next });
    }
  };

  // Period window — centré sur maintenant : pastMonths en arrière + reste en avant
  const periodWindow = useMemo(() => {
    const now = new Date();
    if (periodTab === "all") return null;
    const months = periodTab === "3m" ? 3 : periodTab === "6m" ? 6 : 12;
    const pastMonths = Math.floor(months / 3); // 1 pour 3m, 2 pour 6m, 4 pour 12m
    const from = new Date(now.getFullYear(), now.getMonth() - pastMonths, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + (months - pastMonths), 0);
    return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
  }, [periodTab]);

  const filteredFlows = useMemo(() => {
    if (!data) return [];
    const baseScenarioId = data.scenarios?.find((s) => s.isBase)?.id ?? null;
    return data.flows.filter((f) => {
      if (periodWindow && (f.date < periodWindow.from || f.date > periodWindow.to)) return false;
      if (filterType !== "all" && f.type !== filterType) return false;
      if (filterStatus !== "all" && f.status !== filterStatus) return false;
      if (filterProjects.length > 0 && !filterProjects.includes(f.projectId)) return false;
      if (filterSource !== "all" && f.sourceType !== filterSource) return false;
      if (filterCategory !== "all" && f.categoryId !== filterCategory) return false;
      if (
        filterSearch &&
        !f.label.toLowerCase().includes(filterSearch.toLowerCase()) &&
        !(f.projectName?.toLowerCase().includes(filterSearch.toLowerCase()))
      )
        return false;
      // Scenario filter: base scenario shows all flows; custom scenario shows base flows + its own
      if (selectedScenarioId && selectedScenarioId !== baseScenarioId) {
        if (f.scenarioId !== null && f.scenarioId !== undefined && f.scenarioId !== selectedScenarioId) return false;
      }
      return true;
    });
  }, [data, periodWindow, filterType, filterStatus, filterProjects, filterSource, filterCategory, filterSearch, selectedScenarioId]);

  // Chart data by mode — period fills empty months so all months always appear
  const chartData = useMemo(() => {
    if (!data) return [];
    const startingCash = parseFloat(data.settings?.startingCash ?? "0");
    const realStatuses = ["received", "paid"];
    const projectedStatuses = ["confirmed", "received", "paid"];
    const statuses = chartMode === "real" ? realStatuses : projectedStatuses;
    // Apply project filter to chart flows too
    const chartFlows = filterProjects.length === 0
      ? data.flows
      : data.flows.filter((f) => filterProjects.includes(f.projectId));
    return buildChartData(chartFlows, statuses, startingCash, periodWindow ?? undefined);
  }, [data, chartMode, periodWindow, filterProjects]);

  // Synthesis data — month-by-month table
  const synthesisData = useMemo(() => {
    if (!data) return [];
    const startingCash = parseFloat(data.settings?.startingCash ?? "0");
    const realStatuses = ["received", "paid"];
    const projectedStatuses = ["confirmed", "received", "paid"];
    const statuses = chartMode === "real" ? realStatuses : projectedStatuses;
    const synthFlows = filterProjects.length === 0
      ? data.flows
      : data.flows.filter((f) => filterProjects.includes(f.projectId));
    return buildSynthesisData(synthFlows, statuses, startingCash, periodWindow ?? undefined);
  }, [data, chartMode, periodWindow, filterProjects]);

  const periodKpis = useMemo(() => {
    const realStatuses = ["received", "paid"];
    const projectedStatuses = ["confirmed", "received", "paid"];
    const statuses = chartMode === "real" ? realStatuses : projectedStatuses;
    const active = filteredFlows.filter((f) => f.status !== "cancelled" && statuses.includes(f.status));
    const income = active.filter((f) => f.type === "income").reduce((s, f) => s + f.amount, 0);
    const expense = active.filter((f) => f.type === "expense").reduce((s, f) => s + f.amount, 0);
    return { income, expense, net: income - expense };
  }, [filteredFlows, chartMode]);

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
    filterProjects.length > 0 ||
    filterSource !== "all" ||
    filterCategory !== "all" ||
    filterSearch !== "";

  const clearFilters = () => {
    setFilterType("all");
    setFilterStatus("all");
    setFilterProjects([]);
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
          {mainTab === "flux" && kpis?.alertLevel === "critical" && (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 gap-1 text-[10px]">
              <AlertTriangle className="h-2.5 w-2.5" /> Trésorerie négative
            </Badge>
          )}
          {mainTab === "flux" && kpis?.alertLevel === "warning" && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 gap-1 text-[10px]">
              <AlertTriangle className="h-2.5 w-2.5" /> Seuil d'alerte
            </Badge>
          )}
        </div>
        {mainTab === "flux" && (
          <div className="flex items-center gap-2">
            <div className="relative" data-testid="project-multiselect-container">
              <button
                onClick={() => { setProjectComboOpen((o) => !o); setProjectSearch(""); }}
                className="flex items-center gap-1.5 h-7 px-2 rounded-md border bg-white dark:bg-background text-[10px] text-foreground min-w-[140px] max-w-[200px]"
                data-testid="btn-project-multiselect"
              >
                <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="flex-1 text-left truncate">
                  {filterProjects.length === 0
                    ? t.treasury.allProjects
                    : filterProjects.length === 1
                      ? (projects.find((p) => p.id === filterProjects[0])?.name ?? "1 projet")
                      : `${filterProjects.length} projets`}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              </button>
              {projectComboOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProjectComboOpen(false)} />
                  <div className="absolute right-0 top-8 z-50 min-w-[220px] rounded-md border bg-white dark:bg-popover shadow-md">
                    <div className="p-1.5 border-b">
                      <input
                        autoFocus
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        placeholder={t.common.ph.searchProject}
                        className="w-full text-[11px] px-2 py-1 rounded border bg-muted/30 outline-none focus:border-primary/50"
                        data-testid="input-project-search"
                      />
                    </div>
                    <div className="p-1 max-h-52 overflow-y-auto">
                      {!projectSearch && (
                        <button
                          onClick={() => { setFilterProjects([]); setProjectComboOpen(false); }}
                          className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] hover-elevate", filterProjects.length === 0 ? "text-primary font-medium" : "text-foreground")}
                          data-testid="btn-project-all"
                        >
                          {filterProjects.length === 0 ? <Check className="h-3 w-3 shrink-0" /> : <span className="w-3 shrink-0" />}
                          <span>{t.treasury.allProjects}</span>
                        </button>
                      )}
                      {projects
                        .filter((p) => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                        .map((p) => {
                          const selected = filterProjects.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => setFilterProjects((prev) => selected ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                              className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] hover-elevate", selected ? "text-primary font-medium" : "text-foreground")}
                              data-testid={`btn-project-option-${p.id}`}
                            >
                              {selected ? <Check className="h-3 w-3 shrink-0" /> : <span className="w-3 shrink-0" />}
                              <span className="truncate">{p.name}</span>
                            </button>
                          );
                        })}
                      {projectSearch && projects.filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                        <div className="px-2 py-2 text-[11px] text-muted-foreground text-center">Aucun résultat</div>
                      )}
                    </div>
                  </div>
                </>
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
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="px-5 py-2 border-b shrink-0 bg-background overflow-x-auto">
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "flux" | "plan")}>
          <TabsList className="w-max justify-start flex-nowrap h-[42px]">
            <TabsTrigger value="flux" className="gap-1.5 text-xs h-[42px] px-3" data-testid="tab-treasury-flux">
              <BarChart2 className="h-3.5 w-3.5" />
              Flux
            </TabsTrigger>
            <TabsTrigger value="plan" className="gap-1.5 text-xs h-[42px] px-3" data-testid="tab-treasury-plan">
              <Table2 className="h-3.5 w-3.5" />
              Plan de trésorerie
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Body: conditional on tab ── */}
      {mainTab === "plan" ? (
        <TreasuryPlanView projects={projects ?? []} flows={data?.flows ?? []} />
      ) : (
      <div className="flex flex-1 overflow-hidden">
        {/* ── Main content ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* KPIs */}
          <TooltipProvider>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
            ) : (
              <>
                {/* Solde actuel — carte blanche avec tooltip */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="cursor-default">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">{t.treasury.currentBalance}</span>
                          <div className="flex items-center gap-1">
                            <Info className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            <Wallet className="h-3 w-3 text-muted-foreground shrink-0" />
                          </div>
                        </div>
                        <div className={cn("text-base font-bold leading-tight", (kpis?.currentBalance ?? 0) < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
                          {fmt(kpis?.currentBalance ?? 0)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                          Projeté : <span className={(kpis?.projectedBalance ?? 0) < 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}>{fmt(kpis?.projectedBalance ?? 0)}</span>
                        </p>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md max-w-56 text-[11px] leading-snug">
                    Tout ce qui n'est pas facturé n'est pas considéré comme confirmé mais comme prévu. Seuls les flux reçus / payés constituent le solde réel.
                  </TooltipContent>
                </Tooltip>

                <KpiCard
                  label={chartMode === "real" ? "Entrées réelles" : "Entrées prévisionnelles"}
                  value={fmt(periodKpis.income)}
                  icon={<ArrowDownLeft className="h-3 w-3 text-green-500" />}
                  highlight="green"
                />
                <KpiCard
                  label={chartMode === "real" ? "Sorties réelles" : "Sorties prévisionnelles"}
                  value={fmt(periodKpis.expense)}
                  icon={<ArrowUpRight className="h-3 w-3 text-red-500" />}
                  highlight="red"
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
                  white
                />
              </>
            )}
          </div>
          </TooltipProvider>

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
                      "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors",
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
                      "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors border-l",
                      chartMode === "projected"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <BarChart2 className="h-2.5 w-2.5" /> Prévisionnelle
                  </button>
                </div>

                {/* Scenario selector */}
                {(data?.scenarios?.length ?? 0) > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" data-testid="button-scenario-select">
                        <GitBranch className="h-2.5 w-2.5" />
                        {selectedScenarioId
                          ? data?.scenarios?.find((s) => s.id === selectedScenarioId)?.name ?? "Scénario"
                          : "Base"}
                        {selectedScenarioId && <MapPin className="h-2 w-2 text-violet-500" />}
                        <ChevronDown className="h-2.5 w-2.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel className="text-[10px]">Scénarios</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {data?.scenarios?.map((s) => (
                        <DropdownMenuItem
                          key={s.id}
                          className="text-xs gap-2 justify-between group"
                          onClick={() => setSelectedScenarioId(s.isBase ? null : s.id)}
                        >
                          <span className="flex items-center gap-2 flex-1 min-w-0">
                            {s.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />}
                            <span className={`truncate ${(s.isBase ? !selectedScenarioId : selectedScenarioId === s.id) ? "font-medium" : ""}`}>{s.name}</span>
                            {(s.isBase ? !selectedScenarioId : selectedScenarioId === s.id) && (
                              <MapPin className="h-2.5 w-2.5 text-violet-500 shrink-0" />
                            )}
                          </span>
                          {!s.isBase && (
                            <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                              <span
                                role="button"
                                className="p-0.5 rounded hover:bg-muted"
                                onClick={(e) => { e.stopPropagation(); setRenameScenarioId(s.id); setRenameScenarioName(s.name); }}
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </span>
                              <span
                                role="button"
                                className="p-0.5 rounded hover:bg-muted"
                                onClick={(e) => { e.stopPropagation(); setDeleteScenarioConfirm({ id: s.id, name: s.name }); }}
                              >
                                <X className="h-2.5 w-2.5" />
                              </span>
                            </span>
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      {showScenarioCreate ? (
                        <div className="flex items-center gap-1 p-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            autoFocus
                            value={newScenarioName}
                            onChange={(e) => setNewScenarioName(e.target.value)}
                            placeholder={t.common.ph.scenarioName}
                            className="h-6 text-[10px]"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newScenarioName.trim()) createScenarioMutation.mutate(newScenarioName.trim());
                              if (e.key === "Escape") setShowScenarioCreate(false);
                            }}
                          />
                          <Button size="icon" variant="ghost" className="shrink-0" onClick={() => { if (newScenarioName.trim()) createScenarioMutation.mutate(newScenarioName.trim()); }}>
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <DropdownMenuItem className="text-xs" onClick={() => setShowScenarioCreate(true)}>
                          <Plus className="h-3 w-3 mr-1" /> {t.treasury.newScenario}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

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

          {/* Delete flow scenario confirmation dialog */}
          <Dialog open={!!deleteScenarioConfirm} onOpenChange={(o) => { if (!o) setDeleteScenarioConfirm(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Supprimer le scénario</DialogTitle>
                <DialogDescription>
                  Supprimer <strong>"{deleteScenarioConfirm?.name}"</strong> ? Cette action est irréversible.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDeleteScenarioConfirm(null)}>Annuler</Button>
                <Button variant="destructive" size="sm" onClick={() => { if (deleteScenarioConfirm) deleteScenarioMutation.mutate(deleteScenarioConfirm.id); }} disabled={deleteScenarioMutation.isPending}>
                  {deleteScenarioMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Supprimer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Rename scenario dialog */}
          <Dialog open={!!renameScenarioId} onOpenChange={(open) => { if (!open) { setRenameScenarioId(null); setRenameScenarioName(""); } }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-sm">Renommer le scénario</DialogTitle>
              </DialogHeader>
              <Input
                value={renameScenarioName}
                onChange={(e) => setRenameScenarioName(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameScenarioName.trim() && renameScenarioId) renameScenarioMutation.mutate({ id: renameScenarioId, name: renameScenarioName.trim() });
                  if (e.key === "Escape") { setRenameScenarioId(null); setRenameScenarioName(""); }
                }}
              />
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => { setRenameScenarioId(null); setRenameScenarioName(""); }}>Annuler</Button>
                <Button size="sm" onClick={() => { if (renameScenarioName.trim() && renameScenarioId) renameScenarioMutation.mutate({ id: renameScenarioId, name: renameScenarioName.trim() }); }} disabled={renameScenarioMutation.isPending || !renameScenarioName.trim()}>
                  {renameScenarioMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Renommer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Tableau / Synthèse ── */}
          {/* Filters + view toggle */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <div className="flex items-center rounded-md border overflow-hidden mr-1">
              <button
                onClick={() => setViewMode("synthesis")}
                data-testid="toggle-view-synthesis"
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors",
                  viewMode === "synthesis"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <BarChart2 className="h-2.5 w-2.5" /> Synthèse
              </button>
              <button
                onClick={() => setViewMode("chart")}
                data-testid="toggle-view-detail"
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors border-l",
                  viewMode === "chart"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Table2 className="h-2.5 w-2.5" /> Détail
              </button>
            </div>

          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <Filter className="h-3 w-3 text-muted-foreground shrink-0" />

            <Input
              placeholder={t.common.ph.search}
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="h-7 w-36 text-[10px] placeholder:text-[10px]"
              data-testid="input-filter-search"
            />

            <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
              <SelectTrigger className="h-7 w-28 text-[10px]" data-testid="select-filter-type">
                <SelectValue placeholder={t.common.ph.type} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.treasury.allTypes}</SelectItem>
                <SelectItem value="income">{t.treasury.income}</SelectItem>
                <SelectItem value="expense">{t.treasury.expense}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-7 w-32 text-[10px]" data-testid="select-filter-status">
                <SelectValue placeholder={t.common.ph.status} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.treasury.allTxStatuses}</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="h-7 w-32 text-[10px]" data-testid="select-filter-source">
                <SelectValue placeholder={t.common.ph.source} />
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
                <SelectValue placeholder={t.treasury.category} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.treasury.allCategories}</SelectItem>
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

          {/* Table / Synthèse conditionnelle */}
          {viewMode === "synthesis" ? (
            /* ── Vue Synthèse ── */
            <Card>
              <CardContent className="px-4 pb-4 pt-4">
                {synthesisData.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground text-xs">
                    Aucune donnée pour cette période
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px] border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-40 whitespace-nowrap sticky left-0 bg-card z-10">
                            Mois
                          </th>
                          {synthesisData.map((m) => (
                            <th
                              key={m.key}
                              className={cn(
                                "text-right py-2 px-3 font-medium whitespace-nowrap min-w-[100px]",
                                m.isCurrent
                                  ? "text-primary bg-primary/5 rounded-t-md"
                                  : "text-muted-foreground"
                              )}
                            >
                              {m.isCurrent ? (
                                <span className="flex flex-col items-end gap-0">
                                  <span>{m.label}</span>
                                  <span className="text-[10px] font-normal text-primary/70">en cours</span>
                                </span>
                              ) : (
                                m.label
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-border/40">
                          <td className="py-2 pr-4 font-semibold text-foreground whitespace-nowrap sticky left-0 bg-card z-10">Trésorerie début de mois</td>
                          {synthesisData.map((m) => (
                            <td key={m.key} className={cn("py-2 px-3 text-right font-bold tabular-nums whitespace-nowrap", m.isCurrent ? "bg-primary/5" : "", m.startBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                              {fmt(m.startBalance)}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t border-border/20">
                          <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap sticky left-0 bg-card z-10">
                            <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500" /> Entrées</span>
                          </td>
                          {synthesisData.map((m) => (
                            <td key={m.key} className={cn("py-2 px-3 text-right tabular-nums whitespace-nowrap text-foreground", m.isCurrent ? "bg-primary/5" : "")}>
                              {fmt(m.income)}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t border-border/20">
                          <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap sticky left-0 bg-card z-10">
                            <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-500" /> Sorties</span>
                          </td>
                          {synthesisData.map((m) => (
                            <td key={m.key} className={cn("py-2 px-3 text-right tabular-nums whitespace-nowrap text-foreground", m.isCurrent ? "bg-primary/5" : "")}>
                              {fmt(m.expense)}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t border-border/40">
                          <td className="py-2 pr-4 font-semibold text-foreground whitespace-nowrap sticky left-0 bg-card z-10">Trésorerie fin de mois</td>
                          {synthesisData.map((m) => (
                            <td key={m.key} className={cn("py-2 px-3 text-right font-bold tabular-nums whitespace-nowrap", m.isCurrent ? "bg-primary/5" : "", m.endBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                              {fmt(m.endBalance)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
          /* ── Vue Détail ── */
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Date</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Type</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[9px]">Libellé</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Projet</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">{t.treasury.category}</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Tags</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Statut</th>
                    <th className="text-right py-1.5 px-3 font-medium text-muted-foreground text-[10px]">Montant</th>
                    <th className="text-right py-1.5 px-3 font-medium text-muted-foreground text-[10px] bg-slate-100/80 dark:bg-slate-800/40">Balance</th>
                    <th className="py-1.5 px-3 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 10 }).map((_, j) => (
                          <td key={j} className="py-1.5 px-3"><Skeleton className="h-3 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  ) : flowsWithBalance.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted-foreground text-xs">
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
                          <Popover
                            open={tagPopoverOpen[flow.id] ?? false}
                            onOpenChange={(v) => {
                              setTagPopoverOpen((prev) => ({ ...prev, [flow.id]: v }));
                              if (!v) setTagInput("");
                            }}
                          >
                              <PopoverTrigger asChild>
                                <div
                                  className="flex flex-wrap gap-0.5 items-center min-h-[20px] cursor-pointer group"
                                  data-testid={`cell-tags-${flow.id}`}
                                >
                                  {(flow.tags ?? []).map((t) => (
                                    <span
                                      key={t}
                                      className="text-[9px] px-1.5 py-0 rounded border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-300 whitespace-nowrap"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                  {(flow.tags ?? []).length === 0 && (
                                    <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                      <Plus className="h-2.5 w-2.5" /> tag
                                    </span>
                                  )}
                                </div>
                              </PopoverTrigger>
                              <PopoverContent className="w-52 p-2" align="start">
                                <div className="flex flex-wrap gap-0.5 mb-2">
                                  {(flow.tags ?? []).map((t) => (
                                    <button
                                      key={t}
                                      className="text-[10px] px-1.5 py-0 rounded border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-300 flex items-center gap-0.5 hover:bg-violet-100 dark:hover:bg-violet-800/30"
                                      onClick={() => handleToggleFlowTag(flow, t)}
                                    >
                                      {t} <X className="h-2.5 w-2.5 opacity-60" />
                                    </button>
                                  ))}
                                </div>
                                <Input
                                  autoFocus
                                  value={tagInput}
                                  onChange={(e) => setTagInput(e.target.value)}
                                  placeholder={t.common.ph.searchOrCreate}
                                  className="h-7 text-[9px] mb-2"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const exact = allFlowTags.find(
                                        (t) => t.toLowerCase() === tagInput.toLowerCase()
                                      );
                                      if (exact) handleToggleFlowTag(flow, exact);
                                      else if (tagInput.trim()) handleAddNewFlowTag(flow, tagInput);
                                      setTagPopoverOpen((prev) => ({ ...prev, [flow.id]: false }));
                                      setTagInput("");
                                    }
                                    if (e.key === "Escape") {
                                      setTagPopoverOpen((prev) => ({ ...prev, [flow.id]: false }));
                                      setTagInput("");
                                    }
                                  }}
                                />
                                <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5">
                                  {(() => {
                                    const filtered = allFlowTags.filter((t) =>
                                      t.toLowerCase().includes(tagInput.toLowerCase()) &&
                                      !(flow.tags ?? []).includes(t)
                                    );
                                    return (
                                      <>
                                        {filtered.map((t) => (
                                          <button
                                            key={t}
                                            className="text-left text-[11px] px-2 py-1 rounded hover:bg-muted text-foreground flex items-center gap-1"
                                            onClick={() => {
                                              handleToggleFlowTag(flow, t);
                                              setTagPopoverOpen((prev) => ({ ...prev, [flow.id]: false }));
                                              setTagInput("");
                                            }}
                                          >
                                            {t}
                                          </button>
                                        ))}
                                        {tagInput.trim() && !allFlowTags.some((t) => t.toLowerCase() === tagInput.toLowerCase()) && (
                                          <button
                                            className="text-left text-[11px] px-2 py-1 rounded hover:bg-muted flex items-center gap-1 text-muted-foreground border-t border-border/40 mt-1 pt-1"
                                            onClick={() => {
                                              handleAddNewFlowTag(flow, tagInput);
                                              setTagPopoverOpen((prev) => ({ ...prev, [flow.id]: false }));
                                              setTagInput("");
                                            }}
                                          >
                                            <Plus className="h-3 w-3" /> Créer &ldquo;{tagInput.trim()}&rdquo;
                                          </button>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </PopoverContent>
                            </Popover>
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
                        <td className="py-1.5 px-3 text-right whitespace-nowrap bg-slate-100/80 dark:bg-slate-800/40">
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
                          <div className="flex items-center gap-0.5 invisible group-hover:visible">
                            {flow.sourceType === "project_resource" && flow.resourceId && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5"
                                    data-testid={`button-resource-status-${flow.id}`}
                                    title="Changer le statut de paiement"
                                  >
                                    <RefreshCw className="h-2.5 w-2.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="text-xs">
                                  <DropdownMenuLabel className="text-[10px]">Statut paiement</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {(["planned", "confirmed", "paid"] as const).map((s) => (
                                    <DropdownMenuItem
                                      key={s}
                                      className="text-xs"
                                      onClick={() => resourceStatusMutation.mutate({ id: flow.resourceId!, paymentStatus: s })}
                                    >
                                      {s === "planned" ? "Prévu" : s === "confirmed" ? "Confirmé" : "Payé"}
                                      {flow.status === s && <Check className="h-3 w-3 ml-auto" />}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            {flow.sourceType === "manual" && flow.manualId && (
                              <>
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
                                  onClick={() => setDeleteFlowConfirm(flow.manualId!)}
                                  data-testid={`button-delete-flow-${flow.id}`}
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          )}

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
          activeScenarioId={selectedScenarioId}
        />

        {/* Delete flow confirmation dialog */}
        <Dialog open={!!deleteFlowConfirm} onOpenChange={(o) => { if (!o) setDeleteFlowConfirm(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Supprimer ce flux</DialogTitle>
              <DialogDescription>
                Cette action est irréversible. Ce flux sera définitivement supprimé.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDeleteFlowConfirm(null)}>Annuler</Button>
              <Button variant="destructive" size="sm" onClick={() => { if (deleteFlowConfirm) deleteMutation.mutate(deleteFlowConfirm); }} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Supprimer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      )}
    </div>
  );
}

export default function TreasuryPage() {
  return (
    <PremiumGate feature="treasury">
      <TreasuryPageInner />
    </PremiumGate>
  );
}
