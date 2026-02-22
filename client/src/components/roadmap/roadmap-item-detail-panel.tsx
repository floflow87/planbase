import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Clock, Flag, Package, Tag, Link2, CheckCircle2, Circle, AlertCircle, Pencil, ExternalLink, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Loader } from "@/components/Loader";
import type { RoadmapItem, Epic, BacklogTask } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  planned: { label: "Planifié", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Circle },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  done: { label: "Terminé", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  blocked: { label: "Bloqué", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: AlertCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  strategic: { label: "Stratégique", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  high: { label: "Haute", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  normal: { label: "Normale", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  low: { label: "Basse", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  deliverable: { label: "Livrable", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  milestone: { label: "Milestone", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  initiative: { label: "Initiative", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  free_block: { label: "Bloc", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  epic_group: { label: "Rubrique", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  feature: { label: "Fonctionnalité", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

const TICKET_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  backlog: { label: "Backlog", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  todo: { label: "À faire", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  review: { label: "En revue", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  testing: { label: "Test", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  done: { label: "Terminé", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  to_fix: { label: "À corriger", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

interface RoadmapItemDetailPanelProps {
  item: RoadmapItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (item: RoadmapItem) => void;
  epics: Epic[];
  backlogId: string | null;
}

export function RoadmapItemDetailPanel({ item, open, onOpenChange, onEdit, epics, backlogId }: RoadmapItemDetailPanelProps) {
  const linkedEpic = item?.epicId ? epics.find(e => e.id === item.epicId) : null;

  const { data: epicTasks = [], isLoading: isLoadingTasks } = useQuery<BacklogTask[]>({
    queryKey: [`/api/backlogs/${backlogId}/tasks`],
    enabled: !!backlogId && !!linkedEpic,
  });

  const filteredTasks = linkedEpic
    ? epicTasks.filter(t => t.epicId === linkedEpic.id)
    : [];

  const taskStats = {
    total: filteredTasks.length,
    done: filteredTasks.filter(t => t.state === "done").length,
    inProgress: filteredTasks.filter(t => t.state === "in_progress").length,
    blocked: filteredTasks.filter(t => t.state === "to_fix").length,
  };

  const taskProgress = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;

  if (!item) return null;

  const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned;
  const priorityConfig = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.normal;
  const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG.deliverable;
  const StatusIcon = statusConfig.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-hidden flex flex-col bg-white dark:bg-slate-900 p-0">
        <div className="px-6 pt-6 pb-4">
          <SheetHeader>
            <div className="flex items-start justify-between gap-2">
              <SheetTitle className="text-lg leading-tight pr-2" data-testid="text-detail-item-title">{item.title}</SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(() => onEdit(item), 150);
                }}
                data-testid="button-edit-item-detail"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            <SheetDescription className="sr-only">Détails de l'élément de la roadmap</SheetDescription>
          </SheetHeader>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge className={`text-xs ${typeConfig.color}`} data-testid="badge-detail-type">{typeConfig.label}</Badge>
            <Badge className={`text-xs ${statusConfig.color}`} data-testid="badge-detail-status">
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
            <Badge className={`text-xs ${priorityConfig.color}`} data-testid="badge-detail-priority">
              <Flag className="h-3 w-3 mr-1" />
              {priorityConfig.label}
            </Badge>
            {item.releaseTag && (
              <Badge variant="outline" className="text-xs">
                <Tag className="h-3 w-3 mr-1" />
                {item.releaseTag}
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="space-y-5">
            {item.description && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Description</h4>
                <p className="text-sm leading-relaxed">{item.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {item.startDate && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Début</h4>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(parseISO(item.startDate), "dd MMM yyyy", { locale: fr })}
                  </div>
                </div>
              )}
              {item.endDate && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Fin</h4>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(parseISO(item.endDate), "dd MMM yyyy", { locale: fr })}
                  </div>
                </div>
              )}
            </div>

            {item.phase && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Phase</h4>
                <Badge variant="outline" className="text-xs">{item.phase}</Badge>
              </div>
            )}

            {item.progress > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Progression</h4>
                <div className="flex items-center gap-3">
                  <Progress value={item.progress} className="flex-1 h-2" />
                  <span className="text-sm font-medium">{item.progress}%</span>
                </div>
              </div>
            )}

            <Separator />

            {linkedEpic ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Epic liée</h4>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30 mb-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium" data-testid="text-detail-epic-title">{linkedEpic.title}</span>
                    {linkedEpic.status && (
                      <Badge className={`text-xs ${STATUS_CONFIG[linkedEpic.status]?.color || ""}`}>
                        {STATUS_CONFIG[linkedEpic.status]?.label || linkedEpic.status}
                      </Badge>
                    )}
                  </div>
                  {linkedEpic.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{linkedEpic.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Tickets associés</h4>
                    <Badge variant="secondary" className="text-xs" data-testid="badge-detail-ticket-count">{taskStats.total}</Badge>
                  </div>
                </div>

                {taskStats.total > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-3 mb-1.5">
                      <Progress value={taskProgress} className="flex-1 h-2" />
                      <span className="text-xs font-medium text-muted-foreground">{taskProgress}%</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{taskStats.done} terminé(s)</span>
                      <span>{taskStats.inProgress} en cours</span>
                      {taskStats.blocked > 0 && <span className="text-red-600">{taskStats.blocked} à corriger</span>}
                    </div>
                  </div>
                )}

                {isLoadingTasks ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader />
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg border-dashed">
                    Aucun ticket lié à cette epic
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredTasks.map(task => {
                      const taskStatusConfig = TICKET_STATUS_CONFIG[task.state] || TICKET_STATUS_CONFIG.backlog;
                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-lg border hover-elevate"
                          data-testid={`detail-ticket-${task.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{task.title}</p>
                            {task.estimatePoints != null && (
                              <span className="text-xs text-muted-foreground">{task.estimatePoints} pts</span>
                            )}
                          </div>
                          <Badge className={`text-xs flex-shrink-0 ${taskStatusConfig.color}`}>
                            {taskStatusConfig.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">Liaison</h4>
                </div>
                <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg border-dashed">
                  Cet élément n'est pas lié à une epic.
                  <br />
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1 h-auto p-0 text-xs"
                    onClick={() => {
                      onOpenChange(false);
                      setTimeout(() => onEdit(item), 150);
                    }}
                    data-testid="button-link-epic"
                  >
                    Lier à une epic
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}