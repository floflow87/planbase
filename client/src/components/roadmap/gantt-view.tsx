import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { addDays, differenceInDays, format, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, startOfWeek, addMonths, isSameMonth, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, GripVertical, Circle, CheckCircle2, AlertCircle, Clock, Tag, Filter, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RoadmapItem, RoadmapDependency } from "@shared/schema";

interface GanttViewProps {
  items: RoadmapItem[];
  dependencies?: RoadmapDependency[];
  onItemClick?: (item: RoadmapItem) => void;
  onAddItem?: () => void;
  onCreateAtDate?: (startDate: Date, endDate: Date) => void;
  onUpdateItemDates?: (itemId: string, startDate: Date, endDate: Date) => void;
}

type DragType = "move" | "resize-start" | "resize-end" | null;

interface DragState {
  itemId: string;
  type: DragType;
  initialX: number;
  initialStartDate: Date;
  initialEndDate: Date;
}

type ZoomLevel = "day" | "week" | "month";

const ITEM_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  deliverable: { bg: "bg-violet-100 dark:bg-violet-900/30", border: "border-violet-400", text: "text-violet-700 dark:text-violet-300" },
  milestone: { bg: "bg-cyan-100 dark:bg-cyan-900/30", border: "border-cyan-400", text: "text-cyan-700 dark:text-cyan-300" },
  initiative: { bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-400", text: "text-purple-700 dark:text-purple-300" },
  free_block: { bg: "bg-gray-100 dark:bg-gray-800/50", border: "border-gray-400", text: "text-gray-700 dark:text-gray-300" },
};

const STATUS_ICONS: Record<string, { icon: typeof Circle; color: string }> = {
  planned: { icon: Circle, color: "text-gray-400" },
  in_progress: { icon: Clock, color: "text-amber-500" },
  done: { icon: CheckCircle2, color: "text-green-500" },
  blocked: { icon: AlertCircle, color: "text-red-500" },
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

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 60;
const LEFT_PANEL_WIDTH = 280;

interface HierarchicalItem extends RoadmapItem {
  depth: number;
  hasChildren: boolean;
  childrenProgress?: number;
}

export function GanttView({ items, dependencies = [], onItemClick, onAddItem, onCreateAtDate, onUpdateItemDates }: GanttViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [viewStartDate, setViewStartDate] = useState(() => startOfMonth(new Date()));
  const [releaseTagFilter, setReleaseTagFilter] = useState<string>("all");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<{ left: number; width: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggleCollapse = useCallback((itemId: string) => {
    setCollapsedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const viewEndDate = useMemo(() => {
    switch (zoom) {
      case "day":
        return addDays(viewStartDate, 30);
      case "week":
        return addMonths(viewStartDate, 2);
      case "month":
        return addMonths(viewStartDate, 6);
      default:
        return addMonths(viewStartDate, 2);
    }
  }, [viewStartDate, zoom]);

  const columns = useMemo(() => {
    switch (zoom) {
      case "day":
        return eachDayOfInterval({ start: viewStartDate, end: viewEndDate });
      case "week":
        return eachWeekOfInterval({ start: viewStartDate, end: viewEndDate }, { weekStartsOn: 1 });
      case "month": {
        const months: Date[] = [];
        let current = startOfMonth(viewStartDate);
        while (current <= viewEndDate) {
          months.push(current);
          current = addMonths(current, 1);
        }
        return months;
      }
      default:
        return [];
    }
  }, [viewStartDate, viewEndDate, zoom]);

  const columnWidth = useMemo(() => {
    switch (zoom) {
      case "day":
        return 40;
      case "week":
        return 100;
      case "month":
        return 120;
      default:
        return 100;
    }
  }, [zoom]);

  const totalWidth = columns.length * columnWidth;

  const hierarchicalItems = useMemo((): HierarchicalItem[] => {
    let filtered = [...items];
    if (releaseTagFilter !== "all") {
      filtered = filtered.filter(item => item.releaseTag === releaseTagFilter);
    }
    
    const itemMap = new Map(filtered.map(item => [item.id, item]));
    const childrenMap = new Map<string | null, RoadmapItem[]>();
    
    filtered.forEach(item => {
      const parentId = item.parentId || null;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(item);
    });
    
    Object.keys(Object.fromEntries(childrenMap)).forEach(key => {
      const arr = childrenMap.get(key === "null" ? null : key);
      if (arr) {
        arr.sort((a, b) => {
          if (!a.startDate && !b.startDate) return a.orderIndex - b.orderIndex;
          if (!a.startDate) return 1;
          if (!b.startDate) return -1;
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });
      }
    });
    
    const calculateChildrenProgress = (parentId: string): number => {
      const children = childrenMap.get(parentId) || [];
      if (children.length === 0) return 0;
      const totalProgress = children.reduce((sum, child) => sum + (child.progress || 0), 0);
      return Math.round(totalProgress / children.length);
    };
    
    const result: HierarchicalItem[] = [];
    
    const traverse = (parentId: string | null, depth: number) => {
      const children = childrenMap.get(parentId) || [];
      children.forEach(item => {
        const hasChildren = childrenMap.has(item.id) && (childrenMap.get(item.id)?.length || 0) > 0;
        const childrenProgress = hasChildren ? calculateChildrenProgress(item.id) : undefined;
        
        result.push({
          ...item,
          depth,
          hasChildren,
          childrenProgress,
        });
        
        if (hasChildren && !collapsedIds.has(item.id)) {
          traverse(item.id, depth + 1);
        }
      });
    };
    
    traverse(null, 0);
    
    return result;
  }, [items, releaseTagFilter, collapsedIds]);

  const sortedItems = hierarchicalItems;

  const getItemPosition = useCallback((item: RoadmapItem) => {
    if (!item.startDate) return null;
    
    const start = parseISO(item.startDate);
    const end = item.endDate ? parseISO(item.endDate) : addDays(start, 1);
    
    const startOffset = differenceInDays(start, viewStartDate);
    const duration = Math.max(1, differenceInDays(end, start) + 1);
    
    let left: number, width: number;
    
    switch (zoom) {
      case "day":
        left = startOffset * columnWidth;
        width = duration * columnWidth;
        break;
      case "week":
        left = (startOffset / 7) * columnWidth;
        width = (duration / 7) * columnWidth;
        break;
      case "month":
        left = (startOffset / 30) * columnWidth;
        width = (duration / 30) * columnWidth;
        break;
      default:
        left = 0;
        width = columnWidth;
    }
    
    return { left: Math.max(0, left), width: Math.max(columnWidth / 2, width) };
  }, [viewStartDate, columnWidth, zoom]);

  const navigatePrev = () => {
    switch (zoom) {
      case "day":
        setViewStartDate(prev => addDays(prev, -14));
        break;
      case "week":
        setViewStartDate(prev => addMonths(prev, -1));
        break;
      case "month":
        setViewStartDate(prev => addMonths(prev, -3));
        break;
    }
  };

  const navigateNext = () => {
    switch (zoom) {
      case "day":
        setViewStartDate(prev => addDays(prev, 14));
        break;
      case "week":
        setViewStartDate(prev => addMonths(prev, 1));
        break;
      case "month":
        setViewStartDate(prev => addMonths(prev, 3));
        break;
    }
  };

  const goToToday = () => {
    setViewStartDate(startOfMonth(new Date()));
  };

  const formatColumnHeader = (date: Date) => {
    switch (zoom) {
      case "day":
        return format(date, "d", { locale: fr });
      case "week":
        return format(date, "d MMM", { locale: fr });
      case "month":
        return format(date, "MMM yyyy", { locale: fr });
      default:
        return "";
    }
  };

  const formatMonthHeader = (date: Date) => {
    return format(date, "MMMM yyyy", { locale: fr });
  };

  const getTodayPosition = useCallback(() => {
    const today = new Date();
    const offset = differenceInDays(today, viewStartDate);
    
    switch (zoom) {
      case "day":
        return offset * columnWidth;
      case "week":
        return (offset / 7) * columnWidth;
      case "month":
        return (offset / 30) * columnWidth;
      default:
        return 0;
    }
  }, [viewStartDate, columnWidth, zoom]);

  const todayPosition = getTodayPosition();
  const showTodayLine = todayPosition >= 0 && todayPosition <= totalWidth;

  const dependencyArrows = useMemo(() => {
    if (!dependencies.length) return [];
    
    const arrows: Array<{
      id: string;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    }> = [];

    dependencies.forEach(dep => {
      const fromItemIndex = sortedItems.findIndex(i => i.id === dep.dependsOnRoadmapItemId);
      const toItemIndex = sortedItems.findIndex(i => i.id === dep.roadmapItemId);
      
      if (fromItemIndex === -1 || toItemIndex === -1) return;
      
      const fromItem = sortedItems[fromItemIndex];
      const toItem = sortedItems[toItemIndex];
      
      const fromPosition = getItemPosition(fromItem);
      const toPosition = getItemPosition(toItem);
      
      if (!fromPosition || !toPosition) return;

      const fromX = fromPosition.left + fromPosition.width;
      const fromY = (fromItemIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
      const toX = toPosition.left;
      const toY = (toItemIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);

      arrows.push({
        id: dep.id,
        fromX,
        fromY,
        toX,
        toY,
      });
    });

    return arrows;
  }, [dependencies, sortedItems, getItemPosition]);

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>, columnDate: Date) => {
    if (!onCreateAtDate) return;
    
    let startDate: Date;
    let endDate: Date;
    
    switch (zoom) {
      case "day":
        startDate = columnDate;
        endDate = addDays(columnDate, 1);
        break;
      case "week":
        startDate = columnDate;
        endDate = addDays(columnDate, 6);
        break;
      case "month":
        startDate = columnDate;
        endDate = endOfMonth(columnDate);
        break;
      default:
        startDate = columnDate;
        endDate = addDays(columnDate, 7);
    }
    
    onCreateAtDate(startDate, endDate);
  }, [onCreateAtDate, zoom]);

  const pixelsToDays = useCallback((pixels: number): number => {
    switch (zoom) {
      case "day":
        return Math.round(pixels / columnWidth);
      case "week":
        return Math.round((pixels / columnWidth) * 7);
      case "month":
        return Math.round((pixels / columnWidth) * 30);
      default:
        return 0;
    }
  }, [zoom, columnWidth]);

  const handleDragStart = useCallback((e: React.MouseEvent, item: RoadmapItem, type: DragType) => {
    if (!onUpdateItemDates || !item.startDate) return;
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      itemId: item.id,
      type,
      initialX: e.clientX,
      initialStartDate: parseISO(item.startDate),
      initialEndDate: item.endDate ? parseISO(item.endDate) : addDays(parseISO(item.startDate), 1),
    });
  }, [onUpdateItemDates]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragState) return;
    
    const deltaX = e.clientX - dragState.initialX;
    const deltaDays = pixelsToDays(deltaX);
    
    let newStartDate = dragState.initialStartDate;
    let newEndDate = dragState.initialEndDate;
    
    switch (dragState.type) {
      case "move":
        newStartDate = addDays(dragState.initialStartDate, deltaDays);
        newEndDate = addDays(dragState.initialEndDate, deltaDays);
        break;
      case "resize-start":
        newStartDate = addDays(dragState.initialStartDate, deltaDays);
        if (newStartDate >= newEndDate) {
          newStartDate = addDays(newEndDate, -1);
        }
        break;
      case "resize-end":
        newEndDate = addDays(dragState.initialEndDate, deltaDays);
        if (newEndDate <= newStartDate) {
          newEndDate = addDays(newStartDate, 1);
        }
        break;
    }
    
    const newPosition = getItemPosition({ 
      startDate: newStartDate.toISOString(), 
      endDate: newEndDate.toISOString() 
    } as RoadmapItem);
    
    if (newPosition) {
      setDragPreview({ left: newPosition.left, width: newPosition.width });
    }
  }, [dragState, pixelsToDays, getItemPosition]);

  const handleDragEnd = useCallback((e: MouseEvent) => {
    if (!dragState || !onUpdateItemDates) {
      setDragState(null);
      setDragPreview(null);
      return;
    }
    
    const deltaX = e.clientX - dragState.initialX;
    const deltaDays = pixelsToDays(deltaX);
    
    let newStartDate = dragState.initialStartDate;
    let newEndDate = dragState.initialEndDate;
    
    switch (dragState.type) {
      case "move":
        newStartDate = addDays(dragState.initialStartDate, deltaDays);
        newEndDate = addDays(dragState.initialEndDate, deltaDays);
        break;
      case "resize-start":
        newStartDate = addDays(dragState.initialStartDate, deltaDays);
        if (newStartDate >= newEndDate) {
          newStartDate = addDays(newEndDate, -1);
        }
        break;
      case "resize-end":
        newEndDate = addDays(dragState.initialEndDate, deltaDays);
        if (newEndDate <= newStartDate) {
          newEndDate = addDays(newStartDate, 1);
        }
        break;
    }
    
    onUpdateItemDates(dragState.itemId, newStartDate, newEndDate);
    setDragState(null);
    setDragPreview(null);
  }, [dragState, pixelsToDays, onUpdateItemDates]);

  useEffect(() => {
    if (dragState) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      document.body.style.cursor = dragState.type === "move" ? "grabbing" : "ew-resize";
      document.body.style.userSelect = "none";
      
      return () => {
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [dragState, handleDragMove, handleDragEnd]);

  return (
    <div className="flex flex-col h-full" data-testid="gantt-view">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={navigatePrev} data-testid="button-gantt-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-gantt-today">
            Aujourd'hui
          </Button>
          <Button variant="outline" size="sm" onClick={navigateNext} data-testid="button-gantt-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2">
            {formatMonthHeader(viewStartDate)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Select value={releaseTagFilter} onValueChange={setReleaseTagFilter}>
            <SelectTrigger className="w-[130px] h-8" data-testid="select-release-filter">
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

          <div className="flex items-center border rounded-md p-0.5">
            <Button
              variant={zoom === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setZoom("day")}
              className="h-7 px-2 text-xs"
              data-testid="button-zoom-day"
            >
              Jour
            </Button>
            <Button
              variant={zoom === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setZoom("week")}
              className="h-7 px-2 text-xs"
              data-testid="button-zoom-week"
            >
              Semaine
            </Button>
            <Button
              variant={zoom === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setZoom("month")}
              className="h-7 px-2 text-xs"
              data-testid="button-zoom-month"
            >
              Mois
            </Button>
          </div>
          {onAddItem && (
            <Button size="sm" onClick={onAddItem} data-testid="button-add-gantt-item">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-shrink-0 border-r bg-background" style={{ width: LEFT_PANEL_WIDTH }}>
          <div className="h-[60px] border-b px-3 flex items-center bg-muted/50">
            <span className="text-sm font-semibold text-muted-foreground">Éléments</span>
          </div>
          <div className="overflow-y-auto" style={{ height: `calc(100% - ${HEADER_HEIGHT}px)` }}>
            {sortedItems.map((item) => {
              const typeColors = ITEM_TYPE_COLORS[item.type] || ITEM_TYPE_COLORS.deliverable;
              const statusInfo = STATUS_ICONS[item.status] || STATUS_ICONS.planned;
              const StatusIcon = statusInfo.icon;
              const isCollapsed = collapsedIds.has(item.id);
              const indentPx = item.depth * 16;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-1.5 px-2 border-b hover-elevate cursor-pointer",
                    item.hasChildren && "bg-muted/20",
                    item.isGroup && "bg-violet-50/50 dark:bg-violet-900/10"
                  )}
                  style={{ height: ROW_HEIGHT, paddingLeft: `${8 + indentPx}px` }}
                  onClick={() => onItemClick?.(item)}
                  data-testid={`gantt-item-row-${item.id}`}
                >
                  {item.hasChildren ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapse(item.id);
                      }}
                      className="p-0.5 rounded hover:bg-muted flex-shrink-0"
                      data-testid={`button-toggle-${item.id}`}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  ) : (
                    <div className="w-5 flex-shrink-0" />
                  )}
                  
                  {item.hasChildren || item.isGroup ? (
                    isCollapsed ? (
                      <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    ) : (
                      <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    )
                  ) : (
                    <StatusIcon className={cn("h-4 w-4 flex-shrink-0", statusInfo.color)} />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm truncate",
                      item.hasChildren || item.isGroup ? "font-semibold" : "font-medium"
                    )}>
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", typeColors.text, typeColors.border)}>
                        {item.type === "deliverable" ? "Livrable" :
                         item.type === "milestone" ? "Jalon" :
                         item.type === "initiative" ? "Initiative" : "Bloc"}
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
                      {item.hasChildren && item.childrenProgress !== undefined ? (
                        <span className="text-[10px] text-muted-foreground">{item.childrenProgress}%</span>
                      ) : item.progress > 0 && (
                        <span className="text-[10px] text-muted-foreground">{item.progress}%</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {onCreateAtDate && (
              <div
                className="flex items-center gap-1.5 px-3 border-b border-dashed border-primary/30 hover:bg-primary/5 cursor-pointer text-muted-foreground"
                style={{ height: ROW_HEIGHT }}
                onClick={onAddItem}
                data-testid="gantt-add-row-left"
              >
                <Plus className="h-4 w-4 text-primary/50" />
                <span className="text-sm">Cliquer sur la grille pour ajouter</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-auto" ref={scrollContainerRef}>
          <div style={{ minWidth: totalWidth }} className="relative">
            <div className="sticky top-0 z-10 bg-muted/50 border-b" style={{ height: HEADER_HEIGHT }}>
              <div className="flex">
                {columns.map((col, idx) => {
                  const isCurrentMonth = isSameMonth(col, new Date());
                  const isCurrentDay = zoom === "day" && isToday(col);
                  
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex-shrink-0 border-r flex items-center justify-center text-xs font-medium",
                        isCurrentMonth && "bg-violet-50 dark:bg-violet-900/20",
                        isCurrentDay && "bg-violet-100 dark:bg-violet-900/40"
                      )}
                      style={{ width: columnWidth, height: HEADER_HEIGHT }}
                    >
                      <span className={cn(
                        "text-muted-foreground",
                        isCurrentDay && "text-violet-600 dark:text-violet-400 font-semibold"
                      )}>
                        {formatColumnHeader(col)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              {sortedItems.map((item, rowIndex) => {
                const position = getItemPosition(item);
                const typeColors = ITEM_TYPE_COLORS[item.type] || ITEM_TYPE_COLORS.deliverable;
                const isParent = item.hasChildren || item.isGroup;
                const displayProgress = item.hasChildren && item.childrenProgress !== undefined 
                  ? item.childrenProgress 
                  : item.progress;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "relative border-b",
                      item.depth > 0 && "bg-muted/5"
                    )}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className="absolute inset-0 flex">
                      {columns.map((_, colIdx) => (
                        <div
                          key={colIdx}
                          className="flex-shrink-0 border-r border-dashed border-muted-foreground/10"
                          style={{ width: columnWidth }}
                        />
                      ))}
                    </div>

                    {position && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "absolute rounded-md border-2 group/bar",
                              isParent 
                                ? "bg-amber-100 dark:bg-amber-900/30 border-amber-400 top-3 bottom-3" 
                                : cn(typeColors.bg, typeColors.border, "top-2 bottom-2"),
                              item.type === "milestone" && "rounded-full",
                              dragState?.itemId === item.id && "opacity-50",
                              onUpdateItemDates && "cursor-grab hover:shadow-md hover:bg-white dark:hover:bg-gray-800"
                            )}
                            style={{
                              left: dragState?.itemId === item.id && dragPreview ? dragPreview.left : position.left,
                              width: item.type === "milestone" ? ROW_HEIGHT - 16 : (dragState?.itemId === item.id && dragPreview ? dragPreview.width : position.width),
                            }}
                            onClick={() => !dragState && onItemClick?.(item)}
                            onMouseDown={(e) => item.type !== "milestone" && handleDragStart(e, item, "move")}
                            data-testid={`gantt-bar-${item.id}`}
                          >
                            {item.type !== "milestone" && onUpdateItemDates && (
                              <>
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-primary/20 hover:bg-primary/40 rounded-l-md transition-opacity z-10"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleDragStart(e, item, "resize-start");
                                  }}
                                  data-testid={`resize-start-${item.id}`}
                                />
                                <div
                                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-primary/20 hover:bg-primary/40 rounded-r-md transition-opacity z-10"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleDragStart(e, item, "resize-end");
                                  }}
                                  data-testid={`resize-end-${item.id}`}
                                />
                              </>
                            )}
                            {item.type !== "milestone" && (
                              <div className="absolute inset-0 flex items-center px-3 overflow-hidden pointer-events-none">
                                {isParent && <Folder className="h-3 w-3 mr-1 text-amber-600 dark:text-amber-400 flex-shrink-0" />}
                                <span className={cn(
                                  "text-xs font-medium truncate",
                                  isParent ? "text-amber-700 dark:text-amber-300" : typeColors.text
                                )}>
                                  {item.title}
                                </span>
                              </div>
                            )}
                            {item.type !== "milestone" && displayProgress > 0 && (
                              <div 
                                className={cn(
                                  "absolute bottom-0 left-0 h-1 rounded-b-sm pointer-events-none",
                                  isParent ? "bg-amber-500" : "bg-green-500"
                                )}
                                style={{ width: `${displayProgress}%` }}
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {isParent && <Folder className="h-3.5 w-3.5 text-amber-500" />}
                              <p className="font-semibold">{item.title}</p>
                              {item.releaseTag && (
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-[10px] px-1.5 py-0",
                                    RELEASE_TAG_COLORS[item.releaseTag]?.text,
                                    RELEASE_TAG_COLORS[item.releaseTag]?.border
                                  )}
                                >
                                  {item.releaseTag}
                                </Badge>
                              )}
                            </div>
                            {isParent && (
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                Groupe avec sous-éléments
                              </p>
                            )}
                            {item.startDate && (
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(item.startDate), "d MMM yyyy", { locale: fr })}
                                {item.endDate && ` - ${format(parseISO(item.endDate), "d MMM yyyy", { locale: fr })}`}
                              </p>
                            )}
                            {displayProgress > 0 && (
                              <div className="flex items-center gap-2">
                                <Progress value={displayProgress} className="h-1.5 flex-1" />
                                <span className="text-xs">{displayProgress}%</span>
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {!position && (
                      <div className="absolute inset-y-2 left-4 flex items-center">
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Dates non définies
                        </Badge>
                      </div>
                    )}
                  </div>
                );
              })}

              {onCreateAtDate && (
                <div
                  className="relative border-b border-dashed border-primary/30 hover:bg-primary/5 cursor-pointer group"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="absolute inset-0 flex">
                    {columns.map((col, colIdx) => (
                      <Tooltip key={colIdx}>
                        <TooltipTrigger asChild>
                          <div
                            className="flex-shrink-0 border-r border-dashed border-muted-foreground/10 hover:bg-primary/10 transition-colors flex items-center justify-center"
                            style={{ width: columnWidth }}
                            onClick={(e) => handleGridClick(e, col)}
                            data-testid={`grid-cell-create-${colIdx}`}
                          >
                            <Plus className="h-4 w-4 text-primary/30 group-hover:text-primary/60 transition-colors" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">
                            Cliquer pour créer au {format(col, zoom === "month" ? "MMM yyyy" : "d MMM", { locale: fr })}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              )}

              {dependencyArrows.length > 0 && (
                <svg 
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{ width: totalWidth, height: sortedItems.length * ROW_HEIGHT }}
                >
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="8"
                      markerHeight="6"
                      refX="8"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--primary))" />
                    </marker>
                  </defs>
                  {dependencyArrows.map(arrow => {
                    const midX = arrow.fromX + (arrow.toX - arrow.fromX) / 2;
                    const path = `M ${arrow.fromX} ${arrow.fromY} C ${midX} ${arrow.fromY}, ${midX} ${arrow.toY}, ${arrow.toX} ${arrow.toY}`;
                    return (
                      <path
                        key={arrow.id}
                        d={path}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        strokeOpacity="0.6"
                        markerEnd="url(#arrowhead)"
                        data-testid={`dependency-arrow-${arrow.id}`}
                      />
                    );
                  })}
                </svg>
              )}
            </div>

            {showTodayLine && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                style={{ left: todayPosition + LEFT_PANEL_WIDTH }}
              >
                <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
              </div>
            )}
          </div>
        </div>
      </div>

      {sortedItems.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-center py-12">
          <div>
            <p className="text-muted-foreground mb-4">Aucun élément dans cette roadmap</p>
            {onAddItem && (
              <Button variant="outline" onClick={onAddItem} data-testid="button-add-first-gantt-item">
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un élément
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
