import { useState, useMemo } from "react";
import { 
  ChevronDown, ChevronRight, Plus, MoreVertical, 
  Flag, User, Calendar, GripVertical, Play, Pause,
  Check, Layers, BookOpen, ListTodo, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Epic, UserStory, BacklogTask, Sprint, AppUser } from "@shared/schema";

export type TicketType = "epic" | "user_story" | "task";

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
  color?: string | null;
  order: number;
}

function ticketTypeIcon(type: TicketType) {
  switch (type) {
    case "epic":
      return <Layers className="h-4 w-4" />;
    case "user_story":
      return <BookOpen className="h-4 w-4" />;
    case "task":
      return <ListTodo className="h-4 w-4" />;
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
  }
}

function getStateStyle(state: string | null | undefined) {
  switch (state) {
    case "termine":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "en_cours":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "review":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
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
    default:
      return "À faire";
  }
}

function getPriorityIcon(priority: string | null | undefined) {
  const color = priority === "critical" ? "text-red-500" : 
                priority === "high" ? "text-orange-500" : 
                priority === "medium" ? "text-yellow-500" : "text-gray-400";
  return <Flag className={cn("h-3.5 w-3.5", color)} />;
}

interface TicketRowProps {
  ticket: FlatTicket;
  users?: AppUser[];
  onSelect: (ticket: FlatTicket) => void;
  onUpdateState?: (ticketId: string, type: TicketType, state: string) => void;
  isSelected?: boolean;
}

export function TicketRow({ ticket, users, onSelect, onUpdateState, isSelected }: TicketRowProps) {
  const typeColor = ticketTypeColor(ticket.type, ticket.color);
  const assignee = users?.find(u => u.id === ticket.assigneeId);
  
  return (
    <div 
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 border-b border-border/50 cursor-pointer transition-colors",
        "hover-elevate",
        isSelected && "bg-primary/5 border-l-2 border-l-primary"
      )}
      onClick={() => onSelect(ticket)}
      data-testid={`ticket-row-${ticket.type}-${ticket.id}`}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 cursor-grab" />
      
      <div 
        className="flex items-center justify-center h-5 w-5 rounded flex-shrink-0"
        style={{ backgroundColor: typeColor }}
      >
        <span className="text-white">{ticketTypeIcon(ticket.type)}</span>
      </div>
      
      <span className="flex-1 truncate text-sm font-medium" data-testid={`ticket-title-${ticket.id}`}>
        {ticket.title}
      </span>
      
      {ticket.estimatePoints && (
        <Badge variant="outline" className="text-xs px-1.5" data-testid={`ticket-points-${ticket.id}`}>
          {ticket.estimatePoints}
        </Badge>
      )}
      
      {ticket.priority && getPriorityIcon(ticket.priority)}
      
      <Badge 
        variant="secondary" 
        className={cn("text-xs px-1.5 py-0", getStateStyle(ticket.state))}
        data-testid={`ticket-state-${ticket.id}`}
      >
        {getStateLabel(ticket.state)}
      </Badge>
      
      {assignee ? (
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs bg-primary/10">
            {assignee.displayName?.charAt(0) || assignee.email?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
          <User className="h-3 w-3 text-muted-foreground/50" />
        </div>
      )}
    </div>
  );
}

interface SprintSectionProps {
  sprint: Sprint;
  tickets: FlatTicket[];
  users?: AppUser[];
  isExpanded: boolean;
  onToggle: () => void;
  onSelectTicket: (ticket: FlatTicket) => void;
  onCreateTicket: (sprintId: string, type: TicketType, title: string) => void;
  onStartSprint?: (sprintId: string) => void;
  onCompleteSprint?: (sprintId: string) => void;
  selectedTicketId?: string | null;
}

export function SprintSection({ 
  sprint, 
  tickets, 
  users,
  isExpanded, 
  onToggle, 
  onSelectTicket, 
  onCreateTicket,
  onStartSprint,
  onCompleteSprint,
  selectedTicketId
}: SprintSectionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketType, setNewTicketType] = useState<TicketType>("user_story");
  
  const totalPoints = tickets.reduce((sum, t) => sum + (t.estimatePoints || 0), 0);
  const donePoints = tickets
    .filter(t => t.state === "termine")
    .reduce((sum, t) => sum + (t.estimatePoints || 0), 0);
  
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
  
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border rounded-lg overflow-hidden bg-card" data-testid={`sprint-section-${sprint.id}`}>
        <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b">
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
          
          <span className="text-xs text-muted-foreground">
            {tickets.length} tickets | {donePoints}/{totalPoints} pts
          </span>
          
          {sprint.status === "preparation" && onStartSprint && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onStartSprint(sprint.id)}
              data-testid={`button-start-sprint-${sprint.id}`}
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Démarrer
            </Button>
          )}
          
          {sprint.status === "en_cours" && onCompleteSprint && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onCompleteSprint(sprint.id)}
              data-testid={`button-complete-sprint-${sprint.id}`}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Terminer
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-menu-sprint-${sprint.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer un ticket
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <CollapsibleContent>
          <div className="divide-y divide-border/50">
            {tickets.map(ticket => (
              <TicketRow 
                key={`${ticket.type}-${ticket.id}`}
                ticket={ticket}
                users={users}
                onSelect={onSelectTicket}
                isSelected={selectedTicketId === ticket.id}
              />
            ))}
            
            {tickets.length === 0 && !isCreating && (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                Ce sprint est vide. Glissez des tickets depuis le backlog ou créez-en un nouveau.
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
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setNewTicketType("epic")}>
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-purple-500">
                        <Layers className="h-3 w-3 text-white" />
                      </div>
                      Epic
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("user_story")}>
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-green-500">
                        <BookOpen className="h-3 w-3 text-white" />
                      </div>
                      User Story
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("task")}>
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
          
          {!isCreating && (
            <button
              className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-2"
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
  isExpanded: boolean;
  onToggle: () => void;
  onSelectTicket: (ticket: FlatTicket) => void;
  onCreateTicket: (type: TicketType, title: string) => void;
  selectedTicketId?: string | null;
}

export function BacklogPool({ 
  tickets, 
  users,
  isExpanded, 
  onToggle, 
  onSelectTicket, 
  onCreateTicket,
  selectedTicketId
}: BacklogPoolProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketType, setNewTicketType] = useState<TicketType>("user_story");
  
  const totalPoints = tickets.reduce((sum, t) => sum + (t.estimatePoints || 0), 0);
  
  const handleCreate = () => {
    if (newTicketTitle.trim()) {
      onCreateTicket(newTicketType, newTicketTitle.trim());
      setNewTicketTitle("");
      setIsCreating(false);
    }
  };
  
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border rounded-lg overflow-hidden bg-card" data-testid="backlog-pool-section">
        <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b">
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
          <div className="divide-y divide-border/50">
            {tickets.map(ticket => (
              <TicketRow 
                key={`${ticket.type}-${ticket.id}`}
                ticket={ticket}
                users={users}
                onSelect={onSelectTicket}
                isSelected={selectedTicketId === ticket.id}
              />
            ))}
            
            {tickets.length === 0 && !isCreating && (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                Votre backlog est vide. Créez des tickets pour commencer.
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
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setNewTicketType("epic")}>
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-purple-500">
                        <Layers className="h-3 w-3 text-white" />
                      </div>
                      Epic
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("user_story")}>
                      <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-green-500">
                        <BookOpen className="h-3 w-3 text-white" />
                      </div>
                      User Story
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewTicketType("task")}>
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
              className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-2"
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
      order: story.order,
    });
  });
  
  backlogTasks.forEach(task => {
    tickets.push({
      id: task.id,
      type: "task",
      title: task.title,
      description: task.description,
      state: task.state,
      priority: (task as any).priority || null,
      sprintId: (task as any).sprintId || null,
      userStoryId: task.userStoryId || null,
      estimatePoints: task.estimatePoints,
      assigneeId: task.assigneeId || null,
      order: task.order,
    });
  });
  
  return tickets.sort((a, b) => a.order - b.order);
}
