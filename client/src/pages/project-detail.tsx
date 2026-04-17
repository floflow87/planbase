import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, Calendar as CalendarIcon, Euro, Tag, Edit, Trash2, Users, Star, FileText, DollarSign, Timer, Clock, Check, ChevronsUpDown, Plus, FolderKanban, Play, Kanban, LayoutGrid, User, ChevronDown, ChevronLeft, ChevronRight, Flag, Layers, ListTodo, ExternalLink, MessageSquare, Phone, Mail, Video, StickyNote, MoreHorizontal, CheckCircle2, Briefcase, TrendingUp, TrendingDown, Info, List, RefreshCw, PlusCircle, XCircle, File, Map, Lock, Unlock, AlertTriangle, Trophy, Bell, Settings, FolderOpen, Upload, X, Download, Pencil, Image, Target, Lightbulb, FlaskConical, Bot, Loader2, Sparkles, Crown } from "lucide-react";
import { FileExplorer } from "@/components/file-explorer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Project, Task, Client, AppUser, TaskColumn, Note, Document, ProjectPayment, Backlog, Epic, UserStory, BacklogTask, Sprint, BacklogColumn, ChecklistItem, BacklogItemState, BacklogPriority, Activity, ProjectScopeItem } from "@shared/schema";
import { billingStatusOptions, backlogModeOptions, backlogItemStateOptions, backlogPriorityOptions } from "@shared/schema";
import { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, formatDateForStorage } from "@/lib/queryClient";
import { useBilling } from "@/hooks/useBilling";
import { Loader } from "@/components/Loader";
import { ProjectScopeSection } from "@/components/ProjectScopeSection";
import { RoadmapTab } from "@/components/roadmap/roadmap-tab";
import { ResourcesTab } from "@/components/resources-tab";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { PostCreationSuggestions } from "@/components/PostCreationSuggestions";
import { CdcWizard } from "@/components/cdc/CdcWizard";
import { SimulationDrawer } from "@/components/SimulationDrawer";
import { PAYMENT_RHYTHM_LABELS, RHYTHMS_WITH_DEPOSIT, type PaymentRhythm } from "@/lib/simulationUtils";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

import { getBillingStatusColorClass } from "@shared/config";
import { useProjectStagesUI } from "@/hooks/useProjectStagesUI";
import { AutomationButton } from "@/components/automations/AutomationDrawer";

interface ProjectWithRelations extends Project {
  client?: Client;
  tasks?: Task[];
}

type TimeEntry = {
  id: string;
  projectId: string | null;
  userId: string;
  scopeItemId: string | null;
  taskId: string | null;
  sprintId: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  description: string | null;
  accountId: string;
  createdAt: string;
  updatedAt: string;
};

// Project types that can be linked to resource templates
const PROJECT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'dev_saas', label: 'Développement SaaS' },
  { value: 'design', label: 'Design & Graphisme' },
  { value: 'conseil', label: 'Conseil & Accompagnement' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'site_vitrine', label: 'Site Vitrine' },
  { value: 'integration', label: 'Intégration & API' },
  { value: 'formation', label: 'Formation' },
  { value: 'cpo', label: 'Product Management' },
  { value: 'autre', label: 'Autre' },
];

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  categories: { id: string; name: string; projectType?: string | null }[];
  coreProjectTypes?: string[];
}

function CategoryCombobox({ value, onChange, categories, coreProjectTypes = [] }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showProjectTypeSelector, setShowProjectTypeSelector] = useState(false);
  const [selectedProjectType, setSelectedProjectType] = useState<string>("");
  const [pendingCategoryName, setPendingCategoryName] = useState("");

  // Check if a category has templates linked (is "Core")
  const isCoreCategory = (cat: { projectType?: string | null }) => {
    return cat.projectType && coreProjectTypes.includes(cat.projectType);
  };

  const handleStartCreateCategory = () => {
    const trimmedValue = searchValue.trim();
    if (!trimmedValue) return;
    setPendingCategoryName(trimmedValue);
    setShowProjectTypeSelector(true);
  };

  const handleConfirmCreateCategory = async () => {
    if (!pendingCategoryName) return;

    try {
      // Create the category via API with optional projectType
      await apiRequest('/api/project-categories', 'POST', { 
        name: pendingCategoryName,
        projectType: selectedProjectType || null,
      });
      // Invalidate the cache to refetch categories
      queryClient.invalidateQueries({ queryKey: ['/api/project-categories'] });
      // Update local state
      onChange(pendingCategoryName);
      setOpen(false);
      setSearchValue("");
      setShowProjectTypeSelector(false);
      setSelectedProjectType("");
      setPendingCategoryName("");
    } catch (error: any) {
      console.error('Error creating category:', error);
    }
  };

  const handleCancelCreate = () => {
    setShowProjectTypeSelector(false);
    setSelectedProjectType("");
    setPendingCategoryName("");
  };

  // Filter categories based on search
  // Sort alphabetically for predictable ordering
  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  
  const filteredCategories = searchValue === ""
    ? sortedCategories // No search: show all categories
    : sortedCategories
        .filter((cat) => 
          cat.name.toLowerCase().includes(searchValue.toLowerCase())
        );
  
  // Ensure currently selected category is always included at the top
  if (value && !filteredCategories.some(cat => cat.name === value)) {
    const selectedCategory = categories.find(cat => cat.name === value);
    if (selectedCategory) {
      filteredCategories.unshift(selectedCategory);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          data-testid="button-category-selector"
        >
          {value || "Sélectionnez une catégorie..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        {showProjectTypeSelector ? (
          <div className="p-3 space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">Créer "{pendingCategoryName}"</p>
              <p className="text-xs text-muted-foreground">Lier à un type de projet pour les ressources (optionnel)</p>
            </div>
            <Select value={selectedProjectType} onValueChange={setSelectedProjectType}>
              <SelectTrigger className="w-full" data-testid="select-project-type">
                <SelectValue placeholder="Sélectionner un type..." />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                    {coreProjectTypes.includes(opt.value) && (
                      <span className="ml-1 text-violet-600">*</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancelCreate} className="flex-1" data-testid="button-cancel-create">
                Annuler
              </Button>
              <Button size="sm" onClick={handleConfirmCreateCategory} className="flex-1" data-testid="button-confirm-create">
                Créer
              </Button>
            </div>
          </div>
        ) : (
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Rechercher ou créer..." 
            value={searchValue}
            onValueChange={setSearchValue}
            data-testid="input-category-search"
          />
          <CommandList className="max-h-[200px] overflow-y-scroll">
            <CommandEmpty>
              {searchValue.trim() && (
                <button
                  className="w-full text-sm py-2 px-4 hover-elevate active-elevate-2 rounded-sm text-left"
                  onClick={handleStartCreateCategory}
                  data-testid="button-create-category"
                >
                  Créer "{searchValue.trim()}"
                </button>
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredCategories.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.name}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                    setSearchValue("");
                  }}
                  data-testid={`option-category-${cat.name}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === cat.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1">{cat.name}</span>
                  {isCoreCategory(cat) && (
                    <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700">
                      Core
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        )
        }
      </PopoverContent>
    </Popover>
  );
}

// Type for profitability analysis from backend
interface ProfitabilityMetrics {
  actualDaysWorked: number;
  theoreticalDays: number;
  timeOverrun: number;
  timeOverrunPercent: number;
  totalBilled: number;
  totalPaid: number;
  remainingToPay: number;
  paymentProgress: number;
  targetTJM: number;
  actualTJM: number;
  tjmGap: number;
  tjmGapPercent: number;
  internalDailyCost: number;
  totalCost: number;
  margin: number;
  marginPercent: number;
  targetMarginPercent: number;
  status: 'profitable' | 'at_risk' | 'deficit';
  statusLabel: string;
  statusColor: string;
}

interface ProfitabilityAnalysis {
  projectId: string;
  projectName: string;
  metrics: ProfitabilityMetrics;
  recommendations: any[];
  healthScore?: number;
  generatedAt: string;
}

// Type for project comparison data
interface ProjectComparison {
  currentProject: {
    id: string;
    name: string;
    category: string | null;
    metrics: ProfitabilityMetrics;
    healthScore: number;
  };
  similarProjects: {
    avgMarginPercent: number;
    avgActualTJM: number;
    avgTimeOverrunPercent: number;
    avgPaymentProgress: number;
    projectCount: number;
  } | null;
  bestProjects: {
    avgMarginPercent: number;
    avgActualTJM: number;
    avgTimeOverrunPercent: number;
    projectCount: number;
    topProjects: { 
      id: string;
      name: string; 
      category: string | null;
      marginPercent: number;
      actualTJM: number;
      actualDaysWorked: number;
      theoreticalDays: number;
      timeOverrunPercent: number;
      status: 'profitable' | 'at_risk' | 'deficit';
    }[];
  } | null;
  projections: {
    pacePerDay: number;
    estimatedTotalDays: number;
    projectedMargin: number;
    projectedMarginPercent: number;
    timeDeviation: number;
    atRiskOfOverrun: boolean;
    projectedEndDate: string | null;
  };
  comparison: {
    vsSimilar: {
      marginGap: number;
      tjmGap: number;
      timeGap: number;
      paymentGap: number;
      verdict: 'above_average' | 'below_average';
    } | null;
    vsBest: {
      marginGap: number;
      tjmGap: number;
      timeGap: number;
      verdict: 'top_performer' | 'improvement_possible';
    } | null;
  };
  generatedAt: string;
}

function TimeTrackingTab({ projectId, project }: { projectId: string; project?: ProjectWithRelations }) {
  const { toast } = useToast();
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  
  // Collapsible panel states
  const [isTimePerCdcExpanded, setIsTimePerCdcExpanded] = useState(false);
  const [isTimeSessionsExpanded, setIsTimeSessionsExpanded] = useState(false);
  
  // Edit time entry state
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeEntry | null>(null);
  const [editTimeDate, setEditTimeDate] = useState<Date | undefined>(undefined);
  const [editTimeHours, setEditTimeHours] = useState<string>("");
  const [editTimeMinutes, setEditTimeMinutes] = useState<string>("0");
  const [editTimeDescription, setEditTimeDescription] = useState<string>("");
  const [editScopeItemId, setEditScopeItemId] = useState<string | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [isEditTimeDatePickerOpen, setIsEditTimeDatePickerOpen] = useState(false);
  
  // Free time entry form state
  const [showAddTimeForm, setShowAddTimeForm] = useState(false);
  const [timeInputMode, setTimeInputMode] = useState<'hours' | 'days'>('hours');
  const [newTimeDate, setNewTimeDate] = useState<Date | undefined>(new Date());
  const [newTimeDates, setNewTimeDates] = useState<Date[]>([]);
  const [newTimeHours, setNewTimeHours] = useState<string>("");
  const [newTimeMinutes, setNewTimeMinutes] = useState<string>("0");
  const [newTimeDescription, setNewTimeDescription] = useState<string>("");
  const [isNewTimeDatePickerOpen, setIsNewTimeDatePickerOpen] = useState(false);
  const [isAddingTime, setIsAddingTime] = useState(false);
  
  // Optional linking to scope items, tasks and sprints
  const [selectedScopeItemId, setSelectedScopeItemId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [editSprintId, setEditSprintId] = useState<string | null>(null);

  const { data: timeEntries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: [`/api/projects/${projectId}/time-entries`],
  });
  
  // Fetch scope items (CDC) for this project
  const { data: scopeItemsData } = useQuery<{ scopeItems: ProjectScopeItem[] }>({
    queryKey: ['/api/projects', projectId, 'scope-items'],
    enabled: !!projectId,
  });
  const scopeItems = scopeItemsData?.scopeItems || [];
  
  // Fetch tasks for this project
  const { data: projectTasksData } = useQuery<Task[]>({
    queryKey: [`/api/projects/${projectId}/tasks`],
    enabled: !!projectId,
  });
  const projectTasks = Array.isArray(projectTasksData) ? projectTasksData : [];
  
  // Fetch sprints for this project
  const { data: projectSprintsData } = useQuery<Sprint[]>({
    queryKey: ['/api/projects', projectId, 'sprints'],
    enabled: !!projectId,
  });
  const projectSprints = projectSprintsData || [];

  // Fetch profitability from backend for consistent calculations
  const { data: profitabilityData } = useQuery<ProfitabilityAnalysis>({
    queryKey: ['/api/projects', projectId, 'profitability'],
    enabled: !!projectId,
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/accounts", project?.accountId, "users"],
    enabled: !!project?.accountId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return await apiRequest(`/api/time-entries/${entryId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/time-entries`] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'profitability'] });
      toast({
        title: "Session supprimée",
        description: "La session de temps a été supprimée avec succès",
        variant: "success",
      });
      setDeleteEntryId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTimeEntryMutation = useMutation({
    mutationFn: async (data: { entryId: string; projectId: string; startTime: string; endTime: string; duration: number; description: string | null; scopeItemId: string | null; taskId: string | null; sprintId: string | null }) => {
      return await apiRequest(`/api/time-entries/${data.entryId}`, "PATCH", {
        projectId: data.projectId,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        description: data.description,
        scopeItemId: data.scopeItemId,
        taskId: data.taskId,
        sprintId: data.sprintId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/time-entries`] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'profitability'] });
      toast({
        title: "Session modifiée",
        description: "La session de temps a été mise à jour avec succès",
        variant: "success",
      });
      setEditingTimeEntry(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handler to open edit sheet
  const handleOpenEditSheet = (entry: TimeEntry) => {
    setEditingTimeEntry(entry);
    setEditTimeDate(new Date(entry.startTime));
    const hours = Math.floor((entry.duration || 0) / 3600);
    const minutes = Math.floor(((entry.duration || 0) % 3600) / 60);
    setEditTimeHours(hours.toString());
    setEditTimeMinutes(minutes.toString());
    setEditTimeDescription(entry.description || "");
    setEditScopeItemId(entry.scopeItemId);
    setEditTaskId(entry.taskId);
    setEditSprintId(entry.sprintId || null);
  };

  // Handler to save edited time entry
  const handleSaveEditedTimeEntry = () => {
    if (!editingTimeEntry || !editTimeDate) return;
    
    const hours = parseFloat(editTimeHours) || 0;
    const minutes = parseFloat(editTimeMinutes) || 0;
    const totalSeconds = (hours * 3600) + (minutes * 60);
    
    if (totalSeconds <= 0) {
      toast({
        title: "Erreur",
        description: "La durée doit être supérieure à 0",
        variant: "destructive",
      });
      return;
    }

    // Calculate endTime based on startTime + duration
    const startTime = editTimeDate;
    const endTime = new Date(startTime.getTime() + totalSeconds * 1000);

    updateTimeEntryMutation.mutate({
      entryId: editingTimeEntry.id,
      projectId: projectId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: totalSeconds,
      description: editTimeDescription.trim() || null,
      scopeItemId: editScopeItemId,
      taskId: editTaskId,
      sprintId: editSprintId,
    });
  };

  // Calculate total time in seconds
  const totalTimeSeconds = timeEntries.reduce((sum, entry) => {
    return sum + (entry.duration || 0);
  }, 0);

  // Convert to hours
  const totalTimeHours = totalTimeSeconds / 3600;

  // Use profitability data from backend (consistent with finance page)
  const metrics = profitabilityData?.metrics;

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h${minutes > 0 ? ` ${minutes}min` : ""}`;
    }
    return `${minutes}min`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <Loader />
        </CardContent>
      </Card>
    );
  }

  // Calculate time KPIs
  const totalTimeDays = totalTimeHours / 8;
  // Priority: CDC days > project.numberOfDays (billing days)
  const cdcEstimatedDays = scopeItems.reduce((sum, item) => sum + (parseFloat(item.estimatedDays?.toString() || "0")), 0);
  const projectNumberOfDays = parseFloat(project?.numberOfDays?.toString() || "0") || 0;
  const totalEstimatedDays = cdcEstimatedDays > 0 ? cdcEstimatedDays : projectNumberOfDays;
  const remainingDays = Math.max(0, totalEstimatedDays - totalTimeDays);
  const consumptionPercent = totalEstimatedDays > 0 ? (totalTimeDays / totalEstimatedDays) * 100 : 0;
  
  // Calculate "at this pace" projections
  const calculatePaceProjection = () => {
    if (timeEntries.length < 2) {
      return { available: false, reason: "Pas assez de données" };
    }
    
    // Get entries with valid dates, sorted by date
    const entriesWithDates = timeEntries
      .filter(e => e.startTime && e.duration && e.duration > 0)
      .map(e => ({
        date: new Date(e.startTime!),
        duration: e.duration || 0,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    
    if (entriesWithDates.length < 2) {
      return { available: false, reason: "Pas assez de sessions" };
    }
    
    // Method 1: Last 7 days window
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last7DaysEntries = entriesWithDates.filter(e => e.date >= sevenDaysAgo);
    
    // Method 2: Last 5 sessions
    const last5Sessions = entriesWithDates.slice(0, 5);
    
    // Choose the method with more data points (pick the richer dataset)
    // Explicitly compare counts and select the set with more sessions
    let selectedEntries: typeof entriesWithDates;
    let windowLabel: string;
    
    const has7Days = last7DaysEntries.length >= 2;
    const has5Sessions = last5Sessions.length >= 2;
    
    if (!has7Days && !has5Sessions) {
      return { available: false, reason: "Données insuffisantes" };
    }
    
    if (has7Days && has5Sessions) {
      // Both valid - pick the one with MORE entries
      if (last7DaysEntries.length > last5Sessions.length) {
        selectedEntries = last7DaysEntries;
        windowLabel = "7 derniers jours";
      } else {
        selectedEntries = last5Sessions;
        windowLabel = "5 dernières sessions";
      }
    } else if (has7Days) {
      selectedEntries = last7DaysEntries;
      windowLabel = "7 derniers jours";
    } else {
      selectedEntries = last5Sessions;
      windowLabel = "5 dernières sessions";
    }
    
    if (selectedEntries.length < 2) {
      return { available: false, reason: "Données insuffisantes" };
    }
    
    // Calculate time consumed in window (in days)
    const windowTimeSeconds = selectedEntries.reduce((sum, e) => sum + e.duration, 0);
    const windowTimeDays = windowTimeSeconds / 3600 / 8;
    
    // Calculate window duration (in calendar days)
    const oldestEntry = selectedEntries[selectedEntries.length - 1];
    const newestEntry = selectedEntries[0];
    const windowCalendarDays = Math.max(1, (newestEntry.date.getTime() - oldestEntry.date.getTime()) / (24 * 60 * 60 * 1000) + 1);
    
    // Pace: work days per calendar day
    const pacePerDay = windowTimeDays / windowCalendarDays;
    
    if (pacePerDay <= 0) {
      return { available: false, reason: "Rythme invalide" };
    }
    
    // If no estimation defined, just return pace info without projection
    if (totalEstimatedDays <= 0) {
      return {
        available: true,
        noEstimation: true,
        pacePerDay,
        windowLabel,
        windowTimeDays,
        windowCalendarDays,
        totalTimeDays, // Include total time worked for display
      };
    }
    
    // Calculate remaining time to complete
    const actualRemainingDays = totalEstimatedDays - totalTimeDays;
    
    if (actualRemainingDays < 0) {
      return { 
        available: true, 
        alreadyExceeded: true,
        exceededBy: Math.abs(actualRemainingDays),
        windowLabel,
        pacePerDay,
      };
    }
    
    // Calendar days needed at this pace
    const calendarDaysNeeded = actualRemainingDays / pacePerDay;
    
    // Estimated completion date
    const estimatedEndDate = new Date(now.getTime() + calendarDaysNeeded * 24 * 60 * 60 * 1000);
    
    // Calculate projected overage (if any deadline is known from project)
    return {
      available: true,
      alreadyExceeded: false,
      estimatedEndDate,
      calendarDaysNeeded: Math.ceil(calendarDaysNeeded),
      calendarDaysNeededRaw: calendarDaysNeeded,
      actualRemainingDays,
      pacePerDay,
      windowLabel,
      windowTimeDays,
      windowCalendarDays,
    };
  };
  
  // Calculate pace projection - always calculate so we can show work rhythm even without estimations
  const paceProjection = calculatePaceProjection();
  
  // Calculate per-scope-item projections using ITEM-SPECIFIC pace
  // Each item's projection is based on its own work rhythm, not the global pace
  // IMPORTANT: Completed items are EXCLUDED from projections - they only retain historical status
  const calculateScopeItemProjections = () => {
    if (!paceProjection?.available || paceProjection.alreadyExceeded) return [];
    
    // Filter out completed items - they don't participate in projections/alerts
    const openScopeItems = scopeItems.filter(item => !item.completedAt);
    
    return openScopeItems.map(item => {
      const itemTimeSeconds = timeEntries
        .filter(e => e.scopeItemId === item.id)
        .reduce((sum, e) => sum + (e.duration || 0), 0);
      const itemTimeDays = itemTimeSeconds / 3600 / 8;
      const estimatedDays = parseFloat(item.estimatedDays?.toString() || "0");
      
      if (estimatedDays === 0) return { item, projection: null };
      
      const itemRemainingDays = estimatedDays - itemTimeDays;
      const itemConsumption = (itemTimeDays / estimatedDays) * 100;
      
      // If already exceeded
      if (itemRemainingDays <= 0) {
        return {
          item,
          projection: {
            exceeded: true,
            exceededBy: Math.abs(itemRemainingDays),
            consumption: itemConsumption,
          }
        };
      }
      
      // Calculate ITEM-SPECIFIC pace based on this item's own time entries
      const itemEntriesWithDates = timeEntries
        .filter(e => e.scopeItemId === item.id && e.startTime && e.duration && e.duration > 0)
        .map(e => ({ date: new Date(e.startTime!), duration: e.duration || 0 }))
        .sort((a, b) => b.date.getTime() - a.date.getTime());
      
      // Need at least 2 sessions for this item to project reliably
      if (itemEntriesWithDates.length < 2) {
        return {
          item,
          projection: {
            exceeded: false,
            insufficientData: true,
            consumption: itemConsumption,
          }
        };
      }
      
      // Calculate pace based on last 5 sessions for this specific item
      const last5ItemSessions = itemEntriesWithDates.slice(0, 5);
      const itemWindowTimeSeconds = last5ItemSessions.reduce((sum, e) => sum + e.duration, 0);
      const itemWindowTimeDays = itemWindowTimeSeconds / 3600 / 8;
      const oldestItemEntry = last5ItemSessions[last5ItemSessions.length - 1];
      const newestItemEntry = last5ItemSessions[0];
      const itemWindowCalendarDays = Math.max(1, (newestItemEntry.date.getTime() - oldestItemEntry.date.getTime()) / (24 * 60 * 60 * 1000) + 1);
      const itemPacePerDay = itemWindowTimeDays / itemWindowCalendarDays;
      
      // Guard against division by zero or negligible pace
      if (itemPacePerDay <= 0.001) {
        return {
          item,
          projection: {
            exceeded: false,
            insufficientData: true,
            consumption: itemConsumption,
          }
        };
      }
      
      // Project using THIS ITEM's pace, not global pace
      const calendarDaysToExceed = itemRemainingDays / itemPacePerDay;
      const projectedExceedDate = new Date(Date.now() + calendarDaysToExceed * 24 * 60 * 60 * 1000);
      
      // Critical if projected to exceed in < 3 days AND already consumed >50%
      const isCritical = calendarDaysToExceed < 3 && itemConsumption > 50;
      // Warning if projected to exceed in < 7 days AND already consumed >50%
      const isWarning = calendarDaysToExceed < 7 && itemConsumption > 50 && !isCritical;
      
      return {
        item,
        projection: {
          exceeded: false,
          insufficientData: false,
          daysToExceed: Math.ceil(calendarDaysToExceed),
          projectedExceedDate,
          isCritical,
          isWarning,
          consumption: itemConsumption,
          itemPacePerDay,
        }
      };
    }).filter(p => p.projection !== null);
  };
  
  const scopeItemProjections = totalEstimatedDays > 0 ? calculateScopeItemProjections() : [];
  
  // Calculate project-level overage for trajectory status (same logic as KPI)
  const calculateProjectOverage = () => {
    // Sum of already-exceeded items
    const actualOverage = scopeItemProjections.reduce((total, p) => {
      if (p.projection?.exceeded && p.projection.exceededBy) {
        return total + p.projection.exceededBy;
      }
      return total;
    }, 0);
    
    // If project has a deadline, calculate capacity-based projection
    let deadlineBasedOverage = 0;
    const projectEndDate = project?.endDate ? new Date(project.endDate) : null;
    
    if (projectEndDate && paceProjection?.pacePerDay && paceProjection.pacePerDay > 0) {
      const now = new Date();
      const calendarDaysToDeadline = Math.max(0, (projectEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const projectedWorkCapacity = calendarDaysToDeadline * paceProjection.pacePerDay;
      const budgetRemaining = totalEstimatedDays - totalTimeDays;
      
      if (budgetRemaining > projectedWorkCapacity) {
        deadlineBasedOverage = budgetRemaining - projectedWorkCapacity;
      }
    }
    
    return Math.max(actualOverage, deadlineBasedOverage);
  };
  
  const projectedOverage = paceProjection?.available ? calculateProjectOverage() : 0;
  
  // Determine overall trajectory status based on projections AND deadline
  const getTrajectoryStatus = () => {
    if (!paceProjection?.available) return { status: "unknown", label: "Données insuffisantes", color: "text-muted-foreground", bg: "bg-muted" };
    if (paceProjection.alreadyExceeded) return { status: "exceeded", label: "Hors enveloppe", color: "text-red-600", bg: "bg-red-600 dark:bg-red-700" };
    
    // Check deadline-based risk (high overage = critical)
    const overagePercent = totalEstimatedDays > 0 ? (projectedOverage / totalEstimatedDays) * 100 : 0;
    if (overagePercent > 20) return { status: "critical", label: "Risque critique", color: "text-red-600", bg: "bg-red-600 dark:bg-red-700" };
    if (overagePercent > 10) return { status: "warning", label: "Attention requise", color: "text-orange-600", bg: "bg-orange-600 dark:bg-orange-700" };
    
    // Check per-item critical/warning status
    const criticalItems = scopeItemProjections.filter(p => p.projection?.isCritical && !p.projection.exceeded && !p.projection.insufficientData);
    const warningItems = scopeItemProjections.filter(p => p.projection?.isWarning && !p.projection.insufficientData);
    
    if (criticalItems.length > 0) return { status: "critical", label: "Risque critique", color: "text-red-600", bg: "bg-red-600 dark:bg-red-700" };
    if (warningItems.length > 0) return { status: "warning", label: "Attention requise", color: "text-orange-600", bg: "bg-orange-600 dark:bg-orange-700" };
    return { status: "ok", label: "Dans l'enveloppe", color: "text-green-600", bg: "bg-green-600 dark:bg-green-700" };
  };
  
  const trajectoryStatus = getTrajectoryStatus();
  
  // Time status: green <70%, orange 70-90%, red >90%
  const getTimeStatus = () => {
    if (totalEstimatedDays === 0) return { color: "text-muted-foreground", bg: "bg-muted", label: "Non défini" };
    if (consumptionPercent < 70) return { color: "text-green-600 dark:text-green-500", bg: "bg-green-600 dark:bg-green-700", label: "En bonne voie" };
    if (consumptionPercent < 90) return { color: "text-orange-600 dark:text-orange-500", bg: "bg-orange-600 dark:bg-orange-700", label: "Attention" };
    return { color: "text-red-600 dark:text-red-500", bg: "bg-red-600 dark:bg-red-700", label: "Dépassement" };
  };
  const timeStatus = getTimeStatus();

  return (
    <div className="space-y-4">
      {/* Time KPI Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pilotage Temps vs CDC
          </CardTitle>
          <Button
            variant={showAddTimeForm ? "ghost" : "default"}
            size="sm"
            onClick={() => setShowAddTimeForm(!showAddTimeForm)}
            data-testid="button-toggle-add-time"
          >
            {showAddTimeForm ? "Annuler" : <><Plus className="h-4 w-4 mr-2" />Ajouter du temps</>}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Temps passé</p>
              <p className="text-lg font-semibold" data-testid="kpi-time-spent">
                {totalTimeDays.toFixed(1)}j
              </p>
              <p className="text-xs text-muted-foreground">{totalTimeHours.toFixed(1)}h</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Temps prévu (CDC)</p>
              <p className="text-lg font-semibold" data-testid="kpi-time-estimated">
                {totalEstimatedDays > 0 ? `${totalEstimatedDays.toFixed(1)}j` : "—"}
              </p>
              {totalEstimatedDays > 0 && (
                <p className="text-xs text-muted-foreground">{(totalEstimatedDays * 8).toFixed(1)}h</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Temps restant</p>
              <p className={`text-lg font-semibold ${remainingDays < 0 ? "text-red-600" : ""}`} data-testid="kpi-time-remaining">
                {totalEstimatedDays > 0 ? `${remainingDays.toFixed(1)}j` : "—"}
              </p>
              {totalEstimatedDays > 0 && (
                <p className="text-xs text-muted-foreground">{(remainingDays * 8).toFixed(1)}h</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Consommation</p>
              <div className="flex items-center gap-2">
                <p className={`text-lg font-semibold ${timeStatus.color}`} data-testid="kpi-consumption-percent">
                  {totalEstimatedDays > 0 ? `${consumptionPercent.toFixed(0)}%` : "—"}
                </p>
                {totalEstimatedDays > 0 && (
                  <Badge className={timeStatus.bg} data-testid="badge-time-status">
                    {timeStatus.label}
                  </Badge>
                )}
              </div>
              {totalEstimatedDays > 0 && (
                <div className="relative h-2 mt-1">
                  <div className="absolute inset-0 bg-muted rounded-full" />
                  <div 
                    className={cn(
                      "absolute top-0 left-0 h-full rounded-full transition-all",
                      consumptionPercent >= 100 ? "bg-red-600" : consumptionPercent >= 80 ? "bg-amber-500" : "bg-green-600"
                    )}
                    style={{ width: `${Math.min(100, consumptionPercent)}%` }}
                  />
                  {/* Threshold markers - positioned inside the bar */}
                  <div className="absolute top-0 h-full w-0.5 bg-amber-400/80" style={{ left: "80%", transform: "translateX(-50%)" }} />
                  <div className="absolute top-0 h-full w-0.5 bg-red-400/80" style={{ left: "calc(100% - 1px)" }} />
                </div>
              )}
            </div>
          </div>
          
          {/* Contextual status message */}
          {totalEstimatedDays > 0 && (() => {
            const overageDays = totalTimeDays - totalEstimatedDays;
            const actualRemaining = totalEstimatedDays - totalTimeDays;
            
            return (
              <div className={cn(
                "mt-4 p-3 rounded-lg border-l-4 text-sm",
                consumptionPercent >= 100 
                  ? "bg-red-50 dark:bg-red-950/30 border-l-red-500 text-red-800 dark:text-red-200"
                  : consumptionPercent >= 80 
                    ? "bg-amber-50 dark:bg-amber-950/30 border-l-amber-500 text-amber-800 dark:text-amber-200"
                    : "bg-green-50 dark:bg-green-950/30 border-l-green-500 text-green-800 dark:text-green-200"
              )} data-testid="time-status-message">
                <div className="flex items-center gap-2">
                  {consumptionPercent >= 100 ? (
                    <>
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span><strong>Dépassement confirmé</strong> - +{overageDays.toFixed(1)} jours au-delà du budget ({(consumptionPercent - 100).toFixed(0)}% de dépassement). Renégociez le périmètre ou le budget.</span>
                    </>
                  ) : consumptionPercent >= 80 ? (
                    <>
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span><strong>Attention au rythme actuel</strong> - {consumptionPercent.toFixed(0)}% consommé, vigilance requise pour les {actualRemaining.toFixed(1)} jours restants.</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span><strong>Rythme maîtrisé</strong> - {consumptionPercent.toFixed(0)}% consommé, marge confortable de {actualRemaining.toFixed(1)} jours.</span>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
          
          {scopeItems.length === 0 && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Ajoutez des étapes dans l'onglet CDC pour activer le pilotage temps.
            </p>
          )}
          
          {/* Incomplete data signals - subtle warnings */}
          {(() => {
            const signals: { id: string; message: string; icon: JSX.Element }[] = [];
            
            // Check for uncategorized time
            const uncategorizedTime = timeEntries.filter(e => !e.scopeItemId);
            if (uncategorizedTime.length > 0) {
              const uncatHours = uncategorizedTime.reduce((sum, e) => sum + (e.duration || 0), 0) / 3600;
              signals.push({
                id: "uncategorized",
                message: `${uncatHours.toFixed(1)}h non catégorisées (${uncategorizedTime.length} entrées)`,
                icon: <Clock className="h-3 w-3" />
              });
            }
            
            // Check for scope items without estimation
            const scopeWithoutEstimation = scopeItems.filter(item => !item.estimatedDays || parseFloat(item.estimatedDays.toString()) === 0);
            if (scopeWithoutEstimation.length > 0 && scopeItems.length > 0) {
              signals.push({
                id: "no-estimation",
                message: `${scopeWithoutEstimation.length} étape(s) CDC sans estimation`,
                icon: <List className="h-3 w-3" />
              });
            }
            
            // Check for no internal cost defined
            if (!project?.internalDailyCost || project.internalDailyCost === 0) {
              signals.push({
                id: "no-cost",
                message: "Aucun coût journalier défini",
                icon: <Euro className="h-3 w-3" />
              });
            }
            
            // Check for tasks without estimation (if there are tasks)
            const tasksWithoutEstimation = projectTasks.filter(t => !t.estimatedHours || t.estimatedHours === 0);
            if (tasksWithoutEstimation.length > 0 && projectTasks.length > 3) {
              signals.push({
                id: "tasks-no-estimation",
                message: `${tasksWithoutEstimation.length} tâche(s) sans estimation`,
                icon: <CheckCircle2 className="h-3 w-3" />
              });
            }
            
            if (signals.length === 0) return null;
            
            return (
              <div className="mt-3 flex flex-wrap gap-2" data-testid="incomplete-data-signals">
                {signals.map((signal) => (
                  <div
                    key={signal.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-xs"
                    data-testid={`signal-${signal.id}`}
                  >
                    {signal.icon}
                    <span>{signal.message}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          
          {/* Add Time Form - Collapsible */}
          {showAddTimeForm && (
            <div className="mt-4 pt-4 border-t">
              <div className="space-y-4">
                <div className="flex gap-2 mb-2">
                  <Button
                    variant={timeInputMode === 'hours' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeInputMode('hours')}
                    data-testid="button-mode-hours"
                  >
                    Par heures
                  </Button>
                  <Button
                    variant={timeInputMode === 'days' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeInputMode('days')}
                    data-testid="button-mode-days"
                  >
                    Par jours
                  </Button>
                </div>

                {timeInputMode === 'hours' ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm">Heures</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newTimeHours}
                        onChange={(e) => setNewTimeHours(e.target.value)}
                        placeholder="0"
                        data-testid="input-time-hours"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Minutes</Label>
                      <Select
                        value={newTimeMinutes}
                        onValueChange={setNewTimeMinutes}
                      >
                        <SelectTrigger data-testid="select-time-minutes">
                          <SelectValue placeholder="0" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 min</SelectItem>
                          <SelectItem value="15">15 min</SelectItem>
                          <SelectItem value="30">30 min</SelectItem>
                          <SelectItem value="45">45 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Date</Label>
                      <Popover open={isNewTimeDatePickerOpen} onOpenChange={setIsNewTimeDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !newTimeDate && "text-muted-foreground"
                            )}
                            data-testid="button-time-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newTimeDate ? format(newTimeDate, "dd/MM/yyyy", { locale: fr }) : "Sélectionner"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={newTimeDate}
                            onSelect={(date) => {
                              setNewTimeDate(date);
                              setIsNewTimeDatePickerOpen(false);
                            }}
                            initialFocus
                            locale={fr}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Sélectionnez les jours travaillés (1 jour = 8h)</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        {newTimeDates.length} jour{newTimeDates.length !== 1 ? 's' : ''} sélectionné{newTimeDates.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="border rounded-lg p-2">
                      <Calendar
                        mode="multiple"
                        selected={newTimeDates}
                        onSelect={(dates) => setNewTimeDates(dates || [])}
                        locale={fr}
                        className="mx-auto"
                      />
                    </div>
                    {newTimeDates.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {newTimeDates
                          .sort((a, b) => a.getTime() - b.getTime())
                          .map((date, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {format(date, "dd/MM", { locale: fr })}
                            </Badge>
                          ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Optional linking to scope items and tasks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Étape CDC (optionnel)</Label>
                    <Select
                      value={selectedScopeItemId || "none"}
                      onValueChange={(v) => setSelectedScopeItemId(v === "none" ? null : v)}
                    >
                      <SelectTrigger data-testid="select-scope-item">
                        <SelectValue placeholder="Aucune" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {scopeItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Tâche (optionnel)</Label>
                    <Select
                      value={selectedTaskId || "none"}
                      onValueChange={(v) => setSelectedTaskId(v === "none" ? null : v)}
                    >
                      <SelectTrigger data-testid="select-task">
                        <SelectValue placeholder="Aucune" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {projectTasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Sprint selector */}
                {projectSprints.length > 0 && (
                  <div>
                    <Label className="text-sm">Sprint (optionnel)</Label>
                    <Select
                      value={selectedSprintId || "none"}
                      onValueChange={(v) => setSelectedSprintId(v === "none" ? null : v)}
                    >
                      <SelectTrigger data-testid="select-sprint">
                        <SelectValue placeholder="Aucun" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {projectSprints.map((sprint) => (
                          <SelectItem key={sprint.id} value={sprint.id}>
                            {sprint.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div>
                  <Label className="text-sm">Description (optionnel)</Label>
                  <Textarea
                    value={newTimeDescription}
                    onChange={(e) => setNewTimeDescription(e.target.value)}
                    placeholder="Description de la session de travail..."
                    rows={2}
                    data-testid="input-time-description"
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button
                    onClick={async () => {
                      if (timeInputMode === 'hours') {
                        const hours = parseInt(newTimeHours) || 0;
                        const minutes = parseInt(newTimeMinutes) || 0;
                        const totalSeconds = hours * 3600 + minutes * 60;
                        
                        if (totalSeconds <= 0) {
                          toast({
                            title: "Erreur",
                            description: "Veuillez entrer une durée valide",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        if (!newTimeDate) {
                          toast({
                            title: "Erreur",
                            description: "Veuillez sélectionner une date",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        setIsAddingTime(true);
                        try {
                          const startTime = new Date(newTimeDate);
                          startTime.setHours(9, 0, 0, 0);
                          
                          await apiRequest("/api/time-entries/manual", "POST", {
                            projectId,
                            startTime: startTime.toISOString(),
                            endTime: new Date(startTime.getTime() + totalSeconds * 1000).toISOString(),
                            duration: totalSeconds,
                            description: newTimeDescription || null,
                            scopeItemId: selectedScopeItemId || null,
                            taskId: selectedTaskId || null,
                            sprintId: selectedSprintId || null,
                          });
                          
                          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/time-entries`] });
                          queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'profitability'] });
                          
                          setNewTimeHours("");
                          setNewTimeMinutes("0");
                          setNewTimeDescription("");
                          setSelectedScopeItemId(null);
                          setSelectedTaskId(null);
                          setSelectedSprintId(null);
                          setShowAddTimeForm(false);
                          
                          toast({
                            title: "Temps ajouté",
                            description: `${hours}h${minutes > 0 ? ` ${minutes}min` : ""} ajoutés au projet`,
                            variant: "success",
                          });
                        } catch (error: any) {
                          toast({
                            title: "Erreur",
                            description: error.message || "Impossible d'ajouter le temps",
                            variant: "destructive",
                          });
                        } finally {
                          setIsAddingTime(false);
                        }
                      } else {
                        if (newTimeDates.length === 0) {
                          toast({
                            title: "Erreur",
                            description: "Veuillez sélectionner au moins un jour",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        const datesToAdd = [...newTimeDates];
                        const daysCount = datesToAdd.length;
                        
                        setIsAddingTime(true);
                        try {
                          await Promise.all(datesToAdd.map(async (date) => {
                            const startTime = new Date(date);
                            startTime.setHours(9, 0, 0, 0);
                            const daySeconds = 8 * 3600;
                            
                            return apiRequest("/api/time-entries/manual", "POST", {
                              projectId,
                              startTime: startTime.toISOString(),
                              endTime: new Date(startTime.getTime() + daySeconds * 1000).toISOString(),
                              duration: daySeconds,
                              description: newTimeDescription || null,
                              scopeItemId: selectedScopeItemId || null,
                              taskId: selectedTaskId || null,
                              sprintId: selectedSprintId || null,
                            });
                          }));
                          
                          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/time-entries`] });
                          queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'profitability'] });
                          
                          setNewTimeDates([]);
                          setNewTimeDescription("");
                          setSelectedScopeItemId(null);
                          setSelectedTaskId(null);
                          setSelectedSprintId(null);
                          setShowAddTimeForm(false);
                          
                          toast({
                            title: "Temps ajouté",
                            description: `${daysCount} jour${daysCount > 1 ? 's' : ''} (${daysCount * 8}h) ajoutés au projet`,
                            variant: "success",
                          });
                        } catch (error: any) {
                          toast({
                            title: "Erreur",
                            description: error.message || "Impossible d'ajouter le temps",
                            variant: "destructive",
                          });
                        } finally {
                          setIsAddingTime(false);
                        }
                      }
                    }}
                    disabled={isAddingTime}
                    data-testid="button-save-time"
                  >
                    {isAddingTime ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pace Projection Card */}
      {paceProjection && totalEstimatedDays > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Projection "à ce rythme"
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!paceProjection.available ? (
              <p className="text-sm text-muted-foreground" data-testid="text-projection-unavailable">
                {paceProjection.reason}
              </p>
            ) : paceProjection.alreadyExceeded ? (
              <div className="flex items-center gap-3 p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" data-testid="alert-already-exceeded">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">Budget temps déjà dépassé</p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Dépassement de {paceProjection.exceededBy?.toFixed(1)}j
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Fin estimée</p>
                  <p className="text-lg font-semibold" data-testid="text-estimated-end-date">
                    {paceProjection.estimatedEndDate?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dans {paceProjection.calendarDaysNeeded}j calendaire{paceProjection.calendarDaysNeeded > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Rythme actuel</p>
                  <p className="text-lg font-semibold" data-testid="text-current-pace">
                    {(paceProjection.pacePerDay * 8).toFixed(1)}h/j
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Basé sur {paceProjection.windowLabel}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Dépassement projeté</p>
                  {(() => {
                    // Use pre-calculated projectedOverage (same as trajectory status)
                    const overagePercent = totalEstimatedDays > 0 ? (projectedOverage / totalEstimatedDays) * 100 : 0;
                    const isOverBudget = projectedOverage > 0.05;
                    const hasDeadline = !!project?.endDate;
                    
                    return (
                      <>
                        <p className={`text-lg font-semibold ${isOverBudget ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`} data-testid="text-projected-overage">
                          {isOverBudget ? `+${projectedOverage.toFixed(1)}j` : "Aucun"}
                        </p>
                        {isOverBudget ? (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            +{overagePercent.toFixed(0)}% du budget
                          </p>
                        ) : hasDeadline ? (
                          <p className="text-xs text-muted-foreground">
                            Livraison en temps
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Budget temps respecté
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Trajectoire</p>
                  <div className="flex flex-col gap-1">
                    <Badge 
                      className={cn("w-fit", trajectoryStatus.bg)}
                      variant={trajectoryStatus.status === "exceeded" || trajectoryStatus.status === "critical" ? "destructive" : "default"}
                      data-testid="badge-trajectory"
                    >
                      {trajectoryStatus.label}
                    </Badge>
                    {/* Show "Sur X étape(s) localisée(s)" with hover list for critical/warning items */}
                    {(() => {
                      const criticalItems = scopeItemProjections.filter(p => p.projection?.isCritical && !p.projection.exceeded && !p.projection.insufficientData);
                      const warningItems = scopeItemProjections.filter(p => p.projection?.isWarning && !p.projection.insufficientData);
                      const itemsAtRisk = [...criticalItems, ...warningItems.filter(w => !criticalItems.some(c => c.item.id === w.item.id))];
                      
                      if (itemsAtRisk.length === 0) return null;
                      
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs text-red-600 dark:text-red-400 cursor-help underline decoration-dotted">
                              Sur {itemsAtRisk.length} étape{itemsAtRisk.length > 1 ? 's' : ''} localisée{itemsAtRisk.length > 1 ? 's' : ''}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-medium text-xs">Étapes à risque :</p>
                              <ul className="text-xs space-y-0.5">
                                {itemsAtRisk.map(item => (
                                  <li key={item.item.id} className="flex items-center gap-1">
                                    <span className={item.projection?.isCritical ? "text-red-500" : "text-orange-500"}>
                                      {item.projection?.isCritical ? "Critique" : "Attention"}
                                    </span>
                                    <span>- {item.item.label}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {/* Time Recommendations */}
      {scopeItems.length > 0 && totalEstimatedDays > 0 && (() => {
        type Recommendation = {
          id: string;
          horizon: "immediate" | "adjustment" | "learning";
          type: "drift" | "overflow" | "ahead" | "imbalance" | "uncategorized";
          title: string;
          description: string;
          severity: "info" | "warning" | "critical";
        };
        
        const recommendations: Recommendation[] = [];
        
        // Check for drift anticipation (80% consumed)
        if (consumptionPercent >= 80 && consumptionPercent < 100) {
          recommendations.push({
            id: "drift",
            horizon: "immediate",
            type: "drift",
            title: "Anticipation dérive",
            description: `${consumptionPercent.toFixed(0)}% du temps prévu a été consommé. Planifiez les ajustements nécessaires.`,
            severity: "warning",
          });
        }
        
        // Check for imminent overflow (<2 days remaining)
        if (remainingDays < 2 && remainingDays >= 0 && totalEstimatedDays > 0) {
          recommendations.push({
            id: "overflow",
            horizon: "immediate",
            type: "overflow",
            title: "Dépassement imminent",
            description: `Moins de 2 jours restants (${remainingDays.toFixed(1)}j). Action immédiate requise.`,
            severity: "critical",
          });
        }
        
        // Check for overflow (over 100%)
        if (consumptionPercent > 100) {
          recommendations.push({
            id: "overflow-exceeded",
            horizon: "immediate",
            type: "overflow",
            title: "Budget temps dépassé",
            description: `Le temps prévu est dépassé de ${(consumptionPercent - 100).toFixed(0)}%. Renégociez le périmètre ou le budget.`,
            severity: "critical",
          });
        }
        
        // Check for ahead of schedule (<50% consumed with significant progress)
        if (consumptionPercent < 50 && consumptionPercent > 0) {
          recommendations.push({
            id: "ahead",
            horizon: "learning",
            type: "ahead",
            title: "Avance sur planning",
            description: `Seulement ${consumptionPercent.toFixed(0)}% du temps consommé. Documentez les bonnes pratiques.`,
            severity: "info",
          });
        }
        
        // Check for imbalance by scope item (only open items - completed items are frozen)
        const openScopeItems = scopeItems.filter(item => !item.completedAt);
        const imbalancedItems = openScopeItems.filter((item) => {
          const itemTimeSeconds = timeEntries
            .filter(e => e.scopeItemId === item.id)
            .reduce((sum, e) => sum + (e.duration || 0), 0);
          const itemTimeDays = itemTimeSeconds / 3600 / 8;
          const estimatedDays = parseFloat(item.estimatedDays?.toString() || "0");
          if (estimatedDays === 0) return false;
          const itemConsumption = (itemTimeDays / estimatedDays) * 100;
          return itemConsumption > 100;
        });
        
        if (imbalancedItems.length > 0) {
          const isLocalImpact = imbalancedItems.length === 1;
          recommendations.push({
            id: "imbalance",
            horizon: "adjustment",
            type: "imbalance",
            title: isLocalImpact ? "Dépassement étape isolée" : "Déséquilibre sur plusieurs étapes",
            description: isLocalImpact 
              ? `L'étape "${imbalancedItems[0].label}" a dépassé son enveloppe. Impact limité au périmètre de cette rubrique.`
              : `${imbalancedItems.length} étapes ont dépassé leur temps prévu : ${imbalancedItems.map(i => `"${i.label}"`).slice(0, 2).join(", ")}${imbalancedItems.length > 2 ? "..." : ""}`,
            severity: "warning",
          });
        }
        
        // Check for uncategorized time
        const uncategorizedTimeSeconds = timeEntries
          .filter(e => !e.scopeItemId)
          .reduce((sum, e) => sum + (e.duration || 0), 0);
        const uncategorizedTimeDays = uncategorizedTimeSeconds / 3600 / 8;
        const uncategorizedPercent = totalTimeDays > 0 ? (uncategorizedTimeDays / totalTimeDays) * 100 : 0;
        
        if (uncategorizedPercent > 20) {
          recommendations.push({
            id: "uncategorized",
            horizon: "adjustment",
            type: "uncategorized",
            title: "Temps non catégorisé",
            description: `${uncategorizedPercent.toFixed(0)}% du temps n'est pas lié à une étape CDC. Catégorisez pour un meilleur suivi.`,
            severity: "info",
          });
        }
        
        // Pace-based projections recommendations
        if (paceProjection?.available && !paceProjection.alreadyExceeded) {
          // Check for critical scope items (will exceed in < 3 days at this pace)
          // Filter out items with insufficient data to avoid false alarms
          const criticalItems = scopeItemProjections.filter(p => 
            p.projection?.isCritical && !p.projection.exceeded && !p.projection.insufficientData
          );
          if (criticalItems.length > 0) {
            const isLocalRisk = criticalItems.length === 1;
            recommendations.push({
              id: "pace-critical",
              horizon: "immediate",
              type: "drift",
              title: isLocalRisk ? "Alerte critique étape isolée" : "Alertes critiques multiples",
              description: isLocalRisk 
                ? `L'étape "${criticalItems[0].item.label}" dépassera son enveloppe dans moins de 3 jours à ce rythme. Risque localisé.`
                : `${criticalItems.length} étapes en trajectoire critique : ${criticalItems.map(i => `"${i.item.label}"`).slice(0, 2).join(", ")}${criticalItems.length > 2 ? "..." : ""}. Risque global sur le projet.`,
              severity: "critical",
            });
          }
          
          // Check for warning scope items (will exceed in < 7 days at this pace)
          const warningItems = scopeItemProjections.filter(p => 
            p.projection?.isWarning && !p.projection.insufficientData
          );
          if (warningItems.length > 0 && criticalItems.length === 0) {
            const isLocalWarning = warningItems.length === 1;
            recommendations.push({
              id: "pace-warning",
              horizon: "adjustment",
              type: "drift",
              title: isLocalWarning ? "Anticipation étape isolée" : "Anticipation multi-étapes",
              description: isLocalWarning 
                ? `L'étape "${warningItems[0].item.label}" approche de son enveloppe. Impact limité si traité rapidement.`
                : `${warningItems.length} étapes approchent de leur enveloppe : ${warningItems.map(i => `"${i.item.label}"`).slice(0, 2).join(", ")}${warningItems.length > 2 ? "..." : ""}`,
              severity: "warning",
            });
          }
          
          // Good trajectory message if no issues
          const hasIssues = criticalItems.length > 0 || warningItems.length > 0 || imbalancedItems.length > 0 || consumptionPercent >= 80;
          if (!hasIssues && totalTimeDays > 0) {
            recommendations.push({
              id: "pace-good",
              horizon: "learning",
              type: "ahead",
              title: "Bonne trajectoire",
              description: `À ce rythme (${(paceProjection.pacePerDay * 8).toFixed(1)}h/j), le projet reste dans l'enveloppe prévue. Fin estimée: ${paceProjection.estimatedEndDate?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}.`,
              severity: "info",
            });
          }
        }
        
        if (recommendations.length === 0) return null;
        
        const getSeverityStyles = (severity: Recommendation["severity"]) => {
          switch (severity) {
            case "critical": return "border-red-500 bg-red-50 dark:bg-red-950/30";
            case "warning": return "border-orange-500 bg-orange-50 dark:bg-orange-950/30";
            case "info": return "border-blue-500 bg-blue-50 dark:bg-blue-950/30";
          }
        };
        
        const getHorizonLabel = (horizon: Recommendation["horizon"]) => {
          switch (horizon) {
            case "immediate": return "Action immédiate";
            case "adjustment": return "Ajustement";
            case "learning": return "Apprentissage";
          }
        };
        
        const getHorizonStyles = (horizon: Recommendation["horizon"]) => {
          switch (horizon) {
            case "immediate": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
            case "adjustment": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
            case "learning": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
          }
        };
        
        // Enhanced recommendations with guided actions
        type ActionInfo = {
          label: string;
          action: () => void;
          why?: string; // Explanation of why this action is suggested
          prefillData?: Record<string, any>; // Data to prefill in forms
        };

        const getActionForRecommendation = (rec: Recommendation): ActionInfo | null => {
          switch (rec.type) {
            case "overflow": 
              return { 
                label: "Renégocier", 
                action: () => {
                  toast({
                    title: "Action suggérée",
                    description: "Contactez le client pour renégocier le périmètre ou le budget du projet.",
                    variant: "default",
                  });
                },
                why: "Le temps prévu est dépassé. Une discussion avec le client est nécessaire pour ajuster le périmètre ou le budget.",
              };
            case "drift": 
              return { 
                label: "Catégoriser le temps", 
                action: () => setShowAddTimeForm(true),
                why: "Du temps non catégorisé rend difficile le suivi de l'avancement par étape CDC.",
              };
            case "imbalance":
              return {
                label: "Revoir les estimations",
                action: () => {
                  toast({
                    title: "Étapes déséquilibrées",
                    description: "Certaines étapes ont dépassé leur enveloppe. Révisez les estimations pour les prochains projets similaires.",
                    variant: "default",
                  });
                },
                why: "Des étapes ont consommé plus de temps que prévu. Ajustez les estimations futures.",
              };
            case "uncategorized":
              return {
                label: "Catégoriser",
                action: () => setShowAddTimeForm(true),
                why: `${(timeEntries.filter(e => !e.scopeItemId).reduce((s, e) => s + (e.duration || 0), 0) / 3600).toFixed(1)}h de temps ne sont pas liées à une étape CDC.`,
              };
            case "ahead": 
              return null;
            default: 
              return null;
          }
        };

        const getImpactForRecommendation = (rec: Recommendation) => {
          switch (rec.type) {
            case "overflow":
              return `Dépassement de ${(consumptionPercent - 100).toFixed(0)}% du budget temps`;
            case "drift":
              return `Risque de dépassement de ${remainingDays.toFixed(1)} jours`;
            case "imbalance":
              return `Temps non prévu sur certaines étapes`;
            case "uncategorized":
              return `Temps non catégorisé à risque`;
            default:
              return null;
          }
        };

        return (
          <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Recommandations temps
                <Badge variant="outline" className="ml-auto bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300">
                  {recommendations.length} alerte{recommendations.length > 1 ? "s" : ""}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.map((rec) => {
                  const actionInfo = getActionForRecommendation(rec);
                  const impact = getImpactForRecommendation(rec);
                  
                  return (
                    <div
                      key={rec.id}
                      className={cn(
                        "border-l-4 p-4 rounded-r-lg",
                        getSeverityStyles(rec.severity)
                      )}
                      data-testid={`recommendation-${rec.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={`text-xs ${getHorizonStyles(rec.horizon)}`}>
                              {getHorizonLabel(rec.horizon)}
                            </Badge>
                            <span className="font-semibold text-xs">{rec.title}</span>
                          </div>
                          <p className="text-xs">{rec.description}</p>
                          {impact && rec.severity !== "info" && (
                            <p className="text-xs mt-2 font-medium text-muted-foreground flex items-center gap-1">
                              <TrendingDown className="h-3 w-3" />
                              Impact: {impact}
                            </p>
                          )}
                          {actionInfo?.why && (
                            <p className="text-xs mt-2 italic text-muted-foreground border-l-2 border-muted-foreground/30 pl-2">
                              Pourquoi : {actionInfo.why}
                            </p>
                          )}
                        </div>
                        {actionInfo && (
                          <Button 
                            size="sm" 
                            variant="default"
                            className="shrink-0"
                            onClick={actionInfo.action}
                            data-testid={`action-${rec.id}`}
                          >
                            {actionInfo.label}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Synthesis phrase - global project status assessment */}
              {(() => {
                const criticalCount = recommendations.filter(r => r.severity === "critical").length;
                const warningCount = recommendations.filter(r => r.severity === "warning").length;
                const totalOpenItems = openScopeItems.length;
                
                // Deduplicate issue counting using a Set of item IDs
                const itemsWithIssuesSet = new Set<string>();
                imbalancedItems.forEach(item => itemsWithIssuesSet.add(item.id));
                scopeItemProjections
                  .filter(p => p.projection?.isCritical || p.projection?.isWarning)
                  .forEach(p => itemsWithIssuesSet.add(p.item.id));
                const itemsWithIssues = itemsWithIssuesSet.size;
                
                // Determine synthesis message (no emoji per design guidelines)
                let synthesisMessage = "";
                let synthesisColor = "";
                
                if (criticalCount === 0 && warningCount === 0) {
                  synthesisMessage = "Projet globalement maîtrisé. Aucune alerte majeure en cours.";
                  synthesisColor = "text-green-700 dark:text-green-400";
                } else if (criticalCount === 0 && warningCount > 0 && itemsWithIssues <= 1) {
                  synthesisMessage = `Projet sous contrôle malgré ${warningCount} alerte(s) locale(s). L'impact reste limité.`;
                  synthesisColor = "text-amber-700 dark:text-amber-400";
                } else if (criticalCount > 0 && itemsWithIssues <= 2) {
                  synthesisMessage = `Attention requise sur ${itemsWithIssues} étape(s). Le reste du projet reste dans l'enveloppe.`;
                  synthesisColor = "text-orange-700 dark:text-orange-400";
                } else if (criticalCount > 0 || warningCount > 2) {
                  synthesisMessage = `Risque global : ${itemsWithIssues} étapes sur ${totalOpenItems} présentent des alertes. Réévaluation recommandée.`;
                  synthesisColor = "text-red-700 dark:text-red-400";
                }
                
                if (!synthesisMessage) return null;
                
                return (
                  <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-800">
                    <p className={cn("text-xs font-medium", synthesisColor)} data-testid="recommendation-synthesis">
                      {synthesisMessage}
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        );
      })()}

      {/* Time by Scope Item (CDC) Table - Collapsible */}
      {scopeItems.length > 0 && (
        <ScopeItemTimeTable 
          scopeItems={scopeItems}
          timeEntries={timeEntries}
          paceProjection={paceProjection}
          scopeItemProjections={scopeItemProjections}
          isExpanded={isTimePerCdcExpanded}
          onToggle={setIsTimePerCdcExpanded}
        />
      )}

      {/* Time Entries List - Collapsible */}
      <Collapsible open={isTimeSessionsExpanded} onOpenChange={setIsTimeSessionsExpanded}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  Sessions de temps
                  <Badge variant="outline" className="text-xs">{timeEntries.length}</Badge>
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform", isTimeSessionsExpanded && "rotate-180")} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {timeEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Aucune session de temps enregistrée pour ce projet.
                </div>
              ) : (
                <div className="space-y-2">
                  {timeEntries.map((entry) => {
                    const user = users.find((u) => u.id === entry.userId);
                    const scopeItem = entry.scopeItemId ? scopeItems.find((s) => s.id === entry.scopeItemId) : null;
                    const task = entry.taskId ? projectTasks.find((t) => t.id === entry.taskId) : null;
                    const sprint = entry.sprintId ? projectSprints.find((s) => s.id === entry.sprintId) : null;
                    return (
                      <div
                        key={entry.id}
                        className="p-3 border rounded-md hover-elevate"
                        data-testid={`time-entry-${entry.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {format(new Date(entry.startTime), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                              </span>
                            </div>
                            {entry.description && (
                              <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
                            )}
                            <div className="flex items-center flex-wrap gap-2 mt-2">
                              {user && (
                                <Badge variant="outline" className="text-xs">
                                  <User className="h-3 w-3 mr-1" />
                                  {user.firstName} {user.lastName}
                                </Badge>
                              )}
                              {scopeItem && (() => {
                                const SCOPE_BADGE_COLORS: Record<string, string> = {
                                  functional:    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200 border-violet-200 dark:border-violet-800",
                                  technical:     "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800",
                                  design:        "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200 border-pink-200 dark:border-pink-800",
                                  gestion:       "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-200 dark:border-amber-800",
                                  strategy:      "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 border-purple-200 dark:border-purple-800",
                                  discovery:     "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800",
                                  delivery:      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
                                  devops:        "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 border-orange-200 dark:border-orange-800",
                                  communication: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 border-sky-200 dark:border-sky-800",
                                  gtm:           "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200 border-lime-200 dark:border-lime-800",
                                  autre:         "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300 border-gray-200 dark:border-gray-700",
                                };
                                const colorClass = SCOPE_BADGE_COLORS[(scopeItem as any).scopeType] || SCOPE_BADGE_COLORS.autre;
                                return (
                                  <Badge 
                                    className={cn("text-xs cursor-pointer border", colorClass)}
                                    onClick={() => {
                                      const element = document.getElementById('scope-section');
                                      if (element) element.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    data-testid={`badge-scope-${entry.id}`}
                                  >
                                    <FileText className="h-3 w-3 mr-1" />
                                    {scopeItem.label}
                                  </Badge>
                                );
                              })()}
                              {task && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs cursor-pointer"
                                  onClick={() => {
                                    const element = document.getElementById('tasks-section');
                                    if (element) element.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                  data-testid={`badge-task-${entry.id}`}
                                >
                                  <ListTodo className="h-3 w-3 mr-1" />
                                  {task.title}
                                </Badge>
                              )}
                              {sprint && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs"
                                  data-testid={`badge-sprint-${entry.id}`}
                                >
                                  <Layers className="h-3 w-3 mr-1" />
                                  {sprint.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="secondary" data-testid={`duration-${entry.id}`}>
                              {entry.duration ? formatDuration(entry.duration) : "En cours"}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditSheet(entry)}
                                data-testid={`button-edit-${entry.id}`}
                                className="h-8 w-8"
                              >
                                <Edit className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteEntryId(entry.id)}
                                data-testid={`button-delete-${entry.id}`}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEntryId} onOpenChange={(open) => !open && setDeleteEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette session ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La session de temps sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEntryId && deleteMutation.mutate(deleteEntryId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Time Entry Sheet */}
      <Sheet open={!!editingTimeEntry} onOpenChange={(open) => !open && setEditingTimeEntry(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Modifier la session de temps</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="edit-time-date">Date</Label>
              <Popover open={isEditTimeDatePickerOpen} onOpenChange={setIsEditTimeDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editTimeDate && "text-muted-foreground"
                    )}
                    data-testid="button-edit-time-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editTimeDate ? format(editTimeDate, "dd MMMM yyyy", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editTimeDate}
                    onSelect={(date) => {
                      setEditTimeDate(date);
                      setIsEditTimeDatePickerOpen(false);
                    }}
                    locale={fr}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-time-hours">Heures</Label>
                <Input
                  id="edit-time-hours"
                  type="number"
                  min="0"
                  value={editTimeHours}
                  onChange={(e) => setEditTimeHours(e.target.value)}
                  placeholder="0"
                  data-testid="input-edit-time-hours"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-time-minutes">Minutes</Label>
                <Input
                  id="edit-time-minutes"
                  type="number"
                  min="0"
                  max="59"
                  value={editTimeMinutes}
                  onChange={(e) => setEditTimeMinutes(e.target.value)}
                  placeholder="0"
                  data-testid="input-edit-time-minutes"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-time-description">Description (optionnel)</Label>
              <Textarea
                id="edit-time-description"
                value={editTimeDescription}
                onChange={(e) => setEditTimeDescription(e.target.value)}
                placeholder="Description de la session..."
                rows={3}
                data-testid="textarea-edit-time-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Étape CDC (optionnel)</Label>
              <Select
                value={editScopeItemId || "none"}
                onValueChange={(value) => setEditScopeItemId(value === "none" ? null : value)}
              >
                <SelectTrigger data-testid="select-edit-scope-item">
                  <SelectValue placeholder="Sélectionner une étape..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {scopeItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tâche (optionnel)</Label>
              <Select
                value={editTaskId || "none"}
                onValueChange={(value) => setEditTaskId(value === "none" ? null : value)}
              >
                <SelectTrigger data-testid="select-edit-task">
                  <SelectValue placeholder="Sélectionner une tâche..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {projectTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {projectSprints.length > 0 && (
              <div className="space-y-2">
                <Label>Sprint (optionnel)</Label>
                <Select
                  value={editSprintId || "none"}
                  onValueChange={(value) => setEditSprintId(value === "none" ? null : value)}
                >
                  <SelectTrigger data-testid="select-edit-sprint">
                    <SelectValue placeholder="Sélectionner un sprint..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {projectSprints.map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingTimeEntry(null)}
                className="flex-1"
                data-testid="button-cancel-edit-time"
              >
                Annuler
              </Button>
              <Button
                onClick={handleSaveEditedTimeEntry}
                disabled={updateTimeEntryMutation.isPending}
                className="flex-1"
                data-testid="button-save-edit-time"
              >
                {updateTimeEntryMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Helper functions for ticket display - defined outside component to avoid recreating
const getTicketPriorityColor = (priority: string | null) => {
  switch (priority) {
    case "critique": return "text-red-600 dark:text-red-400";
    case "haute": return "text-orange-500 dark:text-orange-400";
    case "moyenne": return "text-yellow-500 dark:text-yellow-400";
    case "basse": return "text-blue-500 dark:text-blue-400";
    default: return "text-gray-400";
  }
};

const getTicketStateStyle = (state: string) => {
  switch (state) {
    case "a_faire": return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
    case "en_cours": return "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300";
    case "review": return "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300";
    case "termine": return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300";
    default: return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
  }
};

// Component to display a backlog row with expandable ticket list
interface BacklogRowWithTicketsProps {
  backlog: {
    id: string;
    name: string;
    description: string | null;
    mode: string;
    createdAt: string;
    activeSprint?: { id: string; name: string } | null;
  };
  isExpanded: boolean;
  onToggle: () => void;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  totalTickets: number;
  creatorName: string | null;
  modeLabel: string;
  navigate: (path: string) => void;
}

function BacklogRowWithTickets({
  backlog, isExpanded, onToggle, todoCount, inProgressCount, doneCount, totalTickets,
  creatorName, modeLabel, navigate
}: BacklogRowWithTicketsProps) {
  // Fetch full backlog data with tickets only when expanded
  const { data: backlogData, isLoading: ticketsLoading } = useQuery<{
    epics: Epic[];
    userStories: UserStory[];
    backlogTasks: BacklogTask[];
  }>({
    queryKey: ['/api/backlogs', backlog.id],
    enabled: isExpanded,
  });
  
  // Transform tickets to flat list with type info
  const allTickets = useMemo(() => {
    if (!backlogData) return [];
    const tickets: Array<{
      id: string;
      type: 'epic' | 'user_story' | 'task';
      title: string;
      state: string;
      priority: string | null;
      estimatePoints: number | null;
    }> = [];
    
    backlogData.epics?.forEach(epic => {
      tickets.push({
        id: epic.id,
        type: 'epic',
        title: epic.title,
        state: epic.state,
        priority: epic.priority,
        estimatePoints: null,
      });
    });
    
    backlogData.userStories?.forEach(story => {
      tickets.push({
        id: story.id,
        type: 'user_story',
        title: story.title,
        state: story.state,
        priority: story.priority,
        estimatePoints: story.estimatePoints,
      });
    });
    
    backlogData.backlogTasks?.forEach(task => {
      tickets.push({
        id: task.id,
        type: 'task',
        title: task.title,
        state: task.state,
        priority: task.priority,
        estimatePoints: task.estimatePoints,
      });
    });
    
    return tickets;
  }, [backlogData]);

  const getStateLabel = (state: string) => {
    const option = backlogItemStateOptions.find(o => o.value === state);
    return option?.label || state;
  };

  // Mode icon component to avoid recreating on each render
  const modeIcon = backlog.mode === "kanban" ? <Kanban className="h-3 w-3" /> : <LayoutGrid className="h-3 w-3" />;

  // Handle row click - navigate only if clicking directly on the row, not on buttons
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    // Check if the click target is an interactive element
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button') || 
                          target.closest('a') || 
                          target.tagName === 'BUTTON' || 
                          target.tagName === 'A';
    if (!isInteractive) {
      navigate(`/product/backlog/${backlog.id}`);
    }
  };

  return (
    <>
      {/* Main backlog row - clicking non-interactive areas navigates to backlog detail */}
      <tr 
        className="hover:bg-muted/30 cursor-pointer"
        onClick={handleRowClick}
        data-testid={`row-backlog-${backlog.id}`}
      >
        <td className="px-2 py-3">
          {totalTickets > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              data-testid={`button-toggle-backlog-${backlog.id}`}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium" data-testid={`title-backlog-${backlog.id}`}>{backlog.name}</span>
            {backlog.description && (
              <span className="text-xs text-muted-foreground line-clamp-1">{backlog.description}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 hidden sm:table-cell">
          <Badge variant="secondary" className="flex items-center gap-1 w-fit text-xs">
            {modeIcon}
            {modeLabel}
          </Badge>
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          {backlog.activeSprint ? (
            <Badge className="bg-violet-500 text-white flex items-center gap-1 w-fit text-xs">
              <Play className="h-3 w-3" />
              {backlog.activeSprint.name}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          {totalTickets > 0 ? (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs px-1.5">
                {todoCount}
              </Badge>
              <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs px-1.5">
                {inProgressCount}
              </Badge>
              <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs px-1.5">
                {doneCount}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">0</span>
          )}
        </td>
        <td className="px-4 py-3 hidden xl:table-cell">
          {creatorName ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{creatorName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          {backlog.createdAt && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(backlog.createdAt), "d MMM yyyy", { locale: fr })}
            </div>
          )}
        </td>
        <td className="px-2 py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/product/backlog/${backlog.id}`);
            }}
            data-testid={`button-open-backlog-${backlog.id}`}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </td>
      </tr>
      
      {/* Expanded ticket rows */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="bg-muted/20 border-t">
              {ticketsLoading ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  Chargement des tickets...
                </div>
              ) : allTickets.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  Aucun ticket dans ce backlog
                </div>
              ) : (
                <div className="divide-y">
                  {allTickets.map((ticket) => {
                    const typeIcon = ticket.type === 'epic' 
                      ? <Layers className="h-3 w-3 text-violet-500" />
                      : ticket.type === 'user_story'
                        ? <ListTodo className="h-3 w-3 text-blue-500" />
                        : <Check className="h-3 w-3 text-green-500" />;
                    
                    return (
                      <div 
                        key={ticket.id}
                        className="px-6 py-2 hover:bg-muted/40 cursor-pointer flex items-center gap-3"
                        onClick={() => navigate(`/product/backlog/${backlog.id}?ticket=${ticket.id}`)}
                        data-testid={`ticket-row-${ticket.id}`}
                      >
                        <div className="w-5 flex justify-center">
                          {typeIcon}
                        </div>
                        <span className="text-sm flex-1 truncate">{ticket.title}</span>
                        <div className="flex items-center gap-2">
                          {ticket.priority && (
                            <Flag className={cn("h-3 w-3", getTicketPriorityColor(ticket.priority))} />
                          )}
                          {ticket.estimatePoints && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {ticket.estimatePoints}
                            </Badge>
                          )}
                          <Badge variant="outline" className={cn("text-[10px] px-1.5", getTicketStateStyle(ticket.state))}>
                            {getStateLabel(ticket.state)}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// CDC Scope Item Time Table with completion functionality
interface ScopeItemTimeTableProps {
  scopeItems: ProjectScopeItem[];
  timeEntries: TimeEntry[];
  paceProjection: { available: boolean; alreadyExceeded: boolean } | null;
  scopeItemProjections: { item: ProjectScopeItem; projection: any }[];
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

function ScopeItemTimeTable({ scopeItems, timeEntries, paceProjection, scopeItemProjections, isExpanded = true, onToggle }: ScopeItemTimeTableProps) {
  const { toast } = useToast();
  const [confirmCompleteItem, setConfirmCompleteItem] = useState<ProjectScopeItem | null>(null);
  
  // Mutation to complete a scope item
  const completeMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest(`/api/scope-items/${itemId}/complete`, "POST");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ 
        title: "Rubrique terminée", 
        description: "La rubrique a été marquée comme terminée.",
        className: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
      });
      setConfirmCompleteItem(null);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
  
  // Mutation to reopen a scope item
  const reopenMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest(`/api/scope-items/${itemId}/reopen`, "POST");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Rubrique rouverte", description: "La rubrique est de nouveau active." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
  
  const handleComplete = (item: ProjectScopeItem, isCritical: boolean) => {
    if (isCritical) {
      setConfirmCompleteItem(item);
    } else {
      completeMutation.mutate(item.id);
    }
  };
  
  const handleReopen = (item: ProjectScopeItem) => {
    reopenMutation.mutate(item.id);
  };
  
  // Count completed items for the explanatory text
  const completedCount = scopeItems.filter(item => item.completedAt).length;
  
  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Temps par étape CDC
                  <Badge variant="outline" className="text-xs">{scopeItems.length}</Badge>
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Étape</th>
                      <th className="text-right py-2 px-2 font-medium">Prévu</th>
                      <th className="text-right py-2 px-2 font-medium">Passé</th>
                      <th className="text-right py-2 px-2 font-medium">Écart</th>
                      <th className="text-right py-2 px-2 font-medium">Statut</th>
                      {paceProjection?.available && !paceProjection.alreadyExceeded && (
                        <th className="text-right py-2 px-2 font-medium">Projection</th>
                      )}
                      <th className="text-right py-2 px-2 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                {scopeItems.map((item) => {
                  const itemTimeSeconds = timeEntries
                    .filter(e => e.scopeItemId === item.id)
                    .reduce((sum, e) => sum + (e.duration || 0), 0);
                  const itemTimeDays = itemTimeSeconds / 3600 / 8;
                  const estimatedDays = parseFloat(item.estimatedDays?.toString() || "0");
                  const ecart = itemTimeDays - estimatedDays;
                  const consumptionPct = estimatedDays > 0 ? (itemTimeDays / estimatedDays) * 100 : 0;
                  const isCompleted = !!item.completedAt;
                  const hasExceeded = ecart > 0;
                  
                  // Get projection for this item (only for non-completed items)
                  const itemProjection = isCompleted ? null : scopeItemProjections.find(p => p.item.id === item.id)?.projection;
                  
                  // Get item status following the piloting logic:
                  // - Completed items: OK (vert) if actual ≤ estimated, Dépassé (orange) if actual > estimated
                  // - Open items: OK (vert) if on track, Critique (rouge) if projection shows risk
                  const getItemStatus = () => {
                    if (isCompleted) {
                      // For completed items: status is frozen based on final actual vs estimated
                      return hasExceeded
                        ? { label: "Dépassé", badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" }
                        : { label: "OK", badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
                    }
                    // For open items: dynamic status based on trajectory
                    if (estimatedDays === 0) return { label: "—", badge: "" };
                    // Check if projection shows critical risk
                    const projectionIsCritical = itemProjection?.isCritical || itemProjection?.exceeded;
                    if (projectionIsCritical) {
                      return { label: "Critique", badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
                    }
                    // Otherwise, OK if within budget
                    return { label: "OK", badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
                  };
                  const itemStatus = getItemStatus();
                  const isCritical = itemStatus.label === "Critique";
                  
                  return (
                    <tr 
                      key={item.id} 
                      className={cn(
                        "border-b last:border-b-0",
                        isCompleted && (hasExceeded 
                          ? "bg-red-50 dark:bg-red-900/20" 
                          : "bg-green-50 dark:bg-green-900/20"
                        )
                      )}
                      data-testid={`row-scope-item-${item.id}`}
                    >
                      <td className="py-2 px-2">
                        <span className={isCompleted ? "text-muted-foreground" : ""}>{item.label}</span>
                      </td>
                      <td className={cn("text-right py-2 px-2", isCompleted && "text-muted-foreground")}>
                        {estimatedDays > 0 ? `${estimatedDays.toFixed(1)}j` : "—"}
                      </td>
                      <td className={cn("text-right py-2 px-2", isCompleted && "text-muted-foreground")}>
                        {itemTimeDays.toFixed(1)}j
                      </td>
                      <td className={cn(
                        "text-right py-2 px-2",
                        isCompleted ? "text-muted-foreground" : (ecart > 0 ? "text-red-600 dark:text-red-500" : ecart < 0 ? "text-green-600 dark:text-green-500" : "")
                      )}>
                        {estimatedDays > 0 ? `${ecart >= 0 ? "+" : ""}${ecart.toFixed(1)}j` : "—"}
                      </td>
                      <td className="text-right py-2 px-2">
                        {itemStatus.badge ? (
                          <Badge className={cn("text-[10px] px-1.5 py-0.5", itemStatus.badge)} data-testid={`badge-status-${item.id}`}>
                            {itemStatus.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{itemStatus.label}</span>
                        )}
                      </td>
                      {paceProjection?.available && !paceProjection.alreadyExceeded && (
                        <td className="text-right py-2 px-2">
                          {isCompleted ? (
                            <span className="text-muted-foreground">—</span>
                          ) : itemProjection ? (
                            itemProjection.exceeded ? (
                              <span className="text-red-600 dark:text-red-500" data-testid={`projection-exceeded-${item.id}`}>
                                Dépassé
                              </span>
                            ) : itemProjection.insufficientData ? (
                              <span className="text-muted-foreground" data-testid={`projection-insufficient-${item.id}`}>
                                —
                              </span>
                            ) : (
                              <span 
                                className={
                                  itemProjection.isCritical 
                                    ? "text-red-600 dark:text-red-500" 
                                    : itemProjection.isWarning 
                                      ? "text-orange-600 dark:text-orange-500" 
                                      : "text-muted-foreground"
                                }
                                data-testid={`projection-days-${item.id}`}
                              >
                                {itemProjection.daysToExceed}j
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      <td className="text-right py-2 px-2">
                        {isCompleted ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-white dark:hover:bg-gray-800"
                                onClick={() => handleReopen(item)}
                                disabled={reopenMutation.isPending}
                                data-testid={`button-reopen-${item.id}`}
                              >
                                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Rouvrir la rubrique</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-white dark:hover:bg-gray-800"
                                onClick={() => handleComplete(item, isCritical)}
                                disabled={completeMutation.isPending}
                                data-testid={`button-complete-${item.id}`}
                              >
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Marquer comme terminée</TooltipContent>
                          </Tooltip>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Uncategorized time row */}
                {(() => {
                  const uncategorizedTimeSeconds = timeEntries
                    .filter(e => !e.scopeItemId)
                    .reduce((sum, e) => sum + (e.duration || 0), 0);
                  const uncategorizedTimeDays = uncategorizedTimeSeconds / 3600 / 8;
                  
                  if (uncategorizedTimeDays > 0) {
                    return (
                      <tr className="border-t bg-muted/30" data-testid="row-uncategorized-time">
                        <td className="py-2 px-2 italic text-muted-foreground">Non catégorisé</td>
                        <td className="text-right py-2 px-2">—</td>
                        <td className="text-right py-2 px-2">{uncategorizedTimeDays.toFixed(1)}j</td>
                        <td className="text-right py-2 px-2">—</td>
                        <td className="text-right py-2 px-2 text-muted-foreground">—</td>
                        {paceProjection?.available && !paceProjection.alreadyExceeded && (
                          <td className="text-right py-2 px-2 text-muted-foreground">—</td>
                        )}
                        <td></td>
                      </tr>
                    );
                  }
                  return null;
                })()}
              </tbody>
            </table>
          </div>
          
              {/* Explanatory micro-text */}
              <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">
                Le statut indique la trajectoire réelle de chaque étape : OK (dans les temps), Critique (risque en cours) ou Dépassé (hors budget temps).
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      
      {/* Confirmation dialog for completing critical items */}
      <AlertDialog open={!!confirmCompleteItem} onOpenChange={(open) => !open && setConfirmCompleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la clôture</AlertDialogTitle>
            <AlertDialogDescription>
              Cette rubrique est actuellement en statut <strong>Critique</strong>. Êtes-vous sûr de vouloir la marquer comme terminée ?
              <br /><br />
              Une fois terminée, elle ne générera plus d'alertes prédictives et son statut sera figé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmCompleteItem && completeMutation.mutate(confirmCompleteItem.id)}
              disabled={completeMutation.isPending}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const navigate = (path: string) => setLocation(path);
  const { toast } = useToast();
  const { t } = useLanguage();
  const getBillingStatusI18nLabel = (key: string | null | undefined): string => {
    if (!key) return (t.projects.billingStatus as Record<string, string>).brouillon;
    return (t.projects.billingStatus as Record<string, string>)[key] || key;
  };
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { hasFeature } = useBilling();
  const { visibleStages: projectStages, getLabel: getStageLabel, getColor: getStageColor } = useProjectStagesUI();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBillingStatusPopoverOpen, setIsBillingStatusPopoverOpen] = useState(false);
  const [isCdcWizardOpen, setIsCdcWizardOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openCdc') === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }
    return false;
  });
  const [isBillingSettingsOpen, setIsBillingSettingsOpen] = useState(false);
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const [isAiAnalysisOpen, setIsAiAnalysisOpen] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [isAiAnalysisLoading, setIsAiAnalysisLoading] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);
  
  // Expansion panel states (collapsed by default)
  const [isCdcSectionExpanded, setIsCdcSectionExpanded] = useState(false);
  const [isTaskDetailDialogOpen, setIsTaskDetailDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState(false);
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

  // Billing fields state
  const [totalBilledValue, setTotalBilledValue] = useState<string>("");
  const [billingRateValue, setBillingRateValue] = useState<string>("");
  const [numberOfDaysValue, setNumberOfDaysValue] = useState<string>("");
  // Track if numberOfDays is manually overridden (not auto-synced from CDC)
  // Default to true (locked/manual mode) - user must explicitly unlock to auto-sync
  const [isNumberOfDaysOverridden, setIsNumberOfDaysOverridden] = useState<boolean>(true);
  // Deposit & end-of-month payment settings
  const [depositPctValue, setDepositPctValue] = useState<string>("30");
  const [depositAmtValue, setDepositAmtValue] = useState<string>("");
  const [paymentEndOfMonth, setPaymentEndOfMonth] = useState<boolean>(false);

  // Payment tracking state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentDescription, setPaymentDescription] = useState<string>("");
  const [isPeriodStartPickerOpen, setIsPeriodStartPickerOpen] = useState(false);
  const [isPeriodEndPickerOpen, setIsPeriodEndPickerOpen] = useState(false);
  const [isPaymentDatePickerOpen, setIsPaymentDatePickerOpen] = useState(false);
  // Partial payments state
  const [isPartialPayments, setIsPartialPayments] = useState(false);
  const [installments, setInstallments] = useState<{ amount: string; date: Date | undefined; pickerOpen: boolean }[]>([
    { amount: "", date: new Date(), pickerOpen: false }
  ]);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  // Payment editing state
  const [editingPayment, setEditingPayment] = useState<ProjectPayment | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState<string>("");
  const [editPaymentDate, setEditPaymentDate] = useState<Date | undefined>(undefined);
  const [editPaymentDescription, setEditPaymentDescription] = useState<string>("");
  const [isEditPaymentDatePickerOpen, setIsEditPaymentDatePickerOpen] = useState(false);
  
  // Expanded backlogs state for showing tickets
  const [expandedBacklogs, setExpandedBacklogs] = useState<Set<string>>(new Set());

  // Activity management state
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null);
  const [isDeleteActivityDialogOpen, setIsDeleteActivityDialogOpen] = useState(false);
  const [activityFormData, setActivityFormData] = useState({
    kind: "custom" as string,
    description: "",
    occurredAt: "",
    occurredAtTime: format(new Date(), "HH:mm"),
  });
  const [isActivityDatePickerOpen, setIsActivityDatePickerOpen] = useState(false);
  const [activitiesDisplayCount, setActivitiesDisplayCount] = useState(5);

  // Project document import state
  const projectImportRef = useRef<HTMLInputElement>(null);
  const [uploadingProjectFiles, setUploadingProjectFiles] = useState(false);
  const [previewProjectFile, setPreviewProjectFile] = useState<{ name: string; url: string; mimeType: string } | null>(null);
  const [renamingProjectFileId, setRenamingProjectFileId] = useState<string | null>(null);
  const [renameProjectFileName, setRenameProjectFileName] = useState("");
  
  // Tab state for controlled navigation
  const [activeTab, setActiveTab] = useState("overview");
  // Overview "voir plus" expanded sections
  const [overviewExpanded, setOverviewExpanded] = useState<Record<string, boolean>>({});
  const searchString = useSearch();
  
  // Read tab parameter from URL
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tabParam = params.get('tab');
    const validTabs = ['activities', 'billing', 'time', 'tasks', 'notes', 'documents', 'backlogs', 'roadmap'];
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchString]);
  
  // Analysis drawer state
  const [showAnalysisDrawer, setShowAnalysisDrawer] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery<ProjectWithRelations>({
    queryKey: ['/api/projects', id],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ['/api/users'],
  });

  const { data: columns = [] } = useQuery<TaskColumn[]>({
    queryKey: ['/api/projects', id, 'task-columns'],
    enabled: !!id,
  });

  const { data: projectNotes = [] } = useQuery<Note[]>({
    queryKey: ['/api/projects', id, 'notes'],
    enabled: !!id,
  });

  const { data: projectCategories = [] } = useQuery<{ id: string; name: string; projectType?: string | null }[]>({
    queryKey: ['/api/project-categories'],
  });

  // Fetch core project types (project types that have resource templates)
  const { data: coreProjectTypes = [] } = useQuery<string[]>({
    queryKey: ['/api/resource-templates/project-types'],
  });

  // Fetch all projects to get all existing categories
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Merge all categories: from database + from all projects
  const allCategories = useMemo(() => {
    const dbCategoryNames = projectCategories.map(c => c.name);
    const projectCategoryNames = allProjects
      .filter(p => p.category && p.category.trim())
      .map(p => p.category!);
    const allNames = new Set([...dbCategoryNames, ...projectCategoryNames]);
    return Array.from(allNames)
      .sort()
      .map((name, index) => {
        const existing = projectCategories.find(c => c.name === name);
        return existing || { id: `temp-${index}`, name, projectType: null };
      });
  }, [projectCategories, allProjects]);

  const { data: projectDocuments = [] } = useQuery<Document[]>({
    queryKey: ['/api/projects', id, 'documents'],
    enabled: !!id,
  });

  // Fetch uploaded files linked to this project (kind=upload)
  const projectUploadFilesQK = ['/api/files', id, 'uploads'] as const;
  const { data: projectUploadFiles = [] } = useQuery<any[]>({
    queryKey: projectUploadFilesQK,
    queryFn: async () => {
      const res = await apiRequest(`/api/files?projectId=${id}&kind=upload`, "GET");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!id,
  });

  const deleteProjectFileMutation = useMutation({
    mutationFn: (fileId: string) => apiRequest(`/api/files/${fileId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectUploadFilesQK });
      toast({ title: "Fichier supprimé", variant: "success" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de supprimer le fichier", variant: "destructive" }),
  });

  const renameProjectFileMutation = useMutation({
    mutationFn: ({ id: fileId, name }: { id: string; name: string }) => apiRequest(`/api/files/${fileId}`, "PATCH", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectUploadFilesQK });
      setRenamingProjectFileId(null);
      toast({ title: "Renommé", variant: "success" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de renommer", variant: "destructive" }),
  });

  const handleProjectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploadingProjectFiles(true);
    let ok = 0; let ko = 0;
    for (const file of Array.from(fileList)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (id) formData.append("projectId", id);
        if (project?.clientId) formData.append("clientId", project.clientId);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || "";
        const res = await fetch("/api/files/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
        if (!res.ok) throw new Error(await res.text());
        ok++;
      } catch { ko++; }
    }
    setUploadingProjectFiles(false);
    queryClient.invalidateQueries({ queryKey: projectUploadFilesQK });
    if (e.target) e.target.value = "";
    if (ok > 0) toast({ title: `${ok} fichier${ok > 1 ? "s" : ""} importé${ok > 1 ? "s" : ""}`, variant: "success" });
    if (ko > 0) toast({ title: "Erreur", description: `${ko} fichier(s) n'ont pas pu être importés`, variant: "destructive" });
  };

  const handleOpenProjectFilePreview = async (file: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      const res = await fetch(`/api/files/${file.id}/download-url`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Impossible d'obtenir l'URL");
      const { url } = await res.json();
      setPreviewProjectFile({ name: file.name, url, mimeType: file.mimeType || "" });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ouvrir l'aperçu", variant: "destructive" });
    }
  };

  // Fetch payments for this project (API now returns totals)
  interface PaymentsResponse {
    payments: ProjectPayment[];
    totalPaid: number;
    remainingAmount: number;
    budget: number;
    billingStatus: string | null;
  }
  const { data: paymentsData } = useQuery<PaymentsResponse>({
    queryKey: ['/api/projects', id, 'payments'],
    enabled: !!id,
  });

  // Fetch effective TJM and internal daily cost (project override ?? global default)
  interface EffectiveTJMResponse {
    effectiveTJM: number | null;
    source: 'project' | 'global' | null;
    projectTJM: number | null;
    globalTJM: number | null;
    hasTJM: boolean;
    // Internal daily cost
    effectiveInternalDailyCost: number | null;
    internalDailyCostSource: 'project' | 'global' | null;
    projectInternalDailyCost: number | null;
    globalInternalDailyCost: number | null;
    hasInternalDailyCost: boolean;
  }
  const { data: effectiveTJMData } = useQuery<EffectiveTJMResponse>({
    queryKey: ['/api/projects', id, 'effective-tjm'],
    enabled: !!id,
  });

  // Fetch profitability metrics for KPIs (real-time: refresh every 30s)
  const { data: projectProfitabilityData } = useQuery<ProfitabilityAnalysis>({
    queryKey: ['/api/projects', id, 'profitability'],
    enabled: !!id,
    refetchInterval: 30000,
  });
  const profitabilityMetrics = projectProfitabilityData?.metrics;

  // Fetch comparison data for decision-making
  const { data: comparisonData } = useQuery<ProjectComparison>({
    queryKey: ['/api/projects', id, 'comparison'],
    enabled: !!id,
  });

  // Extract data from API response
  const payments = paymentsData?.payments || [];
  const totalPaid = paymentsData?.totalPaid || 0;
  const remainingAmount = paymentsData?.remainingAmount || 0;

  // Fetch activities for this project
  const { data: projectActivities = [] } = useQuery<Activity[]>({
    queryKey: ['/api/projects', id, 'activities'],
    enabled: !!id,
  });

  // Fetch time entries for this project (for cross-module navigation)
  const { data: projectTimeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ['/api/time-entries', { projectId: id }],
    enabled: !!id,
  });

  // Fetch scope items (CDC) for this project - used for auto-completing numberOfDays
  const { data: projectScopeItemsData } = useQuery<{ scopeItems: ProjectScopeItem[] }>({
    queryKey: ['/api/projects', id, 'scope-items'],
    enabled: !!id,
  });
  const projectScopeItems = projectScopeItemsData?.scopeItems || [];

  // Fetch roadmap milestones for reminder display
  interface RoadmapMilestone {
    id: string;
    title: string;
    targetDate?: string | null;
    endDate?: string | null;
    status: string;
    isCritical?: boolean;
    milestoneStatus?: string;
  }
  interface MilestonesResponse {
    milestones: RoadmapMilestone[];
    nextMilestone: RoadmapMilestone | null;
    nextCriticalMilestone: RoadmapMilestone | null;
    upcomingCount: number;
    atRiskCount: number;
    overdueCount: number;
  }
  const { data: milestonesData } = useQuery<MilestonesResponse>({
    queryKey: ['/api/projects', id, 'roadmap', 'milestones'],
    enabled: !!id,
  });

  interface OKRKeyResult { id: string; title: string; targetDate?: string | null; progress: number; }
  interface OKRObjective { id: string; title: string; dueDate?: string | null; progress: number; status: string; keyResults: OKRKeyResult[]; }
  const { data: okrObjectives } = useQuery<OKRObjective[]>({
    queryKey: ['/api/projects', id, 'okr'],
    enabled: !!id,
  });
  
  // Calculate CDC estimated days for auto-completion
  const cdcEstimatedDays = useMemo(() => {
    return projectScopeItems.reduce((sum, item) => sum + (parseFloat(item.estimatedDays?.toString() || "0")), 0);
  }, [projectScopeItems]);

  // Calculate pace projection for the project (mirrors TimeTrackingTab logic)
  const paceProjection = useMemo(() => {
    if (projectTimeEntries.length < 2) {
      return { available: false, reason: "Pas assez de données" };
    }
    
    const entriesWithDates = projectTimeEntries
      .filter(e => e.startTime && e.duration && e.duration > 0)
      .map(e => ({
        date: new Date(e.startTime!),
        duration: e.duration || 0,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    
    if (entriesWithDates.length < 2) {
      return { available: false, reason: "Pas assez de sessions" };
    }
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last7DaysEntries = entriesWithDates.filter(e => e.date >= sevenDaysAgo);
    const last5Sessions = entriesWithDates.slice(0, 5);
    
    let selectedEntries: typeof entriesWithDates;
    let windowLabel: string;
    
    const has7Days = last7DaysEntries.length >= 2;
    const has5Sessions = last5Sessions.length >= 2;
    
    if (!has7Days && !has5Sessions) {
      return { available: false, reason: "Données insuffisantes" };
    }
    
    if (has7Days && has5Sessions) {
      if (last7DaysEntries.length > last5Sessions.length) {
        selectedEntries = last7DaysEntries;
        windowLabel = "7 derniers jours";
      } else {
        selectedEntries = last5Sessions;
        windowLabel = "5 dernières sessions";
      }
    } else if (has7Days) {
      selectedEntries = last7DaysEntries;
      windowLabel = "7 derniers jours";
    } else {
      selectedEntries = last5Sessions;
      windowLabel = "5 dernières sessions";
    }
    
    if (selectedEntries.length < 2) {
      return { available: false, reason: "Données insuffisantes" };
    }
    
    const windowTimeSeconds = selectedEntries.reduce((sum, e) => sum + e.duration, 0);
    const windowTimeDays = windowTimeSeconds / 3600 / 8;
    const oldestEntry = selectedEntries[selectedEntries.length - 1];
    const newestEntry = selectedEntries[0];
    const windowCalendarDays = Math.max(1, (newestEntry.date.getTime() - oldestEntry.date.getTime()) / (24 * 60 * 60 * 1000) + 1);
    const pacePerDay = windowTimeDays / windowCalendarDays;
    
    if (pacePerDay <= 0) {
      return { available: false, reason: "Rythme invalide" };
    }
    
    const projectNumberOfDays = parseFloat(project?.numberOfDays?.toString() || "0") || 0;
    const totalEstimatedDays = cdcEstimatedDays > 0 ? cdcEstimatedDays : projectNumberOfDays;
    const totalTimeSeconds = projectTimeEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
    const totalTimeDays = totalTimeSeconds / 3600 / 8;
    
    if (totalEstimatedDays <= 0) {
      return {
        available: true,
        noEstimation: true,
        pacePerDay,
        windowLabel,
        windowTimeDays,
        windowCalendarDays,
        totalTimeDays,
      };
    }
    
    const actualRemainingDays = totalEstimatedDays - totalTimeDays;
    
    if (actualRemainingDays < 0) {
      return { 
        available: true, 
        alreadyExceeded: true,
        exceededBy: Math.abs(actualRemainingDays),
        windowLabel,
        pacePerDay,
      };
    }
    
    const calendarDaysNeeded = actualRemainingDays / pacePerDay;
    const estimatedEndDate = new Date(now.getTime() + calendarDaysNeeded * 24 * 60 * 60 * 1000);
    
    return {
      available: true,
      alreadyExceeded: false,
      estimatedEndDate,
      calendarDaysNeeded: Math.ceil(calendarDaysNeeded),
      calendarDaysNeededRaw: calendarDaysNeeded,
      actualRemainingDays,
      pacePerDay,
      windowLabel,
      windowTimeDays,
      windowCalendarDays,
    };
  }, [projectTimeEntries, project?.numberOfDays, cdcEstimatedDays]);

  // Fetch all backlogs and filter by projectId
  interface BacklogWithDetails extends Backlog {
    ticketCounts?: { todo: number; inProgress: number; done: number; total: number };
    activeSprint?: { id: string; name: string } | null;
    creator?: { id: string; firstName?: string; lastName?: string; email: string } | null;
  }
  
  // Full backlog data with tickets (for expanded view)
  type BacklogFullData = Backlog & {
    epics: Epic[];
    userStories: UserStory[];
    backlogTasks: BacklogTask[];
    sprints: Sprint[];
    columns: BacklogColumn[];
  };
  
  const { data: allBacklogs = [] } = useQuery<BacklogWithDetails[]>({
    queryKey: ['/api/backlogs'],
    enabled: !!id,
  });
  
  // Filter backlogs linked to this project
  const projectBacklogs = useMemo(() => {
    return allBacklogs.filter((b) => b.projectId === id);
  }, [allBacklogs, id]);
  
  // Memoized navigation for prev/next projects (sorted alphabetically)
  const projectNavigation = useMemo(() => {
    if (!id || allProjects.length === 0) {
      return { prevProject: null, nextProject: null, isReady: false };
    }
    const sortedProjects = [...allProjects].sort((a, b) => a.name.localeCompare(b.name));
    const currentIndex = sortedProjects.findIndex(p => p.id === id);
    if (currentIndex === -1) {
      return { prevProject: null, nextProject: null, isReady: false };
    }
    return {
      prevProject: currentIndex > 0 ? sortedProjects[currentIndex - 1] : null,
      nextProject: currentIndex < sortedProjects.length - 1 ? sortedProjects[currentIndex + 1] : null,
      isReady: true
    };
  }, [allProjects, id]);
  
  // Toggle backlog expansion
  const toggleBacklogExpanded = (backlogId: string) => {
    setExpandedBacklogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(backlogId)) {
        newSet.delete(backlogId);
      } else {
        newSet.add(backlogId);
      }
      return newSet;
    });
  };

  // Initialize billing fields when project loads
  useEffect(() => {
    if (project) {
      setTotalBilledValue(project.totalBilled || project.budget || "");
      setBillingRateValue(project.billingRate || "");
      // If project has a saved numberOfDays, it's an override
      if (project.numberOfDays) {
        setNumberOfDaysValue(project.numberOfDays);
        setIsNumberOfDaysOverridden(true);
      } else {
        setIsNumberOfDaysOverridden(false);
      }
      // Deposit & end-of-month settings
      setDepositPctValue(project.depositPercentage ? project.depositPercentage.toString() : "30");
      setDepositAmtValue("");
      setPaymentEndOfMonth(!!(project.paymentEndOfMonth));
    }
  }, [project]);

  // Auto-sync numberOfDays with CDC estimated days (when not overridden)
  useEffect(() => {
    if (!isNumberOfDaysOverridden) {
      // Auto-sync with CDC estimated days
      if (cdcEstimatedDays > 0) {
        setNumberOfDaysValue(cdcEstimatedDays.toString());
      } else {
        setNumberOfDaysValue("");
      }
    }
  }, [cdcEstimatedDays, isNumberOfDaysOverridden]);

  const updateProjectMutation = {
    mutate: async ({ data }: { data: Partial<Project> }) => {
      try {
        // Auto-set progress to 100% when stage is "termine"
        if (data.stage === "termine" && data.progress === undefined) {
          data.progress = 100;
        }
        await apiRequest(`/api/projects/${id}`, "PATCH", data);
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
        toast({
          title: "Projet mis à jour",
          description: "Le projet a été mis à jour avec succès.",
          variant: "success",
        });
        setIsEditDialogOpen(false);
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message || "Impossible de mettre à jour le projet.",
          variant: "destructive",
        });
        throw error; // Re-throw to allow handleSubmitEdit to catch
      }
    },
    mutateAsync: async ({ data }: { data: Partial<Project> }) => {
      // Auto-set progress to 100% when stage is "termine"
      if (data.stage === "termine" && data.progress === undefined) {
        data.progress = 100;
      }
      await apiRequest(`/api/projects/${id}`, "PATCH", data);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
      toast({
        title: "Projet mis à jour",
        description: "Le projet a été mis à jour avec succès.",
        variant: "success",
      });
      setIsEditDialogOpen(false);
    },
  };

  const deleteProjectMutation = {
    mutate: async () => {
      try {
        await apiRequest(`/api/projects/${id}`, "DELETE");
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        toast({
          title: "Projet supprimé",
          description: "Le projet a été supprimé avec succès.",
          variant: "success",
        });
        setLocation("/projects");
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message || "Impossible de supprimer le projet.",
          variant: "destructive",
        });
      }
    },
  };

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest(`/api/tasks/${taskId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setIsDeleteTaskDialogOpen(false);
      setDeleteTaskId(null);
      toast({ title: "Tâche supprimée", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression de la tâche", variant: "destructive" });
    },
  });

  // Create note linked to project
  const createNoteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/notes", "POST", {
        title: `Note - ${project?.name || "Nouveau"}`,
        content: { type: 'doc', content: [] },
        plainText: "",
        status: "draft",
        visibility: "private",
      });
      return await response.json();
    },
    onSuccess: async (newNote) => {
      // Link note to project
      await apiRequest(`/api/notes/${newNote.id}/links`, "POST", {
        targetType: "project",
        targetId: id,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/note-links"] });
      toast({
        title: "Note créée",
        description: "La note a été créée et liée au projet",
        variant: "success",
      });
      setLocation(`/notes/${newNote.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la note",
        variant: "destructive",
      });
    },
  });

  // Create task linked to project
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      // Get first column sorted by order, or use first available column
      const sortedColumns = [...columns].sort((a, b) => a.order - b.order);
      const defaultColumn = sortedColumns[0];
      
      const taskPayload: any = {
        title: "Nouvelle tâche",
        description: "",
        projectId: id,
        priority: "medium",
        status: "todo",
      };
      
      // Only add columnId if we have a valid column
      if (defaultColumn?.id) {
        taskPayload.columnId = defaultColumn.id;
      }
      
      const response = await apiRequest("/api/tasks", "POST", taskPayload);
      return await response.json();
    },
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Tâche créée",
        description: "La tâche a été créée et liée au projet",
        variant: "success",
      });
      // Open task detail dialog
      setSelectedTask(newTask);
      setIsTaskDetailDialogOpen(true);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la tâche",
        variant: "destructive",
      });
    },
  });

  // Create document linked to project
  const createDocumentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/documents", "POST", {
        name: `Document - ${project?.name || "Nouveau"}`,
        templateId: null,
        formData: {},
        content: "",
        plainText: "",
        status: "draft",
        projectId: id,
      });
      return await response.json();
    },
    onSuccess: (newDocument) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "documents"] });
      toast({
        title: "Document créé",
        description: "Le document a été créé et lié au projet",
        variant: "success",
      });
      setLocation(`/documents/${newDocument.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le document",
        variant: "destructive",
      });
    },
  });

  // Activity mutations
  const createActivityMutation = useMutation({
    mutationFn: async (data: { kind: string; description: string; occurredAt: string; occurredAtTime: string }) => {
      let occurredAtFull: string | null = null;
      if (data.occurredAt) {
        const [hours, minutes] = (data.occurredAtTime || "12:00").split(":").map(Number);
        // Parse date components explicitly to avoid timezone issues with new Date("yyyy-MM-dd")
        const [year, month, day] = data.occurredAt.split("-").map(Number);
        const dateObj = new Date(year, month - 1, day, hours, minutes, 0, 0);
        occurredAtFull = dateObj.toISOString();
      }
      return await apiRequest("/api/activities", "POST", {
        subjectType: "project",
        subjectId: id,
        kind: data.kind,
        description: data.description,
        occurredAt: occurredAtFull,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'activities'] });
      setIsActivityDialogOpen(false);
      setActivityFormData({ kind: "custom", description: "", occurredAt: "", occurredAtTime: format(new Date(), "HH:mm") });
      toast({ title: "Activité créée avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création de l'activité", variant: "destructive" });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async (data: { id: string; kind: string; description: string; occurredAt: string; occurredAtTime: string }) => {
      let occurredAtFull: string | null = null;
      if (data.occurredAt) {
        const [hours, minutes] = (data.occurredAtTime || "12:00").split(":").map(Number);
        // Parse date components explicitly to avoid timezone issues with new Date("yyyy-MM-dd")
        const [year, month, day] = data.occurredAt.split("-").map(Number);
        const dateObj = new Date(year, month - 1, day, hours, minutes, 0, 0);
        occurredAtFull = dateObj.toISOString();
      }
      return await apiRequest(`/api/activities/${data.id}`, "PATCH", {
        kind: data.kind,
        description: data.description,
        occurredAt: occurredAtFull,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'activities'] });
      setIsActivityDialogOpen(false);
      setEditingActivity(null);
      setActivityFormData({ kind: "custom", description: "", occurredAt: "", occurredAtTime: format(new Date(), "HH:mm") });
      toast({ title: "Activité modifiée avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la modification de l'activité", variant: "destructive" });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return await apiRequest(`/api/activities/${activityId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'activities'] });
      setIsDeleteActivityDialogOpen(false);
      setDeleteActivityId(null);
      toast({ title: "Activité supprimée avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression de l'activité", variant: "destructive" });
    },
  });

  const handleActivitySubmit = () => {
    if (!activityFormData.description.trim()) return;
    if (editingActivity) {
      updateActivityMutation.mutate({
        id: editingActivity.id,
        ...activityFormData,
      });
    } else {
      createActivityMutation.mutate(activityFormData);
    }
  };

  const openActivityDialog = (activity?: Activity) => {
    if (activity) {
      setEditingActivity(activity);
      const activityDate = activity.occurredAt ? new Date(activity.occurredAt) : new Date();
      setActivityFormData({
        kind: activity.kind,
        description: activity.description || "",
        occurredAt: activity.occurredAt ? format(activityDate, "yyyy-MM-dd") : "",
        occurredAtTime: activity.occurredAt ? format(activityDate, "HH:mm") : format(new Date(), "HH:mm"),
      });
    } else {
      setEditingActivity(null);
      setActivityFormData({ 
        kind: "custom", 
        description: "", 
        occurredAt: format(new Date(), "yyyy-MM-dd"),
        occurredAtTime: format(new Date(), "HH:mm"),
      });
    }
    setIsActivityDialogOpen(true);
  };

  const getBillingStatusColor = (status: string | null) => getBillingStatusColorClass(status);

  const handleAiProjectAnalysis = async () => {
    if (!project) return;
    setIsAiAnalysisLoading(true);
    setAiAnalysisError(null);
    setAiAnalysisResult(null);
    setIsAiAnalysisOpen(true);
    try {
      const totalBilledNum = parseFloat(totalBilledValue || "0") || 0;
      const res = await apiRequest("/api/ai/project-analysis", "POST", {
        project: {
          name: project.name,
          description: project.description || undefined,
          category: project.category || undefined,
          budget: project.budget ? parseFloat(String(project.budget)) : undefined,
          status: project.stage || undefined,
          timeConsumedHours: projectTimeEntries.reduce((s, e) => s + (e.duration || 0), 0) / 3600,
          marginPercent: profitabilityMetrics?.marginPercent,
          totalBilled: totalBilledNum,
          margin: profitabilityMetrics?.margin,
        },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiAnalysisResult(data.analysis);
    } catch (err) {
      setAiAnalysisError(err instanceof Error ? err.message : "Erreur de l'analyse IA");
    } finally {
      setIsAiAnalysisLoading(false);
    }
  };

  const getBillingDaysOverdue = (billingDueDate: string | null) => {
    if (!billingDueDate) return "";
    const dueDate = new Date(billingDueDate);
    const today = new Date();
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      return ` (${diffDays}j)`;
    }
    return "";
  };

  const handleEditProject = () => {
    if (!project) return;
    setProjectFormData({
      name: project.name,
      description: project.description || "",
      clientId: project.clientId || "",
      stage: project.stage || "prospection",
      category: project.category || "",
      startDate: project.startDate ? new Date(project.startDate) : undefined,
      endDate: project.endDate ? new Date(project.endDate) : undefined,
      budget: project.budget || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmitEdit = async () => {
    try {
      // Update the project using mutateAsync to catch errors
      await updateProjectMutation.mutateAsync({
        data: {
          name: projectFormData.name,
          description: projectFormData.description,
          clientId: projectFormData.clientId || null,
          stage: projectFormData.stage,
          category: projectFormData.category || null,
          startDate: projectFormData.startDate ? formatDateForStorage(projectFormData.startDate) : null,
          endDate: projectFormData.endDate ? formatDateForStorage(projectFormData.endDate) : null,
          budget: projectFormData.budget || null,
        },
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder le projet",
        variant: "destructive",
      });
    }
  };

  if (projectLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Projet non trouvé</h2>
          <p className="text-muted-foreground mb-4">Le projet demandé n'existe pas ou a été supprimé.</p>
          <Link href="/projects">
            <Button data-testid="button-back-to-projects">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux projets
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const projectTasks = project.tasks || [];
  const tasksByStatus = columns.reduce((acc, column) => {
    acc[column.id] = projectTasks.filter(task => task.columnId === column.id);
    return acc;
  }, {} as Record<string, Task[]>);

  // Calculate progress based on completed tasks
  const completedColumn = columns.find(col => col.name === "Terminé");
  const completedTasksCount = completedColumn ? (tasksByStatus[completedColumn.id] || []).length : 0;
  const totalTasksCount = projectTasks.length;
  const progressPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Data completeness indicators
  const dataWarnings: { type: 'info' | 'warning'; message: string; action?: string }[] = [];
  
  // Check if project has a budget
  if (!project.totalBilled && !project.budget) {
    dataWarnings.push({ type: 'info', message: "Aucun budget défini", action: "Modifier le projet" });
  }
  
  // Check if project has time estimates (CDC) - use projectScopeItems from dedicated query
  const hasCdcItems = projectScopeItems && projectScopeItems.length > 0;
  if (!hasCdcItems) {
    dataWarnings.push({ type: 'info', message: "Pas de CDC défini", action: "Onglet Temps" });
  } else {
    // Only check for zero estimates when CDC items exist
    const projectCdcEstimatedDays = projectScopeItems.reduce((sum, item) => sum + (parseFloat(item.estimatedDays?.toString() || "0")), 0);
    if (projectCdcEstimatedDays === 0) {
      dataWarnings.push({ type: 'warning', message: "CDC sans estimations de temps" });
    }
  }
  
  // Check if project has dates
  if (!project.startDate && !project.endDate) {
    dataWarnings.push({ type: 'info', message: "Dates non définies" });
  }
  
  // Check if project has tasks but no sprint - this will be shown in Tasks tab
  const projectSprints = project.sprints || [];
  const hasTasksWithoutSprint = projectTasks.length > 0 && projectSprints.length === 0;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#F8FAFC] dark:bg-background">
      {/* Full-width onboarding banner below the top bar */}
      <PostCreationSuggestions
        project={project}
        scopeItems={projectScopeItems}
        onOpenCdcWizard={() => setIsCdcWizardOpen(true)}
        onDismiss={() => {}}
      />
      <div className="container mx-auto p-6">
        {/* ── COCKPIT HEADER ── */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
          {/* Left: back + title block */}
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <Link href="/projects">
              <Button variant="ghost" size="icon" data-testid="button-back" className="shrink-0 mt-0.5">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight truncate" data-testid="project-title">
                {project.name}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {project.client ? (
                  <Link href={`/crm/${project.clientId}`}>
                    <div className="flex items-center gap-1.5 group">
                      {project.client.logoUrl && (
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={project.client.logoUrl} alt={project.client.company || project.client.name || ""} />
                          <AvatarFallback className="text-[9px] font-medium">
                            {(project.client.company || project.client.name || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <span className="text-sm text-muted-foreground group-hover:text-primary cursor-pointer group-hover:underline">
                        {project.client.company || project.client.name}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">Client non défini</span>
                )}
                <span className="text-muted-foreground/40 select-none text-sm">·</span>
                <Badge className={`${getStageColor(project.stage || "prospection")} text-[10px] px-1.5 py-0.5`} data-testid="badge-stage">
                  {getStageLabel(project.stage || "prospection")}
                </Badge>
                {project.category && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5" data-testid="badge-category">
                    {project.category}
                  </Badge>
                )}
                <Popover open={isBillingStatusPopoverOpen} onOpenChange={setIsBillingStatusPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Badge 
                      data-testid="badge-billing-status-budget"
                      className={cn(
                        "shrink-0 cursor-pointer border-transparent font-medium text-[10px] px-1.5 py-0.5",
                        ["devis_envoye", "annule"].includes(project.billingStatus || "brouillon") 
                          ? "text-gray-800" 
                          : "text-white"
                      )}
                      style={{ 
                        backgroundColor: billingStatusOptions.find(o => o.value === (project.billingStatus || "brouillon"))?.color || "#C4B5FD"
                      }}
                    >
                      {getBillingStatusI18nLabel(project.billingStatus || "brouillon")}
                      {project.billingStatus === "retard" && getBillingDaysOverdue(project.billingDueDate)}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="start">
                    <div className="space-y-0.5">
                      {billingStatusOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={async () => {
                            // Capture current cache state for rollback
                            const previousProject = queryClient.getQueryData(['/api/projects', id]);
                            
                            // Optimistic update - immediately update UI
                            queryClient.setQueryData(['/api/projects', id], (old: any) => ({
                              ...old,
                              billingStatus: option.value,
                              billingDueDate: option.value !== "retard" ? null : old?.billingDueDate,
                            }));
                            setIsBillingStatusPopoverOpen(false);
                            
                            try {
                              const updateData: { billingStatus: string; billingDueDate?: string | null } = {
                                billingStatus: option.value,
                              };
                              if (option.value !== "retard") {
                                updateData.billingDueDate = null;
                              }
                              await apiRequest(`/api/projects/${id}`, "PATCH", updateData);
                              // Invalidate both project list and detail caches
                              queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                              queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                              toast({
                                title: t.projects.billingStatusTitle,
                                description: getBillingStatusI18nLabel(option.value),
                                variant: "success",
                              });
                            } catch (error: any) {
                              // Rollback to previous cache state on error
                              queryClient.setQueryData(['/api/projects', id], previousProject);
                              toast({
                                title: "Erreur",
                                description: error.message,
                                variant: "destructive",
                              });
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover-elevate transition-colors",
                            project.billingStatus === option.value && "bg-muted"
                          )}
                          data-testid={`option-header-billing-${option.value}`}
                        >
                          <div 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: option.color }}
                          />
                          <span>{getBillingStatusI18nLabel(option.value)}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          {/* Right: prev/next + actions — row 2 on mobile (indented past back arrow) */}
          <div className="flex items-center gap-1.5 shrink-0 pl-11 sm:pl-0 self-start sm:self-auto">
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={!projectNavigation.isReady || !projectNavigation.prevProject}
                onClick={() => projectNavigation.prevProject && setLocation(`/projects/${projectNavigation.prevProject.id}`)}
                data-testid="button-prev-project"
                title={projectNavigation.prevProject ? `Projet précédent : ${projectNavigation.prevProject.name}` : "Pas de projet précédent"}
                className="bg-white dark:bg-card"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={!projectNavigation.isReady || !projectNavigation.nextProject}
                onClick={() => projectNavigation.nextProject && setLocation(`/projects/${projectNavigation.nextProject.id}`)}
                data-testid="button-next-project"
                title={projectNavigation.nextProject ? `Projet suivant : ${projectNavigation.nextProject.name}` : "Pas de projet suivant"}
                className="bg-white dark:bg-card"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="w-px h-6 bg-border mx-0.5 hidden sm:block" />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAnalysisDrawer(true)}
              data-testid="button-analyze-project"
              className="bg-white dark:bg-card"
            >
              <TrendingUp className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline text-xs">Analyser</span>
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleEditProject} 
              data-testid="button-edit-project" 
              className="bg-white dark:bg-card"
              title="Modifier"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <AutomationButton
              scopeType="project"
              scopeId={id}
              scopeLabel={project.name}
            />
            <Button 
              variant="destructive" 
              size="icon"
              onClick={() => setIsDeleteDialogOpen(true)}
              data-testid="button-delete-project"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── KPI STRIP (4 cartes compactes) ── */}
        {projectProfitabilityData?.metrics && (() => {
          const m = projectProfitabilityData.metrics;
          const timeConsumedPct = m.theoreticalDays > 0 ? Math.min(100, (m.actualDaysWorked / m.theoreticalDays) * 100) : null;
          const margin = m.totalBilled > 0
            ? Math.round(((m.totalBilled - m.theoreticalDays * m.internalDailyCost) / m.totalBilled) * 1000) / 10
            : null;
          const targetMargin = profitabilityMetrics?.targetMarginPercent || 30;
          return (
            <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* 1. Santé projet */}
              <Card className="p-3.5 relative overflow-hidden">
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-[3px]",
                  m.status === 'profitable' && "bg-green-500",
                  m.status === 'at_risk' && "bg-amber-500",
                  m.status === 'deficit' && "bg-red-500"
                )} />
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Santé projet</p>
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    m.status === 'profitable' && "bg-green-100 dark:bg-green-900/30",
                    m.status === 'at_risk' && "bg-amber-100 dark:bg-amber-900/30",
                    m.status === 'deficit' && "bg-red-100 dark:bg-red-900/30"
                  )}>
                    {m.status === 'profitable' && <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
                    {m.status === 'at_risk' && <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                    {m.status === 'deficit' && <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
                  </div>
                </div>
                <p className={cn(
                  "text-base font-bold leading-tight",
                  m.status === 'profitable' && "text-green-600 dark:text-green-400",
                  m.status === 'at_risk' && "text-amber-600 dark:text-amber-400",
                  m.status === 'deficit' && "text-red-600 dark:text-red-400"
                )} data-testid="health-label">
                  {m.status === 'profitable' ? "En bonne voie" : m.status === 'at_risk' ? "À surveiller" : "En difficulté"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {paceProjection?.available ? "Trajectoire calculée" : "Données insuffisantes"}
                </p>
              </Card>

              {/* 2. Temps consommé */}
              <Card className="p-3.5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Temps consommé</p>
                  <Clock className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-base font-bold leading-tight" data-testid="time-consumed">
                  {m.actualDaysWorked.toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-1">j</span>
                  {m.theoreticalDays > 0 && (
                    <span className="text-xs font-normal text-muted-foreground"> / {m.theoreticalDays.toFixed(1)}j</span>
                  )}
                </p>
                {timeConsumedPct !== null ? (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span data-testid="time-planned">{timeConsumedPct.toFixed(0)}% consommé</span>
                      {m.timeOverrunPercent > 10 && <span className="text-amber-600">+{m.timeOverrunPercent.toFixed(0)}%</span>}
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", timeConsumedPct >= 100 ? "bg-red-500" : timeConsumedPct >= 80 ? "bg-amber-500" : "bg-primary")} style={{ width: `${Math.min(100, timeConsumedPct)}%` }} />
                    </div>
                  </div>
                ) : paceProjection?.available && paceProjection.pacePerDay ? (
                  <p className="text-[11px] text-muted-foreground mt-1" data-testid="time-pace-projection">
                    {(paceProjection.pacePerDay * 8).toFixed(1)}h/j · {paceProjection.windowLabel}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-1">Aucune projection</p>
                )}
              </Card>

              {/* 3. Montant facturé */}
              <Card className="p-3.5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-cyan-500" />
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Montant facturé</p>
                  <Euro className="h-3.5 w-3.5 text-cyan-500" />
                </div>
                <p className="text-base font-bold leading-tight" data-testid="billed-amount">
                  {(m.totalBilled || 0).toLocaleString("fr-FR")}<span className="text-xs font-normal text-muted-foreground ml-1">€</span>
                </p>
                <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                  {m.totalPaid > 0 && (
                    <p className="text-green-600 dark:text-green-400" data-testid="paid-amount">
                      {m.totalPaid.toLocaleString("fr-FR")} € encaissés
                    </p>
                  )}
                  {m.remainingToPay > 0 && (
                    <p className="text-amber-600">{m.remainingToPay.toLocaleString("fr-FR")} € à recevoir</p>
                  )}
                  {!m.totalPaid && !m.remainingToPay && <p>Aucun paiement reçu</p>}
                </div>
              </Card>

              {/* 4. Marge prévisionnelle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="p-3.5 relative overflow-hidden cursor-help">
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-violet-500" />
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Marge prévisionnelle</p>
                      <Trophy className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                    {(() => {
                      const margeColor = margin === null ? "text-muted-foreground" : margin >= targetMargin ? "text-green-600 dark:text-green-400" : margin >= 0 ? "text-amber-600" : "text-red-600";
                      const margeAmount = m.totalBilled > 0 ? m.totalBilled - m.theoreticalDays * m.internalDailyCost : null;
                      return (
                        <>
                          <p className={cn("text-base font-bold leading-tight", margeColor)}>
                            {margin !== null ? `${margin.toFixed(0)} %` : "—"}
                          </p>
                          {margeAmount !== null && (
                            <p className={cn("text-[11px] font-semibold mt-0.5", margeColor)}>
                              {margeAmount.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Cible : {targetMargin}%
                            {margin !== null && margin >= targetMargin && " · Atteinte"}
                            {margin !== null && margin < targetMargin && margin >= 0 && " · En dessous"}
                            {margin !== null && margin < 0 && " · Déficit"}
                          </p>
                        </>
                      );
                    })()}
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] bg-white dark:bg-gray-900 text-foreground border shadow-md">
                  <p className="font-semibold text-sm mb-1">Marge prévisionnelle</p>
                  <p className="text-xs text-muted-foreground">Projection basée sur le devis : budget facturé moins les jours estimés au CDC multiplié par votre coût journalier interne.</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">= Budget − (jours CDC × coût/j interne)</p>
                  <p className="text-xs text-muted-foreground mt-1">Se met à jour toutes les 30 secondes. Différent de la marge actualisée de l'onglet Facturation qui utilise les jours réellement travaillés.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })()}

        {/* ── COCKPIT ZONE : info card + base de pilotage / action zone ── */}
        <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* LEFT: description + dates (compact) */}
          <div className="md:col-span-1">
            <Card className="p-5 h-full flex flex-col gap-5">
              {/* Description */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                <p className={cn("text-[13px] leading-relaxed line-clamp-4", !project.description && "text-muted-foreground italic")}>
                  {project.description || "Aucune description renseignée"}
                </p>
              </div>
              <Separator />
              {/* Période */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" /> Période
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Start date picker */}
                  <Popover open={isPeriodStartPickerOpen} onOpenChange={setIsPeriodStartPickerOpen}>
                    <PopoverTrigger asChild>
                      <button className="text-[13px] font-medium text-foreground hover-elevate rounded px-1 py-0.5 -mx-1 cursor-pointer" data-testid="button-period-start">
                        {project.startDate ? format(new Date(project.startDate), "dd MMM yyyy", { locale: fr }) : <span className="text-muted-foreground italic">Début</span>}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={project.startDate ? new Date(project.startDate) : undefined}
                        onSelect={async (date) => {
                          setIsPeriodStartPickerOpen(false);
                          const formatted = date ? format(date, "yyyy-MM-dd") : null;
                          queryClient.setQueryData(['/api/projects', id], (old: any) => old ? { ...old, startDate: formatted } : old);
                          await apiRequest(`/api/projects/${id}`, "PATCH", { startDate: formatted });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                        }}
                        locale={fr}
                        weekStartsOn={1}
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground text-xs">→</span>
                  {/* End date picker */}
                  <Popover open={isPeriodEndPickerOpen} onOpenChange={setIsPeriodEndPickerOpen}>
                    <PopoverTrigger asChild>
                      <button className="text-[13px] font-medium text-foreground hover-elevate rounded px-1 py-0.5 -mx-1 cursor-pointer" data-testid="button-period-end">
                        {project.endDate ? format(new Date(project.endDate), "dd MMM yyyy", { locale: fr }) : <span className="text-muted-foreground italic">Fin</span>}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={project.endDate ? new Date(project.endDate) : undefined}
                        onSelect={async (date) => {
                          setIsPeriodEndPickerOpen(false);
                          const formatted = date ? format(date, "yyyy-MM-dd") : null;
                          queryClient.setQueryData(['/api/projects', id], (old: any) => old ? { ...old, endDate: formatted } : old);
                          await apiRequest(`/api/projects/${id}`, "PATCH", { endDate: formatted });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                        }}
                        locale={fr}
                        weekStartsOn={1}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {project.startDate && project.endDate && (() => {
                  const start = new Date(project.startDate!);
                  const end = new Date(project.endDate!);
                  const today = new Date();
                  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                  const elapsedDays = Math.max(0, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                  const progressPct = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
                  const isOverdue = today > end;
                  return (
                    <div className="mt-2">
                      <div className="h-1 bg-muted rounded-full overflow-hidden mb-1">
                        <div className={cn("h-full rounded-full transition-all", isOverdue ? "bg-red-500" : progressPct > 80 ? "bg-amber-500" : "bg-cyan-500")} style={{ width: `${Math.min(100, progressPct)}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {isOverdue
                          ? `En retard de ${Math.ceil((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24))}j`
                          : `${Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))}j restants · ${totalDays}j au total`}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </Card>
          </div>

          {/* RIGHT: timeline narrative (2/3) */}
          <div className="md:col-span-2">
            <Card className="p-5 h-full">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-5 flex items-center gap-1.5">
                <Layers className="h-3 w-3" /> Timeline
              </p>
              {(() => {
                // Hex colors per scopeType — used for both timeline blocks (inline style) and circular progress bars
                const SCOPE_TYPE_HEX: Record<string, string> = {
                  functional:    "#7DD3FC", // sky-300    — bleu ciel
                  technical:     "#67E8F9", // cyan-300   — cyan
                  design:        "#F0ABFC", // fuchsia-300 — fuschia
                  gestion:       "#FCD34D", // amber-300  — ambre
                  strategy:      "#D8B4FE", // purple-300 — mauve
                  discovery:     "#FDA4AF", // rose-300   — saumon
                  delivery:      "#5EEAD4", // teal-300   — turquoise
                  devops:        "#FDBA74", // orange-300 — orange
                  communication: "#C4B5FD", // violet-300 — violet
                  gtm:           "#BEF264", // lime-300   — lime
                  autre:         "#D1D5DB", // gray-300   — gris
                };
                const SCOPE_TYPE_LABELS: Record<string, string> = {
                  functional: "Fonctionnel", technical: "Technique", design: "Design",
                  gestion: "Gestion", strategy: "Stratégie", discovery: "Discovery", delivery: "Delivery",
                  devops: "DevOps", communication: "Communication", gtm: "GTM", autre: "Autre",
                };
                // Track (pastel) colors — mirrors TYPE_TRACK in progress bars — used for non-completed blocks
                const SCOPE_TYPE_TRACK_LIGHT: Record<string, string> = {
                  functional: "#E0F2FE", technical: "#CFFAFE", design: "#FAE8FF",
                  gestion: "#FEF3C7", strategy: "#F3E8FF", discovery: "#FFE4E6",
                  delivery: "#CCFBF1", devops: "#FFEDD5", communication: "#EDE9FE",
                  gtm: "#ECFCCB", autre: "#F3F4F6",
                };
                const SCOPE_TYPE_TRACK_DARK: Record<string, string> = {
                  functional:    "rgba(125,211,252,0.25)", technical:     "rgba(103,232,249,0.25)",
                  design:        "rgba(240,171,252,0.25)", gestion:       "rgba(252,211,77,0.25)",
                  strategy:      "rgba(216,180,254,0.25)", discovery:     "rgba(253,164,175,0.25)",
                  delivery:      "rgba(94,234,212,0.25)",  devops:        "rgba(253,186,116,0.25)",
                  communication: "rgba(196,181,253,0.25)", gtm:           "rgba(190,242,100,0.25)",
                  autre:         "rgba(156,163,175,0.25)",
                };
                const SCOPE_TYPE_TRACK = isDark ? SCOPE_TYPE_TRACK_DARK : SCOPE_TYPE_TRACK_LIGHT;

                // Add N working days to a date (skip Sat/Sun)
                const addWorkingDays = (start: Date, days: number): Date => {
                  const d = new Date(start);
                  let count = 0;
                  while (count < Math.round(days)) {
                    d.setDate(d.getDate() + 1);
                    const day = d.getDay();
                    if (day !== 0 && day !== 6) count++;
                  }
                  return d;
                };

                const cdcItems = projectScopeItems;

                if (cdcItems.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                      <Layers className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">Aucun élément de cahier des charges.</p>
                      <p className="text-[10px] text-muted-foreground">Ajoutez des étapes dans l'onglet CDC pour visualiser la timeline.</p>
                    </div>
                  );
                }

                type CDCBlock = {
                  id: string;
                  label: string;
                  scopeType: string;
                  phase: string | null;
                  estimatedDays: number;
                  timeDays: number;
                  consumption: number;
                  isCompleted: boolean;
                  color: string;
                  startDate: Date | null;
                  endDate: Date | null;
                };

                const projectStart = project?.startDate ? new Date(project.startDate) : null;
                let cursor = projectStart ? new Date(projectStart) : null;

                const blocks: CDCBlock[] = cdcItems.map((item, i) => {
                  const estimatedDays = Math.max(parseFloat(item.estimatedDays?.toString() || "0"), 1);
                  const isCompleted = !!(item as any).completedAt;
                  const itemTimeSec = projectTimeEntries
                    .filter((e: any) => e.scopeItemId === item.id)
                    .reduce((s: number, e: any) => s + (e.duration || 0), 0);
                  const timeDays = itemTimeSec / 3600 / 8;
                  // If marked as completed → 100%, else derive from time entries
                  const consumption = isCompleted ? 100 : (estimatedDays > 0 ? (timeDays / estimatedDays) * 100 : 0);
                  const startDate = cursor ? new Date(cursor) : null;
                  const endDate = cursor ? addWorkingDays(cursor, estimatedDays) : null;
                  if (endDate) cursor = new Date(endDate);
                  return {
                    id: item.id,
                    label: (item as any).label || (item as any).title || "—",
                    scopeType: (item as any).scopeType || "functional",
                    phase: (item as any).phase || null,
                    estimatedDays,
                    timeDays,
                    consumption,
                    isCompleted,
                    color: SCOPE_TYPE_HEX[(item as any).scopeType || "autre"] || SCOPE_TYPE_HEX.autre,
                    startDate,
                    endDate,
                  };
                });

                return (
                  <div className="flex flex-col gap-3">
                    {/* Horizontal bar of colored blocks with progress overlay */}
                    <div className="relative">
                      <div className="flex h-10 gap-[2px] w-full">
                        {blocks.map((block) => {
                          const pct = Math.min(100, Math.round(block.consumption));
                          const isOver = block.consumption > 100;
                          return (
                            <Tooltip key={block.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className="rounded-sm cursor-default transition-opacity hover:opacity-80 relative overflow-hidden"
                                  style={{
                                    flex: block.estimatedDays,
                                    minWidth: 8,
                                    background: block.isCompleted
                                      ? block.color
                                      : `linear-gradient(to right, ${block.color} ${pct}%, ${SCOPE_TYPE_TRACK[block.scopeType] || "#F3F4F6"} ${pct}%)`,
                                  }}
                                >
                                  {/* Over-budget overlay only (gradient already handles normal progress) */}
                                  {isOver && !block.isCompleted && (
                                    <div
                                      className="absolute inset-0 rounded-sm bg-red-600/20"
                                      style={{ width: `${100 - pct}%`, right: 0, left: "auto" }}
                                    />
                                  )}
                                  {/* Completion checkmark or % */}
                                  {block.isCompleted && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[220px] bg-white dark:bg-gray-900 text-foreground border shadow-md">
                                <p className="font-semibold text-xs mb-1">{block.label}</p>
                                <p className="text-[11px] flex items-center gap-1 mt-0.5">
                                  <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: block.color }} />
                                  <span style={{ color: block.color }}>{SCOPE_TYPE_LABELS[block.scopeType] || block.scopeType}</span>
                                </p>
                                {block.phase && <p className="text-[11px] text-muted-foreground">Phase {block.phase}</p>}
                                <p className="text-[11px] mt-1">{block.estimatedDays.toFixed(1)}j estimés</p>
                                {block.isCompleted
                                  ? <p className="text-[11px] text-green-600 font-medium mt-0.5">Terminé — 100%</p>
                                  : block.timeDays > 0
                                    ? <p className="text-[11px] text-muted-foreground">{block.timeDays.toFixed(1)}j passés · {pct}%</p>
                                    : <p className="text-[11px] text-muted-foreground">Aucune saisie temps liée</p>
                                }
                                {isOver && <p className="text-[11px] text-red-500 font-medium mt-0.5">Budget dépassé</p>}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                      {/* Current date vertical marker */}
                      {(() => {
                        if (!projectStart || blocks.length === 0) return null;
                        const lastEnd = blocks[blocks.length - 1].endDate;
                        if (!lastEnd) return null;
                        const totalMs = lastEnd.getTime() - projectStart.getTime();
                        if (totalMs <= 0) return null;
                        const today = new Date();
                        const elapsedMs = today.getTime() - projectStart.getTime();
                        const pct = (elapsedMs / totalMs) * 100;
                        if (pct <= 0 || pct >= 100) return null;
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-red-300 dark:bg-red-600 pointer-events-auto cursor-default z-10"
                                style={{ left: `${pct}%` }}
                              >
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-400 dark:bg-red-500" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
                              <p className="text-[11px] font-medium">Aujourd'hui · {format(today, "dd MMM yyyy", { locale: fr })}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                    </div>

                    {/* X-axis: spaced date labels (absolute positioning to avoid overlaps) */}
                    {projectStart && blocks.length > 0 && (
                      <div className="relative h-6 w-full">
                        {(() => {
                          const totalDays = blocks.reduce((sum, b) => sum + b.estimatedDays, 0);
                          if (totalDays === 0) return null;
                          const minSpacePct = 11;

                          // Collect candidate labels with % position
                          type LabelItem = { label: string; pct: number; isFirst: boolean; isLast: boolean };
                          const candidates: LabelItem[] = [];
                          let cumulative = 0;
                          blocks.forEach((block) => {
                            const pct = (cumulative / totalDays) * 100;
                            if (block.startDate) {
                              candidates.push({ label: format(block.startDate, "dd MMM", { locale: fr }), pct, isFirst: cumulative === 0, isLast: false });
                            }
                            cumulative += block.estimatedDays;
                          });
                          const lastBlock = blocks[blocks.length - 1];
                          if (lastBlock?.endDate) {
                            candidates.push({ label: format(lastBlock.endDate, "dd MMM", { locale: fr }), pct: 100, isFirst: false, isLast: true });
                          }

                          // Filter: only show labels spaced >= minSpacePct% apart
                          const visible: LabelItem[] = [];
                          let lastPct = -Infinity;
                          candidates.forEach((item, i) => {
                            const isLast = i === candidates.length - 1;
                            if (isLast) {
                              // Show last only if far enough from previous
                              if (item.pct - lastPct >= minSpacePct) {
                                visible.push(item);
                                lastPct = item.pct;
                              }
                            } else if (item.pct - lastPct >= minSpacePct) {
                              visible.push(item);
                              lastPct = item.pct;
                            }
                          });

                          return visible.map((item) => {
                            const translate = item.isFirst ? "0" : item.isLast ? "-100%" : "-50%";
                            return (
                              <div
                                key={`label-${item.pct}`}
                                className="absolute top-0 flex flex-col"
                                style={{ left: `${item.pct}%`, transform: `translateX(${translate})` }}
                              >
                                <div className="w-px h-1.5 bg-border mb-0.5" />
                                <p className="text-[9px] text-muted-foreground whitespace-nowrap">
                                  {item.label}
                                </p>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}

                    {/* Circular progress bars by scope type */}
                    {(() => {
                      // TYPE_CONFIG — labels + track colors; main color from SCOPE_TYPE_HEX (single source of truth)
                      const TYPE_TRACK_LIGHT: Record<string, string> = {
                        functional: "#E0F2FE", technical: "#CFFAFE", design: "#FAE8FF",
                        gestion: "#FEF3C7", strategy: "#F3E8FF", discovery: "#FFE4E6",
                        delivery: "#CCFBF1", devops: "#FFEDD5", communication: "#EDE9FE",
                        gtm: "#ECFCCB", autre: "#F3F4F6",
                      };
                      const TYPE_TRACK_DARK: Record<string, string> = {
                        functional:    "rgba(125,211,252,0.25)", technical:     "rgba(103,232,249,0.25)",
                        design:        "rgba(240,171,252,0.25)", gestion:       "rgba(252,211,77,0.25)",
                        strategy:      "rgba(216,180,254,0.25)", discovery:     "rgba(253,164,175,0.25)",
                        delivery:      "rgba(94,234,212,0.25)",  devops:        "rgba(253,186,116,0.25)",
                        communication: "rgba(196,181,253,0.25)", gtm:           "rgba(190,242,100,0.25)",
                        autre:         "rgba(156,163,175,0.25)",
                      };
                      const TYPE_TRACK = isDark ? TYPE_TRACK_DARK : TYPE_TRACK_LIGHT;
                      const TYPE_LABELS: Record<string, { label: string; shortLabel: string }> = {
                        functional:    { label: "Fonctionnel",   shortLabel: "Fonct."  },
                        technical:     { label: "Technique",     shortLabel: "Tech."   },
                        design:        { label: "Design",        shortLabel: "Design"  },
                        gestion:       { label: "Gestion",       shortLabel: "Gest."   },
                        strategy:      { label: "Stratégie",     shortLabel: "Strat."  },
                        discovery:     { label: "Discovery",     shortLabel: "Disco."  },
                        delivery:      { label: "Delivery",      shortLabel: "Deliv."  },
                        devops:        { label: "DevOps",        shortLabel: "DevOps"  },
                        communication: { label: "Communication", shortLabel: "Comm."   },
                        gtm:           { label: "GTM",           shortLabel: "GTM"     },
                        autre:         { label: "Autre",         shortLabel: "Autre"   },
                      };
                      const TYPE_CONFIG: Record<string, { label: string; shortLabel: string; color: string; track: string }> = Object.fromEntries(
                        Object.keys(TYPE_LABELS).map(k => [k, {
                          ...TYPE_LABELS[k],
                          color: SCOPE_TYPE_HEX[k] || SCOPE_TYPE_HEX.autre,
                          track: TYPE_TRACK[k] || TYPE_TRACK.autre,
                        }])
                      );
                      // Group by scopeType — only types present in CDC
                      // For completed items, treat timeDays = estimatedDays (100%)
                      const byType: Record<string, { estimatedDays: number; timeDays: number; hasCompleted: boolean }> = {};
                      blocks.forEach(b => {
                        const t = b.scopeType || "autre";
                        if (!byType[t]) byType[t] = { estimatedDays: 0, timeDays: 0, hasCompleted: false };
                        byType[t].estimatedDays += b.estimatedDays;
                        byType[t].timeDays += b.isCompleted ? b.estimatedDays : b.timeDays;
                        if (b.isCompleted) byType[t].hasCompleted = true;
                      });
                      const types = Object.entries(byType);
                      if (types.length === 0) return null;
                      const SIZE = 52;
                      const STROKE = 5;
                      const R = (SIZE / 2) - STROKE / 2;
                      const CIRC = 2 * Math.PI * R;
                      return (
                        <div className="flex flex-wrap gap-4 mt-2 pt-3 border-t">
                          {types.map(([type, { estimatedDays, timeDays, hasCompleted }]) => {
                            const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.autre;
                            const pct = estimatedDays > 0 ? Math.min(100, Math.round((timeDays / estimatedDays) * 100)) : 0;
                            const offset = CIRC * (1 - pct / 100);
                            const isOver = estimatedDays > 0 && timeDays > estimatedDays;
                            const isDone = pct === 100 && !isOver;
                            const strokeColor = isOver ? "#EF4444" : isDone ? "#10B981" : cfg.color;
                            return (
                              <Tooltip key={type}>
                                <TooltipTrigger asChild>
                                  <div className="flex flex-col items-center gap-1 cursor-default">
                                    <div className="relative" style={{ width: SIZE, height: SIZE }}>
                                      <svg width={SIZE} height={SIZE} className="-rotate-90">
                                        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={cfg.track} strokeWidth={STROKE} />
                                        <circle
                                          cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
                                          stroke={strokeColor} strokeWidth={STROKE}
                                          strokeLinecap="round"
                                          strokeDasharray={CIRC}
                                          strokeDashoffset={offset}
                                          style={{ transition: "stroke-dashoffset 0.4s ease" }}
                                        />
                                      </svg>
                                      <span className={cn("absolute inset-0 flex items-center justify-center text-[10px] font-semibold", isDone ? "text-emerald-600" : isOver ? "text-red-600" : "text-foreground")}>{pct}%</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">{cfg.shortLabel}</p>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-white dark:bg-gray-900 text-foreground border shadow-md">
                                  <p className="font-semibold text-xs">{cfg.label}</p>
                                  <p className="text-[11px] text-muted-foreground">{estimatedDays.toFixed(1)}j estimés · {timeDays.toFixed(1)}j passés</p>
                                  {hasCompleted && <p className="text-[11px] text-green-600 font-medium">Inclut des éléments terminés</p>}
                                  {isOver && <p className="text-[11px] text-red-500 font-medium">Budget dépassé</p>}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto mb-3">
          <TabsList className="w-max justify-start flex-nowrap h-[42px]">
            <TabsTrigger value="overview" className="gap-1.5 text-xs h-[42px] px-3" data-testid="tab-overview">
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.projects.tabs.overview}</span>
            </TabsTrigger>
            <TabsTrigger value="activities" className="gap-1.5 text-xs h-[42px] px-3" data-testid="tab-activities">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.projects.tabs.activities}</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5 text-xs h-[42px] px-3" data-testid="tab-billing">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.projects.tabs.billing}</span>
            </TabsTrigger>
            <TabsTrigger value="time" className="gap-1.5 text-xs h-[42px] px-3" data-testid="tab-time">
              <Timer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.projects.tabs.time}</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-1.5 text-xs h-[42px] px-3" data-testid="tab-resources">
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.projects.tabs.resources}</span>
            </TabsTrigger>
            <TabsTrigger value="roadmap" className="gap-1.5 text-xs h-[42px] px-3" data-testid="tab-roadmap">
              <Map className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.projects.tabs.roadmap}</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5 text-xs h-[42px] px-3">
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.projects.tabs.tasks}</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5 text-xs h-[42px] px-3">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.projects.tabs.notes}</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="hidden">
              Documents
            </TabsTrigger>
            <TabsTrigger value="fichiers" className="gap-1.5 text-xs h-[42px] px-3" data-testid="tab-fichiers">
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Fichiers</span>
            </TabsTrigger>
            <TabsTrigger value="backlogs" className="gap-1.5 text-xs h-[42px] px-3" data-testid="tab-backlogs">
              <FolderKanban className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Backlogs</span>
            </TabsTrigger>
          </TabsList>
          </div>

          {/* ── VUE D'ENSEMBLE ── */}
          <TabsContent value="overview" className="mt-0">
            {(() => {
              const totalTimeSec = projectTimeEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
              const totalTimeDays = totalTimeSec / 3600 / 8;
              const estimatedDays = cdcEstimatedDays > 0 ? cdcEstimatedDays : parseFloat(project?.numberOfDays?.toString() || "0") || 0;
              const consumptionPct = estimatedDays > 0 ? Math.round((totalTimeDays / estimatedDays) * 100) : null;
              const now = new Date();

              // Facturation en retard
              const overduePayments = payments.filter(p => !p.isPaid && p.dueDate && new Date(p.dueDate) < now);
              const overdueTotal = overduePayments.reduce((sum, p) => sum + (parseFloat(p.amount?.toString() || "0")), 0);

              // Projet bloqué
              const lastActivityDate = projectActivities.length > 0
                ? new Date(projectActivities[0].createdAt!)
                : null;
              const daysSinceActivity = lastActivityDate
                ? Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
                : null;
              const isBlocked = daysSinceActivity !== null && daysSinceActivity >= 10;

              // Tâches
              const openTasks = projectTasks.filter(t => {
                const col = project.columns?.find((c: any) => c.id === t.columnId);
                return !col?.isFinal;
              });
              const highPriorityTasks = openTasks.filter(t => t.priority === "critical" || t.priority === "high");
              const overdueTasks = openTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
              const unestimatedTasks = openTasks.filter(t => !t.estimatedHours || t.estimatedHours === 0);
              const tooManyOpen = openTasks.length > 15;

              // Marge
              const m = profitabilityMetrics;
              const marginPct = m?.marginPercent ?? null;
              const targetMargin = m?.targetMarginPercent ?? 30;
              const isMarginNegative = marginPct !== null && marginPct < 0;
              const isMarginBelowTarget = marginPct !== null && marginPct >= 0 && marginPct < targetMargin;

              // Sprint
              const activeSprint = projectSprints.find((s: any) => s.status === "en_cours");
              const readySprint = projectSprints.find((s: any) => s.status === "preparation");

              type IndicatorSeverity = "critical" | "warning" | "info" | "ok";
              type Indicator = {
                id: string;
                severity: IndicatorSeverity;
                icon: React.ReactNode;
                label: string;
                detail?: string;
                action?: { label: string; tab: string };
              };

              const alerts: Indicator[] = [];
              const actions: Indicator[] = [];
              const business: Indicator[] = [];
              const reco: Indicator[] = [];

              // ── ⚠️ ALERTES ──
              if (cdcEstimatedDays > 0 && totalTimeDays > cdcEstimatedDays) {
                const excess = (totalTimeDays - cdcEstimatedDays).toFixed(1);
                alerts.push({ id: "time-over", severity: "critical", icon: <Clock className="h-4 w-4" />, label: "Budget temps dépassé", detail: `+${excess}j au-delà des ${cdcEstimatedDays.toFixed(1)}j estimés (${consumptionPct}%)`, action: { label: "Voir temps", tab: "time" } });
              } else if (consumptionPct !== null && consumptionPct >= 80 && consumptionPct < 100) {
                alerts.push({ id: "time-warn", severity: "warning", icon: <Clock className="h-4 w-4" />, label: "Consommation élevée du budget", detail: `${consumptionPct}% du budget temps consommé`, action: { label: "Voir temps", tab: "time" } });
              }
              if (isMarginNegative) {
                alerts.push({ id: "margin-neg", severity: "critical", icon: <TrendingDown className="h-4 w-4" />, label: "Marge négative", detail: `${marginPct!.toFixed(0)}% — objectif : ${targetMargin}%`, action: { label: "Voir facturation", tab: "billing" } });
              } else if (isMarginBelowTarget) {
                alerts.push({ id: "margin-low", severity: "warning", icon: <TrendingDown className="h-4 w-4" />, label: "Marge sous objectif", detail: `${marginPct!.toFixed(0)}% vs objectif ${targetMargin}%`, action: { label: "Voir facturation", tab: "billing" } });
              }
              if (overduePayments.length > 0) {
                alerts.push({ id: "payment-late", severity: "critical", icon: <Euro className="h-4 w-4" />, label: `${overduePayments.length} facture${overduePayments.length > 1 ? "s" : ""} en retard`, detail: overdueTotal > 0 ? `${overdueTotal.toLocaleString("fr-FR")} € en attente` : undefined, action: { label: "Voir facturation", tab: "billing" } });
              }
              if (isBlocked) {
                alerts.push({ id: "blocked", severity: "warning", icon: <AlertTriangle className="h-4 w-4" />, label: "Projet inactif", detail: `Aucune activité depuis ${daysSinceActivity} jours`, action: { label: "Voir activités", tab: "activities" } });
              }
              if (overdueTasks.length > 0) {
                alerts.push({ id: "tasks-overdue", severity: "warning", icon: <Flag className="h-4 w-4" />, label: `${overdueTasks.length} tâche${overdueTasks.length > 1 ? "s" : ""} en retard`, detail: overdueTasks.slice(0, 2).map(t => t.title).join(", ") + (overdueTasks.length > 2 ? "…" : ""), action: { label: "Voir tâches", tab: "tasks" } });
              }

              // ── 📌 ACTIONS À FAIRE (opérationnel + pilotage + admin) ──
              if (highPriorityTasks.length > 0) {
                const nextCritical = highPriorityTasks.find(t => t.priority === "critical") || highPriorityTasks[0];
                actions.push({ id: "high-prio", severity: "info", icon: <Flag className="h-4 w-4" />, label: `Prochaine tâche critique`, detail: nextCritical.title + (highPriorityTasks.length > 1 ? ` (+${highPriorityTasks.length - 1} autre${highPriorityTasks.length > 2 ? "s" : ""})` : ""), action: { label: "Voir tâches", tab: "tasks" } });
              }
              if (!activeSprint && readySprint) {
                actions.push({ id: "sprint-ready", severity: "info", icon: <Play className="h-4 w-4" />, label: "Sprint prêt à démarrer", detail: `"${readySprint.name}" est en préparation`, action: { label: "Voir backlogs", tab: "backlogs" } });
              }
              if (projectBacklogs.length > 0 && unestimatedTasks.length > 0 && projectTasks.length > 2) {
                actions.push({ id: "unestimated", severity: "info", icon: <Clock className="h-4 w-4" />, label: `${unestimatedTasks.length} ticket${unestimatedTasks.length > 1 ? "s" : ""} sans estimation`, detail: "Estimez les tickets pour un meilleur pilotage", action: { label: "Voir tâches", tab: "tasks" } });
              }
              if (projectScopeItems.length === 0) {
                actions.push({ id: "no-cdc", severity: "warning", icon: <FileText className="h-4 w-4" />, label: "CDC non défini", detail: "Aucun élément de cahier des charges renseigné" });
              }
              if (projectBacklogs.length === 0) {
                actions.push({ id: "no-backlog", severity: "info", icon: <FolderKanban className="h-4 w-4" />, label: "Aucun backlog associé", detail: "Créez un backlog pour organiser les tickets" });
              }
              if (tooManyOpen) {
                actions.push({ id: "too-many-open", severity: "warning", icon: <ListTodo className="h-4 w-4" />, label: `${openTasks.length} tâches ouvertes`, detail: "Priorisation recommandée", action: { label: "Voir tâches", tab: "tasks" } });
              }
              // Actions administratives
              if (!project?.billingType) {
                actions.push({ id: "admin-billing-mode", severity: "warning", icon: <Briefcase className="h-4 w-4" />, label: "Mode de facturation non défini", detail: "Précisez le type : forfait, régie ou mixte", action: { label: "Voir facturation", tab: "billing" } });
              }
              if (project?.billingType !== 'fixed_price' && (!project?.internalDailyCost || parseFloat(project.internalDailyCost?.toString() || "0") === 0)) {
                actions.push({ id: "admin-daily-cost", severity: "warning", icon: <Euro className="h-4 w-4" />, label: "TJM manquant", detail: "Coût journalier non défini — calcul de rentabilité impossible", action: { label: "Voir facturation", tab: "billing" } });
              }
              if (!project?.billingRate || parseFloat(project.billingRate?.toString() || "0") === 0) {
                actions.push({ id: "admin-resources", severity: "info", icon: <Users className="h-4 w-4" />, label: "Ressources non définies", detail: "Aucun taux journalier facturé configuré", action: { label: "Voir facturation", tab: "billing" } });
              }

              // ── 💰 ACTIONS BUSINESS ──
              if (paceProjection?.alreadyExceeded) {
                business.push({ id: "biz-exceeded", severity: "critical", icon: <TrendingUp className="h-4 w-4" />, label: "Budget dépassé", detail: `+${paceProjection.exceededBy?.toFixed(1)}j au-delà de l'estimation`, action: { label: "Analyser", tab: "billing" } });
              } else if (paceProjection?.available && !paceProjection.noEstimation && paceProjection.estimatedEndDate && project?.endDate) {
                const projEnd = paceProjection.estimatedEndDate;
                const contractEnd = new Date(project.endDate);
                if (projEnd > contractEnd) {
                  const diffDays = Math.ceil((projEnd.getTime() - contractEnd.getTime()) / (1000 * 60 * 60 * 24));
                  business.push({ id: "biz-risk", severity: "warning", icon: <TrendingUp className="h-4 w-4" />, label: "Risque de dépassement", detail: `Le projet pourrait dépasser de ${diffDays} jour${diffDays > 1 ? "s" : ""}`, action: { label: "Voir temps", tab: "time" } });
                }
              }
              if (m && m.totalBilled > 0 && totalTimeDays > 0) {
                const effectiveTJM = m.totalBilled / totalTimeDays;
                if (effectiveTJM < m.targetTJM * 0.8) {
                  business.push({ id: "biz-tjm", severity: "warning", icon: <Euro className="h-4 w-4" />, label: "TJM effectif bas", detail: `${Math.round(effectiveTJM).toLocaleString("fr-FR")} €/j vs objectif ${m.targetTJM.toLocaleString("fr-FR")} €/j`, action: { label: "Voir facturation", tab: "billing" } });
                }
              }
              {
                const terminedSprint = projectSprints.find((s: any) => s.status === "termine");
                if (terminedSprint && payments.filter(p => !p.isPaid).length > 0) {
                  business.push({ id: "biz-invoice", severity: "info", icon: <CheckCircle2 className="h-4 w-4" />, label: "Facturation possible", detail: `Milestone "${terminedSprint.name}" terminé — vérifiez si une facture est à émettre`, action: { label: "Voir facturation", tab: "billing" } });
                }
              }

              // ── 🧠 RECOMMANDATIONS ──
              if (activeSprint) {
                reco.push({ id: "reco-next-sprint", severity: "info", icon: <Lightbulb className="h-4 w-4" />, label: "Préparer le sprint suivant", detail: "Un sprint est en cours — anticipez le suivant pour maintenir le rythme" });
              }
              if (projectBacklogs.length > 0 && unestimatedTasks.length > 3) {
                reco.push({ id: "reco-estimate", severity: "info", icon: <Lightbulb className="h-4 w-4" />, label: "Estimer les tickets avant le sprint", detail: `${unestimatedTasks.length} tickets sans estimation — utile pour la planification`, action: { label: "Voir tâches", tab: "tasks" } });
              }
              if (isMarginBelowTarget && !isMarginNegative) {
                reco.push({ id: "reco-scope", severity: "info", icon: <Lightbulb className="h-4 w-4" />, label: "Réviser le scope pour améliorer la marge", detail: "La marge est sous l'objectif — envisagez un ajustement du périmètre", action: { label: "Voir CDC", tab: "scope" } });
              }
              if (projectScopeItems.length > 0 && projectBacklogs.length === 0) {
                reco.push({ id: "reco-backlog", severity: "info", icon: <Lightbulb className="h-4 w-4" />, label: "Convertir le CDC en backlog", detail: "Des items de CDC existent — créez un backlog pour les suivre en sprint" });
              }
              if (daysSinceActivity !== null && daysSinceActivity >= 5 && daysSinceActivity < 10) {
                reco.push({ id: "reco-activity", severity: "info", icon: <Lightbulb className="h-4 w-4" />, label: "Planifier un point client", detail: `Pas d'activité depuis ${daysSinceActivity} jours — un suivi régulier est recommandé`, action: { label: "Voir activités", tab: "activities" } });
              }

              const allClear = alerts.length === 0 && actions.length === 0 && business.length === 0 && reco.length === 0;

              const severityConfig = {
                critical: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-900", icon: "text-red-600 dark:text-red-400", text: "text-red-900 dark:text-red-100", detail: "text-red-600 dark:text-red-400" },
                warning:  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-900", icon: "text-amber-600 dark:text-amber-400", text: "text-amber-900 dark:text-amber-100", detail: "text-amber-600 dark:text-amber-400" },
                info:     { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-900", icon: "text-blue-600 dark:text-blue-400", text: "text-blue-900 dark:text-blue-100", detail: "text-blue-600 dark:text-blue-400" },
                ok:       { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-900", icon: "text-green-600 dark:text-green-400", text: "text-green-900 dark:text-green-100", detail: "text-green-600 dark:text-green-400" },
              };

              const renderIndicators = (items: Indicator[]) => (
                <div className="space-y-2">
                  {items.map(item => {
                    const cfg = severityConfig[item.severity];
                    return (
                      <div key={item.id} className={cn("flex items-start gap-3 rounded-md border px-3 py-2.5", cfg.bg, cfg.border)} data-testid={`indicator-${item.id}`}>
                        <span className={cn("mt-0.5 shrink-0", cfg.icon)}>{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-[13px] font-medium leading-tight", cfg.text)}>{item.label}</p>
                          {item.detail && <p className={cn("text-[11px] mt-0.5 leading-snug", cfg.detail)}>{item.detail}</p>}
                        </div>
                        {item.action && (
                          <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2 shrink-0" onClick={() => setActiveTab(item.action!.tab)}>
                            {item.action.label}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );

              type SectionProps = { sectionKey: string; max: number; title: string; icon: React.ReactNode; items: Indicator[]; emptyMsg: string; accentClass?: string };
              const Section = ({ sectionKey, max, title, icon, items, emptyMsg, accentClass }: SectionProps) => {
                const isExpanded = overviewExpanded[sectionKey] ?? false;
                const displayed = isExpanded ? items : items.slice(0, max);
                const hasMore = items.length > max;
                return (
                  <Card className="p-4">
                    <p className={cn("text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5", accentClass || "text-muted-foreground")}>
                      {icon} {title}
                      {items.length > 0 && <span className="ml-auto text-[10px] font-normal text-muted-foreground normal-case tracking-normal">{items.length}</span>}
                    </p>
                    {items.length > 0 ? (
                      <>
                        {renderIndicators(displayed)}
                        {hasMore && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2 h-7 text-[11px] text-muted-foreground"
                            onClick={() => setOverviewExpanded(prev => ({ ...prev, [sectionKey]: !isExpanded }))}
                          >
                            {isExpanded ? `Réduire` : `Voir plus (${items.length - max} de plus)`}
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <p className="text-xs">{emptyMsg}</p>
                      </div>
                    )}
                  </Card>
                );
              };

              return (
                <div className="space-y-4">
                  {allClear && (
                    <Card className="p-4 flex items-center gap-3 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">Tout est en ordre</p>
                        <p className="text-xs text-green-700 dark:text-green-400">Aucune alerte ni action en attente sur ce projet.</p>
                      </div>
                    </Card>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Section sectionKey="alerts" max={3} title="Alertes" icon={<AlertTriangle className="h-3 w-3" />} items={alerts} emptyMsg="Aucune alerte active" accentClass="text-red-500 dark:text-red-400" />
                    <Section sectionKey="actions" max={5} title="Actions à faire" icon={<ListTodo className="h-3 w-3" />} items={actions} emptyMsg="Aucune action immédiate" accentClass="text-blue-600 dark:text-blue-400" />
                    <Section sectionKey="business" max={2} title="Actions business" icon={<TrendingUp className="h-3 w-3" />} items={business} emptyMsg="Aucune opportunité détectée" accentClass="text-emerald-600 dark:text-emerald-400" />
                    <Section sectionKey="reco" max={3} title="Recommandations" icon={<Lightbulb className="h-3 w-3" />} items={reco} emptyMsg="Aucune recommandation pour le moment" accentClass="text-violet-600 dark:text-violet-400" />
                  </div>
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="tasks" id="tasks-section" className="mt-0">
            <div className="space-y-4">
              {/* Warning: Tasks without sprint */}
              {hasTasksWithoutSprint && (
                <Badge 
                  variant="outline"
                  className="border-muted-foreground/30 text-muted-foreground text-xs"
                  data-testid="warning-tasks-no-sprint"
                >
                  <Info className="h-3 w-3 mr-1" />
                  Tâches sans sprint associé
                </Badge>
              )}
              
              {/* Cross-module context: Link to Backlog */}
              {projectBacklogs.length > 0 && (
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-muted">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">
                      {projectBacklogs.length} backlog{projectBacklogs.length > 1 ? 's' : ''} associé{projectBacklogs.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs gap-1"
                    onClick={() => setActiveTab("backlogs")}
                    data-testid="link-to-backlogs"
                  >
                    Voir backlogs
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Barre de progression des tâches */}
              {totalTasksCount > 0 && (
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Progression</span>
                        <span className="text-sm font-semibold" data-testid="progress-percentage">
                          {progressPercentage}%
                        </span>
                      </div>
                      <Progress value={progressPercentage} className="h-2" data-testid="progress-bar" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span data-testid="completed-tasks-count">{completedTasksCount} tâche{completedTasksCount !== 1 ? 's' : ''} terminée{completedTasksCount !== 1 ? 's' : ''}</span>
                        <span data-testid="total-tasks-count">{totalTasksCount} tâche{totalTasksCount !== 1 ? 's' : ''} au total</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Liste des tâches */}
              <Card className="bg-white dark:bg-card">
                <CardContent className="pt-6">
                  <div className="flex justify-end mb-4">
                    <Button 
                      size="sm" 
                      onClick={() => createTaskMutation.mutate()}
                      disabled={createTaskMutation.isPending}
                      data-testid="button-create-task"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {createTaskMutation.isPending ? "Création..." : "Créer une tâche"}
                    </Button>
                  </div>
                  {projectTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-[12px]">
                      Aucune tâche associée à ce projet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {columns.map((column) => {
                        const columnTasks = tasksByStatus[column.id] || [];
                        if (columnTasks.length === 0) return null;
                        
                        return (
                          <div key={column.id} className="space-y-2">
                            <div className="flex items-center gap-2 py-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: column.color }}
                              />
                              <h3 className="text-sm font-semibold">{column.name}</h3>
                              <Badge variant="outline" className="text-xs">{columnTasks.length}</Badge>
                            </div>
                            {columnTasks.map((task) => {
                              const assignedUser = users.find(u => u.id === task.assignedToId);
                              const taskColumn = columns.find(c => c.id === task.columnId);
                              
                              return (
                                <div 
                                  key={task.id}
                                  className="p-3 bg-white dark:bg-card border rounded-md hover-elevate cursor-pointer"
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setIsTaskDetailDialogOpen(true);
                                  }}
                                  data-testid={`task-${task.id}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 
                                          className="text-sm font-medium"
                                          data-testid={`title-task-${task.id}`}
                                        >
                                          {task.title}
                                        </h4>
                                        {task.priority && task.priority !== "medium" && (
                                          <Badge 
                                            variant="outline" 
                                            className={cn(
                                              "text-[10px] h-5",
                                              task.priority === "high" && "border-red-500 text-red-500",
                                              task.priority === "low" && "border-gray-400 text-gray-400"
                                            )}
                                          >
                                            {task.priority === "high" ? "Haute" : "Basse"}
                                          </Badge>
                                        )}
                                      </div>
                                      {task.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                          {task.description}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-3 mt-2">
                                        {task.dueDate && (
                                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <CalendarIcon className="h-3 w-3" />
                                            {format(new Date(task.dueDate), "dd MMM yyyy", { locale: fr })}
                                          </div>
                                        )}
                                        {task.estimatedHours && (
                                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {task.estimatedHours}h
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {assignedUser && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Avatar className="h-7 w-7">
                                              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                                                {assignedUser.firstName?.[0]}{assignedUser.lastName?.[0]}
                                              </AvatarFallback>
                                            </Avatar>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            {assignedUser.firstName} {assignedUser.lastName}
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteTaskId(task.id);
                                          setIsDeleteTaskDialogOpen(true);
                                        }}
                                        data-testid={`button-delete-task-${task.id}`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-end mb-4">
                  <Button 
                    size="sm" 
                    onClick={() => createNoteMutation.mutate()}
                    disabled={createNoteMutation.isPending}
                    data-testid="button-create-note"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {createNoteMutation.isPending ? "Création..." : "Créer une note"}
                  </Button>
                </div>
                {projectNotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-[12px]">
                    Aucune note liée à ce projet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projectNotes.map((note) => (
                      <Link key={note.id} href={`/notes/${note.id}`}>
                        <div className="p-4 border rounded-md hover-elevate cursor-pointer" data-testid={`note-${note.id}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium mb-1" data-testid={`title-note-${note.id}`}>
                                {note.title || "Sans titre"}
                              </h4>
                              {note.summary && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {note.summary}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {note.status === "draft" ? t.common.draft : note.status === "active" ? t.common.active : t.common.archived}
                                </Badge>
                                {note.updatedAt && (
                                  <span className="text-[11px] text-muted-foreground">
                                    Modifié {format(new Date(note.updatedAt), "dd MMM yyyy", { locale: fr })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-end gap-2 mb-4">
                  <input
                    ref={projectImportRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept="*/*"
                    onChange={handleProjectFileUpload}
                    data-testid="input-import-project-file"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => projectImportRef.current?.click()}
                    disabled={uploadingProjectFiles}
                    data-testid="button-import-project-file"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadingProjectFiles ? "Import en cours..." : "Importer"}
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => createDocumentMutation.mutate()}
                    disabled={createDocumentMutation.isPending}
                    data-testid="button-create-document"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {createDocumentMutation.isPending ? "Création..." : "Créer un document"}
                  </Button>
                </div>
                {projectDocuments.length === 0 && projectUploadFiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-[12px]">
                    Aucun document lié à ce projet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {projectDocuments.length > 0 && (
                      <div className="space-y-2">
                        {projectDocuments.map((document) => (
                          <Link key={document.id} href={`/documents/${document.id}`}>
                            <div className="p-4 border rounded-md hover-elevate cursor-pointer" data-testid={`document-${document.id}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <h4 className="text-sm font-medium mb-1" data-testid={`title-document-${document.id}`}>
                                    {document.name || "Sans titre"}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge 
                                      variant={document.status === "draft" ? "outline" : "default"}
                                      className={document.status === "draft" ? "text-muted-foreground" : "bg-green-600 dark:bg-green-700 text-white"}
                                      data-testid={`status-${document.id}`}
                                    >
                                      {document.status === "draft" ? t.common.draft : 
                                       document.status === "published" ? t.common.published : t.common.archived}
                                    </Badge>
                                    {document.updatedAt && (
                                      <span className="text-[11px] text-muted-foreground">
                                        Modifié {format(new Date(document.updatedAt), "dd MMM yyyy", { locale: fr })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                    {projectUploadFiles.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-2">Fichiers importés</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {projectUploadFiles.map((f: any) => {
                            const isImage = f.mimeType && f.mimeType.startsWith("image/");
                            return (
                              <div
                                key={f.id}
                                className="group relative border rounded-md p-3 bg-muted/30 hover-elevate cursor-pointer flex flex-col gap-2"
                                onClick={() => handleOpenProjectFilePreview(f)}
                                data-testid={`project-upload-file-${f.id}`}
                              >
                                <div className="flex items-center justify-center h-12">
                                  {isImage ? (
                                    <Image className="h-8 w-8 text-muted-foreground" />
                                  ) : (
                                    <File className="h-8 w-8 text-muted-foreground" />
                                  )}
                                </div>
                                {renamingProjectFileId === f.id ? (
                                  <Input
                                    value={renameProjectFileName}
                                    onChange={e => setRenameProjectFileName(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    onKeyDown={e => {
                                      e.stopPropagation();
                                      if (e.key === "Enter") renameProjectFileMutation.mutate({ id: f.id, name: renameProjectFileName });
                                      if (e.key === "Escape") setRenamingProjectFileId(null);
                                    }}
                                    autoFocus
                                    className="text-xs h-6 px-1"
                                    data-testid={`input-rename-project-file-${f.id}`}
                                  />
                                ) : (
                                  <p className="text-xs text-center truncate leading-tight">{f.name}</p>
                                )}
                                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={e => { e.stopPropagation(); setRenamingProjectFileId(f.id); setRenameProjectFileName(f.name); }}
                                    data-testid={`button-rename-project-file-${f.id}`}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={e => { e.stopPropagation(); deleteProjectFileMutation.mutate(f.id); }}
                                    data-testid={`button-delete-project-file-${f.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preview modal for project uploaded files */}
          <Dialog open={!!previewProjectFile} onOpenChange={open => !open && setPreviewProjectFile(null)}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{previewProjectFile?.name}</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-center min-h-[300px] bg-muted/30 rounded-md overflow-hidden">
                {previewProjectFile?.mimeType?.startsWith("image/") ? (
                  <img src={previewProjectFile.url} alt={previewProjectFile.name} className="max-w-full max-h-[70vh] object-contain" />
                ) : previewProjectFile?.mimeType === "application/pdf" ? (
                  <iframe src={previewProjectFile.url} className="w-full h-[70vh] border-0" title={previewProjectFile.name} />
                ) : (
                  <div className="text-center space-y-3 p-8">
                    <File className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">Aperçu non disponible pour ce type de fichier.</p>
                    <Button size="sm" asChild>
                      <a href={previewProjectFile?.url} download={previewProjectFile?.name} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <TabsContent value="fichiers" className="mt-0">
            <div className="h-[600px] flex flex-col">
              <FileExplorer projectId={id} />
            </div>
          </TabsContent>

          <TabsContent value="backlogs" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                {projectBacklogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-[12px]">
                    Aucun backlog associé à ce projet.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden bg-card">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr className="text-left text-xs font-medium text-muted-foreground">
                          <th className="px-4 py-2 w-8"></th>
                          <th className="px-4 py-2">Nom</th>
                          <th className="px-4 py-2 hidden sm:table-cell">Mode</th>
                          <th className="px-4 py-2 hidden md:table-cell">Sprint actif</th>
                          <th className="px-4 py-2 hidden lg:table-cell">Tickets</th>
                          <th className="px-4 py-2 hidden xl:table-cell">Créateur</th>
                          <th className="px-4 py-2 hidden lg:table-cell">Créé le</th>
                          <th className="px-4 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {projectBacklogs.map((backlog) => {
                          const todoCount = backlog.ticketCounts?.todo || 0;
                          const inProgressCount = backlog.ticketCounts?.inProgress || 0;
                          const doneCount = backlog.ticketCounts?.done || 0;
                          const totalTickets = todoCount + inProgressCount + doneCount;
                          const creatorName = backlog.creator 
                            ? (backlog.creator.firstName && backlog.creator.lastName 
                                ? `${backlog.creator.firstName} ${backlog.creator.lastName}`
                                : backlog.creator.email)
                            : null;
                          const modeLabel = backlogModeOptions.find(m => m.value === backlog.mode)?.label || backlog.mode;
                          const isExpanded = expandedBacklogs.has(backlog.id);
                          
                          return (
                            <BacklogRowWithTickets 
                              key={backlog.id}
                              backlog={backlog}
                              isExpanded={isExpanded}
                              onToggle={() => toggleBacklogExpanded(backlog.id)}
                              todoCount={todoCount}
                              inProgressCount={inProgressCount}
                              doneCount={doneCount}
                              totalTickets={totalTickets}
                              creatorName={creatorName}
                              modeLabel={modeLabel}
                              navigate={navigate}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roadmap" className="mt-0">
            {project?.accountId ? (
              <RoadmapTab projectId={id!} accountId={project.accountId} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center py-12">
                    <Loader />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="resources" className="mt-0">
            {project?.accountId ? (
              <ResourcesTab projectId={id!} accountId={project.accountId} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center py-12">
                    <Loader />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="billing" className="mt-0">
            {/* Cross-module context: Link to Time tracking */}
            {projectTimeEntries.length > 0 && (
              <div className="flex items-center justify-between p-2 mb-4 bg-muted/30 rounded-lg border border-muted">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">
                    {(projectTimeEntries.reduce((sum, e) => sum + (e.duration || 0), 0) / 3600).toFixed(1)}h enregistrées 
                    {profitabilityMetrics && ` = ${profitabilityMetrics.actualDaysWorked.toFixed(1)}j travaillés`}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs gap-1"
                  onClick={() => setActiveTab("time")}
                  data-testid="link-to-time"
                >
                  Voir temps
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Section Title: Budget et facturation */}
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <h3 className="text-lg font-semibold">Budget et facturation</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {hasFeature("ai_assistant") ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={handleAiProjectAnalysis}
                    disabled={isAiAnalysisLoading}
                    data-testid="button-ai-project-analysis"
                  >
                    {isAiAnalysisLoading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Bot className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Analyser avec l'IA
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setLocation("/pricing")}
                    data-testid="button-ai-project-analysis-upgrade"
                  >
                    <Crown className="h-3.5 w-3.5 mr-1.5 text-violet-500" />
                    Analyser avec l'IA
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsSimulationOpen(true)}
                  data-testid="button-open-simulation"
                >
                  <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
                  Simuler
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  className="bg-primary text-xs"
                  onClick={() => setIsBillingSettingsOpen(true)}
                  data-testid="button-open-billing-settings"
                >
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  Facturation
                </Button>
              </div>
            </div>

            {/* AI Analysis Result Panel */}
            {isAiAnalysisOpen && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-violet-100 dark:bg-violet-900/30 p-1">
                        <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <span className="text-sm font-semibold">Analyse IA du projet</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground px-2"
                      onClick={() => { setIsAiAnalysisOpen(false); setAiAnalysisResult(null); setAiAnalysisError(null); }}
                      data-testid="button-close-ai-analysis"
                    >
                      Fermer
                    </Button>
                  </div>
                  {isAiAnalysisLoading && (
                    <div className="flex items-center gap-2 py-4 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Analyse en cours...</span>
                    </div>
                  )}
                  {aiAnalysisError && (
                    <p className="text-sm text-destructive">{aiAnalysisError}</p>
                  )}
                  {aiAnalysisResult && (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{aiAnalysisResult}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* KPIs Facturation - 2 lignes de 3 cartes */}
            {(() => {
              // Use reactive state values for real-time KPI updates
              const totalBilled = parseFloat(totalBilledValue || "0") || 0;
              const numberOfDays = parseFloat(numberOfDaysValue || "0") || 0;
              const effectiveDailyRate = numberOfDays > 0 ? totalBilled / numberOfDays : 0;
              const isForfait = project?.billingType === "fixed";
              
              // Données du service profitabilité
              const estimatedCost = profitabilityMetrics?.totalCost || 0;
              const margin = profitabilityMetrics?.margin || 0;
              const marginPercent = profitabilityMetrics?.marginPercent || 0;
              const targetMarginPercent = profitabilityMetrics?.targetMarginPercent || 30;
              
              // Prix recommandé = Coût estimé / (1 - marge cible %)
              const recommendedPrice = estimatedCost > 0 && targetMarginPercent < 100
                ? estimatedCost / (1 - targetMarginPercent / 100)
                : 0;
              
              return (
                <div className="space-y-4 mb-4">
                  {/* Ligne 1: Montant facturé, Nombre de jours facturé, TJM facturé */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-violet-100 dark:bg-violet-900/20 border-2 border-violet-400 dark:border-violet-600">
                      <CardContent className="pt-4 pb-4">
                        <div className="text-xs text-muted-foreground mb-1">Montant facturé</div>
                        <div className="text-lg font-bold text-primary" data-testid="kpi-total-billed">
                          {totalBilled.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1" data-testid="kpi-billing-type">
                          {project?.billingType === "fixed_price" ? "Au forfait" : 
                           project?.billingType === "time_based" ? "En régie" : 
                           "Mode de facturation non défini"}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <div className="text-xs text-muted-foreground mb-1">Nombre de jours facturé</div>
                        <div className="text-lg font-bold" data-testid="kpi-number-of-days">
                          {numberOfDays > 0 ? `${numberOfDays} j` : "-"}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                            {isForfait ? "Forfait" : "Temps passé"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                            {project?.billingUnit === "day" ? "Jour" : "Heure"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-help">
                                <div className="text-xs text-muted-foreground mb-1">
                                  {isForfait ? "TJM facturé" : "TJM projet"}
                                </div>
                                <div className="text-lg font-bold" data-testid="kpi-effective-tjm">
                                  {isForfait 
                                    ? (effectiveDailyRate > 0 
                                        ? effectiveDailyRate.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })
                                        : "-")
                                    : (effectiveTJMData?.effectiveTJM 
                                        ? `${effectiveTJMData.effectiveTJM} €`
                                        : "-")
                                  }
                                </div>
                                {effectiveTJMData?.effectiveTJM && effectiveTJMData.effectiveTJM > 0 && (
                                  <div className="text-[10px] text-muted-foreground mt-1">
                                    TJM cible : {effectiveTJMData.effectiveTJM.toLocaleString("fr-FR")} €
                                    {effectiveTJMData.source === 'global' && " (global)"}
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs bg-white dark:bg-gray-800 text-foreground">
                              <p className="text-sm">{isForfait ? "Taux journalier réel calculé sur ce projet." : "Taux journalier moyen défini pour ce projet."}</p>
                              <p className="text-xs text-muted-foreground mt-1">{isForfait ? "Formule : Montant facturé ÷ Nombre de jours" : "Défini dans les paramètres du projet ou global"}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-help border-l pl-4">
                                <div className="text-xs text-muted-foreground mb-1">TJM réel</div>
                                <div className="text-lg font-bold" data-testid="kpi-actual-tjm">
                                  {profitabilityMetrics?.actualTJM && profitabilityMetrics.actualTJM > 0
                                    ? profitabilityMetrics.actualTJM.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })
                                    : "-"}
                                </div>
                                {(() => {
                                  const tjmFacture = isForfait ? effectiveDailyRate : (effectiveTJMData?.effectiveTJM || 0);
                                  const tjmReel = profitabilityMetrics?.actualTJM || 0;
                                  const ecart = tjmReel - tjmFacture;
                                  if (tjmFacture > 0 && tjmReel > 0) {
                                    return (
                                      <div className={`text-[10px] mt-1 ${ecart >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        Écart : {ecart >= 0 ? "+" : ""}{ecart.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs bg-white dark:bg-gray-800 text-foreground">
                              <p className="text-sm">TJM réel basé sur le CA encaissé et les jours travaillés.</p>
                              <p className="text-xs text-muted-foreground mt-1">Formule : CA encaissé ÷ Jours travaillés</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Ligne 2: Prix minimum recommandé, Coût actualisé, Marge prévisionnelle */}
                  <div className="grid grid-cols-3 gap-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="cursor-help">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-xs text-muted-foreground mb-1">Prix minimum recommandé</div>
                            <div className="text-lg font-bold" data-testid="kpi-recommended-price">
                              {recommendedPrice > 0 
                                ? recommendedPrice.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })
                                : "-"}
                            </div>
                            {recommendedPrice > 0 && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                Pour {targetMarginPercent}% de marge
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-white dark:bg-gray-800 text-foreground">
                        <p className="text-sm font-medium">Le prix de vente minimum à proposer au client pour garantir votre rentabilité.</p>
                        <p className="text-xs text-muted-foreground mt-1">Prix de vente minimum pour atteindre votre marge cible.</p>
                        <p className="text-xs text-muted-foreground mt-1">Formule : Coût actualisé ÷ (1 - Marge cible %)</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="cursor-help">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-xs text-muted-foreground mb-1">Coût actualisé</div>
                            <div className="text-lg font-bold" data-testid="kpi-estimated-cost">
                              {estimatedCost > 0 
                                ? estimatedCost.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })
                                : "-"}
                            </div>
                            {profitabilityMetrics?.actualDaysWorked && profitabilityMetrics.actualDaysWorked > 0 && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {profitabilityMetrics.actualDaysWorked.toFixed(1)} j × TJM cible
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-white dark:bg-gray-800 text-foreground">
                        <p className="text-sm font-medium">Ce que le projet vous coûte réellement en ressources internes.</p>
                        <p className="text-xs text-muted-foreground mt-1">Coût interne basé sur le temps travaillé.</p>
                        <p className="text-xs text-muted-foreground mt-1">Formule : Jours travaillés × TJM cible</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="cursor-help">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-xs text-muted-foreground mb-1">Marge réelle actualisée</div>
                            <div 
                              className="text-lg font-bold" 
                              style={{
                                color: (estimatedCost > 0 || profitabilityMetrics?.totalPaid)
                                  ? (marginPercent >= targetMarginPercent 
                                      ? '#16a34a' // green-600
                                      : marginPercent >= targetMarginPercent * 0.7 
                                        ? '#eab308' // yellow-500
                                        : marginPercent >= targetMarginPercent * 0.4 
                                          ? '#f97316' // orange-500
                                          : '#dc2626') // red-600
                                  : undefined
                              }}
                              data-testid="kpi-margin"
                            >
                              {(estimatedCost > 0 || profitabilityMetrics?.totalPaid) 
                                ? margin.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })
                                : "-"}
                            </div>
                            {(estimatedCost > 0 || profitabilityMetrics?.totalPaid) && (
                              <div 
                                className="text-[10px] mt-1"
                                style={{
                                  color: marginPercent >= targetMarginPercent 
                                    ? '#16a34a' // green-600
                                    : marginPercent >= targetMarginPercent * 0.7 
                                      ? '#eab308' // yellow-500
                                      : marginPercent >= targetMarginPercent * 0.4 
                                        ? '#f97316' // orange-500
                                        : '#dc2626' // red-600
                                }}
                              >
                                {marginPercent.toFixed(1)}% de marge
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-white dark:bg-gray-800 text-foreground">
                        <p className="text-sm">Différence entre le montant facturé et le coût actualisé.</p>
                        <p className="text-xs text-muted-foreground mt-1">Formule : Montant facturé - Coût actualisé</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })()}

            {/* Project Scope Section - CDC avec allocation de temps - Collapsible */}
            <div id="scope-section" className="mt-4">
              <Collapsible open={isCdcSectionExpanded} onOpenChange={setIsCdcSectionExpanded}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardTitle className="text-base flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Cahier des charges - Chiffrage
                          {projectScopeItems && projectScopeItems.length > 0 && (
                            <Badge variant="outline" className="text-xs">{projectScopeItems.length}</Badge>
                          )}
                        </div>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isCdcSectionExpanded && "rotate-180")} />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <ProjectScopeSection
                        projectId={id!}
                        projectName={project?.name || 'Projet'}
                        dailyRate={effectiveTJMData?.effectiveTJM || 0}
                        internalDailyCost={effectiveTJMData?.effectiveInternalDailyCost || 0}
                        targetMarginPercent={parseFloat(project?.targetMarginPercent?.toString() || "0")}
                        budget={parseFloat(project?.totalBilled?.toString() || project?.budget?.toString() || "0")}
                        projectStage={project?.stage || 'prospection'}
                        tjmSource={effectiveTJMData?.source}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>

            {/* Payment Tracking Section */}
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Euro className="h-5 w-5" />
                    Suivi des paiements
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowPaymentForm(true);
                      setPaymentAmount(remainingAmount > 0 ? remainingAmount.toFixed(2) : "");
                      setPaymentDate(new Date());
                      setPaymentDescription("");
                      setIsPartialPayments(false);
                      setInstallments([{ amount: "", date: new Date(), pickerOpen: false }]);
                    }}
                    data-testid="button-add-payment"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter un paiement
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress bar - totalBilled has priority over budget */}
                {(() => {
                  const effectiveBudget = parseFloat(project?.totalBilled?.toString() || project?.budget?.toString() || "0");
                  return effectiveBudget > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progression du paiement</span>
                        <span className="font-medium">
                          {totalPaid.toFixed(2)} € / {effectiveBudget.toFixed(2)} €
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, (totalPaid / effectiveBudget) * 100)} 
                        className="h-2"
                        data-testid="progress-payment"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{((totalPaid / effectiveBudget) * 100).toFixed(0)}% payé</span>
                        <span>{remainingAmount > 0 ? `${remainingAmount.toFixed(2)} € restant` : "Entièrement payé"}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Payment form */}
                {showPaymentForm && (
                  <div className="border rounded-lg p-4 space-y-4 bg-muted/30" data-testid="form-payment">
                    {/* Partial payments toggle */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="partial-payments"
                        checked={isPartialPayments}
                        onCheckedChange={(checked) => {
                          setIsPartialPayments(!!checked);
                          if (checked) {
                            setInstallments([{ amount: "", date: new Date(), pickerOpen: false }]);
                          }
                        }}
                        data-testid="checkbox-partial-payments"
                      />
                      <Label htmlFor="partial-payments" className="text-sm cursor-pointer">Plusieurs paiements partiels</Label>
                    </div>

                    {!isPartialPayments ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="payment-amount" className="text-xs">Montant (€)</Label>
                            <Input
                              id="payment-amount"
                              type="number"
                              step="0.01"
                              placeholder={remainingAmount > 0 ? remainingAmount.toFixed(2) : "0.00"}
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              data-testid="input-payment-amount"
                            />
                            {remainingAmount > 0 && paymentAmount !== remainingAmount.toFixed(2) && (
                              <Button
                                variant="link"
                                size="sm"
                                className="px-0 h-auto text-xs"
                                onClick={() => setPaymentAmount(remainingAmount.toFixed(2))}
                                data-testid="button-autofill-amount"
                              >
                                Compléter avec le solde ({remainingAmount.toFixed(2)} €)
                              </Button>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs">Date du paiement</Label>
                            <Popover open={isPaymentDatePickerOpen} onOpenChange={setIsPaymentDatePickerOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal bg-popover",
                                    !paymentDate && "text-muted-foreground"
                                  )}
                                  data-testid="button-payment-date"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {paymentDate ? format(paymentDate, "dd MMM yyyy", { locale: fr }) : "Sélectionner"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={paymentDate}
                                  onSelect={(date) => {
                                    setPaymentDate(date);
                                    setIsPaymentDatePickerOpen(false);
                                  }}
                                  initialFocus
                                  locale={fr}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="payment-description" className="text-xs">Description (optionnelle)</Label>
                          <Input
                            id="payment-description"
                            placeholder="Note ou référence du paiement"
                            value={paymentDescription}
                            onChange={(e) => setPaymentDescription(e.target.value)}
                            data-testid="input-payment-description"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <Label className="text-xs text-muted-foreground">Définissez chaque échéance de paiement</Label>
                        {installments.map((inst, idx) => (
                          <div key={idx} className="flex gap-2 items-start">
                            <div className="flex-1">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Montant (€)"
                                value={inst.amount}
                                onChange={(e) => {
                                  const updated = [...installments];
                                  updated[idx] = { ...updated[idx], amount: e.target.value };
                                  setInstallments(updated);
                                }}
                                data-testid={`input-installment-amount-${idx}`}
                              />
                            </div>
                            <div className="flex-1">
                              <Popover
                                open={inst.pickerOpen}
                                onOpenChange={(open) => {
                                  const updated = [...installments];
                                  updated[idx] = { ...updated[idx], pickerOpen: open };
                                  setInstallments(updated);
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal bg-popover",
                                      !inst.date && "text-muted-foreground"
                                    )}
                                    data-testid={`button-installment-date-${idx}`}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {inst.date ? format(inst.date, "dd MMM yyyy", { locale: fr }) : "Date"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={inst.date}
                                    onSelect={(date) => {
                                      const updated = [...installments];
                                      updated[idx] = { ...updated[idx], date, pickerOpen: false };
                                      setInstallments(updated);
                                    }}
                                    initialFocus
                                    locale={fr}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive mt-0 shrink-0"
                              onClick={() => setInstallments(installments.filter((_, i) => i !== idx))}
                              disabled={installments.length === 1}
                              data-testid={`button-remove-installment-${idx}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setInstallments([...installments, { amount: "", date: new Date(), pickerOpen: false }])}
                          data-testid="button-add-installment"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter une échéance
                        </Button>
                        {remainingAmount > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Solde restant : <span className="font-medium text-foreground">{remainingAmount.toFixed(2)} €</span>
                            {installments.length > 0 && (() => {
                              const total = installments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                              return total > 0 ? ` · Total saisi : ${total.toFixed(2)} €` : null;
                            })()}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowPaymentForm(false)}
                        data-testid="button-cancel-payment"
                      >
                        Annuler
                      </Button>
                      <Button
                        onClick={async () => {
                          try {
                            if (isPartialPayments) {
                              const invalid = installments.some(i => !i.amount || !i.date);
                              if (invalid) {
                                toast({ title: "Erreur", description: "Veuillez remplir le montant et la date de chaque échéance", variant: "destructive" });
                                return;
                              }
                              await Promise.all(
                                installments.map((inst) =>
                                  apiRequest(`/api/projects/${id}/payments`, "POST", {
                                    amount: inst.amount,
                                    paymentDate: formatDateForStorage(inst.date!),
                                    description: null,
                                  })
                                )
                              );
                              queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'payments'] });
                              queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                              queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
                              setShowPaymentForm(false);
                              toast({
                                title: "Paiements enregistrés",
                                description: `${installments.length} échéance(s) enregistrée(s)`,
                                variant: "success",
                              });
                            } else {
                              if (!paymentAmount || !paymentDate) {
                                toast({ title: "Erreur", description: "Veuillez remplir le montant et la date", variant: "destructive" });
                                return;
                              }
                              await apiRequest(`/api/projects/${id}/payments`, "POST", {
                                amount: paymentAmount,
                                paymentDate: formatDateForStorage(paymentDate),
                                description: paymentDescription || null,
                              });
                              queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'payments'] });
                              queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                              queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
                              setShowPaymentForm(false);
                              setPaymentAmount("");
                              setPaymentDescription("");
                              toast({
                                title: "Paiement enregistré",
                                description: `Paiement de ${parseFloat(paymentAmount).toFixed(2)} € enregistré`,
                                variant: "success",
                              });
                            }
                          } catch (error: any) {
                            toast({
                              title: "Erreur",
                              description: error.message || "Impossible d'enregistrer le paiement",
                              variant: "destructive",
                            });
                          }
                        }}
                        data-testid="button-save-payment"
                      >
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                )}

                {/* Payment history */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Historique des paiements</h4>
                  {payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4 text-center">
                      Aucun paiement enregistré
                    </p>
                  ) : (
                    <div>
                      {[...payments].sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()).map((payment, idx) => (
                        <div key={payment.id}>
                        {idx > 0 && <hr className="border-border" />}
                        <div
                          className="flex items-center justify-between py-2.5"
                          data-testid={`payment-item-${payment.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${payment.isPaid ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                              {payment.isPaid
                                ? <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                : <CalendarIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              }
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold">
                                  {parseFloat(payment.amount).toFixed(2)} €
                                </span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${payment.isPaid ? "text-green-600 border-green-300" : "text-amber-600 border-amber-300"}`}>
                                  {payment.isPaid ? "Réglé" : "Prévu"}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(payment.paymentDate), "dd MMM yyyy", { locale: fr })}
                                {payment.description && ` — ${payment.description}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`text-xs h-7 px-2 ${payment.isPaid ? "text-amber-600" : "text-green-600"}`}
                              onClick={async () => {
                                try {
                                  await apiRequest(`/api/payments/${payment.id}`, "PATCH", { isPaid: !payment.isPaid });
                                  queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'payments'] });
                                  queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
                                } catch (e: any) {
                                  toast({ title: "Erreur", description: e.message, variant: "destructive" });
                                }
                              }}
                              data-testid={`button-toggle-paid-${payment.id}`}
                            >
                              {payment.isPaid ? "Annuler" : "Régler"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingPayment(payment);
                                setEditPaymentAmount(payment.amount);
                                setEditPaymentDate(new Date(payment.paymentDate));
                                setEditPaymentDescription(payment.description || "");
                              }}
                              data-testid={`button-edit-payment-${payment.id}`}
                              className="h-8 w-8 text-muted-foreground"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletePaymentId(payment.id)}
                              data-testid={`button-delete-payment-${payment.id}`}
                              className="h-8 w-8 text-muted-foreground"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Edit Payment Dialog */}
            <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Modifier le paiement</DialogTitle>
                  <DialogDescription>
                    Modifiez les informations du paiement.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="edit-payment-amount" className="text-sm">Montant (€)</Label>
                    <Input
                      id="edit-payment-amount"
                      type="number"
                      step="0.01"
                      value={editPaymentAmount}
                      onChange={(e) => setEditPaymentAmount(e.target.value)}
                      data-testid="input-edit-payment-amount"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Date du paiement</Label>
                    <Popover open={isEditPaymentDatePickerOpen} onOpenChange={setIsEditPaymentDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-popover",
                            !editPaymentDate && "text-muted-foreground"
                          )}
                          data-testid="button-edit-payment-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {editPaymentDate ? format(editPaymentDate, "dd MMM yyyy", { locale: fr }) : "Sélectionner"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={editPaymentDate}
                          onSelect={(date) => {
                            setEditPaymentDate(date);
                            setIsEditPaymentDatePickerOpen(false);
                          }}
                          initialFocus
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="edit-payment-description" className="text-sm">Description (optionnelle)</Label>
                    <Input
                      id="edit-payment-description"
                      placeholder="Note ou référence du paiement"
                      value={editPaymentDescription}
                      onChange={(e) => setEditPaymentDescription(e.target.value)}
                      data-testid="input-edit-payment-description"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setEditingPayment(null)}
                    data-testid="button-cancel-edit-payment"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!editPaymentAmount || !editPaymentDate || !editingPayment) {
                        toast({
                          title: "Erreur",
                          description: "Veuillez remplir le montant et la date",
                          variant: "destructive",
                        });
                        return;
                      }
                      try {
                        await apiRequest(`/api/payments/${editingPayment.id}`, "PATCH", {
                          amount: editPaymentAmount,
                          paymentDate: formatDateForStorage(editPaymentDate),
                          description: editPaymentDescription || null,
                        });
                        queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'payments'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                        setEditingPayment(null);
                        toast({
                          title: "Paiement modifié",
                          description: "Le paiement a été mis à jour avec succès",
                          variant: "success",
                        });
                      } catch (error: any) {
                        toast({
                          title: "Erreur",
                          description: error.message || "Impossible de modifier le paiement",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="button-save-edit-payment"
                  >
                    Enregistrer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Payment Confirmation Dialog */}
            <AlertDialog open={!!deletePaymentId} onOpenChange={(open) => !open && setDeletePaymentId(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Le paiement sera définitivement supprimé et le statut de facturation sera recalculé.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete-payment">Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      if (deletePaymentId) {
                        try {
                          await apiRequest(`/api/payments/${deletePaymentId}`, "DELETE");
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'payments'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                          setDeletePaymentId(null);
                          toast({
                            title: "Paiement supprimé",
                            description: "Le paiement a été supprimé avec succès",
                            variant: "success",
                          });
                        } catch (error: any) {
                          toast({
                            title: "Erreur",
                            description: error.message || "Impossible de supprimer le paiement",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                    className="bg-destructive hover:bg-destructive/90"
                    data-testid="button-confirm-delete-payment"
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          <TabsContent value="time" className="mt-0">
            <TimeTrackingTab projectId={id!} project={project} />
          </TabsContent>

          <TabsContent value="activities" className="mt-0">
            {/* Timeline unifiée - Activités et Historique */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                <CardTitle className="text-base">Activités & Historique</CardTitle>
                <Button 
                  size="sm" 
                  onClick={() => openActivityDialog()}
                  data-testid="button-new-activity"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle activité
                </Button>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Helper functions for activity display
                  const getKindLabel = (kind: string) => {
                    const labels: Record<string, string> = {
                      email: "Email",
                      call: "Appel",
                      meeting: "Réunion",
                      note: "Note",
                      task: "Tâche",
                      created: "Création",
                      updated: "Mise à jour du projet",
                      deleted: "Suppression",
                      file: "Fichier",
                      time_tracked: "Temps",
                      custom: "Autre",
                    };
                    return labels[kind] || kind;
                  };
                  const getKindColor = (kind: string) => {
                    const colors: Record<string, string> = {
                      email: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                      call: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                      meeting: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
                      note: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                      task: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
                      created: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
                      updated: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
                      deleted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                      file: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
                      time_tracked: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
                      custom: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
                      // System history types
                      project_created: "bg-primary text-primary-foreground",
                      task_created: "bg-violet-500 text-white",
                      note_created: "bg-yellow-500 text-white",
                      document_added: "bg-blue-500 text-white",
                    };
                    return colors[kind] || colors.custom;
                  };
                  const getKindIcon = (kind: string) => {
                    switch (kind) {
                      case "email": return <Mail className="h-3 w-3" />;
                      case "call": return <Phone className="h-3 w-3" />;
                      case "meeting": return <Video className="h-3 w-3" />;
                      case "note": return <StickyNote className="h-3 w-3" />;
                      case "task": return <CheckCircle2 className="h-3 w-3" />;
                      case "created": return <PlusCircle className="h-3 w-3" />;
                      case "updated": return <RefreshCw className="h-3 w-3" />;
                      case "deleted": return <XCircle className="h-3 w-3" />;
                      case "file": return <File className="h-3 w-3" />;
                      case "time_tracked": return <Clock className="h-3 w-3" />;
                      // System history icons
                      case "project_created": return <Briefcase className="h-3 w-3" />;
                      case "task_created": return <CheckCircle2 className="h-3 w-3" />;
                      case "note_created": return <StickyNote className="h-3 w-3" />;
                      case "document_added": return <FileText className="h-3 w-3" />;
                      default: return <MoreHorizontal className="h-3 w-3" />;
                    }
                  };
                  const getUpdateDetails = (activity: Activity) => {
                    if (activity.kind !== 'updated' || !activity.payload) return null;
                    const payload = activity.payload as Record<string, unknown>;
                    const changes: string[] = [];
                    if (payload.changedFields && Array.isArray(payload.changedFields)) {
                      const fieldLabels: Record<string, string> = {
                        name: "nom",
                        title: "titre",
                        description: "description",
                        stage: "étape",
                        status: "statut",
                        priority: "priorité",
                        dueDate: "date d'échéance",
                        budget: "budget",
                        billingStatus: "statut de facturation",
                        assignedTo: "assignation",
                      };
                      payload.changedFields.forEach((field: string) => {
                        changes.push(fieldLabels[field] || field);
                      });
                    }
                    return changes.length > 0 ? changes.join(", ") : null;
                  };

                  // Build unified timeline
                  type TimelineItem = 
                    | { _type: 'activity'; _date: Date; data: Activity }
                    | { _type: 'project_created'; _date: Date; data: typeof project }
                    | { _type: 'task_created'; _date: Date; data: Task }
                    | { _type: 'note_created'; _date: Date; data: Note }
                    | { _type: 'document_added'; _date: Date; data: Document };

                  const timelineItems: TimelineItem[] = [
                    ...projectActivities.map(a => ({ 
                      _type: 'activity' as const, 
                      _date: new Date(a.occurredAt || a.createdAt), 
                      data: a 
                    })),
                    ...(project ? [{ 
                      _type: 'project_created' as const, 
                      _date: new Date(project.createdAt), 
                      data: project 
                    }] : []),
                    ...projectTasks.map(t => ({ 
                      _type: 'task_created' as const, 
                      _date: new Date(t.createdAt), 
                      data: t 
                    })),
                    ...projectNotes.map(n => ({ 
                      _type: 'note_created' as const, 
                      _date: new Date(n.createdAt), 
                      data: n 
                    })),
                    ...projectDocuments.map(d => ({ 
                      _type: 'document_added' as const, 
                      _date: new Date(d.createdAt), 
                      data: d 
                    })),
                  ].sort((a, b) => b._date.getTime() - a._date.getTime());

                  if (timelineItems.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Aucune activité ou historique pour ce projet.
                      </div>
                    );
                  }

                  const displayedItems = timelineItems.slice(0, activitiesDisplayCount);
                  const hasMore = timelineItems.length > activitiesDisplayCount;

                  return (
                    <div className="space-y-2">
                      {displayedItems.map((item, index) => {
                        if (item._type === 'activity') {
                          const activity = item.data;
                          const user = users.find(u => u.id === activity.createdBy);
                          return (
                            <div 
                              key={`activity-${activity.id}`}
                              className="group flex items-start gap-3 p-2.5 rounded-md hover:bg-muted/50 transition-colors"
                              data-testid={`activity-${activity.id}`}
                            >
                              <div className={cn(
                                "shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5",
                                getKindColor(activity.kind)
                              )}>
                                {getKindIcon(activity.kind)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-medium">{getKindLabel(activity.kind)}</span>
                                  {activity.kind === 'updated' && getUpdateDetails(activity) && (
                                    <span className="text-[10px] text-muted-foreground">
                                      · {getUpdateDetails(activity)}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">
                                    · {format(item._date, "dd MMM yyyy HH:mm", { locale: fr })}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{activity.description}</p>
                                {user && (
                                  <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                                    {user.firstName} {user.lastName}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openActivityDialog(activity)}
                                  data-testid={`button-edit-activity-${activity.id}`}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setDeleteActivityId(activity.id);
                                    setIsDeleteActivityDialogOpen(true);
                                  }}
                                  data-testid={`button-delete-activity-${activity.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </div>
                            </div>
                          );
                        }

                        // System-generated history items (not editable)
                        const author = users.find(u => u.id === item.data.createdBy);
                        const getHistoryLabel = () => {
                          switch (item._type) {
                            case 'project_created': return 'Création du projet';
                            case 'task_created': return 'Tâche créée';
                            case 'note_created': return 'Note créée';
                            case 'document_added': return 'Document ajouté';
                            default: return '';
                          }
                        };
                        const getHistoryDescription = () => {
                          switch (item._type) {
                            case 'project_created': return `Projet "${(item.data as typeof project)?.name}" créé`;
                            case 'task_created': return (item.data as Task).title;
                            case 'note_created': return (item.data as Note).title;
                            case 'document_added': return (item.data as Document).name;
                            default: return '';
                          }
                        };

                        return (
                          <div 
                            key={`${item._type}-${item.data.id || index}`}
                            className="flex items-start gap-3 p-2.5 rounded-md"
                            data-testid={`history-${item._type}-${item.data.id || index}`}
                          >
                            <div className={cn(
                              "shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5",
                              getKindColor(item._type)
                            )}>
                              {getKindIcon(item._type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium">{getHistoryLabel()}</span>
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                  Système
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  · {format(item._date, "dd MMM yyyy HH:mm", { locale: fr })}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{getHistoryDescription()}</p>
                              {author && (
                                <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                                  {author.firstName} {author.lastName}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {hasMore && (
                        <div className="flex justify-center pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActivitiesDisplayCount(prev => prev + 10)}
                            className="text-muted-foreground"
                            data-testid="button-load-more-activities"
                          >
                            Afficher plus ({timelineItems.length - activitiesDisplayCount} restants)
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Sheet open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col bg-white dark:bg-card" data-testid="dialog-edit-project">
          <SheetHeader>
            <SheetTitle>Modifier le projet</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 flex-1 py-4">
            <div>
              <Label htmlFor="edit-name">Nom du projet *</Label>
              <Input
                id="edit-name"
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                className="text-sm placeholder:text-xs"
                data-testid="input-edit-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={projectFormData.description}
                onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                rows={3}
                className="text-sm placeholder:text-xs"
                data-testid="input-edit-description"
              />
            </div>
            <div>
              <Label htmlFor="edit-client">Client</Label>
              <Select
                value={projectFormData.clientId}
                onValueChange={(value) => setProjectFormData({ ...projectFormData, clientId: value })}
              >
                <SelectTrigger id="edit-client" className="text-sm [&>span[data-placeholder]]:text-xs" data-testid="select-edit-client">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id} className="bg-popover cursor-pointer">
                      {client.company || client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-stage">Étape</Label>
              <Select
                value={projectFormData.stage}
                onValueChange={(value) => setProjectFormData({ ...projectFormData, stage: value })}
              >
                <SelectTrigger id="edit-stage" className="text-sm" data-testid="select-edit-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-card">
                  {projectStages.map((stage: any) => (
                    <SelectItem key={stage.key} value={stage.key}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-category">Catégorie</Label>
              <CategoryCombobox
                value={projectFormData.category || ""}
                onChange={(value) => setProjectFormData({ ...projectFormData, category: value })}
                categories={allCategories}
                coreProjectTypes={coreProjectTypes}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Sélectionnez une catégorie existante ou créez-en une nouvelle
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-edit-start-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {projectFormData.startDate ? (
                        format(projectFormData.startDate, "PPP", { locale: fr })
                      ) : (
                        <span>Choisir une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white dark:bg-card">
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
                      data-testid="button-edit-end-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {projectFormData.endDate ? (
                        format(projectFormData.endDate, "PPP", { locale: fr })
                      ) : (
                        <span>Choisir une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white dark:bg-card">
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
              <Label htmlFor="edit-budget">Budget</Label>
              <Input
                id="edit-budget"
                value={projectFormData.budget}
                onChange={(e) => setProjectFormData({ ...projectFormData, budget: e.target.value })}
                placeholder="ex: 10 000€"
                className="text-sm placeholder:text-xs"
                data-testid="input-edit-budget"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end border-t pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
              Annuler
            </Button>
            <Button onClick={handleSubmitEdit} data-testid="button-submit-edit">
              Enregistrer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-project">
          <DialogHeader>
            <DialogTitle>Supprimer le projet</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteProjectMutation.mutate()}
              data-testid="button-confirm-delete"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TaskDetailModal
        task={selectedTask}
        users={users}
        projects={[project]}
        columns={columns}
        isOpen={isTaskDetailDialogOpen}
        onClose={() => setIsTaskDetailDialogOpen(false)}
        onSave={async (updatedTask) => {
          if (selectedTask) {
            await apiRequest(`/api/tasks/${selectedTask.id}`, 'PATCH', updatedTask);
            queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
            queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
          }
        }}
        onDelete={async (task) => {
          setDeleteTaskId(task.id);
          setIsDeleteTaskDialogOpen(true);
          setIsTaskDetailDialogOpen(false);
        }}
      />
      <AlertDialog open={isDeleteTaskDialogOpen} onOpenChange={setIsDeleteTaskDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-task-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la tâche</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-task">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTaskId && deleteTaskMutation.mutate(deleteTaskId)}
              data-testid="button-confirm-delete-task"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activity Sheet (Side Panel) */}
      <Sheet open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
        <SheetContent className="sm:max-w-md w-full" data-testid="sheet-activity">
          <SheetHeader>
            <SheetTitle>{editingActivity ? "Modifier l'activité" : "Nouvelle activité"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Type d'activité</Label>
              <Select
                value={activityFormData.kind}
                onValueChange={(value) => setActivityFormData({ ...activityFormData, kind: value })}
              >
                <SelectTrigger data-testid="select-activity-kind">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call">Appel</SelectItem>
                  <SelectItem value="meeting">Réunion</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="custom">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={activityFormData.description}
                onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })}
                placeholder="Description de l'activité..."
                className="min-h-[100px]"
                data-testid="input-activity-description"
              />
            </div>
            <div>
              <Label>Date</Label>
              <Popover open={isActivityDatePickerOpen} onOpenChange={setIsActivityDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !activityFormData.occurredAt && "text-muted-foreground"
                    )}
                    data-testid="input-activity-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {activityFormData.occurredAt 
                      ? format(new Date(activityFormData.occurredAt), "dd/MM/yyyy", { locale: fr }) 
                      : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={activityFormData.occurredAt ? new Date(activityFormData.occurredAt) : undefined}
                    onSelect={(date) => {
                      setActivityFormData({ 
                        ...activityFormData, 
                        occurredAt: date ? format(date, "yyyy-MM-dd") : "" 
                      });
                      setIsActivityDatePickerOpen(false);
                    }}
                    initialFocus
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Heure</Label>
              <Input
                type="time"
                value={activityFormData.occurredAtTime}
                onChange={(e) => setActivityFormData({ ...activityFormData, occurredAtTime: e.target.value })}
                className="w-full"
                data-testid="input-activity-time"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsActivityDialogOpen(false)} data-testid="button-cancel-activity">
              Annuler
            </Button>
            <Button 
              onClick={handleActivitySubmit} 
              disabled={!activityFormData.description.trim()}
              data-testid="button-save-activity"
            >
              {editingActivity ? "Modifier" : "Créer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Activity Dialog */}
      <AlertDialog open={isDeleteActivityDialogOpen} onOpenChange={setIsDeleteActivityDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-activity-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'activité</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette activité ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-activity">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteActivityId && deleteActivityMutation.mutate(deleteActivityId)}
              data-testid="button-confirm-delete-activity"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Analysis Drawer */}
      <Sheet open={showAnalysisDrawer} onOpenChange={setShowAnalysisDrawer}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="drawer-analysis">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Analyse du projet
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6">
            {/* Section 1: Projections */}
            {comparisonData && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">À ce rythme...</h3>
                  <Badge variant="outline" className="text-[10px] ml-auto">Projection</Badge>
                </div>
                
                <Card className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Temps total projeté</span>
                      <span className={cn(
                        "text-sm font-medium",
                        comparisonData.projections.atRiskOfOverrun ? "text-amber-600" : "text-foreground"
                      )}>
                        {comparisonData.projections.estimatedTotalDays.toFixed(1)} jours
                        {comparisonData.projections.timeDeviation > 0 && (
                          <span className="text-amber-600 ml-1">
                            (+{comparisonData.projections.timeDeviation.toFixed(0)}%)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Marge projetée</span>
                      <span className={cn(
                        "text-sm font-medium",
                        comparisonData.projections.projectedMarginPercent >= 20 ? "text-green-600" :
                        comparisonData.projections.projectedMarginPercent >= 0 ? "text-amber-600" : "text-red-600"
                      )}>
                        {comparisonData.projections.projectedMargin.toLocaleString("fr-FR")} €
                        <span className="text-xs ml-1">({comparisonData.projections.projectedMarginPercent.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Rythme actuel</span>
                      <span className="text-sm font-medium">
                        {(comparisonData.projections.pacePerDay * 8).toFixed(1)}h/jour
                      </span>
                    </div>
                    
                    {/* Status synthesis */}
                    <div className={cn(
                      "mt-3 p-3 rounded-lg border",
                      comparisonData.projections.projectedMarginPercent >= 20 
                        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                        : comparisonData.projections.atRiskOfOverrun
                          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                          : comparisonData.projections.projectedMarginPercent < 0
                            ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                            : "bg-muted/50"
                    )}>
                      <div className="flex items-start gap-2">
                        {comparisonData.projections.projectedMarginPercent >= 20 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                        ) : comparisonData.projections.projectedMarginPercent < 0 ? (
                          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className={cn(
                            "text-sm font-medium",
                            comparisonData.projections.projectedMarginPercent >= 20 
                              ? "text-green-800 dark:text-green-200"
                              : comparisonData.projections.projectedMarginPercent < 0
                                ? "text-red-800 dark:text-red-200"
                                : "text-amber-800 dark:text-amber-200"
                          )}>
                            {comparisonData.projections.projectedMarginPercent >= 20 
                              ? "Sous contrôle"
                              : comparisonData.projections.projectedMarginPercent < 0
                                ? "Dérapage probable"
                                : "À risque"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {comparisonData.projections.projectedMarginPercent >= 20 
                              ? "Le projet est rentable au rythme actuel."
                              : comparisonData.projections.projectedMarginPercent < 0
                                ? "La marge projetée est négative. Ajustez le périmètre ou renégociez."
                                : "La marge est faible. Surveillez le temps restant."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Section 2: Comparison with similar projects */}
            {comparisonData && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Comparaison</h3>
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    {comparisonData.comparison.vsSimilar 
                      ? `vs ${comparisonData.similarProjects?.projectCount} projets similaires`
                      : "Pas assez de données"}
                  </Badge>
                </div>

                <Card className="p-4">
                  {comparisonData.comparison.vsSimilar ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Écart marge</span>
                        <span className={cn(
                          "text-sm font-medium",
                          comparisonData.comparison.vsSimilar.marginGap >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {comparisonData.comparison.vsSimilar.marginGap >= 0 ? "+" : ""}
                          {comparisonData.comparison.vsSimilar.marginGap.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Écart TJM</span>
                        <span className={cn(
                          "text-sm font-medium",
                          comparisonData.comparison.vsSimilar.tjmGap >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {comparisonData.comparison.vsSimilar.tjmGap >= 0 ? "+" : ""}
                          {comparisonData.comparison.vsSimilar.tjmGap.toFixed(0)} €/j
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Écart temps</span>
                        <span className={cn(
                          "text-sm font-medium",
                          comparisonData.comparison.vsSimilar.timeGap <= 0 ? "text-green-600" : "text-amber-600"
                        )}>
                          {comparisonData.comparison.vsSimilar.timeGap >= 0 ? "+" : ""}
                          {comparisonData.comparison.vsSimilar.timeGap.toFixed(0)}%
                        </span>
                      </div>
                      
                      {/* Contextual synthesis - improved messaging */}
                      <div className="mt-3 p-3 rounded-lg border bg-muted/50">
                        <p className="text-sm">
                          {(() => {
                            const isAboveAverage = comparisonData.comparison.vsSimilar?.verdict === 'above_average';
                            const isProjectProfitable = comparisonData.projections.projectedMarginPercent >= 0;
                            
                            if (isAboveAverage && isProjectProfitable) {
                              return "Ce projet performe au-dessus de la moyenne et reste rentable.";
                            } else if (isAboveAverage && !isProjectProfitable) {
                              return "Ce projet est plus performant que des projets similaires, mais reste sous le seuil de rentabilité attendu.";
                            } else if (!isAboveAverage && isProjectProfitable) {
                              return "Ce projet est en dessous de la moyenne mais reste rentable. Des optimisations sont possibles.";
                            } else {
                              return "Ce projet est en dessous de la moyenne et n'est pas rentable. Des ajustements urgents sont nécessaires.";
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Info className="h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Pas assez de projets similaires pour comparer.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        La comparaison sera disponible avec plus de données.
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* Section 3: Reference Projects */}
            {comparisonData?.bestProjects && comparisonData.bestProjects.topProjects.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <h3 className="font-semibold">Projets de référence</h3>
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    Top {comparisonData.bestProjects.topProjects.length} marge
                  </Badge>
                </div>

                <div className="space-y-2">
                  {comparisonData.bestProjects.topProjects.map((refProject, index) => (
                    <Card 
                      key={refProject.id} 
                      className="p-3 hover-elevate cursor-pointer"
                      onClick={() => {
                        setShowAnalysisDrawer(false);
                        setLocation(`/projects/${refProject.id}`);
                      }}
                      data-testid={`drawer-reference-project-${index}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">
                            #{index + 1}
                          </span>
                          <span className="text-sm font-medium line-clamp-1">{refProject.name}</span>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Marge</span>
                          <span className={cn(
                            "ml-1 font-medium",
                            refProject.marginPercent >= 20 ? "text-green-600" : "text-amber-600"
                          )}>
                            {refProject.marginPercent.toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">TJM</span>
                          <span className="ml-1 font-medium">
                            {refProject.actualTJM.toFixed(0)}€
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Temps</span>
                          <span className={cn(
                            "ml-1 font-medium",
                            refProject.timeOverrunPercent <= 0 ? "text-green-600" : "text-amber-600"
                          )}>
                            {refProject.actualDaysWorked.toFixed(1)}j
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Insights from reference projects */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Ce que ces projets ont en commun :</strong>{" "}
                    TJM moyen de {comparisonData.bestProjects.avgActualTJM.toFixed(0)}€/j, 
                    marge moyenne de {comparisonData.bestProjects.avgMarginPercent.toFixed(0)}%,
                    {comparisonData.bestProjects.avgTimeOverrunPercent <= 0 
                      ? " et aucun dépassement de temps."
                      : ` avec ${comparisonData.bestProjects.avgTimeOverrunPercent.toFixed(0)}% de dépassement temps.`}
                  </p>
                </div>
              </div>
            )}

            {/* No data state */}
            {!comparisonData && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Info className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  Pas de données d'analyse disponibles.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Ajoutez des entrées de temps et un budget pour voir les projections.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Billing Settings Sheet */}
      <Sheet open={isBillingSettingsOpen} onOpenChange={setIsBillingSettingsOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-white dark:bg-card" data-testid="sheet-billing-settings">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Paramètres de facturation
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6">
            {/* Type de projet */}
            <div>
              <Label htmlFor="sheet-business-type" className="text-sm font-medium">Type de projet</Label>
              <Select
                value={project?.businessType || "client"}
                onValueChange={async (value) => {
                  try {
                    await apiRequest(`/api/projects/${id}`, "PATCH", { businessType: value });
                    queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                    toast({ title: "Type de projet mis à jour", variant: "success" });
                  } catch (error: any) {
                    toast({ title: "Erreur", description: error.message, variant: "destructive" });
                  }
                }}
              >
                <SelectTrigger id="sheet-business-type" data-testid="select-sheet-business-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Projet client</SelectItem>
                  <SelectItem value="internal">Projet interne</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Les projets internes ne génèrent pas de revenus facturés.
              </p>
            </div>

            {/* Type de facturation */}
            <div>
              <Label htmlFor="sheet-billing-type" className="text-sm font-medium">Type de facturation</Label>
              <Select
                value={project?.billingType || "time"}
                onValueChange={async (value) => {
                  try {
                    await apiRequest(`/api/projects/${id}`, "PATCH", { billingType: value });
                    queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                    queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/time-entries`] });
                    toast({ title: "Type de facturation mis à jour", variant: "success" });
                  } catch (error: any) {
                    toast({ title: "Erreur", description: error.message, variant: "destructive" });
                  }
                }}
              >
                <SelectTrigger id="sheet-billing-type" data-testid="select-sheet-billing-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Régie</SelectItem>
                  <SelectItem value="fixed">Forfait</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {project?.billingType === "fixed" 
                  ? "Facturation au forfait : montant total fixe"
                  : "Facturation en régie : taux journalier (TJM)"}
              </p>
            </div>

            {/* Unité de facturation */}
            <div>
              <Label htmlFor="sheet-billing-unit" className="text-sm font-medium">Unité de facturation</Label>
              <Select
                value={project?.billingUnit || "hour"}
                onValueChange={async (value) => {
                  try {
                    await apiRequest(`/api/projects/${id}`, "PATCH", { billingUnit: value });
                    queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                    queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/time-entries`] });
                    toast({ title: "Unité de facturation mise à jour", variant: "success" });
                  } catch (error: any) {
                    toast({ title: "Erreur", description: error.message, variant: "destructive" });
                  }
                }}
              >
                <SelectTrigger id="sheet-billing-unit" data-testid="select-sheet-billing-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">À l'heure</SelectItem>
                  <SelectItem value="day">À la journée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rythme de règlement */}
            <div>
              <Label htmlFor="sheet-payment-rhythm" className="text-sm font-medium">Rythme de règlement</Label>
              <Select
                value={project?.paymentRhythm || "at_delivery"}
                onValueChange={async (value) => {
                  try {
                    await apiRequest(`/api/projects/${id}`, "PATCH", { paymentRhythm: value });
                    queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                    toast({ title: "Rythme de règlement mis à jour", variant: "success" });
                  } catch (error: any) {
                    toast({ title: "Erreur", description: error.message, variant: "destructive" });
                  }
                }}
              >
                <SelectTrigger id="sheet-payment-rhythm" data-testid="select-sheet-payment-rhythm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PAYMENT_RHYTHM_LABELS) as [PaymentRhythm, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Acompte (conditionnel : rythmes avec dépôt) */}
            {RHYTHMS_WITH_DEPOSIT.includes((project?.paymentRhythm || "at_delivery") as PaymentRhythm) && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Acompte</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Input
                      id="sheet-deposit-pct"
                      type="number"
                      min={1}
                      max={99}
                      step={5}
                      value={depositPctValue}
                      onChange={(e) => {
                        setDepositPctValue(e.target.value);
                        const pct = parseFloat(e.target.value);
                        const total = parseFloat(project?.totalBilled || project?.budget || "0");
                        if (!isNaN(pct) && total > 0) setDepositAmtValue(Math.round((pct / 100) * total).toString());
                      }}
                      onBlur={async () => {
                        const pct = parseFloat(depositPctValue);
                        if (isNaN(pct) || pct <= 0 || pct >= 100) return;
                        try {
                          await apiRequest(`/api/projects/${id}`, "PATCH", { depositPercentage: pct.toFixed(2) });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                        } catch {}
                      }}
                      className="pr-6"
                      data-testid="input-sheet-deposit-pct"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                  </div>
                  <div className="relative">
                    <Input
                      id="sheet-deposit-amt"
                      type="number"
                      min={0}
                      step={100}
                      value={depositAmtValue}
                      placeholder={
                        (() => {
                          const total = parseFloat(project?.totalBilled || project?.budget || "0");
                          const pct = parseFloat(depositPctValue) || 30;
                          return total > 0 ? Math.round((pct / 100) * total).toString() : "Montant";
                        })()
                      }
                      onChange={(e) => {
                        setDepositAmtValue(e.target.value);
                        const amt = parseFloat(e.target.value);
                        const total = parseFloat(project?.totalBilled || project?.budget || "0");
                        if (!isNaN(amt) && total > 0) setDepositPctValue(((amt / total) * 100).toFixed(1));
                      }}
                      onBlur={async () => {
                        const amt = parseFloat(depositAmtValue);
                        const total = parseFloat(project?.totalBilled || project?.budget || "0");
                        if (isNaN(amt) || amt <= 0 || total <= 0) return;
                        const pct = (amt / total) * 100;
                        try {
                          await apiRequest(`/api/projects/${id}`, "PATCH", { depositPercentage: pct.toFixed(2) });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                        } catch {}
                      }}
                      className="pr-6"
                      data-testid="input-sheet-deposit-amt"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">€</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="checkbox"
                    id="sheet-end-of-month"
                    checked={paymentEndOfMonth}
                    onChange={async (e) => {
                      const val = e.target.checked;
                      setPaymentEndOfMonth(val);
                      try {
                        await apiRequest(`/api/projects/${id}`, "PATCH", { paymentEndOfMonth: val ? 1 : 0 });
                        queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                      } catch {}
                    }}
                    className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                    data-testid="checkbox-sheet-end-of-month"
                  />
                  <Label htmlFor="sheet-end-of-month" className="text-xs text-muted-foreground cursor-pointer">
                    Paiements en fin de mois
                  </Label>
                </div>
              </div>
            )}

            {/* Fin de mois (hors acompte) */}
            {!RHYTHMS_WITH_DEPOSIT.includes((project?.paymentRhythm || "at_delivery") as PaymentRhythm) && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sheet-end-of-month-standalone"
                  checked={paymentEndOfMonth}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setPaymentEndOfMonth(val);
                    try {
                      await apiRequest(`/api/projects/${id}`, "PATCH", { paymentEndOfMonth: val ? 1 : 0 });
                      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                    } catch {}
                  }}
                  className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                  data-testid="checkbox-sheet-end-of-month-standalone"
                />
                <Label htmlFor="sheet-end-of-month-standalone" className="text-xs text-muted-foreground cursor-pointer">
                  Paiements en fin de mois
                </Label>
              </div>
            )}

            {/* TJM projet */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="sheet-billing-rate" className="text-sm font-medium">TJM projet</Label>
                {effectiveTJMData?.source === 'global' && !billingRateValue && (
                  <Badge variant="outline" className="text-xs">
                    Global: {effectiveTJMData.globalTJM} €
                  </Badge>
                )}
                {effectiveTJMData?.source === 'project' && (
                  <Badge variant="secondary" className="text-xs">Personnalisé</Badge>
                )}
              </div>
              <Input
                id="sheet-billing-rate"
                type="number"
                placeholder={effectiveTJMData?.globalTJM ? `${effectiveTJMData.globalTJM} (global)` : "450"}
                value={billingRateValue}
                onChange={(e) => setBillingRateValue(e.target.value)}
                onBlur={async () => {
                  const trimmedValue = billingRateValue.trim();
                  if (trimmedValue !== project?.billingRate) {
                    try {
                      const numValue = trimmedValue === "" ? null : parseFloat(trimmedValue);
                      if (trimmedValue !== "" && (isNaN(numValue!) || numValue! < 0)) {
                        throw new Error("Veuillez entrer un nombre valide");
                      }
                      await apiRequest(`/api/projects/${id}`, "PATCH", {
                        billingRate: trimmedValue === "" ? null : trimmedValue,
                      });
                      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'effective-tjm'] });
                      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/time-entries`] });
                    } catch (error: any) {
                      toast({ title: "Erreur", description: error.message, variant: "destructive" });
                      setBillingRateValue(project?.billingRate || "");
                    }
                  }
                }}
                data-testid="input-sheet-billing-rate"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {!billingRateValue && effectiveTJMData?.globalTJM 
                  ? "Laissez vide pour utiliser le TJM global"
                  : "TJM spécifique à ce projet"}
              </p>
            </div>

            {/* Montant total facturé */}
            <div className="p-4 rounded-lg bg-violet-100 dark:bg-violet-900/20">
              <Label htmlFor="sheet-total-billed" className="text-sm font-medium">Montant total facturé (€)</Label>
              <Input
                id="sheet-total-billed"
                type="number"
                placeholder="0"
                value={totalBilledValue}
                onChange={(e) => setTotalBilledValue(e.target.value)}
                onBlur={async () => {
                  const trimmedValue = totalBilledValue.trim();
                  if (trimmedValue !== project?.totalBilled) {
                    try {
                      const numValue = parseFloat(trimmedValue);
                      if (trimmedValue !== "" && (isNaN(numValue) || numValue < 0)) {
                        throw new Error("Veuillez entrer un nombre valide");
                      }
                      await apiRequest(`/api/projects/${id}`, "PATCH", {
                        totalBilled: trimmedValue === "" ? null : trimmedValue,
                      });
                      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'profitability'] });
                    } catch (error: any) {
                      toast({ title: "Erreur", description: error.message, variant: "destructive" });
                      setTotalBilledValue(project?.totalBilled || "");
                    }
                  }
                }}
                data-testid="input-sheet-total-billed"
                className="bg-white dark:bg-card"
              />
            </div>

            {/* Nombre de jours */}
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="sheet-number-of-days" className="text-sm font-medium">Nombre de jours</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={async () => {
                        if (isNumberOfDaysOverridden) {
                          // Revenir en mode automatique - remettre la valeur CDC
                          const autoValue = cdcEstimatedDays > 0 ? cdcEstimatedDays.toString() : "";
                          setNumberOfDaysValue(autoValue);
                          setIsNumberOfDaysOverridden(false);
                          // Sauvegarder la valeur CDC si disponible
                          if (cdcEstimatedDays > 0) {
                            try {
                              await apiRequest(`/api/projects/${id}`, "PATCH", {
                                numberOfDays: autoValue,
                              });
                              queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                              queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'profitability'] });
                            } catch (error: any) {
                              console.error("Erreur lors de la mise à jour:", error);
                            }
                          }
                          toast({
                            title: "Mode automatique activé",
                            description: "Le nombre de jours se synchronise maintenant avec le chiffrage CDC",
                            variant: "success",
                          });
                        } else {
                          // Passer en mode manuel - garder la valeur actuelle
                          setIsNumberOfDaysOverridden(true);
                          toast({
                            title: "Mode manuel activé",
                            description: "Vous pouvez maintenant saisir une valeur personnalisée",
                            variant: "success",
                          });
                        }
                      }}
                      data-testid="button-toggle-days-lock"
                    >
                      {isNumberOfDaysOverridden ? (
                        <Unlock className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="bg-white dark:bg-card text-foreground border shadow-lg max-w-xs">
                    <p className="font-medium mb-1">{isNumberOfDaysOverridden 
                      ? "Mode manuel actif" 
                      : "Mode automatique activé"}</p>
                    <p className="text-xs text-muted-foreground">{isNumberOfDaysOverridden 
                      ? "Cliquer pour synchroniser avec le chiffrage CDC" 
                      : "Le nombre de jours se synchronise maintenant avec le chiffrage CDC"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="sheet-number-of-days"
                type="number"
                step="0.5"
                placeholder={cdcEstimatedDays > 0 ? `${cdcEstimatedDays}` : "Ex: 5"}
                value={numberOfDaysValue}
                onChange={(e) => setNumberOfDaysValue(e.target.value)}
                disabled={!isNumberOfDaysOverridden}
                onBlur={async () => {
                  if (!isNumberOfDaysOverridden) return;
                  const trimmedValue = numberOfDaysValue.trim();
                  const currentValue = project?.numberOfDays || "";
                  // Ne pas appeler l'API si la valeur n'a pas changé
                  if (trimmedValue === currentValue) return;
                  // Ne pas appeler l'API si on passe de vide à vide
                  if (trimmedValue === "" && !currentValue) return;
                  // Ne faire l'appel que si on a une vraie valeur à sauvegarder
                  if (trimmedValue !== "") {
                    try {
                      const numValue = parseFloat(trimmedValue);
                      if (isNaN(numValue) || numValue < 0) {
                        throw new Error("Veuillez entrer un nombre valide");
                      }
                      await apiRequest(`/api/projects/${id}`, "PATCH", {
                        numberOfDays: trimmedValue,
                      });
                      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'profitability'] });
                    } catch (error: any) {
                      toast({ title: "Erreur", description: error.message, variant: "destructive" });
                      setNumberOfDaysValue(project?.numberOfDays || "");
                    }
                  }
                }}
                className="mt-1"
                data-testid="input-sheet-number-of-days"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isNumberOfDaysOverridden 
                  ? "Valeur manuelle (forçage actif)"
                  : cdcEstimatedDays > 0 
                    ? `Synchronisé avec le chiffrage CDC (${cdcEstimatedDays} j)`
                    : "Aucun chiffrage CDC - définir manuellement"}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Simulation Drawer */}
      {isSimulationOpen && (() => {
        const simEstimatedDays = cdcEstimatedDays > 0
          ? cdcEstimatedDays
          : (parseFloat(project?.numberOfDays?.toString() || "0") || 0);
        const simActualDays = profitabilityMetrics?.actualDaysWorked || 0;
        const simRemainingDays = Math.max(0, simEstimatedDays - simActualDays);
        return (
          <SimulationDrawer
            open={isSimulationOpen}
            onClose={() => setIsSimulationOpen(false)}
            project={project}
            payments={payments}
            currentState={{
              totalEstimatedDays: simEstimatedDays,
              actualDaysWorked: simActualDays,
              remainingDays: simRemainingDays,
              totalBilled: parseFloat(totalBilledValue || "0") || 0,
              totalPaid,
              internalDailyCost: project.internalDailyCost ? parseFloat(project.internalDailyCost.toString()) : 0,
              currentEndDate: project.endDate ? new Date(project.endDate + "T00:00:00") : null,
              billingType: project.billingType,
              billingRate: project.billingRate ? parseFloat(project.billingRate.toString()) : undefined,
            }}
          />
        );
      })()}

      {/* CDC Wizard */}
      <CdcWizard
        projectId={id!}
        isOpen={isCdcWizardOpen}
        onClose={() => setIsCdcWizardOpen(false)}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'scope-items'] });
          queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
          setIsCdcWizardOpen(false);
        }}
        dailyRate={parseFloat(project.billingRate?.toString() || '0') || 800}
      />
    </div>
  );
}
