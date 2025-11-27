import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Calendar as CalendarIcon, Euro, Tag, Edit, Trash2, Users, Star, FileText, DollarSign, Timer, Clock, Check, ChevronsUpDown } from "lucide-react";
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
import type { Project, Task, Client, AppUser, TaskColumn, Note, Document } from "@shared/schema";
import { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, formatDateForStorage } from "@/lib/queryClient";
import { Loader } from "@/components/Loader";
import { cn } from "@/lib/utils";

interface ProjectWithRelations extends Project {
  client?: Client;
  tasks?: Task[];
}

type TimeEntry = {
  id: string;
  projectId: string | null;
  userId: string;
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

function TimeTrackingTab({ projectId, project }: { projectId: string; project?: ProjectWithRelations }) {
  const { toast } = useToast();
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);

  const { data: timeEntries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: [`/api/projects/${projectId}/time-entries`],
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

  // Calculate total time in seconds
  const totalTimeSeconds = timeEntries.reduce((sum, entry) => {
    return sum + (entry.duration || 0);
  }, 0);

  // Convert to hours
  const totalTimeHours = totalTimeSeconds / 3600;

  // Calculate profitability
  const calculateProfitability = () => {
    if (!project) return null;

    const billingRate = parseFloat(project.billingRate || "0");
    const totalBilled = parseFloat(project.totalBilled || "0");
    const billingUnit = project.billingUnit || "hour";
    const billingType = project.billingType || "time";

    // Convert time to the right unit
    let timeInUnits = totalTimeHours;
    if (billingUnit === "day") {
      timeInUnits = totalTimeHours / 8; // Assuming 8 hours per day
    }

    // Calculate actual cost (time spent × rate)
    const actualCost = timeInUnits * billingRate;

    // Calculate TJM réel (pour facturation au temps passé uniquement)
    // TJM réel = montant facturé / (heures totales / 8)
    let realDailyRate = undefined;
    if (billingType === "time") {
      const totalDays = totalTimeHours / 8;
      realDailyRate = totalDays > 0 ? totalBilled / totalDays : 0;
    }

    // Calculate TJM théorique
    // TJM théorique = montant total facturé / nombre de jours
    const numberOfDays = parseFloat(project.numberOfDays || "0");
    const theoreticalDailyRate = (numberOfDays > 0 && !isNaN(numberOfDays) && totalBilled > 0) 
      ? totalBilled / numberOfDays 
      : undefined;

    // Calculate profit/loss
    const profitLoss = totalBilled - actualCost;
    const profitLossPercentage = totalBilled > 0 ? (profitLoss / totalBilled) * 100 : 0;

    return {
      actualCost,
      realDailyRate,
      theoreticalDailyRate,
      totalBilled,
      profitLoss,
      profitLossPercentage,
      isProfit: profitLoss >= 0,
      billingType,
    };
  };

  const profitability = calculateProfitability();

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

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Résumé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Temps total enregistré</p>
              <p className="text-2xl font-semibold" data-testid="text-total-time">
                {totalTimeHours.toFixed(2)} heures
              </p>
              <p className="text-xs text-muted-foreground">
                {timeEntries.length} session{timeEntries.length !== 1 ? "s" : ""}
              </p>
            </div>

            {profitability && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Rentabilité</p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={profitability.isProfit ? "default" : "destructive"}
                    className={profitability.isProfit ? "bg-green-600 dark:bg-green-700" : ""}
                    data-testid="badge-profitability"
                  >
                    {profitability.isProfit ? "GAIN" : "PERTE"}
                  </Badge>
                  <span className={`text-lg font-semibold ${profitability.isProfit ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`} data-testid="text-profit-loss">
                    {profitability.profitLoss >= 0 ? "+" : ""}
                    {profitability.profitLoss.toFixed(2)} €
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {profitability.billingType === "time" && profitability.realDailyRate !== undefined ? (
                    <p>TJM réel: {profitability.realDailyRate.toFixed(2)} €</p>
                  ) : (
                    <p>Coût réel: {profitability.actualCost.toFixed(2)} €</p>
                  )}
                  {profitability.theoreticalDailyRate !== undefined && (
                    <p>TJM théorique: {profitability.theoreticalDailyRate.toFixed(2)} €</p>
                  )}
                  <p>Montant facturé: {profitability.totalBilled.toFixed(2)} €</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                        <div className="flex items-center gap-2 mt-2">
                          {user && (
                            <Badge variant="outline" className="text-xs">
                              {user.firstName} {user.lastName}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="secondary" data-testid={`duration-${entry.id}`}>
                          {entry.duration ? formatDuration(entry.duration) : "En cours"}
                        </Badge>
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
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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

  // Initialize billing fields when project loads
  useEffect(() => {
    if (project) {
      setTotalBilledValue(project.totalBilled || project.budget || "");
      setBillingRateValue(project.billingRate || "");
      setNumberOfDaysValue(project.numberOfDays || "");
    }
  }, [project]);

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

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      prospection: "Prospection",
      en_cours: "En cours",
      termine: "Terminé",
      signe: "Signé",
    };
    return labels[stage] || stage;
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      prospection: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      en_cours: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      termine: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      signe: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };
    return colors[stage] || "";
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
    <div className="h-full overflow-auto">
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
                <h1 className="text-xl sm:text-3xl font-bold truncate" data-testid="project-title">{project.name}</h1>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          {project.description && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-semibold tracking-tight text-[16px]">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-[12px]" data-testid="project-description">
                  {project.description}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className={!project.description ? "lg:col-span-3" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="tracking-tight font-semibold text-[#17171c] text-[16px]">Période</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[12px]">Début:</span>
                    <span className="text-[12px]" data-testid="project-start-date">
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
                    <span className="text-[12px]" data-testid="project-end-date">
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

        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="w-full justify-start mb-4">
            <TabsTrigger value="tasks" className="gap-2">
              <Users className="h-4 w-4" />
              Tâches
              <Badge variant="secondary" className="ml-1" data-testid="tasks-count">
                {projectTasks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <FileText className="h-4 w-4" />
              Notes
              <Badge variant="secondary" className="ml-1" data-testid="notes-count">
                {projectNotes.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Documents
              <Badge variant="secondary" className="ml-1" data-testid="documents-count">
                {projectDocuments.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2" data-testid="tab-billing">
              <DollarSign className="h-4 w-4" />
              Facturation
            </TabsTrigger>
            <TabsTrigger value="time" className="gap-2" data-testid="tab-time">
              <Timer className="h-4 w-4" />
              Temps
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-0">
            <Card>
              <CardContent className="p-6 pt-[4px] pb-[4px]">
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

          <TabsContent value="billing" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuration de facturation</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="billing-type">Type de facturation</Label>
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
                      <Label htmlFor="billing-rate">Taux de facturation</Label>
                      <Input
                        id="billing-rate"
                        type="number"
                        placeholder="150"
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
                        Taux horaire ou journalier en euros
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="billing-unit">Unité de facturation</Label>
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
                  <Label htmlFor="total-billed">Montant total facturé</Label>
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
                  <Label htmlFor="number-of-days">Nombre de jours</Label>
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
          </TabsContent>

          <TabsContent value="time" className="mt-0">
            <TimeTrackingTab projectId={id!} project={project} />
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
                    <SelectItem key={client.id} value={client.id} className="bg-white dark:bg-gray-950 cursor-pointer">
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
                <SelectContent>
                  <SelectItem value="prospection">Prospection</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="termine">Terminé</SelectItem>
                  <SelectItem value="signe">Signé</SelectItem>
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
                  <PopoverContent className="w-auto p-0 bg-white">
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
                  <PopoverContent className="w-auto p-0 bg-white">
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
      <Dialog open={isTaskDetailDialogOpen} onOpenChange={setIsTaskDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-task-detail">
          <DialogHeader>
            <DialogTitle>Détails de la tâche</DialogTitle>
            <DialogDescription>
              Modifiez les paramètres de la tâche. Les changements sont automatiquement sauvegardés.
            </DialogDescription>
          </DialogHeader>
          {selectedTask && taskEditData.id && (
            <div className="space-y-4">
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
                      <SelectItem value="1">⭐ Très facile</SelectItem>
                      <SelectItem value="2">⭐⭐ Facile</SelectItem>
                      <SelectItem value="3">⭐⭐⭐ Moyen</SelectItem>
                      <SelectItem value="4">⭐⭐⭐⭐ Difficile</SelectItem>
                      <SelectItem value="5">⭐⭐⭐⭐⭐ Très difficile</SelectItem>
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
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsTaskDetailDialogOpen(false)}
              data-testid="button-close-task-detail"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    </div>
  );
}
