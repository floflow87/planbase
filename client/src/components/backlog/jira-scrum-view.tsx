import { useState, useMemo } from "react";
import { 
  ChevronDown, ChevronRight, ChevronUp, Plus, MoreVertical, 
  Flag, User, Calendar, GripVertical, Play, Pause,
  Check, Layers, BookOpen, ListTodo, AlertCircle, Pencil,
  ArrowUp, ArrowDown, Copy, Trash2, UserPlus, Hash, ExternalLink,
  CheckSquare, Square, MoreHorizontal, Link2, Wrench, Tag, X
} from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Epic, UserStory, BacklogTask, Sprint, AppUser } from "@shared/schema";
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
}

function ticketTypeIcon(type: TicketType) {
  switch (type) {
    case "epic":
      return <Layers className="h-4 w-4" />;
    case "user_story":
      return <BookOpen className="h-4 w-4" />;
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
    case "a_faire":
    default:
      return "bg-gray-400";
  }
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
  onSelect: (ticket: FlatTicket) => void;
  onUpdateState?: (ticketId: string, type: TicketType, state: string) => void;
  onUpdateField?: (ticketId: string, type: TicketType, field: string, value: any) => void;
  onTicketAction?: (action: TicketAction) => void;
  isSelected?: boolean;
  isDraggable?: boolean;
  isChecked?: boolean;
  onCheckChange?: (ticketId: string, ticketType: TicketType, checked: boolean) => void;
  showCheckbox?: boolean;
}

export function TicketRow({ ticket, users, sprints, epics, showEpicColumn, onSelect, onUpdateState, onUpdateField, onTicketAction, isSelected, isDraggable = true, isChecked = false, onCheckChange, showCheckbox = false }: TicketRowProps) {
  const typeColor = ticketTypeColor(ticket.type, ticket.color);
  const assignee = users?.find(u => u.id === ticket.assigneeId);
  const ticketEpic = epics?.find(e => e.id === ticket.epicId);
  const isCompleted = ticket.state === "termine";
  
  const [pointsPopoverOpen, setPointsPopoverOpen] = useState(false);
  const [priorityPopoverOpen, setPriorityPopoverOpen] = useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [epicPopoverOpen, setEpicPopoverOpen] = useState(false);
  
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
          className="data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
          data-testid={`checkbox-ticket-${ticket.id}`}
        />
      )}
      <div {...listeners} {...attributes}>
        <GripVertical className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 cursor-grab" />
      </div>
      
      <div 
        className="flex items-center justify-center h-5 w-5 rounded flex-shrink-0"
        style={{ backgroundColor: typeColor }}
      >
        <span className="text-white">{ticketTypeIcon(ticket.type)}</span>
      </div>
      
      <span className="flex-1 truncate text-xs font-medium" data-testid={`ticket-title-${ticket.id}`}>
        {ticket.title}
      </span>
      
      {/* Right columns container with larger spacing */}
      <div className="flex items-center gap-4">
      {/* Inline Points Editor with Tooltip */}
      {onUpdateField && !isCompleted ? (
        <Popover open={pointsPopoverOpen} onOpenChange={setPointsPopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="text-xs px-1.5 cursor-pointer hover:bg-muted"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`ticket-points-${ticket.id}`}
                >
                  {ticket.estimatePoints || "-"}
                </Badge>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="bg-white text-gray-900 border shadow-md">
              <p className="text-xs">Cliquez pour modifier les points d'estimation</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-28 p-2 bg-white" align="center" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700 mb-2">Points</p>
              {[0.25, 0.5, 1, 2, 3, 5, 8, 13].map(pts => (
                <Button
                  key={pts}
                  variant={ticket.estimatePoints === pts ? "default" : "ghost"}
                  size="sm"
                  className="w-full h-7 text-xs justify-start"
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
        <Badge variant="outline" className="text-xs px-1.5" data-testid={`ticket-points-${ticket.id}`}>
          {ticket.estimatePoints || "-"}
        </Badge>
      )}
      
      {/* Inline Priority Editor with Tooltip */}
      {onUpdateField && !isCompleted ? (
        <Popover open={priorityPopoverOpen} onOpenChange={setPriorityPopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <div 
                  className="cursor-pointer hover:opacity-80 p-0.5 rounded hover:bg-muted"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`ticket-priority-${ticket.id}`}
                >
                  {getPriorityIcon(ticket.priority)}
                </div>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="bg-white text-gray-900 border shadow-md">
              <p className="text-xs">Cliquez pour modifier la priorité</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-36 p-2 bg-white" align="center" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700 mb-2">Priorité</p>
              {backlogPriorityOptions.map(opt => (
                <Button
                  key={opt.value}
                  variant={ticket.priority === opt.value ? "default" : "ghost"}
                  size="sm"
                  className="w-full h-7 text-xs justify-start gap-2"
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
      )}
      
      {/* Inline Assignee Editor with Tooltip */}
      {onUpdateField && !isCompleted ? (
        <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <div 
                  className="cursor-pointer hover:opacity-80"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`ticket-assignee-${ticket.id}`}
                >
                  {assignee ? (
                    <Avatar className="h-6 w-6 ring-2 ring-transparent hover:ring-primary/30 transition-all">
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
            <TooltipContent className="bg-white text-gray-900 border shadow-md">
              <p className="text-xs">Cliquez pour assigner un collaborateur</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-48 p-2 bg-white max-h-64 overflow-y-auto" align="end" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700 mb-2">Assigner à</p>
              <Button
                variant={!ticket.assigneeId ? "default" : "ghost"}
                size="sm"
                className="w-full h-7 text-xs justify-start gap-2"
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
                  className="w-full h-7 text-xs justify-start gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateField(ticket.id, ticket.type, "assigneeId", user.id);
                    setAssigneePopoverOpen(false);
                  }}
                >
                  <Avatar className="h-4 w-4">
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
      )}
      
      {/* Inline Epic Editor */}
      {showEpicColumn && ticket.type !== "epic" && onUpdateField && !isCompleted ? (
        <Popover open={epicPopoverOpen} onOpenChange={setEpicPopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <div 
                  className="cursor-pointer hover:opacity-80 min-w-[80px]"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`ticket-epic-${ticket.id}`}
                >
                  {ticketEpic ? (
                    <Badge 
                      variant="outline" 
                      className="text-xs px-2 py-0.5 bg-white border truncate max-w-[100px]"
                      style={{ borderColor: ticketEpic.color || "#8B5CF6" }}
                    >
                      <div 
                        className="h-2 w-2 rounded-full mr-1.5 flex-shrink-0" 
                        style={{ backgroundColor: ticketEpic.color || "#8B5CF6" }}
                      />
                      <span className="truncate">{ticketEpic.title}</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs px-2 py-0.5 bg-white text-muted-foreground">
                      <Layers className="h-3 w-3 mr-1" />
                      Aucun
                    </Badge>
                  )}
                </div>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="bg-white text-gray-900 border shadow-md">
              <p className="text-xs">Cliquez pour modifier l'Epic</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-48 p-2 bg-white max-h-64 overflow-y-auto" align="end" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700 mb-2">Epic</p>
              <Button
                variant={!ticket.epicId ? "default" : "ghost"}
                size="sm"
                className="w-full h-7 text-xs justify-start gap-2"
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
                  className="w-full h-7 text-xs justify-start gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateField(ticket.id, ticket.type, "epicId", epic.id);
                    setEpicPopoverOpen(false);
                  }}
                >
                  <div 
                    className="h-3 w-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: epic.color || "#8B5CF6" }}
                  />
                  <span className="truncate">{epic.title}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : showEpicColumn && ticket.type !== "epic" ? (
        ticketEpic ? (
          <Badge 
            variant="outline" 
            className="text-xs px-2 py-0.5 truncate max-w-[100px]"
            style={{ borderColor: ticketEpic.color || "#8B5CF6" }}
          >
            <div 
              className="h-2 w-2 rounded-full mr-1.5 flex-shrink-0" 
              style={{ backgroundColor: ticketEpic.color || "#8B5CF6" }}
            />
            <span className="truncate">{ticketEpic.title}</span>
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs px-2 py-0.5 text-muted-foreground">
            <Layers className="h-3 w-3 mr-1" />
            -
          </Badge>
        )
      ) : null}
      
      {/* Inline Status Dropdown - moved to end */}
      {onUpdateState ? (
        <Select
          value={ticket.state || "a_faire"}
          onValueChange={(value) => {
            onUpdateState(ticket.id, ticket.type, value);
          }}
        >
          <SelectTrigger 
            className={cn("h-6 w-auto min-w-[90px] text-xs px-2 border cursor-pointer bg-white dark:bg-white", getStateStyle(ticket.state))}
            onClick={(e) => e.stopPropagation()}
            data-testid={`select-inline-state-${ticket.id}`}
          >
            <SelectValue>
              <span className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", getStateDot(ticket.state))} />
                {getStateLabel(ticket.state)}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-white">
            {backlogItemStateOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-gray-900 text-xs cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full", getStateDot(opt.value))} />
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Badge 
          variant="secondary" 
          className={cn("text-xs px-1.5 py-0 cursor-pointer", getStateStyle(ticket.state))}
          data-testid={`ticket-state-${ticket.id}`}
        >
          <span className={cn("w-2 h-2 rounded-full mr-1.5 inline-block", getStateDot(ticket.state))} />
          {getStateLabel(ticket.state)}
        </Badge>
      )}
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
              data-testid={`button-ticket-menu-${ticket.id}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-white w-48">
            {/* Move submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-gray-900">
                <ArrowUp className="h-4 w-4 mr-2" />
                Déplacer
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-white dark:bg-white">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onTicketAction({ type: "move_top", ticketId: ticket.id, ticketType: ticket.type });
                  }}
                  className="text-gray-900"
                >
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Haut du backlog
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onTicketAction({ type: "move_bottom", ticketId: ticket.id, ticketType: ticket.type });
                  }}
                  className="text-gray-900"
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
                    className="text-gray-900"
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
                  className="text-gray-900"
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
              className="text-gray-900"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copier
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            {/* Assign submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-gray-900">
                <UserPlus className="h-4 w-4 mr-2" />
                Assigner à
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-white dark:bg-white">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onTicketAction({ type: "assign", ticketId: ticket.id, ticketType: ticket.type, assigneeId: null });
                  }}
                  className="text-gray-900"
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
                    className="text-gray-900"
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
              <DropdownMenuSubTrigger className="text-gray-900">
                <Check className="h-4 w-4 mr-2" />
                Marquer comme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-white dark:bg-white">
                {backlogItemStateOptions.map(opt => (
                  <DropdownMenuItem 
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTicketAction({ type: "mark_status", ticketId: ticket.id, ticketType: ticket.type, state: opt.value });
                    }}
                    className="text-gray-900"
                  >
                    <span className={cn("w-2 h-2 rounded-full mr-2", getStateDot(opt.value))} />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            {/* Estimate points submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-gray-900">
                <Hash className="h-4 w-4 mr-2" />
                Points d'estimation
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-white dark:bg-white">
                {[0, 0.25, 0.5, 1, 2, 3, 5, 8, 13, 21].map(points => (
                  <DropdownMenuItem 
                    key={points}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTicketAction({ type: "set_estimate", ticketId: ticket.id, ticketType: ticket.type, estimatePoints: points });
                    }}
                    className="text-gray-900"
                  >
                    <Badge variant="outline" className="text-xs mr-2">{points}</Badge>
                    {points === 0 ? "Sans estimation" : `${points} point${points > 1 ? "s" : ""}`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            {/* Priority submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-gray-900">
                <Flag className="h-4 w-4 mr-2" />
                Priorité
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-white dark:bg-white">
                {backlogPriorityOptions.map(opt => (
                  <DropdownMenuItem 
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTicketAction({ type: "set_priority", ticketId: ticket.id, ticketType: ticket.type, priority: opt.value });
                    }}
                    className="text-gray-900"
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
                className="text-gray-900"
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
        <DropdownMenuContent className="w-56 bg-white dark:bg-white text-[12px]" align="start">
          {/* Change State */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-gray-900">
              <Check className="h-4 w-4 mr-2" />
              Changer l'étape
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-white">
              {backlogItemStateOptions.map(opt => (
                <DropdownMenuItem 
                  key={opt.value}
                  onClick={() => onBulkAction({ type: "bulk_change_state", ticketIds: selectedTickets, state: opt.value })}
                  className="text-gray-900"
                  data-testid={`bulk-action-state-${opt.value}`}
                >
                  <span className={cn("w-2 h-2 rounded-full mr-2", getStateDot(opt.value))} />
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {/* Change Priority */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-gray-900">
              <Flag className="h-4 w-4 mr-2" />
              Changer la priorité
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-white">
              {backlogPriorityOptions.map(opt => (
                <DropdownMenuItem 
                  key={opt.value}
                  onClick={() => onBulkAction({ type: "bulk_change_priority", ticketIds: selectedTickets, priority: opt.value })}
                  className="text-gray-900"
                  data-testid={`bulk-action-priority-${opt.value}`}
                >
                  <span className="mr-2"><PriorityIcon priority={opt.value} /></span>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {/* Assign to */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-gray-900">
              <UserPlus className="h-4 w-4 mr-2" />
              Assigner à
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-white max-h-[300px] overflow-y-auto">
              <DropdownMenuItem 
                onClick={() => onBulkAction({ type: "bulk_assign", ticketIds: selectedTickets, assigneeId: null })}
                className="text-gray-900"
                data-testid="bulk-action-unassign"
              >
                <User className="h-4 w-4 mr-2 text-muted-foreground" />
                Non assigné
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {users?.map(user => (
                <DropdownMenuItem 
                  key={user.id}
                  onClick={() => onBulkAction({ type: "bulk_assign", ticketIds: selectedTickets, assigneeId: user.id })}
                  className="text-gray-900"
                  data-testid={`bulk-action-assign-${user.id}`}
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
          
          {/* Set Estimate Points */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-gray-900">
              <Hash className="h-4 w-4 mr-2" />
              Ajouter un estimate point
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-white">
              {[0, 0.25, 0.5, 1, 2, 3, 5, 8, 13, 21].map(points => (
                <DropdownMenuItem 
                  key={points}
                  onClick={() => onBulkAction({ type: "bulk_set_estimate", ticketIds: selectedTickets, estimatePoints: points })}
                  className="text-gray-900"
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
            <DropdownMenuSubTrigger className="text-gray-900">
              <Link2 className="h-4 w-4 mr-2" />
              Lier à l'Epic
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-white max-h-[300px] overflow-y-auto">
              <DropdownMenuItem 
                onClick={() => onBulkAction({ type: "bulk_link_epic", ticketIds: selectedTickets, epicId: null })}
                className="text-gray-900"
                data-testid="bulk-action-unlink-epic"
              >
                <Layers className="h-4 w-4 mr-2 text-muted-foreground" />
                Aucun Epic
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {epics?.map(epic => (
                <DropdownMenuItem 
                  key={epic.id}
                  onClick={() => onBulkAction({ type: "bulk_link_epic", ticketIds: selectedTickets, epicId: epic.id })}
                  className="text-gray-900"
                  data-testid={`bulk-action-epic-${epic.id}`}
                >
                  <div 
                    className="h-3 w-3 rounded mr-2" 
                    style={{ backgroundColor: epic.color || "#8B5CF6" }}
                  />
                  {epic.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {/* Move to Sprint */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-gray-900">
              <Play className="h-4 w-4 mr-2" />
              Déplacer vers le sprint
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-white max-h-[300px] overflow-y-auto">
              {sprints?.filter(s => s.status !== "termine").map(sprint => (
                <DropdownMenuItem 
                  key={sprint.id}
                  onClick={() => onBulkAction({ type: "bulk_move_sprint", ticketIds: selectedTickets, sprintId: sprint.id })}
                  className="text-gray-900"
                  data-testid={`bulk-action-sprint-${sprint.id}`}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {sprint.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {/* Move to Backlog */}
          <DropdownMenuItem 
            onClick={() => onBulkAction({ type: "bulk_move_backlog", ticketIds: selectedTickets })}
            className="text-gray-900"
            data-testid="bulk-action-move-backlog"
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Déplacer vers le backlog
          </DropdownMenuItem>
          
          {/* Set Version */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-gray-900">
              <Tag className="h-4 w-4 mr-2" />
              Définir la version
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white dark:bg-white">
              <DropdownMenuItem 
                onClick={() => onBulkAction({ type: "bulk_set_version", ticketIds: selectedTickets, version: null })}
                className="text-gray-900"
                data-testid="bulk-action-remove-version"
              >
                <X className="h-4 w-4 mr-2 text-muted-foreground" />
                Aucune version
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {["1.0.0", "1.1.0", "1.2.0", "2.0.0", "MVP", "Beta", "Alpha"].map(version => (
                <DropdownMenuItem 
                  key={version}
                  onClick={() => onBulkAction({ type: "bulk_set_version", ticketIds: selectedTickets, version })}
                  className="text-gray-900"
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
            className="text-red-600"
            data-testid="bulk-action-delete"
          >
            <Trash2 className="h-4 w-4 mr-2" />
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

interface SprintSectionProps {
  sprint: Sprint;
  tickets: FlatTicket[];
  users?: AppUser[];
  sprints?: Sprint[];
  epics?: Epic[];
  showEpicColumn?: boolean;
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
}

export function SprintSection({ 
  sprint, 
  tickets, 
  users,
  sprints,
  epics,
  showEpicColumn,
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
  onTicketAction,
  selectedTicketId,
  onMoveSprintUp,
  onMoveSprintDown,
  isFirstSprint,
  isLastSprint,
  checkedTickets,
  onCheckChange,
  onBulkAction,
  onClearSelection
}: SprintSectionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketType, setNewTicketType] = useState<TicketType>("user_story");
  
  const totalPoints = tickets.reduce((sum, t) => sum + (t.estimatePoints || 0), 0);
  const donePoints = tickets
    .filter(t => t.state === "termine")
    .reduce((sum, t) => sum + (t.estimatePoints || 0), 0);
  const doneTickets = tickets.filter(t => t.state === "termine").length;
  
  const handleCreate = () => {
    if (newTicketTitle.trim()) {
      onCreateTicket(sprint.id, newTicketType, newTicketTitle.trim());
      setNewTicketTitle("");
      setIsCreating(false);
    }
  };
  
  const statusColor = sprint.status === "en_cours" ? "text-blue-500" :
                      sprint.status === "termine" ? "text-green-500" : "text-gray-500";
  const statusLabel = sprint.status === "en_cours" ? "En cours" :
                      sprint.status === "termine" ? "Terminé" : "En préparation";
  
  const { isOver, setNodeRef } = useDroppable({
    id: `sprint-${sprint.id}`,
    data: { type: "sprint", sprintId: sprint.id },
  });
  
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div 
        ref={setNodeRef}
        className={cn(
          "border rounded-lg overflow-hidden bg-card transition-colors",
          isOver && "ring-2 ring-primary bg-primary/5"
        )} 
        data-testid={`sprint-section-${sprint.id}`}
      >
        <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 dark:bg-violet-950/30 border-b">
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
          
          <span className="font-semibold" data-testid={`sprint-name-${sprint.id}`}>{sprint.name}</span>
          
          <Badge variant="outline" className={cn("text-xs", statusColor)}>
            {statusLabel}
          </Badge>
          
          {sprint.startDate && sprint.endDate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(sprint.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              {" - "}
              {new Date(sprint.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </span>
          )}
          
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
          
          {sprint.status === "preparation" && onStartSprint && (
            <Button 
              size="sm" 
              onClick={() => onStartSprint(sprint.id)}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              data-testid={`button-start-sprint-${sprint.id}`}
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Démarrer
            </Button>
          )}
          
          {sprint.status === "en_cours" && onCompleteSprint && (
            <Button 
              size="sm" 
              onClick={() => onCompleteSprint(sprint.id)}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              data-testid={`button-complete-sprint-${sprint.id}`}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Terminer le sprint
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-menu-sprint-${sprint.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-white">
              <DropdownMenuItem onClick={() => setIsCreating(true)} className="text-gray-900">
                <Plus className="h-4 w-4 mr-2" />
                Créer un ticket
              </DropdownMenuItem>
              {onEditSprint && (
                <DropdownMenuItem onClick={() => onEditSprint(sprint)} className="text-gray-900" data-testid={`button-edit-sprint-${sprint.id}`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Modifier le sprint
                </DropdownMenuItem>
              )}
              {(onMoveSprintUp || onMoveSprintDown) && (
                <>
                  <DropdownMenuSeparator />
                  {onMoveSprintUp && !isFirstSprint && (
                    <DropdownMenuItem 
                      onClick={() => onMoveSprintUp(sprint.id)} 
                      className="text-gray-900"
                      data-testid={`button-move-sprint-up-${sprint.id}`}
                    >
                      <ArrowUp className="h-4 w-4 mr-2" />
                      Déplacer vers le haut
                    </DropdownMenuItem>
                  )}
                  {onMoveSprintDown && !isLastSprint && (
                    <DropdownMenuItem 
                      onClick={() => onMoveSprintDown(sprint.id)} 
                      className="text-gray-900"
                      data-testid={`button-move-sprint-down-${sprint.id}`}
                    >
                      <ArrowDown className="h-4 w-4 mr-2" />
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
                    className="text-red-600"
                    data-testid={`button-delete-sprint-${sprint.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
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
          <div className="divide-y divide-border/50">
            {tickets.map(ticket => (
              <TicketRow 
                key={`${ticket.type}-${ticket.id}`}
                ticket={ticket}
                users={users}
                sprints={sprints}
                epics={epics}
                showEpicColumn={showEpicColumn}
                onSelect={onSelectTicket}
                onUpdateState={onUpdateState}
                onUpdateField={onUpdateField}
                onTicketAction={onTicketAction}
                isSelected={selectedTicketId === ticket.id}
                showCheckbox={true}
                isChecked={checkedTickets?.has(ticket.id) || false}
                onCheckChange={onCheckChange}
              />
            ))}
            
            {tickets.length === 0 && !isCreating && (
              <button
                className="w-full px-4 py-4 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-2"
                onClick={() => setIsCreating(true)}
                data-testid={`button-inline-create-empty-${sprint.id}`}
              >
                <Plus className="h-4 w-4" />
                Ce sprint est vide. Cliquez pour créer un ticket.
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
                  <DropdownMenuContent className="bg-white dark:bg-white">
                    <DropdownMenuItem onClick={() => setNewTicketType("epic")} className="text-gray-900">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-purple-500">
                        <Layers className="h-3 w-3 text-white" />
                      </div>
                      Epic
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("user_story")} className="text-gray-900">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-green-500">
                        <BookOpen className="h-3 w-3 text-white" />
                      </div>
                      User Story
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("task")} className="text-gray-900">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-blue-500">
                        <ListTodo className="h-3 w-3 text-white" />
                      </div>
                      Task
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Input 
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  placeholder="Titre du ticket..."
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
          
          {!isCreating && tickets.length > 0 && (
            <button
              className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-2 mb-2"
              onClick={() => setIsCreating(true)}
              data-testid={`button-inline-create-${sprint.id}`}
            >
              <Plus className="h-4 w-4" />
              Créer un ticket
            </button>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface BacklogPoolProps {
  tickets: FlatTicket[];
  users?: AppUser[];
  sprints?: Sprint[];
  epics?: Epic[];
  showEpicColumn?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectTicket: (ticket: FlatTicket) => void;
  onCreateTicket: (type: TicketType, title: string) => void;
  onUpdateState?: (ticketId: string, type: TicketType, state: string) => void;
  onUpdateField?: (ticketId: string, type: TicketType, field: string, value: any) => void;
  onTicketAction?: (action: TicketAction) => void;
  selectedTicketId?: string | null;
  checkedTickets?: Set<string>;
  onCheckChange?: (ticketId: string, ticketType: TicketType, checked: boolean) => void;
  onBulkAction?: (action: BulkAction) => void;
  onClearSelection?: () => void;
}

export function BacklogPool({ 
  tickets, 
  users,
  sprints,
  epics,
  showEpicColumn,
  isExpanded, 
  onToggle, 
  onSelectTicket, 
  onCreateTicket,
  onUpdateState,
  onUpdateField,
  onTicketAction,
  selectedTicketId,
  checkedTickets,
  onCheckChange,
  onBulkAction,
  onClearSelection
}: BacklogPoolProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketType, setNewTicketType] = useState<TicketType>("user_story");
  
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
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div 
        ref={setNodeRef}
        className={cn(
          "border rounded-lg overflow-hidden bg-card transition-colors",
          isOver && "ring-2 ring-primary bg-primary/5"
        )} 
        data-testid="backlog-pool-section"
      >
        <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 dark:bg-violet-950/30 border-b">
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
          <div className="divide-y divide-border/50">
            {tickets.map(ticket => (
              <TicketRow 
                key={`${ticket.type}-${ticket.id}`}
                ticket={ticket}
                users={users}
                sprints={sprints}
                epics={epics}
                showEpicColumn={showEpicColumn}
                onSelect={onSelectTicket}
                onUpdateState={onUpdateState}
                onUpdateField={onUpdateField}
                onTicketAction={onTicketAction}
                isSelected={selectedTicketId === ticket.id}
                showCheckbox={true}
                isChecked={checkedTickets?.has(ticket.id) || false}
                onCheckChange={onCheckChange}
              />
            ))}
            
            {tickets.length === 0 && !isCreating && (
              <button
                className="w-full px-4 py-4 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-2"
                onClick={() => setIsCreating(true)}
                data-testid="button-inline-create-empty-backlog"
              >
                <Plus className="h-4 w-4" />
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
                  <DropdownMenuContent className="bg-white dark:bg-white">
                    <DropdownMenuItem onClick={() => setNewTicketType("epic")} className="text-gray-900">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-purple-500">
                        <Layers className="h-3 w-3 text-white" />
                      </div>
                      Epic
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("user_story")} className="text-gray-900">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-green-500">
                        <BookOpen className="h-3 w-3 text-white" />
                      </div>
                      User Story
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("task")} className="text-gray-900">
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-blue-500">
                        <ListTodo className="h-3 w-3 text-white" />
                      </div>
                      Task
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Input 
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  placeholder="Titre du ticket..."
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
              className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-2 mb-2"
              onClick={() => setIsCreating(true)}
              data-testid="button-inline-create-backlog"
            >
              <Plus className="h-4 w-4" />
              Créer un ticket
            </button>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
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
      createdAt: story.createdAt?.toString() || null,
      updatedAt: story.updatedAt?.toString() || null,
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
      estimatePoints: task.estimatePoints,
      assigneeId: task.assigneeId || null,
      reporterId: task.reporterId || null,
      order: task.order,
      version: (task as any).version || null,
      createdAt: task.createdAt?.toString() || null,
      updatedAt: task.updatedAt?.toString() || null,
    });
  });
  
  return tickets.sort((a, b) => a.order - b.order);
}
