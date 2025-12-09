import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  X, Layers, BookOpen, ListTodo, Flag, User, Calendar,
  Pencil, Trash2, Clock, Check, Tag, Link2, ChevronDown, MessageSquare, History, Send
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Epic, UserStory, BacklogTask, Sprint, AppUser, TicketComment } from "@shared/schema";
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
  onConvertType?: (ticketId: string, fromType: TicketType, toType: TicketType) => void;
}

export function TicketDetailPanel({ 
  ticket, 
  epics = [],
  sprints = [],
  users = [],
  onClose, 
  onUpdate,
  onDelete,
  onConvertType
}: TicketDetailPanelProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(ticket?.title || "");
  const [editedDescription, setEditedDescription] = useState(ticket?.description || "");
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedCommentContent, setEditedCommentContent] = useState("");
  
  // Fetch comments for the ticket - only fetch when ticket is selected
  const ticketId = ticket?.id;
  const ticketType = ticket?.type;
  const { data: comments = [] } = useQuery<TicketComment[]>({
    queryKey: [`/api/tickets/${ticketId}/${ticketType}/comments`],
    enabled: !!ticketId && !!ticketType,
  });
  
  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest(`/api/tickets/${ticketId}/comments`, "POST", {
        content,
        ticketType: ticketType,
      });
    },
    onSuccess: () => {
      if (ticketId && ticketType) {
        queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}/${ticketType}/comments`] });
      }
      setNewComment("");
    },
  });
  
  // Update comment mutation
  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      return apiRequest(`/api/ticket-comments/${commentId}`, "PATCH", { content });
    },
    onSuccess: () => {
      if (ticketId && ticketType) {
        queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}/${ticketType}/comments`] });
      }
      setEditingCommentId(null);
      setEditedCommentContent("");
    },
  });
  
  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest(`/api/ticket-comments/${commentId}`, "DELETE");
    },
    onSuccess: () => {
      if (ticketId && ticketType) {
        queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}/${ticketType}/comments`] });
      }
    },
  });
  
  useEffect(() => {
    if (ticket) {
      setEditedTitle(ticket.title);
      setEditedDescription(ticket.description || "");
      setIsEditingTitle(false);
      setNewComment("");
      setEditingCommentId(null);
    }
  }, [ticket?.id]);
  
  if (!ticket) return null;
  
  const getCommentAuthor = (authorId: string) => users.find(u => u.id === authorId);
  
  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };
  
  const handleEditComment = (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      setEditingCommentId(commentId);
      setEditedCommentContent(comment.content);
    }
  };
  
  const handleSaveEditedComment = () => {
    if (editingCommentId && editedCommentContent.trim()) {
      updateCommentMutation.mutate({ commentId: editingCommentId, content: editedCommentContent.trim() });
    }
  };
  
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
    <div className="w-[400px] border-l bg-card fixed top-0 right-0 h-screen flex flex-col z-50 shadow-lg" data-testid="ticket-detail-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-80 cursor-pointer" data-testid="button-change-type">
              <div 
                className="flex items-center justify-center h-6 w-6 rounded"
                style={{ backgroundColor: typeColor }}
              >
                <span className="text-white">{ticketTypeIcon(ticket.type)}</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {ticketTypeLabel(ticket.type)}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-white dark:bg-white">
            <DropdownMenuItem 
              onClick={() => ticket.type !== "epic" && onConvertType?.(ticket.id, ticket.type, "epic")}
              className={cn("text-gray-900", ticket.type === "epic" && "opacity-50")}
              disabled={ticket.type === "epic"}
            >
              <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-purple-500">
                <Layers className="h-3 w-3 text-white" />
              </div>
              Epic
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => ticket.type !== "user_story" && onConvertType?.(ticket.id, ticket.type, "user_story")}
              className={cn("text-gray-900", ticket.type === "user_story" && "opacity-50")}
              disabled={ticket.type === "user_story"}
            >
              <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-green-500">
                <BookOpen className="h-3 w-3 text-white" />
              </div>
              User Story
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => ticket.type !== "task" && onConvertType?.(ticket.id, ticket.type, "task")}
              className={cn("text-gray-900", ticket.type === "task" && "opacity-50")}
              disabled={ticket.type === "task"}
            >
              <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-blue-500">
                <ListTodo className="h-3 w-3 text-white" />
              </div>
              Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
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
        
        {/* Description - moved under title */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Description</Label>
          <Textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            onBlur={handleSaveDescription}
            placeholder="Ajoutez une description..."
            className="min-h-[100px] resize-none"
            data-testid="textarea-description"
          />
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
              <SelectContent className="bg-white dark:bg-white">
                {backlogItemStateOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-gray-900">{opt.label}</SelectItem>
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
              <SelectContent className="bg-white dark:bg-white">
                {backlogPriorityOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-gray-900">{opt.label}</SelectItem>
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
              <SelectContent className="bg-white dark:bg-white">
                <SelectItem value="none" className="text-gray-900">Non assigné</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id} className="text-gray-900">
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
                  estimatePoints: parseFloat(value) || null 
                })}
              >
                <SelectTrigger className="w-[140px] h-8" data-testid="select-points">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-white">
                  {[0, 0.25, 0.5, 1, 2, 3, 5, 8, 13, 21].map(pts => (
                    <SelectItem key={pts} value={String(pts)} className="text-gray-900">
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
              <SelectContent className="bg-white dark:bg-white">
                <SelectItem value="backlog" className="text-gray-900">Backlog</SelectItem>
                {sprints.map(sprint => (
                  <SelectItem key={sprint.id} value={sprint.id} className="text-gray-900">
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
                <SelectContent className="bg-white dark:bg-white">
                  <SelectItem value="none" className="text-gray-900">Aucun</SelectItem>
                  {epics.map(epic => (
                    <SelectItem key={epic.id} value={epic.id} className="text-gray-900">
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
        
        {/* Activity Log */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground flex items-center gap-2">
            <History className="h-4 w-4" />
            Activité
          </Label>
          <div className="text-sm text-muted-foreground space-y-1">
            {ticket.createdAt && (
              <p data-testid="text-created-at">
                Création {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: fr })}
              </p>
            )}
            {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
              <p data-testid="text-updated-at">
                Mis à jour {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true, locale: fr })}
              </p>
            )}
          </div>
        </div>
        
        <Separator />
        
        {/* Comments Section */}
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          <Label className="text-sm text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Commentaires ({comments.length})
          </Label>
          
          {/* Comments List */}
          <div className="flex-1 overflow-y-auto space-y-3" data-testid="comments-list">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Aucun commentaire</p>
            ) : (
              comments.map(comment => {
                const author = getCommentAuthor(comment.authorId);
                const isEditing = editingCommentId === comment.id;
                
                return (
                  <div 
                    key={comment.id} 
                    className="bg-muted/50 rounded-lg p-3 space-y-2"
                    data-testid={`comment-${comment.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-violet-100 text-violet-700">
                            {author?.firstName?.charAt(0) || author?.email?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {author?.firstName || author?.email || "Inconnu"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleEditComment(comment.id)}
                          data-testid={`button-edit-comment-${comment.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => deleteCommentMutation.mutate(comment.id)}
                          data-testid={`button-delete-comment-${comment.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editedCommentContent}
                          onChange={(e) => setEditedCommentContent(e.target.value)}
                          className="min-h-[60px] text-sm"
                          data-testid={`textarea-edit-comment-${comment.id}`}
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={handleSaveEditedComment}
                            disabled={updateCommentMutation.isPending}
                            data-testid={`button-save-comment-${comment.id}`}
                          >
                            Sauvegarder
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setEditingCommentId(null)}
                            data-testid={`button-cancel-edit-${comment.id}`}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
          
          {/* Add Comment Input */}
          <div className="flex gap-2 pt-2 border-t">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ajouter un commentaire..."
              className="min-h-[60px] text-sm flex-1"
              data-testid="textarea-new-comment"
            />
            <Button
              size="icon"
              className="h-[60px] bg-violet-600 hover:bg-violet-700"
              onClick={handleAddComment}
              disabled={!newComment.trim() || addCommentMutation.isPending}
              data-testid="button-add-comment"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
