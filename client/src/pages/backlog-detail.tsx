import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, Plus, MoreVertical, ChevronDown, ChevronRight, 
  Folder, Clock, User, Calendar, Flag, Layers, ListTodo,
  Play, Square, CheckCircle, Pencil, Trash2, GripVertical, Search, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { toastSuccess } from "@/design-system/feedback";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  DndContext, 
  closestCenter, 
  closestCorners,
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent
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
  ChecklistItem, AppUser, BacklogItemState, BacklogPriority, Complexity,
  Project, Retro, RetroCard
} from "@shared/schema";
import { 
  backlogItemStateOptions, backlogPriorityOptions, complexityOptions, 
  sprintStatusOptions, backlogModeOptions, type BacklogMode
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
  const { accountId } = useAuth();
  
  const [showEpicDialog, setShowEpicDialog] = useState(false);
  const [showUserStoryDialog, setShowUserStoryDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showSprintDialog, setShowSprintDialog] = useState(false);
  const [showEditBacklogDialog, setShowEditBacklogDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [editBacklogName, setEditBacklogName] = useState("");
  const [editBacklogDescription, setEditBacklogDescription] = useState("");
  const [editBacklogProjectId, setEditBacklogProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("backlog");
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
  const [hideFinishedSprints, setHideFinishedSprints] = useState(true);
  const [showSprintCloseModal, setShowSprintCloseModal] = useState(false);
  const [closingSprintId, setClosingSprintId] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<string>("backlog");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("state");
  const [ticketSearch, setTicketSearch] = useState<string>("");
  const [showEpicColumn, setShowEpicColumn] = useState<boolean>(() => {
    const saved = localStorage.getItem('backlog-show-epic-column');
    return saved === 'true';
  });
  const [epicFilter, setEpicFilter] = useState<string[]>([]);
  const [epicToDelete, setEpicToDelete] = useState<Epic | null>(null);
  
  // New backlog form state
  const [newBacklogName, setNewBacklogName] = useState("");
  const [newBacklogDescription, setNewBacklogDescription] = useState("");
  const [newBacklogMode, setNewBacklogMode] = useState<BacklogMode>("scrum");
  const [newBacklogProjectId, setNewBacklogProjectId] = useState<string | null>(null);
  
  const isCreatingNew = id === "new";

  const { data: backlog, isLoading } = useQuery<BacklogData>({
    queryKey: ["/api/backlogs", id],
    enabled: !isCreatingNew,
  });

  // Fetch account users for assignee/reporter selectors
  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/accounts", accountId, "users"],
    enabled: !!accountId,
  });

  // Fetch projects for the edit backlog dialog
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
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

  // Persist showEpicColumn to localStorage
  useEffect(() => {
    localStorage.setItem('backlog-show-epic-column', showEpicColumn.toString());
  }, [showEpicColumn]);

  // Auto-open ticket from URL query parameter (e.g., ?ticket=abc123)
  useEffect(() => {
    if (!backlog) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('ticket');
    
    if (ticketId && !selectedTicket) {
      // Transform all tickets to flat format to find the one with matching ID
      const allTickets = transformToFlatTickets(
        backlog.epics || [],
        backlog.userStories || [],
        backlog.backlogTasks || [],
        users
      );
      
      const foundTicket = allTickets.find(t => t.id === ticketId);
      if (foundTicket) {
        setSelectedTicket(foundTicket);
        // Clear the query parameter from URL without reloading
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [backlog, users, selectedTicket]);

  // Create new backlog mutation
  const createBacklogMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; mode: BacklogMode; projectId?: string | null }) => {
      const res = await apiRequest("/api/backlogs", "POST", data);
      return res.json();
    },
    onSuccess: (newBacklog: Backlog) => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs"] });
      toastSuccess({ title: "Backlog créé" });
      navigate(`/product/backlog/${newBacklog.id}`);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const createEpicMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; priority?: string; color?: string }) => {
      return apiRequest(`/api/backlogs/${id}/epics`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toastSuccess({ title: "Epic créé" });
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
      toastSuccess({ title: "Epic mis à jour" });
      setEditingEpic(null);
      setShowEpicDialog(false);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteEpicMutation = useMutation({
    mutationFn: async (epicId: string) => apiRequest(`/api/epics/${epicId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toastSuccess({ title: "Epic supprimé" });
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
      toastSuccess({ title: "User Story créée" });
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
      toastSuccess({ title: "User Story mise à jour" });
      setEditingUserStory(null);
      setShowUserStoryDialog(false);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteUserStoryMutation = useMutation({
    mutationFn: async (usId: string) => apiRequest(`/api/user-stories/${usId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toastSuccess({ title: "User Story supprimée" });
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
      toastSuccess({ title: "Tâche créée" });
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
      toastSuccess({ title: "Tâche supprimée" });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const createSprintMutation = useMutation({
    mutationFn: async (data: { name: string; goal?: string; startDate?: string; endDate?: string }) => {
      return apiRequest(`/api/backlogs/${id}/sprints`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toastSuccess({ title: "Sprint créé" });
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
      toastSuccess({ title: "Sprint mis à jour" });
      setShowSprintDialog(false);
      setEditingSprint(null);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const startSprintMutation = useMutation({
    mutationFn: async (sprintId: string) => apiRequest(`/api/sprints/${sprintId}/start`, "PATCH"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toastSuccess({ title: "Sprint démarré" });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const closeSprintMutation = useMutation({
    mutationFn: async ({ sprintId, redirectTo }: { sprintId: string; redirectTo?: string }) => 
      apiRequest(`/api/sprints/${sprintId}/close`, "PATCH", { redirectTo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toastSuccess({ title: "Sprint clôturé" });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const updateBacklogMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; projectId?: string | null }) => {
      return apiRequest(`/api/backlogs/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs"] });
      toastSuccess({ title: "Backlog mis à jour" });
      setShowEditBacklogDialog(false);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteBacklogMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/backlogs/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs"] });
      toastSuccess({ title: "Backlog supprimé" });
      setShowEditBacklogDialog(false);
      navigate("/product");
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
      toastSuccess({ title: "Colonne créée" });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      return apiRequest(`/api/backlog-columns/${columnId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toastSuccess({ title: "Colonne supprimée" });
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
      toastSuccess({ title: "Tâche créée" });
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

  // Kanban helpers - uses userStories with columnId for Kanban mode
  const getStoriesForColumn = (columnId: string) => {
    return backlog?.userStories.filter(us => us.columnId === columnId) || [];
  };

  const getUnassignedStories = () => {
    return backlog?.userStories.filter(us => !us.columnId) || [];
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

  // Priority order for sorting
  const priorityOrder: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const stateOrder: Record<string, number> = { a_faire: 1, en_cours: 2, review: 3, termine: 4 };

  // Apply filters and sorting to tickets
  const applyFiltersAndSort = (tickets: FlatTicket[]) => {
    let result = [...tickets];
    
    // Apply search filter
    if (ticketSearch.trim()) {
      const search = ticketSearch.toLowerCase().trim();
      result = result.filter(t => 
        t.title?.toLowerCase().includes(search) ||
        t.description?.toLowerCase().includes(search)
      );
    }
    
    // Apply state filter
    if (stateFilter !== "all") {
      result = result.filter(t => t.state === stateFilter);
    }
    
    // Apply priority filter
    if (priorityFilter !== "all") {
      result = result.filter(t => t.priority === priorityFilter);
    }
    
    // Apply epic filter (multi-select)
    if (epicFilter.length > 0) {
      result = result.filter(t => t.epicId && epicFilter.includes(t.epicId));
    }
    
    // Apply sorting
    if (sortBy === "priority_desc") {
      result.sort((a, b) => (priorityOrder[b.priority || "medium"] || 2) - (priorityOrder[a.priority || "medium"] || 2));
    } else if (sortBy === "priority_asc") {
      result.sort((a, b) => (priorityOrder[a.priority || "medium"] || 2) - (priorityOrder[b.priority || "medium"] || 2));
    } else if (sortBy === "state") {
      result.sort((a, b) => (stateOrder[a.state || "a_faire"] || 1) - (stateOrder[b.state || "a_faire"] || 1));
    } else if (sortBy === "title") {
      result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    
    return result;
  };

  const getTicketsForSprint = (sprintId: string) => {
    const tickets = flatTickets.filter(t => t.sprintId === sprintId);
    return applyFiltersAndSort(tickets);
  };

  const getBacklogTickets = () => {
    // Exclude epics from backlog pool - they should only appear in Epics tab
    const tickets = flatTickets.filter(t => !t.sprintId && t.type !== "epic");
    return applyFiltersAndSort(tickets);
  };

  // Get unfinished tickets without filters (for sprint close modal)
  const getUnfinishedTicketsForSprint = (sprintId: string) => {
    const rawTickets = flatTickets.filter(t => t.sprintId === sprintId);
    return rawTickets.filter(t => t.state !== "termine");
  };

  // Handle sprint close attempt - check for unfinished tickets
  const handleSprintCloseAttempt = (sprintId: string) => {
    const unfinishedTickets = getUnfinishedTicketsForSprint(sprintId);
    if (unfinishedTickets.length === 0) {
      // All tickets are done, close directly (no redirect needed)
      closeSprintMutation.mutate({ sprintId });
    } else {
      // Show modal to redirect unfinished tickets
      setClosingSprintId(sprintId);
      setRedirectTarget("backlog");
      setShowSprintCloseModal(true);
    }
  };

  // Handle sprint close with ticket redirection (backend handles all logic)
  const handleConfirmSprintClose = async () => {
    if (!closingSprintId) return;
    
    try {
      // Backend handles ticket reassignment and sprint closure
      await closeSprintMutation.mutateAsync({ 
        sprintId: closingSprintId, 
        redirectTo: redirectTarget 
      });
      
      setShowSprintCloseModal(false);
      setClosingSprintId(null);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
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
      
      toastSuccess({ title: "Ticket mis à jour" });
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
      
      toastSuccess({ title: "Ticket supprimé" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };
  
  // Handle inline state update
  const handleInlineStateUpdate = async (ticketId: string, type: TicketType, state: string) => {
    await handleUpdateTicket(ticketId, type, { state });
  };
  
  // Handle inline field update (priority, estimatePoints, assigneeId)
  const handleInlineFieldUpdate = async (ticketId: string, type: TicketType, field: string, value: any) => {
    await handleUpdateTicket(ticketId, type, { [field]: value });
  };

  // Handle ticket actions from dropdown menu
  const handleTicketAction = async (action: TicketAction) => {
    try {
      switch (action.type) {
        case "move_top":
          // Move ticket to top of its current sprint/backlog
          await handleUpdateTicket(action.ticketId, action.ticketType, { order: 0 });
          toastSuccess({ title: "Ticket déplacé en haut" });
          break;
          
        case "move_bottom":
          // Move ticket to bottom - set a high order number
          await handleUpdateTicket(action.ticketId, action.ticketType, { order: 999999 });
          toastSuccess({ title: "Ticket déplacé en bas" });
          break;
          
        case "move_sprint":
          // Move ticket to a different sprint (or null for backlog)
          await handleUpdateTicket(action.ticketId, action.ticketType, { sprintId: action.sprintId || null });
          toastSuccess({ 
            title: action.sprintId ? "Ticket déplacé vers le sprint" : "Ticket déplacé vers le backlog"
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
            toastSuccess({ title: "Ticket copié" });
          }
          break;
          
        case "delete":
          await handleDeleteTicket(action.ticketId, action.ticketType);
          break;
          
        case "assign":
          await handleUpdateTicket(action.ticketId, action.ticketType, { assigneeId: action.assigneeId || null });
          toastSuccess({ 
            title: action.assigneeId ? "Ticket assigné" : "Assignation retirée"
          });
          break;
          
        case "mark_status":
          if (action.state) {
            await handleUpdateTicket(action.ticketId, action.ticketType, { state: action.state });
            const stateLabel = backlogItemStateOptions.find(s => s.value === action.state)?.label || action.state;
            toastSuccess({ title: `Statut: ${stateLabel}` });
          }
          break;
          
        case "set_estimate":
          await handleUpdateTicket(action.ticketId, action.ticketType, { estimatePoints: action.estimatePoints || null });
          toastSuccess({ 
            title: action.estimatePoints ? `${action.estimatePoints} points estimés` : "Estimation retirée"
          });
          break;
          
        case "set_priority":
          if (action.priority) {
            await handleUpdateTicket(action.ticketId, action.ticketType, { priority: action.priority });
            const priorityLabel = backlogPriorityOptions.find(p => p.value === action.priority)?.label || action.priority;
            toastSuccess({ title: `Priorité: ${priorityLabel}` });
          }
          break;
          
        case "convert_to_task":
          // Convert backlog task to a main task (Tasks page)
          if (action.ticketType === "task") {
            const backlogTask = backlog?.backlogTasks?.find(t => t.id === action.ticketId);
            if (backlogTask) {
              // Create a new task in the main Tasks system
              await apiRequest("/api/tasks", "POST", {
                title: backlogTask.title,
                description: backlogTask.description,
                priority: backlogTask.priority || "medium",
                status: backlogTask.state === "termine" ? "completed" : 
                        backlogTask.state === "en_cours" ? "in_progress" : "todo",
              });
              toastSuccess({ 
                title: "Tâche créée", 
                description: "Le ticket a été ajouté dans les Tâches"
              });
            }
          }
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
      
      toastSuccess({ 
        title: "Type converti", 
        description: `Converti en ${toType === "epic" ? "Epic" : toType === "user_story" ? "User Story" : "Task"}`
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
      toastSuccess({ title: "Ticket créé" });
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
      toastSuccess({ title: "Ticket créé" });
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

  if (isLoading && !isCreatingNew) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show creation form when id is "new"
  if (isCreatingNew) {
    const handleCreateBacklog = () => {
      if (!newBacklogName.trim()) {
        toast({ title: "Erreur", description: "Le nom est requis", variant: "destructive" });
        return;
      }
      createBacklogMutation.mutate({
        name: newBacklogName,
        description: newBacklogDescription || undefined,
        mode: newBacklogMode,
        projectId: newBacklogProjectId,
      });
    };

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 p-4 md:p-6 border-b">
          <Button variant="ghost" size="icon" onClick={() => navigate("/product")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Nouveau Backlog</h1>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Créer un nouveau backlog</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Mode selection */}
              <div className="space-y-2">
                <Label>Mode de gestion</Label>
                <div className="grid grid-cols-2 gap-3">
                  {backlogModeOptions.map((option) => (
                    <div
                      key={option.value}
                      className={`relative flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        newBacklogMode === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setNewBacklogMode(option.value as BacklogMode)}
                      data-testid={`button-mode-${option.value}`}
                    >
                      {option.value === "kanban" ? (
                        <Layers className="h-8 w-8 mb-2 text-primary" />
                      ) : (
                        <ListTodo className="h-8 w-8 mb-2 text-primary" />
                      )}
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground text-center mt-1">
                        {option.value === "kanban" 
                          ? "Gestion visuelle par colonnes"
                          : "Gestion par sprints et itérations"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input 
                  value={newBacklogName} 
                  onChange={(e) => setNewBacklogName(e.target.value)} 
                  placeholder="Nom du backlog"
                  data-testid="input-backlog-name"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={newBacklogDescription} 
                  onChange={(e) => setNewBacklogDescription(e.target.value)} 
                  placeholder="Description (optionnel)"
                  rows={3}
                  data-testid="input-backlog-description"
                />
              </div>

              {/* Project */}
              <div className="space-y-2">
                <Label>Projet (optionnel)</Label>
                <Select 
                  value={newBacklogProjectId || "none"} 
                  onValueChange={(v) => setNewBacklogProjectId(v === "none" ? null : v)}
                >
                  <SelectTrigger data-testid="select-backlog-project">
                    <SelectValue placeholder="Sélectionner un projet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun projet</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <Folder className="h-3 w-3" />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => navigate("/product")} data-testid="button-cancel">
                  Annuler
                </Button>
                <Button 
                  onClick={handleCreateBacklog} 
                  disabled={createBacklogMutation.isPending || !newBacklogName.trim()}
                  data-testid="button-create"
                >
                  {createBacklogMutation.isPending ? "Création..." : "Créer le backlog"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <h1 className="text-xl font-bold truncate" data-testid="text-backlog-title">{backlog.name}</h1>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 shrink-0"
            onClick={() => {
              setEditBacklogName(backlog.name);
              setEditBacklogDescription(backlog.description || "");
              setEditBacklogProjectId(backlog.projectId || null);
              setShowEditBacklogDialog(true);
            }}
            data-testid="button-edit-backlog"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {backlog.description && (
            <p className="text-sm text-muted-foreground truncate hidden md:block">{backlog.description}</p>
          )}
        </div>
        <Badge variant="secondary" className="capitalize">
          {backlog.mode}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 md:px-6 border-b">
          <TabsList className="h-10">
            <TabsTrigger value="backlog" className="text-sm" data-testid="tab-backlog">
              Backlog
            </TabsTrigger>
            <TabsTrigger value="epics" className="text-sm" data-testid="tab-epics">
              Epics
            </TabsTrigger>
            <TabsTrigger value="done" className="text-sm" data-testid="tab-done">
              Tickets terminés
            </TabsTrigger>
            <TabsTrigger value="retrospective" className="text-sm" data-testid="tab-retrospective">
              Rétrospective
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="backlog" className="flex-1 overflow-auto p-4 md:p-6 mt-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          {/* Left: Search + Creation buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Rechercher..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className="pl-8 h-8 w-[150px] text-sm"
                data-testid="input-ticket-search"
              />
            </div>
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
          
          {/* Right: Filters and Sort */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Epic column toggle - left aligned with icon and text centered */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground invisible">Epic</Label>
              <div className="flex items-center gap-2 h-8">
                <Checkbox 
                  id="show-epic-column" 
                  checked={showEpicColumn}
                  onCheckedChange={(checked) => setShowEpicColumn(checked === true)}
                  data-testid="checkbox-show-epic-column"
                />
                <label 
                  htmlFor="show-epic-column" 
                  className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1"
                >
                  <Layers className="h-4 w-4" />
                  Epic
                </label>
              </div>
            </div>
            
            {/* Priority filter */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Priorité</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[130px] h-8 text-sm" data-testid="select-priority-filter">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {backlogPriorityOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Epic filter (multi-select) */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Epic</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-[150px] h-8 justify-between bg-white dark:bg-white text-gray-900"
                    data-testid="button-epic-filter"
                  >
                    <span className="flex items-center gap-1 truncate">
                      <Layers className="h-3.5 w-3.5" />
                      {epicFilter.length === 0 
                        ? "Toutes" 
                        : epicFilter.length === 1 
                          ? backlog.epics.find(e => e.id === epicFilter[0])?.title?.substring(0, 12) || "1 sélectionné"
                          : `${epicFilter.length} sélectionnées`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-2 bg-white dark:bg-white" align="start">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sm text-gray-900 hover:bg-gray-100"
                      onClick={() => setEpicFilter([])}
                    >
                      <Check className={cn("h-4 w-4 mr-2", epicFilter.length === 0 ? "opacity-100" : "opacity-0")} />
                      Toutes les Epics
                    </Button>
                    {backlog.epics.map(epic => (
                      <Button
                        key={epic.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm text-gray-900 hover:bg-gray-100"
                        onClick={() => {
                          setEpicFilter(prev => 
                            prev.includes(epic.id) 
                              ? prev.filter(id => id !== epic.id)
                              : [...prev, epic.id]
                          );
                        }}
                      >
                        <Check className={cn("h-4 w-4 mr-2", epicFilter.includes(epic.id) ? "opacity-100" : "opacity-0")} />
                        <span 
                          className="w-2 h-2 rounded-full mr-2 flex-shrink-0" 
                          style={{ backgroundColor: epic.color || "#8B5CF6" }}
                        />
                        <span className="truncate">{epic.title}</span>
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Sort by */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Trier par</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[150px] h-8 text-sm" data-testid="select-sort-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="state">État</SelectItem>
                  <SelectItem value="priority_desc">Priorité décroissante</SelectItem>
                  <SelectItem value="priority_asc">Priorité croissante</SelectItem>
                  <SelectItem value="title">Titre (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Kanban Board View */}
        {backlog.mode === "kanban" && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleKanbanDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-board">
              {backlog.columns.sort((a, b) => a.order - b.order).map(column => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  stories={getStoriesForColumn(column.id)}
                  onAddStory={() => {
                    setSelectedColumnId(column.id);
                    setShowUserStoryDialog(true);
                  }}
                  onDeleteColumn={() => deleteColumnMutation.mutate(column.id)}
                  onDeleteStory={(storyId) => deleteUserStoryMutation.mutate(storyId)}
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
                {/* Hide finished sprints checkbox */}
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox 
                    id="hide-finished-sprints" 
                    checked={hideFinishedSprints}
                    onCheckedChange={(checked) => setHideFinishedSprints(checked === true)}
                    data-testid="checkbox-hide-finished-sprints"
                  />
                  <label 
                    htmlFor="hide-finished-sprints" 
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Masquer les sprints terminés
                  </label>
                </div>

                {/* Sprint Sections */}
                {backlog.sprints
                  .filter(s => !hideFinishedSprints || s.status !== "termine")
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
                      epics={backlog.epics}
                      showEpicColumn={showEpicColumn}
                      isExpanded={isSprintExpanded(sprint.id)}
                      onToggle={() => toggleSprint(sprint.id)}
                      onSelectTicket={handleSelectTicket}
                      onCreateTicket={handleCreateSprintTicket}
                      onStartSprint={(sprintId) => startSprintMutation.mutate(sprintId)}
                      onCompleteSprint={handleSprintCloseAttempt}
                      onEditSprint={(sprint) => { setEditingSprint(sprint); setShowSprintDialog(true); }}
                      onUpdateState={handleInlineStateUpdate}
                      onUpdateField={handleInlineFieldUpdate}
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
                  epics={backlog.epics}
                  showEpicColumn={showEpicColumn}
                  isExpanded={backlogPoolExpanded}
                  onToggle={() => setBacklogPoolExpanded(!backlogPoolExpanded)}
                  onSelectTicket={handleSelectTicket}
                  onCreateTicket={handleCreateBacklogTicket}
                  onUpdateState={handleInlineStateUpdate}
                  onUpdateField={handleInlineFieldUpdate}
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
        </TabsContent>

        {/* Epics tab */}
        <TabsContent value="epics" className="flex-1 overflow-auto p-4 md:p-6 mt-0">
          <div className="space-y-4">
            {/* Header with Create button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Gestion des Epics</h2>
                <p className="text-sm text-muted-foreground">
                  Organisez vos grandes fonctionnalités en Epics pour regrouper les User Stories
                </p>
              </div>
              <Button onClick={() => { setEditingEpic(null); setShowEpicDialog(true); }} data-testid="button-create-epic">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Epic
              </Button>
            </div>

            {/* Epics list */}
            {backlog.epics.length === 0 ? (
              <div className="border rounded-lg p-8 text-center text-muted-foreground bg-muted/30">
                <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Aucune Epic</p>
                <p className="text-sm">Créez votre première Epic pour commencer à organiser votre backlog</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {backlog.epics.map(epic => {
                  const storiesInEpic = backlog.userStories.filter(us => us.epicId === epic.id);
                  const totalPoints = storiesInEpic.reduce((sum, us) => sum + (us.estimatePoints || 0), 0);
                  const doneStories = storiesInEpic.filter(us => us.state === "termine").length;
                  const progress = storiesInEpic.length > 0 ? Math.round((doneStories / storiesInEpic.length) * 100) : 0;
                  
                  return (
                    <div
                      key={epic.id}
                      className="border rounded-lg overflow-hidden bg-card hover-elevate cursor-pointer"
                      onClick={() => {
                        setEditingEpic(epic);
                        setShowEpicDialog(true);
                      }}
                      data-testid={`epic-card-${epic.id}`}
                    >
                      <div 
                        className="h-2" 
                        style={{ backgroundColor: epic.color || "#8B5CF6" }}
                      />
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="flex items-center justify-center h-6 w-6 rounded"
                              style={{ backgroundColor: epic.color || "#8B5CF6" }}
                            >
                              <Layers className="h-3.5 w-3.5 text-white" />
                            </div>
                            <h3 className="font-semibold text-sm">{epic.title}</h3>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs capitalize",
                              epic.state === "termine" && "text-green-600 border-green-200 bg-green-50",
                              epic.state === "en_cours" && "text-blue-600 border-blue-200 bg-blue-50",
                              epic.state === "todo" && "text-gray-600 border-gray-200 bg-gray-50"
                            )}
                          >
                            {epic.state === "termine" ? "Terminé" : epic.state === "en_cours" ? "En cours" : "À faire"}
                          </Badge>
                        </div>
                        
                        {epic.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{epic.description}</p>
                        )}
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{storiesInEpic.length} User Stories</span>
                            <span>{totalPoints} points</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{doneStories}/{storiesInEpic.length} terminées</span>
                            <span className="font-medium text-green-600">{progress}%</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              epic.priority === "high" && "text-red-600 border-red-200",
                              epic.priority === "medium" && "text-yellow-600 border-yellow-200",
                              epic.priority === "low" && "text-blue-600 border-blue-200"
                            )}
                          >
                            {epic.priority === "high" ? "Haute" : epic.priority === "medium" ? "Moyenne" : "Basse"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEpicToDelete(epic);
                            }}
                            data-testid={`button-delete-epic-${epic.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tickets terminés tab */}
        <TabsContent value="done" className="flex-1 overflow-auto p-4 md:p-6 mt-0">
          <div className="relative h-full">
            <CompletedTicketsView 
              tickets={flatTickets.filter(t => t.state === "termine")}
              users={users}
              sprints={backlog.sprints}
              onSelectTicket={handleSelectTicket}
              selectedTicketId={selectedTicket?.id}
            />
            {/* Read-only Ticket Detail Panel for completed tickets */}
            {selectedTicket && selectedTicket.state === "termine" && (
              <>
                <div 
                  className="fixed inset-0 bg-black/10 z-40"
                  onClick={() => setSelectedTicket(null)}
                  data-testid="completed-ticket-panel-backdrop"
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
                    readOnly={true}
                  />
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Rétrospective tab */}
        <TabsContent value="retrospective" className="flex-1 overflow-auto p-4 md:p-6 mt-0">
          <RetrospectiveView backlogId={id!} sprints={backlog.sprints} />
        </TabsContent>
      </Tabs>

      {/* Epic Delete Confirmation Dialog */}
      <AlertDialog open={!!epicToDelete} onOpenChange={(open) => !open && setEpicToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'Epic</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l'Epic "{epicToDelete?.title}" ? 
              Cette action est irréversible et les User Stories associées seront détachées de cette Epic.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (epicToDelete) {
                  deleteEpicMutation.mutate(epicToDelete.id);
                  setEpicToDelete(null);
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Edit Backlog Sheet (Side Panel) */}
      <Sheet open={showEditBacklogDialog} onOpenChange={setShowEditBacklogDialog}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Modifier le backlog</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input 
                value={editBacklogName} 
                onChange={(e) => setEditBacklogName(e.target.value)} 
                placeholder="Nom du backlog"
                data-testid="input-edit-backlog-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={editBacklogDescription} 
                onChange={(e) => setEditBacklogDescription(e.target.value)} 
                placeholder="Description (optionnel)"
                rows={3}
                data-testid="input-edit-backlog-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Projet</Label>
              <Select 
                value={editBacklogProjectId || "none"} 
                onValueChange={(v) => setEditBacklogProjectId(v === "none" ? null : v)}
              >
                <SelectTrigger data-testid="select-edit-backlog-project">
                  <SelectValue placeholder="Sélectionner un projet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun projet</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <Folder className="h-3 w-3" />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="flex flex-col gap-3 sm:flex-col">
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => {
                  setShowEditBacklogDialog(false);
                  setEditBacklogName("");
                  setEditBacklogDescription("");
                  setEditBacklogProjectId(null);
                }} className="flex-1" data-testid="button-cancel-edit-backlog">
                Annuler
              </Button>
              <Button 
                onClick={() => updateBacklogMutation.mutate({ 
                  name: editBacklogName, 
                  description: editBacklogDescription || undefined,
                  projectId: editBacklogProjectId
                })}
                disabled={updateBacklogMutation.isPending || !editBacklogName.trim()}
                className="flex-1"
                data-testid="button-submit-edit-backlog"
              >
                {updateBacklogMutation.isPending ? "..." : "Enregistrer"}
              </Button>
            </div>
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteConfirmDialog(true)}
              disabled={deleteBacklogMutation.isPending}
              className="w-full"
              data-testid="button-delete-backlog"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteBacklogMutation.isPending ? "Suppression..." : "Supprimer le backlog"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Backlog Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le backlog</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce backlog ? Cette action est irréversible et supprimera tous les tickets, epics, user stories et tâches associés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-backlog">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteBacklogMutation.mutate();
                setShowDeleteConfirmDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-backlog"
            >
              {deleteBacklogMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sprint Close Modal */}
      <Dialog open={showSprintCloseModal} onOpenChange={setShowSprintCloseModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Terminer le sprint</DialogTitle>
            <DialogDescription>
              {closingSprintId && (
                <>
                  Ce sprint contient {getUnfinishedTicketsForSprint(closingSprintId).length} ticket(s) non terminé(s). 
                  Choisissez où les rediriger avant de clôturer le sprint.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rediriger les tickets non terminés vers :</Label>
              <Select value={redirectTarget} onValueChange={setRedirectTarget}>
                <SelectTrigger data-testid="select-redirect-target">
                  <SelectValue placeholder="Choisir la destination" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  {backlog.sprints
                    .filter(s => s.id !== closingSprintId && s.status !== "termine")
                    .map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            {closingSprintId && getUnfinishedTicketsForSprint(closingSprintId).length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                <p className="text-sm text-muted-foreground mb-2">Tickets à rediriger :</p>
                <ul className="space-y-1">
                  {getUnfinishedTicketsForSprint(closingSprintId).map(ticket => (
                    <li key={ticket.id} className="text-sm flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {ticket.type === "epic" ? "Epic" : ticket.type === "user_story" ? "Story" : "Task"}
                      </Badge>
                      <span className="truncate">{ticket.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSprintCloseModal(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleConfirmSprintClose}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              data-testid="button-confirm-close-sprint"
            >
              Terminer le sprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <div className="rounded-lg border bg-card p-3 py-4">
        <div className="flex items-center gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" data-testid={`button-toggle-story-${story.id}`}>
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          {story.priority && (
            <div 
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: getPriorityColor(story.priority) }}
              title={story.priority}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate" data-testid={`text-story-title-${story.id}`}>{story.title}</span>
              {story.complexity && (
                <Badge variant="outline" className="text-xs">{story.complexity}</Badge>
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
              {(story.tasks?.length ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground">
                  {story.tasks?.filter(t => t.state === "termine").length ?? 0}/{story.tasks?.length ?? 0} tâches
                </span>
              )}
            </div>
          </div>
          {story.estimatePoints && (
            <Badge variant="secondary" className="text-xs flex-shrink-0">{story.estimatePoints} pts</Badge>
          )}
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
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto bg-white dark:bg-white">
        <SheetHeader>
          <SheetTitle className="text-gray-900">{epic ? "Modifier l'Epic" : "Nouvel Epic"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-gray-700">Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de l'epic" className="bg-white text-gray-900 border-gray-300" data-testid="input-epic-title" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="bg-white text-gray-900 border-gray-300" data-testid="input-epic-description" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Priorité</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="bg-white text-gray-900 border-gray-300" data-testid="select-epic-priority"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {backlogPriorityOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-gray-900">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Couleur</Label>
            <div className="flex gap-2">
              {colors.map((c, i) => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-gray-900" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  data-testid={`button-epic-color-${i}`}
                />
              ))}
            </div>
          </div>
        </div>
        <SheetFooter className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="text-gray-700" data-testid="button-cancel-epic">Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim()} data-testid="button-submit-epic">
            {isPending ? "..." : epic ? "Enregistrer" : "Créer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto bg-white dark:bg-white">
        <SheetHeader>
          <SheetTitle className="text-gray-900">{userStory ? "Modifier la User Story" : "Nouvelle User Story"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-gray-700">Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="En tant que..." className="bg-white text-gray-900 border-gray-300" data-testid="input-userstory-title" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="bg-white text-gray-900 border-gray-300" data-testid="input-userstory-description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Epic</Label>
              <Select value={epicId || "none"} onValueChange={(v) => setEpicId(v === "none" ? null : v)}>
                <SelectTrigger className="bg-white text-gray-900 border-gray-300" data-testid="select-userstory-epic"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="none" className="text-gray-900">Aucun</SelectItem>
                  {epics.map(epic => (
                    <SelectItem key={epic.id} value={epic.id} className="text-gray-900">{epic.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="bg-white text-gray-900 border-gray-300" data-testid="select-userstory-priority"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {backlogPriorityOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-gray-900">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Complexité</Label>
              <Select value={complexity || "none"} onValueChange={(v) => setComplexity(v === "none" ? null : v)}>
                <SelectTrigger className="bg-white text-gray-900 border-gray-300" data-testid="select-userstory-complexity"><SelectValue placeholder="--" /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="none" className="text-gray-900">--</SelectItem>
                  {complexityOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-gray-900">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Story Points</Label>
              <Input 
                type="number" 
                value={estimatePoints ?? ""} 
                onChange={(e) => setEstimatePoints(e.target.value ? parseInt(e.target.value) : null)} 
                min={0}
                className="bg-white text-gray-900 border-gray-300"
                data-testid="input-userstory-points"
              />
            </div>
          </div>
        </div>
        <SheetFooter className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="text-gray-700" data-testid="button-cancel-userstory">Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim()} data-testid="button-submit-userstory">
            {isPending ? "..." : userStory ? "Enregistrer" : "Créer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
      startDate: startDate ? new Date(startDate) : null, 
      endDate: endDate ? new Date(endDate) : null 
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
  stories,
  onAddStory,
  onDeleteColumn,
  onDeleteStory,
  getPriorityColor
}: {
  column: BacklogColumn;
  stories: UserStory[];
  onAddStory: () => void;
  onDeleteColumn: () => void;
  onDeleteStory: (storyId: string) => void;
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
            {stories.length}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-menu-column-${column.id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onAddStory} data-testid={`menu-add-story-column-${column.id}`}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une story
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onDeleteColumn} data-testid={`menu-delete-column-${column.id}`}>
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SortableContext id={column.id} items={stories.map(s => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[100px]" data-testid={`column-stories-${column.id}`}>
          {stories.map(story => (
            <KanbanStoryCard 
              key={story.id} 
              story={story}
              columnId={column.id}
              onDelete={() => onDeleteStory(story.id)}
              getPriorityColor={getPriorityColor}
            />
          ))}
        </div>
      </SortableContext>

      <Button 
        size="sm" 
        variant="ghost" 
        className="w-full mt-2"
        onClick={onAddStory}
        data-testid={`button-add-story-column-${column.id}`}
      >
        <Plus className="h-3 w-3 mr-1" />
        Ajouter
      </Button>
    </div>
  );
}

function KanbanStoryCard({ 
  story, 
  columnId,
  onDelete,
  getPriorityColor
}: { 
  story: UserStory;
  columnId: string;
  onDelete: () => void;
  getPriorityColor: (priority: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: story.id,
    data: { columnId, story }
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
      data-testid={`card-kanban-story-${story.id}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" data-testid={`text-kanban-story-title-${story.id}`}>{story.title}</p>
          {story.description && (
            <p className="text-xs text-muted-foreground truncate mt-1">{story.description}</p>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          data-testid={`button-delete-kanban-story-${story.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {story.priority && (
          <Badge 
            variant="secondary" 
            className="text-xs"
            style={{ backgroundColor: getPriorityColor(story.priority) }}
            data-testid={`badge-kanban-story-priority-${story.id}`}
          >
            {story.priority}
          </Badge>
        )}
        {story.estimatePoints && (
          <Badge variant="outline" className="text-xs" data-testid={`badge-kanban-story-points-${story.id}`}>
            {story.estimatePoints} pts
          </Badge>
        )}
      </div>
    </Card>
  );
}

// Completed Tickets View Component
function CompletedTicketsView({
  tickets,
  users,
  sprints,
  onSelectTicket,
  selectedTicketId
}: {
  tickets: FlatTicket[];
  users: AppUser[];
  sprints: Sprint[];
  onSelectTicket: (ticket: FlatTicket) => void;
  selectedTicketId?: string;
}) {
  const getAssigneeName = (assigneeId?: string | null) => {
    if (!assigneeId) return null;
    const user = users.find(u => u.id === assigneeId);
    if (!user) return null;
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    return user.email || null;
  };

  const getSprintName = (sprintId?: string | null) => {
    if (!sprintId) return null;
    const sprint = sprints.find(s => s.id === sprintId);
    return sprint?.name || null;
  };

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Aucun ticket terminé</h3>
        <p className="text-sm text-muted-foreground">
          Les tickets avec l'état "Terminé" apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
          {tickets.length} ticket{tickets.length > 1 ? 's' : ''} terminé{tickets.length > 1 ? 's' : ''}
        </Badge>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Titre</th>
              <th className="px-4 py-2 hidden md:table-cell">Sprint</th>
              <th className="px-4 py-2 hidden md:table-cell">Assigné à</th>
              <th className="px-4 py-2 hidden lg:table-cell">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tickets.map(ticket => (
              <tr
                key={ticket.id}
                className={`hover:bg-muted/30 cursor-pointer ${selectedTicketId === ticket.id ? 'bg-primary/10' : ''}`}
                onClick={() => onSelectTicket(ticket)}
                data-testid={`row-completed-ticket-${ticket.id}`}
              >
                <td className="px-4 py-2">
                  <Badge variant="outline" className="text-xs">
                    {ticket.type === 'epic' ? 'Epic' : ticket.type === 'user_story' ? 'Story' : 'Task'}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  <span className="text-sm font-medium">{ticket.title}</span>
                </td>
                <td className="px-4 py-2 hidden md:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {getSprintName(ticket.sprintId) || '-'}
                  </span>
                </td>
                <td className="px-4 py-2 hidden md:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {getAssigneeName(ticket.assigneeId) || '-'}
                  </span>
                </td>
                <td className="px-4 py-2 hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {ticket.estimatePoints || '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Retrospective List and Detail Component
function RetrospectiveView({ backlogId, sprints }: { backlogId: string; sprints: Sprint[] }) {
  const { toast } = useToast();
  const [selectedRetroId, setSelectedRetroId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");

  // Fetch all retros for this backlog
  const { data: retrosList = [], isLoading: retrosLoading } = useQuery<(Retro & { sprint?: Sprint; cardCount?: number })[]>({
    queryKey: ["/api/backlogs", backlogId, "retros"],
    queryFn: async () => {
      const res = await apiRequest(`/api/backlogs/${backlogId}/retros`, "GET");
      return res.json();
    },
  });

  const createRetroMutation = useMutation({
    mutationFn: async (sprintId: string | null) => {
      const res = await apiRequest(`/api/backlogs/${backlogId}/retros`, "POST", { sprintId });
      return res.json();
    },
    onSuccess: (data: Retro) => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", backlogId, "retros"] });
      setCreateDialogOpen(false);
      setSelectedSprintId("");
      toastSuccess({ title: "Rétrospective créée" });
      // Auto-redirect to the new retro
      setSelectedRetroId(data.id);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  if (retrosLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show detail view if a retro is selected
  if (selectedRetroId) {
    return (
      <RetroKanbanDetail 
        retroId={selectedRetroId} 
        backlogId={backlogId}
        onBack={() => setSelectedRetroId(null)} 
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="retro-list">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Rétrospectives</h3>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-create-retro">
              <Plus className="h-4 w-4 mr-1" />
              Nouvelle rétrospective
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle rétrospective</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Sprint associé (optionnel)</Label>
                <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
                  <SelectTrigger data-testid="select-sprint-for-retro">
                    <SelectValue placeholder="Sélectionner un sprint" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun sprint</SelectItem>
                    {sprints.map(sprint => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Annuler</Button>
              <Button 
                onClick={() => createRetroMutation.mutate(selectedSprintId === "none" ? null : selectedSprintId || null)}
                disabled={createRetroMutation.isPending}
                data-testid="button-confirm-create-retro"
              >
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {retrosList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Aucune rétrospective</p>
          <p className="text-sm mt-1">Créez une rétrospective pour commencer</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium">N°</th>
                <th className="px-4 py-2 text-left text-xs font-medium">Sprint</th>
                <th className="px-4 py-2 text-left text-xs font-medium">Cartes</th>
                <th className="px-4 py-2 text-left text-xs font-medium">Date de création</th>
                <th className="px-4 py-2 text-left text-xs font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {retrosList.map(retro => (
                <tr 
                  key={retro.id}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                  onClick={() => setSelectedRetroId(retro.id)}
                  data-testid={`row-retro-${retro.id}`}
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium">#{retro.number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{retro.sprint?.name || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {retro.cardCount || 0}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(retro.createdAt), "dd/MM/yyyy", { locale: fr })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge 
                      variant={retro.status === 'termine' ? 'secondary' : 'default'}
                      className={retro.status === 'termine' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}
                    >
                      {retro.status === 'termine' ? 'Terminé' : 'En cours'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Retro Kanban Detail with Drag and Drop
function RetroKanbanDetail({ retroId, backlogId, onBack }: { retroId: string; backlogId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [newCardContent, setNewCardContent] = useState<{ [key: string]: string }>({
    worked: '',
    not_worked: '',
    to_improve: ''
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localCards, setLocalCards] = useState<RetroCard[]>([]);

  // Sensors with activation constraint for smoother drag
  const retroSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch retro details
  const { data: retro, isLoading: retroLoading } = useQuery<Retro & { sprint?: Sprint }>({
    queryKey: ["/api/retros", retroId],
    queryFn: async () => {
      const res = await apiRequest(`/api/retros/${retroId}`, "GET");
      return res.json();
    },
  });

  // Fetch retro cards
  const { data: cards = [] } = useQuery<RetroCard[]>({
    queryKey: ["/api/retros", retroId, "cards"],
    queryFn: async () => {
      const res = await apiRequest(`/api/retros/${retroId}/cards`, "GET");
      return res.json();
    },
  });

  // Sync local cards with fetched cards
  useEffect(() => {
    setLocalCards(cards);
  }, [cards]);

  const createCardMutation = useMutation({
    mutationFn: async ({ column, content }: { column: string; content: string }) => {
      return apiRequest(`/api/retros/${retroId}/cards`, "POST", { column, content });
    },
    onSuccess: (_, { column }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/retros", retroId, "cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", backlogId, "retros"] });
      setNewCardContent(prev => ({ ...prev, [column]: '' }));
      toastSuccess({ title: "Carte ajoutée" });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const updateCardMutation = useMutation({
    mutationFn: async ({ cardId, column }: { cardId: string; column: string }) => {
      return apiRequest(`/api/retro-cards/${cardId}`, "PATCH", { column });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/retros", retroId, "cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", backlogId, "retros"] });
    },
    onError: (error: any) => {
      // Revert optimistic update on error
      setLocalCards(cards);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      return apiRequest(`/api/retro-cards/${cardId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/retros", retroId, "cards"] });
      toastSuccess({ title: "Carte supprimée" });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const finishRetroMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/retros/${retroId}`, "PATCH", { status: "termine" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/retros", retroId] });
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", backlogId, "retros"] });
      toastSuccess({ title: "Rétrospective terminée" });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const columns = [
    { id: 'worked', title: 'Ça a fonctionné', color: 'bg-green-500' },
    { id: 'not_worked', title: 'Ça n\'a pas fonctionné', color: 'bg-red-500' },
    { id: 'to_improve', title: 'À améliorer', color: 'bg-yellow-500' }
  ];

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    let targetColumn = over.id as string;
    
    // If dropped on another card, get that card's column
    const overCard = localCards.find(c => c.id === targetColumn);
    if (overCard) {
      targetColumn = overCard.column;
    }
    
    // Validate target column is one of our columns
    if (!columns.some(c => c.id === targetColumn)) return;
    
    // Find the card
    const card = localCards.find(c => c.id === cardId);
    if (!card || card.column === targetColumn) return;

    // Optimistic update - update local state immediately
    setLocalCards(prev => prev.map(c => 
      c.id === cardId ? { ...c, column: targetColumn } : c
    ));

    // Then sync with server
    updateCardMutation.mutate({ cardId, column: targetColumn });
  };

  const activeCard = activeId ? localCards.find(c => c.id === activeId) : null;

  if (retroLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isFinished = retro?.status === 'termine';

  return (
    <div className="space-y-4" data-testid="retro-kanban-detail">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-to-retros">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="text-lg font-semibold">Rétrospective #{retro?.number}</h3>
            {retro?.sprint && (
              <p className="text-sm text-muted-foreground">Sprint: {retro.sprint.name}</p>
            )}
          </div>
          <Badge 
            variant={isFinished ? 'secondary' : 'default'}
            className={isFinished ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}
          >
            {isFinished ? 'Terminé' : 'En cours'}
          </Badge>
        </div>
        {!isFinished && (
          <Button 
            variant="outline" 
            onClick={() => finishRetroMutation.mutate()}
            disabled={finishRetroMutation.isPending}
            data-testid="button-finish-retro"
          >
            <Check className="h-4 w-4 mr-1" />
            Terminer
          </Button>
        )}
      </div>

      <DndContext 
        sensors={retroSensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4" data-testid="retro-kanban">
          {columns.map(column => {
            const columnCards = localCards.filter(c => c.column === column.id);
            return (
              <RetroColumn
                key={column.id}
                column={column}
                cards={columnCards}
                isFinished={isFinished}
                newCardContent={newCardContent[column.id]}
                onNewCardChange={(value) => setNewCardContent(prev => ({ ...prev, [column.id]: value }))}
                onAddCard={() => createCardMutation.mutate({ column: column.id, content: newCardContent[column.id] })}
                onDeleteCard={(cardId) => deleteCardMutation.mutate(cardId)}
                isAddingCard={createCardMutation.isPending}
              />
            );
          })}
        </div>
        <DragOverlay>
          {activeCard ? (
            <Card className="p-3 shadow-lg opacity-90 rotate-3">
              <p className="text-sm">{activeCard.content}</p>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// Droppable Column for Retro Kanban
function RetroColumn({ 
  column, 
  cards, 
  isFinished,
  newCardContent, 
  onNewCardChange, 
  onAddCard, 
  onDeleteCard,
  isAddingCard
}: { 
  column: { id: string; title: string; color: string };
  cards: RetroCard[];
  isFinished: boolean;
  newCardContent: string;
  onNewCardChange: (value: string) => void;
  onAddCard: () => void;
  onDeleteCard: (cardId: string) => void;
  isAddingCard: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 rounded-lg p-4 bg-muted/50 transition-colors ${isOver ? 'bg-muted' : ''}`}
      data-testid={`retro-column-${column.id}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className={`h-3 w-3 rounded-full ${column.color}`} />
        <h3 className="font-medium text-sm">{column.title}</h3>
        <Badge variant="secondary" className="text-xs ml-auto">
          {cards.length}
        </Badge>
      </div>

      <div className="space-y-2 mb-4 min-h-[100px]">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <DraggableRetroCard 
              key={card.id} 
              card={card} 
              onDelete={onDeleteCard}
              isFinished={isFinished}
            />
          ))}
        </SortableContext>
      </div>

      {!isFinished && (
        <div className="space-y-2">
          <Textarea
            placeholder="Ajouter une carte..."
            value={newCardContent}
            onChange={(e) => onNewCardChange(e.target.value)}
            rows={2}
            className="text-sm"
            data-testid={`input-retro-card-${column.id}`}
          />
          <Button
            size="sm"
            className="w-full"
            disabled={!newCardContent?.trim() || isAddingCard}
            onClick={onAddCard}
            data-testid={`button-add-retro-card-${column.id}`}
          >
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
      )}
    </div>
  );
}

// Draggable Card for Retro
function DraggableRetroCard({ card, onDelete, isFinished }: { card: RetroCard; onDelete: (id: string) => void; isFinished: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: card.id,
    disabled: isFinished,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={`p-3 ${!isFinished ? 'cursor-grab' : ''}`}
      data-testid={`retro-card-${card.id}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm flex-1">{card.content}</p>
        {!isFinished && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            data-testid={`button-delete-retro-card-${card.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </Card>
  );
}
