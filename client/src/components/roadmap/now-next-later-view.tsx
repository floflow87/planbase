import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  type DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { 
  Plus, 
  Eye, 
  Target, 
  TrendingUp, 
  BarChart3, 
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
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Flag,
  Zap,
  LayoutGrid,
  ListFilter,
} from "lucide-react";
import type { RoadmapItem, Epic, BacklogTask, UserStory } from "@shared/schema";

const LANE_CONFIG: Record<string, { label: string; description: string; color: string; headerColor: string; textColor: string; badgeColor: string; borderColor: string }> = {
  now: { label: "Now", description: "En cours de réalisation", color: "bg-emerald-500/10 border-emerald-500/30", headerColor: "bg-emerald-500", textColor: "text-emerald-700 dark:text-emerald-400", badgeColor: "bg-emerald-500 text-white", borderColor: "border-l-emerald-500" },
  next: { label: "Next", description: "Planifié prochainement", color: "bg-blue-500/10 border-blue-500/30", headerColor: "bg-blue-500", textColor: "text-blue-700 dark:text-blue-400", badgeColor: "bg-blue-500 text-white", borderColor: "border-l-blue-500" },
  later: { label: "Later", description: "À envisager plus tard", color: "bg-purple-500/10 border-purple-500/30", headerColor: "bg-purple-500", textColor: "text-purple-700 dark:text-purple-400", badgeColor: "bg-purple-500 text-white", borderColor: "border-l-purple-500" },
  unqualified: { label: "Non qualifié", description: "Éléments à qualifier", color: "bg-gray-500/10 border-gray-500/30", headerColor: "bg-gray-400", textColor: "text-gray-600 dark:text-gray-400", badgeColor: "bg-gray-400 text-white", borderColor: "border-l-gray-400" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  planned: { label: "Planifié", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Circle },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  done: { label: "Terminé", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  blocked: { label: "Bloqué", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: AlertCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  strategic: { label: "Stratégique", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", dotColor: "bg-violet-500" },
  high: { label: "Haute", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", dotColor: "bg-red-500" },
  normal: { label: "Normale", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300", dotColor: "bg-gray-400" },
  low: { label: "Basse", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", dotColor: "bg-blue-400" },
};

const ACTION_TYPE_CONFIG: Record<string, { label: string; color: string; badgeColor: string; headerColor: string; borderColor: string; dotColor: string }> = {
  discovery: { label: "Discovery", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300", badgeColor: "bg-pink-500 text-white", headerColor: "bg-pink-500", borderColor: "border-l-pink-500", dotColor: "bg-pink-500" },
  develop: { label: "Développer", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", badgeColor: "bg-blue-500 text-white", headerColor: "bg-blue-500", borderColor: "border-l-blue-500", dotColor: "bg-blue-500" },
  test: { label: "Tester", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", badgeColor: "bg-violet-500 text-white", headerColor: "bg-violet-500", borderColor: "border-l-violet-500", dotColor: "bg-violet-500" },
  review: { label: "Review", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", badgeColor: "bg-yellow-500 text-white", headerColor: "bg-yellow-500", borderColor: "border-l-yellow-500", dotColor: "bg-yellow-500" },
  validate: { label: "Valider", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", badgeColor: "bg-green-500 text-white", headerColor: "bg-green-500", borderColor: "border-l-green-500", dotColor: "bg-green-500" },
  stop: { label: "Stopper", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300", badgeColor: "bg-gray-400 text-white", headerColor: "bg-gray-400", borderColor: "border-l-gray-400", dotColor: "bg-gray-400" },
};

type GroupByMode = "lane" | "priority" | "action_type";

interface NowNextLaterViewProps {
  items: RoadmapItem[];
  roadmapId?: string;
  onItemClick: (item: RoadmapItem) => void;
  onAddItem: (defaultLane?: string) => void;
  onUpdateItem: (itemId: string, newStatus: string, newOrderIndex: number) => void;
  epics: Epic[];
  backlogId: string | null;
  userStories?: UserStory[];
}

function DroppableLane({ id, children, isOver }: { id: string; children: React.ReactNode; isOver?: boolean }) {
  const { setNodeRef, isOver: dndIsOver } = useDroppable({ id });
  const highlighted = isOver || dndIsOver;
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 min-h-[100px] rounded-md transition-all duration-200 ${highlighted ? "bg-accent/30 ring-2 ring-primary/20 ring-dashed" : ""}`}
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

export function NowNextLaterView({ items, roadmapId, onItemClick, onAddItem, onUpdateItem, epics, backlogId, userStories: externalUserStories }: NowNextLaterViewProps) {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overLaneId, setOverLaneId] = useState<string | null>(null);
  const [hideUnqualified, setHideUnqualified] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByMode>("lane");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [drawerLane, setDrawerLane] = useState<string>("now");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    title: "",
    vision: "",
    objectif: "",
    impact: "",
    metrics: "",
    phase: "",
    releaseTag: "",
    status: "planned",
    epicId: "",
    priority: "normal",
    actionType: "",
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

  const { data: fetchedUserStories = [] } = useQuery<UserStory[]>({
    queryKey: [`/api/backlogs/${backlogId}/user-stories`],
    enabled: !!backlogId && !externalUserStories,
  });
  const allUserStories = externalUserStories || fetchedUserStories;

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
      console.error("NNL update error:", error?.message || error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${roadmapId}/items`] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/roadmap-items/${id}`, 'DELETE');
      return await res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: [`/api/roadmaps/${roadmapId}/items`] });
      const previousItems = queryClient.getQueryData<RoadmapItem[]>([`/api/roadmaps/${roadmapId}/items`]);
      if (previousItems) {
        queryClient.setQueryData<RoadmapItem[]>(
          [`/api/roadmaps/${roadmapId}/items`],
          previousItems.filter(item => item.id !== id)
        );
      }
      setDrawerOpen(false);
      setEditingItemId(null);
      return { previousItems };
    },
    onSuccess: () => {
      toast({ title: "Supprimé", description: "L'élément a été supprimé.", className: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" });
    },
    onError: (_error, _id, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData([`/api/roadmaps/${roadmapId}/items`], context.previousItems);
      }
      console.error("NNL delete error:", _error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${roadmapId}/items`] });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: Record<string, string> & { lane: string }) => {
      const body: Record<string, unknown> = {
        roadmapId,
        title: data.title,
        type: 'deliverable',
        priority: data.priority || 'normal',
        status: data.status || 'planned',
        lane: data.lane,
        orderIndex: items.length,
      };
      if (data.vision) body.vision = data.vision;
      if (data.objectif) body.objectif = data.objectif;
      if (data.impact) body.impact = data.impact;
      if (data.metrics) body.metrics = data.metrics;
      if (data.phase) body.phase = data.phase;
      if (data.releaseTag) body.releaseTag = data.releaseTag;
      if (data.epicId) body.epicId = data.epicId;
      if (data.actionType) body.actionType = data.actionType;
      const res = await apiRequest('/api/roadmap-items', 'POST', body);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${roadmapId}/items`] });
      toast({ title: "Élément créé", description: "L'élément a été ajouté à la roadmap.", className: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" });
      setDrawerOpen(false);
      setEditingItemId(null);
    },
    onError: (error) => {
      console.error("NNL create error:", error?.message || error);
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

  const getEpicTickets = (epicId: string | null | undefined): { id: string; title: string; state: string; type: string }[] => {
    if (!epicId) return [];
    const us = allUserStories.filter(s => s.epicId === epicId).map(s => ({ id: s.id, title: s.title, state: s.state, type: "user_story" as string }));
    const tasks = epicTasks.filter(t => t.epicId === epicId).map(t => ({ id: t.id, title: t.title, state: t.state, type: "task" as string }));
    return [...us, ...tasks];
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

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over && ["now", "next", "later", "unqualified"].includes(String(over.id))) {
      setOverLaneId(String(over.id));
    } else {
      setOverLaneId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverLaneId(null);

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

  const openEditDrawer = (item: RoadmapItem) => {
    setDrawerMode("edit");
    setEditingItemId(item.id);
    setDrawerLane(computeLane(item));
    setForm({
      title: item.title || "",
      vision: item.vision || "",
      objectif: item.objectif || "",
      impact: item.impact || "",
      metrics: item.metrics || "",
      phase: item.phase || "",
      releaseTag: item.releaseTag || "",
      status: item.status,
      epicId: item.epicId || "",
      priority: item.priority || "normal",
      actionType: item.actionType || "",
    });
    setDrawerOpen(true);
  };

  const openCreateDrawer = (lane: string) => {
    setDrawerMode("create");
    setEditingItemId(null);
    setDrawerLane(lane);
    setForm({
      title: "",
      vision: "",
      objectif: "",
      impact: "",
      metrics: "",
      phase: "",
      releaseTag: "",
      status: "planned",
      epicId: "",
      priority: "normal",
      actionType: "",
    });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (drawerMode === "create") {
      if (!form.title.trim()) return;
      createItemMutation.mutate({ ...form, lane: drawerLane });
    } else {
      if (!editingItemId) return;
      const data: Record<string, unknown> = {
        title: form.title,
        vision: form.vision,
        objectif: form.objectif,
        impact: form.impact,
        metrics: form.metrics,
        phase: form.phase,
        releaseTag: form.releaseTag,
        status: form.status,
        lane: drawerLane,
        priority: form.priority || "normal",
        actionType: form.actionType || null,
      };
      if (form.epicId) {
        data.epicId = form.epicId;
      } else {
        data.epicId = null;
      }
      updateItemMutation.mutate({
        id: editingItemId,
        data: data as Partial<RoadmapItem>,
      });
      setDrawerOpen(false);
      setEditingItemId(null);
    }
  };

  const editingItem = editingItemId ? items.find(i => i.id === editingItemId) : null;
  const linkedEpic = form.epicId ? epics.find(e => e.id === form.epicId) : null;
  const linkedTasks = linkedEpic ? getEpicTickets(linkedEpic.id) : [];

  const activeItem = activeId ? items.find(i => i.id === activeId) : null;

  const renderCard = (item: RoadmapItem, isDragOverlay = false) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned;
    const StatusIcon = statusConfig.icon;
    const isGroup = item.isGroup || item.type === "epic_group";
    const itemLane = computeLane(item);
    const laneConfig = LANE_CONFIG[itemLane];
    const cardEpic = item.epicId ? epics.find(e => e.id === item.epicId) : null;
    const cardEpicTickets = getEpicTickets(item.epicId);
    const priorityConfig = item.priority ? PRIORITY_CONFIG[item.priority] : null;
    const actionConfig = item.actionType ? ACTION_TYPE_CONFIG[item.actionType] : null;

    return (
      <Card
        key={item.id}
        className={`cursor-pointer hover-elevate active-elevate-2 overflow-visible border-l-[3px] ${actionConfig ? actionConfig.borderColor : (laneConfig?.borderColor || "")} ${isDragOverlay ? "shadow-lg ring-2 ring-primary/20" : ""}`}
        onClick={(e) => { 
          e.stopPropagation();
          if (!isDragOverlay) openEditDrawer(item); 
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
            {actionConfig && (
              <Badge className={`text-[10px] ${actionConfig.color}`}>
                <Zap className="h-2.5 w-2.5 mr-0.5" />
                {actionConfig.label}
              </Badge>
            )}
            {priorityConfig && item.priority !== "normal" && (
              <Badge className={`text-[10px] ${priorityConfig.color}`}>
                <Flag className="h-2.5 w-2.5 mr-0.5" />
                {priorityConfig.label}
              </Badge>
            )}
            {cardEpic && (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <div onPointerDown={(e) => e.stopPropagation()}>
                    <Badge className="text-[10px] bg-violet-500 text-white">
                      <Package className="h-2.5 w-2.5 mr-0.5" />
                      {cardEpic.title}
                      {cardEpicTickets.length > 0 && (
                        <span className="ml-1 opacity-80">({cardEpicTickets.length})</span>
                      )}
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="w-[340px] p-[5px] bg-white dark:bg-slate-900 text-foreground border shadow-md z-[9999]">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium mb-1">{cardEpic.title}</p>
                    {cardEpicTickets.length > 0 ? (
                      <>
                        <p className="text-[11px] text-muted-foreground mb-1">Tickets liés ({cardEpicTickets.length})</p>
                        <div className="max-h-[200px] overflow-y-auto space-y-0.5 pr-1">
                          {cardEpicTickets.map(task => {
                            const stColor = task.state === "done" || task.state === "termine" ? "text-green-600" : (task.state === "in_progress" || task.state === "en_cours") ? "text-amber-600" : "text-muted-foreground";
                            return (
                              <div key={task.id} className="flex items-center gap-1.5 text-[11px]">
                                <Ticket className={`h-2.5 w-2.5 shrink-0 ${stColor}`} />
                                <span className="truncate">{task.title}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Aucun ticket lié</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
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

    const isDropTarget = overLaneId === laneKey && activeId !== null;

    return (
      <div className={`flex-1 ${laneKey === "unqualified" ? "min-w-[240px]" : "min-w-[280px]"}`} data-testid={`nnl-lane-${laneKey}`}>
        <div className={`rounded-lg border ${config.color} p-3 transition-all duration-200 ${isDropTarget ? "ring-2 ring-primary/30 scale-[1.01]" : ""}`}>
          <div className="flex items-center justify-between mb-1 gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${config.headerColor}`} />
              <h3 className={`text-xs font-semibold ${config.textColor}`}>{config.label}</h3>
              <Badge className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${config.badgeColor}`}>{laneItemsList.length}</Badge>
              <span className={`text-[10px] italic text-muted-foreground`}>{config.description}</span>
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
                onClick={() => openCreateDrawer(laneKey)}
                data-testid={`button-add-nnl-${laneKey}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <DroppableLane id={laneKey} isOver={isDropTarget}>
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

  // Grouped view rendering (by priority or action_type)
  const renderGroupedView = () => {
    type GroupEntry = { key: string; label: string; color: string; headerColor: string; dotColor: string; badgeColor: string };
    let groups: GroupEntry[] = [];

    if (groupBy === "priority") {
      groups = [
        { key: "strategic", label: "Stratégique", color: "bg-violet-500/10 border-violet-500/30", headerColor: "bg-violet-500", dotColor: "bg-violet-500", badgeColor: "bg-violet-500 text-white" },
        { key: "high", label: "Haute priorité", color: "bg-red-500/10 border-red-500/30", headerColor: "bg-red-500", dotColor: "bg-red-500", badgeColor: "bg-red-500 text-white" },
        { key: "normal", label: "Priorité normale", color: "bg-gray-500/10 border-gray-500/30", headerColor: "bg-gray-400", dotColor: "bg-gray-400", badgeColor: "bg-gray-400 text-white" },
        { key: "low", label: "Basse priorité", color: "bg-blue-500/10 border-blue-500/30", headerColor: "bg-blue-400", dotColor: "bg-blue-400", badgeColor: "bg-blue-400 text-white" },
      ];
    } else {
      groups = Object.entries(ACTION_TYPE_CONFIG).map(([key, cfg]) => ({
        key,
        label: cfg.label,
        color: cfg.color.replace("text-", "border-").replace(/ text-\S+/, "").replace("bg-", "bg-") + "/10 border-" + cfg.dotColor.replace("bg-", "") + "/30",
        headerColor: cfg.headerColor,
        dotColor: cfg.dotColor,
        badgeColor: cfg.badgeColor,
      }));
      // Add "none" group
      groups.push({ key: "none", label: "Sans action", color: "bg-gray-500/10 border-gray-500/30", headerColor: "bg-gray-300", dotColor: "bg-gray-300", badgeColor: "bg-gray-300 text-gray-700" });
    }

    return (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {groups.map(group => {
          const groupItems = items.filter(i => {
            if (groupBy === "priority") return (i.priority || "normal") === group.key;
            if (group.key === "none") return !i.actionType;
            return i.actionType === group.key;
          });

          if (groupItems.length === 0 && group.key === "none") return null;

          return (
            <div key={group.key} className="flex-1 min-w-[280px]" data-testid={`nnl-group-${group.key}`}>
              <div className={`rounded-lg border bg-muted/5 border-muted p-3`}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${group.headerColor}`} />
                    <h3 className="text-xs font-semibold">{group.label}</h3>
                    <Badge className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${group.badgeColor}`}>{groupItems.length}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openCreateDrawer("now")}
                    data-testid={`button-add-group-${group.key}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {groupItems.map(item => (
                    <div key={item.id} onClick={() => openEditDrawer(item)}>
                      {renderCard(item)}
                    </div>
                  ))}
                  {groupItems.length === 0 && (
                    <div className="border-2 border-dashed rounded-md p-4 text-center text-xs text-muted-foreground">
                      Aucun élément
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const drawerLaneConfig = LANE_CONFIG[drawerLane];
  const drawerEpic = form.epicId ? epics.find(e => e.id === form.epicId) : null;

  return (
    <div>
      {/* GroupBy toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <ListFilter className="h-3.5 w-3.5" />
          Grouper par
        </span>
        <div className="flex items-center gap-1 border rounded-md p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-[11px] ${groupBy === "lane" ? "bg-accent" : ""}`}
            onClick={() => setGroupBy("lane")}
            data-testid="button-groupby-lane"
          >
            <LayoutGrid className="h-3 w-3 mr-1" />
            Colonne
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-[11px] ${groupBy === "priority" ? "bg-accent" : ""}`}
            onClick={() => setGroupBy("priority")}
            data-testid="button-groupby-priority"
          >
            <Flag className="h-3 w-3 mr-1" />
            Priorité
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-[11px] ${groupBy === "action_type" ? "bg-accent" : ""}`}
            onClick={() => setGroupBy("action_type")}
            data-testid="button-groupby-action"
          >
            <Zap className="h-3 w-3 mr-1" />
            Action
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {groupBy === "lane" ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {renderLane("now")}
            {renderLane("next")}
            {renderLane("later")}
            {laneItems.unqualified.length > 0 && renderLane("unqualified")}
            {hideUnqualified && laneItems.unqualified.length > 0 && (
              <div className="self-start shrink-0 pt-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setHideUnqualified(false)}
                      data-testid="button-show-unqualified"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Afficher la colonne Non qualifié(s)</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        ) : (
          renderGroupedView()
        )}

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="w-[280px]">
              {renderCard(activeItem, true)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Sheet open={drawerOpen} onOpenChange={(open) => { if (!open) { setDrawerOpen(false); setEditingItemId(null); setIsEditingTitle(false); } }}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-hidden flex flex-col p-0 bg-white dark:bg-slate-900 [&>button:last-child]:hidden">
          <div className="px-4 pt-4 pb-3">
            <SheetHeader className="space-y-0">
              <SheetDescription className="sr-only">
                {drawerMode === "create" ? "Créer un nouvel élément" : "Paramètres de l'élément"}
              </SheetDescription>

              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={form.epicId || "none"}
                  onValueChange={(v) => {
                    const newEpicId = v === "none" ? "" : v;
                    setForm(prev => ({ ...prev, epicId: newEpicId }));
                    if (drawerMode === "edit" && editingItemId) {
                      updateItemMutation.mutate({ id: editingItemId, data: { epicId: newEpicId || null } as Partial<RoadmapItem> });
                    }
                  }}
                >
                  <SelectTrigger className="border-none shadow-none p-0 h-auto w-auto gap-0 focus:ring-0 [&>svg]:hidden" data-testid="select-nnl-epic">
                    <Badge className="text-[10px] bg-violet-500 text-white cursor-pointer">
                      <Package className="h-2.5 w-2.5 mr-0.5" />
                      {drawerEpic ? drawerEpic.title : "Epic"}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune epic</SelectItem>
                    {epics.map(epic => (
                      <SelectItem key={epic.id} value={epic.id}>{epic.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Priority badge selector */}
                <Select
                  value={form.priority || "normal"}
                  onValueChange={(v) => {
                    setForm(prev => ({ ...prev, priority: v }));
                    if (drawerMode === "edit" && editingItemId) {
                      updateItemMutation.mutate({ id: editingItemId, data: { priority: v } as Partial<RoadmapItem> });
                    }
                  }}
                >
                  <SelectTrigger className="border-none shadow-none p-0 h-auto w-auto gap-0 focus:ring-0 [&>svg]:hidden" data-testid="select-nnl-priority-badge">
                    <Badge className={`text-[10px] cursor-pointer ${PRIORITY_CONFIG[form.priority || "normal"]?.color || ""}`}>
                      <Flag className="h-2.5 w-2.5 mr-0.5" />
                      {PRIORITY_CONFIG[form.priority || "normal"]?.label || "Priorité"}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strategic">Stratégique</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="low">Basse</SelectItem>
                  </SelectContent>
                </Select>

                {/* Action type badge selector */}
                <Select
                  value={form.actionType || "none"}
                  onValueChange={(v) => {
                    const val = v === "none" ? "" : v;
                    setForm(prev => ({ ...prev, actionType: val }));
                    if (drawerMode === "edit" && editingItemId) {
                      updateItemMutation.mutate({ id: editingItemId, data: { actionType: val || null } as Partial<RoadmapItem> });
                    }
                  }}
                >
                  <SelectTrigger className="border-none shadow-none p-0 h-auto w-auto gap-0 focus:ring-0 [&>svg]:hidden" data-testid="select-nnl-action-badge">
                    <Badge className={`text-[10px] cursor-pointer ${form.actionType && ACTION_TYPE_CONFIG[form.actionType] ? ACTION_TYPE_CONFIG[form.actionType].color : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
                      <Zap className="h-2.5 w-2.5 mr-0.5" />
                      {form.actionType && ACTION_TYPE_CONFIG[form.actionType] ? ACTION_TYPE_CONFIG[form.actionType].label : "Action"}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune action</SelectItem>
                    <SelectItem value="discovery">Discovery</SelectItem>
                    <SelectItem value="develop">Développer</SelectItem>
                    <SelectItem value="test">Tester</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="validate">Valider</SelectItem>
                    <SelectItem value="stop">Stopper</SelectItem>
                  </SelectContent>
                </Select>

                {drawerMode === "edit" && editingItem && !editingItem.endDate && (
                  <Select
                    value={drawerLane}
                    onValueChange={(v) => {
                      setDrawerLane(v);
                      if (editingItemId) {
                        updateItemMutation.mutate({ id: editingItemId, data: { lane: v } });
                      }
                    }}
                  >
                    <SelectTrigger className="border-none shadow-none p-0 h-auto w-auto gap-0 focus:ring-0 [&>svg]:hidden" data-testid="select-nnl-lane-header">
                      <Badge className={`text-[10px] cursor-pointer ${drawerLaneConfig?.badgeColor || "bg-gray-400 text-white"}`}>
                        {drawerLaneConfig?.label || drawerLane}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="now">Now</SelectItem>
                      <SelectItem value="next">Next</SelectItem>
                      <SelectItem value="later">Later</SelectItem>
                      <SelectItem value="unqualified">Non qualifié</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {drawerMode === "edit" && editingItem?.endDate && (
                  <Badge className={`text-[10px] ${drawerLaneConfig?.badgeColor || "bg-gray-400 text-white"}`}>
                    {drawerLaneConfig?.label || drawerLane}
                  </Badge>
                )}
                {drawerMode === "create" && (
                  <Select value={drawerLane} onValueChange={setDrawerLane}>
                    <SelectTrigger className="border-none shadow-none p-0 h-auto w-auto gap-0 focus:ring-0 [&>svg]:hidden" data-testid="select-nnl-create-lane">
                      <Badge className={`text-[10px] cursor-pointer ${drawerLaneConfig?.badgeColor || "bg-gray-400 text-white"}`}>
                        {drawerLaneConfig?.label || drawerLane}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="now">Now</SelectItem>
                      <SelectItem value="next">Next</SelectItem>
                      <SelectItem value="later">Later</SelectItem>
                      <SelectItem value="unqualified">Non qualifié</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {drawerMode === "edit" && (
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
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  onClick={() => { setDrawerOpen(false); setEditingItemId(null); setIsEditingTitle(false); }}
                  data-testid="button-nnl-close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="pt-3">
                {drawerMode === "create" ? (
                  <SheetTitle className="text-base leading-tight">Nouvel élément</SheetTitle>
                ) : isEditingTitle ? (
                  <Input
                    value={form.title}
                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                    onBlur={() => {
                      setIsEditingTitle(false);
                      if (editingItemId && form.title.trim()) {
                        updateItemMutation.mutate({ id: editingItemId, data: { title: form.title.trim() } as Partial<RoadmapItem> });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setIsEditingTitle(false);
                        if (editingItemId && form.title.trim()) {
                          updateItemMutation.mutate({ id: editingItemId, data: { title: form.title.trim() } as Partial<RoadmapItem> });
                        }
                      }
                      if (e.key === "Escape") {
                        setIsEditingTitle(false);
                        if (editingItem) setForm(prev => ({ ...prev, title: editingItem.title }));
                      }
                    }}
                    className="text-base font-semibold"
                    autoFocus
                    data-testid="input-nnl-edit-title"
                  />
                ) : (
                  <SheetTitle
                    className="text-base leading-tight cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setIsEditingTitle(true)}
                    data-testid="text-nnl-title"
                  >
                    {form.title || "Sans titre"}
                  </SheetTitle>
                )}
              </div>
            </SheetHeader>
          </div>

          <ScrollArea className="flex-1 pb-6">
            <div className="space-y-3 px-4 pr-5">
              {drawerMode === "create" && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Titre</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Nom de l'élément"
                    className="text-[11px] placeholder:text-[11px]"
                    data-testid="input-nnl-create-title"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CircleDot className="h-3 w-3" />
                  Statut
                </Label>
                <Select value={form.status || "planned"} onValueChange={(v) => setForm(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger className="text-[11px]" data-testid="select-nnl-status">
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

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="h-3 w-3" />
                  Vision
                </Label>
                <Textarea
                  value={form.vision || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, vision: e.target.value }))}
                  placeholder="Quelle est la vision de cet élément ?"
                  className="resize-none text-[11px] placeholder:text-[11px]"
                  rows={2}
                  data-testid="input-nnl-vision"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="h-3 w-3" />
                  Objectif
                </Label>
                <Textarea
                  value={form.objectif || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, objectif: e.target.value }))}
                  placeholder="Quel est l'objectif à atteindre ?"
                  className="resize-none text-[11px] placeholder:text-[11px]"
                  rows={2}
                  data-testid="input-nnl-objectif"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" />
                  Impact
                </Label>
                <Textarea
                  value={form.impact || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, impact: e.target.value }))}
                  placeholder="Quel impact attendu ?"
                  className="resize-none text-[11px] placeholder:text-[11px]"
                  rows={2}
                  data-testid="input-nnl-impact"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3" />
                  Métriques
                </Label>
                <Textarea
                  value={form.metrics || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, metrics: e.target.value }))}
                  placeholder="Comment mesurer le succès ?"
                  className="resize-none text-[11px] placeholder:text-[11px]"
                  rows={2}
                  data-testid="input-nnl-metrics"
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3 w-3" />
                    Phase
                  </Label>
                  <Select value={form.phase || ""} onValueChange={(v) => setForm(prev => ({ ...prev, phase: v }))}>
                    <SelectTrigger className="text-[11px]" data-testid="select-nnl-phase">
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

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="h-3 w-3" />
                    Version
                  </Label>
                  <Input
                    value={form.releaseTag || ""}
                    onChange={(e) => setForm(prev => ({ ...prev, releaseTag: e.target.value }))}
                    placeholder="Ex: MVP, V1..."
                    className="text-[11px] placeholder:text-[11px]"
                    data-testid="input-nnl-version"
                  />
                </div>
              </div>

              {linkedEpic && linkedTasks.length > 0 && (
                <Collapsible defaultOpen={false} className="mt-1">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center w-full gap-2 px-0 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors" data-testid="button-nnl-tickets-toggle">
                      <Ticket className="h-3 w-3" />
                      <span>Tickets ({linkedTasks.length})</span>
                      <ChevronRight className="h-3 w-3 ml-auto transition-transform [[data-state=open]_&]:rotate-90" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="divide-y mt-1">
                      {linkedTasks.map(task => {
                        const stateMap: Record<string, { label: string; color: string }> = {
                          "a_faire": { label: "À faire", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                          "todo": { label: "À faire", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                          "in_progress": { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
                          "en_cours": { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
                          "testing": { label: "En test", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
                          "to_fix": { label: "À corriger", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
                          "done": { label: "Terminé", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
                          "termine": { label: "Terminé", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
                          "blocked": { label: "Bloqué", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
                        };
                        const st = stateMap[task.state || ""] || { label: task.state || "—", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" };
                        return (
                          <div key={task.id} className="flex items-center justify-between gap-2 py-1.5 text-[11px]">
                            <span className="flex-1 min-w-0 break-words">{task.title}</span>
                            <Badge className={`text-[9px] shrink-0 ${st.color}`}>
                              {st.label}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {drawerMode === "edit" && editingItem?.sourceType === "cdc" && (
                <div className="p-2 rounded-md border bg-muted/30 mt-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="secondary" className="text-[9px]">CDC</Badge>
                    <span className="text-[10px] text-muted-foreground">Source : Cahier des charges</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t px-4 py-3 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setDrawerOpen(false); setEditingItemId(null); }} data-testid="button-nnl-cancel">
              Annuler
            </Button>
            <Button 
              size="sm" 
              onClick={handleSave} 
              disabled={(drawerMode === "create" && !form.title.trim()) || createItemMutation.isPending || updateItemMutation.isPending} 
              data-testid="button-nnl-save"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {(createItemMutation.isPending || updateItemMutation.isPending) ? "..." : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
