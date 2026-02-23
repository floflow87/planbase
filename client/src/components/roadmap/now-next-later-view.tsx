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
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
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
  CheckCircle2,
  Clock,
  Circle,
  AlertCircle,
  EyeOff,
  Trash2
} from "lucide-react";
import type { RoadmapItem, Epic, BacklogTask } from "@shared/schema";

const LANE_CONFIG: Record<string, { label: string; description: string; color: string; headerColor: string; textColor: string }> = {
  now: { label: "Now", description: "En cours de réalisation", color: "bg-emerald-500/10 border-emerald-500/30", headerColor: "bg-emerald-500", textColor: "text-emerald-700 dark:text-emerald-400" },
  next: { label: "Next", description: "Planifié prochainement", color: "bg-blue-500/10 border-blue-500/30", headerColor: "bg-blue-500", textColor: "text-blue-700 dark:text-blue-400" },
  later: { label: "Later", description: "À envisager plus tard", color: "bg-purple-500/10 border-purple-500/30", headerColor: "bg-purple-500", textColor: "text-purple-700 dark:text-purple-400" },
  unqualified: { label: "Non qualifié", description: "Éléments à qualifier", color: "bg-gray-500/10 border-gray-500/30", headerColor: "bg-gray-400", textColor: "text-gray-600 dark:text-gray-400" },
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
  onAddItem: (defaultLane?: string) => void;
  onUpdateItem: (itemId: string, newStatus: string, newOrderIndex: number) => void;
  epics: Epic[];
  backlogId: string | null;
}

function DroppableLane({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 min-h-[100px] rounded-md transition-colors ${isOver ? "bg-accent/20" : ""}`}
    >
      {children}
    </div>
  );
}

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export function NowNextLaterView({ items, roadmapId, onItemClick, onAddItem, onUpdateItem, epics, backlogId }: NowNextLaterViewProps) {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hideUnqualified, setHideUnqualified] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [isCreatingNnl, setIsCreatingNnl] = useState(false);
  const [createLane, setCreateLane] = useState<string>("now");
  const [createForm, setCreateForm] = useState({
    title: "",
    vision: "",
    objectif: "",
    impact: "",
    metrics: "",
    phase: "",
    releaseTag: "",
    status: "planned",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: epicTasks = [] } = useQuery<BacklogTask[]>({
    queryKey: ['/api/backlogs', backlogId, 'tasks'],
    queryFn: async () => {
      const res = await apiRequest(`/api/backlogs/${backlogId}/tasks`, 'GET');
      return res.json();
    },
    enabled: !!backlogId,
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RoadmapItem> }) => {
      const res = await apiRequest(`/api/roadmap-items/${id}`, 'PATCH', data);
      return await res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: [`/api/roadmaps/${roadmapId}/items`] });
      const previousItems = queryClient.getQueryData<RoadmapItem[]>([`/api/roadmaps/${roadmapId}/items`]);
      if (previousItems) {
        queryClient.setQueryData<RoadmapItem[]>(
          [`/api/roadmaps/${roadmapId}/items`],
          previousItems.map(item => item.id === id ? { ...item, ...data } as RoadmapItem : item)
        );
      }
      return { previousItems };
    },
    onError: (error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData([`/api/roadmaps/${roadmapId}/items`], context.previousItems);
      }
      console.error("NNL update error:", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${roadmapId}/items`] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/roadmap-items/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${roadmapId}/items`] });
      toast({ title: "Supprimé", description: "L'élément a été supprimé." });
      setEditingItemId(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer l'élément.", variant: "destructive" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: typeof createForm & { lane: string }) => {
      const res = await apiRequest('/api/roadmap-items', 'POST', {
        roadmapId,
        title: data.title,
        type: 'deliverable',
        priority: 'normal',
        status: data.status,
        vision: data.vision || null,
        objectif: data.objectif || null,
        impact: data.impact || null,
        metrics: data.metrics || null,
        phase: data.phase || null,
        releaseTag: data.releaseTag || null,
        lane: data.lane,
        orderIndex: items.length,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${roadmapId}/items`] });
      toast({ title: "Élément créé", description: "L'élément a été ajouté." });
      setIsCreatingNnl(false);
      setCreateForm({ title: "", vision: "", objectif: "", impact: "", metrics: "", phase: "", releaseTag: "", status: "planned" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer l'élément.", variant: "destructive" });
    },
  });

  const computeLane = (item: RoadmapItem): string => {
    if (item.lane === "unqualified") return "unqualified";
    if (!item.endDate) return item.lane || "later";
    const now = new Date();
    const end = new Date(item.endDate);
    const diffMs = end.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 30) return "now";
    if (diffDays <= 90) return "next";
    return "later";
  };

  const laneItems: Record<string, RoadmapItem[]> = {
    now: items.filter(i => computeLane(i) === "now"),
    next: items.filter(i => computeLane(i) === "next"),
    later: items.filter(i => computeLane(i) === "later"),
    unqualified: items.filter(i => computeLane(i) === "unqualified"),
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const itemId = String(active.id);
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (item.endDate && item.lane !== "unqualified") {
      toast({ title: "Info", description: "Cet élément a une date de fin, sa colonne est calculée automatiquement.", variant: "default" });
      return;
    }

    const targetLane = String(over.id);
    if (!["now", "next", "later", "unqualified"].includes(targetLane)) return;

    const currentLane = computeLane(item);
    if (currentLane === targetLane) return;

    updateItemMutation.mutate({ id: itemId, data: { lane: targetLane } });
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
    setEditingItemId(null);
  };

  const openCreateSheet = (lane: string) => {
    setCreateLane(lane);
    setCreateForm({ title: "", vision: "", objectif: "", impact: "", metrics: "", phase: "", releaseTag: "", status: "planned" });
    setIsCreatingNnl(true);
  };

  const handleCreateItem = () => {
    if (!createForm.title.trim()) return;
    createItemMutation.mutate({ ...createForm, lane: createLane });
  };

  const editingItem = items.find(i => i.id === editingItemId);
  const linkedEpic = editingItem?.epicId ? epics.find(e => e.id === editingItem.epicId) : null;
  const linkedTasks = linkedEpic ? epicTasks.filter(t => t.epicId === linkedEpic.id) : [];

  const activeItem = activeId ? items.find(i => i.id === activeId) : null;

  const renderCard = (item: RoadmapItem, isDragOverlay = false) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned;
    const StatusIcon = statusConfig.icon;
    const isGroup = item.isGroup || item.type === "epic_group";

    return (
      <Card
        key={item.id}
        className={`cursor-pointer hover-elevate active-elevate-2 overflow-visible ${isDragOverlay ? "shadow-lg ring-2 ring-primary/20" : ""}`}
        onClick={(e) => { 
          e.stopPropagation();
          if (!isDragOverlay) openEditSheet(item); 
        }}
        data-testid={`nnl-card-${item.id}`}
      >
        <CardContent className="p-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 flex-1 min-w-0">
              <GripVertical className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0 cursor-grab" />
              <h4 className={`${isGroup ? "text-[11px]" : "text-xs"} font-medium leading-tight flex-1`}>{item.title}</h4>
            </div>
            <Badge className={`text-[10px] shrink-0 ${statusConfig.color}`}>
              <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
              {statusConfig.label}
            </Badge>
          </div>

          {item.objectif && (
            <p className="text-[10px] text-muted-foreground line-clamp-2 pl-5">{item.objectif}</p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pl-5">
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
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderLane = (laneKey: string) => {
    const config = LANE_CONFIG[laneKey];
    if (!config) return null;
    const laneItemsList = laneItems[laneKey] || [];

    if (laneKey === "unqualified" && hideUnqualified) return null;

    return (
      <div className={`flex-1 ${laneKey === "unqualified" ? "min-w-[240px]" : "min-w-[280px]"}`} data-testid={`nnl-lane-${laneKey}`}>
        <div className={`rounded-lg border ${config.color} p-3`}>
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${config.headerColor}`} />
              <h3 className={`text-sm font-semibold ${config.textColor}`}>{config.label}</h3>
              <Badge variant="secondary" className="text-[10px]">{laneItemsList.length}</Badge>
            </div>
            <div className="flex items-center gap-1">
              {laneKey === "unqualified" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setHideUnqualified(true)}
                  data-testid="button-hide-unqualified"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openCreateSheet(laneKey)}
                data-testid={`button-add-nnl-${laneKey}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">{config.description}</p>
          <DroppableLane id={laneKey}>
            {laneItemsList.map(item => (
              <DraggableCard key={item.id} id={item.id}>
                {renderCard(item)}
              </DraggableCard>
            ))}
            {laneItemsList.length === 0 && (
              <div className="border-2 border-dashed rounded-md p-4 text-center text-xs text-muted-foreground">
                Aucun élément
              </div>
            )}
          </DroppableLane>
        </div>
      </div>
    );
  };

  const renderNnlFormFields = (form: Record<string, string>, setForm: (updater: (prev: Record<string, string>) => Record<string, string>) => void) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          Vision
        </Label>
        <Textarea
          value={form.vision || ""}
          onChange={(e) => setForm(prev => ({ ...prev, vision: e.target.value }))}
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
          value={form.objectif || ""}
          onChange={(e) => setForm(prev => ({ ...prev, objectif: e.target.value }))}
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
          value={form.impact || ""}
          onChange={(e) => setForm(prev => ({ ...prev, impact: e.target.value }))}
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
          value={form.metrics || ""}
          onChange={(e) => setForm(prev => ({ ...prev, metrics: e.target.value }))}
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
          <Select value={form.phase || ""} onValueChange={(v) => setForm(prev => ({ ...prev, phase: v }))}>
            <SelectTrigger className="text-sm" data-testid="select-nnl-phase">
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="T1">T1</SelectItem>
              <SelectItem value="T2">T2</SelectItem>
              <SelectItem value="T3">T3</SelectItem>
              <SelectItem value="LT">Long terme</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Version
          </Label>
          <Input
            value={form.releaseTag || ""}
            onChange={(e) => setForm(prev => ({ ...prev, releaseTag: e.target.value }))}
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
        <Select value={form.status || "planned"} onValueChange={(v) => setForm(prev => ({ ...prev, status: v }))}>
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
    </div>
  );

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {renderLane("now")}
          {renderLane("next")}
          {renderLane("later")}
          {laneItems.unqualified.length > 0 && renderLane("unqualified")}
          {hideUnqualified && laneItems.unqualified.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHideUnqualified(false)}
              className="self-start mt-8 shrink-0"
              data-testid="button-show-unqualified"
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Non qualifié ({laneItems.unqualified.length})
            </Button>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="w-[280px]">
              {renderCard(activeItem, true)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Sheet open={!!editingItemId} onOpenChange={(open) => { if (!open) setEditingItemId(null); }}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-hidden flex flex-col p-0 bg-white dark:bg-slate-900">
          <div className="px-6 pt-8 pb-4">
            <SheetHeader className="space-y-0">
              <div className="flex items-center justify-between gap-3 pr-2">
                <SheetTitle className="text-lg flex-1 leading-tight">{editingItem?.title}</SheetTitle>
                <div className="flex items-center gap-1.5 shrink-0">
                  {editingItem && !editingItem.endDate && (
                    <Select
                      value={editForm.lane || "later"}
                      onValueChange={(v) => {
                        setEditForm(prev => ({ ...prev, lane: v }));
                        if (editingItemId) {
                          updateItemMutation.mutate({ id: editingItemId, data: { lane: v } });
                        }
                      }}
                    >
                      <SelectTrigger className="w-[100px] text-xs" data-testid="select-nnl-lane-header">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="now">Now</SelectItem>
                        <SelectItem value="next">Next</SelectItem>
                        <SelectItem value="later">Later</SelectItem>
                        <SelectItem value="unqualified">Non qualifié</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {editingItem?.endDate && (
                    <Badge className={`${LANE_CONFIG[editForm.lane]?.textColor || ""}`}>
                      {LANE_CONFIG[editForm.lane]?.label || editForm.lane}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (editingItemId) {
                        deleteItemMutation.mutate(editingItemId);
                      }
                    }}
                    disabled={deleteItemMutation.isPending}
                    data-testid="button-nnl-delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <SheetDescription className="sr-only">Paramètres de l'élément</SheetDescription>
            </SheetHeader>
          </div>

          <ScrollArea className="flex-1 px-6 pb-6">
            {renderNnlFormFields(editForm, setEditForm)}

            {editingItem && (
              <div className="space-y-2 mt-4">
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

            <Separator className="my-4" />

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

      <Sheet open={isCreatingNnl} onOpenChange={setIsCreatingNnl}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-hidden flex flex-col p-0 bg-white dark:bg-slate-900">
          <div className="px-6 pt-8 pb-4">
            <SheetHeader className="space-y-0">
              <div className="flex items-center justify-between gap-3 pr-2">
                <SheetTitle className="text-lg flex-1">Nouvel élément</SheetTitle>
                <Select value={createLane} onValueChange={setCreateLane}>
                  <SelectTrigger className="w-[100px] text-xs shrink-0" data-testid="select-nnl-create-lane">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="now">Now</SelectItem>
                    <SelectItem value="next">Next</SelectItem>
                    <SelectItem value="later">Later</SelectItem>
                    <SelectItem value="unqualified">Non qualifié</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <SheetDescription className="sr-only">Créer un nouvel élément</SheetDescription>
            </SheetHeader>
          </div>

          <ScrollArea className="flex-1 px-6 pb-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Titre</Label>
                <Input
                  value={createForm.title}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Nom de l'élément"
                  className="text-sm"
                  data-testid="input-nnl-create-title"
                />
              </div>
              {renderNnlFormFields(createForm, setCreateForm as any)}
            </div>
          </ScrollArea>

          <div className="border-t px-6 py-3 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCreatingNnl(false)} data-testid="button-nnl-create-cancel">
              Annuler
            </Button>
            <Button 
              size="sm" 
              onClick={handleCreateItem} 
              disabled={!createForm.title.trim() || createItemMutation.isPending} 
              data-testid="button-nnl-create-save"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {createItemMutation.isPending ? "..." : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
