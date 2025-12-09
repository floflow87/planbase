import { useState, useEffect } from "react";
import { 
  X, Layers, BookOpen, ListTodo, Flag, User, Calendar,
  Pencil, Trash2, Clock, Check, Tag, Link2, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Epic, UserStory, BacklogTask, Sprint, AppUser } from "@shared/schema";
import { backlogItemStateOptions, backlogPriorityOptions, complexityOptions } from "@shared/schema";
import type { FlatTicket, TicketType } from "./jira-scrum-view";

function ticketTypeIcon(type: TicketType) {
  switch (type) {
    case "epic":
      return <Layers className="h-5 w-5" />;
    case "user_story":
      return <BookOpen className="h-5 w-5" />;
    case "task":
      return <ListTodo className="h-5 w-5" />;
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

function ticketTypeLabel(type: TicketType): string {
  switch (type) {
    case "epic":
      return "Epic";
    case "user_story":
      return "User Story";
    case "task":
      return "Task";
  }
}

interface TicketDetailPanelProps {
  ticket: FlatTicket | null;
  epics?: Epic[];
  sprints?: Sprint[];
  users?: AppUser[];
  onClose: () => void;
  onUpdate: (ticketId: string, type: TicketType, data: Record<string, any>) => void;
  onDelete: (ticketId: string, type: TicketType) => void;
}

export function TicketDetailPanel({ 
  ticket, 
  epics = [],
  sprints = [],
  users = [],
  onClose, 
  onUpdate,
  onDelete
}: TicketDetailPanelProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(ticket?.title || "");
  const [editedDescription, setEditedDescription] = useState(ticket?.description || "");
  
  useEffect(() => {
    if (ticket) {
      setEditedTitle(ticket.title);
      setEditedDescription(ticket.description || "");
      setIsEditingTitle(false);
    }
  }, [ticket?.id]);
  
  if (!ticket) return null;
  
  const typeColor = ticketTypeColor(ticket.type, ticket.color);
  const assignee = users?.find(u => u.id === ticket.assigneeId);
  const parentEpic = ticket.epicId ? epics.find(e => e.id === ticket.epicId) : null;
  const currentSprint = ticket.sprintId ? sprints.find(s => s.id === ticket.sprintId) : null;
  
  const handleSaveTitle = () => {
    if (editedTitle.trim() && editedTitle !== ticket.title) {
      onUpdate(ticket.id, ticket.type, { title: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };
  
  const handleSaveDescription = () => {
    if (editedDescription !== ticket.description) {
      onUpdate(ticket.id, ticket.type, { description: editedDescription });
    }
  };
  
  return (
    <div className="w-[400px] border-l bg-card h-full flex flex-col" data-testid="ticket-detail-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div 
            className="flex items-center justify-center h-6 w-6 rounded"
            style={{ backgroundColor: typeColor }}
          >
            <span className="text-white">{ticketTypeIcon(ticket.type)}</span>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {ticketTypeLabel(ticket.type)}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(ticket.id, ticket.type)}
            data-testid="button-delete-ticket"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={onClose}
            data-testid="button-close-panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          {isEditingTitle ? (
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
                if (e.key === "Escape") {
                  setEditedTitle(ticket.title);
                  setIsEditingTitle(false);
                }
              }}
              className="text-lg font-semibold"
              autoFocus
              data-testid="input-edit-title"
            />
          ) : (
            <h2 
              className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsEditingTitle(true)}
              data-testid="text-ticket-title"
            >
              {ticket.title}
            </h2>
          )}
        </div>
        
        <Separator />
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              État
            </Label>
            <Select
              value={ticket.state || "a_faire"}
              onValueChange={(value) => onUpdate(ticket.id, ticket.type, { state: value })}
            >
              <SelectTrigger className="w-[140px] h-8" data-testid="select-state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {backlogItemStateOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Priorité
            </Label>
            <Select
              value={ticket.priority || "medium"}
              onValueChange={(value) => onUpdate(ticket.id, ticket.type, { priority: value })}
            >
              <SelectTrigger className="w-[140px] h-8" data-testid="select-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {backlogPriorityOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Assigné
            </Label>
            <Select
              value={ticket.assigneeId || "none"}
              onValueChange={(value) => onUpdate(ticket.id, ticket.type, { 
                assigneeId: value === "none" ? null : value 
              })}
            >
              <SelectTrigger className="w-[140px] h-8" data-testid="select-assignee">
                <SelectValue placeholder="Non assigné">
                  {assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs">
                          {assignee.displayName?.charAt(0) || assignee.email?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{assignee.displayName || assignee.email}</span>
                    </div>
                  ) : "Non assigné"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Non assigné</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.displayName || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {ticket.type !== "epic" && (
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Points
              </Label>
              <Select
                value={String(ticket.estimatePoints || 0)}
                onValueChange={(value) => onUpdate(ticket.id, ticket.type, { 
                  estimatePoints: parseInt(value) || null 
                })}
              >
                <SelectTrigger className="w-[140px] h-8" data-testid="select-points">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 5, 8, 13, 21].map(pts => (
                    <SelectItem key={pts} value={String(pts)}>
                      {pts === 0 ? "Non estimé" : `${pts} pts`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Sprint
            </Label>
            <Select
              value={ticket.sprintId || "backlog"}
              onValueChange={(value) => onUpdate(ticket.id, ticket.type, { 
                sprintId: value === "backlog" ? null : value 
              })}
            >
              <SelectTrigger className="w-[140px] h-8" data-testid="select-sprint">
                <SelectValue>
                  {currentSprint?.name || "Backlog"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backlog">Backlog</SelectItem>
                {sprints.map(sprint => (
                  <SelectItem key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {ticket.type === "user_story" && (
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Epic
              </Label>
              <Select
                value={ticket.epicId || "none"}
                onValueChange={(value) => onUpdate(ticket.id, ticket.type, { 
                  epicId: value === "none" ? null : value 
                })}
              >
                <SelectTrigger className="w-[140px] h-8" data-testid="select-epic">
                  <SelectValue>
                    {parentEpic?.title || "Aucun"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {epics.map(epic => (
                    <SelectItem key={epic.id} value={epic.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-2 w-2 rounded-full" 
                          style={{ backgroundColor: epic.color || "#8B5CF6" }}
                        />
                        {epic.title}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        <Separator />
        
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Description</Label>
          <Textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            onBlur={handleSaveDescription}
            placeholder="Ajoutez une description..."
            className="min-h-[120px] resize-none"
            data-testid="textarea-description"
          />
        </div>
      </div>
    </div>
  );
}
