import { useMemo, useState, useRef, useCallback } from "react";
import { addDays, differenceInDays, format, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, startOfWeek, addMonths, isSameMonth, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, GripVertical, Circle, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { RoadmapItem } from "@shared/schema";

interface GanttViewProps {
  items: RoadmapItem[];
  onItemClick?: (item: RoadmapItem) => void;
  onAddItem?: () => void;
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

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 60;
const LEFT_PANEL_WIDTH = 280;

export function GanttView({ items, onItemClick, onAddItem }: GanttViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [viewStartDate, setViewStartDate] = useState(() => startOfMonth(new Date()));
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (!a.startDate && !b.startDate) return a.orderIndex - b.orderIndex;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
  }, [items]);

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

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-3 border-b hover-elevate cursor-pointer"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onItemClick?.(item)}
                  data-testid={`gantt-item-row-${item.id}`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                  <StatusIcon className={cn("h-4 w-4 flex-shrink-0", statusInfo.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", typeColors.text, typeColors.border)}>
                        {item.type === "deliverable" ? "Livrable" :
                         item.type === "milestone" ? "Jalon" :
                         item.type === "initiative" ? "Initiative" : "Bloc"}
                      </Badge>
                      {item.progress > 0 && (
                        <span className="text-[10px] text-muted-foreground">{item.progress}%</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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

                return (
                  <div
                    key={item.id}
                    className="relative border-b"
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
                              "absolute top-2 bottom-2 rounded-md border-2 cursor-pointer transition-transform hover:scale-[1.02]",
                              typeColors.bg,
                              typeColors.border,
                              item.type === "milestone" && "rounded-full"
                            )}
                            style={{
                              left: position.left,
                              width: item.type === "milestone" ? ROW_HEIGHT - 16 : position.width,
                            }}
                            onClick={() => onItemClick?.(item)}
                            data-testid={`gantt-bar-${item.id}`}
                          >
                            {item.type !== "milestone" && (
                              <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
                                <span className={cn("text-xs font-medium truncate", typeColors.text)}>
                                  {item.title}
                                </span>
                              </div>
                            )}
                            {item.type !== "milestone" && item.progress > 0 && (
                              <div 
                                className="absolute bottom-0 left-0 h-1 bg-green-500 rounded-b-sm"
                                style={{ width: `${item.progress}%` }}
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold">{item.title}</p>
                            {item.startDate && (
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(item.startDate), "d MMM yyyy", { locale: fr })}
                                {item.endDate && ` - ${format(parseISO(item.endDate), "d MMM yyyy", { locale: fr })}`}
                              </p>
                            )}
                            {item.progress > 0 && (
                              <div className="flex items-center gap-2">
                                <Progress value={item.progress} className="h-1.5 flex-1" />
                                <span className="text-xs">{item.progress}%</span>
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
