import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Calendar as CalendarIcon, Euro, Tag, Edit, Trash2, Users, Star, FileText, DollarSign, Timer, Clock, Check, ChevronsUpDown, Plus, FolderKanban, Play, Kanban, LayoutGrid, User, ChevronDown, ChevronRight, Flag, Layers, ListTodo, ExternalLink, MessageSquare, Phone, Mail, Video, StickyNote, MoreHorizontal, CheckCircle2, Briefcase, TrendingUp, Info, List, RefreshCw, PlusCircle, XCircle, File, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Project, Task, Client, AppUser, TaskColumn, Note, Document, ProjectPayment, Backlog, Epic, UserStory, BacklogTask, Sprint, BacklogColumn, ChecklistItem, BacklogItemState, BacklogPriority, Activity, ProjectScopeItem } from "@shared/schema";
import { billingStatusOptions, backlogModeOptions, backlogItemStateOptions, backlogPriorityOptions } from "@shared/schema";
import { useState, useEffect, useRef, useMemo } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, formatDateForStorage } from "@/lib/queryClient";
import { Loader } from "@/components/Loader";
import { ProjectScopeSection } from "@/components/ProjectScopeSection";
import { RoadmapTab } from "@/components/roadmap/roadmap-tab";
import { cn } from "@/lib/utils";
import { getProjectStageColorClass, getProjectStageLabel, getBillingStatusColorClass, PROJECT_STAGES } from "@shared/config";

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

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  categories: { id: string; name: string }[];
}

function CategoryCombobox({ value, onChange, categories }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const handleCreateCategory = async () => {
    const trimmedValue = searchValue.trim();
    if (!trimmedValue) return;

    try {
      // Create the category via API
      await apiRequest('/api/project-categories', 'POST', { name: trimmedValue });
      // Invalidate the cache to refetch categories
      queryClient.invalidateQueries({ queryKey: ['/api/project-categories'] });
      // Update local state
      onChange(trimmedValue);
      setOpen(false);
      setSearchValue("");
    } catch (error: any) {
      console.error('Error creating category:', error);
    }
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
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Rechercher ou créer..." 
            value={searchValue}
            onValueChange={setSearchValue}
            data-testid="input-category-search"
          />
          <CommandList>
            <CommandEmpty>
              {searchValue.trim() && (
                <button
                  className="w-full text-sm py-2 px-4 hover-elevate active-elevate-2 rounded-sm text-left"
                  onClick={handleCreateCategory}
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
                  {cat.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
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
  generatedAt: string;
}

function TimeTrackingTab({ projectId, project }: { projectId: string; project?: ProjectWithRelations }) {
  const { toast } = useToast();
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  
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
  
  const paceProjection = totalEstimatedDays > 0 ? calculatePaceProjection() : null;
  
  // Calculate per-scope-item projections using ITEM-SPECIFIC pace
  // Each item's projection is based on its own work rhythm, not the global pace
  const calculateScopeItemProjections = () => {
    if (!paceProjection?.available || paceProjection.alreadyExceeded) return [];
    
    return scopeItems.map(item => {
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
              <p className="text-xl font-semibold" data-testid="kpi-time-spent">
                {totalTimeDays.toFixed(1)}j
              </p>
              <p className="text-xs text-muted-foreground">{totalTimeHours.toFixed(1)}h</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Temps prévu (CDC)</p>
              <p className="text-xl font-semibold" data-testid="kpi-time-estimated">
                {totalEstimatedDays > 0 ? `${totalEstimatedDays.toFixed(1)}j` : "—"}
              </p>
              {totalEstimatedDays > 0 && (
                <p className="text-xs text-muted-foreground">{(totalEstimatedDays * 8).toFixed(1)}h</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Temps restant</p>
              <p className={`text-xl font-semibold ${remainingDays < 0 ? "text-red-600" : ""}`} data-testid="kpi-time-remaining">
                {totalEstimatedDays > 0 ? `${remainingDays.toFixed(1)}j` : "—"}
              </p>
              {totalEstimatedDays > 0 && (
                <p className="text-xs text-muted-foreground">{(remainingDays * 8).toFixed(1)}h</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Consommation</p>
              <div className="flex items-center gap-2">
                <p className={`text-xl font-semibold ${timeStatus.color}`} data-testid="kpi-consumption-percent">
                  {totalEstimatedDays > 0 ? `${consumptionPercent.toFixed(0)}%` : "—"}
                </p>
                {totalEstimatedDays > 0 && (
                  <Badge className={timeStatus.bg} data-testid="badge-time-status">
                    {timeStatus.label}
                  </Badge>
                )}
              </div>
              {totalEstimatedDays > 0 && (
                <Progress value={Math.min(100, consumptionPercent)} className="h-2 mt-1" />
              )}
            </div>
          </div>
          {scopeItems.length === 0 && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Ajoutez des étapes dans l'onglet CDC pour activer le pilotage temps.
            </p>
          )}
          
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
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={trajectoryStatus.bg}
                      variant={trajectoryStatus.status === "exceeded" || trajectoryStatus.status === "critical" ? "destructive" : "default"}
                      data-testid="badge-trajectory"
                    >
                      {trajectoryStatus.label}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Profitability Summary Card */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Rentabilité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Marge</p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={metrics.margin >= 0 ? "default" : "destructive"}
                    className={metrics.margin >= 0 ? "bg-green-600 dark:bg-green-700" : ""}
                    data-testid="badge-profitability"
                  >
                    {metrics.statusLabel}
                  </Badge>
                </div>
                <p className={`text-lg font-semibold ${metrics.margin >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`} data-testid="text-profit-loss">
                  {metrics.margin >= 0 ? "+" : ""}{metrics.margin.toFixed(0)} €
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">TJM réel</p>
                <p className="text-lg font-semibold">{metrics.actualTJM.toFixed(0)} €</p>
                {metrics.targetTJM > 0 && (
                  <p className="text-xs text-muted-foreground">Cible: {metrics.targetTJM.toFixed(0)} €</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">CA facturé</p>
                <p className="text-lg font-semibold">{metrics.totalBilled.toFixed(0)} €</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Encaissé</p>
                <p className="text-lg font-semibold">{metrics.totalPaid.toFixed(0)} €</p>
                <Button asChild variant="ghost" size="sm" className="h-6 text-xs gap-1 p-0" data-testid="link-to-finance">
                  <Link href="/finance">
                    Voir détails
                  </Link>
                </Button>
              </div>
            </div>
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
        
        // Check for imbalance by scope item
        const imbalancedItems = scopeItems.filter((item) => {
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
          recommendations.push({
            id: "imbalance",
            horizon: "adjustment",
            type: "imbalance",
            title: "Déséquilibre par étape",
            description: `${imbalancedItems.length} étape(s) ont dépassé leur temps prévu: ${imbalancedItems.map(i => i.title).slice(0, 2).join(", ")}${imbalancedItems.length > 2 ? "..." : ""}`,
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
            recommendations.push({
              id: "pace-critical",
              horizon: "immediate",
              type: "drift",
              title: "Étape(s) critique(s) à ce rythme",
              description: `À ce rythme, ${criticalItems.length} étape(s) dépasseront leur enveloppe dans moins de 3 jours: ${criticalItems.map(i => `"${i.item.label}"`).slice(0, 2).join(", ")}${criticalItems.length > 2 ? "..." : ""}`,
              severity: "critical",
            });
          }
          
          // Check for warning scope items (will exceed in < 7 days at this pace)
          const warningItems = scopeItemProjections.filter(p => 
            p.projection?.isWarning && !p.projection.insufficientData
          );
          if (warningItems.length > 0 && criticalItems.length === 0) {
            recommendations.push({
              id: "pace-warning",
              horizon: "adjustment",
              type: "drift",
              title: "Anticipation à ce rythme",
              description: `À ce rythme, ${warningItems.length} étape(s) dépasseront leur enveloppe dans moins de 7 jours: ${warningItems.map(i => `"${i.item.label}"`).slice(0, 2).join(", ")}${warningItems.length > 2 ? "..." : ""}`,
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
        
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Recommandations temps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className={`border-l-4 p-3 rounded-r-md ${getSeverityStyles(rec.severity)}`}
                    data-testid={`recommendation-${rec.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-xs ${getHorizonStyles(rec.horizon)}`}>
                        {getHorizonLabel(rec.horizon)}
                      </Badge>
                      <span className="font-medium text-sm">{rec.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Time by Scope Item (CDC) Table */}
      {scopeItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <List className="h-4 w-4" />
              Temps par étape CDC
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                    
                    const getItemStatus = () => {
                      if (estimatedDays === 0) return { color: "text-muted-foreground", label: "—" };
                      if (consumptionPct < 70) return { color: "text-green-600 dark:text-green-500", label: "OK" };
                      if (consumptionPct < 90) return { color: "text-orange-600 dark:text-orange-500", label: "Attention" };
                      return { color: "text-red-600 dark:text-red-500", label: "Critique" };
                    };
                    const itemStatus = getItemStatus();
                    
                    // Get projection for this item
                    const itemProjection = scopeItemProjections.find(p => p.item.id === item.id)?.projection;
                    
                    return (
                      <tr key={item.id} className="border-b last:border-b-0" data-testid={`row-scope-item-${item.id}`}>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {item.label}
                            {itemProjection?.isCritical && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0" data-testid={`badge-critical-${item.id}`}>
                                Critique
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-2 px-2">
                          {estimatedDays > 0 ? `${estimatedDays.toFixed(1)}j` : "—"}
                        </td>
                        <td className="text-right py-2 px-2">
                          {itemTimeDays.toFixed(1)}j
                        </td>
                        <td className={`text-right py-2 px-2 ${ecart > 0 ? "text-red-600 dark:text-red-500" : ecart < 0 ? "text-green-600 dark:text-green-500" : ""}`}>
                          {estimatedDays > 0 ? `${ecart >= 0 ? "+" : ""}${ecart.toFixed(1)}j` : "—"}
                        </td>
                        <td className={`text-right py-2 px-2 ${itemStatus.color}`}>
                          {itemStatus.label}
                        </td>
                        {paceProjection?.available && !paceProjection.alreadyExceeded && (
                          <td className="text-right py-2 px-2">
                            {itemProjection ? (
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
                        </tr>
                      );
                    }
                    return null;
                  })()}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Entries List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessions de temps</CardTitle>
        </CardHeader>
        <CardContent>
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
                          {scopeItem && (
                            <Badge 
                              variant="secondary" 
                              className="text-xs cursor-pointer"
                              onClick={() => {
                                const element = document.getElementById('scope-section');
                                if (element) element.scrollIntoView({ behavior: 'smooth' });
                              }}
                              data-testid={`badge-scope-${entry.id}`}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              {scopeItem.label}
                            </Badge>
                          )}
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
      </Card>

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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const navigate = (path: string) => setLocation(path);
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBillingStatusPopoverOpen, setIsBillingStatusPopoverOpen] = useState(false);
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

  // Task edit state with debounced autosave
  const [taskEditData, setTaskEditData] = useState<Partial<Task>>({});
  const taskSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedTaskRef = useRef<string>("");

  // Billing fields state
  const [totalBilledValue, setTotalBilledValue] = useState<string>("");
  const [billingRateValue, setBillingRateValue] = useState<string>("");
  const [numberOfDaysValue, setNumberOfDaysValue] = useState<string>("");

  // Payment tracking state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentDescription, setPaymentDescription] = useState<string>("");
  const [isPaymentDatePickerOpen, setIsPaymentDatePickerOpen] = useState(false);
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
  });
  const [isActivityDatePickerOpen, setIsActivityDatePickerOpen] = useState(false);

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

  const { data: projectCategories = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/project-categories'],
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
        return existing || { id: `temp-${index}`, name };
      });
  }, [projectCategories, allProjects]);

  const { data: projectDocuments = [] } = useQuery<Document[]>({
    queryKey: ['/api/projects', id, 'documents'],
    enabled: !!id,
  });

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

  // Fetch profitability metrics for KPIs
  const { data: projectProfitabilityData } = useQuery<ProfitabilityAnalysis>({
    queryKey: ['/api/projects', id, 'profitability'],
    enabled: !!id,
  });
  const profitabilityMetrics = projectProfitabilityData?.metrics;

  // Extract data from API response
  const payments = paymentsData?.payments || [];
  const totalPaid = paymentsData?.totalPaid || 0;
  const remainingAmount = paymentsData?.remainingAmount || 0;

  // Fetch activities for this project
  const { data: projectActivities = [] } = useQuery<Activity[]>({
    queryKey: ['/api/projects', id, 'activities'],
    enabled: !!id,
  });

  // Fetch scope items (CDC) for this project - used for auto-completing numberOfDays
  const { data: projectScopeItemsData } = useQuery<{ scopeItems: ProjectScopeItem[] }>({
    queryKey: ['/api/projects', id, 'scope-items'],
    enabled: !!id,
  });
  const projectScopeItems = projectScopeItemsData?.scopeItems || [];
  
  // Calculate CDC estimated days for auto-completion
  const cdcEstimatedDays = useMemo(() => {
    return projectScopeItems.reduce((sum, item) => sum + (parseFloat(item.estimatedDays?.toString() || "0")), 0);
  }, [projectScopeItems]);

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
  // Auto-complete numberOfDays with CDC estimated days if project has no value
  useEffect(() => {
    if (project) {
      setTotalBilledValue(project.totalBilled || project.budget || "");
      setBillingRateValue(project.billingRate || "");
      // Auto-complete with CDC estimated days if numberOfDays is empty
      if (project.numberOfDays) {
        setNumberOfDaysValue(project.numberOfDays);
      } else if (cdcEstimatedDays > 0) {
        setNumberOfDaysValue(cdcEstimatedDays.toString());
      } else {
        setNumberOfDaysValue("");
      }
    }
  }, [project, cdcEstimatedDays]);

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

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<Task> }) => {
      return await apiRequest(`/api/tasks/${taskId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour de la tâche", variant: "destructive" });
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
    mutationFn: async (data: { kind: string; description: string; occurredAt: string }) => {
      return await apiRequest("/api/activities", "POST", {
        subjectType: "project",
        subjectId: id,
        kind: data.kind,
        description: data.description,
        occurredAt: data.occurredAt ? new Date(data.occurredAt).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'activities'] });
      setIsActivityDialogOpen(false);
      setActivityFormData({ kind: "custom", description: "", occurredAt: "" });
      toast({ title: "Activité créée avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création de l'activité", variant: "destructive" });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async (data: { id: string; kind: string; description: string; occurredAt: string }) => {
      return await apiRequest(`/api/activities/${data.id}`, "PATCH", {
        kind: data.kind,
        description: data.description,
        occurredAt: data.occurredAt ? new Date(data.occurredAt).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'activities'] });
      setIsActivityDialogOpen(false);
      setEditingActivity(null);
      setActivityFormData({ kind: "custom", description: "", occurredAt: "" });
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
      setActivityFormData({
        kind: activity.kind,
        description: activity.description || "",
        occurredAt: activity.occurredAt ? format(new Date(activity.occurredAt), "yyyy-MM-dd") : "",
      });
    } else {
      setEditingActivity(null);
      setActivityFormData({ kind: "custom", description: "", occurredAt: format(new Date(), "yyyy-MM-dd") });
    }
    setIsActivityDialogOpen(true);
  };

  // Debounced autosave for task edits
  useEffect(() => {
    if (!selectedTask || !taskEditData.id) return;

    const currentData = JSON.stringify(taskEditData);
    if (currentData === lastSavedTaskRef.current) return;

    if (taskSaveTimeoutRef.current) {
      clearTimeout(taskSaveTimeoutRef.current);
    }

    taskSaveTimeoutRef.current = setTimeout(() => {
      const { id: taskId, ...dataToSave } = taskEditData;
      updateTaskMutation.mutate({ taskId: taskId!, data: dataToSave });
      lastSavedTaskRef.current = currentData;
    }, 500);

    return () => {
      if (taskSaveTimeoutRef.current) {
        clearTimeout(taskSaveTimeoutRef.current);
      }
    };
  }, [taskEditData]);

  // Initialize task edit data when opening dialog
  useEffect(() => {
    if (selectedTask && isTaskDetailDialogOpen) {
      setTaskEditData(selectedTask);
      lastSavedTaskRef.current = JSON.stringify(selectedTask);
    }
  }, [selectedTask, isTaskDetailDialogOpen]);

  const getStageLabel = (stage: string) => getProjectStageLabel(stage);
  const getStageColor = (stage: string) => getProjectStageColorClass(stage);
  const getBillingStatusColor = (status: string | null) => getBillingStatusColorClass(status);

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

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-start gap-2 sm:gap-3 w-full sm:w-auto">
            <Link href="/projects">
              <Button variant="ghost" size="icon" data-testid="button-back" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-start sm:items-center gap-2 flex-wrap">
                <h1 className="text-[16px] sm:text-[26px] font-bold truncate" data-testid="project-title">{project.name}</h1>
                <Badge className={`${getStageColor(project.stage || "prospection")} shrink-0`} data-testid="badge-stage">
                  {getStageLabel(project.stage || "prospection")}
                </Badge>
                {project.category && (
                  <Badge variant="outline" data-testid="badge-category" className="shrink-0">
                    {project.category}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {project.client ? (
                  <Link href={`/crm/${project.clientId}`}>
                    <p className="text-muted-foreground text-sm hover:text-primary cursor-pointer hover:underline">
                      {project.client.company || project.client.name}
                    </p>
                  </Link>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Client non défini
                  </p>
                )}
                {project.budget && (
                  <Badge className="bg-budget text-budget-foreground shrink-0" data-testid="badge-budget">
                    <Euro className="h-3 w-3 mr-1" />
                    {project.budget}
                  </Badge>
                )}
                <Popover open={isBillingStatusPopoverOpen} onOpenChange={setIsBillingStatusPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Badge 
                      variant="outline"
                      data-testid="badge-billing-status-budget"
                      className={`${getBillingStatusColor(project.billingStatus)} shrink-0 cursor-pointer`}
                    >
                      {billingStatusOptions.find(o => o.value === (project.billingStatus || "brouillon"))?.label}
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
                            try {
                              const updateData: { billingStatus: string; billingDueDate?: string | null } = {
                                billingStatus: option.value,
                              };
                              if (option.value !== "retard") {
                                updateData.billingDueDate = null;
                              }
                              await apiRequest(`/api/projects/${id}`, "PATCH", updateData);
                              queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                              queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                              setIsBillingStatusPopoverOpen(false);
                              toast({
                                title: "Statut de facturation mis à jour",
                                description: option.label,
                                variant: "success",
                              });
                            } catch (error: any) {
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
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleEditProject} data-testid="button-edit-project" className="flex-1 sm:flex-none">
              <Edit className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Modifier</span>
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => setIsDeleteDialogOpen(true)}
              data-testid="button-delete-project"
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline text-[12px]">Supprimer</span>
            </Button>
          </div>
        </div>

        {totalTasksCount > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Progression des tâches</CardTitle>
                <span className="text-sm font-semibold" data-testid="progress-percentage">
                  {progressPercentage}%
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Progress value={progressPercentage} className="h-2" data-testid="progress-bar" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span data-testid="completed-tasks-count">{completedTasksCount} tâche{completedTasksCount !== 1 ? 's' : ''} terminée{completedTasksCount !== 1 ? 's' : ''}</span>
                  <span data-testid="total-tasks-count">{totalTasksCount} tâche{totalTasksCount !== 1 ? 's' : ''} au total</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="activities" className="w-full">
          <TabsList className="w-full justify-start mb-4 overflow-x-auto overflow-y-hidden flex-nowrap">
            <TabsTrigger value="activities" className="gap-2 text-xs sm:text-sm" data-testid="tab-activities">
              <MessageSquare className="h-4 w-4" />
              Activités
              <Badge variant="secondary" className="ml-1" data-testid="activities-count">
                {projectActivities.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2 text-xs sm:text-sm" data-testid="tab-billing">
              <DollarSign className="h-4 w-4" />
              Facturation
            </TabsTrigger>
            <TabsTrigger value="time" className="gap-2 text-xs sm:text-sm" data-testid="tab-time">
              <Timer className="h-4 w-4" />
              Temps
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              Tâches
              <Badge variant="secondary" className="ml-1" data-testid="tasks-count">
                {projectTasks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2 text-xs sm:text-sm">
              <FileText className="h-4 w-4" />
              Notes
              <Badge variant="secondary" className="ml-1" data-testid="notes-count">
                {projectNotes.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2 text-xs sm:text-sm">
              <FileText className="h-4 w-4" />
              Documents
              <Badge variant="secondary" className="ml-1" data-testid="documents-count">
                {projectDocuments.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="backlogs" className="gap-2 text-xs sm:text-sm" data-testid="tab-backlogs">
              <FolderKanban className="h-4 w-4" />
              Backlogs
              <Badge variant="secondary" className="ml-1" data-testid="backlogs-count">
                {projectBacklogs.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="roadmap" className="gap-2 text-xs sm:text-sm" data-testid="tab-roadmap">
              <Map className="h-4 w-4" />
              Roadmap
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" id="tasks-section" className="mt-0">
            <Card>
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
                  <Accordion type="multiple" defaultValue={[]} className="space-y-2">
                    {columns.map((column) => {
                      const columnTasks = tasksByStatus[column.id] || [];
                      if (columnTasks.length === 0) return null;
                      
                      return (
                        <AccordionItem key={column.id} value={column.id} className="border rounded-md">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: column.color }}
                              />
                              <h3 className="text-sm font-semibold">{column.name}</h3>
                              <Badge variant="outline">{columnTasks.length}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-3">
                            <div className="space-y-2">
                              {columnTasks.map((task) => {
                                const assignedUser = users.find(u => u.id === task.assignedToId);
                                
                                return (
                                  <div 
                                    key={task.id}
                                    className="p-3 border rounded-md hover-elevate cursor-pointer"
                                    onClick={() => {
                                      setSelectedTask(task);
                                      setIsTaskDetailDialogOpen(true);
                                    }}
                                    data-testid={`task-${task.id}`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1">
                                        <h4 
                                          className="text-sm font-medium mb-1"
                                          data-testid={`title-task-${task.id}`}
                                        >
                                          {task.title}
                                        </h4>
                                        {task.description && (
                                          <p className="text-xs text-muted-foreground line-clamp-2">
                                            {task.description}
                                          </p>
                                        )}
                                        {task.dueDate && (
                                          <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
                                            <CalendarIcon className="h-3 w-3" />
                                            {format(new Date(task.dueDate), "dd MMM yyyy", { locale: fr })}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {assignedUser && (
                                          <Avatar className="h-8 w-8">
                                            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                              {assignedUser.firstName?.[0]}{assignedUser.lastName?.[0]}
                                            </AvatarFallback>
                                          </Avatar>
                                        )}
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteTaskId(task.id);
                                            setIsDeleteTaskDialogOpen(true);
                                          }}
                                          data-testid={`button-delete-task-${task.id}`}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>
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
                                  {note.status === "draft" ? "Brouillon" : note.status === "active" ? "Actif" : "Archivé"}
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
                <div className="flex justify-end mb-4">
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
                {projectDocuments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-[12px]">
                    Aucun document lié à ce projet.
                  </div>
                ) : (
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
                                  {document.status === "draft" ? "Brouillon" : 
                                   document.status === "published" ? "Publié" : "Archivé"}
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
              </CardContent>
            </Card>
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

          <TabsContent value="billing" className="mt-0">
            {/* KPIs Facturation - 2 lignes de 3 cartes */}
            {(() => {
              const totalBilled = parseFloat(project?.totalBilled || "0") || 0;
              const numberOfDays = parseFloat(project?.numberOfDays || "0") || 0;
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
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <div className="text-xs text-muted-foreground mb-1">Montant facturé</div>
                        <div className="text-xl font-bold text-primary" data-testid="kpi-total-billed">
                          {totalBilled.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <div className="text-xs text-muted-foreground mb-1">Nombre de jours facturé</div>
                        <div className="text-xl font-bold" data-testid="kpi-number-of-days">
                          {numberOfDays > 0 ? `${numberOfDays} j` : "-"}
                        </div>
                      </CardContent>
                    </Card>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="cursor-help">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-xs text-muted-foreground mb-1">
                              {isForfait ? "TJM facturé" : "TJM projet"}
                            </div>
                            <div className="text-xl font-bold" data-testid="kpi-effective-tjm">
                              {isForfait 
                                ? (effectiveDailyRate > 0 
                                    ? effectiveDailyRate.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })
                                    : "-")
                                : (effectiveTJMData?.effectiveTJM 
                                    ? `${effectiveTJMData.effectiveTJM} €`
                                    : "-")
                              }
                            </div>
                            {isForfait && effectiveDailyRate > 0 && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                Montant ÷ Jours
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-white dark:bg-gray-800 text-foreground">
                        <p className="text-sm">{isForfait ? "Taux journalier réel calculé sur ce projet." : "Taux journalier moyen défini pour ce projet."}</p>
                        <p className="text-xs text-muted-foreground mt-1">{isForfait ? "Formule : Montant facturé ÷ Nombre de jours" : "Défini dans les paramètres du projet ou global"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  
                  {/* Ligne 2: Prix minimum recommandé, Coût actualisé, Marge prévisionnelle */}
                  <div className="grid grid-cols-3 gap-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="cursor-help">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-xs text-muted-foreground mb-1">Prix minimum recommandé</div>
                            <div className="text-xl font-bold" data-testid="kpi-recommended-price">
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
                        <p className="text-sm">Prix de vente minimum pour atteindre votre marge cible.</p>
                        <p className="text-xs text-muted-foreground mt-1">Formule : Coût actualisé ÷ (1 - Marge cible %)</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="cursor-help">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-xs text-muted-foreground mb-1">Coût actualisé</div>
                            <div className="text-xl font-bold" data-testid="kpi-estimated-cost">
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
                        <p className="text-sm">Coût interne basé sur le temps travaillé.</p>
                        <p className="text-xs text-muted-foreground mt-1">Formule : Jours travaillés × TJM cible</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="cursor-help">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-xs text-muted-foreground mb-1">Marge prévisionnelle</div>
                            <div className={`text-xl font-bold ${margin >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="kpi-margin">
                              {margin !== 0 
                                ? margin.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })
                                : "-"}
                            </div>
                            {margin !== 0 && (
                              <div className={`text-[10px] mt-1 ${marginPercent >= targetMarginPercent ? "text-green-600" : marginPercent >= 0 ? "text-muted-foreground" : "text-red-600"}`}>
                                {marginPercent.toFixed(1)}% de marge
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-white dark:bg-gray-800 text-foreground">
                        <p className="text-sm">Différence entre le CA encaissé et le coût actualisé.</p>
                        <p className="text-xs text-muted-foreground mt-1">Formule : CA encaissé - Coût actualisé</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })()}

            <Card>
              <CardContent className="pt-6 grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="business-type" className="text-xs">Type de projet</Label>
                  <Select
                    value={project?.businessType || "client"}
                    onValueChange={async (value) => {
                      try {
                        await apiRequest(`/api/projects/${id}`, "PATCH", {
                          businessType: value,
                        });
                        queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                        queryClient.invalidateQueries({ queryKey: ['/api/profitability/summary'] });
                        toast({
                          title: "Mise à jour réussie",
                          description: value === 'internal' 
                            ? "Projet marqué comme interne (exclu de la rentabilité)"
                            : "Projet marqué comme client (inclus dans la rentabilité)",
                          variant: "success",
                        });
                      } catch (error: any) {
                        toast({
                          title: "Erreur",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <SelectTrigger id="business-type" data-testid="select-business-type">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client" data-testid="option-business-client">
                        Projet client
                      </SelectItem>
                      <SelectItem value="internal" data-testid="option-business-internal">
                        Projet interne
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {project?.businessType === "internal" 
                      ? "Projet interne : exclu des calculs de rentabilité"
                      : "Projet client : facturable et inclus dans les analyses de rentabilité"}
                  </p>
                </div>

                <div>
                  <Label htmlFor="billing-type" className="text-xs">Type de facturation</Label>
                  <Select
                    value={project?.billingType || "time"}
                    onValueChange={async (value) => {
                      try {
                        await apiRequest(`/api/projects/${id}`, "PATCH", {
                          billingType: value,
                        });
                        queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                        queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/time-entries`] });
                        toast({
                          title: "Mise à jour réussie",
                          description: "Le type de facturation a été modifié",
                          variant: "success",
                        });
                      } catch (error: any) {
                        toast({
                          title: "Erreur",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <SelectTrigger id="billing-type" data-testid="select-billing-type">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time" data-testid="option-billing-time">
                        Temps passé
                      </SelectItem>
                      <SelectItem value="fixed" data-testid="option-billing-fixed">
                        Forfait
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {project?.billingType === "fixed" 
                      ? "Facturation au forfait : montant total fixe"
                      : "Facturation au temps passé : taux horaire ou journalier"}
                  </p>
                </div>

                {project?.billingType === "time" && (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Label htmlFor="billing-rate" className="text-xs mb-0">TJM projet</Label>
                        {effectiveTJMData?.source === 'global' && !billingRateValue && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-xs px-1.5 py-0.5 cursor-help">
                                <Info className="h-3 w-3 mr-1" />
                                Global: {effectiveTJMData.globalTJM} €
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-xs">
                                Ce projet utilise le TJM global défini dans les paramètres de votre compte. 
                                Définissez un TJM projet ici pour le personnaliser.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {effectiveTJMData?.source === 'project' && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                            Personnalisé
                          </Badge>
                        )}
                      </div>
                      <Input
                        id="billing-rate"
                        type="number"
                        placeholder={effectiveTJMData?.globalTJM ? `${effectiveTJMData.globalTJM} (global)` : "450"}
                        value={billingRateValue}
                        onChange={(e) => setBillingRateValue(e.target.value)}
                        onBlur={async () => {
                          const trimmedValue = billingRateValue.trim();
                          if (trimmedValue !== project?.billingRate) {
                            try {
                              // Parse and validate the number
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
                              toast({
                                title: "Erreur",
                                description: error.message,
                                variant: "destructive",
                              });
                              // Rollback to previous value
                              setBillingRateValue(project?.billingRate || "");
                            }
                          }
                        }}
                        data-testid="input-billing-rate"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {!billingRateValue && effectiveTJMData?.globalTJM 
                          ? "Laissez vide pour utiliser le TJM global"
                          : "TJM spécifique à ce projet (override le global)"}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="billing-unit" className="text-xs">Unité de facturation</Label>
                      <Select
                        value={project?.billingUnit || "hour"}
                        onValueChange={async (value) => {
                          try {
                            await apiRequest(`/api/projects/${id}`, "PATCH", {
                              billingUnit: value,
                            });
                            queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                            queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/time-entries`] });
                            toast({
                              title: "Mise à jour réussie",
                              description: "L'unité de facturation a été modifiée",
                              variant: "success",
                            });
                          } catch (error: any) {
                            toast({
                              title: "Erreur",
                              description: error.message,
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <SelectTrigger id="billing-unit" data-testid="select-billing-unit">
                          <SelectValue placeholder="Sélectionner une unité" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hour" data-testid="option-unit-hour">
                            Heure
                          </SelectItem>
                          <SelectItem value="day" data-testid="option-unit-day">
                            Jour
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="total-billed" className="text-xs">Montant total facturé</Label>
                  <Input
                    id="total-billed"
                    type="number"
                    placeholder="5000"
                    value={totalBilledValue}
                    onChange={(e) => setTotalBilledValue(e.target.value)}
                    onBlur={async () => {
                      const trimmedValue = totalBilledValue.trim();
                      if (trimmedValue !== project?.totalBilled) {
                        try {
                          // Parse and validate the number
                          const numValue = trimmedValue === "" ? null : parseFloat(trimmedValue);
                          if (trimmedValue !== "" && (isNaN(numValue!) || numValue! < 0)) {
                            throw new Error("Veuillez entrer un nombre valide");
                          }
                          
                          await apiRequest(`/api/projects/${id}`, "PATCH", {
                            totalBilled: trimmedValue === "" ? null : trimmedValue,
                          });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                          queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/time-entries`] });
                          toast({
                            title: "Montant facturé mis à jour",
                            description: trimmedValue ? `${parseFloat(trimmedValue).toFixed(2)} €` : "Montant supprimé",
                            variant: "success",
                          });
                        } catch (error: any) {
                          toast({
                            title: "Erreur",
                            description: error.message,
                            variant: "destructive",
                          });
                          // Rollback to previous value
                          setTotalBilledValue(project?.totalBilled || "");
                        }
                      }
                    }}
                    data-testid="input-total-billed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Montant total facturé au client en euros
                  </p>
                </div>

                <div>
                  <Label htmlFor="number-of-days" className="text-xs">Nombre de jours</Label>
                  <Input
                    id="number-of-days"
                    type="number"
                    step="0.5"
                    placeholder="10"
                    value={numberOfDaysValue}
                    onChange={(e) => setNumberOfDaysValue(e.target.value)}
                    onBlur={async () => {
                      const trimmedValue = numberOfDaysValue.trim();
                      if (trimmedValue !== project?.numberOfDays) {
                        try {
                          // Parse and validate the number
                          const numValue = trimmedValue === "" ? null : parseFloat(trimmedValue);
                          if (trimmedValue !== "" && (isNaN(numValue!) || numValue! < 0)) {
                            throw new Error("Veuillez entrer un nombre valide");
                          }
                          
                          await apiRequest(`/api/projects/${id}`, "PATCH", {
                            numberOfDays: trimmedValue === "" ? null : trimmedValue,
                          });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                          toast({
                            title: "Nombre de jours mis à jour",
                            description: trimmedValue ? `${parseFloat(trimmedValue)} jour${parseFloat(trimmedValue) > 1 ? 's' : ''}` : "Nombre de jours supprimé",
                            variant: "success",
                          });
                        } catch (error: any) {
                          toast({
                            title: "Erreur",
                            description: error.message,
                            variant: "destructive",
                          });
                          // Rollback to previous value
                          setNumberOfDaysValue(project?.numberOfDays || "");
                        }
                      }
                    }}
                    data-testid="input-number-of-days"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Nombre de jours pour le calcul du TJM théorique
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Project Scope Section - CDC avec allocation de temps */}
            <div id="scope-section" className="mt-4">
              <ProjectScopeSection
                projectId={id!}
                dailyRate={effectiveTJMData?.effectiveTJM || 0}
                internalDailyCost={effectiveTJMData?.effectiveInternalDailyCost || 0}
                targetMarginPercent={parseFloat(project?.targetMarginPercent?.toString() || "0")}
                budget={parseFloat(project?.budget?.toString() || "0")}
                projectStage={project?.stage || 'prospection'}
                tjmSource={effectiveTJMData?.source}
              />
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
                    }}
                    data-testid="button-add-payment"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter un paiement
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress bar */}
                {project?.budget && parseFloat(project.budget) > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progression du paiement</span>
                      <span className="font-medium">
                        {totalPaid.toFixed(2)} € / {parseFloat(project.budget).toFixed(2)} €
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, (totalPaid / parseFloat(project.budget)) * 100)} 
                      className="h-2"
                      data-testid="progress-payment"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{((totalPaid / parseFloat(project.budget)) * 100).toFixed(0)}% payé</span>
                      <span>{remainingAmount > 0 ? `${remainingAmount.toFixed(2)} € restant` : "Entièrement payé"}</span>
                    </div>
                  </div>
                )}

                {/* Payment form */}
                {showPaymentForm && (
                  <div className="border rounded-lg p-4 space-y-4 bg-muted/30" data-testid="form-payment">
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
                          if (!paymentAmount || !paymentDate) {
                            toast({
                              title: "Erreur",
                              description: "Veuillez remplir le montant et la date",
                              variant: "destructive",
                            });
                            return;
                          }
                          try {
                            await apiRequest(`/api/projects/${id}/payments`, "POST", {
                              amount: paymentAmount,
                              paymentDate: formatDateForStorage(paymentDate),
                              description: paymentDescription || null,
                            });
                            queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'payments'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                            setShowPaymentForm(false);
                            setPaymentAmount("");
                            setPaymentDescription("");
                            toast({
                              title: "Paiement enregistré",
                              description: `Paiement de ${parseFloat(paymentAmount).toFixed(2)} € enregistré`,
                              variant: "success",
                            });
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
                    <div className="space-y-2">
                      {payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                          data-testid={`payment-item-${payment.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <div className="text-[13px] font-semibold">
                                {parseFloat(payment.amount).toFixed(2)} €
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
                              size="icon"
                              onClick={() => {
                                setEditingPayment(payment);
                                setEditPaymentAmount(payment.amount);
                                setEditPaymentDate(new Date(payment.paymentDate));
                                setEditPaymentDescription(payment.description || "");
                              }}
                              data-testid={`button-edit-payment-${payment.id}`}
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletePaymentId(payment.id)}
                              data-testid={`button-delete-payment-${payment.id}`}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
            {/* Project Info Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-semibold tracking-tight text-[16px]">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-[12px]" data-testid="project-description-tab">
                    {project.description || "Aucune description renseignée"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="tracking-tight font-semibold text-foreground text-[16px]">Période</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-[12px]">Début:</span>
                        <span className="text-[12px]" data-testid="project-start-date-tab">
                          {project.startDate 
                            ? format(new Date(project.startDate), "dd MMM yyyy", { locale: fr })
                            : "Non définie"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-[12px]">Fin:</span>
                        <span className="text-[12px]" data-testid="project-end-date-tab">
                          {project.endDate 
                            ? format(new Date(project.endDate), "dd MMM yyyy", { locale: fr })
                            : "Non définie"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activities Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                <CardTitle className="text-base">Activités</CardTitle>
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
                {projectActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Aucune activité enregistrée pour ce projet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectActivities.map((activity) => {
                      const user = users.find(u => u.id === activity.createdBy);
                      const getKindLabel = (kind: string) => {
                        const labels: Record<string, string> = {
                          email: "Email",
                          call: "Appel",
                          meeting: "Réunion",
                          note: "Note",
                          task: "Tâche",
                          created: "Création",
                          updated: "Mise à jour",
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

                      return (
                        <div 
                          key={activity.id} 
                          className="p-4 border rounded-md hover-elevate"
                          data-testid={`activity-${activity.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge className={cn("text-xs flex items-center gap-1", getKindColor(activity.kind))}>
                                  {getKindIcon(activity.kind)}
                                  {getKindLabel(activity.kind)}
                                </Badge>
                                {activity.kind === 'updated' && getUpdateDetails(activity) && (
                                  <span className="text-xs text-muted-foreground italic">
                                    ({getUpdateDetails(activity)})
                                  </span>
                                )}
                              </div>
                              <p className="text-xs">{activity.description}</p>
                              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                                {user && (
                                  <span>Par {user.firstName} {user.lastName}</span>
                                )}
                                {activity.createdAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-2.5 w-2.5" />
                                    {format(new Date(activity.createdAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                                  </span>
                                )}
                                {activity.occurredAt && activity.occurredAt !== activity.createdAt && (
                                  <span className="flex items-center gap-1">
                                    <CalendarIcon className="h-2.5 w-2.5" />
                                    {format(new Date(activity.occurredAt), "dd MMM yyyy", { locale: fr })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openActivityDialog(activity)}
                                data-testid={`button-edit-activity-${activity.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDeleteActivityId(activity.id);
                                  setIsDeleteActivityDialogOpen(true);
                                }}
                                data-testid={`button-delete-activity-${activity.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Historique - Timeline du projet */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="font-semibold tracking-tight text-[18px]">Historique</CardTitle>
              </CardHeader>
              <CardContent>
                {projectTasks.length === 0 && projectNotes.length === 0 && projectDocuments.length === 0 && !project ? (
                  <div className="py-12 text-center text-muted-foreground">
                    Aucun historique pour le moment
                  </div>
                ) : (
                  <div className="relative space-y-6 pl-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {[
                      ...(project ? [{ ...project, _date: new Date(project.createdAt), _type: 'project_created' as const }] : []),
                      ...projectTasks.map((t) => ({ ...t, _date: new Date(t.createdAt), _type: 'task' as const })),
                      ...projectNotes.map((n) => ({ ...n, _date: new Date(n.createdAt), _type: 'note' as const })),
                      ...projectDocuments.map((d) => ({ ...d, _date: new Date(d.createdAt), _type: 'document' as const })),
                    ]
                      .sort((a, b) => b._date.getTime() - a._date.getTime())
                      .map((item) => {
                        const author = users.find((u) => u.id === item.createdBy);
                        
                        if (item._type === 'project_created') {
                          return (
                            <div key="project-created" className="relative" data-testid="history-project-created">
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <Briefcase className="w-3 h-3 text-primary-foreground" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-foreground">
                                  <span className="font-medium">
                                    {author?.firstName} {author?.lastName}
                                  </span>{" "}
                                  a créé le projet
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        if (item._type === 'task') {
                          return (
                            <div key={`task-${item.id}`} className="relative" data-testid={`history-task-${item.id}`}>
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-foreground">
                                  <span className="font-medium">{author?.firstName} {author?.lastName}</span> a créé une tâche : {(item as Task).title}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        if (item._type === 'note') {
                          return (
                            <div key={`note-${item.id}`} className="relative" data-testid={`history-note-${item.id}`}>
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                                <StickyNote className="w-3 h-3 text-white" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-foreground">
                                  <span className="font-medium">{author?.firstName} {author?.lastName}</span> a créé une note : {(item as Note).title}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        if (item._type === 'document') {
                          return (
                            <div key={`document-${item.id}`} className="relative" data-testid={`history-document-${item.id}`}>
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                <FileText className="w-3 h-3 text-white" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-foreground">
                                  <span className="font-medium">{author?.firstName} {author?.lastName}</span> a ajouté un document : {(item as Document).name}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Sheet open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col" data-testid="dialog-edit-project">
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
                data-testid="input-edit-description"
              />
            </div>
            <div>
              <Label htmlFor="edit-client">Client</Label>
              <Select
                value={projectFormData.clientId}
                onValueChange={(value) => setProjectFormData({ ...projectFormData, clientId: value })}
              >
                <SelectTrigger id="edit-client" data-testid="select-edit-client">
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
                <SelectTrigger id="edit-stage" data-testid="select-edit-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-card">
                  {PROJECT_STAGES.map((stage) => (
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
                  <PopoverContent className="w-auto p-0 bg-popover">
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
                  <PopoverContent className="w-auto p-0 bg-popover">
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
      <Sheet open={isTaskDetailDialogOpen} onOpenChange={setIsTaskDetailDialogOpen}>
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto bg-background" data-testid="dialog-task-detail">
          <SheetHeader>
            <SheetTitle>Détails de la tâche</SheetTitle>
          </SheetHeader>
          {selectedTask && taskEditData.id && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="task-title">Titre *</Label>
                <Input
                  id="task-title"
                  value={taskEditData.title || ""}
                  onChange={(e) => setTaskEditData({ ...taskEditData, title: e.target.value })}
                  data-testid="input-task-title"
                />
              </div>

              <div>
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={taskEditData.description || ""}
                  onChange={(e) => setTaskEditData({ ...taskEditData, description: e.target.value })}
                  rows={3}
                  data-testid="input-task-description"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="task-priority">Priorité</Label>
                  <Select
                    value={taskEditData.priority || "medium"}
                    onValueChange={(value) => setTaskEditData({ ...taskEditData, priority: value })}
                  >
                    <SelectTrigger id="task-priority" data-testid="select-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Basse</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="high">Haute</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="task-assigned">Assigné à</Label>
                  <Select
                    value={taskEditData.assignedToId || "none"}
                    onValueChange={(value) => setTaskEditData({ 
                      ...taskEditData, 
                      assignedToId: value === "none" ? null : value 
                    })}
                  >
                    <SelectTrigger id="task-assigned" data-testid="select-task-assigned">
                      <SelectValue placeholder="Non assigné" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non assigné</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="task-due-date">Date d'échéance</Label>
                  <Input
                    id="task-due-date"
                    type="date"
                    value={taskEditData.dueDate || ""}
                    onChange={(e) => setTaskEditData({ ...taskEditData, dueDate: e.target.value || null })}
                    data-testid="input-task-due-date"
                  />
                </div>

                <div>
                  <Label htmlFor="task-effort">Effort</Label>
                  <Select
                    value={taskEditData.effort?.toString() || "none"}
                    onValueChange={(value) => setTaskEditData({ 
                      ...taskEditData, 
                      effort: value === "none" ? null : parseInt(value) 
                    })}
                  >
                    <SelectTrigger id="task-effort" data-testid="select-task-effort">
                      <SelectValue placeholder="Non défini" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non défini</SelectItem>
                      <SelectItem value="1">1 - Très facile</SelectItem>
                      <SelectItem value="2">2 - Facile</SelectItem>
                      <SelectItem value="3">3 - Moyen</SelectItem>
                      <SelectItem value="4">4 - Difficile</SelectItem>
                      <SelectItem value="5">5 - Très difficile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="task-column">Statut</Label>
                <Select
                  value={taskEditData.columnId || ""}
                  onValueChange={(value) => setTaskEditData({ ...taskEditData, columnId: value || null })}
                >
                  <SelectTrigger id="task-column" data-testid="select-task-column">
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: column.color }}
                          />
                          {column.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setIsTaskDetailDialogOpen(false)}
              data-testid="button-close-task-detail"
            >
              Fermer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
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
    </div>
  );
}
