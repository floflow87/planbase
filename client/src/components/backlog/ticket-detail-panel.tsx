import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  X, Layers, BookOpen, ListTodo, Flag, User, Calendar,
  Pencil, Trash2, Clock, Check, Tag, Link2, ChevronDown, MessageSquare, History, Send, FileText, Plus, ChevronsUpDown, ClipboardList, FlaskConical, ExternalLink, Wrench, ArrowRight
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
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Epic, UserStory, BacklogTask, Sprint, AppUser, TicketComment, Note, EntityLink, Project, Activity, TicketAcceptanceCriteria } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { backlogItemStateOptions, backlogPriorityOptions, complexityOptions, recipeConclusionOptions, type RecipeConclusion } from "@shared/schema";
import type { FlatTicket, TicketType } from "./jira-scrum-view";
import { PriorityIcon } from "./jira-scrum-view";

function ticketTypeIcon(type: TicketType) {
  switch (type) {
    case "epic":
      return <Layers className="h-5 w-5" />;
    case "user_story":
      return <BookOpen className="h-5 w-5" />;
    case "task":
      return <ListTodo className="h-5 w-5" />;
    case "bug":
      return <Wrench className="h-5 w-5 text-red-500" />;
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

function ticketTypeLabel(type: TicketType): string {
  switch (type) {
    case "epic":
      return "Epic";
    case "user_story":
      return "User Story";
    case "task":
      return "Task";
    case "bug":
      return "Bug";
  }
}

function getStateStyle(state: string | null | undefined) {
  switch (state) {
    case "termine":
      return { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" };
    case "en_cours":
      return { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" };
    case "review":
      return { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" };
    case "testing":
      return { bg: "bg-cyan-100", text: "text-cyan-700", dot: "bg-cyan-500" };
    case "to_fix":
      return { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" };
    case "bloque":
      return { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
  }
}

// Recipe data type for ticket detail
export type TicketRecipeInfo = {
  conclusion: RecipeConclusion | null;
  sprintId: string;
  sprintName: string;
} | null;

interface TicketDetailPanelProps {
  ticket: FlatTicket | null;
  epics?: Epic[];
  sprints?: Sprint[];
  users?: AppUser[];
  projects?: Project[];
  backlogProjectId?: string | null;
  backlogName?: string;
  ticketIndex?: number;
  onClose: () => void;
  onUpdate: (ticketId: string, type: TicketType, data: Record<string, any>) => void;
  onDelete: (ticketId: string, type: TicketType) => void;
  onConvertType?: (ticketId: string, fromType: TicketType, toType: TicketType) => void;
  onCreateTask?: (ticket: FlatTicket, projectId: string, taskTitle: string) => void;
  readOnly?: boolean;
  recipeInfo?: TicketRecipeInfo;
  onOpenRecipe?: (ticketId: string, sprintId: string) => void;
}

export function TicketDetailPanel({ 
  ticket, 
  epics = [],
  sprints = [],
  users = [],
  projects = [],
  backlogProjectId,
  backlogName,
  ticketIndex,
  onClose, 
  onUpdate,
  onDelete,
  onConvertType,
  onCreateTask,
  readOnly = false,
  recipeInfo,
  onOpenRecipe,
}: TicketDetailPanelProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(ticket?.title || "");
  const [editedDescription, setEditedDescription] = useState(ticket?.description || "");
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedCommentContent, setEditedCommentContent] = useState("");
  
  // Create task dialog state
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [createTaskProjectId, setCreateTaskProjectId] = useState<string>("");
  const [createTaskTitle, setCreateTaskTitle] = useState("");
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  
  // Fetch comments for the ticket - only fetch when ticket is selected
  const ticketId = ticket?.id;
  const ticketType = ticket?.type;
  
  // Use segmented array key and skip registration when no ticket selected
  const commentsQueryKey = ["/api/tickets", ticketId ?? "", ticketType ?? "", "comments"] as const;
  
  const { data: comments = [] } = useQuery<TicketComment[]>({
    queryKey: commentsQueryKey,
    queryFn: async () => {
      if (!ticketId || !ticketType) return [];
      const res = await apiRequest(`/api/tickets/${ticketId}/${ticketType}/comments`, "GET");
      return res.json();
    },
    enabled: !!ticketId && !!ticketType,
    staleTime: 0,
  });
  
  // Fetch activities (state changes) for the ticket
  type TicketActivity = Activity & { user?: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null } };
  // Map ticketType to backend subjectType: task -> backlog_task, bug -> backlog_task
  const activitySubjectType = ticketType === "task" || ticketType === "bug" ? "backlog_task" : ticketType;
  const activitiesQueryKey = ["/api/tickets", ticketId ?? "", activitySubjectType ?? "", "activities"] as const;
  
  const { data: ticketActivities = [] } = useQuery<TicketActivity[]>({
    queryKey: activitiesQueryKey,
    queryFn: async () => {
      if (!ticketId || !activitySubjectType) return [];
      console.log(`📊 Frontend: Fetching activities for ticket ${ticketId}, subjectType ${activitySubjectType}`);
      const res = await apiRequest(`/api/tickets/${ticketId}/${activitySubjectType}/activities`, "GET");
      const activities = await res.json();
      console.log(`📊 Frontend: Got ${activities.length} activities:`, activities);
      return activities;
    },
    enabled: !!ticketId && !!activitySubjectType,
    staleTime: 30000,
  });
  
  // Filter only state change activities
  const stateChangeActivities = ticketActivities.filter(a => 
    (a.payload as any)?.type === "state_change"
  );
  
  // Debug: Log state change activities
  if (stateChangeActivities.length > 0) {
    console.log(`📊 Frontend: ${stateChangeActivities.length} state change activities found`);
  }
  
  // Fetch recipe for the ticket (if not provided via prop)
  const { data: fetchedRecipeData } = useQuery<{ recipe: TicketRecipeInfo & { conclusion: RecipeConclusion | null } | null }>({
    queryKey: ["/api/tickets", ticketId, "recipe"],
    queryFn: async () => {
      if (!ticketId) return { recipe: null };
      const res = await apiRequest(`/api/tickets/${ticketId}/recipe`, "GET");
      return res.json();
    },
    enabled: !!ticketId && (ticketType === "user_story" || ticketType === "task") && !recipeInfo,
    staleTime: 30000,
  });
  
  // Use prop recipeInfo if provided, otherwise use fetched data
  const effectiveRecipeInfo: TicketRecipeInfo = recipeInfo || (fetchedRecipeData?.recipe ? {
    conclusion: fetchedRecipeData.recipe.conclusion,
    sprintId: fetchedRecipeData.recipe.sprintId,
    sprintName: fetchedRecipeData.recipe.sprintName,
  } : null);
  
  // Acceptance Criteria - State and queries
  const [newCriterionText, setNewCriterionText] = useState("");
  const [editingCriterionId, setEditingCriterionId] = useState<string | null>(null);
  const [editingCriterionText, setEditingCriterionText] = useState("");
  
  // Fetch acceptance criteria for the ticket
  const acceptanceCriteriaQueryKey = ["/api/tickets", ticketId, ticketType, "acceptance-criteria"] as const;
  const { data: acceptanceCriteria = [] } = useQuery<TicketAcceptanceCriteria[]>({
    queryKey: acceptanceCriteriaQueryKey,
    queryFn: async () => {
      if (!ticketId || !ticketType) return [];
      const res = await apiRequest(`/api/tickets/${ticketId}/${ticketType}/acceptance-criteria`, "GET");
      return res.json();
    },
    enabled: !!ticketId && !!ticketType && ticketType !== "epic",
  });
  
  // Create acceptance criterion mutation
  const createCriterionMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest(`/api/tickets/${ticketId}/${ticketType}/acceptance-criteria`, "POST", { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: acceptanceCriteriaQueryKey });
      setNewCriterionText("");
    },
  });
  
  // Update acceptance criterion mutation
  const updateCriterionMutation = useMutation({
    mutationFn: async ({ criterionId, content }: { criterionId: string; content: string }) => {
      const res = await apiRequest(`/api/acceptance-criteria/${criterionId}`, "PATCH", { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: acceptanceCriteriaQueryKey });
      setEditingCriterionId(null);
      setEditingCriterionText("");
    },
  });
  
  // Delete acceptance criterion mutation
  const deleteCriterionMutation = useMutation({
    mutationFn: async (criterionId: string) => {
      const res = await apiRequest(`/api/acceptance-criteria/${criterionId}`, "DELETE");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: acceptanceCriteriaQueryKey });
    },
  });
  
  // Get all notes for linking
  const { data: allNotes = [] } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });
  
  // Get entity links for this ticket
  const ticketEntityType = ticketType === "epic" ? "epic" : ticketType === "user_story" ? "user_story" : "task";
  const entityLinksQueryKey = ["/api/entity-links", ticketEntityType, ticketId] as const;
  
  const { data: entityLinks = [] } = useQuery<EntityLink[]>({
    queryKey: entityLinksQueryKey,
    queryFn: async () => {
      if (!ticketId || !ticketType) return [];
      const res = await apiRequest(`/api/entity-links`, "GET");
      const allLinks = await res.json();
      return allLinks.filter((link: EntityLink) => 
        (link.sourceType === ticketEntityType && link.sourceId === ticketId) ||
        (link.targetType === ticketEntityType && link.targetId === ticketId)
      );
    },
    enabled: !!ticketId && !!ticketType,
  });
  
  // Filter to get only note links
  const linkedNoteIds = entityLinks
    .filter(link => link.targetType === "note" || link.sourceType === "note")
    .map(link => link.targetType === "note" ? link.targetId : link.sourceId);
  
  const linkedNotes = allNotes.filter(note => linkedNoteIds.includes(note.id));
  const availableNotes = allNotes.filter(note => !linkedNoteIds.includes(note.id));
  
  // Link note mutation
  const linkNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest("/api/entity-links", "POST", {
        sourceType: ticketEntityType,
        sourceId: ticketId,
        targetType: "note",
        targetId: noteId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entityLinksQueryKey });
    },
  });
  
  // Unlink note mutation
  const unlinkNoteMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return apiRequest(`/api/entity-links/${linkId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entityLinksQueryKey });
    },
  });
  
  // Helper to find the link ID for a note
  const findLinkIdForNote = (noteId: string) => {
    const link = entityLinks.find(
      l => (l.targetType === "note" && l.targetId === noteId) ||
           (l.sourceType === "note" && l.sourceId === noteId)
    );
    return link?.id;
  };
  
  // Add comment mutation - pass ticketId and ticketType explicitly
  const addCommentMutation = useMutation({
    mutationFn: async ({ content, tId, tType }: { content: string; tId: string; tType: string }) => {
      return apiRequest(`/api/tickets/${tId}/${tType}/comments`, "POST", {
        content,
      });
    },
    onMutate: async ({ content, tId, tType }) => {
      const key = ["/api/tickets", tId, tType, "comments"];
      await queryClient.cancelQueries({ queryKey: key });
      const previousComments = queryClient.getQueryData<TicketComment[]>(key);
      if (previousComments) {
        const tempComment = { id: `temp-${Date.now()}`, content, ticketId: tId, ticketType: tType, authorId: "current-user", createdAt: new Date().toISOString() } as TicketComment;
        queryClient.setQueryData<TicketComment[]>(key, [...previousComments, tempComment]);
      }
      return { previousComments, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousComments && context.key) queryClient.setQueryData(context.key, context.previousComments);
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", variables.tId, variables.tType, "comments"] });
    },
    onSuccess: () => setNewComment(""),
  });
  
  // Update comment mutation
  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, content, tId, tType }: { commentId: string; content: string; tId: string; tType: string }) => {
      return apiRequest(`/api/ticket-comments/${commentId}`, "PATCH", { content });
    },
    onMutate: async ({ commentId, content, tId, tType }) => {
      const key = ["/api/tickets", tId, tType, "comments"];
      await queryClient.cancelQueries({ queryKey: key });
      const previousComments = queryClient.getQueryData<TicketComment[]>(key);
      if (previousComments) {
        queryClient.setQueryData<TicketComment[]>(key, previousComments.map(c => c.id === commentId ? { ...c, content } : c));
      }
      return { previousComments, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousComments && context.key) queryClient.setQueryData(context.key, context.previousComments);
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", variables.tId, variables.tType, "comments"] });
    },
    onSuccess: () => {
      setEditingCommentId(null);
      setEditedCommentContent("");
    },
  });
  
  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async ({ commentId, tId, tType }: { commentId: string; tId: string; tType: string }) => {
      return apiRequest(`/api/ticket-comments/${commentId}`, "DELETE");
    },
    onMutate: async ({ commentId, tId, tType }) => {
      const key = ["/api/tickets", tId, tType, "comments"];
      await queryClient.cancelQueries({ queryKey: key });
      const previousComments = queryClient.getQueryData<TicketComment[]>(key);
      if (previousComments) {
        queryClient.setQueryData<TicketComment[]>(key, previousComments.filter(c => c.id !== commentId));
      }
      return { previousComments, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousComments && context.key) queryClient.setQueryData(context.key, context.previousComments);
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", variables.tId, variables.tType, "comments"] });
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
    if (newComment.trim() && ticketId && ticketType) {
      addCommentMutation.mutate({ content: newComment.trim(), tId: ticketId, tType: ticketType });
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
    if (editingCommentId && editedCommentContent.trim() && ticketId && ticketType) {
      updateCommentMutation.mutate({ commentId: editingCommentId, content: editedCommentContent.trim(), tId: ticketId, tType: ticketType });
    }
  };
  
  const typeColor = ticketTypeColor(ticket.type, ticket.color);
  const assignee = users?.find(u => u.id === ticket.assigneeId);
  const reporter = users?.find(u => u.id === ticket.reporterId);
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
  
  // Create task handler
  const handleOpenCreateTaskDialog = () => {
    // Pre-fill with backlog's linked project if available
    setCreateTaskProjectId(backlogProjectId || "");
    setCreateTaskTitle(ticket?.title || "");
    setShowCreateTaskDialog(true);
  };
  
  const handleCreateTask = () => {
    if (!createTaskProjectId || !createTaskTitle.trim() || !ticket) return;
    onCreateTask?.(ticket, createTaskProjectId, createTaskTitle.trim());
    setShowCreateTaskDialog(false);
    setCreateTaskProjectId("");
    setCreateTaskTitle("");
  };
  
  // Generate ticket ID with nomenclature [BacklogFirst3-SprintFirst3-NumIncremental]
  const generateTicketId = () => {
    if (!ticket) return null;
    // Guard against invalid index (ticket not found in list)
    if (ticketIndex === undefined || ticketIndex < 0) return null;
    
    // Get first 3 letters of backlog name (uppercase)
    const backlogPrefix = backlogName 
      ? backlogName.substring(0, 3).toUpperCase() 
      : "BKL";
    
    // Get first 3 letters of sprint name (uppercase), or "BCK" for backlog items
    const currentSprint = sprints.find(s => s.id === ticket.sprintId);
    const sprintPrefix = currentSprint 
      ? currentSprint.name.substring(0, 3).toUpperCase() 
      : "BCK";
    
    // Format index with 2 digits (01, 02, etc.)
    const indexStr = String(ticketIndex + 1).padStart(2, "0");
    
    return `${backlogPrefix}-${sprintPrefix}-${indexStr}`;
  };
  
  const ticketIdLabel = generateTicketId();
  
  return (
    <div className="w-[400px] border-l bg-card fixed top-0 right-0 h-screen flex flex-col z-50 shadow-lg" data-testid="ticket-detail-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        {readOnly ? (
          <div className="flex items-center gap-2">
            <div 
              className="flex items-center justify-center h-6 w-6 rounded"
              style={{ backgroundColor: typeColor }}
            >
              <span className="text-white">{ticketTypeIcon(ticket.type)}</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {ticketTypeLabel(ticket.type)}
            </span>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 cursor-pointer" data-testid="button-change-type">
                <div 
                  className="flex items-center justify-center h-6 w-6 rounded"
                  style={{ backgroundColor: typeColor }}
                >
                  <span className="text-white">{ticketTypeIcon(ticket.type)}</span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
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
              <DropdownMenuItem 
                onClick={() => ticket.type !== "bug" && onConvertType?.(ticket.id, ticket.type, "bug")}
                className={cn("text-gray-900", ticket.type === "bug" && "opacity-50")}
                disabled={ticket.type === "bug"}
              >
                <div className="h-4 w-4 rounded flex items-center justify-center mr-2 bg-red-500">
                  <Wrench className="h-3 w-3 text-white" />
                </div>
                Bug
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        <div className="flex items-center gap-2">
          {ticketIdLabel && (
            <Badge variant="outline" className="text-xs font-mono" data-testid="text-ticket-id">
              {ticketIdLabel}
            </Badge>
          )}
          <div className="flex items-center gap-1">
            {!readOnly && onCreateTask && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-primary hover:text-primary"
                onClick={handleOpenCreateTaskDialog}
                data-testid="button-create-task-from-ticket"
                title="Créer une tâche"
              >
                <ClipboardList className="h-4 w-4" />
              </Button>
            )}
            {!readOnly && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(ticket.id, ticket.type)}
                data-testid="button-delete-ticket"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          {!readOnly && isEditingTitle ? (
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
              className="text-base font-semibold"
              autoFocus
              data-testid="input-edit-title"
            />
          ) : (
            <h2 
              className={cn(
                "text-base font-semibold",
                !readOnly && "cursor-pointer hover:text-primary transition-colors"
              )}
              onClick={() => !readOnly && setIsEditingTitle(true)}
              data-testid="text-ticket-title"
            >
              {ticket.title}
            </h2>
          )}
        </div>
        
        {/* Epic selector - directly under title for US and Task */}
        {ticket.type !== "epic" && epics.length > 0 && (
          <div className="flex items-center gap-2">
            <Select
              value={ticket.epicId || "none"}
              onValueChange={(value) => onUpdate(ticket.id, ticket.type, { 
                epicId: value === "none" ? null : value 
              })}
              disabled={readOnly}
            >
              <SelectTrigger 
                className={cn(
                  "h-7 text-xs bg-white gap-2 w-auto min-w-[180px]", 
                  readOnly && "opacity-60",
                  !readOnly && "cursor-pointer hover:bg-gray-50"
                )} 
                data-testid="select-epic-top"
              >
                <SelectValue>
                  {parentEpic ? (
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-2 w-2 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: parentEpic.color || "#8B5CF6" }}
                      />
                      <span className="truncate">{parentEpic.title}</span>
                    </div>
                  ) : <span className="text-gray-500">Aucun epic</span>}
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
        
        {/* Description - moved under title */}
        <div className="space-y-2">
          {readOnly ? (
            <div className="text-sm text-muted-foreground min-h-[60px] p-3 bg-muted/30 rounded-md whitespace-pre-wrap">
              {ticket.description || "Aucune description"}
            </div>
          ) : (
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              onBlur={handleSaveDescription}
              placeholder="Ajoutez une description..."
              className="min-h-[100px] resize-none text-xs"
              data-testid="textarea-description"
            />
          )}
        </div>
        
        <Separator />
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3" />
              État
            </Label>
            <Select
              value={ticket.state || "a_faire"}
              onValueChange={(value) => onUpdate(ticket.id, ticket.type, { state: value })}
            >
              <SelectTrigger className="w-[140px] h-7 text-xs cursor-pointer" data-testid="select-state">
                <SelectValue>
                  {(() => {
                    const style = getStateStyle(ticket.state);
                    const label = backlogItemStateOptions.find(o => o.value === ticket.state)?.label || "À faire";
                    return (
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", style.dot)} />
                        <span className={style.text}>{label}</span>
                      </div>
                    );
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-white">
                {backlogItemStateOptions.map(opt => {
                  const style = getStateStyle(opt.value);
                  return (
                    <SelectItem key={opt.value} value={opt.value} className="text-gray-900 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", style.dot)} />
                        <span className={style.text}>{opt.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Flag className="h-3 w-3" />
              Priorité
            </Label>
            <Select
              value={ticket.priority || "medium"}
              onValueChange={(value) => onUpdate(ticket.id, ticket.type, { priority: value })}
              disabled={readOnly}
            >
              <SelectTrigger className={cn("w-[140px] h-7 text-xs", readOnly && "opacity-60")} data-testid="select-priority">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <PriorityIcon priority={ticket.priority || "medium"} />
                    <span>{backlogPriorityOptions.find(o => o.value === (ticket.priority || "medium"))?.label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-white">
                {backlogPriorityOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-gray-900">
                    <div className="flex items-center gap-2">
                      <PriorityIcon priority={opt.value} />
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <User className="h-3 w-3" />
              Assigné
            </Label>
            <Select
              value={ticket.assigneeId || "none"}
              onValueChange={(value) => onUpdate(ticket.id, ticket.type, { 
                assigneeId: value === "none" ? null : value 
              })}
              disabled={readOnly}
            >
              <SelectTrigger className={cn("w-[140px] h-7 text-xs", readOnly && "opacity-60")} data-testid="select-assignee">
                <SelectValue placeholder="Non assigné">
                  {assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs">
                          {assignee.firstName?.charAt(0) || assignee.email?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{assignee.firstName && assignee.lastName ? `${assignee.firstName} ${assignee.lastName}` : assignee.email}</span>
                    </div>
                  ) : "Non assigné"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-white">
                <SelectItem value="none" className="text-gray-900">Non assigné</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id} className="text-gray-900">
                    {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {ticket.type !== "epic" && (
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                <User className="h-3 w-3" />
                Rapporteur
              </Label>
              <Select
                value={ticket.reporterId || "none"}
                onValueChange={(value) => onUpdate(ticket.id, ticket.type, { 
                  reporterId: value === "none" ? null : value 
                })}
                disabled={readOnly}
              >
                <SelectTrigger className={cn("w-[140px] h-7 text-xs", readOnly && "opacity-60")} data-testid="select-reporter">
                  <SelectValue placeholder="Non défini">
                    {reporter ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-xs">
                            {reporter.firstName?.charAt(0) || reporter.email?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{reporter.firstName && reporter.lastName ? `${reporter.firstName} ${reporter.lastName}` : reporter.email}</span>
                      </div>
                    ) : "Non défini"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-white">
                  <SelectItem value="none" className="text-gray-900">Non défini</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id} className="text-gray-900">
                      {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {ticket.type !== "epic" && (
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                <Tag className="h-3 w-3" />
                Points
              </Label>
              <Select
                value={String(ticket.estimatePoints || 0)}
                onValueChange={(value) => onUpdate(ticket.id, ticket.type, { 
                  estimatePoints: parseFloat(value) || null 
                })}
                disabled={readOnly}
              >
                <SelectTrigger className={cn("w-[140px] h-7 text-xs", readOnly && "opacity-60")} data-testid="select-points">
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
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              Sprint
            </Label>
            <Select
              value={ticket.sprintId || "backlog"}
              onValueChange={(value) => onUpdate(ticket.id, ticket.type, { 
                sprintId: value === "backlog" ? null : value 
              })}
              disabled={readOnly}
            >
              <SelectTrigger className={cn("w-[140px] h-7 text-xs", readOnly && "opacity-60")} data-testid="select-sprint">
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
          
          {/* Version selector */}
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Tag className="h-3 w-3" />
              Version
            </Label>
            <Select
              value={ticket.version || "none"}
              onValueChange={(value) => onUpdate(ticket.id, ticket.type, { 
                version: value === "none" ? null : value 
              })}
              disabled={readOnly}
            >
              <SelectTrigger className={cn("w-[140px] h-7 text-xs", readOnly && "opacity-60")} data-testid="select-version">
                <SelectValue placeholder="Version">
                  {ticket.version || "Aucune"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-white">
                <SelectItem value="none" className="text-gray-900">Aucune</SelectItem>
                <SelectItem value="1.0.0" className="text-gray-900">1.0.0</SelectItem>
                <SelectItem value="1.1.0" className="text-gray-900">1.1.0</SelectItem>
                <SelectItem value="1.2.0" className="text-gray-900">1.2.0</SelectItem>
                <SelectItem value="2.0.0" className="text-gray-900">2.0.0</SelectItem>
                <SelectItem value="MVP" className="text-gray-900">MVP</SelectItem>
                <SelectItem value="Beta" className="text-gray-900">Beta</SelectItem>
                <SelectItem value="Alpha" className="text-gray-900">Alpha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Linked Notes Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                <FileText className="h-3 w-3" />
                Notes liées ({linkedNotes.length})
              </Label>
              {!readOnly && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      disabled={availableNotes.length === 0}
                      data-testid="button-add-note-link"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="end">
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {availableNotes.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2">Aucune note disponible</p>
                      ) : (
                        availableNotes.map(note => (
                          <Button
                            key={note.id}
                            variant="ghost"
                            className="w-full justify-start text-left h-auto py-2"
                            onClick={() => linkNoteMutation.mutate(note.id)}
                            disabled={linkNoteMutation.isPending}
                            data-testid={`button-link-note-${note.id}`}
                          >
                            <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span className="truncate">{note.title || "Note sans titre"}</span>
                          </Button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            {linkedNotes.length > 0 ? (
              <div className="space-y-1">
                {linkedNotes.map(note => {
                  const linkId = findLinkIdForNote(note.id);
                  return (
                    <div 
                      key={note.id} 
                      className="flex items-center justify-between p-2 rounded bg-muted/50 group"
                      data-testid={`linked-note-${note.id}`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate">{note.title || "Note sans titre"}</span>
                      </div>
                      {!readOnly && linkId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => unlinkNoteMutation.mutate(linkId)}
                          disabled={unlinkNoteMutation.isPending}
                          data-testid={`button-unlink-note-${note.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Aucune note liée</p>
            )}
          </div>
          
          {/* Acceptance Criteria Section */}
          {ticket && (ticket.type === "user_story" || ticket.type === "task" || ticket.type === "bug") && (
            <>
              <Separator />
              <div className="space-y-2" data-testid="acceptance-criteria-section">
                <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
                  <ClipboardList className="h-3 w-3" />
                  Critères d'acceptation
                </Label>
                
                {/* Existing criteria */}
                {acceptanceCriteria.length > 0 && (
                  <div className="space-y-1">
                    {acceptanceCriteria.map((criterion, index) => (
                      <div 
                        key={criterion.id} 
                        className="flex items-center gap-2 group"
                        data-testid={`acceptance-criterion-${criterion.id}`}
                      >
                        <span className="text-xs text-muted-foreground w-4 flex-shrink-0">{index + 1}.</span>
                        {editingCriterionId === criterion.id ? (
                          <Input
                            value={editingCriterionText}
                            onChange={(e) => setEditingCriterionText(e.target.value)}
                            onBlur={() => {
                              if (editingCriterionText.trim() && editingCriterionText !== criterion.content) {
                                updateCriterionMutation.mutate({ criterionId: criterion.id, content: editingCriterionText.trim() });
                              } else {
                                setEditingCriterionId(null);
                                setEditingCriterionText("");
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              } else if (e.key === "Escape") {
                                setEditingCriterionId(null);
                                setEditingCriterionText("");
                              }
                            }}
                            className="h-7 text-xs flex-1"
                            autoFocus
                            data-testid={`input-edit-criterion-${criterion.id}`}
                          />
                        ) : (
                          <span 
                            className="text-sm flex-1 cursor-pointer hover:text-foreground/80"
                            onClick={() => {
                              if (!readOnly) {
                                setEditingCriterionId(criterion.id);
                                setEditingCriterionText(criterion.content);
                              }
                            }}
                          >
                            {criterion.content}
                          </span>
                        )}
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteCriterionMutation.mutate(criterion.id)}
                            disabled={deleteCriterionMutation.isPending}
                            data-testid={`button-delete-criterion-${criterion.id}`}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add new criterion */}
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newCriterionText}
                      onChange={(e) => setNewCriterionText(e.target.value)}
                      placeholder="Nouveau critère..."
                      className="h-7 text-xs flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCriterionText.trim()) {
                          createCriterionMutation.mutate(newCriterionText.trim());
                        }
                      }}
                      data-testid="input-new-criterion"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        if (newCriterionText.trim()) {
                          createCriterionMutation.mutate(newCriterionText.trim());
                        }
                      }}
                      disabled={!newCriterionText.trim() || createCriterionMutation.isPending}
                      data-testid="button-add-criterion"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Recipe Section */}
          {ticket && (ticket.type === "user_story" || ticket.type === "task") && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
                  <FlaskConical className="h-3 w-3" />
                  Recette
                </Label>
                {effectiveRecipeInfo ? (
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <div className="flex items-center gap-2">
                      {effectiveRecipeInfo.conclusion ? (
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={{ 
                            borderColor: recipeConclusionOptions.find(o => o.value === effectiveRecipeInfo.conclusion)?.color || "#9CA3AF",
                            color: recipeConclusionOptions.find(o => o.value === effectiveRecipeInfo.conclusion)?.color || "#9CA3AF"
                          }}
                        >
                          {recipeConclusionOptions.find(o => o.value === effectiveRecipeInfo.conclusion)?.label || "En cours"}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Pas de conclusion</span>
                      )}
                      <span className="text-xs text-muted-foreground">• {effectiveRecipeInfo.sprintName}</span>
                    </div>
                    {onOpenRecipe && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => onOpenRecipe(ticket.id, effectiveRecipeInfo.sprintId)}
                        data-testid="button-open-recipe"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Voir la recette
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucune recette disponible</p>
                )}
              </div>
            </>
          )}
          
          {/* Read-only notice */}
          {readOnly && (
            <div className="mt-2 p-2 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                Ce ticket est terminé. Changez son état pour le modifier.
              </p>
            </div>
          )}
        </div>
        
        <Separator />
        
        {/* Activity Log */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
            <History className="h-3 w-3" />
            Activité
          </Label>
          <div className="text-xs text-muted-foreground space-y-2 max-h-40 overflow-y-auto">
            {ticket.createdAt && (
              <p data-testid="text-created-at">
                Création {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: fr })}
              </p>
            )}
            
            {/* State change activities */}
            {stateChangeActivities.map((activity) => {
              const payload = activity.payload as any;
              const previousStateLabel = backlogItemStateOptions.find(s => s.value === payload.previousState)?.label || payload.previousState;
              const newStateLabel = backlogItemStateOptions.find(s => s.value === payload.newState)?.label || payload.newState;
              const previousStyle = getStateStyle(payload.previousState);
              const newStyle = getStateStyle(payload.newState);
              const userName = activity.user?.firstName && activity.user?.lastName 
                ? `${activity.user.firstName} ${activity.user.lastName}` 
                : activity.user?.email || "Utilisateur";
              
              return (
                <div key={activity.id} className="text-xs p-1.5 rounded bg-muted/30 space-y-0.5" data-testid={`activity-state-change-${activity.id}`}>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-violet-500 flex-shrink-0" />
                    <span className="flex-1">
                      <span className="font-medium">{userName}</span>
                      {" : "}
                      <Badge variant="secondary" className={cn("text-[10px] px-1 py-0", previousStyle.bg, previousStyle.text)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full mr-1 inline-block", previousStyle.dot)} />
                        {previousStateLabel}
                      </Badge>
                      {" → "}
                      <Badge variant="secondary" className={cn("text-[10px] px-1 py-0", newStyle.bg, newStyle.text)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full mr-1 inline-block", newStyle.dot)} />
                        {newStateLabel}
                      </Badge>
                    </span>
                  </div>
                  <div className="text-muted-foreground text-[10px] pl-5">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: fr })}
                  </div>
                </div>
              );
            })}
            
            {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && stateChangeActivities.length === 0 && (
              <p data-testid="text-updated-at">
                Mis à jour {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true, locale: fr })}
              </p>
            )}
          </div>
        </div>
        
        <Separator />
        
        {/* Comments Section */}
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
            <MessageSquare className="h-3 w-3" />
            Commentaires ({comments.length})
          </Label>
          
          {/* Comments List */}
          <div className="flex-1 overflow-y-auto space-y-3" data-testid="comments-list">
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucun commentaire</p>
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
                        <span className="text-xs font-medium">
                          {author?.firstName && author?.lastName ? `${author.firstName} ${author.lastName}` : author?.email || "Inconnu"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
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
                          onClick={() => ticketId && ticketType && deleteCommentMutation.mutate({ commentId: comment.id, tId: ticketId, tType: ticketType })}
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
                      <p className="text-xs whitespace-pre-wrap">{comment.content}</p>
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
      
      {/* Create Task Dialog */}
      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent className="bg-popover">
          <DialogHeader>
            <DialogTitle>Créer une tâche</DialogTitle>
            <DialogDescription>
              Créer une tâche dans le gestionnaire de tâches à partir de ce ticket.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {projects.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>Aucun projet disponible.</p>
                <p className="text-sm">Créez d'abord un projet pour pouvoir créer des tâches.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="task-title">Titre de la tâche</Label>
                  <Input
                    id="task-title"
                    value={createTaskTitle}
                    onChange={(e) => setCreateTaskTitle(e.target.value)}
                    placeholder="Entrez le titre de la tâche"
                    data-testid="input-create-task-title"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Projet</Label>
                  <Popover open={projectSearchOpen} onOpenChange={setProjectSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={projectSearchOpen}
                        className="w-full justify-between"
                        data-testid="button-select-project"
                      >
                        {createTaskProjectId
                          ? projects.find((p) => p.id === createTaskProjectId)?.name || "Sélectionner un projet"
                          : "Sélectionner un projet"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Rechercher un projet..." />
                        <CommandList>
                          <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                          <CommandGroup>
                            {projects.map((project) => (
                              <CommandItem
                                key={project.id}
                                value={project.name}
                                onSelect={() => {
                                  setCreateTaskProjectId(project.id);
                                  setProjectSearchOpen(false);
                                }}
                                data-testid={`option-project-${project.id}`}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    createTaskProjectId === project.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {project.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateTaskDialog(false)}
              data-testid="button-cancel-create-task"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={!createTaskProjectId || !createTaskTitle.trim()}
              data-testid="button-confirm-create-task"
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
