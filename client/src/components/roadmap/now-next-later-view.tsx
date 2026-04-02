import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useRef, useEffect } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  Search,
} from "lucide-react";
import type { RoadmapItem, Epic, BacklogTask, UserStory, Note } from "@shared/schema";

const LANE_CONFIG: Record<string, { label: string; description: string; color: string; headerColor: string; textColor: string; badgeColor: string; borderColor: string }> = {
  now: { label: "Now", description: "En cours", color: "bg-emerald-500/10 border-emerald-500/30", headerColor: "bg-emerald-500", textColor: "text-emerald-700 dark:text-emerald-400", badgeColor: "bg-emerald-500 text-white", borderColor: "border-l-emerald-500" },
  next: { label: "Next", description: "Planifié prochainement", color: "bg-blue-500/10 border-blue-500/30", headerColor: "bg-blue-500", textColor: "text-blue-700 dark:text-blue-400", badgeColor: "bg-blue-500 text-white", borderColor: "border-l-blue-500" },
  later: { label: "Later", description: "À envisager plus tard", color: "bg-purple-500/10 border-purple-500/30", headerColor: "bg-purple-500", textColor: "text-purple-700 dark:text-purple-400", badgeColor: "bg-purple-500 text-white", borderColor: "border-l-purple-500" },
  unqualified: { label: "Non qualifié", description: "À qualifier", color: "bg-gray-500/10 border-gray-500/30", headerColor: "bg-gray-400", textColor: "text-gray-600 dark:text-gray-400", badgeColor: "bg-gray-400 text-white", borderColor: "border-l-gray-400" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  planned: { label: "Planifié", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Circle },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  done: { label: "Terminé", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  blocked: { label: "Bloqué", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: AlertCircle },
};

// Updated priority colors: basse=vert, normale=jaune, haute=rouge, critique=violet
const PRIORITY_CONFIG: Record<string, { label: string; color: string; dotColor: string; groupColor: string; groupBorder: string }> = {
  critique: { label: "Critique", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", dotColor: "bg-violet-500", groupColor: "bg-violet-500/5", groupBorder: "border-violet-400/40" },
  high: { label: "Haute", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", dotColor: "bg-red-500", groupColor: "bg-red-500/5", groupBorder: "border-red-400/40" },
  normal: { label: "Normale", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", dotColor: "bg-yellow-400", groupColor: "bg-yellow-500/5", groupBorder: "border-yellow-400/40" },
  low: { label: "Basse", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", dotColor: "bg-green-500", groupColor: "bg-green-500/5", groupBorder: "border-green-400/40" },
};

const ACTION_TYPE_CONFIG: Record<string, { label: string; color: string; dotColor: string; groupColor: string; groupBorder: string }> = {
  discovery: { label: "Discovery", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300", dotColor: "bg-pink-500", groupColor: "bg-pink-500/5", groupBorder: "border-pink-400/40" },
  develop: { label: "Développer", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", dotColor: "bg-blue-500", groupColor: "bg-blue-500/5", groupBorder: "border-blue-400/40" },
  test: { label: "Tester", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", dotColor: "bg-violet-500", groupColor: "bg-violet-500/5", groupBorder: "border-violet-400/40" },
  review: { label: "Review", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", dotColor: "bg-yellow-500", groupColor: "bg-yellow-500/5", groupBorder: "border-yellow-400/40" },
  validate: { label: "Valider", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", dotColor: "bg-green-500", groupColor: "bg-green-500/5", groupBorder: "border-green-400/40" },
  stop: { label: "Stopper", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300", dotColor: "bg-gray-400", groupColor: "bg-gray-500/5", groupBorder: "border-gray-400/40" },
};

type GroupByMode = "none" | "priority" | "action_type";

interface NowNextLaterViewProps {
  items: RoadmapItem[];
  roadmapId?: string;
  onItemClick: (item: RoadmapItem) => void;
  onAddItem: (defaultLane?: string) => void;
  onUpdateItem: (itemId: string, newStatus: string, newOrderIndex: number) => void;
  epics: Epic[];
  backlogId: string | null;
  userStories?: UserStory[];
  groupBy?: GroupByMode;
}

function DroppableLane({ id, children, isOver }: { id: string; children: React.ReactNode; isOver?: boolean }) {
  const { setNodeRef, isOver: dndIsOver } = useDroppable({ id });
  const highlighted = isOver || dndIsOver;
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 min-h-[80px] rounded-md transition-all duration-200 ${highlighted ? "bg-accent/30 ring-2 ring-primary/20 ring-dashed" : ""}`}
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

// Combobox pour la sélection d'epic avec autocomplete
function EpicCombobox({ value, epics, onChange }: { value: string; epics: Epic[]; onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selectedEpic = epics.find(e => e.id === value);
  const filtered = epics.filter(e =>
    search === "" || e.title.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 border rounded-md px-3 h-9 text-[11px] bg-background hover-elevate"
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        data-testid="combobox-epic-trigger"
      >
        <span className={selectedEpic ? "text-foreground" : "text-muted-foreground"}>
          {selectedEpic ? selectedEpic.title : "Aucune epic"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[10001] bg-popover border rounded-md shadow-lg overflow-hidden">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une epic..."
                className="pl-8 h-7 text-[11px]"
                autoFocus
                data-testid="input-epic-search"
              />
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto py-1">
            <button
              className="w-full text-left px-3 py-1.5 text-[11px] hover-elevate text-muted-foreground"
              onClick={() => { onChange(""); setOpen(false); }}
              data-testid="epic-option-none"
            >
              Aucune epic
            </button>
            {filtered.map(epic => (
              <button
                key={epic.id}
                className={`w-full text-left px-3 py-1.5 text-[11px] hover-elevate ${value === epic.id ? "font-medium text-primary" : ""}`}
                onClick={() => { onChange(epic.id); setOpen(false); }}
                data-testid={`epic-option-${epic.id}`}
              >
                {epic.title}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-muted-foreground">Aucune epic trouvée</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function NowNextLaterView({
  items,
  roadmapId,
  onItemClick,
  onAddItem,
  onUpdateItem,
  epics,
  backlogId,
  userStories: externalUserStories,
  groupBy = "none",
}: NowNextLaterViewProps) {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overLaneId, setOverLaneId] = useState<string | null>(null);
  const [hideUnqualified, setHideUnqualified] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [drawerLane, setDrawerLane] = useState<string>("now");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [noteSelectorOpen, setNoteSelectorOpen] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");
  const [okrSelectorOpen, setOkrSelectorOpen] = useState(false);

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
    objectiveId: "",
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

  const editingItem = editingItemId ? items.find(i => i.id === editingItemId) : null;

  // Linked notes for the currently editing item
  const { data: linkedNotes = [] } = useQuery<Note[]>({
    queryKey: ["/api/notes/by-entity/roadmap_item", editingItemId],
    enabled: !!editingItemId && drawerOpen && drawerMode === "edit",
  });

  // All notes for the selector
  const { data: allNotes = [] } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
    enabled: noteSelectorOpen,
  });

  // OKR objectives for this roadmap
  const { data: okrObjectives = [] } = useQuery<any[]>({
    queryKey: [`/api/roadmaps/${roadmapId}/okr-objectives`],
    enabled: !!roadmapId && drawerOpen,
  });

  const linkNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await apiRequest(`/api/notes/${noteId}/links`, "POST", {
        targetType: "roadmap_item",
        targetId: editingItemId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes/by-entity/roadmap_item", editingItemId] });
      setNoteSelectorOpen(false);
      setNoteSearch("");
    },
  });

  const unlinkNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await apiRequest(`/api/notes/${noteId}/links/roadmap_item/${editingItemId}`, "DELETE");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes/by-entity/roadmap_item", editingItemId] });
    },
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
    onError: (_error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData([`/api/roadmaps/${roadmapId}/items`], context.previousItems);
      }
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
      if (data.objectiveId) body.objectiveId = data.objectiveId;
      const res = await apiRequest('/api/roadmap-items', 'POST', body);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${roadmapId}/items`] });
      toast({ title: "Élément créé", description: "L'élément a été ajouté à la roadmap.", className: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" });
      setDrawerOpen(false);
      setEditingItemId(null);
    },
  });

  const computeLane = (item: RoadmapItem): string => {
    if (item.lane === "unqualified") return "unqualified";
    if (!item.endDate) return item.lane || "later";
    const now = new Date();
    const end = new Date(item.endDate);
    const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 30) return "now";
    if (diffDays <= 90) return "next";
    return "later";
  };

  const getEpicTickets = (epicId: string | null | undefined) => {
    if (!epicId) return [];
    const us = allUserStories.filter(s => s.epicId === epicId).map(s => ({ id: s.id, title: s.title, state: s.state }));
    const tasks = epicTasks.filter(t => t.epicId === epicId).map(t => ({ id: t.id, title: t.title, state: t.state }));
    return [...us, ...tasks];
  };

  const laneItems: Record<string, RoadmapItem[]> = {
    now: items.filter(i => computeLane(i) === "now"),
    next: items.filter(i => computeLane(i) === "next"),
    later: items.filter(i => computeLane(i) === "later"),
    unqualified: items.filter(i => computeLane(i) === "unqualified"),
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

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
      toast({ title: "Info", description: "Cet élément a une date de fin, sa colonne est calculée automatiquement." });
      return;
    }
    const targetLane = String(over.id);
    if (!["now", "next", "later", "unqualified"].includes(targetLane)) return;
    if (computeLane(item) === targetLane) return;
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
      objectiveId: item.objectiveId || "",
    });
    setDrawerOpen(true);
  };

  const openCreateDrawer = (lane: string) => {
    setDrawerMode("create");
    setEditingItemId(null);
    setDrawerLane(lane);
    setForm({ title: "", vision: "", objectif: "", impact: "", metrics: "", phase: "", releaseTag: "", status: "planned", epicId: "", priority: "normal", actionType: "", objectiveId: "" });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (drawerMode === "create") {
      if (!form.title.trim()) return;
      createItemMutation.mutate({ ...form, lane: drawerLane });
    } else {
      if (!editingItemId) return;
      updateItemMutation.mutate({
        id: editingItemId,
        data: {
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
          epicId: form.epicId || null,
          objectiveId: form.objectiveId || null,
        } as Partial<RoadmapItem>,
      });
      setDrawerOpen(false);
      setEditingItemId(null);
    }
  };

  const activeItem = activeId ? items.find(i => i.id === activeId) : null;

  const renderCard = (item: RoadmapItem, isDragOverlay = false) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned;
    const StatusIcon = statusConfig.icon;
    const cardEpic = item.epicId ? epics.find(e => e.id === item.epicId) : null;
    const cardEpicTickets = getEpicTickets(item.epicId);
    const priorityConfig = item.priority ? PRIORITY_CONFIG[item.priority] : null;
    const actionConfig = item.actionType ? ACTION_TYPE_CONFIG[item.actionType] : null;
    const itemLane = computeLane(item);
    const laneConfig = LANE_CONFIG[itemLane];

    return (
      <Card
        key={item.id}
        className={`cursor-pointer hover-elevate active-elevate-2 overflow-visible border-l-[3px] ${actionConfig ? "" : (laneConfig?.borderColor || "")} ${isDragOverlay ? "shadow-lg ring-2 ring-primary/20" : ""}`}
        style={actionConfig ? { borderLeftColor: "" } : undefined}
        onClick={(e) => { e.stopPropagation(); if (!isDragOverlay) openEditDrawer(item); }}
        data-testid={`nnl-card-${item.id}`}
      >
        <CardContent className="p-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 flex-1 min-w-0">
              <GripVertical className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0 cursor-grab" />
              <h4 className="text-xs font-medium leading-tight flex-1">{item.title}</h4>
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
                      {cardEpicTickets.length > 0 && <span className="ml-1 opacity-80">({cardEpicTickets.length})</span>}
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="w-[320px] p-2 bg-white dark:bg-slate-900 text-foreground border shadow-md z-[9999]">
                  <p className="text-[11px] font-medium mb-1">{cardEpic.title}</p>
                  {cardEpicTickets.length > 0 ? (
                    <div className="max-h-[180px] overflow-y-auto space-y-0.5">
                      {cardEpicTickets.map(t => (
                        <div key={t.id} className="flex items-center gap-1.5 text-[11px]">
                          <Ticket className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{t.title}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Aucun ticket lié</p>
                  )}
                </TooltipContent>
              </Tooltip>
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

  // Render items possibly grouped within a lane
  const renderLaneItems = (laneItemsList: RoadmapItem[], laneKey: string) => {
    if (groupBy === "none" || laneItemsList.length === 0) {
      return (
        <DroppableLane id={laneKey} isOver={overLaneId === laneKey && activeId !== null}>
          {laneItemsList.map(item => (
            <DraggableCard key={item.id} id={item.id}>{renderCard(item)}</DraggableCard>
          ))}
          {laneItemsList.length === 0 && (
            <div className="border-2 border-dashed rounded-md p-4 text-center text-xs text-muted-foreground">Aucun élément</div>
          )}
        </DroppableLane>
      );
    }

    // Sub-groups within the lane
    type GroupDef = { key: string; label: string; dotColor: string; groupColor: string; groupBorder: string };
    const groups: GroupDef[] = groupBy === "priority"
      ? [
          { key: "critique", label: "Critique", dotColor: "bg-violet-500", groupColor: "bg-violet-500/5", groupBorder: "border-violet-400/30" },
          { key: "high", label: "Haute", dotColor: "bg-red-500", groupColor: "bg-red-500/5", groupBorder: "border-red-400/30" },
          { key: "normal", label: "Normale", dotColor: "bg-yellow-400", groupColor: "bg-yellow-500/5", groupBorder: "border-yellow-400/30" },
          { key: "low", label: "Basse", dotColor: "bg-green-500", groupColor: "bg-green-500/5", groupBorder: "border-green-400/30" },
        ]
      : [
          { key: "discovery", label: "Discovery", dotColor: "bg-pink-500", groupColor: "bg-pink-500/5", groupBorder: "border-pink-400/30" },
          { key: "develop", label: "Développer", dotColor: "bg-blue-500", groupColor: "bg-blue-500/5", groupBorder: "border-blue-400/30" },
          { key: "test", label: "Tester", dotColor: "bg-violet-500", groupColor: "bg-violet-500/5", groupBorder: "border-violet-400/30" },
          { key: "review", label: "Review", dotColor: "bg-yellow-500", groupColor: "bg-yellow-500/5", groupBorder: "border-yellow-400/30" },
          { key: "validate", label: "Valider", dotColor: "bg-green-500", groupColor: "bg-green-500/5", groupBorder: "border-green-400/30" },
          { key: "stop", label: "Stopper", dotColor: "bg-gray-400", groupColor: "bg-gray-500/5", groupBorder: "border-gray-400/30" },
          { key: "__none__", label: "Sans action", dotColor: "bg-gray-300", groupColor: "bg-gray-500/5", groupBorder: "border-gray-400/30" },
        ];

    return (
      <DroppableLane id={laneKey} isOver={overLaneId === laneKey && activeId !== null}>
        <div className="space-y-3">
          {groups.map(g => {
            const groupItems = laneItemsList.filter(i => {
              if (groupBy === "priority") return (i.priority || "normal") === g.key;
              if (g.key === "__none__") return !i.actionType;
              return i.actionType === g.key;
            });
            if (groupItems.length === 0) return null;
            return (
              <div key={g.key} className={`rounded-md border ${g.groupBorder} ${g.groupColor} p-2`}>
                <div className="flex items-center gap-1.5 mb-2 px-0.5">
                  <div className={`w-2 h-2 rounded-full ${g.dotColor}`} />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{g.label}</span>
                  <Badge className="text-[9px] bg-muted text-muted-foreground ml-auto no-default-hover-elevate no-default-active-elevate">{groupItems.length}</Badge>
                </div>
                <div className="space-y-1.5">
                  {groupItems.map(item => (
                    <DraggableCard key={item.id} id={item.id}>{renderCard(item)}</DraggableCard>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DroppableLane>
    );
  };

  const renderLane = (laneKey: string) => {
    const config = LANE_CONFIG[laneKey];
    if (!config) return null;
    const laneItemsList = laneItems[laneKey] || [];
    if (laneKey === "unqualified" && hideUnqualified) return null;
    const isDropTarget = overLaneId === laneKey && activeId !== null;

    return (
      <div className="flex-1 min-w-[280px]" key={laneKey} data-testid={`nnl-lane-${laneKey}`}>
        <div className={`rounded-lg border ${config.color} p-3 transition-all ${isDropTarget ? "ring-2 ring-primary/30 scale-[1.01]" : ""}`}>
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className={`w-2.5 h-2.5 rounded-full ${config.headerColor}`} />
              <h3 className={`text-xs font-semibold ${config.textColor}`}>{config.label}</h3>
              <Badge className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${config.badgeColor}`}>{laneItemsList.length}</Badge>
              <span className="text-[10px] italic text-muted-foreground hidden sm:inline">{config.description}</span>
            </div>
            <div className="flex items-center gap-0.5">
              {laneKey === "unqualified" && (
                <Button variant="ghost" size="icon" onClick={() => setHideUnqualified(true)} data-testid="button-hide-unqualified">
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => openCreateDrawer(laneKey)} data-testid={`button-add-nnl-${laneKey}`}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {renderLaneItems(laneItemsList, laneKey)}
        </div>
      </div>
    );
  };

  const drawerLaneConfig = LANE_CONFIG[drawerLane];
  const drawerEpic = form.epicId ? epics.find(e => e.id === form.epicId) : null;
  const linkedEpic = drawerEpic;
  const linkedTasks = getEpicTickets(linkedEpic?.id);
  const linkedObjective = form.objectiveId ? okrObjectives.find((o: any) => o.id === form.objectiveId) : null;
  const availableNotes = allNotes.filter(
    n => !linkedNotes.some(ln => ln.id === n.id) &&
    (noteSearch === "" || (n.title || "").toLowerCase().includes(noteSearch.toLowerCase()))
  );

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {renderLane("now")}
          {renderLane("next")}
          {renderLane("later")}
          {laneItems.unqualified.length > 0 && renderLane("unqualified")}
          {hideUnqualified && laneItems.unqualified.length > 0 && (
            <div className="self-start shrink-0 pt-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setHideUnqualified(false)} data-testid="button-show-unqualified">
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Afficher Non qualifié(s)</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem ? <div className="w-[280px]">{renderCard(activeItem, true)}</div> : null}
        </DragOverlay>
      </DndContext>

      {/* DRAWER */}
      <Sheet open={drawerOpen} onOpenChange={(open) => { if (!open) { setDrawerOpen(false); setEditingItemId(null); setIsEditingTitle(false); } }}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-hidden flex flex-col p-0 bg-white dark:bg-slate-900 [&>button:last-child]:hidden">
          <div className="px-4 pt-4 pb-3 border-b">
            <SheetHeader className="space-y-0">
              <SheetDescription className="sr-only">
                {drawerMode === "create" ? "Créer un nouvel élément" : "Modifier l'élément"}
              </SheetDescription>

              {/* Badge row: Epic, Priority, Action, OKR, Lane, Trash, Close */}
              <div className="flex items-center gap-1.5 flex-wrap">

                {/* Epic combobox-badge */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="shrink-0" data-testid="badge-trigger-epic">
                      <Badge className="text-[10px] bg-violet-500 text-white cursor-pointer">
                        <Package className="h-2.5 w-2.5 mr-0.5" />
                        {drawerEpic ? drawerEpic.title : "Epic"}
                      </Badge>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0 z-[10001]" align="start">
                    <EpicCombobox
                      value={form.epicId}
                      epics={epics}
                      onChange={(v) => {
                        setForm(prev => ({ ...prev, epicId: v }));
                        if (drawerMode === "edit" && editingItemId) {
                          updateItemMutation.mutate({ id: editingItemId, data: { epicId: v || null } as Partial<RoadmapItem> });
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>

                {/* Priority badge selector */}
                <Select value={form.priority || "normal"} onValueChange={(v) => {
                  setForm(prev => ({ ...prev, priority: v }));
                  if (drawerMode === "edit" && editingItemId) {
                    updateItemMutation.mutate({ id: editingItemId, data: { priority: v } as Partial<RoadmapItem> });
                  }
                }}>
                  <SelectTrigger className="border-none shadow-none p-0 h-auto w-auto gap-0 focus:ring-0 [&>svg]:hidden" data-testid="select-nnl-priority-badge">
                    <Badge className={`text-[10px] cursor-pointer ${PRIORITY_CONFIG[form.priority || "normal"]?.color || ""}`}>
                      <Flag className="h-2.5 w-2.5 mr-0.5" />
                      {PRIORITY_CONFIG[form.priority || "normal"]?.label || "Priorité"}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent className="z-[10001]">
                    <SelectItem value="critique">Critique</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="low">Basse</SelectItem>
                  </SelectContent>
                </Select>

                {/* Action type badge selector */}
                <Select value={form.actionType || "none"} onValueChange={(v) => {
                  const val = v === "none" ? "" : v;
                  setForm(prev => ({ ...prev, actionType: val }));
                  if (drawerMode === "edit" && editingItemId) {
                    updateItemMutation.mutate({ id: editingItemId, data: { actionType: val || null } as Partial<RoadmapItem> });
                  }
                }}>
                  <SelectTrigger className="border-none shadow-none p-0 h-auto w-auto gap-0 focus:ring-0 [&>svg]:hidden" data-testid="select-nnl-action-badge">
                    <Badge className={`text-[10px] cursor-pointer ${form.actionType && ACTION_TYPE_CONFIG[form.actionType] ? ACTION_TYPE_CONFIG[form.actionType].color : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
                      <Zap className="h-2.5 w-2.5 mr-0.5" />
                      {form.actionType && ACTION_TYPE_CONFIG[form.actionType] ? ACTION_TYPE_CONFIG[form.actionType].label : "Action"}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent className="z-[10001]">
                    <SelectItem value="none">Aucune action</SelectItem>
                    <SelectItem value="discovery">Discovery</SelectItem>
                    <SelectItem value="develop">Développer</SelectItem>
                    <SelectItem value="test">Tester</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="validate">Valider</SelectItem>
                    <SelectItem value="stop">Stopper</SelectItem>
                  </SelectContent>
                </Select>

                {/* OKR badge selector */}
                <Popover open={okrSelectorOpen} onOpenChange={setOkrSelectorOpen}>
                  <PopoverTrigger asChild>
                    <button data-testid="badge-trigger-okr">
                      <Badge className={`text-[10px] cursor-pointer ${linkedObjective ? "bg-violet-500 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
                        <Target className="h-2.5 w-2.5 mr-0.5" />
                        {linkedObjective ? linkedObjective.title.slice(0, 18) + (linkedObjective.title.length > 18 ? "…" : "") : "OKR"}
                      </Badge>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2 z-[10001]" align="start">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Objectif OKR</p>
                    {okrObjectives.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground px-1 py-2">Aucun objectif OKR disponible pour ce projet</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {linkedObjective && (
                          <button className="w-full text-left text-[11px] px-2 py-1.5 rounded-md hover-elevate text-muted-foreground" onClick={() => {
                            setForm(prev => ({ ...prev, objectiveId: "" }));
                            if (drawerMode === "edit" && editingItemId) updateItemMutation.mutate({ id: editingItemId, data: { objectiveId: null } as any });
                            setOkrSelectorOpen(false);
                          }}>Aucun (retirer)</button>
                        )}
                        {okrObjectives.map((obj: any) => (
                          <button key={obj.id} className={`w-full text-left text-[11px] px-2 py-1.5 rounded-md hover-elevate truncate ${form.objectiveId === obj.id ? "bg-violet-50 dark:bg-violet-900/20 font-medium text-violet-700 dark:text-violet-300" : ""}`} onClick={() => {
                            setForm(prev => ({ ...prev, objectiveId: obj.id }));
                            if (drawerMode === "edit" && editingItemId) updateItemMutation.mutate({ id: editingItemId, data: { objectiveId: obj.id } as any });
                            setOkrSelectorOpen(false);
                          }} data-testid={`okr-option-${obj.id}`}>{obj.title}</button>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                {/* Lane selector */}
                {(drawerMode === "create" || (drawerMode === "edit" && !editingItem?.endDate)) && (
                  <Select value={drawerLane} onValueChange={(v) => {
                    setDrawerLane(v);
                    if (drawerMode === "edit" && editingItemId) updateItemMutation.mutate({ id: editingItemId, data: { lane: v } });
                  }}>
                    <SelectTrigger className="border-none shadow-none p-0 h-auto w-auto gap-0 focus:ring-0 [&>svg]:hidden" data-testid="select-nnl-lane-header">
                      <Badge className={`text-[10px] cursor-pointer ${drawerLaneConfig?.badgeColor || "bg-gray-400 text-white"}`}>
                        {drawerLaneConfig?.label || drawerLane}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent className="z-[10001]">
                      <SelectItem value="now">Now</SelectItem>
                      <SelectItem value="next">Next</SelectItem>
                      <SelectItem value="later">Later</SelectItem>
                      <SelectItem value="unqualified">Non qualifié</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {drawerMode === "edit" && editingItem?.endDate && (
                  <Badge className={`text-[10px] ${drawerLaneConfig?.badgeColor || "bg-gray-400 text-white"}`}>{drawerLaneConfig?.label || drawerLane}</Badge>
                )}

                <div className="ml-auto flex items-center gap-0.5">
                  {drawerMode === "edit" && (
                    <Button variant="ghost" size="icon" onClick={() => { if (editingItemId) deleteItemMutation.mutate(editingItemId); }} disabled={deleteItemMutation.isPending} data-testid="button-nnl-delete">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => { setDrawerOpen(false); setEditingItemId(null); setIsEditingTitle(false); }} data-testid="button-nnl-close">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Title */}
              <div className="pt-2">
                {drawerMode === "create" ? (
                  <Input
                    value={form.title}
                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Nom de l'élément"
                    className="text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 h-auto"
                    autoFocus
                    data-testid="input-nnl-create-title"
                  />
                ) : isEditingTitle ? (
                  <Input
                    value={form.title}
                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                    onBlur={() => {
                      setIsEditingTitle(false);
                      if (editingItemId && form.title.trim()) updateItemMutation.mutate({ id: editingItemId, data: { title: form.title.trim() } as Partial<RoadmapItem> });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { setIsEditingTitle(false); if (editingItemId && form.title.trim()) updateItemMutation.mutate({ id: editingItemId, data: { title: form.title.trim() } as Partial<RoadmapItem> }); }
                      if (e.key === "Escape") { setIsEditingTitle(false); if (editingItem) setForm(prev => ({ ...prev, title: editingItem.title })); }
                    }}
                    className="text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 h-auto"
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

          <ScrollArea className="flex-1 pb-4">
            <div className="space-y-4 px-4 pt-3 pr-5">

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CircleDot className="h-3 w-3" />Statut
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

              {/* Vision */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="h-3 w-3" />Vision
                </Label>
                <Textarea value={form.vision || ""} onChange={(e) => setForm(prev => ({ ...prev, vision: e.target.value }))} placeholder="Quelle est la vision ?" className="resize-none text-[11px] placeholder:text-[11px]" rows={2} data-testid="input-nnl-vision" />
              </div>

              {/* Objectif */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="h-3 w-3" />Objectif
                </Label>
                <Textarea value={form.objectif || ""} onChange={(e) => setForm(prev => ({ ...prev, objectif: e.target.value }))} placeholder="Quel objectif à atteindre ?" className="resize-none text-[11px] placeholder:text-[11px]" rows={2} data-testid="input-nnl-objectif" />
              </div>

              {/* Impact */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" />Impact
                </Label>
                <Textarea value={form.impact || ""} onChange={(e) => setForm(prev => ({ ...prev, impact: e.target.value }))} placeholder="Impact attendu ?" className="resize-none text-[11px] placeholder:text-[11px]" rows={2} data-testid="input-nnl-impact" />
              </div>

              {/* Métriques */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3" />Métriques
                </Label>
                <Textarea value={form.metrics || ""} onChange={(e) => setForm(prev => ({ ...prev, metrics: e.target.value }))} placeholder="Comment mesurer le succès ?" className="resize-none text-[11px] placeholder:text-[11px]" rows={2} data-testid="input-nnl-metrics" />
              </div>

              <Separator />

              {/* Phase + Version */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3 w-3" />Phase
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
                    <Tag className="h-3 w-3" />Version
                  </Label>
                  <Input value={form.releaseTag || ""} onChange={(e) => setForm(prev => ({ ...prev, releaseTag: e.target.value }))} placeholder="MVP, V1..." className="text-[11px] placeholder:text-[11px]" data-testid="input-nnl-version" />
                </div>
              </div>

              {/* Epic full selector */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="h-3 w-3" />Epic liée
                </Label>
                <EpicCombobox
                  value={form.epicId}
                  epics={epics}
                  onChange={(v) => {
                    setForm(prev => ({ ...prev, epicId: v }));
                    if (drawerMode === "edit" && editingItemId) {
                      updateItemMutation.mutate({ id: editingItemId, data: { epicId: v || null } as Partial<RoadmapItem> });
                    }
                  }}
                />
              </div>

              {/* Tickets sous l'epic */}
              {linkedEpic && linkedTasks.length > 0 && (
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center w-full gap-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors" data-testid="button-nnl-tickets-toggle">
                      <Ticket className="h-3 w-3" />
                      Tickets ({linkedTasks.length})
                      <ChevronRight className="h-3 w-3 ml-auto transition-transform [[data-state=open]_&]:rotate-90" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="divide-y mt-1">
                      {linkedTasks.map(task => {
                        const stateMap: Record<string, { label: string; color: string }> = {
                          "todo": { label: "À faire", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                          "a_faire": { label: "À faire", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                          "in_progress": { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
                          "en_cours": { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
                          "testing": { label: "En test", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
                          "to_fix": { label: "À corriger", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
                          "done": { label: "Terminé", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
                          "termine": { label: "Terminé", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
                        };
                        const st = stateMap[task.state || ""] || { label: task.state || "—", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" };
                        return (
                          <div key={task.id} className="flex items-center justify-between gap-2 py-1.5 text-[11px]">
                            <span className="flex-1 min-w-0 truncate">{task.title}</span>
                            <Badge className={`text-[9px] shrink-0 ${st.color}`}>{st.label}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <Separator />

              {/* Notes liées */}
              {drawerMode === "edit" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-3 w-3" />Notes liées
                      {linkedNotes.length > 0 && <Badge variant="secondary" className="text-[9px] ml-1">{linkedNotes.length}</Badge>}
                    </Label>
                    <Popover open={noteSelectorOpen} onOpenChange={(o) => { setNoteSelectorOpen(o); if (!o) setNoteSearch(""); }}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1" data-testid="button-link-note-nnl">
                          <Plus className="h-2.5 w-2.5" />Lier
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2 z-[10001]" align="end">
                        <div className="relative mb-2">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input value={noteSearch} onChange={e => setNoteSearch(e.target.value)} placeholder="Rechercher une note..." className="pl-8 h-7 text-[11px]" data-testid="input-note-search-nnl" />
                        </div>
                        {availableNotes.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground text-center py-2">{allNotes.length === 0 ? "Chargement..." : "Aucune note disponible"}</p>
                        ) : (
                          <div className="max-h-44 overflow-y-auto space-y-0.5">
                            {availableNotes.map(note => (
                              <button key={note.id} className="w-full text-left text-[11px] px-2 py-1.5 rounded-md hover-elevate truncate" onClick={() => linkNoteMutation.mutate(note.id)} disabled={linkNoteMutation.isPending} data-testid={`note-option-${note.id}`}>
                                {note.title || "Note sans titre"}
                              </button>
                            ))}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>

                  {linkedNotes.length === 0 ? (
                    <div className="border-2 border-dashed rounded-md p-3 text-center text-[11px] text-muted-foreground">Aucune note liée</div>
                  ) : (
                    <div className="space-y-1">
                      {linkedNotes.map(note => (
                        <div key={note.id} className="flex items-center justify-between gap-2 p-2 rounded-md border" data-testid={`nnl-linked-note-${note.id}`}>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-[11px] truncate">{note.title || "Note sans titre"}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => unlinkNoteMutation.mutate(note.id)} disabled={unlinkNoteMutation.isPending} data-testid={`button-unlink-note-nnl-${note.id}`}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t px-4 py-3 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setDrawerOpen(false); setEditingItemId(null); }} data-testid="button-nnl-cancel">Annuler</Button>
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
