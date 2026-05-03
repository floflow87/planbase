import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Bot,
  TrendingUp,
  ShieldAlert,
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { AiFallbackEvent } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FallbackApiResponse {
  events: AiFallbackEvent[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Small sparkline bar (last 7 days summary) ────────────────────────────────

function DaySparkline({ events }: { events: AiFallbackEvent[] }) {
  const days = useMemo(() => {
    const buckets: { label: string; count: number; failures: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayEvents = events.filter(
        (e) => new Date(e.createdAt).toISOString().slice(0, 10) === key,
      );
      buckets.push({
        label: format(d, "EEE", { locale: fr }),
        count: dayEvents.length,
        failures: dayEvents.filter((e) => !e.fallbackSucceeded).length,
      });
    }
    return buckets;
  }, [events]);

  const maxCount = Math.max(...days.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1 h-12" data-testid="sparkline-ai-fallback">
      {days.map((day, i) => {
        const height = Math.max((day.count / maxCount) * 100, day.count > 0 ? 8 : 4);
        const hasFailures = day.failures > 0;
        return (
          <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
            <div
              className="w-full rounded-sm transition-all"
              style={{
                height: `${height}%`,
                minHeight: day.count > 0 ? "6px" : "2px",
                backgroundColor: hasFailures
                  ? "hsl(var(--destructive))"
                  : day.count > 0
                  ? "hsl(var(--primary))"
                  : "hsl(var(--muted))",
                opacity: day.count > 0 ? 1 : 0.4,
              }}
              title={`${day.label}: ${day.count} fallback(s), ${day.failures} échec(s)`}
            />
            <span className="text-[10px] text-muted-foreground">{day.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  variant = "default",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  variant?: "default" | "success" | "danger";
}) {
  const colorMap = {
    default: "text-primary",
    success: "text-green-600 dark:text-green-400",
    danger: "text-destructive",
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`w-4 h-4 ${colorMap[variant]}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorMap[variant]}`}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function AdminAiFallbackPage() {
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Uses the default authenticated queryFn (sends Supabase Bearer token).
  // Server enforces isPlatformAdmin() → 403 for non-admins; error state below handles it.
  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<FallbackApiResponse>({
      queryKey: ["/api/admin/ai-fallback-events?limit=500&offset=0"],
      retry: false,
    });

  const allEvents: AiFallbackEvent[] = data?.events ?? [];

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const totalCount = data?.total ?? 0;
  const successCount = allEvents.filter((e) => e.fallbackSucceeded).length;
  const failureCount = allEvents.filter((e) => !e.fallbackSucceeded).length;
  const successRate =
    allEvents.length > 0
      ? Math.round((successCount / allEvents.length) * 100)
      : 0;

  const byPromptType = useMemo(() => {
    const map: Record<string, { total: number; failures: number }> = {};
    for (const e of allEvents) {
      if (!map[e.promptType]) map[e.promptType] = { total: 0, failures: 0 };
      map[e.promptType].total++;
      if (!e.fallbackSucceeded) map[e.promptType].failures++;
    }
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
  }, [allEvents]);

  // ─── Filters ─────────────────────────────────────────────────────────────────

  const filteredEvents = useMemo(() => {
    return allEvents.filter((e) => {
      if (filterType !== "all" && e.promptType !== filterType) return false;
      if (filterStatus === "success" && !e.fallbackSucceeded) return false;
      if (filterStatus === "failure" && e.fallbackSucceeded) return false;
      if (
        search.trim() &&
        !e.promptType.toLowerCase().includes(search.toLowerCase()) &&
        !(e.errorMessage ?? "").toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [allEvents, filterType, filterStatus, search]);

  const promptTypes = useMemo(
    () => [...new Set(allEvents.map((e) => e.promptType))].sort(),
    [allEvents],
  );

  const totalPages = Math.ceil(filteredEvents.length / PAGE_SIZE);
  const pagedEvents = filteredEvents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const handleFilter = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  // ─── Error / forbidden state ─────────────────────────────────────────────────

  if (isError) {
    const msg = (error as Error).message ?? "";
    const isForbidden = msg.includes("Forbidden") || msg.includes("403");
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground" />
        <div>
          <p className="font-semibold text-lg">
            {isForbidden ? "Accès réservé" : "Erreur de chargement"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {isForbidden
              ? "Cette page est réservée aux administrateurs de la plateforme."
              : msg}
          </p>
        </div>
        {!isForbidden && (
          <Button variant="outline" onClick={() => refetch()} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        )}
      </div>
    );
  }

  // ─── Loading skeleton ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-md" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="page-admin-ai-fallback">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Historique des fallbacks IA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi des bascules Ollama → OpenAI — statistiques calculées sur les 500 derniers événements chargés
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-fallback"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Événements totaux"
          value={totalCount}
          icon={Activity}
          description="dans la base"
        />
        <StatCard
          title="Taux de succès"
          value={`${successRate}%`}
          icon={TrendingUp}
          description={`${successCount} succès sur ${allEvents.length} chargés`}
          variant={successRate >= 80 ? "success" : successRate >= 50 ? "default" : "danger"}
        />
        <StatCard
          title="Succès"
          value={successCount}
          icon={CheckCircle2}
          description="fallback vers OpenAI OK"
          variant="success"
        />
        <StatCard
          title="Échecs"
          value={failureCount}
          icon={XCircle}
          description="fallback OpenAI aussi raté"
          variant={failureCount > 0 ? "danger" : "default"}
        />
      </div>

      {/* Sparkline + by type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">7 derniers jours</CardTitle>
            <CardDescription className="text-xs">
              Rouge = fallback échoué · Violet = succès
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DaySparkline events={allEvents} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top types de prompts</CardTitle>
            <CardDescription className="text-xs">
              Prompts ayant déclenché le plus de fallbacks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {byPromptType.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun événement.</p>
            )}
            {byPromptType.map(([type, stats]) => {
              const rate = Math.round((stats.total / Math.max(allEvents.length, 1)) * 100);
              const hasFailures = stats.failures > 0;
              return (
                <div key={type} className="flex items-center gap-3" data-testid={`row-prompt-type-${type}`}>
                  <span className="text-xs font-mono text-muted-foreground w-40 truncate flex-shrink-0">
                    {type}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${rate}%`,
                        backgroundColor: hasFailures
                          ? "hsl(var(--destructive))"
                          : "hsl(var(--primary))",
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs font-medium">{stats.total}</span>
                    {stats.failures > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                        {stats.failures} éch.
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-medium">Événements récents</CardTitle>
              <CardDescription className="text-xs">
                {filteredEvents.length} résultat{filteredEvents.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher…"
                  className="pl-8 h-8 w-48 text-xs"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  data-testid="input-search-fallback"
                />
              </div>
              <Select value={filterType} onValueChange={handleFilter(setFilterType)}>
                <SelectTrigger className="h-8 w-44 text-xs" data-testid="select-filter-type">
                  <SelectValue placeholder="Type de prompt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {promptTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={handleFilter(setFilterStatus)}>
                <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-filter-status">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="success">Succès</SelectItem>
                  <SelectItem value="failure">Échec</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs pl-4">Statut</TableHead>
                <TableHead className="text-xs">Type de prompt</TableHead>
                <TableHead className="text-xs">Message d'erreur Ollama</TableHead>
                <TableHead className="text-xs text-right pr-4">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">
                    Aucun événement trouvé
                  </TableCell>
                </TableRow>
              )}
              {pagedEvents.map((event) => (
                <TableRow key={event.id} data-testid={`row-fallback-${event.id}`}>
                  <TableCell className="pl-4">
                    {event.fallbackSucceeded ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] gap-1 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Succès
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <XCircle className="w-3 h-3" />
                        Échec
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">
                      {event.promptType}
                    </code>
                  </TableCell>
                  <TableCell className="max-w-sm">
                    {event.errorMessage ? (
                      <span
                        className="text-xs text-muted-foreground truncate block max-w-xs"
                        title={event.errorMessage}
                      >
                        {event.errorMessage}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground text-right pr-4 whitespace-nowrap">
                    <span
                      title={format(new Date(event.createdAt), "dd MMM yyyy HH:mm:ss", { locale: fr })}
                    >
                      {formatDistanceToNow(new Date(event.createdAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                Page {page + 1} / {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  data-testid="button-page-prev"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  data-testid="button-page-next"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          Les 500 événements les plus récents sont chargés. Pour l'historique complet, utilisez
          l'API <code className="bg-muted px-1 rounded-sm">/api/admin/ai-fallback-events?limit=500&offset=N</code>.
        </span>
      </div>
    </div>
  );
}
