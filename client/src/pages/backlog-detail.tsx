import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { 
  ArrowLeft, Plus, MoreVertical, ChevronDown, ChevronRight, 
  Folder, Clock, User, Calendar, Flag, Layers, ListTodo,
  Play, Square, CheckCircle, Pencil, Trash2, GripVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from "@dnd-kit/core";
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable 
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { 
  Backlog, Epic, UserStory, BacklogTask, Sprint, BacklogColumn, 
  ChecklistItem, AppUser, BacklogItemState, BacklogPriority, Complexity 
} from "@shared/schema";
import { 
  backlogItemStateOptions, backlogPriorityOptions, complexityOptions, 
  sprintStatusOptions 
} from "@shared/schema";
import { 
  SprintSection, 
  BacklogPool, 
  transformToFlatTickets,
  type FlatTicket,
  type TicketType,
  type TicketAction
} from "@/components/backlog/jira-scrum-view";
import { TicketDetailPanel } from "@/components/backlog/ticket-detail-panel";

type BacklogData = Backlog & {
  epics: Epic[];
  userStories: (UserStory & { tasks: BacklogTask[]; checklistItems: ChecklistItem[] })[];
  backlogTasks: BacklogTask[];
  sprints: Sprint[];
  columns: BacklogColumn[];
};

export default function BacklogDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [showEpicDialog, setShowEpicDialog] = useState(false);
  const [showUserStoryDialog, setShowUserStoryDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showSprintDialog, setShowSprintDialog] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [editingUserStory, setEditingUserStory] = useState<UserStory | null>(null);
  const [parentUserStoryId, setParentUserStoryId] = useState<string | null>(null);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());
  const [showColumnDialog, setShowColumnDialog] = useState(false);
  const [showKanbanTaskDialog, setShowKanbanTaskDialog] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  
  const [expandedSprints, setExpandedSprints] = useState<Set<string> | "all">("all");
  const [backlogPoolExpanded, setBacklogPoolExpanded] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<FlatTicket | null>(null);

  const { data: backlog, isLoading } = useQuery<BacklogData>({
    queryKey: ["/api/backlogs", id],
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Update browser tab title with backlog name
  useEffect(() => {
    if (backlog) {
      const truncatedName = backlog.name.length > 15 
        ? backlog.name.substring(0, 15) + '...'
        : backlog.name;
      document.title = `${truncatedName} | PlanBase`;
    }
    return () => {
      document.title = 'PlanBase';
    };
  }, [backlog?.name]);

  const createEpicMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; priority?: string; color?: string }) => {
      return apiRequest(`/api/backlogs/${id}/epics`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Epic créé", className: "bg-green-500 text-white border-green-600", duration: 3000 });
      setShowEpicDialog(false);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const updateEpicMutation = useMutation({
    mutationFn: async ({ epicId, data }: { epicId: string; data: Partial<Epic> }) => {
      return apiRequest(`/api/epics/${epicId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Epic mis à jour", className: "bg-green-500 text-white border-green-600", duration: 3000 });
      setEditingEpic(null);
      setShowEpicDialog(false);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteEpicMutation = useMutation({
    mutationFn: async (epicId: string) => apiRequest(`/api/epics/${epicId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Epic supprimé", className: "bg-green-500 text-white border-green-600", duration: 3000 });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const createUserStoryMutation = useMutation({
    mutationFn: async (data: { 
      title: string; 
      description?: string; 
      epicId?: string | null; 
      priority?: string;
      complexity?: string;
      estimatePoints?: number;
    }) => {
      return apiRequest(`/api/backlogs/${id}/user-stories`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "User Story créée", className: "bg-green-500 text-white border-green-600", duration: 3000 });
      setShowUserStoryDialog(false);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const updateUserStoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserStory> }) => {
      return apiRequest(`/api/user-stories/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "User Story mise à jour", className: "bg-green-500 text-white border-green-600", duration: 3000 });
      setEditingUserStory(null);
      setShowUserStoryDialog(false);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteUserStoryMutation = useMutation({
    mutationFn: async (usId: string) => apiRequest(`/api/user-stories/${usId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "User Story supprimée", className: "bg-green-500 text-white border-green-600", duration: 3000 });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: { userStoryId: string; title: string; description?: string }) => {
      return apiRequest(`/api/user-stories/${data.userStoryId}/tasks`, "POST", { 
        title: data.title, 
        description: data.description 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Tâche créée", className: "bg-green-500 text-white border-green-600", duration: 3000 });
      setShowTaskDialog(false);
      setParentUserStoryId(null);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<BacklogTask> }) => {
      return apiRequest(`/api/backlog-tasks/${taskId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => apiRequest(`/api/backlog-tasks/${taskId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Tâche supprimée", className: "bg-green-500 text-white border-green-600", duration: 3000 });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const createSprintMutation = useMutation({
    mutationFn: async (data: { name: string; goal?: string; startDate?: string; endDate?: string }) => {
      return apiRequest(`/api/backlogs/${id}/sprints`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Sprint créé", className: "bg-green-500 text-white border-green-600", duration: 3000 });
      setShowSprintDialog(false);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const updateSprintMutation = useMutation({
    mutationFn: async ({ sprintId, data }: { sprintId: string; data: Partial<Sprint> }) => {
      return apiRequest(`/api/sprints/${sprintId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Sprint mis à jour", className: "bg-green-500 text-white border-green-600", duration: 3000 });
      setShowSprintDialog(false);
      setEditingSprint(null);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const startSprintMutation = useMutation({
    mutationFn: async (sprintId: string) => apiRequest(`/api/sprints/${sprintId}/start`, "PATCH"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Sprint démarré", className: "bg-green-500 text-white border-green-600", duration: 3000 });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const closeSprintMutation = useMutation({
    mutationFn: async (sprintId: string) => apiRequest(`/api/sprints/${sprintId}/close`, "PATCH"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Sprint clôturé", className: "bg-green-500 text-white border-green-600", duration: 3000 });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const toggleChecklistItemMutation = useMutation({
    mutationFn: async ({ itemId, done }: { itemId: string; done: boolean }) => {
      return apiRequest(`/api/checklist-items/${itemId}`, "PATCH", { done });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  // Kanban column mutations
  const createColumnMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return apiRequest(`/api/backlogs/${id}/columns`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      setShowColumnDialog(false);
      toast({ title: "Colonne créée", className: "bg-green-500 text-white border-green-600", duration: 3000 });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      return apiRequest(`/api/backlog-columns/${columnId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Colonne supprimée", className: "bg-green-500 text-white border-green-600", duration: 3000 });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const createKanbanTaskMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; priority?: string; columnId: string }) => {
      return apiRequest(`/api/backlogs/${id}/tasks`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      setShowKanbanTaskDialog(false);
      setSelectedColumnId(null);
      toast({ title: "Tâche créée", className: "bg-green-500 text-white border-green-600", duration: 3000 });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const moveTaskToColumnMutation = useMutation({
    mutationFn: async ({ taskId, columnId }: { taskId: string; columnId: string }) => {
      return apiRequest(`/api/backlog-tasks/${taskId}`, "PATCH", { columnId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const toggleEpic = (epicId: string) => {
    setExpandedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId);
      else next.add(epicId);
      return next;
    });
  };

  const toggleStory = (storyId: string) => {
    setExpandedStories(prev => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  };

  const getStateColor = (state: string) => {
    const option = backlogItemStateOptions.find(o => o.value === state);
    return option?.color || "#E5E7EB";
  };

  const getStateLabel = (state: string) => {
    const option = backlogItemStateOptions.find(o => o.value === state);
    return option?.label || state;
  };

  const getPriorityColor = (priority: string) => {
    const option = backlogPriorityOptions.find(o => o.value === priority);
    return option?.color || "#E5E7EB";
  };

  const getPriorityLabel = (priority: string) => {
    const option = backlogPriorityOptions.find(o => o.value === priority);
    return option?.label || priority;
  };

  const storiesWithoutEpic = useMemo(() => {
    return backlog?.userStories.filter(us => !us.epicId) || [];
  }, [backlog?.userStories]);

  const getStoriesForEpic = (epicId: string) => {
    return backlog?.userStories.filter(us => us.epicId === epicId) || [];
  };

  const getTasksForStory = (storyId: string) => {
    const story = backlog?.userStories.find(us => us.id === storyId);
    return story?.tasks || [];
  };

  const calculateProgress = (story: UserStory & { tasks?: BacklogTask[] }) => {
    const tasks = story.tasks || [];
    if (tasks.length === 0) return story.state === "termine" ? 100 : 0;
    const done = tasks.filter(t => t.state === "termine").length;
    return Math.round((done / tasks.length) * 100);
  };

  // Kanban helpers
  const getTasksForColumn = (columnId: string) => {
    return backlog?.backlogTasks.filter(t => t.columnId === columnId) || [];
  };

  const getUnassignedTasks = () => {
    return backlog?.backlogTasks.filter(t => !t.columnId) || [];
  };

  // Jira-style helpers
  const flatTickets = useMemo(() => {
    if (!backlog) return [];
    return transformToFlatTickets(
      backlog.epics,
      backlog.userStories,
      backlog.backlogTasks
    );
  }, [backlog?.epics, backlog?.userStories, backlog?.backlogTasks]);

  const getTicketsForSprint = (sprintId: string) => {
    return flatTickets.filter(t => t.sprintId === sprintId);
  };

  const getBacklogTickets = () => {
    return flatTickets.filter(t => !t.sprintId);
  };

  const toggleSprint = (sprintId: string) => {
    setExpandedSprints(prev => {
      if (prev === "all") {
        const allSprintIds = new Set(backlog?.sprints.map(s => s.id) || []);
        allSprintIds.delete(sprintId);
        return allSprintIds;
      }
      const next = new Set(prev);
      if (next.has(sprintId)) next.delete(sprintId);
      else next.add(sprintId);
      return next;
    });
  };

  const isSprintExpanded = (sprintId: string) => {
    return expandedSprints === "all" || expandedSprints.has(sprintId);
  };

  const handleSelectTicket = (ticket: FlatTicket) => {
    setSelectedTicket(ticket);
  };

  const handleUpdateTicket = async (ticketId: string, type: TicketType, data: Record<string, any>) => {
    try {
      let endpoint = "";
      if (type === "epic") endpoint = `/api/epics/${ticketId}`;
      else if (type === "user_story") endpoint = `/api/user-stories/${ticketId}`;
      else endpoint = `/api/backlog-tasks/${ticketId}`;
      
      await apiRequest(endpoint, "PATCH", data);
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      
      // Update selected ticket with new data
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, ...data });
      }
      
      toast({ title: "Ticket mis à jour", className: "bg-green-500 text-white border-green-600", duration: 3000 });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteTicket = async (ticketId: string, type: TicketType) => {
    try {
      let endpoint = "";
      if (type === "epic") endpoint = `/api/epics/${ticketId}`;
      else if (type === "user_story") endpoint = `/api/user-stories/${ticketId}`;
      else endpoint = `/api/backlog-tasks/${ticketId}`;
      
      await apiRequest(endpoint, "DELETE");
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      setSelectedTicket(null);
      
      toast({ title: "Ticket supprimé", className: "bg-green-500 text-white border-green-600", duration: 3000 });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };
  
  // Handle inline state update
  const handleInlineStateUpdate = async (ticketId: string, type: TicketType, state: string) => {
    await handleUpdateTicket(ticketId, type, { state });
  };

  // Handle ticket actions from dropdown menu
  const handleTicketAction = async (action: TicketAction) => {
    try {
      switch (action.type) {
        case "move_top":
          // Move ticket to top of its current sprint/backlog
          await handleUpdateTicket(action.ticketId, action.ticketType, { order: 0 });
          toast({ title: "Ticket déplacé en haut", className: "bg-green-500 text-white border-green-600", duration: 3000 });
          break;
          
        case "move_bottom":
          // Move ticket to bottom - set a high order number
          await handleUpdateTicket(action.ticketId, action.ticketType, { order: 999999 });
          toast({ title: "Ticket déplacé en bas", className: "bg-green-500 text-white border-green-600", duration: 3000 });
          break;
          
        case "move_sprint":
          // Move ticket to a different sprint (or null for backlog)
          await handleUpdateTicket(action.ticketId, action.ticketType, { sprintId: action.sprintId || null });
          toast({ 
            title: action.sprintId ? "Ticket déplacé vers le sprint" : "Ticket déplacé vers le backlog", 
            className: "bg-green-500 text-white border-green-600", 
            duration: 3000 
          });
          break;
          
        case "copy":
          // Copy ticket with same properties
          const ticket = backlog?.epics?.find(e => e.id === action.ticketId) || 
                        backlog?.userStories?.find(s => s.id === action.ticketId) ||
                        backlog?.backlogTasks?.find(t => t.id === action.ticketId);
          
          if (ticket) {
            let endpoint = "";
            const baseData = {
              title: `${ticket.title} (copie)`,
              description: ticket.description,
              state: (ticket as any).state || "a_faire",
              priority: (ticket as any).priority || "medium",
              sprintId: (ticket as any).sprintId || null,
              estimatePoints: (ticket as any).estimatePoints || null,
            };
            
            if (action.ticketType === "epic") {
              endpoint = `/api/backlogs/${id}/epics`;
            } else if (action.ticketType === "user_story") {
              endpoint = `/api/backlogs/${id}/user-stories`;
            } else {
              endpoint = `/api/backlogs/${id}/tasks`;
            }
            
            await apiRequest(endpoint, "POST", baseData);
            queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
            toast({ title: "Ticket copié", className: "bg-green-500 text-white border-green-600", duration: 3000 });
          }
          break;
          
        case "delete":
          await handleDeleteTicket(action.ticketId, action.ticketType);
          break;
          
        case "assign":
          await handleUpdateTicket(action.ticketId, action.ticketType, { assigneeId: action.assigneeId || null });
          toast({ 
            title: action.assigneeId ? "Ticket assigné" : "Assignation retirée", 
            className: "bg-green-500 text-white border-green-600", 
            duration: 3000 
          });
          break;
          
        case "mark_status":
          if (action.state) {
            await handleUpdateTicket(action.ticketId, action.ticketType, { state: action.state });
            const stateLabel = backlogItemStateOptions.find(s => s.value === action.state)?.label || action.state;
            toast({ title: `Statut: ${stateLabel}`, className: "bg-green-500 text-white border-green-600", duration: 3000 });
          }
          break;
          
        case "set_estimate":
          await handleUpdateTicket(action.ticketId, action.ticketType, { estimatePoints: action.estimatePoints || null });
          toast({ 
            title: action.estimatePoints ? `${action.estimatePoints} points estimés` : "Estimation retirée", 
            className: "bg-green-500 text-white border-green-600", 
            duration: 3000 
          });
          break;
      }
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };
  
  // Handle type conversion
  const handleConvertType = async (ticketId: string, fromType: TicketType, toType: TicketType) => {
    try {
      // Get the ticket data first
      const ticket = backlog?.epics?.find(e => e.id === ticketId) || 
                     backlog?.userStories?.find(s => s.id === ticketId) ||
                     backlog?.backlogTasks?.find(t => t.id === ticketId);
      
      if (!ticket) {
        throw new Error("Ticket not found");
      }
      
      // Create new ticket of target type
      let createEndpoint = "";
      const baseData = {
        title: ticket.title,
        description: ticket.description,
        state: (ticket as any).state || "a_faire",
        priority: (ticket as any).priority || "medium",
        sprintId: (ticket as any).sprintId || null,
      };
      
      if (toType === "epic") {
        createEndpoint = `/api/backlogs/${id}/epics`;
      } else if (toType === "user_story") {
        createEndpoint = `/api/backlogs/${id}/user-stories`;
      } else {
        createEndpoint = `/api/backlogs/${id}/tasks`;
      }
      
      await apiRequest(createEndpoint, "POST", baseData);
      
      // Delete old ticket
      let deleteEndpoint = "";
      if (fromType === "epic") deleteEndpoint = `/api/epics/${ticketId}`;
      else if (fromType === "user_story") deleteEndpoint = `/api/user-stories/${ticketId}`;
      else deleteEndpoint = `/api/backlog-tasks/${ticketId}`;
      
      await apiRequest(deleteEndpoint, "DELETE");
      
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      setSelectedTicket(null);
      
      toast({ 
        title: "Type converti", 
        description: `Converti en ${toType === "epic" ? "Epic" : toType === "user_story" ? "User Story" : "Task"}`,
        className: "bg-green-500 text-white border-green-600", 
        duration: 3000 
      });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };
  
  // Handle drag end for moving tickets between sprints
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !active.data.current) return;
    
    const { ticket, type } = active.data.current as { ticket: FlatTicket; type: TicketType };
    const overData = over.data.current as { type: string; sprintId: string | null };
    
    if (!overData) return;
    
    const newSprintId = overData.type === "backlog" ? null : overData.sprintId;
    const currentSprintId = ticket.sprintId;
    
    // Only update if sprint changed
    if (newSprintId !== currentSprintId) {
      await handleUpdateTicket(ticket.id, type, { sprintId: newSprintId });
    }
  };

  const handleCreateSprintTicket = async (sprintId: string, type: TicketType, title: string) => {
    try {
      let endpoint = "";
      let data: Record<string, any> = { title, sprintId };
      
      if (type === "epic") {
        endpoint = `/api/backlogs/${id}/epics`;
        data = { title, sprintId, priority: "medium", state: "a_faire" };
      } else if (type === "user_story") {
        endpoint = `/api/backlogs/${id}/user-stories`;
        data = { title, sprintId, priority: "medium", state: "a_faire" };
      } else {
        endpoint = `/api/backlogs/${id}/tasks`;
        data = { title, sprintId, priority: "medium", state: "a_faire" };
      }
      
      await apiRequest(endpoint, "POST", data);
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Ticket créé", className: "bg-green-500 text-white border-green-600", duration: 3000 });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleCreateBacklogTicket = async (type: TicketType, title: string) => {
    try {
      let endpoint = "";
      let data: Record<string, any> = { title };
      
      if (type === "epic") {
        endpoint = `/api/backlogs/${id}/epics`;
        data = { title, priority: "medium", state: "a_faire" };
      } else if (type === "user_story") {
        endpoint = `/api/backlogs/${id}/user-stories`;
        data = { title, priority: "medium", state: "a_faire" };
      } else {
        endpoint = `/api/backlogs/${id}/tasks`;
        data = { title, priority: "medium", state: "a_faire" };
      }
      
      await apiRequest(endpoint, "POST", data);
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Ticket créé", className: "bg-green-500 text-white border-green-600", duration: 3000 });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleKanbanDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const taskId = active.id as string;
    const overId = over.id as string;
    const activeData = active.data.current as { sortable?: { containerId?: string }, columnId?: string } | undefined;
    const overData = over.data.current as { sortable?: { containerId?: string }, columnId?: string } | undefined;
    
    // Get the source column from sortable containerId or fallback to custom columnId
    const sourceColumnId = activeData?.sortable?.containerId || activeData?.columnId;
    
    // Determine target column
    let targetColumnId: string | null = null;
    
    // Check if we're dropping on a column droppable zone (ID starts with 'column-')
    if (overId.startsWith("column-")) {
      targetColumnId = overId.replace("column-", "");
    } else if (overData?.sortable?.containerId) {
      // Dropping on another task - get the target column from sortable containerId
      targetColumnId = overData.sortable.containerId;
    } else if (overData?.columnId) {
      // Fallback to custom columnId data
      targetColumnId = overData.columnId;
    }
    
    // Move task if dropping on a different column
    if (targetColumnId && targetColumnId !== sourceColumnId && backlog?.columns.some(c => c.id === targetColumnId)) {
      moveTaskToColumnMutation.mutate({ taskId, columnId: targetColumnId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!backlog) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground mb-4">Backlog non trouvé</p>
        <Button onClick={() => navigate("/product")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>
    );
  }

  const hasActiveSprint = backlog.sprints.some(s => s.status === "en_cours");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 p-4 md:p-6 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate("/product")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate" data-testid="text-backlog-title">{backlog.name}</h1>
          {backlog.description && (
            <p className="text-sm text-muted-foreground truncate">{backlog.description}</p>
          )}
        </div>
        <Badge variant="secondary" className="capitalize">
          {backlog.mode}
        </Badge>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <Button size="sm" variant="outline" onClick={() => setShowEpicDialog(true)} data-testid="button-add-epic">
            <Plus className="h-4 w-4 mr-1" />
            Epic
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowUserStoryDialog(true)} data-testid="button-add-user-story">
            <Plus className="h-4 w-4 mr-1" />
            User Story
          </Button>
          {backlog.mode === "scrum" && (
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setShowSprintDialog(true)} data-testid="button-add-sprint">
              <Plus className="h-4 w-4 mr-1" />
              Sprint
            </Button>
          )}
          {backlog.mode === "kanban" && (
            <Button size="sm" variant="outline" onClick={() => setShowColumnDialog(true)} data-testid="button-add-column">
              <Plus className="h-4 w-4 mr-1" />
              Colonne
            </Button>
          )}
        </div>

        {/* Kanban Board View */}
        {backlog.mode === "kanban" && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleKanbanDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-board">
              {backlog.columns.sort((a, b) => a.position - b.position).map(column => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={getTasksForColumn(column.id)}
                  onAddTask={() => {
                    setSelectedColumnId(column.id);
                    setShowKanbanTaskDialog(true);
                  }}
                  onDeleteColumn={() => deleteColumnMutation.mutate(column.id)}
                  onDeleteTask={(taskId) => deleteTaskMutation.mutate(taskId)}
                  getPriorityColor={getPriorityColor}
                />
              ))}

              {backlog.columns.length === 0 && (
                <Card className="w-full">
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground mb-4">
                      Aucune colonne. Créez des colonnes pour organiser vos tâches.
                    </p>
                    <Button onClick={() => setShowColumnDialog(true)} data-testid="button-create-first-column">
                      <Plus className="h-4 w-4 mr-2" />
                      Créer une colonne
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </DndContext>
        )}

        {/* Jira-style Scrum Backlog View */}
        {backlog.mode === "scrum" && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="flex gap-0 h-full">
              <div className={`flex-1 space-y-4 ${selectedTicket ? 'pr-0' : ''}`}>
                {/* Sprint Sections */}
                {backlog.sprints
                  .sort((a, b) => {
                    if (a.status === "en_cours" && b.status !== "en_cours") return -1;
                    if (b.status === "en_cours" && a.status !== "en_cours") return 1;
                    if (a.status === "preparation" && b.status === "termine") return -1;
                    if (b.status === "preparation" && a.status === "termine") return 1;
                    return 0;
                  })
                  .map(sprint => (
                    <SprintSection
                      key={sprint.id}
                      sprint={sprint}
                      tickets={getTicketsForSprint(sprint.id)}
                      users={users}
                      sprints={backlog.sprints}
                      isExpanded={isSprintExpanded(sprint.id)}
                      onToggle={() => toggleSprint(sprint.id)}
                      onSelectTicket={handleSelectTicket}
                      onCreateTicket={handleCreateSprintTicket}
                      onStartSprint={(sprintId) => startSprintMutation.mutate(sprintId)}
                      onCompleteSprint={(sprintId) => closeSprintMutation.mutate(sprintId)}
                      onEditSprint={(sprint) => { setEditingSprint(sprint); setShowSprintDialog(true); }}
                      onUpdateState={handleInlineStateUpdate}
                      onTicketAction={handleTicketAction}
                      selectedTicketId={selectedTicket?.id}
                    />
                  ))}

                {/* Add Sprint Button */}
                <Button
                  variant="outline"
                  className="w-full border-dashed border-2 border-violet-300 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/30 text-violet-600 dark:text-violet-400"
                  onClick={() => setShowSprintDialog(true)}
                  data-testid="button-add-sprint-inline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Sprint
                </Button>

                {/* Backlog Pool */}
                <BacklogPool
                  tickets={getBacklogTickets()}
                  users={users}
                  sprints={backlog.sprints}
                  isExpanded={backlogPoolExpanded}
                  onToggle={() => setBacklogPoolExpanded(!backlogPoolExpanded)}
                  onSelectTicket={handleSelectTicket}
                  onCreateTicket={handleCreateBacklogTicket}
                  onUpdateState={handleInlineStateUpdate}
                  onTicketAction={handleTicketAction}
                  selectedTicketId={selectedTicket?.id}
                />
              </div>

              {/* Ticket Detail Panel with click-outside-to-close */}
              {selectedTicket && (
                <>
                  <div 
                    className="fixed inset-0 bg-black/10 z-40"
                    onClick={() => setSelectedTicket(null)}
                    data-testid="ticket-panel-backdrop"
                  />
                  <div className="relative z-50">
                    <TicketDetailPanel
                      ticket={selectedTicket}
                      epics={backlog.epics}
                      sprints={backlog.sprints}
                      users={users}
                      onClose={() => setSelectedTicket(null)}
                      onUpdate={handleUpdateTicket}
                      onDelete={handleDeleteTicket}
                      onConvertType={handleConvertType}
                    />
                  </div>
                </>
              )}
            </div>
          </DndContext>
        )}
      </div>

      <EpicDialog 
        open={showEpicDialog}
        onClose={() => { setShowEpicDialog(false); setEditingEpic(null); }}
        epic={editingEpic}
        onCreate={(data) => createEpicMutation.mutate(data)}
        onUpdate={(data) => editingEpic && updateEpicMutation.mutate({ epicId: editingEpic.id, data })}
        isPending={createEpicMutation.isPending || updateEpicMutation.isPending}
      />

      <UserStoryDialog 
        open={showUserStoryDialog}
        onClose={() => { setShowUserStoryDialog(false); setEditingUserStory(null); }}
        userStory={editingUserStory}
        epics={backlog.epics}
        sprints={backlog.sprints}
        onCreate={(data) => createUserStoryMutation.mutate(data)}
        onUpdate={(data) => editingUserStory && updateUserStoryMutation.mutate({ id: editingUserStory.id, data })}
        isPending={createUserStoryMutation.isPending || updateUserStoryMutation.isPending}
      />

      <TaskDialog 
        open={showTaskDialog}
        onClose={() => { setShowTaskDialog(false); setParentUserStoryId(null); }}
        userStoryId={parentUserStoryId}
        onCreate={(data) => createTaskMutation.mutate(data)}
        isPending={createTaskMutation.isPending}
      />

      <SprintSheet 
        open={showSprintDialog}
        onClose={() => { setShowSprintDialog(false); setEditingSprint(null); }}
        sprint={editingSprint}
        onCreate={(data) => createSprintMutation.mutate(data)}
        onUpdate={(data) => editingSprint && updateSprintMutation.mutate({ sprintId: editingSprint.id, data })}
        isPending={createSprintMutation.isPending || updateSprintMutation.isPending}
      />

      <ColumnDialog 
        open={showColumnDialog}
        onClose={() => setShowColumnDialog(false)}
        onCreate={(data) => createColumnMutation.mutate(data)}
        isPending={createColumnMutation.isPending}
      />

      <KanbanTaskDialogComponent
        open={showKanbanTaskDialog}
        onClose={() => { setShowKanbanTaskDialog(false); setSelectedColumnId(null); }}
        columnId={selectedColumnId}
        onCreate={(data) => createKanbanTaskMutation.mutate(data)}
        isPending={createKanbanTaskMutation.isPending}
      />
    </div>
  );
}

function UserStoryRow({ 
  story, 
  expanded, 
  onToggle, 
  onEdit, 
  onDelete, 
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleChecklist,
  getStateColor,
  getStateLabel,
  getPriorityColor,
  calculateProgress
}: {
  story: UserStory & { tasks: BacklogTask[]; checklistItems: ChecklistItem[] };
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddTask: () => void;
  onUpdateTask: (taskId: string, data: Partial<BacklogTask>) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleChecklist: (itemId: string, done: boolean) => void;
  getStateColor: (state: string) => string;
  getStateLabel: (state: string) => string;
  getPriorityColor: (priority: string) => string;
  calculateProgress: (story: UserStory & { tasks: BacklogTask[] }) => number;
}) {
  const progress = calculateProgress(story);
  
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" data-testid={`button-toggle-story-${story.id}`}>
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate" data-testid={`text-story-title-${story.id}`}>{story.title}</span>
              {story.complexity && (
                <Badge variant="outline" className="text-xs">{story.complexity}</Badge>
              )}
              {story.estimatePoints && (
                <Badge variant="secondary" className="text-xs">{story.estimatePoints} pts</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge 
                variant="secondary" 
                className="text-xs"
                style={{ backgroundColor: getStateColor(story.state || "a_faire") }}
              >
                {getStateLabel(story.state || "a_faire")}
              </Badge>
              {story.priority && (
                <div 
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: getPriorityColor(story.priority) }}
                  title={story.priority}
                />
              )}
              {(story.tasks?.length ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground">
                  {story.tasks?.filter(t => t.state === "termine").length ?? 0}/{story.tasks?.length ?? 0} tâches
                </span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" data-testid={`button-menu-story-${story.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onAddTask} data-testid={`menu-addtask-story-${story.id}`}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une tâche
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit} data-testid={`menu-edit-story-${story.id}`}>
                <Pencil className="h-4 w-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete} data-testid={`menu-delete-story-${story.id}`}>
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {(story.tasks?.length ?? 0) > 0 && (
          <div className="mt-2">
            <Progress value={progress} className="h-1" />
          </div>
        )}
        <CollapsibleContent>
          <div className="mt-3 space-y-2 border-t pt-3">
            {story.description && (
              <p className="text-sm text-muted-foreground">{story.description}</p>
            )}
            {(story.checklistItems?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Critères d'acceptation</p>
                {story.checklistItems?.map(item => (
                  <div key={item.id} className="flex items-center gap-2" data-testid={`row-checklist-${item.id}`}>
                    <Checkbox 
                      checked={item.done}
                      onCheckedChange={(checked) => onToggleChecklist(item.id, !!checked)}
                      data-testid={`checkbox-checklist-${item.id}`}
                    />
                    <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`} data-testid={`text-checklist-${item.id}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {(story.tasks?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Tâches</p>
                {story.tasks?.map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded bg-muted/50" data-testid={`row-task-${task.id}`}>
                    <Select
                      value={task.state || "a_faire"}
                      onValueChange={(value) => onUpdateTask(task.id, { state: value })}
                    >
                      <SelectTrigger className="h-6 w-24 text-xs" data-testid={`select-task-state-${task.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {backlogItemStateOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="flex-1 text-sm truncate" data-testid={`text-task-title-${task.id}`}>{task.title}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => onDeleteTask(task.id)}
                      data-testid={`button-delete-task-${task.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={onAddTask} data-testid={`button-addtask-story-${story.id}`}>
              <Plus className="h-3 w-3 mr-1" />
              Ajouter une tâche
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function EpicDialog({ 
  open, 
  onClose, 
  epic, 
  onCreate, 
  onUpdate, 
  isPending 
}: { 
  open: boolean; 
  onClose: () => void; 
  epic: Epic | null;
  onCreate: (data: { title: string; description?: string; priority?: string; color?: string }) => void;
  onUpdate: (data: Partial<Epic>) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [color, setColor] = useState("#C4B5FD");

  const colors = ["#C4B5FD", "#93C5FD", "#86EFAC", "#FDE047", "#FDBA74", "#FCA5A5"];

  useState(() => {
    if (epic) {
      setTitle(epic.title);
      setDescription(epic.description || "");
      setPriority(epic.priority || "medium");
      setColor(epic.color || "#C4B5FD");
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setColor("#C4B5FD");
    }
  });

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (epic) {
      onUpdate({ title, description: description || undefined, priority, color });
    } else {
      onCreate({ title, description: description || undefined, priority, color });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{epic ? "Modifier l'Epic" : "Nouvel Epic"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de l'epic" data-testid="input-epic-title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-epic-description" />
          </div>
          <div className="space-y-2">
            <Label>Priorité</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger data-testid="select-epic-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                {backlogPriorityOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex gap-2">
              {colors.map((c, i) => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  data-testid={`button-epic-color-${i}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-epic">Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim()} data-testid="button-submit-epic">
            {isPending ? "..." : epic ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserStoryDialog({ 
  open, 
  onClose, 
  userStory, 
  epics,
  sprints,
  onCreate, 
  onUpdate, 
  isPending 
}: { 
  open: boolean; 
  onClose: () => void; 
  userStory: UserStory | null;
  epics: Epic[];
  sprints: Sprint[];
  onCreate: (data: { 
    title: string; 
    description?: string; 
    epicId?: string | null;
    priority?: string;
    complexity?: string;
    estimatePoints?: number;
  }) => void;
  onUpdate: (data: Partial<UserStory>) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [epicId, setEpicId] = useState<string | null>(null);
  const [priority, setPriority] = useState("medium");
  const [complexity, setComplexity] = useState<string | null>(null);
  const [estimatePoints, setEstimatePoints] = useState<number | null>(null);

  useState(() => {
    if (userStory) {
      setTitle(userStory.title);
      setDescription(userStory.description || "");
      setEpicId(userStory.epicId);
      setPriority(userStory.priority || "medium");
      setComplexity(userStory.complexity);
      setEstimatePoints(userStory.estimatePoints);
    } else {
      setTitle("");
      setDescription("");
      setEpicId(null);
      setPriority("medium");
      setComplexity(null);
      setEstimatePoints(null);
    }
  });

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (userStory) {
      onUpdate({ 
        title, 
        description: description || undefined, 
        epicId,
        priority,
        complexity: complexity || undefined,
        estimatePoints: estimatePoints || undefined
      });
    } else {
      onCreate({ 
        title, 
        description: description || undefined, 
        epicId,
        priority,
        complexity: complexity || undefined,
        estimatePoints: estimatePoints || undefined
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{userStory ? "Modifier la User Story" : "Nouvelle User Story"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="En tant que..." data-testid="input-userstory-title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-userstory-description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Epic</Label>
              <Select value={epicId || "none"} onValueChange={(v) => setEpicId(v === "none" ? null : v)}>
                <SelectTrigger data-testid="select-userstory-epic"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {epics.map(epic => (
                    <SelectItem key={epic.id} value={epic.id}>{epic.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-userstory-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {backlogPriorityOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Complexité</Label>
              <Select value={complexity || "none"} onValueChange={(v) => setComplexity(v === "none" ? null : v)}>
                <SelectTrigger data-testid="select-userstory-complexity"><SelectValue placeholder="--" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">--</SelectItem>
                  {complexityOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Story Points</Label>
              <Input 
                type="number" 
                value={estimatePoints ?? ""} 
                onChange={(e) => setEstimatePoints(e.target.value ? parseInt(e.target.value) : null)} 
                min={0}
                data-testid="input-userstory-points"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-userstory">Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim()} data-testid="button-submit-userstory">
            {isPending ? "..." : userStory ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ 
  open, 
  onClose, 
  userStoryId,
  onCreate, 
  isPending 
}: { 
  open: boolean; 
  onClose: () => void; 
  userStoryId: string | null;
  onCreate: (data: { userStoryId: string; title: string; description?: string }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!title.trim() || !userStoryId) return;
    onCreate({ userStoryId, title, description: description || undefined });
    setTitle("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle Tâche</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la tâche" data-testid="input-task-title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-task-description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-task">Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim()} data-testid="button-submit-task">
            {isPending ? "..." : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SprintSheet({ 
  open, 
  onClose, 
  sprint,
  onCreate, 
  onUpdate,
  isPending 
}: { 
  open: boolean; 
  onClose: () => void;
  sprint: Sprint | null;
  onCreate: (data: { name: string; goal?: string; startDate?: string; endDate?: string }) => void;
  onUpdate: (data: Partial<Sprint>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (sprint) {
      setName(sprint.name);
      setGoal(sprint.goal || "");
      setStartDate(sprint.startDate ? new Date(sprint.startDate).toISOString().slice(0, 16) : "");
      setEndDate(sprint.endDate ? new Date(sprint.endDate).toISOString().slice(0, 16) : "");
    } else {
      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
    }
  }, [sprint, open]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const data = { 
      name, 
      goal: goal || undefined, 
      startDate: startDate || undefined, 
      endDate: endDate || undefined 
    };
    
    if (sprint) {
      onUpdate(data);
    } else {
      onCreate(data);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{sprint ? "Modifier le Sprint" : "Nouveau Sprint"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-6">
          <div className="space-y-2">
            <Label>Nom *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 1" data-testid="input-sprint-name" />
          </div>
          <div className="space-y-2">
            <Label>Objectif</Label>
            <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} placeholder="Objectif du sprint..." data-testid="input-sprint-goal" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date de début</Label>
              <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="input-sprint-start" />
            </div>
            <div className="space-y-2">
              <Label>Date de fin</Label>
              <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} data-testid="input-sprint-end" />
            </div>
          </div>
        </div>
        <SheetFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-sprint">Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()} data-testid="button-submit-sprint">
            {isPending ? "..." : sprint ? "Enregistrer" : "Créer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ColumnDialog({ 
  open, 
  onClose, 
  onCreate, 
  isPending 
}: { 
  open: boolean; 
  onClose: () => void; 
  onCreate: (data: { name: string; color: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#E5E7EB");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate({ name, color });
    setName("");
    setColor("#E5E7EB");
  };

  const colorOptions = [
    { value: "#E5E7EB", label: "Gris" },
    { value: "#93C5FD", label: "Bleu" },
    { value: "#86EFAC", label: "Vert" },
    { value: "#FDE047", label: "Jaune" },
    { value: "#FCA5A5", label: "Rouge" },
    { value: "#C4B5FD", label: "Violet" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="text-column-dialog-title">Nouvelle Colonne</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nom *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="À faire" data-testid="input-column-name" />
          </div>
          <div className="space-y-2">
            <Label>Couleur</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger data-testid="select-column-color">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: opt.value }} />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-column">Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()} data-testid="button-submit-column">
            {isPending ? "..." : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KanbanTaskDialogComponent({ 
  open, 
  onClose, 
  columnId,
  onCreate, 
  isPending 
}: { 
  open: boolean; 
  onClose: () => void;
  columnId: string | null;
  onCreate: (data: { title: string; description?: string; priority?: string; columnId: string }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const handleSubmit = () => {
    if (!title.trim() || !columnId) return;
    onCreate({ title, description: description || undefined, priority, columnId });
    setTitle("");
    setDescription("");
    setPriority("medium");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="text-kanban-task-dialog-title">Nouvelle Tâche</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la tâche" data-testid="input-kanban-task-title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-kanban-task-description" />
          </div>
          <div className="space-y-2">
            <Label>Priorité</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger data-testid="select-kanban-task-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {backlogPriorityOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-kanban-task">Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim()} data-testid="button-submit-kanban-task">
            {isPending ? "..." : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onDeleteColumn,
  onDeleteTask,
  getPriorityColor
}: {
  column: BacklogColumn;
  tasks: BacklogTask[];
  onAddTask: () => void;
  onDeleteColumn: () => void;
  onDeleteTask: (taskId: string) => void;
  getPriorityColor: (priority: string) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${column.id}` });

  return (
    <div 
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 rounded-lg p-3 transition-colors ${isOver ? "bg-primary/10" : "bg-muted/50"}`}
      data-testid={`column-${column.id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="h-3 w-3 rounded-full" 
            style={{ backgroundColor: column.color || "#E5E7EB" }}
          />
          <h3 className="font-medium text-sm" data-testid={`text-column-name-${column.id}`}>{column.name}</h3>
          <Badge variant="secondary" className="text-xs">
            {tasks.length}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-menu-column-${column.id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onAddTask} data-testid={`menu-add-task-column-${column.id}`}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une tâche
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onDeleteColumn} data-testid={`menu-delete-column-${column.id}`}>
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SortableContext id={column.id} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[100px]" data-testid={`column-tasks-${column.id}`}>
          {tasks.map(task => (
            <KanbanTaskCard 
              key={task.id} 
              task={task}
              columnId={column.id}
              onDelete={() => onDeleteTask(task.id)}
              getPriorityColor={getPriorityColor}
            />
          ))}
        </div>
      </SortableContext>

      <Button 
        size="sm" 
        variant="ghost" 
        className="w-full mt-2"
        onClick={onAddTask}
        data-testid={`button-add-task-column-${column.id}`}
      >
        <Plus className="h-3 w-3 mr-1" />
        Ajouter
      </Button>
    </div>
  );
}

function KanbanTaskCard({ 
  task, 
  columnId,
  onDelete,
  getPriorityColor
}: { 
  task: BacklogTask;
  columnId: string;
  onDelete: () => void;
  getPriorityColor: (priority: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: task.id,
    data: { columnId, task }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className="p-3 cursor-grab active:cursor-grabbing" 
      data-testid={`card-kanban-task-${task.id}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" data-testid={`text-kanban-task-title-${task.id}`}>{task.title}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground truncate mt-1">{task.description}</p>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          data-testid={`button-delete-kanban-task-${task.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {task.priority && (
          <Badge 
            variant="secondary" 
            className="text-xs"
            style={{ backgroundColor: getPriorityColor(task.priority) }}
            data-testid={`badge-kanban-task-priority-${task.id}`}
          >
            {task.priority}
          </Badge>
        )}
        {task.complexity && (
          <Badge variant="outline" className="text-xs" data-testid={`badge-kanban-task-complexity-${task.id}`}>
            {task.complexity}
          </Badge>
        )}
      </div>
    </Card>
  );
}
