import { useMemo, useState, useEffect } from "react";
import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { GripVertical, Plus, Circle, CheckCircle2, AlertCircle, Clock, Calendar, Flag, ChevronRight, Tag, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RoadmapItem } from "@shared/schema";

interface OutputViewProps {
  items: RoadmapItem[];
  roadmapId?: string;
  onItemClick?: (item: RoadmapItem) => void;
  onAddItem?: () => void;
  onItemMove?: (itemId: string, newStatus: string, newOrderIndex: number) => void;
}

type StatusColumn = {
  id: string;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Circle;
};

const STATUS_COLUMNS: StatusColumn[] = [
  { id: "planned", title: "Planifié", color: "text-gray-600", bgColor: "bg-gray-50 dark:bg-gray-900/30", borderColor: "border-gray-200 dark:border-gray-700", icon: Circle },
  { id: "in_progress", title: "En cours", color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-900/20", borderColor: "border-amber-200 dark:border-amber-700", icon: Clock },
  { id: "done", title: "Terminé", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-900/20", borderColor: "border-green-200 dark:border-green-700", icon: CheckCircle2 },
  { id: "blocked", title: "Bloqué", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-900/20", borderColor: "border-red-200 dark:border-red-700", icon: AlertCircle },
];

const ITEM_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  deliverable: { label: "Livrable", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  milestone: { label: "Milestone", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  initiative: { label: "Initiative", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  free_block: { label: "Bloc", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

const PRIORITY_BADGES: Record<string, { label: string; color: string }> = {
  strategic: { label: "Stratégique", color: "bg-violet-500 text-white" },
  high: { label: "Haute", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  normal: { label: "Normale", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  low: { label: "Basse", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
};

const RELEASE_TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MVP: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-400" },
  V1: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-400" },
  V2: { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-400" },
  V3: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-400" },
  Hotfix: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-400" },
  Soon: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-400" },
};

const RELEASE_TAG_OPTIONS = ["all", "MVP", "V1", "V2", "V3", "Hotfix", "Soon"] as const;

interface SortableItemProps {
  item: RoadmapItem;
  onClick?: () => void;
}

function SortableItem({ item, onClick }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const typeInfo = ITEM_TYPE_LABELS[item.type] || ITEM_TYPE_LABELS.deliverable;
  const priorityInfo = PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.normal;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border rounded-lg p-3 cursor-pointer hover-elevate transition-shadow",
        isDragging && "opacity-50 shadow-lg ring-2 ring-violet-500"
      )}
      onClick={onClick}
      data-testid={`output-card-${item.id}`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-1 -ml-1 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
          onClick={(e) => e.stopPropagation()}
          data-testid={`drag-handle-${item.id}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="text-xs font-medium leading-tight line-clamp-2">{item.title}</h4>
            {item.priority === "strategic" || item.priority === "high" ? (
              <Badge variant="secondary" className={cn("flex-shrink-0 text-[10px] px-1.5 py-0", priorityInfo.color)}>
                <Flag className="h-2.5 w-2.5 mr-0.5" />
                {priorityInfo.label}
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", typeInfo.color)}>
              {typeInfo.label}
            </Badge>
            {item.releaseTag && RELEASE_TAG_COLORS[item.releaseTag] && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  RELEASE_TAG_COLORS[item.releaseTag].text,
                  RELEASE_TAG_COLORS[item.releaseTag].border
                )}
              >
                <Tag className="h-2.5 w-2.5 mr-0.5" />
                {item.releaseTag}
              </Badge>
            )}
            {item.startDate && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Calendar className="h-2.5 w-2.5" />
                {format(parseISO(item.startDate), "d MMM", { locale: fr })}
                {item.endDate && (
                  <>
                    <ChevronRight className="h-2.5 w-2.5" />
                    {format(parseISO(item.endDate), "d MMM", { locale: fr })}
                  </>
                )}
              </span>
            )}
          </div>

          {item.progress > 0 && (
            <div className="flex items-center gap-2">
              <Progress value={item.progress} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground font-medium">{item.progress}%</span>
            </div>
          )}

          {item.description && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemOverlay({ item }: { item: RoadmapItem }) {
  const typeInfo = ITEM_TYPE_LABELS[item.type] || ITEM_TYPE_LABELS.deliverable;

  return (
    <div className="bg-card border-2 border-violet-500 rounded-lg p-3 shadow-xl w-64">
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-medium leading-tight line-clamp-2 mb-1">{item.title}</h4>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", typeInfo.color)}>
            {typeInfo.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}

interface DroppableColumnProps {
  column: StatusColumn;
  items: RoadmapItem[];
  onItemClick?: (item: RoadmapItem) => void;
}

function DroppableColumn({ column, items, onItemClick }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const StatusIcon = column.icon;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border-2 flex flex-col transition-all",
        column.bgColor,
        column.borderColor,
        isOver && "ring-2 ring-violet-500 ring-offset-2"
      )}
      data-testid={`output-column-${column.id}`}
    >
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-4 w-4", column.color)} />
          <h3 className={cn("text-xs font-semibold", column.color)}>{column.title}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {items.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1 p-3">
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[100px]">
            {items.map(item => (
              <SortableItem
                key={item.id}
                item={item}
                onClick={() => onItemClick?.(item)}
              />
            ))}
            {items.length === 0 && (
              <div className="flex items-center justify-center h-[100px] text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                Aucun élément
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

export function OutputView({ items, roadmapId, onItemClick, onAddItem, onItemMove }: OutputViewProps) {
  const [activeItem, setActiveItem] = useState<RoadmapItem | null>(null);
  const [releaseTagFilter, setReleaseTagFilter] = useState<string>("all");
  const [customOrder, setCustomOrder] = useState<Record<string, string[]>>(() => {
    if (!roadmapId) return {};
    const saved = localStorage.getItem(`roadmap-output-order-${roadmapId}`);
    return saved ? JSON.parse(saved) : {};
  });
  
  // Persist custom order to localStorage
  useEffect(() => {
    if (roadmapId && Object.keys(customOrder).length > 0) {
      localStorage.setItem(`roadmap-output-order-${roadmapId}`, JSON.stringify(customOrder));
    }
  }, [customOrder, roadmapId]);
  
  // Load custom order when roadmapId changes
  useEffect(() => {
    if (roadmapId) {
      const saved = localStorage.getItem(`roadmap-output-order-${roadmapId}`);
      if (saved) {
        setCustomOrder(JSON.parse(saved));
      }
    }
  }, [roadmapId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredItems = useMemo(() => {
    if (releaseTagFilter === "all") return items;
    return items.filter(item => item.releaseTag === releaseTagFilter);
  }, [items, releaseTagFilter]);

  const allItemsByStatus = useMemo(() => {
    const grouped: Record<string, RoadmapItem[]> = {
      planned: [],
      in_progress: [],
      done: [],
      blocked: [],
    };

    items.forEach(item => {
      const status = item.status || "planned";
      if (grouped[status]) {
        grouped[status].push(item);
      } else {
        grouped.planned.push(item);
      }
    });

    Object.keys(grouped).forEach(status => {
      grouped[status].sort((a, b) => a.orderIndex - b.orderIndex);
    });

    return grouped;
  }, [items]);

  const itemsByStatus = useMemo(() => {
    const grouped: Record<string, RoadmapItem[]> = {
      planned: [],
      in_progress: [],
      done: [],
      blocked: [],
    };

    filteredItems.forEach(item => {
      const status = item.status || "planned";
      if (grouped[status]) {
        grouped[status].push(item);
      } else {
        grouped.planned.push(item);
      }
    });

    Object.keys(grouped).forEach(status => {
      const statusOrder = customOrder[status];
      if (statusOrder && statusOrder.length > 0) {
        const orderMap = new Map(statusOrder.map((id, idx) => [id, idx]));
        grouped[status].sort((a, b) => {
          const aIdx = orderMap.get(a.id);
          const bIdx = orderMap.get(b.id);
          if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
          if (aIdx !== undefined) return -1;
          if (bIdx !== undefined) return 1;
          return a.orderIndex - b.orderIndex;
        });
      } else {
        grouped[status].sort((a, b) => a.orderIndex - b.orderIndex);
      }
    });

    return grouped;
  }, [filteredItems, customOrder]);

  const handleDragStart = (event: DragStartEvent) => {
    const item = items.find(i => i.id === event.active.id);
    setActiveItem(item || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const activeItem = items.find(i => i.id === active.id);
    if (!activeItem) return;

    const overColumnId = STATUS_COLUMNS.find(col => col.id === over.id)?.id;
    const overItem = items.find(i => i.id === over.id);
    
    const newStatus = overColumnId || overItem?.status || activeItem.status;
    const targetItems = allItemsByStatus[newStatus] || [];
    
    let newOrderIndex = 0;
    if (overItem && overItem.id !== activeItem.id) {
      const overIndex = targetItems.findIndex(i => i.id === overItem.id);
      newOrderIndex = overIndex >= 0 ? overIndex : targetItems.length;
    } else {
      newOrderIndex = targetItems.length;
    }

    if (onItemMove && (newStatus !== activeItem.status || newOrderIndex !== activeItem.orderIndex)) {
      onItemMove(activeItem.id, newStatus, newOrderIndex);
    }
    
    // Update custom order for the target status column
    const oldStatus = activeItem.status || "planned";
    const currentItems = [...(itemsByStatus[newStatus] || [])];
    const oldItems = newStatus !== oldStatus ? [...(itemsByStatus[oldStatus] || [])] : null;
    
    // Create new order for target column
    const newOrder = currentItems.filter(i => i.id !== activeItem.id);
    newOrder.splice(newOrderIndex, 0, activeItem);
    
    setCustomOrder(prev => {
      const updated = { ...prev };
      updated[newStatus] = newOrder.map(i => i.id);
      if (oldItems) {
        updated[oldStatus] = oldItems.filter(i => i.id !== activeItem.id).map(i => i.id);
      }
      return updated;
    });
  };

  const handleDragOver = (event: DragOverEvent) => {
  };

  return (
    <div className="h-full" data-testid="output-view">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            {filteredItems.length} élément{filteredItems.length !== 1 ? "s" : ""}
            {releaseTagFilter !== "all" && ` (${releaseTagFilter})`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={releaseTagFilter} onValueChange={setReleaseTagFilter}>
            <SelectTrigger className="w-[130px] h-8" data-testid="select-release-filter-output">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Version" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes versions</SelectItem>
              {RELEASE_TAG_OPTIONS.filter(tag => tag !== "all").map(tag => (
                <SelectItem key={tag} value={tag}>
                  <div className="flex items-center gap-1.5">
                    <Tag className="h-3 w-3" />
                    {tag}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onAddItem && (
            <Button size="sm" onClick={onAddItem} data-testid="button-add-output-item">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 h-[calc(100%-57px)] overflow-auto">
          {STATUS_COLUMNS.map(column => (
            <DroppableColumn
              key={column.id}
              column={column}
              items={itemsByStatus[column.id] || []}
              onItemClick={onItemClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeItem ? <ItemOverlay item={activeItem} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
