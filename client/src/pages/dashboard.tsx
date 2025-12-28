import { ArrowUp, ArrowDown, FolderKanban, Users, Euro, CheckSquare, Plus, FileText, TrendingUp, ChevronRight, Calendar as CalendarIcon, Check, CreditCard, AlertTriangle, Zap, ArrowRight, Clock, DollarSign, CheckCircle2, ExternalLink, X, Settings, GripVertical, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format as formatDate } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, formatDateForStorage } from "@/lib/queryClient";
import type { Project, Client, Activity, AppUser, InsertClient, InsertProject, Task, TaskColumn, ProjectPayment } from "@shared/schema";
import { insertClientSchema, insertProjectSchema } from "@shared/schema";
import { useState, useEffect, useMemo, useCallback } from "react";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { Switch } from "@/components/ui/switch";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader } from "@/components/Loader";
import astronautAvatar from "@assets/E2C9617D-45A3-4B6C-AAFC-BE05B63ADC44_1764889729769.png";
import { getProjectStageColorClass, getProjectStageLabel, getStatusFromColumnName as getStatusFromColumnNameConfig } from "@shared/config";

// Use centralized config for stage colors and labels
const getStageColor = (stage: string) => getProjectStageColorClass(stage);
const getStageLabel = (stage: string) => getProjectStageLabel(stage);

// Fonction pour traduire les types d'activités
const translateActivityKind = (kind: string) => {
  const translations: Record<string, string> = {
    created: "créé",
    updated: "mis à jour",
    deleted: "supprimé",
    email: "email envoyé",
    call: "appel",
    meeting: "réunion",
    note: "note",
    time_tracked: "temps enregistré",
    task: "tâche",
  };
  return translations[kind] || kind;
};

// Use centralized config for status from column name
const getStatusFromColumnName = getStatusFromColumnNameConfig;

// Fonction pour traduire les types de sujets
const translateSubjectType = (subjectType: string) => {
  const translations: Record<string, string> = {
    project: "projet",
    client: "client",
    deal: "affaire",
    task: "tâche",
    note: "note",
    contact: "contact",
    mindmap: "whiteboard",
    backlog: "backlog",
  };
  return translations[subjectType] || subjectType;
};

// Fonction pour traduire les descriptions d'activités
const translateActivityDescription = (description: string) => {
  const translations: Record<string, string> = {
    "Project created:": "Projet créé :",
    "Project updated:": "Projet mis à jour :",
    "Project deleted:": "Projet supprimé :",
    "New client onboarded:": "Nouveau client enregistré :",
    "Client updated:": "Client mis à jour :",
    "Client deleted:": "Client supprimé :",
    "Task created:": "Tâche créée :",
    "Task updated:": "Tâche mise à jour :",
    "Task deleted:": "Tâche supprimée :",
    "Contact created:": "Contact créé :",
    "Contact updated:": "Contact mis à jour :",
    "Contact deleted:": "Contact supprimé :",
    "Note created:": "Note créée :",
    "Note updated:": "Note mise à jour :",
    "Note deleted:": "Note supprimée :",
    "Document created:": "Document créé :",
    "Nouvelle note créée:": "Nouvelle note créée :",
    "Whiteboard created:": "Whiteboard créé :",
    "Whiteboard updated:": "Whiteboard mis à jour :",
    "Backlog créé:": "Backlog créé :",
    "Epic créé:": "Epic créé :",
    "User Story créée:": "User Story créée :",
    "Tâche créée:": "Tâche créée :",
  };
  
  // Try to translate known patterns
  for (const [key, value] of Object.entries(translations)) {
    if (description.includes(key)) {
      return description.replace(key, value);
    }
  }
  
  return description;
};

// Fonction pour obtenir l'URL de redirection d'une activité
const getActivityUrl = (subjectType: string, subjectId: string): string | null => {
  const routes: Record<string, string> = {
    project: `/projects/${subjectId}`,
    client: `/crm/${subjectId}`,
    note: `/notes/${subjectId}`,
    document: `/documents/${subjectId}`,
    task: `/tasks`,
    deal: `/crm`,
    contact: `/crm`,
    mindmap: `/mindmaps/${subjectId}`,
    backlog: `/product/backlog/${subjectId}`,
  };
  return routes[subjectType] || null;
};

// Types pour le résumé de profitabilité
interface RecommendationBlocks {
  pastImpact: { amount: number; condition: string };
  currentImplication: { message: string; isPast?: boolean };
  concreteAction: { primary: string; alternatives: string[] };
}

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  priorityScore: number;
  decisionInfo?: { emoji: string; label: string; timing: string };
  blocks?: RecommendationBlocks;
  issue: string;
  action: string;
  impact: string;
  impactValue?: number;
  category: 'pricing' | 'time' | 'payment' | 'model' | 'strategic';
  projectId?: string;
  projectName?: string;
}

interface ProfitabilityAnalysis {
  projectId: string;
  projectName: string;
  recommendations: Recommendation[];
  healthScore: number;
}

interface ProfitabilitySummary {
  projects: ProfitabilityAnalysis[];
  generatedAt: string;
}

// Dashboard block configuration
type DashboardBlockId = 'kpis' | 'priorityAction' | 'revenueChart' | 'activityFeed' | 'recentProjects' | 'myDay';

interface DashboardBlockConfig {
  id: DashboardBlockId;
  label: string;
  visible: boolean;
}

const DEFAULT_DASHBOARD_BLOCKS: DashboardBlockConfig[] = [
  { id: 'kpis', label: 'KPIs', visible: true },
  { id: 'priorityAction', label: 'Action Prioritaire', visible: true },
  { id: 'revenueChart', label: 'Revenus Mensuels', visible: true },
  { id: 'activityFeed', label: 'Activités Récentes', visible: true },
  { id: 'recentProjects', label: 'Projets Récents', visible: true },
  { id: 'myDay', label: 'Ma Journée', visible: true },
];

const STORAGE_KEY = 'planbase_dashboard_config';

// Sortable item component for settings dialog
function SortableBlockItem({ block, onToggle }: { block: DashboardBlockConfig; onToggle: (id: DashboardBlockId, visible: boolean) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 border rounded-lg bg-card ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded"
          data-testid={`drag-handle-${block.id}`}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-medium">{block.label}</span>
      </div>
      <div className="flex items-center gap-2">
        {block.visible ? (
          <Eye className="w-4 h-4 text-muted-foreground" />
        ) : (
          <EyeOff className="w-4 h-4 text-muted-foreground" />
        )}
        <Switch
          checked={block.visible}
          onCheckedChange={(checked) => onToggle(block.id, checked)}
          data-testid={`toggle-block-${block.id}`}
        />
      </div>
    </div>
  );
}

// Helpers for priority colors
const getPriorityScoreColor = (score: number) => {
  if (score >= 80) return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-l-red-500' };
  if (score >= 60) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-l-orange-500' };
  if (score >= 40) return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-l-amber-500' };
  if (score >= 20) return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-l-blue-500' };
  return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-l-gray-400' };
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'pricing': return DollarSign;
    case 'time': return Clock;
    case 'payment': return CreditCard;
    default: return Zap;
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  }).format(value);
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isCreateClientDialogOpen, setIsCreateClientDialogOpen] = useState(false);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [myDayFilter, setMyDayFilter] = useState<"today" | "overdue" | "next3days">("today");
  const [revenuePeriod, setRevenuePeriod] = useState<"full_year" | "until_this_month" | "projection" | "6months" | "quarter">("full_year");
  const [activityFilter, setActivityFilter] = useState<"all" | "crm" | "projets" | "product" | "taches" | "whiteboards" | "notes" | "documents">("all");
  const [openStatusPopover, setOpenStatusPopover] = useState<string | null>(null);
  const [showTaskReminder, setShowTaskReminder] = useState(false);
  const [isPriorityActionDismissed, setIsPriorityActionDismissed] = useState(() => {
    return sessionStorage.getItem('priorityActionDismissed') === 'true';
  });
  const [projectFormData, setProjectFormData] = useState({
    name: "",
    description: "",
    clientId: "",
    stage: "prospection",
    category: "",
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    budget: "",
  });

  // Dashboard customization state
  const [dashboardBlocks, setDashboardBlocks] = useState<DashboardBlockConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_DASHBOARD_BLOCKS;
      }
    }
    return DEFAULT_DASHBOARD_BLOCKS;
  });
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  // DnD sensors for dashboard settings
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Save dashboard config to localStorage
  const saveDashboardConfig = useCallback((blocks: DashboardBlockConfig[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
    setDashboardBlocks(blocks);
  }, []);

  // Toggle block visibility
  const handleBlockToggle = useCallback((id: DashboardBlockId, visible: boolean) => {
    const newBlocks = dashboardBlocks.map(b => 
      b.id === id ? { ...b, visible } : b
    );
    saveDashboardConfig(newBlocks);
  }, [dashboardBlocks, saveDashboardConfig]);

  // Handle drag end for reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = dashboardBlocks.findIndex(b => b.id === active.id);
      const newIndex = dashboardBlocks.findIndex(b => b.id === over.id);
      const newBlocks = arrayMove(dashboardBlocks, oldIndex, newIndex);
      saveDashboardConfig(newBlocks);
    }
  }, [dashboardBlocks, saveDashboardConfig]);

  // Reset dashboard config to default
  const resetDashboardConfig = useCallback(() => {
    saveDashboardConfig(DEFAULT_DASHBOARD_BLOCKS);
  }, [saveDashboardConfig]);

  // Helper to check if a block is visible
  const isBlockVisible = useCallback((id: DashboardBlockId) => {
    const block = dashboardBlocks.find(b => b.id === id);
    return block?.visible ?? true;
  }, [dashboardBlocks]);

  // Get visible blocks in configured order
  const orderedVisibleBlocks = useMemo(() => {
    return dashboardBlocks.filter(b => b.visible);
  }, [dashboardBlocks]);

  // Fetch current user to get accountId
  const { data: currentUser } = useQuery<AppUser>({
    queryKey: ["/api/me"],
  });

  const accountId = currentUser?.accountId;

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!accountId,
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: !!accountId,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    enabled: !!accountId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !!accountId,
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/accounts", accountId, "users"],
    enabled: !!accountId,
  });

  // Fetch profitability summary for priority actions
  const { data: profitabilitySummary } = useQuery<ProfitabilitySummary>({
    queryKey: ['/api/profitability/summary'],
    enabled: !!accountId,
  });

  // Get top priority recommendation across all projects
  const topPriorityAction = useMemo(() => {
    if (!profitabilitySummary?.projects) return null;
    
    const allRecommendations: (Recommendation & { projectName: string; projectId: string })[] = [];
    
    for (const project of profitabilitySummary.projects) {
      for (const rec of project.recommendations) {
        allRecommendations.push({
          ...rec,
          projectName: project.projectName,
          projectId: project.projectId,
        });
      }
    }
    
    if (allRecommendations.length === 0) return null;
    
    // Sort by priority score descending and return the top one
    return allRecommendations.sort((a, b) => b.priorityScore - a.priorityScore)[0];
  }, [profitabilitySummary]);

  // Get ALL task columns (including global and project-specific)
  const { data: allTaskColumns = [] } = useQuery<TaskColumn[]>({
    queryKey: ["/api/task-columns"],
  });

  // Fetch all payments for the account
  const { data: payments = [] } = useQuery<ProjectPayment[]>({
    queryKey: ["/api/payments"],
    enabled: !!accountId,
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      const response = await apiRequest("/api/clients", "POST", data);
      return response.json();
    },
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsCreateClientDialogOpen(false);
      clientForm.reset();
      toast({ title: "Client créé avec succès", variant: "success" });
      // Rediriger vers la page du nouveau client
      setLocation(`/crm/${newClient.id}`);
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      return await apiRequest("/api/projects", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsCreateProjectDialogOpen(false);
      setProjectFormData({
        name: "",
        description: "",
        clientId: "",
        stage: "prospection",
        category: "",
        startDate: undefined,
        endDate: undefined,
        budget: "",
      });
      toast({ title: "Projet créé avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  // Update task status mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status, columnId, columnName }: { 
      taskId: string; 
      status?: string; 
      columnId?: string;
      columnName?: string;
    }) => {
      const payload: { status?: string; columnId?: string } = {};
      
      // If columnId is provided, also derive and set status from column name
      if (columnId !== undefined) {
        payload.columnId = columnId;
        if (columnName) {
          payload.status = getStatusFromColumnName(columnName);
        }
      }
      
      // Explicit status override
      if (status !== undefined) payload.status = status;
      
      return await apiRequest(`/api/tasks/${taskId}`, "PATCH", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Tâche mise à jour", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  // Handlers for task modal
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleTaskSave = async (updates: Partial<Task>) => {
    try {
      await apiRequest(`/api/tasks/${updates.id}`, "PATCH", updates);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsTaskModalOpen(false);
      toast({ title: "Tâche mise à jour", variant: "success" });
    } catch (error) {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  };

  const handleTaskDelete = async (task: Task) => {
    try {
      await apiRequest(`/api/tasks/${task.id}`, "DELETE");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsTaskModalOpen(false);
      toast({ title: "Tâche supprimée", variant: "success" });
    } catch (error) {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    }
  };

  // Form for client creation
  const clientForm = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      accountId: accountId || "",
      name: "",
      type: "company",
      status: "prospecting",
      budget: "0",
      tags: [],
      contacts: [],
      notes: "",
      createdBy: currentUser?.id || "",
    },
  });

  // Form for project creation
  const projectForm = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      accountId: accountId || "",
      name: "",
      description: "",
      stage: "prospection",
      category: "",
      budget: "0",
      tags: [],
      meta: {},
      createdBy: currentUser?.id || "",
    },
  });

  // Update form default values when accountId and currentUser become available
  useEffect(() => {
    if (accountId && currentUser) {
      clientForm.reset({
        accountId: accountId,
        name: "",
        type: "company",
        status: "prospecting",
        budget: "0",
        tags: [],
        contacts: [],
        notes: "",
        createdBy: currentUser.id,
      });
      projectForm.reset({
        accountId: accountId,
        name: "",
        description: "",
        stage: "prospection",
        category: "",
        budget: "0",
        tags: [],
        meta: {},
        createdBy: currentUser.id,
      });
    }
  }, [accountId, currentUser, clientForm, projectForm]);

  // Show task reminder popup when page loads if there are tasks due today or overdue
  useEffect(() => {
    // Only show once per session using sessionStorage
    const hasShownReminder = sessionStorage.getItem("taskReminderShown");
    if (hasShownReminder) return;
    
    // Wait for tasks to load
    if (tasksLoading || tasks.length === 0) return;
    
    // Check for tasks due today or overdue (excluding done tasks)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const urgentTasks = tasks.filter(t => {
      if (!t.dueDate || t.status === "done") return false;
      const dueDate = new Date(t.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate <= today;
    });
    
    if (urgentTasks.length > 0) {
      setShowTaskReminder(true);
      sessionStorage.setItem("taskReminderShown", "true");
    }
  }, [tasks, tasksLoading]);

  // Helper function to normalize any date value to local YYYY-MM-DD string
  const normalizeToLocalDate = (dateValue: any): string => {
    // Handle bare YYYY-MM-DD strings without timezone adjustment
    const dateStr = String(dateValue);
    if (dateStr.length === 10 && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr; // Bare date - use as-is (universal calendar day)
    }
    // For timestamps (ISO with time/timezone), adjust for viewer's timezone offset
    const d = new Date(dateValue);
    const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  };

  // Memoize task calculations for performance (must be before return early to maintain hook order)
  const { todaysTasks, overdueTasks, next3DaysTasks, myDayTasks, filteredMyDayTasks, filteredOverdueCount, todayStr } = useMemo(() => {
    // Calculate today's date string (inside useMemo to avoid recalculation on every render)
    const today = normalizeToLocalDate(new Date()); // Format: YYYY-MM-DD in local time

    // Helper function to deduplicate tasks by ID
    const deduplicateTasks = (taskList: Task[]): Task[] => {
      const seen = new Set<string>();
      return taskList.filter(task => {
        if (!task.id || seen.has(task.id)) return false;
        seen.add(task.id);
        return true;
      });
    };

    // Deduplicate tasks once at the source before any filtering
    const uniqueTasks = deduplicateTasks(tasks);

    // Helper function to get date string in N days
    const getDateInDays = (days: number): string => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return normalizeToLocalDate(date);
    };

    // Calculate today's tasks (tasks due today) using local time
    const todayTasks = uniqueTasks.filter(t => {
      if (!t.dueDate) return false;
      // Normalize dueDate to local date string (YYYY-MM-DD) to handle all formats
      const dueDateStr = normalizeToLocalDate(t.dueDate);
      return dueDateStr === today && t.status !== "done";
    });

    // Calculate overdue tasks (tasks with dueDate before today and not done)
    const overdue = uniqueTasks.filter(t => {
      if (!t.dueDate) return false;
      const dueDateStr = normalizeToLocalDate(t.dueDate);
      return dueDateStr < today && t.status !== "done";
    });

    // Calculate tasks for the next 3 days (excluding today and overdue)
    const next3Days = uniqueTasks.filter(t => {
      if (!t.dueDate) return false;
      const dueDateStr = normalizeToLocalDate(t.dueDate);
      const tomorrow = getDateInDays(1);
      const dayAfter = getDateInDays(2);
      const day3 = getDateInDays(3);
      return (dueDateStr === tomorrow || dueDateStr === dayAfter || dueDateStr === day3) && t.status !== "done";
    });

    // Combine today's tasks and overdue tasks for "Ma Journée" - deduplicate after concatenation
    const combined = deduplicateTasks([...overdue, ...todayTasks]);

    // Filter tasks based on selected filter - deduplicate after concatenation for next3days
    const filtered = 
      myDayFilter === "overdue" 
        ? overdue
        : myDayFilter === "next3days"
          ? deduplicateTasks([...overdue, ...todayTasks, ...next3Days])
          : combined; // "today" filter: overdue + today (already deduplicated)

    // Count overdue tasks in filtered list for badge
    const overdueInFiltered = filtered.filter(t => {
      if (!t.dueDate) return false;
      const dueDateStr = normalizeToLocalDate(t.dueDate);
      return dueDateStr < today;
    }).length;

    return {
      todaysTasks: todayTasks,
      overdueTasks: overdue,
      next3DaysTasks: next3Days,
      myDayTasks: combined,
      filteredMyDayTasks: filtered,
      filteredOverdueCount: overdueInFiltered,
      todayStr: today,
    };
  }, [tasks, myDayFilter]); // Use tasks directly as dependency

  // Revenue data for chart - based on project budgets by start month
  const revenueData = useMemo(() => {
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const now = new Date();
    const currentYear = now.getFullYear();
    const months: Array<{ month: string; monthIndex: number; year: number; key: string }> = [];
    
    // Determine which months to show based on selected period
    if (revenuePeriod === "6months") {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const monthIndex = d.getMonth();
        months.push({
          month: monthNames[monthIndex],
          monthIndex,
          year,
          key: `${year}-${monthIndex}`
        });
      }
    } else if (revenuePeriod === "until_this_month") {
      // All months of current year up to current month
      const currentMonth = now.getMonth();
      for (let i = 0; i <= currentMonth; i++) {
        months.push({
          month: monthNames[i],
          monthIndex: i,
          year: currentYear,
          key: `${currentYear}-${i}`
        });
      }
    } else if (revenuePeriod === "projection") {
      // Projection: mois en cours (à partir de demain) + mois restants jusqu'à décembre
      // Si on est le 27 novembre, on inclut novembre (pour les projets du 28+) et décembre
      const currentMonth = now.getMonth();
      for (let i = currentMonth; i < 12; i++) {
        months.push({
          month: monthNames[i],
          monthIndex: i,
          year: currentYear,
          key: `${currentYear}-${i}`
        });
      }
    } else if (revenuePeriod === "full_year") {
      // All 12 months of current year
      for (let i = 0; i < 12; i++) {
        months.push({
          month: monthNames[i],
          monthIndex: i,
          year: currentYear,
          key: `${currentYear}-${i}`
        });
      }
    } else if (revenuePeriod === "quarter") {
      // Current quarter (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      for (let i = 0; i < 3; i++) {
        const monthIndex = quarterStartMonth + i;
        const year = currentYear;
        months.push({
          month: monthNames[monthIndex],
          monthIndex,
          year,
          key: `${year}-${monthIndex}`
        });
      }
    }
    
    // Initialize monthly budgets and project counts using unique keys
    const monthlyBudgets: Record<string, number> = {};
    const monthlyProjectCounts: Record<string, number> = {};
    months.forEach(({ key }) => {
      monthlyBudgets[key] = 0;
      monthlyProjectCounts[key] = 0;
    });
    
    // Sum budgets and count projects by start month (excluding prospection stage)
    // Pour le mode projection, on prend uniquement les projets à partir de demain
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    projects.forEach(project => {
      // totalBilled has priority over budget
      const effectiveBudget = project.totalBilled || project.budget;
      if (project.startDate && effectiveBudget && project.stage !== "prospection") {
        const startDate = new Date(project.startDate);
        const projectMonth = startDate.getMonth();
        const projectYear = startDate.getFullYear();
        
        // En mode projection, on filtre les projets à partir de demain
        if (revenuePeriod === "projection") {
          if (startDate < tomorrow) {
            return; // Ignorer les projets avant demain
          }
        }
        
        // Check if this project's start date is in the selected period
        const matchingMonth = months.find(
          m => m.monthIndex === projectMonth && m.year === projectYear
        );
        
        if (matchingMonth) {
          monthlyBudgets[matchingMonth.key] += Number(effectiveBudget) || 0;
          monthlyProjectCounts[matchingMonth.key] += 1;
        }
      }
    });
    
    return months.map(({ month, key, year }) => {
      const revenue = monthlyBudgets[key];
      // Calculate violet gradient color based on budget (max 20K)
      const intensity = Math.min(revenue / 20000, 1);
      // Violet gradient from light (#E9D5FF) to dark (#7C3AED)
      const lightColor = { r: 233, g: 213, b: 255 };
      const darkColor = { r: 124, g: 58, b: 237 };
      const r = Math.round(lightColor.r + (darkColor.r - lightColor.r) * intensity);
      const g = Math.round(lightColor.g + (darkColor.g - lightColor.g) * intensity);
      const b = Math.round(lightColor.b + (darkColor.b - lightColor.b) * intensity);
      const fill = `rgb(${r}, ${g}, ${b})`;
      
      // Show year in label if period spans multiple years
      const needsYearLabel = months.some(m => m.year !== year);
      const monthLabel = needsYearLabel ? `${month} ${year}` : month;
      
      return {
        month: monthLabel,
        revenue,
        projectCount: monthlyProjectCounts[key],
        fill
      };
    });
  }, [projects, revenuePeriod]);

  // Chiffre d'affaires dynamique basé sur la période sélectionnée
  // Il doit être la somme des revenus mensuels affichés dans le graphique
  const { revenue: periodRevenue, label: periodLabel } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    let label: string;
    
    if (revenuePeriod === "full_year") {
      label = `CA ${currentYear}`;
    } else if (revenuePeriod === "until_this_month") {
      label = `CA jusqu'à ce mois`;
    } else if (revenuePeriod === "projection") {
      label = "CA Projection";
    } else if (revenuePeriod === "6months") {
      label = "CA 6 derniers mois";
    } else {
      // Quarter
      const quarterNumber = Math.floor(now.getMonth() / 3) + 1;
      label = `CA Q${quarterNumber} ${currentYear}`;
    }
    
    // Somme des revenus mensuels du graphique (déjà filtrés par période et stage)
    const revenue = revenueData.reduce((sum, month) => sum + month.revenue, 0);
    
    return { revenue, label };
  }, [revenueData, revenuePeriod]);

  // CA Potentiel = Tous les projets en prospection (passés, futurs, non datés)
  // Ce sont les projets non signés qui représentent du chiffre potentiel
  const potentialRevenue = useMemo(() => {
    return projects
      .filter(p => p.stage === "prospection")
      .reduce((sum, p) => sum + parseFloat(p.budget || "0"), 0);
  }, [projects]);

  const onClientSubmit = (data: InsertClient) => {
    createClientMutation.mutate(data);
  };

  const onProjectSubmit = (data: InsertProject) => {
    createProjectMutation.mutate(data);
  };

  if (!accountId || projectsLoading || clientsLoading || activitiesLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader size="lg" />
      </div>
    );
  }

  // Calculate real KPIs
  // Projets en cours = pas de prospection et pas terminés
  const activeProjectsCount = projects.filter(p => p.stage !== "termine" && p.stage !== "prospection").length;
  const totalProjectsCount = projects.length;
  
  // Compter les tâches en cours (status !== 'done')
  const activeTasksCount = tasks.filter(t => t.status !== "done").length;

  // Calculer le CA global (totalBilled prioritaire sur budget, hors prospection)
  const projectsHorsProspection = projects.filter(p => p.stage !== "prospection");
  const globalRevenue = projectsHorsProspection.reduce((sum, p) => sum + parseFloat(p.totalBilled || p.budget || "0"), 0);
  
  // Calculer les paiements encaissés
  // Logique: Si un projet est marqué comme "paye", on prend son budget entier
  // Sinon, on prend la somme des paiements individuels pour ce projet
  const totalPaid = projectsHorsProspection.reduce((sum, project) => {
    // totalBilled has priority over budget
    const projectBudget = parseFloat(project.totalBilled || project.budget || "0");
    
    // Si le projet est marqué comme payé, on considère tout le budget comme encaissé
    if (project.billingStatus === "paye") {
      return sum + projectBudget;
    }
    
    // Sinon, on additionne les paiements individuels pour ce projet
    const projectPayments = payments.filter(p => p.projectId === project.id);
    const paidAmount = projectPayments.reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
    return sum + paidAmount;
  }, 0);
  
  // Paiements en attente = CA global - montants encaissés
  const pendingPayments = Math.max(0, globalRevenue - totalPaid);

  // KPI data from real data - Ordre: CA, Paiements en attente, Tâches, Projets
  const kpis: Array<{
    title: string;
    value: string;
    change: string;
    changeType: "positive" | "negative" | "neutral";
    icon: any;
    iconBg: string;
    iconColor: string;
    link?: { label: string; href: string };
    subValue?: string; // Pour afficher le CA potentiel sous le CA N
  }> = [
    {
      title: "Chiffre d'affaires",
      value: `${periodRevenue.toLocaleString()} €`,
      change: periodLabel,
      changeType: "neutral",
      icon: Euro,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      subValue: potentialRevenue > 0 ? `${potentialRevenue.toLocaleString()} € potentiel` : undefined,
    },
    {
      title: "Paiements en attente",
      value: `${pendingPayments.toLocaleString()} €`,
      change: `${totalPaid.toLocaleString()} € reçus`,
      changeType: "negative",
      icon: CreditCard,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
    },
    {
      title: "Tâches en cours",
      value: activeTasksCount.toString(),
      change: `${tasks.length} au total`,
      changeType: "neutral",
      icon: CheckSquare,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      link: { label: "Voir tout", href: "/tasks" },
    },
    {
      title: "Projets en cours",
      value: activeProjectsCount.toString(),
      change: totalProjectsCount > 0 ? `${totalProjectsCount} au total` : "0 au total",
      changeType: "neutral",
      icon: FolderKanban,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
      link: { label: "Voir tous", href: "/projects?tab=projects" },
    },
  ];

  // Recent 5 projects from API, sorted by creation date
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Activity feed from API - show more history for filtering (max 50 total)
  const activityFeed = activities.slice(0, 50);

  return (
    <div className="h-full overflow-auto overflow-x-hidden">
      <div className="p-6 space-y-6">
        {/* Create Client Sheet */}
        <Sheet open={isCreateClientDialogOpen} onOpenChange={setIsCreateClientDialogOpen}>
          <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col" data-testid="dialog-create-client">
            <SheetHeader>
              <SheetTitle>Créer un nouveau client</SheetTitle>
            </SheetHeader>
            <Form {...clientForm}>
              <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4 flex-1 py-4">
                <FormField
                  control={clientForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du client</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-client-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={clientForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-client-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="company">Entreprise</SelectItem>
                            <SelectItem value="person">Personne</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={clientForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-client-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="prospecting">Prospection</SelectItem>
                            <SelectItem value="qualified">Qualifié</SelectItem>
                            <SelectItem value="negotiation">Négociation</SelectItem>
                            <SelectItem value="won">Gagné</SelectItem>
                            <SelectItem value="lost">Perdu</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={clientForm.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value || 0}
                          onChange={(e) => field.onChange(e.target.value)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          disabled={field.disabled}
                          data-testid="input-client-budget"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateClientDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createClientMutation.isPending} data-testid="button-submit-client">
                    Créer
                  </Button>
                </div>
              </form>
            </Form>
          </SheetContent>
        </Sheet>

        {/* Create Project Sheet */}
        <Sheet open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
          <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col" data-testid="dialog-create-project">
            <SheetHeader>
              <SheetTitle>Créer un nouveau projet</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 flex-1 py-4">
              <div>
                <Label htmlFor="project-name">Nom du projet *</Label>
                <Input
                  id="project-name"
                  value={projectFormData.name}
                  onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                  data-testid="input-project-name"
                />
              </div>
              <div>
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  value={projectFormData.description}
                  onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                  rows={3}
                  data-testid="textarea-project-description"
                />
              </div>
              <div>
                <Label htmlFor="project-client">Client</Label>
                <Select
                  value={projectFormData.clientId}
                  onValueChange={(value) => setProjectFormData({ ...projectFormData, clientId: value })}
                >
                  <SelectTrigger id="project-client" data-testid="select-project-client">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id} className="cursor-pointer">
                        {client.company || client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="project-stage">Étape</Label>
                  <Select
                    value={projectFormData.stage}
                    onValueChange={(value) => setProjectFormData({ ...projectFormData, stage: value })}
                  >
                    <SelectTrigger id="project-stage" data-testid="select-project-stage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="prospection" className="cursor-pointer">Prospection</SelectItem>
                      <SelectItem value="signe" className="cursor-pointer">Signé</SelectItem>
                      <SelectItem value="en_cours" className="cursor-pointer">En cours</SelectItem>
                      <SelectItem value="livre" className="cursor-pointer">Livré</SelectItem>
                      <SelectItem value="termine" className="cursor-pointer">Terminé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="project-category">Catégorie</Label>
                  <Input
                    id="project-category"
                    value={projectFormData.category}
                    onChange={(e) => setProjectFormData({ ...projectFormData, category: e.target.value })}
                    data-testid="input-project-category"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date de début</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-project-start-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {projectFormData.startDate ? (
                          formatDate(projectFormData.startDate, "PPP", { locale: fr })
                        ) : (
                          <span>Choisir une date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={projectFormData.startDate}
                        onSelect={(date) => setProjectFormData({ ...projectFormData, startDate: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Date de fin</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-project-end-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {projectFormData.endDate ? (
                          formatDate(projectFormData.endDate, "PPP", { locale: fr })
                        ) : (
                          <span>Choisir une date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={projectFormData.endDate}
                        onSelect={(date) => setProjectFormData({ ...projectFormData, endDate: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <Label htmlFor="project-budget">Budget (€)</Label>
                <Input
                  id="project-budget"
                  type="number"
                  value={projectFormData.budget}
                  onChange={(e) => setProjectFormData({ ...projectFormData, budget: e.target.value })}
                  data-testid="input-project-budget"
                />
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateProjectDialogOpen(false);
                    setProjectFormData({
                      name: "",
                      description: "",
                      clientId: "",
                      stage: "prospection",
                      category: "",
                      startDate: undefined,
                      endDate: undefined,
                      budget: "",
                    });
                  }}
                  data-testid="button-cancel-project"
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => {
                    if (!accountId || !currentUser?.id) return;
                    createProjectMutation.mutate({
                      name: projectFormData.name.trim(),
                      description: projectFormData.description?.trim() || null,
                      clientId: projectFormData.clientId || null,
                      stage: projectFormData.stage,
                      category: projectFormData.category?.trim() || null,
                      startDate: projectFormData.startDate ? formatDateForStorage(projectFormData.startDate) : null,
                      endDate: projectFormData.endDate ? formatDateForStorage(projectFormData.endDate) : null,
                      budget: projectFormData.budget?.trim() || null,
                      accountId: accountId,
                      createdBy: currentUser.id,
                    });
                  }}
                  disabled={!projectFormData.name.trim() || createProjectMutation.isPending || !accountId || !currentUser?.id}
                  data-testid="button-submit-project"
                >
                  Créer le projet
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-foreground" data-testid="text-greeting">
            Bonjour{currentUser?.firstName ? `, ${currentUser.firstName}` : ''}
          </h2>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => setIsCreateClientDialogOpen(true)}
              data-testid="button-new-client"
              className="flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline text-[12px]">Nouveau Client</span>
            </Button>
            <Button 
              onClick={() => setIsCreateProjectDialogOpen(true)}
              data-testid="button-new-project"
              className="flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline text-[12px]">Nouveau Projet</span>
            </Button>
            <Button 
              variant="ghost"
              size="icon"
              onClick={() => setIsSettingsDialogOpen(true)}
              data-testid="button-dashboard-settings"
              title="Personnaliser le tableau de bord"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Dashboard Settings Panel */}
        <Sheet open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <SheetContent side="right" className="w-[350px] sm:w-[400px]" data-testid="panel-dashboard-settings">
            <SheetHeader>
              <SheetTitle>Personnaliser le tableau de bord</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Glissez pour réorganiser les blocs et utilisez les interrupteurs pour les afficher/masquer.
              </p>
            </SheetHeader>
            <div className="py-6">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={dashboardBlocks.map(b => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {dashboardBlocks.map((block) => (
                      <SortableBlockItem
                        key={block.id}
                        block={block}
                        onToggle={handleBlockToggle}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={resetDashboardConfig}
                data-testid="button-reset-dashboard"
                className="flex-1"
              >
                Réinitialiser
              </Button>
              <Button
                onClick={() => setIsSettingsDialogOpen(false)}
                data-testid="button-close-settings"
                className="flex-1"
              >
                Fermer
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Dynamic Dashboard Blocks Container - Rendered in user-configured order */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 lg:gap-6">
          {orderedVisibleBlocks.map((block) => {
            // KPI Cards
            if (block.id === 'kpis') {
              return (
                <div key={block.id} className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-kpis">
                  {kpis.map((kpi, index) => {
                    const Icon = kpi.icon;
                    return (
                      <Card key={index} data-testid={`card-kpi-${index}`}>
                        <CardContent className="p-4 sm:p-6">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground font-medium">
                                {kpi.title}
                              </p>
                              <h3 className="text-[22px] font-heading font-bold mt-2 text-foreground">
                                {kpi.value}
                              </h3>
                              <p className={`text-[10px] flex items-center gap-1 mt-2 ${
                                kpi.changeType === "positive" 
                                  ? "text-green-600" 
                                  : kpi.changeType === "negative" 
                                    ? "text-red-600"
                                    : "text-muted-foreground"
                              }`}>
                                {kpi.changeType === "positive" ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : kpi.changeType === "negative" ? (
                                  <ArrowDown className="w-3 h-3" />
                                ) : null}
                                {kpi.change}
                              </p>
                              {kpi.subValue && (
                                <p className="text-[10px] text-amber-600 mt-1">
                                  {kpi.subValue}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className={`${kpi.iconBg} p-3 rounded-md shrink-0`}>
                                <Icon className={`w-6 h-6 ${kpi.iconColor}`} />
                              </div>
                              {kpi.link && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-[10px] hover:text-primary h-auto py-1 px-0" 
                                  onClick={() => {
                                    if (kpi.link!.href.includes('?')) {
                                      window.location.href = kpi.link!.href;
                                    } else {
                                      setLocation(kpi.link!.href);
                                    }
                                  }}
                                  data-testid={`button-kpi-${index}-view-all`}
                                >
                                  {kpi.link.label}
                                  <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            }

            // Priority Action Card
            if (block.id === 'priorityAction' && topPriorityAction && !isPriorityActionDismissed) {
              return (
                <Card key={block.id} className={`lg:col-span-6 border-l-4 ${getPriorityScoreColor(topPriorityAction.priorityScore).border} bg-gradient-to-r from-white to-gray-50/30 dark:from-gray-900 dark:to-gray-800/30`} data-testid="card-priority-action">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Left: Icon + Content */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2.5 rounded-lg shrink-0 ${getPriorityScoreColor(topPriorityAction.priorityScore).bg}`}>
                    {(() => {
                      const CategoryIcon = getCategoryIcon(topPriorityAction.category);
                      return <CategoryIcon className={`w-5 h-5 ${getPriorityScoreColor(topPriorityAction.priorityScore).text}`} />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className={`${getPriorityScoreColor(topPriorityAction.priorityScore).bg} ${getPriorityScoreColor(topPriorityAction.priorityScore).text} border-0 text-xs`}>
                        {topPriorityAction.decisionInfo?.emoji} {topPriorityAction.decisionInfo?.label || 'Action prioritaire'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Score: {topPriorityAction.priorityScore}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-foreground line-clamp-1">
                      {topPriorityAction.blocks?.concreteAction.primary || topPriorityAction.action}
                    </p>
                    {topPriorityAction.projectName && (
                      <Link 
                        href={`/projects/${topPriorityAction.projectId}`}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 mt-1"
                      >
                        {topPriorityAction.projectName}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                    {topPriorityAction.impactValue && topPriorityAction.impactValue > 0 && (
                      <p className="text-xs text-emerald-600 font-medium mt-1">
                        +{formatCurrency(topPriorityAction.impactValue)} potentiel
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Right: Action + Dismiss */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setLocation('/finance')}
                    className="text-xs"
                    data-testid="button-view-all-actions"
                  >
                    Voir toutes les actions
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      sessionStorage.setItem('priorityActionDismissed', 'true');
                      setIsPriorityActionDismissed(true);
                    }}
                    data-testid="button-dismiss-priority-action"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

          {/* Revenue Chart - Spans 4 columns */}
          {isBlockVisible('revenueChart') && (
          <Card className="lg:col-span-4 overflow-hidden flex flex-col" style={{ order: getBlockOrder('revenueChart') }}>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 space-y-0 pb-0">
              <CardTitle className="text-base font-heading font-semibold">
                Revenus Mensuels
              </CardTitle>
              <Select value={revenuePeriod} onValueChange={(value: "full_year" | "until_this_month" | "projection" | "6months" | "quarter") => setRevenuePeriod(value)}>
                <SelectTrigger className="w-[180px] bg-card" data-testid="select-revenue-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_year">Année 2025</SelectItem>
                  <SelectItem value="until_this_month">Jusqu'à ce mois</SelectItem>
                  <SelectItem value="projection">Projection</SelectItem>
                  <SelectItem value="6months">6 derniers mois</SelectItem>
                  <SelectItem value="quarter">Trimestre actuel</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="min-w-0 text-[12px] flex-1 flex flex-col justify-end pt-2">
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                      }}
                      formatter={(value: number, name: string, props: any) => {
                        const projectCount = props.payload?.projectCount || 0;
                        if (name === 'revenue') {
                          return [
                            `${new Intl.NumberFormat('fr-FR').format(value)} €`,
                            'CA'
                          ];
                        }
                        return [value, name];
                      }}
                      labelFormatter={(label) => {
                        const item = revenueData.find(d => d.month === label);
                        return `${label} - ${item?.projectCount || 0} projet${(item?.projectCount || 0) > 1 ? 's' : ''}`;
                      }}
                    />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                      {revenueData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Recent Activity Feed - Spans 2 columns */}
          {isBlockVisible('activityFeed') && (
          <Card className="lg:col-span-2" style={{ order: getBlockOrder('activityFeed') }}>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 space-y-0 pb-2">
              <CardTitle className="text-base font-heading font-semibold">
                Activités Récentes
              </CardTitle>
              <Select value={activityFilter} onValueChange={(value: any) => setActivityFilter(value)}>
                <SelectTrigger className="w-[140px] h-8 text-xs bg-card" data-testid="select-activity-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Toutes</SelectItem>
                  <SelectItem value="crm" className="text-xs">CRM</SelectItem>
                  <SelectItem value="projets" className="text-xs">Projets</SelectItem>
                  <SelectItem value="product" className="text-xs">Product</SelectItem>
                  <SelectItem value="taches" className="text-xs">Tâches</SelectItem>
                  <SelectItem value="whiteboards" className="text-xs">WhiteBoards</SelectItem>
                  <SelectItem value="notes" className="text-xs">Notes</SelectItem>
                  <SelectItem value="documents" className="text-xs">Documents</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityFeed.filter((activity) => {
                  if (activityFilter === "all") return true;
                  if (activityFilter === "crm") return activity.subjectType === "client" || activity.subjectType === "contact" || activity.subjectType === "deal";
                  if (activityFilter === "projets") return activity.subjectType === "project";
                  if (activityFilter === "product") return activity.subjectType === "backlog";
                  if (activityFilter === "taches") return activity.subjectType === "task";
                  if (activityFilter === "whiteboards") return activity.subjectType === "mindmap";
                  if (activityFilter === "notes") return activity.subjectType === "note";
                  if (activityFilter === "documents") return activity.subjectType === "document";
                  return true;
                }).slice(0, 5).map((activity) => {
                  const payload = activity.payload as { description?: string };
                  const translatedKind = translateActivityKind(activity.kind);
                  const translatedSubject = translateSubjectType(activity.subjectType);
                  const description = payload.description 
                    ? translateActivityDescription(payload.description)
                    : `${translatedSubject} ${translatedKind}`;
                  const activityUrl = getActivityUrl(activity.subjectType, activity.subjectId);
                  
                  const activityContent = (
                    <>
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground capitalize">
                          {description}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </>
                  );
                  
                  return activityUrl ? (
                    <Link 
                      key={activity.id} 
                      href={activityUrl}
                      className="flex items-start gap-3 p-2 -mx-2 rounded-md hover-elevate cursor-pointer" 
                      data-testid={`activity-${activity.id}`}
                    >
                      {activityContent}
                    </Link>
                  ) : (
                    <div key={activity.id} className="flex items-start gap-3" data-testid={`activity-${activity.id}`}>
                      {activityContent}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Recent Projects - Spans 3 columns */}
          {isBlockVisible('recentProjects') && (
          <Card className="lg:col-span-3" style={{ order: getBlockOrder('recentProjects') }}>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 space-y-0 pb-2">
              <CardTitle className="text-base font-heading font-semibold">
                Projets Récents
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLocation("/projects")}
                data-testid="button-view-all-projects"
              >
                <span className="hidden sm:inline">Voir tout</span>
                <span className="sm:hidden">Tout</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentProjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Aucun projet récent</p>
                ) : (
                  recentProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 rounded-md hover-elevate active-elevate-2 border border-border cursor-pointer"
                      onClick={() => setLocation(`/projects/${project.id}`)}
                      data-testid={`project-${project.id}`}
                    >
                      <div className="w-1 h-12 rounded bg-primary shrink-0 hidden sm:block" />
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <h4 className="text-xs font-medium text-foreground truncate">{project.name}</h4>
                        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{project.description || "Aucune description"}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto flex-wrap">
                        <Badge className={`${getStageColor(project.stage || "prospection")} shrink-0`}>
                          {getStageLabel(project.stage || "prospection")}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Ma Journée Widget - Spans 3 columns */}
          {isBlockVisible('myDay') && (
          <Card className="lg:col-span-3" style={{ order: getBlockOrder('myDay') }}>
            <CardHeader className="pb-2">
              <div className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base font-heading font-semibold">
                  Ma Journée
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={myDayFilter} onValueChange={(value: any) => setMyDayFilter(value)}>
                    <SelectTrigger className="w-40 h-8 text-xs bg-card" data-testid="select-my-day-filter">
                      <SelectValue className="text-xs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today" className="text-xs">Aujourd'hui</SelectItem>
                      <SelectItem value="overdue" className="text-xs">Retard</SelectItem>
                      <SelectItem value="next3days" className="text-xs">Les 3 prochains jours</SelectItem>
                    </SelectContent>
                  </Select>
                  {filteredOverdueCount > 0 && myDayFilter === "today" && (
                    <Badge variant="destructive" data-testid="badge-overdue-tasks-count">
                      {filteredOverdueCount} en retard
                    </Badge>
                  )}
                  <Badge variant="secondary" data-testid="badge-today-tasks-count">
                    {filteredMyDayTasks.length} tâche{filteredMyDayTasks.length > 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredMyDayTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Aucune tâche pour ce filtre</p>
                ) : (
                  filteredMyDayTasks.map((task) => {
                    const client = clients.find(c => c.id === task.clientId);
                    const project = projects.find(p => p.id === task.projectId);
                    const isOverdue = task.dueDate && normalizeToLocalDate(task.dueDate) < todayStr;
                    const priorityColors: Record<string, string> = {
                      low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                      high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                    };
                    const priorityLabels: Record<string, string> = {
                      low: "Basse",
                      medium: "Moyenne",
                      high: "Haute",
                    };
                    
                    // Find the current column for this task (search in ALL columns, including global ones)
                    const currentColumn = allTaskColumns.find(col => col.id === task.columnId);
                    
                    // Get task columns for the selector: ONLY project-specific columns (no global columns to avoid duplicates)
                    const taskColumnsForTask = task.projectId 
                      ? allTaskColumns.filter(col => col.projectId === task.projectId)
                      : allTaskColumns.filter(col => !col.projectId);
                    
                    // Function to adjust color brightness for background (lighter) and text (darker)
                    const getColorVariants = (colorStr: string) => {
                      let r = 0, g = 0, b = 0;
                      
                      // Parse color (handle both hex and rgba formats)
                      if (colorStr.startsWith('rgba') || colorStr.startsWith('rgb')) {
                        const match = colorStr.match(/\d+/g);
                        if (match) {
                          r = parseInt(match[0]) / 255;
                          g = parseInt(match[1]) / 255;
                          b = parseInt(match[2]) / 255;
                        }
                      } else {
                        // Hex format
                        const hex = colorStr.replace('#', '');
                        r = parseInt(hex.substring(0, 2), 16) / 255;
                        g = parseInt(hex.substring(2, 4), 16) / 255;
                        b = parseInt(hex.substring(4, 6), 16) / 255;
                      }
                      
                      // Convert RGB to HSL
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      let h = 0, s = 0, l = (max + min) / 2;
                      
                      if (max !== min) {
                        const d = max - min;
                        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                        
                        switch (max) {
                          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                          case g: h = ((b - r) / d + 2) / 6; break;
                          case b: h = ((r - g) / d + 4) / 6; break;
                        }
                      }
                      
                      // Helper to convert HSL back to RGB
                      const hslToRgb = (h: number, s: number, l: number) => {
                        const hue2rgb = (p: number, q: number, t: number) => {
                          if (t < 0) t += 1;
                          if (t > 1) t -= 1;
                          if (t < 1/6) return p + (q - p) * 6 * t;
                          if (t < 1/2) return q;
                          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                          return p;
                        };
                        
                        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                        const p = 2 * l - q;
                        const rNew = Math.round(hue2rgb(p, q, h + 1/3) * 255);
                        const gNew = Math.round(hue2rgb(p, q, h) * 255);
                        const bNew = Math.round(hue2rgb(p, q, h - 1/3) * 255);
                        
                        return `#${((1 << 24) + (rNew << 16) + (gNew << 8) + bNew).toString(16).slice(1)}`;
                      };
                      
                      // Background: lighter pastel version (high lightness ~88%)
                      const bgColor = hslToRgb(h, Math.max(s, 0.4), 0.88);
                      
                      // Text: darker version of same hue (low lightness ~30%)
                      const textColor = hslToRgb(h, Math.max(s, 0.6), 0.30);
                      
                      return { bgColor, textColor };
                    };

                    return (
                      <div
                        key={task.id}
                        className={`flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer ${
                          isOverdue ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20' : ''
                        }`}
                        data-testid={`today-task-${task.id}`}
                        onClick={() => handleTaskClick(task)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-heading font-medium text-foreground">{task.title}</h4>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-[10px]" data-testid={`badge-overdue-${task.id}`}>
                                En retard
                              </Badge>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge className={priorityColors[task.priority]} data-testid={`badge-priority-${task.id}`}>
                              {priorityLabels[task.priority]}
                            </Badge>
                            {client && (
                              <Badge variant="outline" data-testid={`badge-client-${task.id}`}>
                                {client.name}
                              </Badge>
                            )}
                            {project && (
                              <Badge variant="outline" data-testid={`badge-project-${task.id}`}>
                                {project.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Popover open={openStatusPopover === task.id} onOpenChange={(open) => setOpenStatusPopover(open ? task.id : null)}>
                            <PopoverTrigger asChild>
                              {currentColumn?.color ? (() => {
                                const { bgColor, textColor } = getColorVariants(currentColumn.color);
                                return (
                                  <Badge
                                    className="cursor-pointer hover-elevate text-xs border-0"
                                    style={{
                                      backgroundColor: bgColor,
                                      color: textColor,
                                    }}
                                    data-testid={`badge-status-${task.id}`}
                                  >
                                    {currentColumn.name}
                                  </Badge>
                                );
                              })() : (
                                <Badge
                                  className="cursor-pointer hover-elevate text-xs border-0"
                                  data-testid={`badge-status-${task.id}`}
                                >
                                  Aucun
                                </Badge>
                              )}
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2" align="end" data-testid={`popover-status-options-${task.id}`}>
                              <div className="flex flex-col gap-1">
                                {taskColumnsForTask.map((column) => {
                                  const { bgColor, textColor } = getColorVariants(column.color);
                                  return (
                                    <Badge
                                      key={column.id}
                                      className="cursor-pointer hover-elevate justify-start text-xs border-0"
                                      style={{
                                        backgroundColor: bgColor,
                                        color: textColor,
                                      }}
                                      onClick={() => {
                                        updateTaskStatusMutation.mutate({
                                          taskId: task.id,
                                          columnId: column.id,
                                          columnName: column.name,
                                        });
                                        setOpenStatusPopover(null);
                                      }}
                                      data-testid={`option-status-${column.name}-${task.id}`}
                                    >
                                      {column.name}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </div>
      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        users={users}
        projects={projects}
        columns={allTaskColumns}
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
      />
      
      {/* Task Reminder Dialog */}
      <Dialog open={showTaskReminder} onOpenChange={setShowTaskReminder}>
        <DialogContent className="w-[92vw] max-w-md overflow-hidden flex flex-col left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2 max-sm:w-full max-sm:h-full max-sm:max-w-full max-sm:max-h-full max-sm:rounded-none max-sm:top-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Tâches à traiter aujourd'hui
            </DialogTitle>
            <DialogDescription>
              Vous avez des tâches urgentes ou en retard qui nécessitent votre attention.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {(() => {
              const urgentTasks = [...overdueTasks, ...todaysTasks].slice(0, 5);
              return urgentTasks.map((task) => {
                const project = projects?.find(p => p.id === task.projectId);
                const isOverdue = task.dueDate && normalizeToLocalDate(task.dueDate) < todayStr;
                return (
                  <div
                    key={task.id}
                    className={`p-3 rounded-md border ${isOverdue ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800' : 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800'}`}
                  >
                    <p className="text-sm font-medium">{task.title}</p>
                    {project && (
                      <p className="text-xs text-muted-foreground mt-1">{project.name}</p>
                    )}
                    <Badge 
                      variant="outline" 
                      className={`mt-2 text-xs ${isOverdue ? 'border-red-500 text-red-600' : 'border-amber-500 text-amber-600'}`}
                    >
                      {isOverdue ? 'En retard' : "Aujourd'hui"}
                    </Badge>
                  </div>
                );
              });
            })()}
            {[...overdueTasks, ...todaysTasks].length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                Et {[...overdueTasks, ...todaysTasks].length - 5} autre(s) tâche(s)...
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowTaskReminder(false)}>
              Fermer
            </Button>
            <Button onClick={() => {
              setShowTaskReminder(false);
              setLocation("/tasks");
            }}>
              Voir mes tâches
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
