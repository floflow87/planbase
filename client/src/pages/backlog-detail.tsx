import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, Plus, MoreVertical, ChevronDown, ChevronRight, 
  Folder, Clock, User, Calendar, Flag, Layers, ListTodo,
  Play, Square, CheckCircle, Pencil, Trash2, GripVertical, Search, Check, Trophy,
  CheckSquare, BarChart3, TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2,
  ArrowUp, ArrowDown, ArrowUpDown, Lock, FlaskConical, MessageSquare, X,
  Wrench, Bug, Sparkles, ExternalLink, Filter, HelpCircle
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader } from "@/components/Loader";
import { useToast } from "@/hooks/use-toast";
import { toastSuccess } from "@/design-system/feedback";
import { queryClient, apiRequest, optimisticAdd, optimisticUpdate, optimisticDelete, rollbackOptimistic } from "@/lib/queryClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer 
} from "recharts";
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
  sprintStatusOptions, backlogModeOptions, type BacklogMode,
  recipeStatusOptions, recipeConclusionOptions, type RecipeStatus, type RecipeConclusion,
  type TicketRecipe
} from "@shared/schema";
import { 
  SprintSection, 
  BacklogPool, 
  transformToFlatTickets,
  type FlatTicket,
  type TicketType,
  type TicketAction,
  type BulkAction
} from "@/components/backlog/jira-scrum-view";
import { TicketDetailPanel, type TicketRecipeInfo } from "@/components/backlog/ticket-detail-panel";

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
  
  const [expandedSprints, setExpandedSprints] = useState<Set<string> | "all">(() => {
    if (!id || id === "new") return "all";
    const saved = localStorage.getItem(`backlog-expanded-sprints-${id}`);
    if (!saved) return "all";
    try {
      const parsed = JSON.parse(saved);
      if (parsed === "all") return "all";
      return new Set(parsed);
    } catch {
      return "all";
    }
  });
  const [backlogPoolExpanded, setBacklogPoolExpanded] = useState(() => {
    if (!id || id === "new") return true;
    const saved = localStorage.getItem(`backlog-pool-expanded-${id}`);
    return saved !== "false";
  });
  const [selectedTicket, setSelectedTicket] = useState<FlatTicket | null>(null);
  const [hideFinishedSprints, setHideFinishedSprints] = useState(true);
  const [showSprintCloseModal, setShowSprintCloseModal] = useState(false);
  const [closingSprintId, setClosingSprintId] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<string>("backlog");
  const [showSprintDeleteModal, setShowSprintDeleteModal] = useState(false);
  const [deletingSprintId, setDeletingSprintId] = useState<string | null>(null);
  const [deleteRedirectTarget, setDeleteRedirectTarget] = useState<string>("backlog");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("state");
  const [ticketSearch, setTicketSearch] = useState<string>("");
  const [showEpicColumn, setShowEpicColumn] = useState<boolean>(() => {
    const saved = localStorage.getItem('backlog-show-epic-column');
    return saved === 'true';
  });
  const [epicFilter, setEpicFilter] = useState<string[]>([]);
  const [versionFilter, setVersionFilter] = useState<string>("all");
  const [epicToDelete, setEpicToDelete] = useState<Epic | null>(null);
  const [epicSearchQuery, setEpicSearchQuery] = useState("");
  
  // Multi-select state for bulk actions
  const [checkedTickets, setCheckedTickets] = useState<Set<string>>(new Set());
  
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
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        const tempEpic = { id: `temp-${Date.now()}`, backlogId: id!, ...data, state: "backlog" } as Epic;
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          epics: [...previousBacklog.epics, tempEpic],
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => {
      toastSuccess({ title: "Epic créé" });
      setShowEpicDialog(false);
    },
  });

  const updateEpicMutation = useMutation({
    mutationFn: async ({ epicId, data }: { epicId: string; data: Partial<Epic> }) => {
      return apiRequest(`/api/epics/${epicId}`, "PATCH", data);
    },
    onMutate: async ({ epicId, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          epics: previousBacklog.epics.map(e => e.id === epicId ? { ...e, ...data } : e),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => {
      toastSuccess({ title: "Epic mis à jour" });
      setEditingEpic(null);
      setShowEpicDialog(false);
    },
  });

  const deleteEpicMutation = useMutation({
    mutationFn: async (epicId: string) => apiRequest(`/api/epics/${epicId}`, "DELETE"),
    onMutate: async (epicId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          epics: previousBacklog.epics.filter(e => e.id !== epicId),
          userStories: previousBacklog.userStories.map(us => us.epicId === epicId ? { ...us, epicId: null } : us),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => toastSuccess({ title: "Epic supprimé" }),
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
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        const tempStory = { id: `temp-${Date.now()}`, backlogId: id!, ...data, state: "backlog", tasks: [] } as UserStory & { tasks: BacklogTask[] };
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          userStories: [...previousBacklog.userStories, tempStory],
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => {
      toastSuccess({ title: "User Story créée" });
      setShowUserStoryDialog(false);
    },
  });

  const updateUserStoryMutation = useMutation({
    mutationFn: async ({ id: usId, data }: { id: string; data: Partial<UserStory> }) => {
      return apiRequest(`/api/user-stories/${usId}`, "PATCH", data);
    },
    onMutate: async ({ id: usId, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          userStories: previousBacklog.userStories.map(us => us.id === usId ? { ...us, ...data } : us),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => {
      toastSuccess({ title: "User Story mise à jour" });
      setEditingUserStory(null);
      setShowUserStoryDialog(false);
    },
  });

  const deleteUserStoryMutation = useMutation({
    mutationFn: async (usId: string) => apiRequest(`/api/user-stories/${usId}`, "DELETE"),
    onMutate: async (usId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          userStories: previousBacklog.userStories.filter(us => us.id !== usId),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => toastSuccess({ title: "User Story supprimée" }),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: { userStoryId: string; title: string; description?: string }) => {
      return apiRequest(`/api/user-stories/${data.userStoryId}/tasks`, "POST", { 
        title: data.title, 
        description: data.description 
      });
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        const tempTask = { id: `temp-${Date.now()}`, userStoryId: data.userStoryId, title: data.title, description: data.description, state: "a_faire" } as BacklogTask;
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          userStories: previousBacklog.userStories.map(us => 
            us.id === data.userStoryId ? { ...us, tasks: [...(us.tasks || []), tempTask] } : us
          ),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => {
      toastSuccess({ title: "Tâche créée" });
      setShowTaskDialog(false);
      setParentUserStoryId(null);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<BacklogTask> }) => {
      return apiRequest(`/api/backlog-tasks/${taskId}`, "PATCH", data);
    },
    onMutate: async ({ taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          userStories: previousBacklog.userStories.map(us => ({
            ...us,
            tasks: (us.tasks || []).map(t => t.id === taskId ? { ...t, ...data } : t),
          })),
          backlogTasks: previousBacklog.backlogTasks.map(t => t.id === taskId ? { ...t, ...data } : t),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => apiRequest(`/api/backlog-tasks/${taskId}`, "DELETE"),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          userStories: previousBacklog.userStories.map(us => ({
            ...us,
            tasks: (us.tasks || []).filter(t => t.id !== taskId),
          })),
          backlogTasks: previousBacklog.backlogTasks.filter(t => t.id !== taskId),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => toastSuccess({ title: "Tâche supprimée" }),
  });

  const createSprintMutation = useMutation({
    mutationFn: async (data: { name: string; goal?: string; startDate?: string; endDate?: string }) => {
      return apiRequest(`/api/backlogs/${id}/sprints`, "POST", data);
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        const tempSprint = { id: `temp-${Date.now()}`, backlogId: id!, ...data, status: "planned", position: (previousBacklog.sprints?.length || 0) } as Sprint;
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          sprints: [...(previousBacklog.sprints || []), tempSprint],
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => {
      toastSuccess({ title: "Sprint créé" });
      setShowSprintDialog(false);
    },
  });

  const updateSprintMutation = useMutation({
    mutationFn: async ({ sprintId, data }: { sprintId: string; data: Partial<Sprint> }) => {
      return apiRequest(`/api/sprints/${sprintId}`, "PATCH", data);
    },
    onMutate: async ({ sprintId, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          sprints: (previousBacklog.sprints || []).map(s => s.id === sprintId ? { ...s, ...data } : s),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => {
      toastSuccess({ title: "Sprint mis à jour" });
      setShowSprintDialog(false);
      setEditingSprint(null);
    },
  });

  const startSprintMutation = useMutation({
    mutationFn: async (sprintId: string) => apiRequest(`/api/sprints/${sprintId}/start`, "PATCH"),
    onMutate: async (sprintId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          sprints: (previousBacklog.sprints || []).map(s => s.id === sprintId ? { ...s, status: "en_cours" } : s),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => toastSuccess({ title: "Sprint démarré" }),
  });

  const moveSprintMutation = useMutation({
    mutationFn: async ({ sprintId, direction }: { sprintId: string; direction: 'up' | 'down' }) => 
      apiRequest(`/api/sprints/${sprintId}/move`, "PATCH", { direction }),
    onMutate: async ({ sprintId, direction }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog && previousBacklog.sprints) {
        const sprints = [...previousBacklog.sprints];
        const idx = sprints.findIndex(s => s.id === sprintId);
        if (idx !== -1) {
          const newIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (newIdx >= 0 && newIdx < sprints.length) {
            [sprints[idx], sprints[newIdx]] = [sprints[newIdx], sprints[idx]];
            queryClient.setQueryData<BacklogData>(["/api/backlogs", id], { ...previousBacklog, sprints });
          }
        }
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => toastSuccess({ title: "Sprint déplacé" }),
  });

  const closeSprintMutation = useMutation({
    mutationFn: async ({ sprintId, redirectTo }: { sprintId: string; redirectTo?: string }) => 
      apiRequest(`/api/sprints/${sprintId}/close`, "PATCH", { redirectTo }),
    onMutate: async ({ sprintId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          sprints: (previousBacklog.sprints || []).map(s => s.id === sprintId ? { ...s, status: "termine" } : s),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => toastSuccess({ title: "Sprint clôturé" }),
  });

  const deleteSprintMutation = useMutation({
    mutationFn: async ({ sprintId, redirectTo }: { sprintId: string; redirectTo?: string }) => 
      apiRequest(`/api/sprints/${sprintId}`, "DELETE", { redirectTo }),
    onMutate: async ({ sprintId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          sprints: (previousBacklog.sprints || []).filter(s => s.id !== sprintId),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: (_, { sprintId }) => {
      toastSuccess({ title: "Sprint supprimé" });
      setShowSprintDeleteModal(false);
      setDeletingSprintId(null);
    },
  });

  const updateBacklogMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; projectId?: string | null }) => {
      return apiRequest(`/api/backlogs/${id}`, "PATCH", data);
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], { ...previousBacklog, ...data });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs"] });
    },
    onSuccess: () => {
      toastSuccess({ title: "Backlog mis à jour" });
      setShowEditBacklogDialog(false);
    },
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
    onMutate: async ({ itemId, done }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          userStories: previousBacklog.userStories.map(us => ({
            ...us,
            tasks: (us.tasks || []).map(t => ({
              ...t,
              checklistItems: (t.checklistItems || []).map(ci => ci.id === itemId ? { ...ci, done } : ci),
            })),
          })),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
  });

  // Kanban column mutations
  const createColumnMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return apiRequest(`/api/backlogs/${id}/columns`, "POST", data);
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        const tempColumn = { id: `temp-${Date.now()}`, backlogId: id!, ...data, position: (previousBacklog.columns?.length || 0) } as BacklogColumn;
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          columns: [...(previousBacklog.columns || []), tempColumn],
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => {
      setShowColumnDialog(false);
      toastSuccess({ title: "Colonne créée" });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      return apiRequest(`/api/backlog-columns/${columnId}`, "DELETE");
    },
    onMutate: async (columnId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          columns: (previousBacklog.columns || []).filter(c => c.id !== columnId),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => toastSuccess({ title: "Colonne supprimée" }),
  });

  const createKanbanTaskMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; priority?: string; columnId: string }) => {
      return apiRequest(`/api/backlogs/${id}/tasks`, "POST", data);
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        const tempTask = { id: `temp-${Date.now()}`, backlogId: id!, ...data, state: "a_faire" } as BacklogTask;
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          backlogTasks: [...previousBacklog.backlogTasks, tempTask],
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
    onSuccess: () => {
      setShowKanbanTaskDialog(false);
      setSelectedColumnId(null);
      toastSuccess({ title: "Tâche créée" });
    },
  });

  const moveTaskToColumnMutation = useMutation({
    mutationFn: async ({ taskId, columnId }: { taskId: string; columnId: string }) => {
      return apiRequest(`/api/backlog-tasks/${taskId}`, "PATCH", { columnId });
    },
    onMutate: async ({ taskId, columnId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/backlogs", id] });
      const previousBacklog = queryClient.getQueryData<BacklogData>(["/api/backlogs", id]);
      if (previousBacklog) {
        queryClient.setQueryData<BacklogData>(["/api/backlogs", id], {
          ...previousBacklog,
          backlogTasks: previousBacklog.backlogTasks.map(t => t.id === taskId ? { ...t, columnId } : t),
          userStories: previousBacklog.userStories.map(us => us.id === taskId ? { ...us, columnId } : us),
        });
      }
      return { previousBacklog };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousBacklog) queryClient.setQueryData(["/api/backlogs", id], context.previousBacklog);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] }),
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

  // Collect unique versions from all tickets for filtering
  const uniqueVersions = useMemo(() => {
    const versions = new Set<string>();
    flatTickets.forEach(t => {
      if (t.version) versions.add(t.version);
    });
    return Array.from(versions).sort();
  }, [flatTickets]);

  // Priority order for sorting
  const priorityOrder: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const stateOrder: Record<string, number> = { a_faire: 1, en_cours: 2, testing: 3, to_fix: 4, review: 5, termine: 6 };

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
    
    // Apply version filter
    if (versionFilter !== "all") {
      if (versionFilter === "none") {
        result = result.filter(t => !t.version);
      } else {
        result = result.filter(t => t.version === versionFilter);
      }
    }
    
    // Apply sorting
    if (sortBy === "priority_desc") {
      result.sort((a, b) => (priorityOrder[b.priority || "medium"] || 2) - (priorityOrder[a.priority || "medium"] || 2));
    } else if (sortBy === "priority_asc") {
      result.sort((a, b) => (priorityOrder[a.priority || "medium"] || 2) - (priorityOrder[b.priority || "medium"] || 2));
    } else if (sortBy === "state") {
      result.sort((a, b) => (stateOrder[a.state || "a_faire"] || 1) - (stateOrder[b.state || "a_faire"] || 1));
    } else if (sortBy === "points_desc") {
      result.sort((a, b) => (b.estimatePoints || 0) - (a.estimatePoints || 0));
    } else if (sortBy === "points_asc") {
      result.sort((a, b) => (a.estimatePoints || 0) - (b.estimatePoints || 0));
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

  // Get all tickets (finished and unfinished) for a sprint
  const getAllTicketsForSprint = (sprintId: string) => {
    return flatTickets.filter(t => t.sprintId === sprintId);
  };

  // Handle sprint delete attempt - check for tickets
  const handleSprintDeleteAttempt = (sprintId: string) => {
    const ticketsInSprint = getAllTicketsForSprint(sprintId);
    if (ticketsInSprint.length === 0) {
      // No tickets, delete directly
      deleteSprintMutation.mutate({ sprintId });
    } else {
      // Show modal to redirect tickets
      setDeletingSprintId(sprintId);
      setDeleteRedirectTarget("backlog");
      setShowSprintDeleteModal(true);
    }
  };

  // Handle sprint delete with ticket redirection
  const handleConfirmSprintDelete = async () => {
    if (!deletingSprintId) return;
    
    try {
      await deleteSprintMutation.mutateAsync({ 
        sprintId: deletingSprintId, 
        redirectTo: deleteRedirectTarget 
      });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const toggleSprint = (sprintId: string) => {
    setExpandedSprints(prev => {
      let next: Set<string>;
      if (prev === "all") {
        const allSprintIds = new Set(backlog?.sprints.map(s => s.id) || []);
        allSprintIds.delete(sprintId);
        next = allSprintIds;
      } else {
        next = new Set(prev);
        if (next.has(sprintId)) next.delete(sprintId);
        else next.add(sprintId);
      }
      // Save to localStorage
      if (id && id !== "new") {
        localStorage.setItem(`backlog-expanded-sprints-${id}`, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  // Save backlog pool expanded state to localStorage
  const toggleBacklogPool = () => {
    const newValue = !backlogPoolExpanded;
    setBacklogPoolExpanded(newValue);
    if (id && id !== "new") {
      localStorage.setItem(`backlog-pool-expanded-${id}`, String(newValue));
    }
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
  
  // Create task from ticket handler
  const handleCreateTaskFromTicket = async (ticket: FlatTicket, projectId: string, taskTitle: string) => {
    try {
      await apiRequest("/api/tasks", "POST", {
        title: taskTitle,
        description: ticket.description || "",
        projectId: projectId,
        status: "pending",
        priority: ticket.priority || "medium",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toastSuccess({ 
        title: "Tâche créée", 
        description: "La tâche a été créée avec succès dans le gestionnaire de tâches." 
      });
    } catch (error: any) {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de créer la tâche.", 
        variant: "destructive" 
      });
    }
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
  
  // Handle checkbox change for multi-select
  const handleCheckChange = (ticketId: string, ticketType: TicketType, checked: boolean) => {
    setCheckedTickets(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(ticketId);
      } else {
        newSet.delete(ticketId);
      }
      return newSet;
    });
  };
  
  // Clear all selections
  const handleClearSelection = () => {
    setCheckedTickets(new Set());
  };
  
  // Handle bulk actions
  const handleBulkAction = async (action: BulkAction) => {
    try {
      const { ticketIds, type } = action;
      
      // Process each ticket
      for (const { id: ticketId, type: ticketType } of ticketIds) {
        switch (type) {
          case "bulk_change_state":
            if (action.state) {
              await handleUpdateTicket(ticketId, ticketType, { state: action.state });
            }
            break;
            
          case "bulk_change_priority":
            if (action.priority) {
              await handleUpdateTicket(ticketId, ticketType, { priority: action.priority });
            }
            break;
            
          case "bulk_assign":
            await handleUpdateTicket(ticketId, ticketType, { assigneeId: action.assigneeId || null });
            break;
            
          case "bulk_set_estimate":
            await handleUpdateTicket(ticketId, ticketType, { estimatePoints: action.estimatePoints ?? null });
            break;
            
          case "bulk_link_epic":
            if (ticketType === "user_story" || ticketType === "task") {
              await handleUpdateTicket(ticketId, ticketType, { epicId: action.epicId || null });
            }
            break;
            
          case "bulk_move_sprint":
            await handleUpdateTicket(ticketId, ticketType, { sprintId: action.sprintId || null });
            break;
            
          case "bulk_move_backlog":
            await handleUpdateTicket(ticketId, ticketType, { sprintId: null });
            break;
            
          case "bulk_set_version":
            await handleUpdateTicket(ticketId, ticketType, { version: action.version || null });
            break;
            
          case "bulk_delete":
            await handleDeleteTicket(ticketId, ticketType);
            break;
        }
      }
      
      // Show success message based on action type
      const actionMessages: Record<string, string> = {
        bulk_change_state: "Étape modifiée",
        bulk_change_priority: "Priorité modifiée",
        bulk_assign: "Assignation modifiée",
        bulk_set_estimate: "Points modifiés",
        bulk_link_epic: "Epic lié",
        bulk_move_sprint: "Déplacé vers le sprint",
        bulk_move_backlog: "Déplacé vers le backlog",
        bulk_set_version: "Version modifiée",
        bulk_delete: "Tickets supprimés"
      };
      
      toastSuccess({ 
        title: actionMessages[type] || "Action effectuée",
        description: `${ticketIds.length} ticket${ticketIds.length > 1 ? "s" : ""} modifié${ticketIds.length > 1 ? "s" : ""}`
      });
      
      // Clear selection after bulk action
      handleClearSelection();
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
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
      const baseData: Record<string, any> = {
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
      } else if (toType === "bug") {
        createEndpoint = `/api/backlogs/${id}/tasks`;
        baseData.taskType = "bug";
      } else {
        // task
        createEndpoint = `/api/backlogs/${id}/tasks`;
        baseData.taskType = "task";
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
      
      const typeLabels: Record<string, string> = {
        epic: "Epic",
        user_story: "User Story",
        task: "Task",
        bug: "Bug"
      };
      
      toastSuccess({ 
        title: "Type converti", 
        description: `Converti en ${typeLabels[toType] || toType}`
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
        <Loader size="lg" />
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
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-background">
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
            <TabsTrigger value="recette" className="text-sm" data-testid="tab-recette">
              Recette
            </TabsTrigger>
            <TabsTrigger value="retrospective" className="text-sm" data-testid="tab-retrospective">
              Rétrospective
            </TabsTrigger>
            <TabsTrigger value="statistiques" className="text-sm" data-testid="tab-statistiques">
              Statistiques
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="backlog" className="flex-1 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
        {/* Fixed Header/Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 md:px-6 md:py-4 border-b bg-background sticky top-0 z-10">
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
                className="pl-8 h-8 w-[150px] text-sm bg-white dark:bg-card"
                data-testid="input-ticket-search"
              />
            </div>
            <Button size="sm" className="bg-white dark:bg-card border border-input hover:bg-gray-50 dark:hover:bg-muted text-foreground" onClick={() => setShowUserStoryDialog(true)} data-testid="button-add-user-story">
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
            
            {/* Version filter */}
            {uniqueVersions.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Version</Label>
                <Select value={versionFilter} onValueChange={setVersionFilter}>
                  <SelectTrigger className="w-[120px] h-8 text-sm" data-testid="select-version-filter">
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="none">Sans version</SelectItem>
                    {uniqueVersions.map(version => (
                      <SelectItem key={version} value={version}>{version}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
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
                  <SelectItem value="points_desc">Points décroissants</SelectItem>
                  <SelectItem value="points_asc">Points croissants</SelectItem>
                  <SelectItem value="title">Titre (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:px-6 md:py-4">
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
                {(() => {
                  const sortedSprints = backlog.sprints
                    .filter(s => !hideFinishedSprints || s.status !== "termine")
                    .sort((a, b) => {
                      // Sort by position first
                      const posA = a.position ?? 0;
                      const posB = b.position ?? 0;
                      if (posA !== posB) return posA - posB;
                      // Then by status
                      if (a.status === "en_cours" && b.status !== "en_cours") return -1;
                      if (b.status === "en_cours" && a.status !== "en_cours") return 1;
                      if (a.status === "preparation" && b.status === "termine") return -1;
                      if (b.status === "preparation" && a.status === "termine") return 1;
                      return 0;
                    });
                  
                  return sortedSprints.map((sprint, index) => (
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
                      onDeleteSprint={handleSprintDeleteAttempt}
                      onUpdateState={handleInlineStateUpdate}
                      onUpdateField={handleInlineFieldUpdate}
                      onTicketAction={handleTicketAction}
                      selectedTicketId={selectedTicket?.id}
                      onMoveSprintUp={(sprintId) => moveSprintMutation.mutate({ sprintId, direction: 'up' })}
                      onMoveSprintDown={(sprintId) => moveSprintMutation.mutate({ sprintId, direction: 'down' })}
                      isFirstSprint={index === 0}
                      isLastSprint={index === sortedSprints.length - 1}
                      checkedTickets={checkedTickets}
                      onCheckChange={handleCheckChange}
                      onBulkAction={handleBulkAction}
                      onClearSelection={handleClearSelection}
                    />
                  ));
                })()}

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
                  onToggle={toggleBacklogPool}
                  onSelectTicket={handleSelectTicket}
                  onCreateTicket={handleCreateBacklogTicket}
                  onUpdateState={handleInlineStateUpdate}
                  onUpdateField={handleInlineFieldUpdate}
                  onTicketAction={handleTicketAction}
                  selectedTicketId={selectedTicket?.id}
                  checkedTickets={checkedTickets}
                  onCheckChange={handleCheckChange}
                  onBulkAction={handleBulkAction}
                  onClearSelection={handleClearSelection}
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
                      projects={projects}
                      backlogProjectId={backlog.projectId}
                      backlogName={backlog.name}
                      ticketIndex={flatTickets.findIndex(t => t.id === selectedTicket.id)}
                      onClose={() => setSelectedTicket(null)}
                      onUpdate={handleUpdateTicket}
                      onDelete={handleDeleteTicket}
                      onConvertType={handleConvertType}
                      onCreateTask={handleCreateTaskFromTicket}
                      onOpenRecipe={(ticketId, sprintId) => {
                        setActiveTab("recette");
                        setSelectedTicket(null);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </DndContext>
        )}
        </div>
        {/* End Scrollable Content Area */}
        </TabsContent>

        {/* Epics tab */}
        <TabsContent value="epics" className="overflow-auto p-4 md:p-6 mt-0 data-[state=inactive]:hidden">
          <div className="space-y-4">
            {/* Header with Search and Create button */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une Epic..."
                  value={epicSearchQuery}
                  onChange={(e) => setEpicSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-epic"
                />
                {epicSearchQuery && backlog.epics.filter(e => 
                  e.title.toLowerCase().includes(epicSearchQuery.toLowerCase()) ||
                  (e.description && e.description.toLowerCase().includes(epicSearchQuery.toLowerCase()))
                ).length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                    {backlog.epics.filter(e => 
                      e.title.toLowerCase().includes(epicSearchQuery.toLowerCase()) ||
                      (e.description && e.description.toLowerCase().includes(epicSearchQuery.toLowerCase()))
                    ).map(epic => (
                      <div
                        key={epic.id}
                        className="px-3 py-2 hover:bg-muted cursor-pointer flex items-center gap-2"
                        onClick={() => {
                          updateEpicMutation.reset();
                          setEditingEpic(epic);
                          setShowEpicDialog(true);
                          setEpicSearchQuery("");
                        }}
                        data-testid={`epic-search-result-${epic.id}`}
                      >
                        <div 
                          className="h-4 w-4 rounded flex items-center justify-center"
                          style={{ backgroundColor: epic.color || "#8B5CF6" }}
                        >
                          <Layers className="h-2.5 w-2.5 text-white" />
                        </div>
                        <span className="text-sm">{epic.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={() => { createEpicMutation.reset(); setEditingEpic(null); setShowEpicDialog(true); }} data-testid="button-create-epic">
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
                        updateEpicMutation.reset();
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
        <TabsContent value="done" className="overflow-auto p-4 md:p-6 mt-0 data-[state=inactive]:hidden">
          <div className="relative h-full">
            <CompletedTicketsView 
              tickets={flatTickets.filter(t => t.state === "termine")}
              users={users}
              sprints={backlog.sprints}
              epics={backlog.epics}
              backlogName={backlog.name}
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
                    projects={projects}
                    backlogProjectId={backlog.projectId}
                    backlogName={backlog.name}
                    ticketIndex={flatTickets.findIndex(t => t.id === selectedTicket.id)}
                    onClose={() => setSelectedTicket(null)}
                    onUpdate={handleUpdateTicket}
                    onDelete={handleDeleteTicket}
                    onConvertType={handleConvertType}
                    readOnly={true}
                    onOpenRecipe={(ticketId, sprintId) => {
                      setActiveTab("recette");
                      setSelectedTicket(null);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Recette tab */}
        <TabsContent value="recette" className="overflow-auto p-4 md:p-6 mt-0 data-[state=inactive]:hidden">
          <RecetteView backlogId={id!} sprints={backlog.sprints} />
        </TabsContent>

        {/* Rétrospective tab */}
        <TabsContent value="retrospective" className="overflow-auto p-4 md:p-6 mt-0 data-[state=inactive]:hidden">
          <RetrospectiveView backlogId={id!} sprints={backlog.sprints} />
        </TabsContent>

        {/* Statistiques tab */}
        <TabsContent value="statistiques" className="overflow-auto p-4 md:p-6 mt-0 data-[state=inactive]:hidden">
          <BacklogStats 
            userStories={backlog.userStories}
            epics={backlog.epics}
            sprints={backlog.sprints}
            onNavigateToBacklog={() => setActiveTab("backlog")}
            onCloseSprint={handleSprintCloseAttempt}
          />
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
            {/* Time saved calculation */}
            {closingSprintId && (() => {
              const sprint = backlog.sprints.find(s => s.id === closingSprintId);
              if (sprint?.endDate) {
                const endDate = new Date(sprint.endDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);
                const diffTime = endDate.getTime() - today.getTime();
                const daysSaved = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (daysSaved > 0) {
                  return (
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-green-600 dark:text-green-500" />
                        <span className="font-medium text-green-700 dark:text-green-400">
                          Temps gagné : {daysSaved} jour{daysSaved > 1 ? 's' : ''} d'avance
                        </span>
                      </div>
                      <p className="text-sm text-green-600 dark:text-green-500 mt-1 ml-7">
                        Ce sprint se termine avant la date prévue du {format(new Date(sprint.endDate), "d MMMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  );
                }
              }
              return null;
            })()}
            
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
                        {ticket.type === "epic" ? "Epic" : ticket.type === "user_story" ? "Story" : ticket.type === "bug" ? "Bug" : "Task"}
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

      {/* Sprint Delete Modal */}
      <Dialog open={showSprintDeleteModal} onOpenChange={setShowSprintDeleteModal}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Supprimer le sprint
            </DialogTitle>
            <DialogDescription>
              {deletingSprintId && getAllTicketsForSprint(deletingSprintId).length > 0 && (
                <>
                  Ce sprint contient {getAllTicketsForSprint(deletingSprintId).length} ticket(s). 
                  Choisissez où les déplacer avant de supprimer le sprint.
                </>
              )}
              {deletingSprintId && getAllTicketsForSprint(deletingSprintId).length === 0 && (
                <>
                  Êtes-vous sûr de vouloir supprimer ce sprint ? Cette action est irréversible.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 flex-1 overflow-y-auto min-h-0">
            {deletingSprintId && getAllTicketsForSprint(deletingSprintId).length > 0 && (
              <>
                <div className="space-y-2 flex-shrink-0">
                  <Label>Déplacer les tickets vers :</Label>
                  <Select value={deleteRedirectTarget} onValueChange={setDeleteRedirectTarget}>
                    <SelectTrigger data-testid="select-delete-redirect-target">
                      <SelectValue placeholder="Choisir la destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backlog">Backlog</SelectItem>
                      {backlog.sprints
                        .filter(s => s.id !== deletingSprintId && s.status !== "termine")
                        .map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground mb-2">Tickets à déplacer :</p>
                  <ul className="space-y-1 max-h-[180px] overflow-y-auto">
                    {getAllTicketsForSprint(deletingSprintId).map(ticket => (
                      <li key={ticket.id} className="text-sm flex items-center gap-2">
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {ticket.type === "epic" ? "Epic" : ticket.type === "user_story" ? "Story" : ticket.type === "bug" ? "Bug" : "Task"}
                        </Badge>
                        <span className="truncate flex-1">{ticket.title}</span>
                        {ticket.state === "termine" && (
                          <Badge variant="outline" className="text-xs border-green-300 bg-green-50 text-green-700 flex-shrink-0">
                            Terminé
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSprintDeleteModal(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleConfirmSprintDelete}
              variant="destructive"
              data-testid="button-confirm-delete-sprint"
            >
              Supprimer le sprint
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

  // Colors: violet, bleu, vert, jaune, orange, rouge/bordeaux, turquoise, rose clair, marron, bleu marine
  const colors = ["#C4B5FD", "#93C5FD", "#86EFAC", "#FDE047", "#FDBA74", "#991B1B", "#5EEAD4", "#FBCFE8", "#A16207", "#1E3A5F"];

  useEffect(() => {
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
  }, [epic]);

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
                onChange={(e) => setEstimatePoints(e.target.value ? parseFloat(e.target.value) : null)} 
                min={0}
                step={0.25}
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
      <SheetContent className="sm:max-w-md bg-white dark:bg-white">
        <SheetHeader className="border-b border-gray-200 pb-4">
          <SheetTitle className="text-gray-900">{sprint ? "Modifier le Sprint" : "Nouveau Sprint"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-6">
          <div className="space-y-2">
            <Label className="text-gray-700">Nom *</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Sprint 1" 
              className="bg-white border-gray-300 text-gray-900"
              data-testid="input-sprint-name" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Objectif</Label>
            <Textarea 
              value={goal} 
              onChange={(e) => setGoal(e.target.value)} 
              rows={3} 
              placeholder="Objectif du sprint..." 
              className="bg-white border-gray-300 text-gray-900"
              data-testid="input-sprint-goal" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-violet-500" />
                Date de début
              </Label>
              <Input 
                type="datetime-local" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="bg-white border-gray-300 text-gray-900"
                data-testid="input-sprint-start" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-violet-500" />
                Date de fin
              </Label>
              <Input 
                type="datetime-local" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="bg-white border-gray-300 text-gray-900"
                data-testid="input-sprint-end" 
              />
            </div>
          </div>
        </div>
        <SheetFooter className="flex gap-2 border-t border-gray-200 pt-4">
          <Button variant="outline" onClick={onClose} className="border-gray-300 text-gray-700" data-testid="button-cancel-sprint">
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || !name.trim()} 
            className="bg-violet-600 hover:bg-violet-700 text-white"
            data-testid="button-submit-sprint"
          >
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
  epics,
  backlogName,
  onSelectTicket,
  selectedTicketId
}: {
  tickets: FlatTicket[];
  users: AppUser[];
  sprints: Sprint[];
  epics: Epic[];
  backlogName: string;
  onSelectTicket: (ticket: FlatTicket) => void;
  selectedTicketId?: string;
}) {
  // Generate ticket ID for search purposes
  const generateTicketDisplayId = (ticket: FlatTicket, index: number) => {
    const backlogPrefix = backlogName.substring(0, 3).toUpperCase();
    const currentSprint = sprints.find(s => s.id === ticket.sprintId);
    const sprintPrefix = currentSprint 
      ? currentSprint.name.substring(0, 3).toUpperCase() 
      : "BCK";
    const indexStr = String(index + 1).padStart(2, "0");
    return `${backlogPrefix}-${sprintPrefix}-${indexStr}`;
  };
  const [sortColumn, setSortColumn] = useState<string>("title");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSprint, setFilterSprint] = useState<string>("all");
  const [filterEpic, setFilterEpic] = useState<string>("all");
  const [filterVersion, setFilterVersion] = useState<string>("all");

  // Collect all unique versions from tickets
  const uniqueVersions = useMemo(() => {
    const versions = new Set<string>();
    tickets.forEach(t => {
      if (t.version) versions.add(t.version);
    });
    return Array.from(versions).sort();
  }, [tickets]);

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

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const priorityOrder: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

  const filteredAndSortedTickets = useMemo(() => {
    // First filter by search query and filters
    let result = tickets;
    
    // Search filter - includes title, description and ticket ID
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((t, index) => {
        const ticketId = generateTicketDisplayId(t, index);
        return t.title.toLowerCase().includes(query) ||
          (t.description && t.description.toLowerCase().includes(query)) ||
          ticketId.toLowerCase().includes(query);
      });
    }
    
    // Sprint filter
    if (filterSprint !== "all") {
      if (filterSprint === "none") {
        result = result.filter(t => !t.sprintId);
      } else {
        result = result.filter(t => t.sprintId === filterSprint);
      }
    }
    
    // Epic filter
    if (filterEpic !== "all") {
      if (filterEpic === "none") {
        result = result.filter(t => !t.epicId);
      } else {
        result = result.filter(t => t.epicId === filterEpic);
      }
    }
    
    // Version filter
    if (filterVersion !== "all") {
      if (filterVersion === "none") {
        result = result.filter(t => !t.version);
      } else {
        result = result.filter(t => t.version === filterVersion);
      }
    }
    
    // Then sort
    return [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "type":
          comparison = (a.type || "").localeCompare(b.type || "");
          break;
        case "title":
          comparison = (a.title || "").localeCompare(b.title || "");
          break;
        case "priority":
          comparison = (priorityOrder[a.priority || "medium"] || 2) - (priorityOrder[b.priority || "medium"] || 2);
          break;
        case "sprint":
          comparison = (getSprintName(a.sprintId) || "").localeCompare(getSprintName(b.sprintId) || "");
          break;
        case "assignee":
          comparison = (getAssigneeName(a.assigneeId) || "").localeCompare(getAssigneeName(b.assigneeId) || "");
          break;
        case "points":
          comparison = (a.estimatePoints || 0) - (b.estimatePoints || 0);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [tickets, sortColumn, sortDirection, searchQuery, filterSprint, filterEpic, filterVersion, backlogName, sprints]);

  const SortableHeader = ({ column, children, className }: { column: string; children: React.ReactNode; className?: string }) => (
    <th 
      className={cn("px-4 py-2 cursor-pointer select-none hover:bg-muted/80 transition-colors", className)}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column ? (
          sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </th>
  );

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

  const hasActiveFilters = filterSprint !== "all" || filterEpic !== "all" || filterVersion !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un ticket..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8"
            data-testid="input-completed-search"
          />
        </div>
        
        <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        
        <Select value={filterSprint} onValueChange={setFilterSprint}>
          <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-completed-filter-sprint">
            <SelectValue placeholder="Sprint" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les sprints</SelectItem>
            <SelectItem value="none">Sans sprint</SelectItem>
            {sprints.map(sprint => (
              <SelectItem key={sprint.id} value={sprint.id}>{sprint.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={filterEpic} onValueChange={setFilterEpic}>
          <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-completed-filter-epic">
            <SelectValue placeholder="Epic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les epics</SelectItem>
            <SelectItem value="none">Sans epic</SelectItem>
            {epics.map(epic => (
              <SelectItem key={epic.id} value={epic.id}>{epic.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {uniqueVersions.length > 0 && (
          <Select value={filterVersion} onValueChange={setFilterVersion}>
            <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-completed-filter-version">
              <SelectValue placeholder="Version" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="none">Sans version</SelectItem>
              {uniqueVersions.map(version => (
                <SelectItem key={version} value={version}>{version}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setFilterSprint("all");
              setFilterEpic("all");
              setFilterVersion("all");
            }}
            data-testid="button-clear-completed-filters"
          >
            <X className="h-3 w-3 mr-1" />
            Effacer
          </Button>
        )}
        
        <div className="ml-auto">
          <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
            {filteredAndSortedTickets.length} / {tickets.length} terminé{tickets.length > 1 ? 's' : ''}
          </Badge>
        </div>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs font-medium text-muted-foreground">
              <SortableHeader column="type">Type</SortableHeader>
              <SortableHeader column="title">Titre</SortableHeader>
              <SortableHeader column="priority" className="hidden sm:table-cell">Priorité</SortableHeader>
              <SortableHeader column="sprint" className="hidden md:table-cell">Sprint</SortableHeader>
              <SortableHeader column="assignee" className="hidden md:table-cell">Assigné à</SortableHeader>
              <SortableHeader column="points" className="hidden lg:table-cell">Points</SortableHeader>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredAndSortedTickets.map(ticket => (
              <tr
                key={ticket.id}
                className={cn(
                  "cursor-pointer bg-white dark:bg-white hover:bg-gray-50 dark:hover:bg-gray-50",
                  selectedTicketId === ticket.id && "bg-violet-50 dark:bg-violet-50"
                )}
                onClick={() => onSelectTicket(ticket)}
                data-testid={`row-completed-ticket-${ticket.id}`}
              >
                <td className="px-4 py-2">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      ticket.type === 'epic' && "border-violet-300 bg-violet-50 text-violet-700",
                      ticket.type === 'user_story' && "border-green-300 bg-green-50 text-green-700",
                      ticket.type === 'task' && "border-blue-300 bg-blue-50 text-blue-700",
                      ticket.type === 'bug' && "border-red-300 bg-red-50 text-red-700"
                    )}
                  >
                    {ticket.type === 'epic' ? 'Epic' : ticket.type === 'user_story' ? 'Story' : ticket.type === 'bug' ? 'Bug' : 'Task'}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  <span className="text-sm font-medium text-gray-900">{ticket.title}</span>
                </td>
                <td className="px-4 py-2 hidden sm:table-cell">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      ticket.priority === 'critical' && "border-red-300 bg-red-50 text-red-700",
                      ticket.priority === 'high' && "border-orange-300 bg-orange-50 text-orange-700",
                      ticket.priority === 'medium' && "border-amber-300 bg-amber-50 text-amber-700",
                      ticket.priority === 'low' && "border-gray-300 bg-gray-50 text-gray-600"
                    )}
                  >
                    {ticket.priority === 'critical' ? 'Critique' : 
                     ticket.priority === 'high' ? 'Haute' : 
                     ticket.priority === 'medium' ? 'Moyenne' : 'Basse'}
                  </Badge>
                </td>
                <td className="px-4 py-2 hidden md:table-cell">
                  <span className="text-xs text-gray-600">
                    {getSprintName(ticket.sprintId) || '-'}
                  </span>
                </td>
                <td className="px-4 py-2 hidden md:table-cell">
                  <span className="text-xs text-gray-600">
                    {getAssigneeName(ticket.assigneeId) || '-'}
                  </span>
                </td>
                <td className="px-4 py-2 hidden lg:table-cell">
                  <span className="text-xs text-gray-600">
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

// Backlog Statistics Component
function BacklogStats({ 
  userStories, 
  epics, 
  sprints,
  onNavigateToBacklog,
  onCloseSprint
}: { 
  userStories: (UserStory & { tasks: BacklogTask[] })[];
  epics: Epic[];
  sprints: Sprint[];
  onNavigateToBacklog?: () => void;
  onCloseSprint?: (sprintId: string) => void;
}) {
  const [burnMode, setBurnMode] = useState<'points' | 'tickets'>('points');
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  
  // Filter data based on selected sprint
  const filteredUserStories = useMemo(() => {
    if (!selectedSprintId) return userStories;
    return userStories.filter(us => us.sprintId === selectedSprintId);
  }, [userStories, selectedSprintId]);
  
  // Calculate all tickets (user stories + tasks)
  const allTickets = useMemo(() => {
    const stories = filteredUserStories.map(us => ({ ...us, type: 'user_story' as const }));
    const tasks = filteredUserStories.flatMap(us => (us.tasks || []).map(t => ({ ...t, type: 'task' as const })));
    return [...stories, ...tasks];
  }, [filteredUserStories]);
  
  // Total counts
  const totalTickets = allTickets.length;
  const ticketsInProgress = allTickets.filter(t => t.state === 'en_cours').length;
  const ticketsDone = allTickets.filter(t => t.state === 'termine').length;
  const ticketsTodo = allTickets.filter(t => t.state === 'a_faire' || t.state === 'backlog').length;
  const ticketsTesting = allTickets.filter(t => t.state === 'testing').length;
  const ticketsToFix = allTickets.filter(t => t.state === 'to_fix').length;
  const ticketsReview = allTickets.filter(t => t.state === 'review').length;
  
  // Points calculations  
  const totalPoints = filteredUserStories.reduce((sum, us) => sum + (us.estimatePoints || 0), 0);
  const pointsDone = filteredUserStories.filter(us => us.state === 'termine').reduce((sum, us) => sum + (us.estimatePoints || 0), 0);
  
  // Active sprints points
  const activeSprints = sprints.filter(s => s.status === 'en_cours');
  const pointsInActiveSprints = userStories
    .filter(us => activeSprints.some(s => s.id === us.sprintId))
    .reduce((sum, us) => sum + (us.estimatePoints || 0), 0);
  
  // Sprints ready to be closed (all tickets done)
  const sprintsReadyToClose = useMemo(() => {
    return activeSprints.filter(sprint => {
      const sprintUserStories = userStories.filter(us => us.sprintId === sprint.id);
      if (sprintUserStories.length === 0) return false; // Empty sprints not ready
      
      // Check all user stories are done
      const allStoriesDone = sprintUserStories.every(us => us.state === 'termine');
      
      // Check all tasks are done
      const allTasksDone = sprintUserStories.every(us => {
        const tasks = us.tasks || [];
        return tasks.length === 0 || tasks.every(t => t.state === 'termine');
      });
      
      return allStoriesDone && allTasksDone;
    });
  }, [activeSprints, userStories]);
  
  // Quality metrics (always use full userStories for global metrics, filteredUserStories for sprint-specific)
  const estimatedTickets = filteredUserStories.filter(us => us.estimatePoints && us.estimatePoints > 0).length;
  const estimationPercent = filteredUserStories.length > 0 ? Math.round((estimatedTickets / filteredUserStories.length) * 100) : 0;
  
  const linkedToEpic = filteredUserStories.filter(us => us.epicId).length;
  const epicLinkPercent = filteredUserStories.length > 0 ? Math.round((linkedToEpic / filteredUserStories.length) * 100) : 0;
  
  const orphanTickets = filteredUserStories.filter(us => !us.epicId && !us.sprintId).length;
  
  // Velocity calculation per completed sprint
  const completedSprints = sprints
    .filter(s => s.status === 'termine')
    .sort((a, b) => new Date(b.completedAt || b.endDate || 0).getTime() - new Date(a.completedAt || a.endDate || 0).getTime());
  
  const velocityData = completedSprints.slice(0, 6).reverse().map(sprint => {
    const sprintPoints = userStories
      .filter(us => us.sprintId === sprint.id && us.state === 'termine')
      .reduce((sum, us) => sum + (us.estimatePoints || 0), 0);
    return {
      name: sprint.name.length > 10 ? sprint.name.substring(0, 10) + '...' : sprint.name,
      points: sprintPoints
    };
  });
  
  // Average velocity
  const avgVelocity = velocityData.length > 0 
    ? Math.round(velocityData.reduce((sum, v) => sum + v.points, 0) / velocityData.length * 10) / 10
    : 0;
  
  // Last 3 sprints average
  const last3Velocity = velocityData.slice(-3);
  const avg3Velocity = last3Velocity.length > 0 
    ? Math.round(last3Velocity.reduce((sum, v) => sum + v.points, 0) / last3Velocity.length * 10) / 10
    : 0;
  
  // Velocity trend
  const lastSprintVelocity = velocityData.length > 0 ? velocityData[velocityData.length - 1]?.points || 0 : 0;
  const velocityTrend = avg3Velocity > 0 
    ? lastSprintVelocity > avg3Velocity * 1.1 ? 'up' 
    : lastSprintVelocity < avg3Velocity * 0.9 ? 'down' 
    : 'stable'
    : 'stable';
  
  // Sprints needed to complete backlog
  const remainingPoints = totalPoints - pointsDone;
  const sprintsNeeded = avg3Velocity > 0 ? Math.ceil(remainingPoints / avg3Velocity) : null;
  
  // Burn rate data (cumulative remaining)
  const burnData = useMemo(() => {
    const sortedSprints = [...completedSprints].reverse();
    let runningTotal = burnMode === 'points' ? totalPoints : totalTickets;
    
    return sortedSprints.map(sprint => {
      const delivered = burnMode === 'points'
        ? userStories.filter(us => us.sprintId === sprint.id && us.state === 'termine').reduce((sum, us) => sum + (us.estimatePoints || 0), 0)
        : allTickets.filter(t => t.sprintId === sprint.id && t.state === 'termine').length;
      runningTotal -= delivered;
      return {
        name: sprint.name.length > 8 ? sprint.name.substring(0, 8) + '...' : sprint.name,
        remaining: Math.max(0, runningTotal)
      };
    });
  }, [completedSprints, burnMode, totalPoints, totalTickets, userStories, allTickets]);
  
  // Sprint performance data
  const sprintPerformance = sprints
    .filter(s => s.status !== 'preparation')
    .map(sprint => {
      const engaged = userStories.filter(us => us.sprintId === sprint.id).reduce((sum, us) => sum + (us.estimatePoints || 0), 0);
      const delivered = userStories.filter(us => us.sprintId === sprint.id && us.state === 'termine').reduce((sum, us) => sum + (us.estimatePoints || 0), 0);
      const completionRate = engaged > 0 ? Math.round((delivered / engaged) * 100) : 0;
      const deviation = engaged - delivered;
      
      let badge: 'green' | 'orange' | 'red' = 'green';
      let badgeLabel = 'Sprint maîtrisé';
      if (completionRate < 70) {
        badge = 'red';
        badgeLabel = 'Sprint à risque';
      } else if (completionRate < 90) {
        badge = 'orange';
        badgeLabel = 'Sprint sous tension';
      }
      
      return {
        sprint,
        engaged,
        delivered,
        completionRate,
        deviation,
        badge,
        badgeLabel
      };
    });
  
  // 1️⃣ Vue d'ensemble - Micro-lecture intelligente
  const getOverviewReading = () => {
    const inProgressRatio = totalTickets > 0 ? ticketsInProgress / totalTickets : 0;
    const doneRatio = totalTickets > 0 ? ticketsDone / totalTickets : 0;
    const todoRatio = totalTickets > 0 ? ticketsTodo / totalTickets : 0;
    
    if (doneRatio > 0.3 && inProgressRatio < 0.3 && todoRatio < 0.5) {
      return "Le backlog est bien réparti entre tickets à faire, en cours et terminés.";
    }
    if (inProgressRatio > 0.4) {
      return "Beaucoup de tickets sont en cours. Attention à la dispersion et au WIP.";
    }
    if (todoRatio > 0.7) {
      return "Le backlog contient encore beaucoup de tickets non engagés.";
    }
    if (doneRatio < 0.1 && totalTickets > 5) {
      return "Peu de tickets ont été livrés récemment. Le flux semble ralenti.";
    }
    return "Le backlog est bien équilibré.";
  };
  
  // 2️⃣ Vélocité - Interprétation
  const getVelocityReading = () => {
    if (velocityData.length < 2) return null;
    
    // Check velocity irregularity (coefficient of variation)
    const velocities = velocityData.map(v => v.points);
    const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const variance = velocities.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / velocities.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;
    
    if (cv > 0.5) {
      return "La vélocité est instable, ce qui rend les projections moins fiables.";
    }
    if (velocityTrend === 'down') {
      return "La vélocité diminue. Le périmètre ou la charge réelle mérite d'être revu.";
    }
    if (velocityTrend === 'stable') {
      return "La vélocité est stable sur les derniers sprints.";
    }
    return "La vélocité est en hausse.";
  };
  
  // 3️⃣ Burn Rate - Lecture de consommation
  const getBurnRateReading = () => {
    if (burnData.length < 2) return null;
    
    const firstRemaining = burnData[0]?.remaining || 0;
    const lastRemaining = burnData[burnData.length - 1]?.remaining || 0;
    const totalConsumed = firstRemaining - lastRemaining;
    const avgPerSprint = burnData.length > 1 ? totalConsumed / (burnData.length - 1) : 0;
    
    if (avgPerSprint <= 0) {
      return "Peu de points sont consommés. Le backlog semble bloqué.";
    }
    const sprintsRemaining = avgPerSprint > 0 ? Math.ceil(lastRemaining / avgPerSprint) : null;
    
    if (sprintsRemaining && sprintsRemaining <= 3) {
      return "Le backlog se consomme rapidement. Vérifie la soutenabilité du rythme.";
    }
    return "La consommation du backlog est régulière.";
  };
  
  // 6️⃣ Lecture automatique structurée (Constat / Risque / Action)
  const readings: { constat: string; risque?: string; action?: string } = {
    constat: "La structure actuelle permet un pilotage fiable à court terme."
  };
  
  // Determine main constat
  if (estimationPercent >= 70 && orphanTickets <= 3 && velocityTrend !== 'down') {
    readings.constat = "Le backlog est bien structuré à court terme.";
  } else if (estimationPercent < 50) {
    readings.constat = `${100 - estimationPercent}% des tickets ne sont pas encore estimés.`;
    readings.risque = "La visibilité au-delà de 2 sprints reste limitée.";
    readings.action = "Une estimation des tickets prioritaires améliorerait les projections.";
  } else if (orphanTickets > 5) {
    readings.constat = `${orphanTickets} tickets orphelins sans Epic ni Sprint.`;
    readings.risque = "La structuration du backlog est incomplète.";
    readings.action = "Rattacher ces tickets à une Epic ou un Sprint pour un meilleur pilotage.";
  }
  
  // Add velocity risk if applicable
  if (velocityTrend === 'down' && !readings.risque) {
    readings.risque = "Attention toutefois à la baisse de vélocité sur les derniers sprints.";
    if (!readings.action) {
      readings.action = "Une priorisation plus fine des tickets en cours pourrait stabiliser le rythme.";
    }
  }
  
  // Add sprints needed info
  if (sprintsNeeded && sprintsNeeded > 10 && !readings.risque) {
    readings.risque = `Au rythme actuel, il faudra encore ${sprintsNeeded} sprints pour terminer le backlog.`;
  }

  const selectedSprint = sprints.find(s => s.id === selectedSprintId);

  return (
    <div className="space-y-6" data-testid="backlog-stats">
      {/* Sprint Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Statistiques</h2>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Filtrer par sprint :</Label>
          <Select 
            value={selectedSprintId || "all"} 
            onValueChange={(val) => setSelectedSprintId(val === "all" ? null : val)}
          >
            <SelectTrigger className="w-[200px]" data-testid="select-stats-sprint">
              <SelectValue placeholder="Tous les sprints" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les sprints</SelectItem>
              {sprints.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedSprintId && (
        <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg p-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-violet-600" />
          <span className="text-sm">
            Statistiques filtrées pour le sprint : <strong>{selectedSprint?.name}</strong>
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="ml-auto h-7 text-xs"
            onClick={() => setSelectedSprintId(null)}
            data-testid="button-clear-sprint-filter"
          >
            Voir tous les sprints
          </Button>
        </div>
      )}

      {/* Bloc 1 - Vue d'ensemble */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-600" />
            Vue d'ensemble {selectedSprintId ? "du sprint" : "du backlog"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {selectedSprintId 
              ? "Indicateurs spécifiques au sprint sélectionné."
              : "Ces indicateurs donnent une vision instantanée de la charge réelle et de l'état du backlog."
            }
          </p>
          {/* Micro-lecture intelligente */}
          <p className="text-xs mt-2 text-foreground/80 bg-muted/40 px-2 py-1.5 rounded" data-testid="text-overview-reading">
            {getOverviewReading()}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted/30 rounded-lg" data-testid="stat-total-tickets">
              <p className="text-2xl font-bold text-violet-600">{totalTickets}</p>
              <p className="text-xs text-muted-foreground">Tickets totaux</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg" data-testid="stat-in-progress">
              <p className="text-2xl font-bold text-blue-600">{ticketsInProgress}</p>
              <p className="text-xs text-muted-foreground">En cours</p>
              {ticketsTesting > 0 && <p className="text-xs text-blue-500">+ {ticketsTesting} en test</p>}
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg" data-testid="stat-done">
              <p className="text-2xl font-bold text-green-600">{ticketsDone}</p>
              <p className="text-xs text-muted-foreground">Terminés</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/30 rounded-lg" data-testid="stat-todo">
              <p className="text-2xl font-bold text-gray-600">{ticketsTodo}</p>
              <p className="text-xs text-muted-foreground">À faire</p>
              {ticketsToFix > 0 && <p className="text-xs text-red-500">+ {ticketsToFix} à fix</p>}
              {ticketsReview > 0 && <p className="text-xs text-purple-500">+ {ticketsReview} en review</p>}
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3" data-testid="stat-total-points">
              <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Flag className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-lg font-semibold">{totalPoints}</p>
                <p className="text-xs text-muted-foreground">Points totaux</p>
              </div>
            </div>
            <div className="flex items-center gap-3" data-testid="stat-engaged-points">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Play className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-semibold">{pointsInActiveSprints}</p>
                <p className="text-xs text-muted-foreground">Points engagés</p>
              </div>
            </div>
            <div className="flex items-center gap-3" data-testid="stat-delivered-points">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-semibold">{pointsDone}</p>
                <p className="text-xs text-muted-foreground">Points livrés</p>
              </div>
            </div>
          </div>
          
          {/* Lecture automatique intégrée */}
          <div className="mt-4 pt-4 border-t bg-violet-50 dark:bg-violet-950/20 -mx-4 px-4 pb-0 -mb-4 rounded-b-lg">
            <div className="flex items-start gap-3 pb-4">
              <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center flex-shrink-0">
                <Trophy className="h-4 w-4 text-violet-600" />
              </div>
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium text-violet-900 dark:text-violet-100">Lecture automatique</p>
                
                {/* Constat */}
                <p className="text-sm text-violet-800 dark:text-violet-200" data-testid="text-reading-constat">
                  {readings.constat}
                </p>
                
                {/* Risque (si présent) */}
                {readings.risque && (
                  <p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-1" data-testid="text-reading-risque">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{readings.risque}</span>
                  </p>
                )}
                
                {/* Alerte trop de sprints actifs */}
                {activeSprints.length > 3 && (
                  <p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-1" data-testid="text-warning-many-sprints">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>Attention, beaucoup de sprints sont lancés en même temps. Assurez-vous d'avoir les ressources pour être sur tous ces sujets.</span>
                  </p>
                )}
                
                {/* Suggestion de clôture de sprint */}
                {sprintsReadyToClose.length > 0 && (
                  <div className="text-sm text-green-700 dark:text-green-300 flex flex-col gap-2" data-testid="text-sprint-closure-suggestion">
                    <div className="flex items-start gap-1">
                      <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>
                        Penser à clôturer {sprintsReadyToClose.length === 1 ? "le sprint suivant" : "les sprints suivants"} :
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-5">
                      {sprintsReadyToClose.map(sprint => (
                        <Button
                          key={sprint.id}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50"
                          onClick={() => onCloseSprint?.(sprint.id)}
                          data-testid={`button-close-sprint-${sprint.id}`}
                        >
                          <Lock className="h-3 w-3 mr-1" />
                          {sprint.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Action suggérée (si présente) */}
                {readings.action && (
                  <p className="text-xs text-violet-600 dark:text-violet-400 bg-white/50 dark:bg-white/10 px-2 py-1.5 rounded" data-testid="text-reading-action">
                    {readings.action}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Bloc 2 - Rythme & capacité */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Vélocité */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-violet-600" />
              Vélocité
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-white text-gray-900 border shadow-lg p-3" side="right">
                  <p className="text-xs font-light leading-relaxed">
                    La vélocité correspond à la quantité de travail réellement livrée par l'équipe sur un sprint, mesurée en points d'estimation.
                  </p>
                  <p className="text-xs font-light leading-relaxed mt-2">
                    Elle représente la capacité réelle de l'équipe à livrer du travail estimé sur un sprint.
                  </p>
                  <p className="text-xs font-light leading-relaxed mt-2 text-gray-500">
                    Une baisse prolongée indique souvent un périmètre trop large, des estimations imprécises ou une charge invisible.
                  </p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {velocityData.length > 0 ? (
              <>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={velocityData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <RechartsTooltip 
                        contentStyle={{ fontSize: 12, background: 'white', border: '1px solid #e5e7eb' }}
                        formatter={(value) => [`${value} pts`, 'Points']}
                      />
                      <Bar dataKey="points" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="text-muted-foreground">Moyenne (3 derniers sprints) :</span>
                    <span className="font-semibold ml-1">{avg3Velocity} pts</span>
                  </div>
                  <Badge 
                    variant="outline"
                    className={cn(
                      "flex items-center gap-1",
                      velocityTrend === 'up' && "text-green-600 border-green-200 bg-green-50",
                      velocityTrend === 'down' && "text-red-600 border-red-200 bg-red-50",
                      velocityTrend === 'stable' && "text-blue-600 border-blue-200 bg-blue-50"
                    )}
                    data-testid="badge-velocity-trend"
                  >
                    {velocityTrend === 'up' && <><TrendingUp className="h-3 w-3" /> Accélération</>}
                    {velocityTrend === 'down' && <><TrendingDown className="h-3 w-3" /> Ralentissement</>}
                    {velocityTrend === 'stable' && <><Minus className="h-3 w-3" /> Stable</>}
                  </Badge>
                </div>
                {/* Interprétation vélocité */}
                {getVelocityReading() && (
                  <p className="mt-2 text-xs text-foreground/80 bg-muted/30 p-2 rounded" data-testid="text-velocity-reading">
                    {getVelocityReading()}
                  </p>
                )}
                {/* Projection */}
                {sprintsNeeded && (
                  <p className="mt-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-100 dark:border-blue-900" data-testid="text-sprints-needed">
                    À ce rythme, il faudra environ <strong>{sprintsNeeded} sprints</strong> pour absorber le backlog actuel.
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Aucun sprint terminé</p>
                <p className="text-xs mt-1">Les données de vélocité apparaîtront après la clôture du premier sprint.</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Burn Down */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-violet-600" />
                Burn Down
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="ml-1 text-muted-foreground hover:text-foreground">
                      <AlertCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs bg-white text-gray-900 border shadow-lg p-3 text-left">
                    <p className="text-xs font-light leading-relaxed">
                      Le burn down mesure à quelle vitesse le travail restant diminue pendant un sprint ou une période donnée, en comparant le travail livré (points ou tickets) au temps écoulé. Il permet de vérifier si l'équipe avance au rythme attendu pour atteindre les objectifs du sprint.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <div className="flex gap-1">
                <Button 
                  variant={burnMode === 'points' ? 'default' : 'ghost'} 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => setBurnMode('points')}
                  data-testid="button-burn-mode-points"
                >
                  Points
                </Button>
                <Button 
                  variant={burnMode === 'tickets' ? 'default' : 'ghost'} 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => setBurnMode('tickets')}
                  data-testid="button-burn-mode-tickets"
                >
                  Tickets
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {burnData.length > 0 ? (
              <>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={burnData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10 }}
                        label={{ 
                          value: 'Éléments du backlog / progression', 
                          position: 'insideBottom', 
                          offset: -5,
                          fontSize: 9,
                          fill: '#6b7280'
                        }}
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        label={{ 
                          value: 'Points restants', 
                          angle: -90, 
                          position: 'insideLeft',
                          fontSize: 9,
                          fill: '#6b7280',
                          style: { textAnchor: 'middle' }
                        }}
                      />
                      <RechartsTooltip 
                        contentStyle={{ fontSize: 12, background: 'white', border: '1px solid #e5e7eb' }}
                        formatter={(value) => [`${value}`, burnMode === 'points' ? 'Points restants' : 'Tickets restants']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="remaining" 
                        stroke="#8B5CF6" 
                        fill="#C4B5FD" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {/* Lecture burn down */}
                {getBurnRateReading() && (
                  <p className="mt-3 text-xs text-foreground/80 bg-muted/30 p-2 rounded" data-testid="text-burndown-reading">
                    {getBurnRateReading()}
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Aucune donnée</p>
                <p className="text-xs mt-1">Le graphique apparaîtra après la clôture de sprints.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Bloc 3 - Qualité & structure */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Folder className="h-4 w-4 text-violet-600" />
            Qualité & structure du backlog
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Un backlog pilotable est un backlog estimé, structuré et relié au périmètre.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2" data-testid="stat-estimation-percent">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Estimés</span>
                <span className="text-sm font-semibold">{estimationPercent}%</span>
              </div>
              <Progress value={estimationPercent} className="h-2" />
              {estimationPercent < 70 && (
                <p className="text-xs text-amber-600">{userStories.length - estimatedTickets} non estimés</p>
              )}
            </div>
            <div className="space-y-2" data-testid="stat-epic-link-percent">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Rattachés Epic</span>
                <span className="text-sm font-semibold">{epicLinkPercent}%</span>
              </div>
              <Progress value={epicLinkPercent} className="h-2" />
            </div>
            <div className="p-3 bg-muted/30 rounded-lg text-center" data-testid="stat-epics-count">
              <p className="text-xl font-bold text-violet-600">{epics.length}</p>
              <p className="text-xs text-muted-foreground">Epics</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center" data-testid="stat-orphan-tickets">
              <p className="text-xl font-bold text-amber-600">{orphanTickets}</p>
              <p className="text-xs text-muted-foreground">Tickets orphelins</p>
              {orphanTickets === 0 && (
                <p className="text-xs text-green-600 mt-1">Structure saine</p>
              )}
            </div>
          </div>
          
          {/* CTA contextuels avec messages actionnables */}
          <div className="mt-4 pt-4 border-t space-y-3">
            {/* Tickets non estimés */}
            {estimationPercent < 70 && (
              <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
                <div>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Une part importante du backlog n'est pas estimée. La projection est fragile.
                  </p>
                </div>
                <button 
                  className="text-xs text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 whitespace-nowrap ml-3"
                  data-testid="link-estimate-tickets"
                  onClick={onNavigateToBacklog}
                >
                  Estimer les tickets
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
            
            {/* Tickets orphelins */}
            {orphanTickets > 0 && (
              <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg">
                <div>
                  <p className="text-sm text-foreground/80">
                    {orphanTickets === 1 
                      ? "1 ticket n'est rattaché à aucune Epic."
                      : `${orphanTickets} tickets ne sont rattachés à aucune Epic.`
                    }
                  </p>
                </div>
                <button 
                  className="text-xs text-violet-600 hover:underline flex items-center gap-1 whitespace-nowrap ml-3"
                  data-testid="link-view-orphans"
                  onClick={onNavigateToBacklog}
                >
                  Voir dans le backlog
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
            
            {/* Message positif si tout va bien */}
            {estimationPercent >= 70 && orphanTickets === 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  Backlog bien structuré : tous les tickets sont estimés et rattachés.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Bloc 4 - Lecture par sprint */}
      {sprintPerformance.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-violet-600" />
              Performance par sprint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sprintPerformance.slice(0, 5).map(({ sprint, engaged, delivered, completionRate, deviation, badge, badgeLabel }) => (
                <div 
                  key={sprint.id} 
                  className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg group cursor-pointer hover-elevate"
                  data-testid={`sprint-perf-${sprint.id}`}
                  title={`Engagé : ${engaged} pts — Livré : ${delivered} pts`}
                >
                  <div 
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center",
                      badge === 'green' && "bg-green-100",
                      badge === 'orange' && "bg-amber-100",
                      badge === 'red' && "bg-red-100"
                    )}
                  >
                    {badge === 'green' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {badge === 'orange' && <AlertCircle className="h-4 w-4 text-amber-600" />}
                    {badge === 'red' && <AlertCircle className="h-4 w-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{sprint.name}</span>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          badge === 'green' && "border-green-200 text-green-700 bg-green-50",
                          badge === 'orange' && "border-amber-200 text-amber-700 bg-amber-50",
                          badge === 'red' && "border-red-200 text-red-700 bg-red-50"
                        )}
                      >
                        {badgeLabel}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span>Engagé: {engaged} pts</span>
                      <span>Livré: {delivered} pts</span>
                      <span className={deviation > 0 ? "text-red-500" : "text-green-500"}>
                        Écart: {deviation > 0 ? '+' : ''}{deviation} pts
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className={cn(
                        "text-lg font-bold",
                        completionRate >= 90 && "text-green-600",
                        completionRate >= 70 && completionRate < 90 && "text-amber-600",
                        completionRate < 70 && "text-red-600"
                      )}>
                        {completionRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">complétion</p>
                    </div>
                    {/* Lien discret vers le sprint */}
                    <button 
                      className="text-xs text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity hover:underline flex items-center gap-1"
                      data-testid={`link-open-sprint-${sprint.id}`}
                    >
                      Ouvrir
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
    </div>
  );
}

// Recipe ticket type for API response
type RecipeTicket = {
  id: string;
  type: "user_story" | "task";
  title: string;
  description: string | null;
  state: string;
  priority: string | null;
  recipe: TicketRecipe | null;
};

type SprintWithRecipes = Sprint & {
  tickets: RecipeTicket[];
  stats: {
    total: number;
    tested: number;
    fixed: number;
  };
};

// Recipe filter type
type RecipeFilter = "all" | "todo" | "done";

// RecetteView Component - Cahier de recette (QA Testing)
function RecetteView({ backlogId, sprints }: { backlogId: string; sprints: Sprint[] }) {
  const { toast } = useToast();
  
  // Filter state with localStorage persistence (default: "todo")
  const [recipeFilter, setRecipeFilter] = useState<RecipeFilter>(() => {
    const saved = localStorage.getItem(`recette_filter_${backlogId}`);
    return (saved as RecipeFilter) || "todo";
  });
  
  // Selected sprints with localStorage persistence
  const [selectedSprintIds, setSelectedSprintIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(`recette_sprints_${backlogId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [expandedRecipeSprints, setExpandedRecipeSprints] = useState<Set<string>>(new Set());
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const [selectedRecipeTickets, setSelectedRecipeTickets] = useState<Set<string>>(new Set());
  const [editingRecipe, setEditingRecipe] = useState<{ 
    ticketId: string; 
    sprintId: string; 
    ticketType: "user_story" | "task";
    ticketTitle?: string;
    ticketDescription?: string | null;
    ticketState?: string;
    sprintName?: string;
    sprintStatus?: string;
  } | null>(null);
  const [recipeFormData, setRecipeFormData] = useState<{
    status: RecipeStatus;
    observedResults: string;
    conclusion: RecipeConclusion | null;
    suggestions: string;
    remarks: string;
    isFixedDone: boolean;
    pushToTicket: boolean;
  }>({
    status: "a_tester",
    observedResults: "",
    conclusion: null,
    suggestions: "",
    remarks: "",
    isFixedDone: false,
    pushToTicket: false,
  });
  
  // Persist filter changes
  useEffect(() => {
    localStorage.setItem(`recette_filter_${backlogId}`, recipeFilter);
  }, [recipeFilter, backlogId]);

  // Persist selected sprints
  useEffect(() => {
    localStorage.setItem(`recette_sprints_${backlogId}`, JSON.stringify(selectedSprintIds));
  }, [selectedSprintIds, backlogId]);

  // Get finished sprints for selection
  const finishedSprints = sprints.filter(s => s.status === "termine");

  // Fetch recipes for selected sprints
  const { data: recipesData, isLoading: recipesLoading, refetch: refetchRecipes } = useQuery<{ sprints: SprintWithRecipes[] }>({
    queryKey: ["/api/backlogs", backlogId, "recipes", selectedSprintIds.join(",")],
    queryFn: async () => {
      if (selectedSprintIds.length === 0) return { sprints: [] };
      const res = await apiRequest(`/api/backlogs/${backlogId}/recipes?sprintIds=${selectedSprintIds.join(",")}`, "GET");
      return res.json();
    },
    enabled: selectedSprintIds.length > 0,
  });

  // Get current query key for recipes (function to ensure freshness)
  const getRecipesQueryKey = () => ["/api/backlogs", backlogId, "recipes", selectedSprintIds.join(",")];

  // Upsert recipe mutation with optimistic updates
  const upsertRecipeMutation = useMutation({
    mutationFn: async (data: {
      sprintId: string;
      ticketId: string;
      ticketType: "user_story" | "task";
      status?: RecipeStatus;
      observedResults?: string | null;
      conclusion?: RecipeConclusion | null;
      suggestions?: string | null;
      isFixedDone?: boolean;
      pushToTicket?: boolean;
    }) => {
      const res = await apiRequest(`/api/backlogs/${backlogId}/recipes/upsert`, "POST", data);
      return res.json();
    },
    onMutate: async (newData) => {
      const queryKey = getRecipesQueryKey();
      
      // Cancel outgoing refetches for all recipe queries for this backlog
      await queryClient.cancelQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/backlogs" && key[1] === backlogId && key[2] === "recipes";
        }
      });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData<{ sprints: SprintWithRecipes[] }>(queryKey);
      
      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<{ sprints: SprintWithRecipes[] }>(queryKey, {
          sprints: previousData.sprints.map(sprint => ({
            ...sprint,
            tickets: sprint.tickets.map(ticket => {
              if (ticket.id === newData.ticketId && sprint.id === newData.sprintId) {
                return {
                  ...ticket,
                  recipe: {
                    ...ticket.recipe,
                    status: newData.status ?? ticket.recipe?.status ?? "a_tester",
                    observedResults: newData.observedResults ?? ticket.recipe?.observedResults ?? null,
                    conclusion: newData.conclusion ?? ticket.recipe?.conclusion ?? null,
                    suggestions: newData.suggestions ?? ticket.recipe?.suggestions ?? null,
                    isFixedDone: newData.isFixedDone ?? ticket.recipe?.isFixedDone ?? false,
                  },
                };
              }
              return ticket;
            }),
          })),
        });
      }
      
      return { previousData, queryKey };
    },
    onError: (error: any, _newData, context) => {
      // Rollback on error
      if (context?.previousData && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSuccess: () => {
      setEditingRecipe(null);
      toastSuccess({ title: "Recette mise à jour" });
    },
    onSettled: () => {
      // Refetch all recipe queries for this backlog to ensure sync with server
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/backlogs" && key[1] === backlogId && key[2] === "recipes";
        }
      });
    },
  });
  
  // Bulk upsert mutation for multiple tickets
  const bulkUpsertRecipeMutation = useMutation({
    mutationFn: async (updates: Array<{
      sprintId: string;
      ticketId: string;
      ticketType: "user_story" | "task";
      status?: RecipeStatus;
      conclusion?: RecipeConclusion | null;
      isFixedDone?: boolean;
    }>) => {
      // Execute all updates in parallel
      const results = await Promise.all(
        updates.map(data => 
          apiRequest(`/api/backlogs/${backlogId}/recipes/upsert`, "POST", data).then(r => r.json())
        )
      );
      return results;
    },
    onMutate: async (updates) => {
      const queryKey = getRecipesQueryKey();
      
      // Cancel all recipe queries for this backlog
      await queryClient.cancelQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/backlogs" && key[1] === backlogId && key[2] === "recipes";
        }
      });
      
      const previousData = queryClient.getQueryData<{ sprints: SprintWithRecipes[] }>(queryKey);
      
      if (previousData) {
        queryClient.setQueryData<{ sprints: SprintWithRecipes[] }>(queryKey, {
          sprints: previousData.sprints.map(sprint => ({
            ...sprint,
            tickets: sprint.tickets.map(ticket => {
              const update = updates.find(u => u.ticketId === ticket.id && u.sprintId === sprint.id);
              if (update) {
                return {
                  ...ticket,
                  recipe: {
                    ...ticket.recipe,
                    status: update.status ?? ticket.recipe?.status ?? "a_tester",
                    conclusion: update.conclusion ?? ticket.recipe?.conclusion ?? null,
                    isFixedDone: update.isFixedDone ?? ticket.recipe?.isFixedDone ?? false,
                  },
                };
              }
              return ticket;
            }),
          })),
        });
      }
      
      return { previousData, queryKey };
    },
    onError: (error: any, _updates, context) => {
      if (context?.previousData && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSuccess: () => {
      setSelectedRecipeTickets(new Set());
      toastSuccess({ title: "Recettes mises à jour" });
    },
    onSettled: () => {
      // Refetch all recipe queries for this backlog
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/backlogs" && key[1] === backlogId && key[2] === "recipes";
        }
      });
    },
  });

  // Toggle sprint selection
  const toggleSprintSelection = (sprintId: string) => {
    setSelectedSprintIds(prev => 
      prev.includes(sprintId) 
        ? prev.filter(id => id !== sprintId)
        : [...prev, sprintId]
    );
  };

  // Select all finished sprints
  const selectAllSprints = () => {
    setSelectedSprintIds(finishedSprints.map(s => s.id));
  };

  // Clear all selections
  const clearAllSprints = () => {
    setSelectedSprintIds([]);
  };

  // Toggle recipe sprint expansion
  const toggleRecipeSprintExpand = (sprintId: string) => {
    setExpandedRecipeSprints(prev => {
      const next = new Set(prev);
      if (next.has(sprintId)) {
        next.delete(sprintId);
      } else {
        next.add(sprintId);
      }
      return next;
    });
  };

  // Expand all recipe sprints when data loads
  useEffect(() => {
    if (recipesData?.sprints) {
      setExpandedRecipeSprints(new Set(recipesData.sprints.map(s => s.id)));
    }
  }, [recipesData]);

  // Open recipe editor
  const openRecipeEditor = (ticket: RecipeTicket, sprint: SprintWithRecipes) => {
    setEditingRecipe({ 
      ticketId: ticket.id, 
      sprintId: sprint.id, 
      ticketType: ticket.type,
      ticketTitle: ticket.title,
      ticketDescription: ticket.description,
      ticketState: ticket.state,
      sprintName: sprint.name,
      sprintStatus: sprint.status || undefined,
    });
    setRecipeFormData({
      status: (ticket.recipe?.status as RecipeStatus) || "a_tester",
      observedResults: ticket.recipe?.observedResults || "",
      conclusion: (ticket.recipe?.conclusion as RecipeConclusion) || null,
      suggestions: ticket.recipe?.suggestions || "",
      remarks: ticket.recipe?.remarks || "",
      isFixedDone: ticket.recipe?.isFixedDone || false,
      pushToTicket: false,
    });
  };
  
  // Filter and sort tickets based on recipeFilter and search query
  const filterTickets = (tickets: RecipeTicket[]): RecipeTicket[] => {
    let filtered = tickets;
    // Apply status filter
    if (recipeFilter === "done") {
      filtered = tickets.filter(t => t.recipe?.conclusion === "termine");
    } else if (recipeFilter === "todo") {
      filtered = tickets.filter(t => t.recipe?.conclusion !== "termine");
    }
    // Apply search filter
    if (recipeSearchQuery.trim()) {
      const query = recipeSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }
    // Sort: non-terminated tickets first, then terminated at bottom
    return [...filtered].sort((a, b) => {
      const aTermine = a.recipe?.conclusion === "termine" ? 1 : 0;
      const bTermine = b.recipe?.conclusion === "termine" ? 1 : 0;
      return aTermine - bTermine;
    });
  };
  
  // Get all visible tickets across all sprints (for bulk actions)
  const getAllVisibleTickets = (): Array<{ ticket: RecipeTicket; sprintId: string }> => {
    if (!recipesData?.sprints) return [];
    return recipesData.sprints.flatMap(sprint => 
      filterTickets(sprint.tickets).map(ticket => ({ ticket, sprintId: sprint.id }))
    );
  };
  
  // Get visible tickets for a specific sprint
  const getSprintVisibleTickets = (sprintId: string): RecipeTicket[] => {
    const sprint = recipesData?.sprints.find(s => s.id === sprintId);
    if (!sprint) return [];
    return filterTickets(sprint.tickets);
  };
  
  // Toggle ticket selection
  const toggleTicketSelection = (ticketId: string) => {
    setSelectedRecipeTickets(prev => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };
  
  // Select all visible tickets in a specific sprint
  const selectSprintTickets = (sprintId: string) => {
    const sprintTickets = getSprintVisibleTickets(sprintId);
    setSelectedRecipeTickets(prev => {
      const next = new Set(prev);
      sprintTickets.forEach(t => next.add(t.id));
      return next;
    });
  };
  
  // Deselect all tickets in a specific sprint
  const deselectSprintTickets = (sprintId: string) => {
    const sprintTickets = getSprintVisibleTickets(sprintId);
    const sprintTicketIds = new Set(sprintTickets.map(t => t.id));
    setSelectedRecipeTickets(prev => {
      const next = new Set(prev);
      sprintTicketIds.forEach(id => next.delete(id));
      return next;
    });
  };
  
  // Clear all ticket selection
  const clearTicketSelection = () => {
    setSelectedRecipeTickets(new Set());
  };
  
  // Check if all visible tickets in a sprint are selected
  const allSprintTicketsSelected = (sprintId: string): boolean => {
    const sprintTickets = getSprintVisibleTickets(sprintId);
    return sprintTickets.length > 0 && sprintTickets.every(t => selectedRecipeTickets.has(t.id));
  };
  
  // Check if some tickets in a sprint are selected (for indeterminate state)
  const someSprintTicketsSelected = (sprintId: string): boolean => {
    const sprintTickets = getSprintVisibleTickets(sprintId);
    const selectedCount = sprintTickets.filter(t => selectedRecipeTickets.has(t.id)).length;
    return selectedCount > 0 && selectedCount < sprintTickets.length;
  };
  
  // Apply bulk action
  const applyBulkAction = (action: "status" | "conclusion" | "fixed", value?: RecipeStatus | RecipeConclusion) => {
    const allTickets = getAllVisibleTickets();
    const selectedTickets = allTickets.filter(t => selectedRecipeTickets.has(t.ticket.id));
    
    if (selectedTickets.length === 0) return;
    
    const updates = selectedTickets.map(({ ticket, sprintId }) => {
      const base = {
        sprintId,
        ticketId: ticket.id,
        ticketType: ticket.type,
      };
      
      if (action === "fixed") {
        // When marking as fixed, also set status to "teste" and conclusion to "termine"
        return { ...base, isFixedDone: true, status: "teste" as RecipeStatus, conclusion: "termine" as RecipeConclusion };
      } else if (action === "status") {
        return { ...base, status: value as RecipeStatus };
      } else if (action === "conclusion") {
        return { ...base, conclusion: value as RecipeConclusion };
      }
      return base;
    });
    
    bulkUpsertRecipeMutation.mutate(updates);
  };

  // Get status badge (filled style like ticket type badges)
  const getStatusBadge = (status: RecipeStatus | undefined) => {
    const option = recipeStatusOptions.find(o => o.value === status) || recipeStatusOptions[0];
    // Define filled backgrounds based on status
    const statusStyles: Record<string, string> = {
      a_tester: "bg-gray-100 border-gray-300 text-gray-700",
      en_test: "bg-orange-100 border-orange-300 text-orange-700",
      teste: "bg-green-100 border-green-300 text-green-700",
    };
    return (
      <Badge 
        variant="outline" 
        className={cn("text-xs", statusStyles[status || "a_tester"])}
      >
        {option.label}
      </Badge>
    );
  };

  // Get conclusion badge (filled style like ticket type badges)
  const getConclusionBadge = (conclusion: RecipeConclusion | null | undefined) => {
    if (!conclusion) return null;
    const option = recipeConclusionOptions.find(o => o.value === conclusion);
    if (!option) return null;
    
    const Icon = conclusion === "termine" ? Check : conclusion === "a_fix" ? Bug : conclusion === "a_ameliorer" ? Wrench : Sparkles;
    
    // Define filled backgrounds based on conclusion
    const conclusionStyles: Record<string, string> = {
      termine: "bg-green-100 border-green-300 text-green-700",
      a_ameliorer: "bg-yellow-100 border-yellow-300 text-yellow-700",
      a_fix: "bg-red-100 border-red-300 text-red-700",
      a_ajouter: "bg-blue-100 border-blue-300 text-blue-700",
    };
    
    return (
      <Badge 
        variant="outline" 
        className={cn("text-xs flex items-center gap-1", conclusionStyles[conclusion])}
      >
        <Icon className="h-3 w-3" />
        {option.label}
      </Badge>
    );
  };

  // No finished sprints
  if (finishedSprints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <FlaskConical className="h-12 w-12 mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">Cahier de recette</h3>
        <p className="text-sm">Terminez des sprints pour commencer les tests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="recette-view">
      {/* Sprint Selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Sélection des sprints à tester
            </CardTitle>
            <div className="flex items-center gap-3">
              {/* Recipe Filter integrated in header */}
              {selectedSprintIds.length > 0 && (
                <div className="flex bg-white dark:bg-white rounded-md border border-gray-200 p-1 gap-1">
                  <Button
                    variant={recipeFilter === "todo" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setRecipeFilter("todo")}
                    className={cn(
                      "h-7 px-3 text-xs",
                      recipeFilter !== "todo" && "text-gray-600 hover:text-gray-900"
                    )}
                    data-testid="filter-recipe-todo"
                  >
                    À faire
                  </Button>
                  <Button
                    variant={recipeFilter === "done" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setRecipeFilter("done")}
                    className={cn(
                      "h-7 px-3 text-xs",
                      recipeFilter !== "done" && "text-gray-600 hover:text-gray-900"
                    )}
                    data-testid="filter-recipe-done"
                  >
                    Terminé
                  </Button>
                  <Button
                    variant={recipeFilter === "all" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setRecipeFilter("all")}
                    className={cn(
                      "h-7 px-3 text-xs",
                      recipeFilter !== "all" && "text-gray-600 hover:text-gray-900"
                    )}
                    data-testid="filter-recipe-all"
                  >
                    Toutes
                  </Button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={selectAllSprints} data-testid="button-select-all-sprints">
                Tout sélectionner
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAllSprints} data-testid="button-clear-all-sprints">
                Effacer
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-h-[88px]">
          <div className="flex flex-wrap gap-2 items-start content-start">
            {finishedSprints.map(sprint => (
              <Button
                key={sprint.id}
                variant={selectedSprintIds.includes(sprint.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleSprintSelection(sprint.id)}
                className="toggle-elevate"
                data-testid={`button-toggle-sprint-${sprint.id}`}
              >
                {selectedSprintIds.includes(sprint.id) && <Check className="h-3 w-3 mr-1" />}
                {sprint.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search bar and bulk actions */}
      {selectedSprintIds.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-[150px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={recipeSearchQuery}
              onChange={(e) => setRecipeSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
              data-testid="input-recipe-search"
            />
          </div>
          
          {/* Bulk actions bar */}
          {selectedRecipeTickets.size > 0 && (
            <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-800">
              <Badge variant="secondary" className="bg-violet-100 text-violet-700">
                {selectedRecipeTickets.size} sélectionné{selectedRecipeTickets.size > 1 ? "s" : ""}
              </Badge>
              
              {/* Bulk status */}
              <Select onValueChange={(val) => applyBulkAction("status", val as RecipeStatus)}>
                <SelectTrigger className="w-[120px] h-7 text-xs" data-testid="select-bulk-status">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  {recipeStatusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Bulk conclusion */}
              <Select onValueChange={(val) => applyBulkAction("conclusion", val as RecipeConclusion)}>
                <SelectTrigger className="w-[130px] h-7 text-xs" data-testid="select-bulk-conclusion">
                  <SelectValue placeholder="Conclusion" />
                </SelectTrigger>
                <SelectContent>
                  {recipeConclusionOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Mark all as fixed */}
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-xs gap-1"
                onClick={() => applyBulkAction("fixed")}
                disabled={bulkUpsertRecipeMutation.isPending}
                data-testid="button-bulk-fixed"
              >
                <CheckCircle className="h-3 w-3" />
                Tout fixé/terminé
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs"
                onClick={clearTicketSelection}
                data-testid="button-clear-selection"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* No sprints selected */}
      {selectedSprintIds.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <ListTodo className="h-10 w-10 mb-4 opacity-50" />
          <p className="text-sm">Sélectionnez des sprints pour afficher les tickets à tester.</p>
        </div>
      )}

      {/* Loading state */}
      {recipesLoading && selectedSprintIds.length > 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader size="md" />
        </div>
      )}

      {/* Sprint Tables */}
      {recipesData?.sprints.map(sprint => {
        const filteredTickets = filterTickets(sprint.tickets);
        const isExpanded = expandedRecipeSprints.has(sprint.id);
        return (
        <Card key={sprint.id} className="overflow-hidden">
          <CardHeader 
            className="bg-muted/30 py-3 cursor-pointer hover-elevate"
            onClick={() => toggleRecipeSprintExpand(sprint.id)}
            data-testid={`header-recipe-sprint-${sprint.id}`}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {sprint.name}
              </CardTitle>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  {sprint.stats.tested}/{sprint.stats.total} testés
                </span>
                <span className="text-muted-foreground">
                  {sprint.stats.fixed} fixés
                </span>
                <Progress 
                  value={(sprint.stats.tested / Math.max(sprint.stats.total, 1)) * 100} 
                  className="w-24 h-2"
                />
              </div>
            </div>
          </CardHeader>
          {isExpanded && (
          <CardContent className="p-0">
            {filteredTickets.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                {recipeFilter === "done" ? "Aucun ticket terminé" : recipeFilter === "todo" ? "Tous les tickets sont terminés" : "Aucun ticket dans ce sprint"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/20">
                    <tr>
                      <th className="text-center p-3 w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={someSprintTicketsSelected(sprint.id) ? "indeterminate" : allSprintTicketsSelected(sprint.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectSprintTickets(sprint.id);
                            } else {
                              deselectSprintTickets(sprint.id);
                            }
                          }}
                          data-testid={`checkbox-select-all-sprint-${sprint.id}`}
                        />
                      </th>
                      <th className="text-left p-3 font-medium w-56">Ticket</th>
                      <th className="text-left p-3 font-medium">Statut</th>
                      <th className="text-left p-3 font-medium w-40">Résultats</th>
                      <th className="text-left p-3 font-medium">Conclusion</th>
                      <th className="text-left p-3 font-medium w-40">Suggestions</th>
                      <th className="text-left p-3 font-medium w-40">Remarques</th>
                      <th className="text-center p-3 font-medium whitespace-nowrap">Fixé / Terminé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map(ticket => (
                      <tr 
                        key={ticket.id} 
                        className={cn(
                          "border-b last:border-b-0 hover-elevate cursor-pointer",
                          selectedRecipeTickets.has(ticket.id) && "bg-violet-50 dark:bg-violet-900/10"
                        )}
                        onClick={() => openRecipeEditor(ticket, sprint)}
                        data-testid={`row-recipe-${ticket.id}`}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedRecipeTickets.has(ticket.id)}
                            onCheckedChange={() => toggleTicketSelection(ticket.id)}
                            data-testid={`checkbox-select-${ticket.id}`}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs",
                                ticket.type === "user_story" && "bg-green-100 border-green-300 text-green-700",
                                ticket.type === "task" && "bg-blue-100 border-blue-300 text-blue-700",
                                ticket.type === "bug" && "bg-red-100 border-red-300 text-red-700"
                              )}
                            >
                              {ticket.type === "user_story" ? "Story" : ticket.type === "bug" ? "Bug" : "Task"}
                            </Badge>
                            <span className="font-medium truncate max-w-[250px]" title={ticket.title}>
                              {ticket.title}
                            </span>
                          </div>
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="focus:outline-none" data-testid={`dropdown-status-${ticket.id}`}>
                                {getStatusBadge(ticket.recipe?.status as RecipeStatus | undefined)}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {recipeStatusOptions.map(option => (
                                <DropdownMenuItem
                                  key={option.value}
                                  onClick={() => {
                                    upsertRecipeMutation.mutate({
                                      sprintId: sprint.id,
                                      ticketId: ticket.id,
                                      ticketType: ticket.type,
                                      status: option.value as RecipeStatus,
                                    });
                                  }}
                                  data-testid={`option-status-${option.value}-${ticket.id}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-2 h-2 rounded-full" 
                                      style={{ backgroundColor: option.color }}
                                    />
                                    {option.label}
                                  </div>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={ticket.recipe?.observedResults || ""}
                            onChange={(e) => {
                              upsertRecipeMutation.mutate({
                                sprintId: sprint.id,
                                ticketId: ticket.id,
                                ticketType: ticket.type,
                                observedResults: e.target.value || null,
                              });
                            }}
                            placeholder="Résultats..."
                            className="h-8 text-xs bg-white border-gray-200"
                            data-testid={`input-results-${ticket.id}`}
                          />
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="focus:outline-none" data-testid={`dropdown-conclusion-${ticket.id}`}>
                                {getConclusionBadge(ticket.recipe?.conclusion as RecipeConclusion | null | undefined) || (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    -
                                  </Badge>
                                )}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem
                                onClick={() => {
                                  upsertRecipeMutation.mutate({
                                    sprintId: sprint.id,
                                    ticketId: ticket.id,
                                    ticketType: ticket.type,
                                    conclusion: null,
                                  });
                                }}
                                data-testid={`option-conclusion-none-${ticket.id}`}
                              >
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  Aucune
                                </div>
                              </DropdownMenuItem>
                              {recipeConclusionOptions.map(option => (
                                <DropdownMenuItem
                                  key={option.value}
                                  onClick={() => {
                                    upsertRecipeMutation.mutate({
                                      sprintId: sprint.id,
                                      ticketId: ticket.id,
                                      ticketType: ticket.type,
                                      conclusion: option.value as RecipeConclusion,
                                    });
                                  }}
                                  data-testid={`option-conclusion-${option.value}-${ticket.id}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-2 h-2 rounded-full" 
                                      style={{ backgroundColor: option.color }}
                                    />
                                    {option.label}
                                  </div>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={ticket.recipe?.suggestions || ""}
                            onChange={(e) => {
                              upsertRecipeMutation.mutate({
                                sprintId: sprint.id,
                                ticketId: ticket.id,
                                ticketType: ticket.type,
                                suggestions: e.target.value || null,
                              });
                            }}
                            placeholder="Suggestions..."
                            className="h-8 text-xs bg-white border-gray-200"
                            data-testid={`input-suggestions-${ticket.id}`}
                          />
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={ticket.recipe?.remarks || ""}
                            onChange={(e) => {
                              upsertRecipeMutation.mutate({
                                sprintId: sprint.id,
                                ticketId: ticket.id,
                                ticketType: ticket.type,
                                remarks: e.target.value || null,
                              });
                            }}
                            placeholder="Remarques..."
                            className="h-8 text-xs bg-white border-gray-200"
                            data-testid={`input-remarks-${ticket.id}`}
                          />
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={ticket.recipe?.isFixedDone || false}
                            onCheckedChange={(checked) => {
                              // When checking, also set status to "teste" and conclusion to "termine"
                              upsertRecipeMutation.mutate({
                                sprintId: sprint.id,
                                ticketId: ticket.id,
                                ticketType: ticket.type,
                                isFixedDone: !!checked,
                                ...(checked ? { status: "teste" as RecipeStatus, conclusion: "termine" as RecipeConclusion } : {}),
                              });
                            }}
                            data-testid={`checkbox-fixed-${ticket.id}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          )}
        </Card>
        );
      })}

      {/* Recipe Editor Sheet */}
      <Sheet open={!!editingRecipe} onOpenChange={(open) => !open && setEditingRecipe(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto bg-white dark:bg-white">
          <SheetHeader className="pb-2 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs shrink-0",
                  editingRecipe?.ticketType === "user_story" && "bg-green-100 border-green-300 text-green-700",
                  editingRecipe?.ticketType === "task" && "bg-blue-100 border-blue-300 text-blue-700",
                  editingRecipe?.ticketType === "bug" && "bg-red-100 border-red-300 text-red-700"
                )}
              >
                {editingRecipe?.ticketType === "user_story" ? "Story" : editingRecipe?.ticketType === "bug" ? "Bug" : "Task"}
              </Badge>
              <SheetTitle className="text-gray-900 text-base font-medium truncate">
                {editingRecipe?.ticketTitle || "Éditer la recette"}
              </SheetTitle>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
              <Play className="h-3 w-3" />
              {editingRecipe?.sprintName}
              {editingRecipe?.sprintStatus && (
                <Badge variant="outline" className="text-xs ml-1 py-0" style={{ borderColor: "#22C55E", color: "#22C55E" }}>
                  Terminé
                </Badge>
              )}
            </p>
          </SheetHeader>
          <div className="space-y-4 py-4">
            {/* Description */}
            {editingRecipe?.ticketDescription && (
              <div className="space-y-2">
                <Label className="text-gray-700">Description</Label>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md border border-gray-200">
                  {editingRecipe.ticketDescription}
                </div>
              </div>
            )}
            
            {/* Status */}
            <div className="space-y-2">
              <Label className="text-gray-700">Statut du test</Label>
              <Select
                value={recipeFormData.status}
                onValueChange={(v) => setRecipeFormData(prev => ({ ...prev, status: v as RecipeStatus }))}
              >
                <SelectTrigger className="bg-white text-gray-900 border-gray-300" data-testid="select-recipe-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recipeStatusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: option.color }}
                        />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Observed Results */}
            <div className="space-y-2">
              <Label className="text-gray-700">Résultats observés</Label>
              <Textarea
                value={recipeFormData.observedResults}
                onChange={(e) => setRecipeFormData(prev => ({ ...prev, observedResults: e.target.value }))}
                placeholder="Décrivez les résultats observés lors du test..."
                rows={4}
                className="bg-white text-gray-900 border-gray-300"
                data-testid="textarea-observed-results"
              />
            </div>

            {/* Conclusion */}
            <div className="space-y-2">
              <Label className="text-gray-700">Conclusion</Label>
              <Select
                value={recipeFormData.conclusion || "none"}
                onValueChange={(v) => setRecipeFormData(prev => ({ 
                  ...prev, 
                  conclusion: v === "none" ? null : v as RecipeConclusion 
                }))}
              >
                <SelectTrigger className="bg-white text-gray-900 border-gray-300" data-testid="select-recipe-conclusion">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune conclusion</SelectItem>
                  {recipeConclusionOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: option.color }}
                        />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Suggestions */}
            <div className="space-y-2">
              <Label className="text-gray-700">Suggestions</Label>
              <Textarea
                value={recipeFormData.suggestions}
                onChange={(e) => setRecipeFormData(prev => ({ ...prev, suggestions: e.target.value }))}
                placeholder="Suggérez des améliorations ou corrections..."
                rows={4}
                className="bg-white text-gray-900 border-gray-300"
                data-testid="textarea-suggestions"
              />
            </div>

            {/* Remarks / Remarques */}
            <div className="space-y-2">
              <Label className="text-gray-700">Remarques</Label>
              <Textarea
                value={recipeFormData.remarks}
                onChange={(e) => setRecipeFormData(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Notes libres, remarques additionnelles..."
                rows={3}
                className="bg-white text-gray-900 border-gray-300"
                data-testid="textarea-remarks"
              />
            </div>

            {/* Is Fixed Done */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="isFixedDone"
                checked={recipeFormData.isFixedDone}
                onCheckedChange={(checked) => setRecipeFormData(prev => ({ ...prev, isFixedDone: !!checked }))}
                data-testid="checkbox-is-fixed-done"
              />
              <Label htmlFor="isFixedDone" className="cursor-pointer text-gray-700">
                Correction terminée
              </Label>
            </div>

            {/* Push to Ticket */}
            <div className="flex items-center gap-2 pt-2 pb-4 mb-4 border-t border-gray-200">
              <Checkbox
                id="pushToTicket"
                checked={recipeFormData.pushToTicket}
                onCheckedChange={(checked) => setRecipeFormData(prev => ({ ...prev, pushToTicket: !!checked }))}
                data-testid="checkbox-push-to-ticket"
              />
              <Label htmlFor="pushToTicket" className="cursor-pointer flex items-center gap-1 text-gray-700">
                <MessageSquare className="h-4 w-4" />
                Ajouter un commentaire au ticket
              </Label>
            </div>
          </div>
          <SheetFooter className="flex flex-col gap-3 sm:flex-col">
            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                onClick={() => setEditingRecipe(null)}
                className="flex-1"
                data-testid="button-cancel-recipe"
              >
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (!editingRecipe) return;
                  upsertRecipeMutation.mutate({
                    sprintId: editingRecipe.sprintId,
                    ticketId: editingRecipe.ticketId,
                    ticketType: editingRecipe.ticketType,
                    status: recipeFormData.status,
                    observedResults: recipeFormData.observedResults || null,
                    conclusion: recipeFormData.conclusion,
                    suggestions: recipeFormData.suggestions || null,
                    remarks: recipeFormData.remarks || null,
                    isFixedDone: recipeFormData.isFixedDone,
                    pushToTicket: recipeFormData.pushToTicket,
                  });
                }}
                disabled={upsertRecipeMutation.isPending}
                data-testid="button-save-recipe"
              >
                {upsertRecipeMutation.isPending ? "..." : "Enregistrer"}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full text-gray-600"
              onClick={() => {
                if (!editingRecipe) return;
                const isTermine = editingRecipe.ticketState === "termine" || editingRecipe.ticketState === "done";
                const tab = isTermine ? "termine" : "backlog";
                window.location.href = `/product/backlog/${backlogId}?tab=${tab}&ticket=${editingRecipe.ticketId}&type=${editingRecipe.ticketType}`;
              }}
              data-testid="button-view-ticket"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Voir le ticket
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Retrospective List and Detail Component
function RetrospectiveView({ backlogId, sprints }: { backlogId: string; sprints: Sprint[] }) {
  const { toast } = useToast();
  const [selectedRetroId, setSelectedRetroId] = useState<string | null>(null);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");
  const [sprintSearchOpen, setSprintSearchOpen] = useState(false);
  const [sprintSearchValue, setSprintSearchValue] = useState("");

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
      setCreatePanelOpen(false);
      setSelectedSprintId("");
      setSprintSearchValue("");
      toastSuccess({ title: "Rétrospective créée" });
      // Auto-redirect to the new retro
      setSelectedRetroId(data.id);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  if (retrosLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader size="md" />
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

  // Filter sprints based on search
  const filteredSprints = sprints.filter(sprint => 
    sprint.name.toLowerCase().includes(sprintSearchValue.toLowerCase())
  );
  
  const selectedSprint = sprints.find(s => s.id === selectedSprintId);

  return (
    <div className="space-y-4" data-testid="retro-list">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Rétrospectives</h3>
        <Button size="sm" onClick={() => setCreatePanelOpen(true)} data-testid="button-create-retro">
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle rétrospective
        </Button>
        
        {/* Create Retro Side Panel */}
        <Sheet open={createPanelOpen} onOpenChange={setCreatePanelOpen}>
          <SheetContent className="sm:max-w-md w-full overflow-y-auto bg-white dark:bg-white">
            <SheetHeader>
              <SheetTitle className="text-gray-900">Nouvelle rétrospective</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Sprint associé (optionnel)</Label>
                <Popover open={sprintSearchOpen} onOpenChange={setSprintSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={sprintSearchOpen}
                      className="w-full justify-between bg-white text-gray-900 border-gray-300"
                      data-testid="select-sprint-for-retro"
                    >
                      {selectedSprint ? selectedSprint.name : "Sélectionner un sprint..."}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-white" align="start">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Rechercher un sprint..."
                        value={sprintSearchValue}
                        onChange={(e) => setSprintSearchValue(e.target.value)}
                        className="bg-white text-gray-900 border-gray-300"
                        data-testid="input-sprint-search"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      <div
                        className={cn(
                          "flex items-center px-3 py-2 cursor-pointer text-gray-900 hover:bg-gray-100",
                          !selectedSprintId && "bg-violet-50"
                        )}
                        onClick={() => {
                          setSelectedSprintId("");
                          setSprintSearchOpen(false);
                        }}
                        data-testid="option-sprint-none"
                      >
                        <Check className={cn("mr-2 h-4 w-4", !selectedSprintId ? "opacity-100" : "opacity-0")} />
                        Aucun sprint
                      </div>
                      {filteredSprints.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500">Aucun sprint trouvé</div>
                      ) : (
                        filteredSprints.map(sprint => (
                          <div
                            key={sprint.id}
                            className={cn(
                              "flex items-center px-3 py-2 cursor-pointer text-gray-900 hover:bg-gray-100",
                              selectedSprintId === sprint.id && "bg-violet-50"
                            )}
                            onClick={() => {
                              setSelectedSprintId(sprint.id);
                              setSprintSearchOpen(false);
                            }}
                            data-testid={`option-sprint-${sprint.id}`}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedSprintId === sprint.id ? "opacity-100" : "opacity-0")} />
                            {sprint.name}
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <SheetFooter className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setCreatePanelOpen(false)} className="text-gray-700">Annuler</Button>
              <Button 
                onClick={() => createRetroMutation.mutate(selectedSprintId || null)}
                disabled={createRetroMutation.isPending}
                data-testid="button-confirm-create-retro"
              >
                {createRetroMutation.isPending ? "..." : "Créer"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
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
        <Loader size="md" />
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
