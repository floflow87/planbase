import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetClose, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  RefreshCw, CheckSquare, Flag, MapPin, Banknote, Lightbulb,
  ChevronRight, CalendarClock, AlertCircle, Clock, CheckCheck,
  ArrowUpRight, Sun, Calendar, Video, X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ExternalLink, ArrowRight } from "lucide-react";

interface DigestTask {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  daysOverdue: number;
  projectName: string | null;
  projectId: string | null;
  source: string;
  url: string;
}

interface DigestMilestone {
  id: string;
  title: string;
  projectName: string | null;
  date: string;
  status: string;
  type: "completed" | "upcoming";
  url: string;
}

interface DigestBillingProject {
  id: string;
  name: string;
  clientName: string | null;
  reason: string;
  billingStatus: string | null;
  budget: string | null;
  url: string;
}

interface DigestRecommendation {
  id: string;
  title: string;
  description: string;
  type: "cash" | "task" | "roadmap" | "sprint" | "crm" | "project";
  priority: "high" | "medium" | "low";
  url: string;
}

interface DigestSummary {
  topTasks: DigestTask[];
  roadmap: { completedLast7Days: DigestMilestone[]; upcomingNext7Days: DigestMilestone[] };
  billingProjects: DigestBillingProject[];
  recommendations: DigestRecommendation[];
  metadata: { source: string; generatedAt: string; timezone: string };
}

function priorityBadge(priority: string) {
  if (priority === "high" || priority === "critical")
    return <Badge variant="outline" className="text-[10px] border-red-400 text-red-600 dark:border-red-500 dark:text-red-400">Haute</Badge>;
  if (priority === "medium")
    return <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 dark:border-amber-500 dark:text-amber-400">Moyenne</Badge>;
  return <Badge variant="outline" className="text-[10px]">Basse</Badge>;
}

function recoBadge(type: string) {
  const map: Record<string, { label: string; cls: string }> = {
    cash:    { label: "Facturation", cls: "border-violet-400 text-violet-600 dark:text-violet-400" },
    task:    { label: "Tâche",       cls: "border-red-400 text-red-600 dark:text-red-400" },
    roadmap: { label: "Roadmap",     cls: "border-cyan-400 text-cyan-600 dark:text-cyan-400" },
    sprint:  { label: "Sprint",      cls: "border-emerald-400 text-emerald-600 dark:text-emerald-400" },
    crm:     { label: "CRM",         cls: "border-sky-400 text-sky-600 dark:text-sky-400" },
    project: { label: "Projet",      cls: "border-orange-400 text-orange-600 dark:text-orange-400" },
  };
  const v = map[type] ?? { label: type, cls: "" };
  return <Badge variant="outline" className={`text-[10px] ${v.cls}`}>{v.label}</Badge>;
}

function SectionTitle({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">{label}</h3>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-xs text-muted-foreground italic py-2">{message}</p>;
}

interface DigestAppointment {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string | null;
  type: string | null;
  location?: string | null;
  source: "planbase" | "google";
  hangoutLink?: string | null;
}

interface GoogleEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  hangoutLink?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DailyDigestDrawer({ open, onOpenChange }: Props) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const todayStart = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  }, []);
  const todayEnd = useMemo(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString();
  }, []);

  const { data: digest, isLoading, isError } = useQuery<DigestSummary>({
    queryKey: ["/api/daily-digest/today"],
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: rawAppointments = [] } = useQuery<any[]>({
    queryKey: ["/api/appointments", todayStart, todayEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: todayStart, endDate: todayEnd });
      const res = await apiRequest(`/api/appointments?${params}`, "GET");
      return res.json();
    },
    enabled: open,
  });

  const { data: googleStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/google/status"],
    enabled: open,
  });

  const { data: rawGoogleEvents = [] } = useQuery<GoogleEvent[]>({
    queryKey: ["/api/google/events", todayStart, todayEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: todayStart, endDate: todayEnd });
      const res = await apiRequest(`/api/google/events?${params}`, "GET");
      return res.json();
    },
    enabled: open && !!googleStatus?.connected,
  });

  const todayAppointments = useMemo<DigestAppointment[]>(() => {
    const syncedIds = new Set(rawAppointments.map((a: any) => a.googleEventId).filter(Boolean));
    const local: DigestAppointment[] = rawAppointments.map((a: any) => ({
      id: a.id, title: a.title, startDateTime: a.startDateTime,
      endDateTime: a.endDateTime, type: a.type, location: a.location,
      source: "planbase" as const, hangoutLink: a.htmlLink || null,
    }));
    const google: DigestAppointment[] = rawGoogleEvents
      .filter((e) => !syncedIds.has(e.id))
      .map((e) => ({
        id: e.id, title: e.summary || "Sans titre",
        startDateTime: e.start.dateTime || e.start.date || "",
        endDateTime: e.end?.dateTime || e.end?.date || null,
        type: null, location: null, source: "google" as const,
        hangoutLink: e.hangoutLink || null,
      }));
    return [...local, ...google].sort((a, b) =>
      new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    );
  }, [rawAppointments, rawGoogleEvents]);

  const refresh = useMutation({
    mutationFn: () => apiRequest("/api/daily-digest/refresh", "POST"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/daily-digest/today"] }),
  });

  const generatedAt = digest?.metadata?.generatedAt
    ? new Date(digest.metadata.generatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const normalizeUrl = (url: string) => {
    if (url.startsWith("/backlogs/")) return url.replace("/backlogs/", "/product/backlog/");
    return url;
  };
  const navigate = (url: string) => { onOpenChange(false); setLocation(normalizeUrl(url)); };
  const openInNewTab = (url: string) => { window.open(normalizeUrl(url), "_blank", "noopener,noreferrer"); };

  const ItemMenu = ({ url }: { url: string }) => (
    <ContextMenuContent className="w-52">
      <ContextMenuItem onSelect={() => navigate(url)}>
        <ArrowRight className="w-3 h-3 mr-2" />
        Ouvrir
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => openInNewTab(url)}>
        <ExternalLink className="w-3 h-3 mr-2" />
        Ouvrir dans un nouvel onglet
      </ContextMenuItem>
    </ContextMenuContent>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0 [&>button.absolute]:hidden" data-testid="sheet-daily-digest">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-primary" />
              <SheetTitle className="text-base font-heading font-semibold">Ma journée</SheetTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => refresh.mutate()}
                disabled={refresh.isPending || isLoading}
                data-testid="button-refresh-digest"
              >
                <RefreshCw className={`w-4 h-4 ${refresh.isPending ? "animate-spin" : ""}`} />
              </Button>
              <SheetClose asChild>
                <Button size="icon" variant="ghost" data-testid="button-close-digest">
                  <X className="w-4 h-4" />
                </Button>
              </SheetClose>
            </div>
          </div>
          {generatedAt && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Mis à jour aujourd'hui à {generatedAt}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Vos priorités, échéances et signaux à surveiller aujourd'hui.
          </p>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {isLoading && (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          )}

          {isError && !isLoading && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Impossible de charger le brief.</p>
              <Button size="sm" variant="outline" onClick={() => refresh.mutate()}>Réessayer</Button>
            </div>
          )}

          {digest && !isLoading && (
            <>
              {/* ── Section 1 : Tâches prioritaires ── */}
              <section data-testid="digest-section-tasks">
                <SectionTitle icon={CheckSquare} label="Priorités du jour" />
                {digest.topTasks.length === 0 ? (
                  <EmptyState message="Aucune tâche critique aujourd'hui. Vous pouvez avancer sur vos projets de fond." />
                ) : (
                  <div className="space-y-2">
                    {digest.topTasks.map((task) => (
                      <ContextMenu key={task.id}>
                        <ContextMenuTrigger asChild>
                      <div
                        className="flex items-start gap-3 p-3 rounded-md border border-border hover-elevate active-elevate-2 cursor-pointer"
                        onClick={() => navigate(task.url)}
                        data-testid={`digest-task-${task.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground leading-snug truncate">{task.title}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            {priorityBadge(task.priority)}
                            {task.daysOverdue > 0 && (
                              <Badge variant="outline" className="text-[10px] border-red-400 text-red-600 dark:text-red-400">
                                En retard de {task.daysOverdue}j
                              </Badge>
                            )}
                            {task.dueDate && task.daysOverdue === 0 && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                Aujourd'hui
                              </span>
                            )}
                            {task.projectName && (
                              <span className="text-[10px] text-muted-foreground truncate">{task.projectName}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      </div>
                        </ContextMenuTrigger>
                        <ItemMenu url={task.url} />
                      </ContextMenu>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Section 2 : Rendez-vous du jour ── */}
              <section data-testid="digest-section-appointments">
                <SectionTitle icon={Calendar} label="Rendez-vous du jour" />
                {todayAppointments.length === 0 ? (
                  <EmptyState message="Aucun rendez-vous prévu aujourd'hui." />
                ) : (
                  <div className="space-y-2">
                    {todayAppointments.map((appt) => {
                      const start = new Date(appt.startDateTime);
                      const end = appt.endDateTime ? new Date(appt.endDateTime) : null;
                      const fmt = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <ContextMenu key={appt.id}>
                          <ContextMenuTrigger asChild>
                        <div
                          className="flex items-start gap-3 p-3 rounded-md border border-border hover-elevate active-elevate-2 cursor-pointer"
                          onClick={() => navigate("/calendar")}
                          data-testid={`digest-appointment-${appt.id}`}
                        >
                          <Clock className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground leading-snug truncate">{appt.title}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <span className="text-[10px] text-muted-foreground">
                                {fmt(start)}{end ? ` – ${fmt(end)}` : ""}
                              </span>
                              {appt.source === "google" && (
                                <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-600 dark:text-blue-400">Google</Badge>
                              )}
                              {appt.hangoutLink && (
                                <a
                                  href={appt.hangoutLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                                  data-testid={`link-meet-${appt.id}`}
                                >
                                  <Video className="w-2.5 h-2.5" />
                                  Meet
                                </a>
                              )}
                              {appt.location && (
                                <span className="text-[10px] text-muted-foreground truncate">{appt.location}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        </div>
                          </ContextMenuTrigger>
                          <ItemMenu url="/calendar" />
                        </ContextMenu>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ── Section 3 : Roadmap ── */}
              <section data-testid="digest-section-roadmap">
                <SectionTitle icon={MapPin} label="Roadmap & jalons" />
                {digest.roadmap.completedLast7Days.length === 0 && digest.roadmap.upcomingNext7Days.length === 0 ? (
                  <EmptyState message="Pas de jalon roadmap récent ou imminent." />
                ) : (
                  <div className="space-y-3">
                    {digest.roadmap.upcomingNext7Days.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-1.5">
                          <CalendarClock className="w-3 h-3" />
                          Prochain milestone
                        </p>
                        <div className="space-y-1.5">
                          {digest.roadmap.upcomingNext7Days.map((m) => (
                            <ContextMenu key={m.id}>
                              <ContextMenuTrigger asChild>
                            <div
                              className="flex items-center gap-2 p-2 rounded-md border border-border hover-elevate active-elevate-2 cursor-pointer"
                              onClick={() => navigate(m.url)}
                              data-testid={`digest-milestone-upcoming-${m.id}`}
                            >
                              <CalendarClock className="w-3 h-3 text-amber-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                {m.projectName && (
                                  <p className="text-[10px] font-medium text-primary truncate">{m.projectName}</p>
                                )}
                                <p className="text-xs font-medium truncate">{m.title}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(m.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                </p>
                              </div>
                              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                            </div>
                              </ContextMenuTrigger>
                              <ItemMenu url={m.url} />
                            </ContextMenu>
                          ))}
                        </div>
                      </div>
                    )}
                    {digest.roadmap.completedLast7Days.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-1.5">
                          <CheckCheck className="w-3 h-3" />
                          Atteints ces 7 derniers jours
                        </p>
                        <div className="space-y-1.5">
                          {digest.roadmap.completedLast7Days.map((m) => (
                            <ContextMenu key={m.id}>
                              <ContextMenuTrigger asChild>
                            <div
                              className="flex items-center gap-2 p-2 rounded-md border border-border hover-elevate active-elevate-2 cursor-pointer"
                              onClick={() => navigate(m.url)}
                              data-testid={`digest-milestone-done-${m.id}`}
                            >
                              <CheckCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                {m.projectName && (
                                  <p className="text-[10px] font-medium text-primary truncate">{m.projectName}</p>
                                )}
                                <p className="text-xs font-medium truncate">{m.title}</p>
                              </div>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">Terminé</Badge>
                            </div>
                              </ContextMenuTrigger>
                              <ItemMenu url={m.url} />
                            </ContextMenu>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ── Section 3 : Facturation ── */}
              <section data-testid="digest-section-billing">
                <SectionTitle icon={Banknote} label="Facturation" />
                {digest.billingProjects.length === 0 ? (
                  <EmptyState message="Aucun signal de facturation détecté aujourd'hui." />
                ) : (
                  <div className="space-y-2">
                    {digest.billingProjects.map((p) => (
                      <ContextMenu key={p.id}>
                        <ContextMenuTrigger asChild>
                      <div
                        className="flex items-start gap-3 p-3 rounded-md border border-border hover-elevate active-elevate-2 cursor-pointer"
                        onClick={() => navigate(p.url)}
                        data-testid={`digest-billing-${p.id}`}
                      >
                        <Banknote className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{p.name}</p>
                          {p.clientName && <p className="text-[10px] text-muted-foreground">{p.clientName}</p>}
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{p.reason}</p>
                          {p.budget && (
                            <p className="text-[10px] text-foreground font-medium mt-0.5">
                              {parseFloat(p.budget).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                            </p>
                          )}
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      </div>
                        </ContextMenuTrigger>
                        <ItemMenu url={p.url} />
                      </ContextMenu>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Section 4 : Recommandations ── */}
              <section data-testid="digest-section-recommendations">
                <SectionTitle icon={Lightbulb} label="Recommandations" />
                {digest.recommendations.length === 0 ? (
                  <EmptyState message="Aucune recommandation particulière aujourd'hui." />
                ) : (
                  <div className="space-y-2">
                    {digest.recommendations.map((r) => (
                      <ContextMenu key={r.id}>
                        <ContextMenuTrigger asChild>
                      <div
                        className="flex items-start gap-3 p-3 rounded-md border border-border hover-elevate active-elevate-2 cursor-pointer"
                        onClick={() => navigate(r.url)}
                        data-testid={`digest-reco-${r.id}`}
                      >
                        <Flag className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${r.priority === "high" ? "text-red-500" : r.priority === "medium" ? "text-amber-500" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <p className="text-xs font-medium">{r.title}</p>
                            {recoBadge(r.type)}
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-snug">{r.description}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      </div>
                        </ContextMenuTrigger>
                        <ItemMenu url={r.url} />
                      </ContextMenu>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
