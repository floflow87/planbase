import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  ChevronDown, ChevronRight, ChevronUp, Plus, MoreVertical, 
  Flag, User, Calendar, GripVertical, Play, Pause,
  Check, Layers, Bookmark, ListTodo, AlertCircle, Pencil,
  ArrowUp, ArrowDown, Copy, Trash2, UserPlus, Hash, ExternalLink,
  CheckSquare, Square, MoreHorizontal, Link2, Wrench, Tag, X, Bug, Timer
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useDraggable, useDroppable, DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Epic, UserStory, BacklogTask, Sprint, AppUser, RoadmapItem } from "@shared/schema";
import { backlogItemStateOptions, backlogPriorityOptions } from "@shared/schema";

export type TicketType = "epic" | "user_story" | "task" | "bug";

export interface FlatTicket {
  id: string;
  type: TicketType;
  title: string;
  description?: string | null;
  state?: string | null;
  priority?: string | null;
  sprintId?: string | null;
  epicId?: string | null;
  userStoryId?: string | null;
  estimatePoints?: number | null;
  assigneeId?: string | null;
  reporterId?: string | null;
  color?: string | null;
  order: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  version?: string | null;
  tags?: string[];
  metrics01Label?: string | null;
  metrics01Value?: number | null;
  metrics02Label?: string | null;
  metrics02Value?: number | null;
  metrics03Label?: string | null;
  metrics03Value?: number | null;
  happyPath?: string | null;
  edgeCase?: string | null;
}

function ticketTypeIcon(type: TicketType) {
  switch (type) {
    case "epic":
      return <Layers className="h-4 w-4" />;
    case "user_story":
      return <Bookmark className="h-4 w-4" />;
    case "task":
      return <ListTodo className="h-4 w-4" />;
    case "bug":
      return <Wrench className="h-4 w-4" />;
  }
}

function ticketTypeColor(type: TicketType, epicColor?: string | null): string {
  switch (type) {
    case "epic":
      return epicColor || "#8B5CF6";
    case "user_story":
      return "#22C55E";
    case "task":
      return "#3B82F6";
    case "bug":
      return "#EF4444";
  }
}

function ticketTypePastelColors(type: TicketType, epicColor?: string | null): { bg: string; text: string } {
  switch (type) {
    case "epic":
      return { bg: epicColor ? epicColor + "33" : "#EDE9FE", text: epicColor || "#6D28D9" };
    case "user_story":
      return { bg: "#DCFCE7", text: "#15803D" };
    case "task":
      return { bg: "#DBEAFE", text: "#1D4ED8" };
    case "bug":
      return { bg: "#FEE2E2", text: "#DC2626" };
  }
}

function getStateStyle(state: string | null | undefined) {
  switch (state) {
    case "termine":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "en_cours":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "review":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "testing":
      return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400";
    case "to_fix":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "backlog":
      return "bg-gray-50 text-gray-500 dark:bg-gray-900/40 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

function getStateLabel(state: string | null | undefined) {
  switch (state) {
    case "termine":
      return "Terminé";
    case "en_cours":
      return "En cours";
    case "review":
      return "Review";
    case "testing":
      return "Testing";
    case "to_fix":
      return "To fix";
    case "backlog":
      return "Backlog";
    case "a_faire":
    default:
      return "À faire";
  }
}

function getStateDot(state: string | null | undefined) {
  switch (state) {
    case "termine":
      return "bg-green-500";
    case "en_cours":
      return "bg-blue-500";
    case "review":
      return "bg-purple-500";
    case "testing":
      return "bg-cyan-500";
    case "to_fix":
      return "bg-orange-500";
    case "backlog":
      return "bg-gray-400";
    case "a_faire":
    default:
      return "bg-gray-400";
  }
}

// Linear-style progressive status icon (SVG circle that fills based on progression)
function getStateColor(state: string | null | undefined): string {
  switch (state) {
    case "termine": return "#22C55E";
    case "review": return "#A855F7";
    case "testing": return "#06B6D4";
    case "to_fix": return "#F97316";
    case "en_cours": return "#3B82F6";
    case "backlog": return "#9CA3AF";
    case "a_faire":
    default: return "#9CA3AF";
  }
}

function getStateProgress(state: string | null | undefined): number {
  switch (state) {
    case "termine": return 1;
    case "review": return 0.75;
    case "testing": return 0.5;
    case "to_fix": return 0.5;
    case "en_cours": return 0.25;
    case "a_faire":
    case "backlog":
    default: return 0;
  }
}

function pieSlicePath(cx: number, cy: number, r: number, progress: number): string {
  if (progress <= 0) return "";
  if (progress >= 1) return `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 -${r * 2} 0 Z`;
  const angle = progress * 2 * Math.PI;
  const endX = cx + r * Math.sin(angle);
  const endY = cy - r * Math.cos(angle);
  const largeArc = progress > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

export function StatusIcon({ state, size = 14, className }: { state: string | null | undefined; size?: number; className?: string }) {
  const color = getStateColor(state);
  const progress = getStateProgress(state);
  const isBacklog = state === "backlog";
  const isDone = state === "termine";
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) - 1.5;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("flex-shrink-0", className)}>
      {isDone ? (
        <>
          <circle cx={cx} cy={cy} r={r} fill={color} />
          <path
            d={`M ${cx - r * 0.5} ${cy} L ${cx - r * 0.1} ${cy + r * 0.4} L ${cx + r * 0.55} ${cy - r * 0.35}`}
            fill="none"
            stroke="white"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray={isBacklog ? "2 2" : undefined}
          />
          {progress > 0 && (
            <path d={pieSlicePath(cx, cy, r - 1.5, progress)} fill={color} />
          )}
        </>
      )}
    </svg>
  );
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "< 1min";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

interface StatusPeriod { state: string; durationMs: number; }

function computeTimeInStatus(
  activities: Array<{ payload: any; createdAt: string }>,
  createdAt: string | null | undefined,
  currentState: string | null | undefined
): StatusPeriod[] {
  const stateChanges = activities
    .filter(a => a.payload?.type === "state_change")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const periods: StatusPeriod[] = [];
  let cursor = createdAt ? new Date(createdAt).getTime() : Date.now();
  let tracked = "a_faire";

  for (const change of stateChanges) {
    const t = new Date(change.createdAt).getTime();
    const duration = t - cursor;
    if (duration > 30000) {
      periods.push({ state: tracked, durationMs: duration });
    }
    cursor = t;
    tracked = change.payload.newState ?? tracked;
  }

  // Use the ticket's actual current state for the final (ongoing) period
  const finalState = currentState ?? tracked;
  const finalDuration = Date.now() - cursor;
  if (finalDuration > 30000) {
    periods.push({ state: finalState, durationMs: finalDuration });
  }

  return periods;
}

// Priority icons: low = 2 violet chevrons DOWN, medium = yellow horizontal line, high = 1 orange chevron UP, critical = 2 red chevrons UP
function PriorityIcon({ priority, className }: { priority: string | null | undefined; className?: string }) {
  switch (priority) {
    case "critical":
      // Two red chevrons UP stacked (highest priority)
      return (
        <div className={cn("flex flex-col items-center -space-y-2.5", className)}>
          <ChevronUp className="h-[18px] w-[18px] text-red-500" />
          <ChevronUp className="h-[18px] w-[18px] text-red-500" />
        </div>
      );
    case "high":
      // One orange chevron UP
      return <ChevronUp className={cn("h-[18px] w-[18px] text-orange-500", className)} />;
    case "medium":
      // Yellow horizontal line
      return (
        <div className={cn("flex items-center justify-center w-[18px] h-[18px]", className)}>
          <div className="w-3 h-0.5 bg-yellow-500 rounded-full" />
        </div>
      );
    case "low":
    default:
      // Two violet chevrons DOWN stacked (lowest priority)
      return (
        <div className={cn("flex flex-col items-center -space-y-2.5", className)}>
          <ChevronDown className="h-[18px] w-[18px] text-violet-500" />
          <ChevronDown className="h-[18px] w-[18px] text-violet-500" />
        </div>
      );
  }
}

// Export for use in other components
export { PriorityIcon };

function getSprintPrefix(sprint: Sprint): string {
  const leadingDigits = sprint.name.match(/^(\d+)/);
  if (leadingDigits) return leadingDigits[1].padStart(2, "0");
  return sprint.name.replace(/[^A-Z0-9]/gi, "").substring(0, 3).toUpperCase();
}

function getPriorityIcon(priority: string | null | undefined) {
  return <PriorityIcon priority={priority} />;
}

export interface TicketAction {
  type: "move_top" | "move_bottom" | "move_sprint" | "copy" | "delete" | "assign" | "mark_status" | "set_estimate" | "set_priority" | "convert_to_task";
  ticketId: string;
  ticketType: TicketType;
  sprintId?: string | null;
  assigneeId?: string | null;
  state?: string;
  estimatePoints?: number;
  priority?: string;
}

interface TicketRowProps {
  ticket: FlatTicket;
  users?: AppUser[];
  sprints?: Sprint[];
  epics?: Epic[];
  showEpicColumn?: boolean;
  showPriorityColumn?: boolean;
  showAssigneeColumn?: boolean;
  showPointsColumn?: boolean;
  onSelect: (ticket: FlatTicket) => void;
  onUpdateState?: (ticketId: string, type: TicketType, state: string) => void;
  onUpdateField?: (ticketId: string, type: TicketType, field: string, value: any) => void;
  onConvertType?: (ticketId: string, fromType: TicketType, toType: TicketType) => void;
  onTicketAction?: (action: TicketAction) => void;
  isSelected?: boolean;
  isDraggable?: boolean;
  isChecked?: boolean;
  onCheckChange?: (ticketId: string, ticketType: TicketType, checked: boolean) => void;
  showCheckbox?: boolean;
  backlogPrefix?: string;
  ticketGlobalIndex?: number;
}

export function TicketRow({ ticket, users, sprints, epics, showEpicColumn, showPriorityColumn = true, showAssigneeColumn = true, showPointsColumn = true, onSelect, onUpdateState, onUpdateField, onConvertType, onTicketAction, isSelected, isDraggable = true, isChecked = false, onCheckChange, showCheckbox = false, backlogPrefix, ticketGlobalIndex }: TicketRowProps) {
  const typeColor = ticketTypeColor(ticket.type, ticket.color);
  const pastelColors = ticketTypePastelColors(ticket.type, ticket.color);
  const assignee = users?.find(u => u.id === ticket.assigneeId);
  const ticketEpic = epics?.find(e => e.id === ticket.epicId);
  const isCompleted = ticket.state === "termine";
  
  const [pointsPopoverOpen, setPointsPopoverOpen] = useState(false);
  const [priorityPopoverOpen, setPriorityPopoverOpen] = useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [epicPopoverOpen, setEpicPopoverOpen] = useState(false);
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  const [statusHistoryOpen, setStatusHistoryOpen] = useState(false);
  const [statusHistory, setStatusHistory] = useState<StatusPeriod[] | null>(null);
  const statusHoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStatusMouseEnter = async () => {
    statusHoverTimeout.current = setTimeout(async () => {
      setStatusHistoryOpen(true);
      if (statusHistory === null) {
        try {
          const res = await apiRequest(`/api/tickets/${ticket.id}/${ticket.type}/activities`, "GET");
          const data = await res.json();
          setStatusHistory(computeTimeInStatus(data, ticket.createdAt, ticket.state));
        } catch {
          setStatusHistory([]);
        }
      }
    }, 400);
  };

  const handleStatusMouseLeave = () => {
    if (statusHoverTimeout.current) clearTimeout(statusHoverTimeout.current);
    setStatusHistoryOpen(false);
  };
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ticket-${ticket.type}-${ticket.id}`,
    data: { ticket, type: ticket.type },
    disabled: !isDraggable,
  });
  
  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  } : undefined;
  
  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 border-b border-border/50 cursor-pointer transition-colors",
        "hover-elevate",
        isSelected && "bg-primary/5 border-l-2 border-l-primary",
        isChecked && "bg-violet-50 dark:bg-violet-950/20",
        isDragging && "shadow-lg bg-card"
      )}
      onClick={() => onSelect(ticket)}
      data-testid={`ticket-row-${ticket.type}-${ticket.id}`}
    >
      {showCheckbox && (
        <Checkbox
          checked={isChecked}
          onCheckedChange={(checked) => {
            onCheckChange?.(ticket.id, ticket.type, checked === true);
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
          data-testid={`checkbox-ticket-${ticket.id}`}
        />
      )}
      <div {...listeners} {...attributes}>
        <GripVertical className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 cursor-grab" />
      </div>

      {/* Linear-style status icon (left of type icon, opens state dropdown on click) */}
      {onUpdateState ? (
        <Select
          value={ticket.state || "a_faire"}
          onValueChange={(value) => {
            onUpdateState(ticket.id, ticket.type, value);
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <SelectTrigger
                className="h-5 w-5 p-0 !bg-transparent dark:!bg-transparent !border-0 !shadow-none !ring-0 !ring-offset-0 [&>svg:last-child]:hidden hover:opacity-80 focus:outline-none data-[state=open]:!bg-transparent"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                data-testid={`status-icon-trigger-${ticket.id}`}
              >
                <SelectValue>
                  <StatusIcon state={ticket.state} size={14} />
                </SelectValue>
              </SelectTrigger>
            </TooltipTrigger>
            <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
              <p className="text-xs">{getStateLabel(ticket.state)}</p>
            </TooltipContent>
          </Tooltip>
          <SelectContent className="bg-white dark:bg-card">
            {backlogItemStateOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs cursor-pointer">
                <span className="flex items-center gap-2">
                  <StatusIcon state={opt.value} size={14} />
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <div data-testid={`status-icon-${ticket.id}`}>
              <StatusIcon state={ticket.state} size={14} />
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
            <p className="text-xs">{getStateLabel(ticket.state)}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {onConvertType && !isCompleted && ticket.type !== "epic" ? (
        <Popover open={typePopoverOpen} onOpenChange={setTypePopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <div 
                  className="flex items-center justify-center h-5 w-5 rounded flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 dark:!bg-transparent"
                  style={{ backgroundColor: pastelColors.bg }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  data-testid={`ticket-type-selector-${ticket.id}`}
                >
                  <span style={{ color: pastelColors.text }} className="dark:hidden">{ticketTypeIcon(ticket.type)}</span>
                  <span style={{ color: pastelColors.bg }} className="hidden dark:inline">{ticketTypeIcon(ticket.type)}</span>
                </div>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
              <p className="text-xs">Cliquez pour modifier le type</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-36 p-2 bg-white dark:bg-card" align="start" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Type de ticket</p>
              {(["user_story", "task", "bug"] as TicketType[]).map(t => (
                <Button
                  key={t}
                  variant={ticket.type === t ? "default" : "ghost"}
                  size="sm"
                  className="w-full h-6 text-[10px] justify-start gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (t !== ticket.type) {
                      onConvertType(ticket.id, ticket.type, t);
                    }
                    setTypePopoverOpen(false);
                  }}
                  data-testid={`type-option-${ticket.id}-${t}`}
                >
                  <div 
                    className="flex items-center justify-center h-4 w-4 rounded"
                    style={{ backgroundColor: ticketTypeColor(t) }}
                  >
                    <span className="text-white scale-75">{ticketTypeIcon(t)}</span>
                  </div>
                  {t === "user_story" ? "User Story" : t === "task" ? "Task" : "Bug"}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <div 
          className="flex items-center justify-center h-5 w-5 rounded flex-shrink-0 dark:!bg-transparent"
          style={{ backgroundColor: pastelColors.bg }}
        >
          <span style={{ color: pastelColors.text }} className="dark:hidden">{ticketTypeIcon(ticket.type)}</span>
          <span style={{ color: pastelColors.bg }} className="hidden dark:inline">{ticketTypeIcon(ticket.type)}</span>
        </div>
      )}
      
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex-1 min-w-0 truncate text-xs font-medium" data-testid={`ticket-title-${ticket.id}`}>
            {ticket.title}
          </span>
        </TooltipTrigger>
        <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md max-w-sm">
          <p className="text-xs break-words">
            {backlogPrefix && ticketGlobalIndex !== undefined && ticketGlobalIndex >= 0 && (() => {
              const ticketSprint = ticket.sprintId ? sprints?.find(s => s.id === ticket.sprintId) : null;
              const sprintPfx = ticketSprint ? getSprintPrefix(ticketSprint) : "BCK";
              const idxStr = String(ticketGlobalIndex + 1).padStart(2, "0");
              return <span className="font-mono text-muted-foreground mr-1.5">{backlogPrefix}-{sprintPfx}-{idxStr}</span>;
            })()}
            {ticket.title}
          </p>
        </TooltipContent>
      </Tooltip>
      
      {/* Right columns container with larger spacing */}
      <div className="flex items-center gap-4">
      {/* Tag badges (multiple) */}
      {(ticket.tags || []).length > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {(ticket.tags || []).slice(0, 2).map(tag => (
            <Tooltip key={tag}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-cyan-400 text-cyan-600 dark:text-cyan-400 dark:border-cyan-500 max-w-[70px] truncate"
                  data-testid={`ticket-tag-${ticket.id}`}
                >
                  {tag}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
                <p className="text-xs">Tag : {tag}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {(ticket.tags || []).length > 2 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-400 text-cyan-600 dark:text-cyan-400 dark:border-cyan-500">
                  +{(ticket.tags || []).length - 2}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
                <p className="text-xs">{(ticket.tags || []).join(", ")}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
      {/* Inline Points Editor with Tooltip */}
      {showPointsColumn && (onUpdateField ? (
        <Popover open={pointsPopoverOpen} onOpenChange={setPointsPopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-muted"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  data-testid={`ticket-points-${ticket.id}`}
                >
                  {ticket.estimatePoints || "-"}
                </Badge>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
              <p className="text-xs">Cliquez pour modifier les points d'estimation</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-28 p-2 bg-white dark:bg-card" align="center" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Points</p>
              {[0.25, 0.5, 1, 2, 3, 5, 8, 13].map(pts => (
                <Button
                  key={pts}
                  variant={ticket.estimatePoints === pts ? "default" : "ghost"}
                  size="sm"
                  className="w-full h-6 text-[10px] justify-start"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateField(ticket.id, ticket.type, "estimatePoints", pts);
                    setPointsPopoverOpen(false);
                  }}
                >
                  {pts} pts
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0" data-testid={`ticket-points-${ticket.id}`}>
          {ticket.estimatePoints || "-"}
        </Badge>
      ))}
      
      {/* Inline Priority Editor with Tooltip */}
      {showPriorityColumn && (onUpdateField ? (
        <Popover open={priorityPopoverOpen} onOpenChange={setPriorityPopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <div 
                  className="cursor-pointer hover:opacity-80 p-0.5 rounded hover:bg-muted"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  data-testid={`ticket-priority-${ticket.id}`}
                >
                  {getPriorityIcon(ticket.priority)}
                </div>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
              <p className="text-xs">Cliquez pour modifier la priorité</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-36 p-2 bg-white dark:bg-card" align="center" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Priorité</p>
              {backlogPriorityOptions.map(opt => (
                <Button
                  key={opt.value}
                  variant={ticket.priority === opt.value ? "default" : "ghost"}
                  size="sm"
                  className="w-full h-6 text-[10px] justify-start gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateField(ticket.id, ticket.type, "priority", opt.value);
                    setPriorityPopoverOpen(false);
                  }}
                >
                  <PriorityIcon priority={opt.value} className="h-3 w-3" />
                  {opt.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        getPriorityIcon(ticket.priority)
      ))}
      
      {/* Inline Assignee Editor with Tooltip */}
      {showAssigneeColumn && (onUpdateField && !isCompleted ? (
        <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <div 
                  className="cursor-pointer hover:opacity-80"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  data-testid={`ticket-assignee-${ticket.id}`}
                >
                  {assignee ? (
                    <Avatar className="h-6 w-6 ring-2 ring-transparent hover:ring-primary/30 transition-all">
                      <AvatarImage src={assignee.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10">
                        {assignee.firstName?.charAt(0) || assignee.email?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors">
                      <User className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
              <p className="text-xs">Cliquez pour assigner un collaborateur</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-48 p-2 bg-white dark:bg-card max-h-64 overflow-y-auto" align="end" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Assigner à</p>
              <Button
                variant={!ticket.assigneeId ? "default" : "ghost"}
                size="sm"
                className="w-full h-6 text-[10px] justify-start gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateField(ticket.id, ticket.type, "assigneeId", null);
                  setAssigneePopoverOpen(false);
                }}
              >
                <User className="h-3 w-3" />
                Non assigné
              </Button>
              {users?.map(user => (
                <Button
                  key={user.id}
                  variant={ticket.assigneeId === user.id ? "default" : "ghost"}
                  size="sm"
                  className="w-full h-6 text-[10px] justify-start gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateField(ticket.id, ticket.type, "assigneeId", user.id);
                    setAssigneePopoverOpen(false);
                  }}
                >
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={user.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {user.firstName?.charAt(0) || user.email?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">
                    {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                  </span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        assignee ? (
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs bg-primary/10">
              {assignee.firstName?.charAt(0) || assignee.email?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
            <User className="h-3 w-3 text-muted-foreground/50" />
          </div>
        )
      ))}
      
      {/* Inline Epic Editor */}
      {showEpicColumn && ticket.type !== "epic" && onUpdateField ? (
        <Popover open={epicPopoverOpen} onOpenChange={setEpicPopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <div 
                  className="cursor-pointer hover:opacity-80 min-w-[80px]"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  data-testid={`ticket-epic-${ticket.id}`}
                >
                  {ticketEpic ? (
                    <Badge 
                      variant="outline" 
                      className="text-[10px] px-1 py-0 bg-white dark:bg-card border truncate max-w-[80px]"
                      style={{ borderColor: ticketEpic.color || "#8B5CF6" }}
                    >
                      <div 
                        className="h-1.5 w-1.5 rounded-full mr-1 flex-shrink-0" 
                        style={{ backgroundColor: ticketEpic.color || "#8B5CF6" }}
                      />
                      <span className="truncate">{ticketEpic.title}</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white dark:bg-card text-muted-foreground">
                      <Layers className="h-2.5 w-2.5 mr-0.5" />
                      Aucun
                    </Badge>
                  )}
                </div>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
              <p className="text-xs">Cliquez pour modifier l'Epic</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-48 p-2 bg-white dark:bg-card max-h-64 overflow-y-auto" align="end" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Epic</p>
              <Button
                variant={!ticket.epicId ? "default" : "ghost"}
                size="sm"
                className="w-full h-6 text-[10px] justify-start gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateField(ticket.id, ticket.type, "epicId", null);
                  setEpicPopoverOpen(false);
                }}
              >
                <Layers className="h-3 w-3" />
                Aucun
              </Button>
              {epics?.map(epic => (
                <Button
                  key={epic.id}
                  variant={ticket.epicId === epic.id ? "default" : "ghost"}
                  size="sm"
                  className="w-full h-6 text-[10px] justify-start gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateField(ticket.id, ticket.type, "epicId", epic.id);
                    setEpicPopoverOpen(false);
                  }}
                >
                  <div 
                    className="h-2 w-2 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: epic.color || "#8B5CF6" }}
                  />
                  <span className="truncate text-[10px]">{epic.title}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : showEpicColumn && ticket.type !== "epic" ? (
        ticketEpic ? (
          <Badge 
            variant="outline" 
            className="text-[10px] px-1 py-0 truncate max-w-[80px]"
            style={{ borderColor: ticketEpic.color || "#8B5CF6" }}
          >
            <div 
              className="h-1.5 w-1.5 rounded-full mr-1 flex-shrink-0" 
              style={{ backgroundColor: ticketEpic.color || "#8B5CF6" }}
            />
            <span className="truncate">{ticketEpic.title}</span>
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
            <Layers className="h-2.5 w-2.5 mr-0.5" />
            -
          </Badge>
        )
      ) : null}
      
      {/* Inline Status Dropdown with time-in-status hover */}
      <div
        className="relative"
        onMouseEnter={handleStatusMouseEnter}
        onMouseLeave={handleStatusMouseLeave}
        onClick={(e) => e.stopPropagation()}
      >
        {statusHistoryOpen && (
          <div
            className="absolute bottom-full right-0 mb-1.5 z-50 bg-white dark:bg-gray-900 border border-border rounded-md shadow-lg p-2.5 min-w-[160px]"
            onMouseEnter={() => { if (statusHoverTimeout.current) clearTimeout(statusHoverTimeout.current); setStatusHistoryOpen(true); }}
            onMouseLeave={handleStatusMouseLeave}
          >
            <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-border/50">
              <Timer className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold text-foreground">Temps par état</span>
            </div>
            {statusHistory === null ? (
              <p className="text-[10px] text-muted-foreground">Chargement...</p>
            ) : statusHistory.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">Aucun historique</p>
            ) : (
              <div className="space-y-1">
                {statusHistory.map(({ state, durationMs }) => (
                  <div key={state} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", getStateDot(state))} />
                      <span className="text-[10px] text-muted-foreground">{getStateLabel(state)}</span>
                    </div>
                    <span className="text-[10px] font-medium text-foreground tabular-nums">{formatDuration(durationMs)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </div>
      {/* End of right columns container */}
      
      {/* Actions Menu */}
      {onTicketAction && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              data-testid={`button-ticket-menu-${ticket.id}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-card w-48">
            {/* Move submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-foreground">
                <ArrowUp className="h-4 w-4 mr-2" />
                Déplacer
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-white dark:bg-card">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onTicketAction({ type: "move_top", ticketId: ticket.id, ticketType: ticket.type });
                  }}
                  className="text-foreground"
                >
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Haut du backlog
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onTicketAction({ type: "move_bottom", ticketId: ticket.id, ticketType: ticket.type });
                  }}
                  className="text-foreground"
                >
                  <ArrowDown className="h-4 w-4 mr-2" />
                  Bas du backlog
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {sprints?.filter(s => s.status !== "termine").map(sprint => (
                  <DropdownMenuItem 
                    key={sprint.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTicketAction({ type: "move_sprint", ticketId: ticket.id, ticketType: ticket.type, sprintId: sprint.id });
                    }}
                    className="text-foreground"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {sprint.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onTicketAction({ type: "move_sprint", ticketId: ticket.id, ticketType: ticket.type, sprintId: null });
                  }}
                  className="text-foreground"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Backlog
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            {/* Copy */}
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                onTicketAction({ type: "copy", ticketId: ticket.id, ticketType: ticket.type });
              }}
              className="text-foreground"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copier
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            {/* Assign submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-foreground">
                <UserPlus className="h-4 w-4 mr-2" />
                Assigner à
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-white dark:bg-card">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onTicketAction({ type: "assign", ticketId: ticket.id, ticketType: ticket.type, assigneeId: null });
                  }}
                  className="text-foreground"
                >
                  <User className="h-4 w-4 mr-2" />
                  Non assigné
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {users?.map(user => (
                  <DropdownMenuItem 
                    key={user.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTicketAction({ type: "assign", ticketId: ticket.id, ticketType: ticket.type, assigneeId: user.id });
                    }}
                    className="text-foreground"
                  >
                    <Avatar className="h-4 w-4 mr-2">
                      <AvatarFallback className="text-[8px]">
                        {user.firstName?.charAt(0) || user.email?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            {/* Mark status submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-foreground">
                <Check className="h-4 w-4 mr-2" />
                Marquer comme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-white dark:bg-card">
                {backlogItemStateOptions.map(opt => (
                  <DropdownMenuItem 
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTicketAction({ type: "mark_status", ticketId: ticket.id, ticketType: ticket.type, state: opt.value });
                    }}
                    className="text-foreground"
                  >
                    <span className={cn("w-2 h-2 rounded-full mr-2", getStateDot(opt.value))} />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            {/* Estimate points submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-foreground">
                <Hash className="h-4 w-4 mr-2" />
                Points d'estimation
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-white dark:bg-card">
                {[0, 0.25, 0.5, 1, 2, 3, 5, 8, 13, 21].map(points => (
                  <DropdownMenuItem 
                    key={points}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTicketAction({ type: "set_estimate", ticketId: ticket.id, ticketType: ticket.type, estimatePoints: points });
                    }}
                    className="text-foreground"
                  >
                    <Badge variant="outline" className="text-xs mr-2">{points}</Badge>
                    {points === 0 ? "Sans estimation" : `${points} point${points > 1 ? "s" : ""}`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            {/* Priority submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-foreground">
                <Flag className="h-4 w-4 mr-2" />
                Priorité
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-white dark:bg-card">
                {backlogPriorityOptions.map(opt => (
                  <DropdownMenuItem 
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTicketAction({ type: "set_priority", ticketId: ticket.id, ticketType: ticket.type, priority: opt.value });
                    }}
                    className="text-foreground"
                  >
                    <span className="mr-2"><PriorityIcon priority={opt.value} /></span>
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            <DropdownMenuSeparator />
            
            {/* Convert to Task (only for task type) */}
            {ticket.type === "task" && (
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  onTicketAction({ type: "convert_to_task", ticketId: ticket.id, ticketType: ticket.type });
                }}
                className="text-foreground"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ajouter dans les Tâches
              </DropdownMenuItem>
            )}
            
            {/* Delete */}
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                onTicketAction({ type: "delete", ticketId: ticket.id, ticketType: ticket.type });
              }}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// Bulk action types
export interface BulkAction {
  type: "bulk_change_state" | "bulk_change_priority" | "bulk_assign" | "bulk_set_estimate" | "bulk_link_epic" | "bulk_move_sprint" | "bulk_move_backlog" | "bulk_set_version" | "bulk_delete";
  ticketIds: { id: string; type: TicketType }[];
  state?: string;
  priority?: string;
  assigneeId?: string | null;
  estimatePoints?: number;
  epicId?: string | null;
  sprintId?: string | null;
  version?: string | null;
}

// Bulk Actions Dropdown Component
interface BulkActionsDropdownProps {
  selectedCount: number;
  users?: AppUser[];
  sprints?: Sprint[];
  epics?: Epic[];
  onBulkAction: (action: BulkAction) => void;
  selectedTickets: { id: string; type: TicketType }[];
  onClearSelection: () => void;
}

function BulkActionsDropdown({ 
  selectedCount, 
  users, 
  sprints, 
  epics, 
  onBulkAction, 
  selectedTickets,
  onClearSelection 
}: BulkActionsDropdownProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-violet-100 dark:bg-violet-950/50 border-b border-violet-200 dark:border-violet-800">
      <Badge variant="secondary" className="bg-violet-600 text-white">
        {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
      </Badge>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 gap-1" data-testid="button-bulk-actions">
            <MoreHorizontal className="h-4 w-4" />
            Actions
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-white dark:bg-card text-xs" align="start">
          {/* Change State */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-foreground text-xs">
              <Check className="h-3.5 w-3.5 mr-2 shrink-0" />
              Changer l'étape
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-card text-xs">
              {backlogItemStateOptions.map(opt => (
                <DropdownMenuItem 
                  key={opt.value}
                  onClick={() => onBulkAction({ type: "bulk_change_state", ticketIds: selectedTickets, state: opt.value })}
                  className="text-foreground text-xs"
                  data-testid={`bulk-action-state-${opt.value}`}
                >
                  <span className={cn("w-2 h-2 rounded-full mr-2 shrink-0", getStateDot(opt.value))} />
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {/* Change Priority */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-foreground text-xs">
              <Flag className="h-3.5 w-3.5 mr-2 shrink-0" />
              Changer la priorité
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-card text-xs">
              {backlogPriorityOptions.map(opt => (
                <DropdownMenuItem 
                  key={opt.value}
                  onClick={() => onBulkAction({ type: "bulk_change_priority", ticketIds: selectedTickets, priority: opt.value })}
                  className="text-foreground text-xs"
                  data-testid={`bulk-action-priority-${opt.value}`}
                >
                  <span className="mr-2 shrink-0"><PriorityIcon priority={opt.value} /></span>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {/* Assign to */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-foreground text-xs">
              <UserPlus className="h-3.5 w-3.5 mr-2 shrink-0" />
              Assigner à
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-card max-h-[300px] overflow-y-auto text-xs">
              <DropdownMenuItem 
                onClick={() => onBulkAction({ type: "bulk_assign", ticketIds: selectedTickets, assigneeId: null })}
                className="text-foreground text-xs"
                data-testid="bulk-action-unassign"
              >
                <User className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                Non assigné
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {users?.map(user => (
                <DropdownMenuItem 
                  key={user.id}
                  onClick={() => onBulkAction({ type: "bulk_assign", ticketIds: selectedTickets, assigneeId: user.id })}
                  className="text-foreground text-xs"
                  data-testid={`bulk-action-assign-${user.id}`}
                >
                  <Avatar className="h-4 w-4 mr-2 shrink-0">
                    <AvatarFallback className="text-[8px]">
                      {user.firstName?.charAt(0) || user.email?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {/* Set Estimate Points */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-foreground text-xs">
              <Hash className="h-3.5 w-3.5 mr-2 shrink-0" />
              Ajouter un estimate point
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-card text-xs">
              {[0, 0.25, 0.5, 1, 2, 3, 5, 8, 13, 21].map(points => (
                <DropdownMenuItem 
                  key={points}
                  onClick={() => onBulkAction({ type: "bulk_set_estimate", ticketIds: selectedTickets, estimatePoints: points })}
                  className="text-foreground text-xs"
                  data-testid={`bulk-action-estimate-${points}`}
                >
                  <Badge variant="outline" className="text-xs mr-2">{points}</Badge>
                  {points === 0 ? "Sans estimation" : `${points} point${points > 1 ? "s" : ""}`}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {/* Link to Epic */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-foreground text-xs">
              <Link2 className="h-3.5 w-3.5 mr-2 shrink-0" />
              Lier à l'Epic
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-card max-h-[300px] overflow-y-auto text-xs">
              <DropdownMenuItem 
                onClick={() => onBulkAction({ type: "bulk_link_epic", ticketIds: selectedTickets, epicId: null })}
                className="text-foreground text-xs"
                data-testid="bulk-action-unlink-epic"
              >
                <Layers className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                Aucun Epic
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {epics?.map(epic => (
                <DropdownMenuItem 
                  key={epic.id}
                  onClick={() => onBulkAction({ type: "bulk_link_epic", ticketIds: selectedTickets, epicId: epic.id })}
                  className="text-foreground text-xs"
                  data-testid={`bulk-action-epic-${epic.id}`}
                >
                  <div 
                    className="h-3 w-3 rounded mr-2 shrink-0" 
                    style={{ backgroundColor: epic.color || "#8B5CF6" }}
                  />
                  {epic.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {/* Move to Sprint */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-foreground text-xs">
              <Play className="h-3.5 w-3.5 mr-2 shrink-0" />
              Déplacer vers le sprint
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-card max-h-[300px] overflow-y-auto text-xs">
              {sprints?.filter(s => s.status !== "termine").map(sprint => (
                <DropdownMenuItem 
                  key={sprint.id}
                  onClick={() => onBulkAction({ type: "bulk_move_sprint", ticketIds: selectedTickets, sprintId: sprint.id })}
                  className="text-foreground text-xs"
                  data-testid={`bulk-action-sprint-${sprint.id}`}
                >
                  <Calendar className="h-3.5 w-3.5 mr-2 shrink-0" />
                  {sprint.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {/* Move to Backlog */}
          <DropdownMenuItem 
            onClick={() => onBulkAction({ type: "bulk_move_backlog", ticketIds: selectedTickets })}
            className="text-foreground text-xs"
            data-testid="bulk-action-move-backlog"
          >
            <AlertCircle className="h-3.5 w-3.5 mr-2 shrink-0" />
            Déplacer vers le backlog
          </DropdownMenuItem>
          
          {/* Set Version */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-foreground text-xs">
              <Tag className="h-3.5 w-3.5 mr-2 shrink-0" />
              Définir la version
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-card">
              <DropdownMenuItem 
                onClick={() => onBulkAction({ type: "bulk_set_version", ticketIds: selectedTickets, version: null })}
                className="text-foreground text-xs"
                data-testid="bulk-action-remove-version"
              >
                <X className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                Aucune version
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {["1.0.0", "1.1.0", "1.2.0", "2.0.0", "MVP", "Beta", "Alpha"].map(version => (
                <DropdownMenuItem 
                  key={version}
                  onClick={() => onBulkAction({ type: "bulk_set_version", ticketIds: selectedTickets, version })}
                  className="text-foreground text-xs"
                  data-testid={`bulk-action-version-${version}`}
                >
                  <Badge variant="outline" className="text-xs mr-2">{version}</Badge>
                  {version}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuSeparator />
          
          {/* Delete */}
          <DropdownMenuItem 
            onClick={() => onBulkAction({ type: "bulk_delete", ticketIds: selectedTickets })}
            className="text-red-600 text-xs"
            data-testid="bulk-action-delete"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2 shrink-0" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Button 
        size="sm" 
        variant="ghost" 
        className="h-7 text-xs" 
        onClick={onClearSelection}
        data-testid="button-clear-selection"
      >
        Désélectionner
      </Button>
    </div>
  );
}

// ─── Mobile Ticket Row (compact, tap to open sheet) ─────────────────────────
function MobileTicketRow({
  ticket,
  users,
  epics,
  backlogPrefix,
  ticketGlobalIndex,
  sprints,
  onMobileSelect,
}: {
  ticket: FlatTicket;
  users?: AppUser[];
  epics?: Epic[];
  sprints?: Sprint[];
  backlogPrefix?: string;
  ticketGlobalIndex?: number;
  onMobileSelect: (ticket: FlatTicket) => void;
}) {
  const pastelColors = ticketTypePastelColors(ticket.type, ticket.color);
  const assignee = users?.find(u => u.id === ticket.assigneeId);
  const ticketEpic = epics?.find(e => e.id === ticket.epicId);
  const ticketSprint = sprints?.find(s => s.id === ticket.sprintId);
  const statusOption = backlogItemStateOptions.find(s => s.value === ticket.state);
  const priorityOption = backlogPriorityOptions.find(p => p.value === ticket.priority);
  const isCompleted = ticket.state === "termine";

  const rowSprintPfx = ticketSprint ? getSprintPrefix(ticketSprint) : "BCK";
  const rowIdxStr = ticketGlobalIndex !== undefined && ticketGlobalIndex >= 0
    ? String(ticketGlobalIndex + 1).padStart(2, "0")
    : null;
  const rowTicketId = backlogPrefix && rowIdxStr ? `${backlogPrefix}-${rowSprintPfx}-${rowIdxStr}` : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 border-b border-border/40 active:bg-muted/30 transition-colors cursor-pointer",
        isCompleted && "opacity-60"
      )}
      onClick={() => onMobileSelect(ticket)}
      data-testid={`mobile-ticket-row-${ticket.id}`}
    >
      {/* Type icon */}
      <div
        className="flex items-center justify-center h-6 w-6 rounded flex-shrink-0"
        style={{ backgroundColor: pastelColors.bg }}
      >
        <span style={{ color: pastelColors.text, fontSize: "0.65rem" }}>
          {ticketTypeIcon(ticket.type)}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium leading-tight truncate",
          isCompleted && "line-through text-muted-foreground"
        )}>
          {ticket.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
          {statusOption && (
            <span className="text-[10px] text-muted-foreground bg-muted/60 rounded px-1 py-0 flex-shrink-0">
              {statusOption.label}
            </span>
          )}
          {ticket.priority && priorityOption && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
              <Flag className="h-2.5 w-2.5" />
              {priorityOption.label}
            </span>
          )}
          {ticketEpic && (
            <span
              className="text-[10px] px-1 py-0 rounded text-white max-w-[100px] inline-block truncate flex-shrink"
              style={{ backgroundColor: ticketEpic.color || "#7C3AED" }}
              title={ticketEpic.title}
            >
              {ticketEpic.title}
            </span>
          )}
        </div>
      </div>

      {/* Assignee */}
      <div className="flex items-center flex-shrink-0">
        {assignee ? (
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
              {assignee.firstName?.[0]}{assignee.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center">
            <User className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
      </div>
    </div>
  );
}

// ─── Mobile Ticket Detail Sheet (bottom drawer) ──────────────────────────────
function MobileTicketSheet({
  ticket,
  open,
  onClose,
  users,
  epics,
  sprints,
  backlogPrefix,
  ticketGlobalIndex,
  onUpdateState,
  onUpdateField,
  onSelectTicket,
}: {
  ticket: FlatTicket | null;
  open: boolean;
  onClose: () => void;
  users?: AppUser[];
  epics?: Epic[];
  sprints?: Sprint[];
  backlogPrefix?: string;
  ticketGlobalIndex?: number;
  onUpdateState?: (ticketId: string, type: TicketType, state: string) => void;
  onUpdateField?: (ticketId: string, type: TicketType, field: string, value: any) => void;
  onSelectTicket: (ticket: FlatTicket) => void;
}) {
  if (!ticket) return null;

  const typeColor = ticketTypeColor(ticket.type, ticket.color);
  const pastelColors = ticketTypePastelColors(ticket.type, ticket.color);
  const assignee = users?.find(u => u.id === ticket.assigneeId);
  const ticketEpic = epics?.find(e => e.id === ticket.epicId);
  const ticketSprint = sprints?.find(s => s.id === ticket.sprintId);
  const statusOption = backlogItemStateOptions.find(s => s.value === ticket.state);
  const priorityOption = backlogPriorityOptions.find(p => p.value === ticket.priority);

  const sprintPfx = ticketSprint ? getSprintPrefix(ticketSprint) : "BCK";
  const idxStr = ticketGlobalIndex !== undefined && ticketGlobalIndex >= 0
    ? String(ticketGlobalIndex + 1).padStart(2, "0")
    : null;
  const ticketId = backlogPrefix && idxStr ? `${backlogPrefix}-${sprintPfx}-${idxStr}` : null;

  const infoRow = (label: string, content: ReactNode) => (
    <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-b-0">
      <span className="text-xs text-muted-foreground w-24 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{content}</div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="inset-0 h-full rounded-none p-0 flex flex-col overflow-hidden [&>button]:hidden z-[9999]">

        {/* Top bar: type icon + ticket ID + Détail + Close */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b flex-shrink-0">
          <div
            className="flex items-center justify-center h-6 w-6 rounded flex-shrink-0"
            style={{ backgroundColor: pastelColors.bg }}
          >
            <span style={{ color: pastelColors.text, fontSize: "0.65rem" }}>
              {ticketTypeIcon(ticket.type)}
            </span>
          </div>
          {ticketId && (
            <span className="text-xs font-mono text-muted-foreground">{ticketId}</span>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => { onClose(); onSelectTicket(ticket); }}
            data-testid="button-mobile-sheet-open-full"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Détail
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            data-testid="button-mobile-sheet-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Title + Description at the top */}
          <div className="px-4 pt-4 pb-4 border-b border-border/40">
            <SheetTitle className="text-left text-lg font-semibold leading-snug mb-0">
              {ticket.title}
            </SheetTitle>
            {ticket.description && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap">
                {ticket.description}
              </p>
            )}
          </div>

          {/* Quick state + priority + points */}
          <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-border/40">
            <Select
              value={ticket.state}
              onValueChange={(val) => onUpdateState?.(ticket.id, ticket.type, val)}
            >
              <SelectTrigger className="w-auto h-8 text-xs gap-1" data-testid={`mobile-status-select-${ticket.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-card">
                {backlogItemStateOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {ticket.priority && (
              <Badge variant="outline" className="text-xs h-8 px-2">
                <Flag className="h-3 w-3 mr-1" />
                {priorityOption?.label ?? ticket.priority}
              </Badge>
            )}
            {ticket.estimatePoints != null && (
              <Badge variant="outline" className="text-xs h-8 px-2 font-mono">
                {ticket.estimatePoints} pts
              </Badge>
            )}
          </div>

          {/* Info rows */}
          <div className="px-4">
            {infoRow("Assigné à", assignee ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                    {assignee.firstName?.[0]}{assignee.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{assignee.firstName} {assignee.lastName}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Non assigné</span>
            ))}

            {ticketEpic && infoRow("Epic", (
              <span
                className="text-xs px-2 py-1 rounded text-white inline-block"
                style={{ backgroundColor: ticketEpic.color || "#7C3AED" }}
              >
                {ticketEpic.title}
              </span>
            ))}

            {ticketSprint && infoRow("Sprint", (
              <span className="text-sm">{ticketSprint.name}</span>
            ))}

            {ticket.createdAt && infoRow("Créé le", (
              <span className="text-sm text-muted-foreground">
                {new Date(ticket.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface SprintSectionProps {
  sprint: Sprint;
  tickets: FlatTicket[];
  users?: AppUser[];
  sprints?: Sprint[];
  epics?: Epic[];
  roadmapItems?: RoadmapItem[];
  showEpicColumn?: boolean;
  showPriorityColumn?: boolean;
  showAssigneeColumn?: boolean;
  showPointsColumn?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectTicket: (ticket: FlatTicket) => void;
  onCreateTicket: (sprintId: string, type: TicketType, title: string) => void;
  onStartSprint?: (sprintId: string) => void;
  onCompleteSprint?: (sprintId: string) => void;
  onEditSprint?: (sprint: Sprint) => void;
  onDeleteSprint?: (sprintId: string) => void;
  onUpdateState?: (ticketId: string, type: TicketType, state: string) => void;
  onUpdateField?: (ticketId: string, type: TicketType, field: string, value: any) => void;
  onConvertType?: (ticketId: string, fromType: TicketType, toType: TicketType) => void;
  onTicketAction?: (action: TicketAction) => void;
  selectedTicketId?: string | null;
  onMoveSprintUp?: (sprintId: string) => void;
  onMoveSprintDown?: (sprintId: string) => void;
  isFirstSprint?: boolean;
  isLastSprint?: boolean;
  checkedTickets?: Set<string>;
  onCheckChange?: (ticketId: string, ticketType: TicketType, checked: boolean) => void;
  onBulkAction?: (action: BulkAction) => void;
  onClearSelection?: () => void;
  backlogPrefix?: string;
  ticketIndexMap?: Record<string, number>;
  viewMode?: "list" | "board";
  hideEmptyStatusColumns?: boolean;
}

export function SprintSection({ 
  sprint, 
  tickets, 
  users,
  sprints,
  epics,
  roadmapItems,
  showEpicColumn,
  showPriorityColumn,
  showAssigneeColumn,
  showPointsColumn,
  isExpanded, 
  onToggle, 
  onSelectTicket, 
  onCreateTicket,
  onStartSprint,
  onCompleteSprint,
  onEditSprint,
  onDeleteSprint,
  onUpdateState,
  onUpdateField,
  onConvertType,
  onTicketAction,
  selectedTicketId,
  onMoveSprintUp,
  onMoveSprintDown,
  isFirstSprint,
  isLastSprint,
  checkedTickets,
  onCheckChange,
  onBulkAction,
  onClearSelection,
  backlogPrefix,
  ticketIndexMap,
  viewMode = "list",
  hideEmptyStatusColumns = false,
}: SprintSectionProps) {
  const { t } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketType, setNewTicketType] = useState<TicketType>("user_story");
  const [mobileSelectedTicket, setMobileSelectedTicket] = useState<FlatTicket | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const totalPoints = tickets.reduce((sum, t) => sum + (t.estimatePoints || 0), 0);
  const donePoints = tickets
    .filter(t => t.state === "termine")
    .reduce((sum, t) => sum + (t.estimatePoints || 0), 0);
  const doneTickets = tickets.filter(t => t.state === "termine").length;
  
  // Check if sprint has a temporary ID (not yet saved to database)
  const isTemporarySprint = sprint.id.startsWith("temp-");
  
  const handleCreate = () => {
    if (newTicketTitle.trim() && !isTemporarySprint) {
      onCreateTicket(sprint.id, newTicketType, newTicketTitle.trim());
      setNewTicketTitle("");
      setIsCreating(false);
    }
  };
  
  const statusColor = sprint.status === "en_cours" ? "text-blue-500" :
                      sprint.status === "termine" ? "text-green-500" : "text-gray-500";
  const statusLabel = sprint.status === "en_cours" ? "En cours" :
                      sprint.status === "termine" ? "Terminé" : "En préparation";
  
  // Find linked roadmap item
  const linkedRoadmapItem = roadmapItems?.find(item => item.id === (sprint as any).roadmapItemId);
  
  const { isOver, setNodeRef } = useDroppable({
    id: `sprint-${sprint.id}`,
    data: { type: "sprint", sprintId: sprint.id },
  });
  
  return (
    <>
    {/* ── Mobile ticket sheet (bottom drawer) ── */}
    <div className="md:hidden">
      <MobileTicketSheet
        ticket={mobileSelectedTicket}
        open={mobileSheetOpen}
        onClose={() => { setMobileSheetOpen(false); setMobileSelectedTicket(null); }}
        users={users}
        epics={epics}
        sprints={sprints}
        backlogPrefix={backlogPrefix}
        ticketGlobalIndex={mobileSelectedTicket ? ticketIndexMap?.[mobileSelectedTicket.id] : undefined}
        onUpdateState={onUpdateState}
        onUpdateField={onUpdateField}
        onSelectTicket={(t) => { setMobileSheetOpen(false); setMobileSelectedTicket(null); onSelectTicket(t); }}
      />
    </div>

    {/* ── Mobile sprint view ── */}
    <div className="md:hidden w-full max-w-full border rounded-lg overflow-hidden bg-card" data-testid={`sprint-section-mobile-${sprint.id}`}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        {/* Mobile sprint header */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 dark:bg-violet-950/30 cursor-pointer active:bg-violet-100 dark:active:bg-violet-950/50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-sm truncate">{sprint.name}</span>
                <Badge variant="outline" className={cn("text-[10px] px-1.5 flex-shrink-0 whitespace-nowrap", statusColor)}>
                  {statusLabel}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted-foreground">
                  {doneTickets}/{tickets.length} tickets · {donePoints}/{totalPoints} pts
                </span>
                {tickets.length > 0 && (
                  <div className="flex-1 max-w-[80px]">
                    <Progress value={(doneTickets / tickets.length) * 100} className="h-1" />
                  </div>
                )}
              </div>
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {tickets.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Ce sprint est vide
            </div>
          ) : (
            tickets.map((ticket) => (
              <MobileTicketRow
                key={ticket.id}
                ticket={ticket}
                users={users}
                epics={epics}
                sprints={sprints}
                backlogPrefix={backlogPrefix}
                ticketGlobalIndex={ticketIndexMap?.[ticket.id]}
                onMobileSelect={(t) => { setMobileSelectedTicket(t); setMobileSheetOpen(true); }}
              />
            ))
          )}
          {/* Mobile create ticket button */}
          {!isTemporarySprint && (
            <button
              className="w-full px-4 py-3 text-sm text-muted-foreground flex items-center gap-2 border-t border-border/40"
              onClick={() => setIsCreating(true)}
              data-testid={`button-mobile-create-ticket-${sprint.id}`}
            >
              <Plus className="h-4 w-4" />
              Créer un ticket
            </button>
          )}
          {isCreating && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-t">
              <Input
                value={newTicketTitle}
                onChange={(e) => setNewTicketTitle(e.target.value)}
                placeholder={t.common.ph.ticketTitle}
                className="flex-1 h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setIsCreating(false);
                }}
              />
              <Button size="sm" className="h-8" onClick={handleCreate}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setIsCreating(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>

    {/* ── Desktop sprint view (unchanged) ── */}
    <Collapsible open={isExpanded} onOpenChange={onToggle} className="hidden md:block">
      <div 
        ref={setNodeRef}
        className={cn(
          "border rounded-lg overflow-hidden bg-card transition-colors",
          isOver && "ring-2 ring-primary bg-primary/5"
        )} 
        data-testid={`sprint-section-${sprint.id}`}
      >
        <div className="flex items-center gap-3 px-4 py-1.5 bg-[#ECECF0] dark:bg-[#1A1B22] border-b">
          {/* Select all checkbox for this sprint */}
          {checkedTickets && onCheckChange && tickets.length > 0 && (
            <Checkbox
              checked={tickets.length > 0 && tickets.every(t => checkedTickets.has(t.id))}
              onCheckedChange={(checked) => {
                tickets.forEach(t => onCheckChange(t.id, t.type, !!checked));
              }}
              data-testid={`checkbox-select-all-sprint-${sprint.id}`}
              className="h-4 w-4"
            />
          )}
          
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-toggle-sprint-${sprint.id}`}>
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs font-semibold cursor-default" data-testid={`sprint-name-${sprint.id}`}>
                {sprint.name}
              </span>
            </TooltipTrigger>
            {sprint.identifier && (
              <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
                <p className="text-xs font-mono">{sprint.identifier}</p>
              </TooltipContent>
            )}
          </Tooltip>
          
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusColor)}>
            {statusLabel}
          </Badge>
          
          {linkedRoadmapItem && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  className="text-xs cursor-default px-1.5"
                  style={{ backgroundColor: linkedRoadmapItem.color || '#7C3AED' }}
                  data-testid={`badge-roadmap-link-${sprint.id}`}
                >
                  <Link2 className="h-3 w-3" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
                <p className="text-xs font-medium">{linkedRoadmapItem.title}</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {sprint.startDate && sprint.endDate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(sprint.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              {" - "}
              {new Date(sprint.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </span>
          )}
          
          {/* Assignee avatars for sprint members */}
          {(() => {
            const assigneeIds = Array.from(new Set(tickets.map(t => t.assigneeId).filter(Boolean))) as string[];
            const assignees = assigneeIds.map(id => users?.find(u => u.id === id)).filter(Boolean);
            if (assignees.length === 0) return null;
            const maxShown = 5;
            const shown = assignees.slice(0, maxShown);
            const extra = assignees.length - maxShown;
            return (
              <div className="flex items-center">
                {shown.map((user, i) => (
                  <Tooltip key={user!.id}>
                    <TooltipTrigger asChild>
                      <Avatar
                        className="h-6 w-6 ring-2 ring-card"
                        style={{ marginLeft: i > 0 ? "-8px" : "0" }}
                      >
                        <AvatarFallback className="text-[9px] bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-200">
                          {user!.firstName?.charAt(0) || user!.email?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
                      <p className="text-xs">
                        {user!.firstName && user!.lastName
                          ? `${user!.firstName} ${user!.lastName}`
                          : user!.email}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {extra > 0 && (
                  <Avatar className="h-6 w-6 ring-2 ring-card" style={{ marginLeft: "-8px" }}>
                    <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                      +{extra}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })()}
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {doneTickets}/{tickets.length} tickets | {donePoints}/{totalPoints} pts
            </span>
            <div className="w-24">
              <Progress 
                value={tickets.length > 0 ? (doneTickets / tickets.length) * 100 : 0} 
                className="h-2"
              />
            </div>
          </div>
          
          {!isTemporarySprint && (
            <Button
              size="icon"
              variant="outline"
              onClick={() => setIsCreating(true)}
              className="border-primary text-primary h-7 w-7"
              data-testid={`button-add-ticket-header-${sprint.id}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          
          {sprint.status === "preparation" && onStartSprint && !isTemporarySprint && (
            <Button 
              size="sm" 
              onClick={() => onStartSprint(sprint.id)}
              className="bg-violet-600 hover:bg-violet-700 text-white text-[11px] h-7 px-2"
              data-testid={`button-start-sprint-${sprint.id}`}
            >
              <Play className="h-3 w-3 mr-1" />
              Démarrer
            </Button>
          )}
          
          {sprint.status === "en_cours" && onCompleteSprint && !isTemporarySprint && (
            <Button 
              size="sm" 
              onClick={() => onCompleteSprint(sprint.id)}
              className="bg-violet-600 hover:bg-violet-700 text-white text-[11px] h-7 px-2"
              data-testid={`button-complete-sprint-${sprint.id}`}
            >
              <Check className="h-3 w-3 mr-1" />
              Terminer le sprint
            </Button>
          )}
          
          {isTemporarySprint && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Enregistrement...
            </Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-menu-sprint-${sprint.id}`} disabled={isTemporarySprint}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-card">
              <DropdownMenuItem onClick={() => setIsCreating(true)} className="text-foreground text-xs">
                <Plus className="h-3.5 w-3.5 mr-2" />
                Créer un ticket
              </DropdownMenuItem>
              {onEditSprint && (
                <DropdownMenuItem onClick={() => onEditSprint(sprint)} className="text-foreground text-xs" data-testid={`button-edit-sprint-${sprint.id}`}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Modifier le sprint
                </DropdownMenuItem>
              )}
              {(onMoveSprintUp || onMoveSprintDown) && (
                <>
                  <DropdownMenuSeparator />
                  {onMoveSprintUp && !isFirstSprint && (
                    <DropdownMenuItem 
                      onClick={() => onMoveSprintUp(sprint.id)} 
                      className="text-foreground text-xs"
                      data-testid={`button-move-sprint-up-${sprint.id}`}
                    >
                      <ArrowUp className="h-3.5 w-3.5 mr-2" />
                      Déplacer vers le haut
                    </DropdownMenuItem>
                  )}
                  {onMoveSprintDown && !isLastSprint && (
                    <DropdownMenuItem 
                      onClick={() => onMoveSprintDown(sprint.id)} 
                      className="text-foreground text-xs"
                      data-testid={`button-move-sprint-down-${sprint.id}`}
                    >
                      <ArrowDown className="h-3.5 w-3.5 mr-2" />
                      Déplacer vers le bas
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {onDeleteSprint && sprint.status !== "en_cours" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => onDeleteSprint(sprint.id)} 
                    className="text-red-600 text-xs"
                    data-testid={`button-delete-sprint-${sprint.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Supprimer le sprint
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <CollapsibleContent>
          {/* Bulk Actions Bar */}
          {checkedTickets && onBulkAction && onClearSelection && (
            <BulkActionsDropdown
              selectedCount={tickets.filter(t => checkedTickets.has(t.id)).length}
              users={users}
              sprints={sprints}
              epics={epics}
              onBulkAction={onBulkAction}
              selectedTickets={tickets.filter(t => checkedTickets.has(t.id)).map(t => ({ id: t.id, type: t.type }))}
              onClearSelection={onClearSelection}
            />
          )}
          {viewMode === "board" && tickets.length > 0 ? (
            <SprintBoardView
              tickets={tickets}
              users={users}
              epics={epics}
              hideEmpty={hideEmptyStatusColumns}
              onSelectTicket={onSelectTicket}
              onUpdateState={onUpdateState}
              selectedTicketId={selectedTicketId}
              backlogPrefix={backlogPrefix}
              ticketIndexMap={ticketIndexMap}
            />
          ) : (
          <div className="divide-y divide-border/50 overflow-x-hidden">
            {tickets.map(ticket => (
              <TicketRow 
                key={`${ticket.type}-${ticket.id}`}
                ticket={ticket}
                users={users}
                sprints={sprints}
                epics={epics}
                showEpicColumn={showEpicColumn}
                showPriorityColumn={showPriorityColumn}
                showAssigneeColumn={showAssigneeColumn}
                showPointsColumn={showPointsColumn}
                onSelect={onSelectTicket}
                onUpdateState={onUpdateState}
                onUpdateField={onUpdateField}
                onConvertType={onConvertType}
                onTicketAction={onTicketAction}
                isSelected={selectedTicketId === ticket.id}
                showCheckbox={true}
                isChecked={checkedTickets?.has(ticket.id) || false}
                onCheckChange={onCheckChange}
                backlogPrefix={backlogPrefix}
                ticketGlobalIndex={ticketIndexMap?.[ticket.id]}
              />
            ))}
            
            {tickets.length === 0 && !isCreating && !isTemporarySprint && (
              <button
                className="w-full px-4 py-3 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1.5"
                onClick={() => setIsCreating(true)}
                data-testid={`button-inline-create-empty-${sprint.id}`}
              >
                <Plus className="h-3 w-3" />
                Ce sprint est vide. Cliquez pour créer un ticket.
              </button>
            )}
            
            {tickets.length === 0 && isTemporarySprint && (
              <div className="w-full px-4 py-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
                Enregistrement du sprint en cours...
              </div>
            )}
            
            {isCreating && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7">
                      <div 
                        className="h-4 w-4 rounded flex items-center justify-center mr-1"
                        style={{ backgroundColor: ticketTypeColor(newTicketType) }}
                      >
                        <span className="text-white scale-75">{ticketTypeIcon(newTicketType)}</span>
                      </div>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white dark:bg-card">
                    <DropdownMenuItem onClick={() => setNewTicketType("epic")} className="text-foreground">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-purple-500">
                        <Layers className="h-3 w-3 text-white" />
                      </div>
                      Epic
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("user_story")} className="text-foreground">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-green-500">
                        <Bookmark className="h-3 w-3 text-white" />
                      </div>
                      User Story
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("task")} className="text-foreground">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-blue-500">
                        <ListTodo className="h-3 w-3 text-white" />
                      </div>
                      Task
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("bug")} className="text-foreground" data-testid="menu-item-type-bug">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-destructive">
                        <Bug className="h-3 w-3 text-white" />
                      </div>
                      Bug
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Input 
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  placeholder={t.common.ph.ticketTitle}
                  className="flex-1 h-7 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setIsCreating(false);
                  }}
                  data-testid="input-new-ticket-title"
                />
                
                <Button size="sm" className="h-7" onClick={handleCreate} data-testid="button-create-ticket">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setIsCreating(false)}>
                  Annuler
                </Button>
              </div>
            )}
          </div>
          )}
          
          {!isCreating && tickets.length > 0 && !isTemporarySprint && (
            <button
              className="w-full px-4 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-1.5 mb-2"
              onClick={() => setIsCreating(true)}
              data-testid={`button-inline-create-${sprint.id}`}
            >
              <Plus className="h-3 w-3" />
              Créer un ticket
            </button>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
    </>
  );
}

// ============ Sprint Board (Kanban) View ============
interface SprintBoardViewProps {
  tickets: FlatTicket[];
  users?: AppUser[];
  epics?: Epic[];
  hideEmpty?: boolean;
  onSelectTicket: (ticket: FlatTicket) => void;
  onUpdateState?: (ticketId: string, type: TicketType, state: string) => void;
  selectedTicketId?: string | null;
  backlogPrefix?: string;
  ticketIndexMap?: Record<string, number>;
}

function BoardCard({
  ticket,
  users,
  epics,
  selectedTicketId,
  backlogPrefix,
  ticketIndexMap,
  onSelectTicket,
}: {
  ticket: FlatTicket;
  users?: AppUser[];
  epics?: Epic[];
  selectedTicketId?: string | null;
  backlogPrefix?: string;
  ticketIndexMap?: Record<string, number>;
  onSelectTicket: (ticket: FlatTicket) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `board-card-${ticket.type}-${ticket.id}`,
    data: { ticketId: ticket.id, ticketType: ticket.type, fromState: ticket.state || "a_faire" },
  });
  const draggedRef = useRef(false);
  useEffect(() => {
    if (isDragging) {
      draggedRef.current = true;
    } else if (draggedRef.current) {
      const t = setTimeout(() => { draggedRef.current = false; }, 200);
      return () => clearTimeout(t);
    }
  }, [isDragging]);
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };
  const assignee = users?.find(u => u.id === ticket.assigneeId);
  const epic = epics?.find(e => e.id === ticket.epicId);
  const idx = ticketIndexMap?.[ticket.id];
  const ref = backlogPrefix && idx !== undefined ? `${backlogPrefix}-${idx + 1}` : null;
  const isSelected = selectedTicketId === ticket.id;
  const tags = ticket.tags || [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging || draggedRef.current) return;
        e.preventDefault();
        onSelectTicket(ticket);
      }}
      className={`text-left rounded-md border bg-card p-2 cursor-grab active:cursor-grabbing hover-elevate ${isSelected ? "border-primary" : "border-border/60"}`}
      data-testid={`board-card-${ticket.id}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div
          className="h-3.5 w-3.5 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: ticketTypeColor(ticket.type) }}
        >
          <span className="text-white scale-[0.55]">{ticketTypeIcon(ticket.type)}</span>
        </div>
        {ref && (
          <span className="text-[10px] text-muted-foreground font-mono">{ref}</span>
        )}
        {ticket.priority && (
          <span className="ml-auto inline-flex items-center" title={backlogPriorityOptions.find(p => p.value === ticket.priority)?.label || ticket.priority}>
            <PriorityIcon priority={ticket.priority} className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="text-xs text-foreground line-clamp-2 mb-1.5">
        {ticket.title}
      </div>
      {epic && (
        <div className="text-[10px] text-muted-foreground truncate mb-1.5" title={epic.title}>
          {epic.title}
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="outline" className="text-[9px] h-4 px-1 font-normal">
              {tag}
            </Badge>
          ))}
          {tags.length > 3 && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 font-normal">
              +{tags.length - 3}
            </Badge>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 shrink-0">
          {typeof ticket.estimatePoints === "number" && ticket.estimatePoints !== null && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-medium" title="Points d'estimation">
              {ticket.estimatePoints}
            </Badge>
          )}
          {ticket.complexity && (
            <Badge variant="outline" className="text-[9px] h-4 px-1">{ticket.complexity}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {assignee ? (
            <Avatar className="h-5 w-5">
              {assignee.avatarUrl && <AvatarImage src={assignee.avatarUrl} />}
              <AvatarFallback className="text-[9px]">
                {(assignee.fullName || assignee.email || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">?</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}

function BoardColumn({
  col,
  colTickets,
  users,
  epics,
  selectedTicketId,
  backlogPrefix,
  ticketIndexMap,
  onSelectTicket,
}: {
  col: typeof backlogItemStateOptions[number];
  colTickets: FlatTicket[];
  users?: AppUser[];
  epics?: Epic[];
  selectedTicketId?: string | null;
  backlogPrefix?: string;
  ticketIndexMap?: Record<string, number>;
  onSelectTicket: (ticket: FlatTicket) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `board-col-${col.value}`,
    data: { state: col.value },
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-[260px] shrink-0 rounded-md border transition-colors ${isOver ? "bg-primary/5 border-primary" : "bg-background border-border/60"}`}
      data-testid={`board-column-${col.value}`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
          <span className="text-xs font-medium text-foreground truncate uppercase tracking-wide">{col.label}</span>
        </div>
        <Badge variant="secondary" className="text-[10px] h-5">
          {colTickets.length}
        </Badge>
      </div>
      <div className="flex flex-col gap-2 p-2 min-h-[60px]">
        {colTickets.map(ticket => (
          <BoardCard
            key={`${ticket.type}-${ticket.id}`}
            ticket={ticket}
            users={users}
            epics={epics}
            selectedTicketId={selectedTicketId}
            backlogPrefix={backlogPrefix}
            ticketIndexMap={ticketIndexMap}
            onSelectTicket={onSelectTicket}
          />
        ))}
        {colTickets.length === 0 && (
          <div className="text-[11px] text-muted-foreground text-center py-3">
            Aucun ticket
          </div>
        )}
      </div>
    </div>
  );
}

function SprintBoardView({
  tickets,
  users,
  epics,
  hideEmpty = false,
  onSelectTicket,
  onUpdateState,
  selectedTicketId,
  backlogPrefix,
  ticketIndexMap,
}: SprintBoardViewProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const visibleColumns = hideEmpty
    ? backlogItemStateOptions.filter(opt => tickets.some(t => (t.state || "a_faire") === opt.value))
    : [...backlogItemStateOptions];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overData = over.data.current as { state?: string } | undefined;
    const activeData = active.data.current as { ticketId?: string; ticketType?: TicketType; fromState?: string } | undefined;
    const newState = overData?.state;
    if (!newState || !activeData?.ticketId || !activeData?.ticketType) return;
    if (newState === activeData.fromState) return;
    onUpdateState?.(activeData.ticketId, activeData.ticketType, newState);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto p-3 bg-muted/20" data-testid="sprint-board-view">
        <div className="flex gap-3 min-h-[200px]">
          {visibleColumns.map(col => {
            const colTickets = tickets.filter(t => (t.state || "a_faire") === col.value);
            return (
              <BoardColumn
                key={col.value}
                col={col}
                colTickets={colTickets}
                users={users}
                epics={epics}
                selectedTicketId={selectedTicketId}
                backlogPrefix={backlogPrefix}
                ticketIndexMap={ticketIndexMap}
                onSelectTicket={onSelectTicket}
              />
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}

interface BacklogPoolProps {
  tickets: FlatTicket[];
  users?: AppUser[];
  sprints?: Sprint[];
  epics?: Epic[];
  showEpicColumn?: boolean;
  showPriorityColumn?: boolean;
  showAssigneeColumn?: boolean;
  showPointsColumn?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectTicket: (ticket: FlatTicket) => void;
  onCreateTicket: (type: TicketType, title: string) => void;
  onUpdateState?: (ticketId: string, type: TicketType, state: string) => void;
  onUpdateField?: (ticketId: string, type: TicketType, field: string, value: any) => void;
  onConvertType?: (ticketId: string, fromType: TicketType, toType: TicketType) => void;
  onTicketAction?: (action: TicketAction) => void;
  selectedTicketId?: string | null;
  checkedTickets?: Set<string>;
  onCheckChange?: (ticketId: string, ticketType: TicketType, checked: boolean) => void;
  onBulkAction?: (action: BulkAction) => void;
  onClearSelection?: () => void;
  backlogPrefix?: string;
  ticketIndexMap?: Record<string, number>;
}

export function BacklogPool({ 
  tickets, 
  users,
  sprints,
  epics,
  showEpicColumn,
  showPriorityColumn,
  showAssigneeColumn,
  showPointsColumn,
  isExpanded, 
  onToggle, 
  onSelectTicket, 
  onCreateTicket,
  onUpdateState,
  onUpdateField,
  onConvertType,
  onTicketAction,
  selectedTicketId,
  checkedTickets,
  onCheckChange,
  onBulkAction,
  onClearSelection,
  backlogPrefix,
  ticketIndexMap
}: BacklogPoolProps) {
  const { t } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketType, setNewTicketType] = useState<TicketType>("user_story");
  const [mobileSelectedTicket, setMobileSelectedTicket] = useState<FlatTicket | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const totalPoints = tickets.reduce((sum, t) => sum + (t.estimatePoints || 0), 0);
  
  const { isOver, setNodeRef } = useDroppable({
    id: "backlog-pool",
    data: { type: "backlog", sprintId: null },
  });
  
  const handleCreate = () => {
    if (newTicketTitle.trim()) {
      onCreateTicket(newTicketType, newTicketTitle.trim());
      setNewTicketTitle("");
      setIsCreating(false);
    }
  };
  
  return (
    <>
    {/* ── Mobile ticket sheet for backlog pool ── */}
    <div className="md:hidden">
      <MobileTicketSheet
        ticket={mobileSelectedTicket}
        open={mobileSheetOpen}
        onClose={() => { setMobileSheetOpen(false); setMobileSelectedTicket(null); }}
        users={users}
        epics={epics}
        sprints={sprints}
        backlogPrefix={backlogPrefix}
        ticketGlobalIndex={mobileSelectedTicket ? ticketIndexMap?.[mobileSelectedTicket.id] : undefined}
        onUpdateState={onUpdateState}
        onUpdateField={onUpdateField}
        onSelectTicket={(t) => { setMobileSheetOpen(false); setMobileSelectedTicket(null); onSelectTicket(t); }}
      />
    </div>

    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div 
        ref={setNodeRef}
        className={cn(
          "border rounded-lg overflow-hidden bg-card transition-colors",
          isOver && "ring-2 ring-primary bg-primary/5"
        )} 
        data-testid="backlog-pool-section"
      >
        <div className="flex items-center gap-3 px-4 py-1.5 bg-[#ECECF0] dark:bg-[#1A1B22] border-b">
          {/* Select all checkbox for backlog pool */}
          {checkedTickets && onCheckChange && tickets.length > 0 && (
            <Checkbox
              checked={tickets.length > 0 && tickets.every(t => checkedTickets.has(t.id))}
              onCheckedChange={(checked) => {
                tickets.forEach(t => onCheckChange(t.id, t.type, !!checked));
              }}
              data-testid="checkbox-select-all-backlog"
              className="h-4 w-4"
            />
          )}
          
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" data-testid="button-toggle-backlog-pool">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">Backlog</span>
          
          <div className="flex-1" />
          
          <span className="text-xs text-muted-foreground">
            {tickets.length} tickets | {totalPoints} pts
          </span>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsCreating(true)}
            data-testid="button-add-to-backlog"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <CollapsibleContent>
          {/* Bulk Actions Bar */}
          {checkedTickets && onBulkAction && onClearSelection && (
            <BulkActionsDropdown
              selectedCount={tickets.filter(t => checkedTickets.has(t.id)).length}
              users={users}
              sprints={sprints}
              epics={epics}
              onBulkAction={onBulkAction}
              selectedTickets={tickets.filter(t => checkedTickets.has(t.id)).map(t => ({ id: t.id, type: t.type }))}
              onClearSelection={onClearSelection}
            />
          )}
          <div className="divide-y divide-border/50 overflow-x-hidden">
            {tickets.map(ticket => (
              <div key={`${ticket.type}-${ticket.id}`}>
                {/* Mobile row */}
                <div className="md:hidden">
                  <MobileTicketRow
                    ticket={ticket}
                    users={users}
                    epics={epics}
                    sprints={sprints}
                    backlogPrefix={backlogPrefix}
                    ticketGlobalIndex={ticketIndexMap?.[ticket.id]}
                    onMobileSelect={(t) => { setMobileSelectedTicket(t); setMobileSheetOpen(true); }}
                  />
                </div>
                {/* Desktop row */}
                <div className="hidden md:block">
                  <TicketRow
                    ticket={ticket}
                    users={users}
                    sprints={sprints}
                    epics={epics}
                    showEpicColumn={showEpicColumn}
                    showPriorityColumn={showPriorityColumn}
                    showAssigneeColumn={showAssigneeColumn}
                    showPointsColumn={showPointsColumn}
                    onSelect={onSelectTicket}
                    onUpdateState={onUpdateState}
                    onUpdateField={onUpdateField}
                    onConvertType={onConvertType}
                    onTicketAction={onTicketAction}
                    isSelected={selectedTicketId === ticket.id}
                    showCheckbox={true}
                    isChecked={checkedTickets?.has(ticket.id) || false}
                    onCheckChange={onCheckChange}
                    backlogPrefix={backlogPrefix}
                    ticketGlobalIndex={ticketIndexMap?.[ticket.id]}
                  />
                </div>
              </div>
            ))}
            
            {tickets.length === 0 && !isCreating && (
              <button
                className="w-full px-4 py-3 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1.5"
                onClick={() => setIsCreating(true)}
                data-testid="button-inline-create-empty-backlog"
              >
                <Plus className="h-3 w-3" />
                Votre backlog est vide. Cliquez pour créer un ticket.
              </button>
            )}
            
            {isCreating && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7">
                      <div 
                        className="h-4 w-4 rounded flex items-center justify-center mr-1"
                        style={{ backgroundColor: ticketTypeColor(newTicketType) }}
                      >
                        <span className="text-white scale-75">{ticketTypeIcon(newTicketType)}</span>
                      </div>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white dark:bg-card">
                    <DropdownMenuItem onClick={() => setNewTicketType("epic")} className="text-foreground">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-purple-500">
                        <Layers className="h-3 w-3 text-white" />
                      </div>
                      Epic
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("user_story")} className="text-foreground">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-green-500">
                        <Bookmark className="h-3 w-3 text-white" />
                      </div>
                      User Story
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("task")} className="text-foreground">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-blue-500">
                        <ListTodo className="h-3 w-3 text-white" />
                      </div>
                      Task
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("bug")} className="text-foreground" data-testid="menu-item-type-bug">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-destructive">
                        <Bug className="h-3 w-3 text-white" />
                      </div>
                      Bug
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Input 
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  placeholder={t.common.ph.ticketTitle}
                  className="flex-1 h-7 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setIsCreating(false);
                  }}
                  data-testid="input-new-backlog-ticket-title"
                />
                
                <Button size="sm" className="h-7" onClick={handleCreate} data-testid="button-create-backlog-ticket">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setIsCreating(false)}>
                  Annuler
                </Button>
              </div>
            )}
          </div>
          
          {!isCreating && tickets.length > 0 && (
            <button
              className="w-full px-4 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-1.5 mb-2"
              onClick={() => setIsCreating(true)}
              data-testid="button-inline-create-backlog"
            >
              <Plus className="h-3 w-3" />
              Créer un ticket
            </button>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
    </>
  );
}

export function transformToFlatTickets(
  epics: Epic[] = [],
  userStories: (UserStory & { tasks?: BacklogTask[] })[] = [],
  backlogTasks: BacklogTask[] = []
): FlatTicket[] {
  const tickets: FlatTicket[] = [];
  
  epics.forEach(epic => {
    tickets.push({
      id: epic.id,
      type: "epic",
      title: epic.title,
      description: epic.description,
      state: epic.state,
      priority: epic.priority,
      sprintId: (epic as any).sprintId || null,
      color: epic.color,
      order: epic.order,
      createdAt: epic.createdAt?.toString() || null,
      updatedAt: epic.updatedAt?.toString() || null,
    });
  });
  
  userStories.forEach(story => {
    tickets.push({
      id: story.id,
      type: "user_story",
      title: story.title,
      description: story.description,
      state: story.state,
      priority: story.priority,
      sprintId: story.sprintId || null,
      epicId: story.epicId || null,
      estimatePoints: story.estimatePoints,
      assigneeId: story.assigneeId || null,
      reporterId: story.reporterId || null,
      order: story.order,
      version: (story as any).version || null,
      tags: (story as any).tags || [],
      createdAt: story.createdAt?.toString() || null,
      updatedAt: story.updatedAt?.toString() || null,
      metrics01Label: (story as any).metrics01Label || null,
      metrics01Value: (story as any).metrics01Value ?? null,
      metrics02Label: (story as any).metrics02Label || null,
      metrics02Value: (story as any).metrics02Value ?? null,
      metrics03Label: (story as any).metrics03Label || null,
      metrics03Value: (story as any).metrics03Value ?? null,
      happyPath: (story as any).happyPath || null,
      edgeCase: (story as any).edgeCase || null,
    });
  });
  
  backlogTasks.forEach(task => {
    tickets.push({
      id: task.id,
      type: ((task as any).taskType === "bug" ? "bug" : "task") as TicketType,
      title: task.title,
      description: task.description,
      state: task.state,
      priority: (task as any).priority || null,
      sprintId: (task as any).sprintId || null,
      userStoryId: task.userStoryId || null,
      epicId: (task as any).epicId || null,
      estimatePoints: task.estimatePoints,
      assigneeId: task.assigneeId || null,
      reporterId: task.reporterId || null,
      order: task.order,
      version: (task as any).version || null,
      tags: (task as any).tags || [],
      createdAt: task.createdAt?.toString() || null,
      updatedAt: task.updatedAt?.toString() || null,
      metrics01Label: (task as any).metrics01Label || null,
      metrics01Value: (task as any).metrics01Value ?? null,
      metrics02Label: (task as any).metrics02Label || null,
      metrics02Value: (task as any).metrics02Value ?? null,
      metrics03Label: (task as any).metrics03Label || null,
      metrics03Value: (task as any).metrics03Value ?? null,
      happyPath: (task as any).happyPath || null,
      edgeCase: (task as any).edgeCase || null,
    });
  });
  
  return tickets.sort((a, b) => a.order - b.order);
}
