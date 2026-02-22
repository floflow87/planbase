import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Eye, 
  Target, 
  TrendingUp, 
  BarChart3, 
  Flag, 
  Layers, 
  Tag, 
  CircleDot,
  Package,
  Ticket,
  FileText,
  GripVertical,
  Save,
  X,
  CheckCircle2,
  Clock,
  Circle,
  AlertCircle
} from "lucide-react";
import type { RoadmapItem, Epic, BacklogTask } from "@shared/schema";

const LANE_CONFIG = {
  now: { label: "Now", description: "En cours de réalisation", color: "bg-emerald-500/10 border-emerald-500/30", headerColor: "bg-emerald-500", textColor: "text-emerald-700 dark:text-emerald-400" },
  next: { label: "Next", description: "Planifié prochainement", color: "bg-blue-500/10 border-blue-500/30", headerColor: "bg-blue-500", textColor: "text-blue-700 dark:text-blue-400" },
  later: { label: "Later", description: "À envisager plus tard", color: "bg-purple-500/10 border-purple-500/30", headerColor: "bg-purple-500", textColor: "text-purple-700 dark:text-purple-400" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  planned: { label: "Planifié", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Circle },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  done: { label: "Terminé", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  blocked: { label: "Bloqué", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: AlertCircle },
};

interface NowNextLaterViewProps {
  items: RoadmapItem[];
  roadmapId?: string;
  onItemClick: (item: RoadmapItem) => void;
  onAddItem: () => void;
  onUpdateItem: (itemId: string, newStatus: string, newOrderIndex: number) => void;
  epics: Epic[];
  backlogId: string | null;
}

export function NowNextLaterView({ items, roadmapId, onItemClick, onAddItem, onUpdateItem, epics, backlogId }: NowNextLaterViewProps) {
  const { toast } = useToast();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const { data: epicTasks = [] } = useQuery<BacklogTask[]>({
    queryKey: [`/api/backlogs/${backlogId}/tasks`],
    enabled: !!backlogId,
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RoadmapItem> }) => {
      return apiRequest(`/api/roadmap-items/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${roadmapId}/items`] });
      toast({ title: "Élément mis à jour", variant: "success" });
      setEditingItemId(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour.", variant: "destructive" });
    },
  });

  const computeLane = (item: RoadmapItem): string => {
    if (!item.endDate) return item.lane || "later";
    const now = new Date();
    const end = new Date(item.endDate);
    const diffMs = end.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 30) return "now";
    if (diffDays <= 90) return "next";
    return "later";
  };

  const laneItems = {
    now: items.filter(i => computeLane(i) === "now"),
    next: items.filter(i => computeLane(i) === "next"),
    later: items.filter(i => computeLane(i) === "later"),
  };

  const handleMoveLane = (itemId: string, newLane: string) => {
    const item = items.find(i => i.id === itemId);
    if (item?.endDate) return;
    updateItemMutation.mutate({ id: itemId, data: { lane: newLane } });
  };

  const openEditSheet = (item: RoadmapItem) => {
    setEditingItemId(item.id);
    setEditForm({
      vision: item.vision || "",
      objectif: item.objectif || "",
      impact: item.impact || "",
      metrics: item.metrics || "",
      phase: item.phase || "",
      releaseTag: item.releaseTag || "",
      status: item.status,
      lane: computeLane(item),
    });
  };

  const handleSaveEdit = () => {
    if (!editingItemId) return;
    updateItemMutation.mutate({
      id: editingItemId,
      data: {
        vision: editForm.vision,
        objectif: editForm.objectif,
        impact: editForm.impact,
        metrics: editForm.metrics,
        phase: editForm.phase,
        releaseTag: editForm.releaseTag,
        status: editForm.status,
        lane: editForm.lane,
      },
    });
  };

  const editingItem = items.find(i => i.id === editingItemId);
  const linkedEpic = editingItem?.epicId ? epics.find(e => e.id === editingItem.epicId) : null;
  const linkedTasks = linkedEpic ? epicTasks.filter(t => t.epicId === linkedEpic.id) : [];

  const renderCard = (item: RoadmapItem) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned;
    const StatusIcon = statusConfig.icon;
    const itemEpic = item.epicId ? epics.find(e => e.id === item.epicId) : null;
    const itemTasks = itemEpic ? epicTasks.filter(t => t.epicId === itemEpic.id) : [];
    const doneTasks = itemTasks.filter(t => t.state === "done").length;

    return (
      <Card
        key={item.id}
        className="cursor-pointer hover-elevate active-elevate-2 overflow-visible"
        onClick={() => openEditSheet(item)}
        data-testid={`nnl-card-${item.id}`}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium leading-tight flex-1">{item.title}</h4>
            <Badge className={`text-[10px] shrink-0 ${statusConfig.color}`}>
              <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
              {statusConfig.label}
            </Badge>
          </div>

          {item.vision && (
            <div className="flex items-start gap-1.5">
              <Eye className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground line-clamp-2">{item.vision}</p>
            </div>
          )}

          {item.objectif && (
            <div className="flex items-start gap-1.5">
              <Target className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground line-clamp-2">{item.objectif}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {item.phase && (
              <Badge variant="outline" className="text-[10px]">
                <Layers className="h-2.5 w-2.5 mr-0.5" />
                {item.phase}
              </Badge>
            )}
            {item.releaseTag && (
              <Badge variant="outline" className="text-[10px]">
                <Tag className="h-2.5 w-2.5 mr-0.5" />
                {item.releaseTag}
              </Badge>
            )}
            {itemEpic && (
              <Badge variant="secondary" className="text-[10px]">
                <Package className="h-2.5 w-2.5 mr-0.5" />
                {itemEpic.title}
              </Badge>
            )}
            {itemTasks.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                <Ticket className="h-2.5 w-2.5 mr-0.5" />
                {doneTasks}/{itemTasks.length}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderLane = (laneKey: "now" | "next" | "later") => {
    const config = LANE_CONFIG[laneKey];
    const laneItemsList = laneItems[laneKey];

    return (
      <div className="flex-1 min-w-[280px]" data-testid={`nnl-lane-${laneKey}`}>
        <div className={`rounded-lg border ${config.color} p-3`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${config.headerColor}`} />
              <h3 className={`text-sm font-semibold ${config.textColor}`}>{config.label}</h3>
              <Badge variant="secondary" className="text-[10px]">{laneItemsList.length}</Badge>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">{config.description}</p>
          <div className="space-y-2">
            {laneItemsList.map(renderCard)}
            {laneItemsList.length === 0 && (
              <div className="border-2 border-dashed rounded-md p-4 text-center text-xs text-muted-foreground">
                Aucun élément
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {renderLane("now")}
        {renderLane("next")}
        {renderLane("later")}
      </div>

      <Sheet open={!!editingItemId} onOpenChange={(open) => { if (!open) setEditingItemId(null); }}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-hidden flex flex-col p-0">
          <div className="px-6 pt-6 pb-4">
            <SheetHeader>
              <SheetTitle className="text-lg">{editingItem?.title}</SheetTitle>
              <SheetDescription className="sr-only">Paramètres de l'élément</SheetDescription>
            </SheetHeader>
          </div>

          <ScrollArea className="flex-1 px-6 pb-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Colonne</Label>
                {editingItem?.endDate ? (
                  <div className="flex items-center gap-2">
                    <Badge className={`${LANE_CONFIG[editForm.lane as keyof typeof LANE_CONFIG]?.textColor || ""}`}>
                      {LANE_CONFIG[editForm.lane as keyof typeof LANE_CONFIG]?.label || editForm.lane}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Calculée automatiquement selon la date de fin</span>
                  </div>
                ) : (
                  <Select value={editForm.lane || "later"} onValueChange={(v) => setEditForm(prev => ({ ...prev, lane: v }))}>
                    <SelectTrigger data-testid="select-nnl-lane">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="now">Now</SelectItem>
                      <SelectItem value="next">Next</SelectItem>
                      <SelectItem value="later">Later</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  Vision
                </Label>
                <Textarea
                  value={editForm.vision || ""}
                  onChange={(e) => setEditForm(prev => ({ ...prev, vision: e.target.value }))}
                  placeholder="Quelle est la vision de cet élément ?"
                  className="resize-none text-sm"
                  rows={2}
                  data-testid="input-nnl-vision"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  Objectif
                </Label>
                <Textarea
                  value={editForm.objectif || ""}
                  onChange={(e) => setEditForm(prev => ({ ...prev, objectif: e.target.value }))}
                  placeholder="Quel est l'objectif à atteindre ?"
                  className="resize-none text-sm"
                  rows={2}
                  data-testid="input-nnl-objectif"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Impact
                </Label>
                <Textarea
                  value={editForm.impact || ""}
                  onChange={(e) => setEditForm(prev => ({ ...prev, impact: e.target.value }))}
                  placeholder="Quel impact attendu ?"
                  className="resize-none text-sm"
                  rows={2}
                  data-testid="input-nnl-impact"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Métriques
                </Label>
                <Textarea
                  value={editForm.metrics || ""}
                  onChange={(e) => setEditForm(prev => ({ ...prev, metrics: e.target.value }))}
                  placeholder="Comment mesurer le succès ?"
                  className="resize-none text-sm"
                  rows={2}
                  data-testid="input-nnl-metrics"
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Phase
                  </Label>
                  <Input
                    value={editForm.phase || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phase: e.target.value }))}
                    placeholder="Ex: T1, T2..."
                    className="text-sm"
                    data-testid="input-nnl-phase"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    Version
                  </Label>
                  <Input
                    value={editForm.releaseTag || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, releaseTag: e.target.value }))}
                    placeholder="Ex: MVP, V1..."
                    className="text-sm"
                    data-testid="input-nnl-version"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CircleDot className="h-3.5 w-3.5" />
                  Statut
                </Label>
                <Select value={editForm.status || "planned"} onValueChange={(v) => setEditForm(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger data-testid="select-nnl-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planifié</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="done">Terminé</SelectItem>
                    <SelectItem value="blocked">Bloqué</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingItem && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Flag className="h-3.5 w-3.5" />
                    Jalons
                  </Label>
                  {editingItem.startDate || editingItem.endDate ? (
                    <div className="text-sm text-muted-foreground">
                      {editingItem.startDate && <span>Début : {editingItem.startDate}</span>}
                      {editingItem.startDate && editingItem.endDate && <span> — </span>}
                      {editingItem.endDate && <span>Fin : {editingItem.endDate}</span>}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucun jalon défini</p>
                  )}
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  Éléments liés
                </h4>

                {linkedEpic ? (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-md border bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">Epic</Badge>
                        <span className="text-sm font-medium">{linkedEpic.title}</span>
                      </div>
                      {linkedEpic.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{linkedEpic.description}</p>
                      )}
                    </div>

                    {linkedTasks.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Ticket className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">Tickets ({linkedTasks.length})</span>
                        </div>
                        {linkedTasks.slice(0, 10).map(task => {
                          const taskStatus = task.state === "done" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" 
                            : task.state === "in_progress" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
                          return (
                            <div key={task.id} className="flex items-center justify-between gap-2 p-2 rounded border text-xs">
                              <span className="truncate">{task.title}</span>
                              <Badge className={`text-[10px] shrink-0 ${taskStatus}`}>
                                {task.state === "done" ? "Terminé" : task.state === "in_progress" ? "En cours" : task.state}
                              </Badge>
                            </div>
                          );
                        })}
                        {linkedTasks.length > 10 && (
                          <p className="text-[10px] text-muted-foreground">... et {linkedTasks.length - 10} de plus</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-3 text-xs text-muted-foreground border rounded-md border-dashed">
                    Aucune epic liée. Utilisez la vue Gantt pour lier une epic.
                  </div>
                )}

                {editingItem?.sourceType === "cdc" && (
                  <div className="p-2.5 rounded-md border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <Badge variant="secondary" className="text-[10px]">CDC</Badge>
                      <span className="text-xs text-muted-foreground">Source : Cahier des charges</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="border-t px-6 py-3 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingItemId(null)} data-testid="button-nnl-cancel">
              Annuler
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={updateItemMutation.isPending} data-testid="button-nnl-save">
              <Save className="h-3.5 w-3.5 mr-1" />
              {updateItemMutation.isPending ? "..." : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
