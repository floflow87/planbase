import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { addDays, differenceInDays, format, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, startOfWeek, addMonths, isSameMonth, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

// Helper to safely parse dates that might be Date objects or strings
const safeParseDate = (date: Date | string | null | undefined): Date | null => {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (typeof date === 'string') return parseISO(date);
  return null;
};
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, GripVertical, Circle, CheckCircle2, AlertCircle, Clock, Tag, Filter, Folder, FolderOpen, Trash2, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { RoadmapItem, RoadmapDependency } from "@shared/schema";

export interface BulkActionData {
  type?: string;
  priority?: string;
  status?: string;
  releaseTag?: string | null;
  startDate?: string;
  endDate?: string;
}

type DependencyType = "start_to_start" | "start_to_finish" | "finish_to_start" | "finish_to_finish";

interface GanttViewProps {
  items: RoadmapItem[];
  dependencies?: RoadmapDependency[];
  onItemClick?: (item: RoadmapItem) => void;
  onAddItem?: () => void;
  onCreateAtDate?: (startDate: Date, endDate: Date) => void;
  onUpdateItemDates?: (itemId: string, startDate: Date, endDate: Date) => void;
  onCreateDependency?: (fromItemId: string, toItemId: string, type: DependencyType) => void;
  onBulkDelete?: (itemIds: string[]) => void;
  onBulkUpdate?: (itemIds: string[], data: BulkActionData) => void;
}

type DragType = "move" | "resize-start" | "resize-end" | null;

interface DependencyDragState {
  fromItemId: string;
  fromSide: "start" | "end";
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

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

export function GanttView({ items, dependencies = [], onItemClick, onAddItem, onCreateAtDate, onUpdateItemDates, onCreateDependency, onBulkDelete, onBulkUpdate }: GanttViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [viewStartDate, setViewStartDate] = useState(() => startOfMonth(new Date()));
  const [releaseTagFilter, setReleaseTagFilter] = useState<string>("all");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<{ left: number; width: number } | null>(null);
  const [depDragState, setDepDragState] = useState<DependencyDragState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  const toggleSelection = useCallback((itemId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(item => item.id)));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkAction = useCallback((action: string, value?: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    
    switch (action) {
      case 'delete':
        onBulkDelete?.(ids);
        clearSelection();
        break;
      case 'type':
        onBulkUpdate?.(ids, { type: value });
        break;
      case 'priority':
        onBulkUpdate?.(ids, { priority: value });
        break;
      case 'status':
        onBulkUpdate?.(ids, { status: value });
        break;
      case 'releaseTag':
        onBulkUpdate?.(ids, { releaseTag: value || null });
        break;
    }
  }, [selectedIds, onBulkDelete, onBulkUpdate, clearSelection]);

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
    
    const start = safeParseDate(item.startDate);
    if (!start) return null;
    const end = item.endDate ? safeParseDate(item.endDate) || addDays(start, 1) : addDays(start, 1);
    
    const startOffset = differenceInDays(start, viewStartDate);
    const endOffset = differenceInDays(end, viewStartDate);
    const duration = Math.max(1, differenceInDays(end, start) + 1);
    
    let left: number, width: number;
    let pixelsPerDay: number;
    
    switch (zoom) {
      case "day":
        pixelsPerDay = columnWidth;
        break;
      case "week":
        pixelsPerDay = columnWidth / 7;
        break;
      case "month":
        pixelsPerDay = columnWidth / 30;
        break;
      default:
        pixelsPerDay = columnWidth / 7;
    }
    
    left = startOffset * pixelsPerDay;
    width = duration * pixelsPerDay;
    
    // Check if item is completely out of view
    const viewDays = zoom === "day" ? 30 : zoom === "week" ? 60 : 180;
    if (endOffset < 0 || startOffset > viewDays) {
      return null; // Item is completely outside visible range
    }
    
    // If item starts before view, clip it
    if (left < 0) {
      width = width + left; // Reduce width by the amount clipped
      left = 0;
    }
    
    return { left, width: Math.max(columnWidth / 2, width) };
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

  // Group columns by month for day view header
  const monthGroups = useMemo(() => {
    if (zoom !== "day") return [];
    const groups: { month: string; startIdx: number; count: number }[] = [];
    let currentMonth = "";
    let currentStartIdx = 0;
    let currentCount = 0;

    columns.forEach((col, idx) => {
      const monthStr = format(col, "MMMM yyyy", { locale: fr });
      if (monthStr !== currentMonth) {
        if (currentMonth) {
          groups.push({ month: currentMonth, startIdx: currentStartIdx, count: currentCount });
        }
        currentMonth = monthStr;
        currentStartIdx = idx;
        currentCount = 1;
      } else {
        currentCount++;
      }
    });
    
    if (currentMonth) {
      groups.push({ month: currentMonth, startIdx: currentStartIdx, count: currentCount });
    }
    
    return groups;
  }, [columns, zoom]);

  const formatMonthHeader = (date: Date) => {
    return format(date, "MMMM yyyy", { locale: fr });
  };

  const getTodayPosition = useCallback(() => {
    const today = new Date();
    const offset = differenceInDays(today, viewStartDate);
    
    let pixelsPerDay: number;
    switch (zoom) {
      case "day":
        pixelsPerDay = columnWidth;
        break;
      case "week":
        pixelsPerDay = columnWidth / 7;
        break;
      case "month":
        pixelsPerDay = columnWidth / 30;
        break;
      default:
        pixelsPerDay = columnWidth / 7;
    }
    
    return offset * pixelsPerDay;
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
      type: string;
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

      // Calculate connection points based on dependency type
      const depType = dep.type || "finish_to_start";
      let fromX: number;
      let toX: number;

      // From side: start = left edge, finish = right edge
      if (depType.startsWith("start")) {
        fromX = fromPosition.left;
      } else {
        fromX = fromPosition.left + fromPosition.width;
      }

      // To side: start = left edge, finish = right edge
      if (depType.endsWith("start")) {
        toX = toPosition.left;
      } else {
        toX = toPosition.left + toPosition.width;
      }

      const fromY = (fromItemIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
      const toY = (toItemIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);

      arrows.push({
        id: dep.id,
        fromX,
        fromY,
        toX,
        toY,
        type: depType,
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
    const startDate = safeParseDate(item.startDate);
    if (!startDate) return;
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      itemId: item.id,
      type,
      initialX: e.clientX,
      initialStartDate: startDate,
      initialEndDate: item.endDate ? safeParseDate(item.endDate) || addDays(startDate, 1) : addDays(startDate, 1),
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

  // Dependency drag handlers
  const handleDepDragStart = useCallback((e: React.MouseEvent, itemId: string, side: "start" | "end") => {
    e.preventDefault();
    e.stopPropagation();
    const rect = ganttContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDepDragState({
      fromItemId: itemId,
      fromSide: side,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      currentX: e.clientX - rect.left,
      currentY: e.clientY - rect.top,
    });
  }, []);

  const handleDepDragMove = useCallback((e: MouseEvent) => {
    if (!depDragState || !ganttContainerRef.current) return;
    const rect = ganttContainerRef.current.getBoundingClientRect();
    setDepDragState(prev => prev ? {
      ...prev,
      currentX: e.clientX - rect.left,
      currentY: e.clientY - rect.top,
    } : null);
  }, [depDragState]);

  const handleDepDragEnd = useCallback((e: MouseEvent) => {
    if (!depDragState || !onCreateDependency) {
      setDepDragState(null);
      return;
    }
    
    // Find if we dropped on a dependency ball
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const depBall = target?.closest('[data-dep-item-id]');
    if (depBall) {
      const toItemId = depBall.getAttribute('data-dep-item-id');
      const toSide = depBall.getAttribute('data-dep-side') as "start" | "end" | null;
      if (toItemId && toItemId !== depDragState.fromItemId && toSide) {
        // Calculate dependency type based on from/to sides
        const fromSide = depDragState.fromSide;
        let depType: DependencyType;
        if (fromSide === "start" && toSide === "start") {
          depType = "start_to_start";
        } else if (fromSide === "start" && toSide === "end") {
          depType = "start_to_finish";
        } else if (fromSide === "end" && toSide === "start") {
          depType = "finish_to_start";
        } else {
          depType = "finish_to_finish";
        }
        onCreateDependency(depDragState.fromItemId, toItemId, depType);
      }
    }
    
    setDepDragState(null);
  }, [depDragState, onCreateDependency]);

  useEffect(() => {
    if (depDragState) {
      window.addEventListener("mousemove", handleDepDragMove);
      window.addEventListener("mouseup", handleDepDragEnd);
      document.body.style.cursor = "crosshair";
      document.body.style.userSelect = "none";
      
      return () => {
        window.removeEventListener("mousemove", handleDepDragMove);
        window.removeEventListener("mouseup", handleDepDragEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [depDragState, handleDepDragMove, handleDepDragEnd]);

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

      {/* Bulk Actions Bar - appears when items are selected */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 bg-violet-50 dark:bg-violet-900/20 border-b" data-testid="bulk-actions-bar">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
            </Badge>
            <Button variant="ghost" size="sm" onClick={clearSelection} data-testid="button-clear-selection">
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Select onValueChange={(v) => handleBulkAction('type', v)}>
              <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-bulk-type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deliverable">Livrable</SelectItem>
                <SelectItem value="milestone">Jalon</SelectItem>
                <SelectItem value="initiative">Initiative</SelectItem>
                <SelectItem value="free_block">Bloc libre</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={(v) => handleBulkAction('priority', v)}>
              <SelectTrigger className="w-[110px] h-8 text-xs" data-testid="select-bulk-priority">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Basse</SelectItem>
                <SelectItem value="normal">Normale</SelectItem>
                <SelectItem value="high">Haute</SelectItem>
                <SelectItem value="strategic">Stratégique</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={(v) => handleBulkAction('status', v)}>
              <SelectTrigger className="w-[110px] h-8 text-xs" data-testid="select-bulk-status">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planifié</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="done">Terminé</SelectItem>
                <SelectItem value="blocked">Bloqué</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={(v) => handleBulkAction('releaseTag', v === 'none' ? '' : v)}>
              <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="select-bulk-version">
                <SelectValue placeholder="Version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                <SelectItem value="MVP">MVP</SelectItem>
                <SelectItem value="V1">V1</SelectItem>
                <SelectItem value="V2">V2</SelectItem>
                <SelectItem value="V3">V3</SelectItem>
                <SelectItem value="Hotfix">Hotfix</SelectItem>
                <SelectItem value="Soon">Soon</SelectItem>
              </SelectContent>
            </Select>

            {onBulkDelete && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => handleBulkAction('delete')}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-shrink-0 border-r bg-background" style={{ width: LEFT_PANEL_WIDTH }}>
          <div className="h-[60px] border-b px-3 flex items-center gap-2 bg-muted/50">
            <Checkbox 
              checked={sortedItems.length > 0 && selectedIds.size === sortedItems.length}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedIds(new Set(sortedItems.map(item => item.id)));
                } else {
                  clearSelection();
                }
              }}
              data-testid="checkbox-select-all"
            />
            <span className="text-sm font-semibold text-muted-foreground">Éléments</span>
          </div>
          <div className="overflow-y-auto" style={{ height: `calc(100% - ${HEADER_HEIGHT}px)` }}>
            {sortedItems.map((item) => {
              const typeColors = ITEM_TYPE_COLORS[item.type] || ITEM_TYPE_COLORS.deliverable;
              const statusInfo = STATUS_ICONS[item.status] || STATUS_ICONS.planned;
              const StatusIcon = statusInfo.icon;
              const isCollapsed = collapsedIds.has(item.id);
              const indentPx = item.depth * 16;

              const isSelected = selectedIds.has(item.id);
              
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-1.5 px-2 border-b hover-elevate cursor-pointer",
                    item.hasChildren && "bg-muted/20",
                    item.isGroup && "bg-violet-50/50 dark:bg-violet-900/10",
                    isSelected && "bg-violet-100 dark:bg-violet-900/30"
                  )}
                  style={{ height: ROW_HEIGHT, paddingLeft: `${8 + indentPx}px` }}
                  onClick={() => onItemClick?.(item)}
                  data-testid={`gantt-item-row-${item.id}`}
                >
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => toggleSelection(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                    data-testid={`checkbox-item-${item.id}`}
                  />
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
          <div style={{ minWidth: totalWidth }} className="relative" ref={ganttContainerRef}>
            {/* SVG overlay for dependency drag line */}
            {depDragState && (
              <svg
                className="absolute inset-0 pointer-events-none z-50"
                style={{ width: "100%", height: "100%" }}
              >
                <line
                  x1={depDragState.startX}
                  y1={depDragState.startY}
                  x2={depDragState.currentX}
                  y2={depDragState.currentY}
                  stroke="#7c3aed"
                  strokeWidth={3}
                  strokeDasharray="6,4"
                  strokeLinecap="round"
                />
                <circle
                  cx={depDragState.currentX}
                  cy={depDragState.currentY}
                  r={6}
                  fill="#7c3aed"
                />
              </svg>
            )}
            <div className="sticky top-0 z-10 bg-muted/50 border-b" style={{ height: HEADER_HEIGHT }}>
              {/* Month header row for day view */}
              {zoom === "day" && monthGroups.length > 0 && (
                <div className="flex" style={{ height: HEADER_HEIGHT / 2 }}>
                  {monthGroups.map((group, idx) => (
                    <div
                      key={idx}
                      className="flex-shrink-0 border-r border-b flex items-center justify-center text-xs font-semibold bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
                      style={{ width: group.count * columnWidth, height: HEADER_HEIGHT / 2 }}
                    >
                      {group.month}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex" style={{ height: zoom === "day" ? HEADER_HEIGHT / 2 : HEADER_HEIGHT }}>
                {columns.map((col, idx) => {
                  const isCurrentMonth = isSameMonth(col, new Date());
                  const isCurrentDay = zoom === "day" && isToday(col);
                  
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex-shrink-0 border-r flex items-center justify-center text-xs font-medium",
                        zoom !== "day" && isCurrentMonth && "bg-violet-50 dark:bg-violet-900/20",
                        isCurrentDay && "bg-violet-100 dark:bg-violet-900/40"
                      )}
                      style={{ width: columnWidth, height: zoom === "day" ? HEADER_HEIGHT / 2 : HEADER_HEIGHT }}
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
                                {/* Resize handle - left */}
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-primary/30 group-hover/bar:bg-primary/60 hover:bg-primary/80 rounded-l-md transition-colors z-10 flex items-center justify-center"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleDragStart(e, item, "resize-start");
                                  }}
                                  data-testid={`resize-start-${item.id}`}
                                >
                                  <div className="w-0.5 h-3 bg-white/60 rounded-full" />
                                </div>
                                {/* Resize handle - right */}
                                <div
                                  className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-primary/30 group-hover/bar:bg-primary/60 hover:bg-primary/80 rounded-r-md transition-colors z-10 flex items-center justify-center"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleDragStart(e, item, "resize-end");
                                  }}
                                  data-testid={`resize-end-${item.id}`}
                                >
                                  <div className="w-0.5 h-3 bg-white/60 rounded-full" />
                                </div>
                                {/* Dependency connector - left (incoming) */}
                                <div
                                  className="absolute -left-5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-violet-500 border-2 border-white shadow-md cursor-crosshair hover:scale-150 hover:bg-violet-600 transition-all z-20 flex items-center justify-center"
                                  onMouseDown={(e) => handleDepDragStart(e, item.id, "start")}
                                  data-testid={`dependency-in-${item.id}`}
                                  data-dep-item-id={item.id}
                                  data-dep-side="start"
                                  title="Glisser pour créer une dépendance"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                </div>
                                {/* Dependency connector - right (outgoing) */}
                                <div
                                  className="absolute -right-5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-violet-500 border-2 border-white shadow-md cursor-crosshair hover:scale-150 hover:bg-violet-600 transition-all z-20 flex items-center justify-center"
                                  onMouseDown={(e) => handleDepDragStart(e, item.id, "end")}
                                  data-testid={`dependency-out-${item.id}`}
                                  data-dep-item-id={item.id}
                                  data-dep-side="end"
                                  title="Glisser pour créer une dépendance"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                </div>
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
                        <TooltipContent side="top" className="max-w-xs bg-white dark:bg-slate-900 text-foreground border shadow-lg">
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
                            {item.startDate && safeParseDate(item.startDate) && (
                              <p className="text-xs text-muted-foreground">
                                {format(safeParseDate(item.startDate)!, "d MMM yyyy", { locale: fr })}
                                {item.endDate && safeParseDate(item.endDate) && ` - ${format(safeParseDate(item.endDate)!, "d MMM yyyy", { locale: fr })}`}
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
                        <TooltipContent side="top" className="bg-white dark:bg-slate-900 text-foreground border shadow-lg">
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
                style={{ left: todayPosition }}
                data-testid="today-line"
              >
                {/* Chevron pointing down */}
                <div className="absolute -top-6 -left-[22px] flex flex-col items-center">
                  <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-background/90 px-1.5 py-0.5 rounded shadow-sm border border-red-200 dark:border-red-800">
                    Aujourd'hui
                  </span>
                  <svg width="12" height="8" viewBox="0 0 12 8" className="text-red-500 mt-0.5">
                    <polygon points="6,8 0,0 12,0" fill="currentColor" />
                  </svg>
                </div>
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full" />
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
