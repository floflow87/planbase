import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Clock, Flag, Package, Tag, Link2, CheckCircle2, Circle, AlertCircle, Pencil, ExternalLink, Ticket, FileText, X, Plus, Search, Target, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader } from "@/components/Loader";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { RoadmapItem, Epic, BacklogTask, Note } from "@shared/schema";

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

const ACTION_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  discovery: { label: "Discovery", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
  develop: { label: "Développer", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  test: { label: "Tester", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  review: { label: "Review", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  validate: { label: "Valider", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  stop: { label: "Stopper", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
};

interface RoadmapItemDetailPanelProps {
  item: RoadmapItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (item: RoadmapItem) => void;
  epics: Epic[];
  backlogId: string | null;
  roadmapId?: string | null;
}

export function RoadmapItemDetailPanel({ item, open, onOpenChange, onEdit, epics, backlogId, roadmapId }: RoadmapItemDetailPanelProps) {
  const [noteSelectorOpen, setNoteSelectorOpen] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");
  const [okrSelectorOpen, setOkrSelectorOpen] = useState(false);

  const linkedEpic = item?.epicId ? epics.find(e => e.id === item.epicId) : null;

  const { data: epicTasks = [], isLoading: isLoadingTasks } = useQuery<BacklogTask[]>({
    queryKey: [`/api/backlogs/${backlogId}/tasks`],
    enabled: !!backlogId && !!linkedEpic,
  });

  const { data: linkedNotes = [], isLoading: isLoadingNotes } = useQuery<Note[]>({
    queryKey: ["/api/notes/by-entity/roadmap_item", item?.id],
    enabled: !!item?.id && open,
  });

  const { data: allNotes = [] } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
    enabled: noteSelectorOpen,
  });

  const { data: okrObjectives = [] } = useQuery<any[]>({
    queryKey: [`/api/roadmaps/${roadmapId}/okr-objectives`],
    enabled: !!roadmapId && open,
  });

  const linkedObjective = item?.objectiveId ? okrObjectives.find((o: any) => o.id === item.objectiveId) : null;

  const updateOkrLinkMutation = useMutation({
    mutationFn: async (objectiveId: string | null) => {
      const res = await apiRequest(`/api/roadmap-items/${item!.id}`, "PATCH", { objectiveId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${roadmapId}/items`] });
      setOkrSelectorOpen(false);
    },
  });

  const linkNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await apiRequest(`/api/notes/${noteId}/links`, "POST", {
        targetType: "roadmap_item",
        targetId: item!.id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes/by-entity/roadmap_item", item?.id] });
      setNoteSelectorOpen(false);
      setNoteSearch("");
    },
  });

  const unlinkNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await apiRequest(`/api/notes/${noteId}/links/roadmap_item/${item!.id}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes/by-entity/roadmap_item", item?.id] });
    },
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

  const availableNotes = allNotes.filter(
    n => !linkedNotes.some(ln => ln.id === n.id) &&
    (noteSearch === "" || (n.title || "").toLowerCase().includes(noteSearch.toLowerCase()))
  );

  if (!item) return null;

  const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned;
  const priorityConfig = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.normal;
  const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG.deliverable;
  const actionConfig = item.actionType ? ACTION_TYPE_CONFIG[item.actionType] : null;
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
            {actionConfig && (
              <Badge className={`text-xs ${actionConfig.color}`} data-testid="badge-detail-action-type">
                <Zap className="h-3 w-3 mr-1" />
                {actionConfig.label}
              </Badge>
            )}
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

            {/* OKR Objective section */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">Objectif OKR</h4>
                </div>
                <Popover open={okrSelectorOpen} onOpenChange={setOkrSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" data-testid="button-link-okr">
                      {linkedObjective ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {linkedObjective ? "Changer" : "Lier"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2 z-[10000]" align="end">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
                      {okrObjectives.length === 0 ? "Aucun objectif OKR disponible pour ce projet" : "Objectifs OKR du projet"}
                    </p>
                    {okrObjectives.length > 0 && (
                      <div className="space-y-0.5 max-h-48 overflow-y-auto">
                        {linkedObjective && (
                          <button
                            className="w-full text-left text-xs px-2 py-1.5 rounded-md hover-elevate text-muted-foreground"
                            onClick={() => updateOkrLinkMutation.mutate(null)}
                            disabled={updateOkrLinkMutation.isPending}
                            data-testid="button-unlink-okr"
                          >
                            Aucun (retirer le lien)
                          </button>
                        )}
                        {okrObjectives.map((obj: any) => (
                          <button
                            key={obj.id}
                            className={`w-full text-left text-xs px-2 py-1.5 rounded-md hover-elevate truncate ${item.objectiveId === obj.id ? "bg-violet-50 dark:bg-violet-900/20 font-medium" : ""}`}
                            onClick={() => updateOkrLinkMutation.mutate(obj.id)}
                            disabled={updateOkrLinkMutation.isPending}
                            data-testid={`button-select-okr-${obj.id}`}
                          >
                            {obj.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {linkedObjective ? (
                <div className="p-3 rounded-lg border bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-800">
                  <div className="flex items-start gap-2">
                    <Target className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-violet-800 dark:text-violet-300 leading-tight" data-testid="text-detail-okr-title">{linkedObjective.title}</p>
                      {linkedObjective.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{linkedObjective.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0 text-muted-foreground"
                      onClick={() => updateOkrLinkMutation.mutate(null)}
                      disabled={updateOkrLinkMutation.isPending}
                      data-testid="button-remove-okr"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3 text-xs text-muted-foreground border rounded-lg border-dashed">
                  Aucun objectif OKR lié
                </div>
              )}
            </div>

            <Separator />

            {/* Epic section */}
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

            <Separator />

            {/* Notes section */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">Notes liées</h4>
                  {linkedNotes.length > 0 && (
                    <Badge variant="secondary" className="text-xs" data-testid="badge-detail-note-count">{linkedNotes.length}</Badge>
                  )}
                </div>
                <Popover open={noteSelectorOpen} onOpenChange={(o) => { setNoteSelectorOpen(o); if (!o) setNoteSearch(""); }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" data-testid="button-link-note">
                      <Plus className="h-3 w-3" />
                      Lier
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2 z-[10000]" align="end">
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher une note..."
                        value={noteSearch}
                        onChange={e => setNoteSearch(e.target.value)}
                        className="pl-8 h-8 text-xs"
                        data-testid="input-note-search"
                      />
                    </div>
                    {availableNotes.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        {allNotes.length === 0 ? "Chargement..." : "Aucune note disponible"}
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {availableNotes.map(note => (
                          <button
                            key={note.id}
                            className="w-full text-left text-xs px-2 py-1.5 rounded-md hover-elevate truncate"
                            onClick={() => linkNoteMutation.mutate(note.id)}
                            disabled={linkNoteMutation.isPending}
                            data-testid={`button-select-note-${note.id}`}
                          >
                            {note.title || "Note sans titre"}
                          </button>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {isLoadingNotes ? (
                <div className="flex items-center justify-center py-3">
                  <Loader />
                </div>
              ) : linkedNotes.length === 0 ? (
                <div className="text-center py-3 text-xs text-muted-foreground border rounded-lg border-dashed">
                  Aucune note liée à cet élément
                </div>
              ) : (
                <div className="space-y-1.5">
                  {linkedNotes.map(note => (
                    <div
                      key={note.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border"
                      data-testid={`detail-note-${note.id}`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">{note.title || "Note sans titre"}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0 text-muted-foreground"
                        onClick={() => unlinkNoteMutation.mutate(note.id)}
                        disabled={unlinkNoteMutation.isPending}
                        data-testid={`button-unlink-note-${note.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
