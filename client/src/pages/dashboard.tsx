import { ArrowUp, ArrowDown, FolderKanban, Users, Euro, CheckSquare, Plus, FileText, TrendingUp, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, Client, Activity, AppUser, InsertClient, InsertProject, Task, TaskColumn } from "@shared/schema";
import { insertClientSchema, insertProjectSchema } from "@shared/schema";
import { useState, useEffect, useMemo } from "react";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { Loader } from "@/components/Loader";

// Fonction pour obtenir les couleurs du badge selon le stage (même logique que dans project-detail.tsx)
const getStageColor = (stage: string) => {
  const colors: Record<string, string> = {
    prospection: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    en_cours: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    termine: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    signe: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };
  return colors[stage] || "";
};

// Fonction pour obtenir le label du stage
const getStageLabel = (stage: string) => {
  const labels: Record<string, string> = {
    prospection: "Prospection",
    en_cours: "En cours",
    termine: "Terminé",
    signe: "Signé",
  };
  return labels[stage] || stage;
};

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
  };
  return translations[kind] || kind;
};

// Fonction pour traduire les types de sujets
const translateSubjectType = (subjectType: string) => {
  const translations: Record<string, string> = {
    project: "projet",
    client: "client",
    deal: "affaire",
    task: "tâche",
    note: "note",
    contact: "contact",
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
    "Document created:": "Document créé :",
    "Nouvelle note créée:": "Nouvelle note créée :",
  };
  
  // Try to translate known patterns
  for (const [key, value] of Object.entries(translations)) {
    if (description.includes(key)) {
      return description.replace(key, value);
    }
  }
  
  return description;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isCreateClientDialogOpen, setIsCreateClientDialogOpen] = useState(false);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [myDayFilter, setMyDayFilter] = useState<"today" | "overdue" | "next3days">("today");
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

  // Get task columns from first project or create default ones
  const firstProject = projects[0];
  const { data: taskColumns = [] } = useQuery<TaskColumn[]>({
    queryKey: ["/api/projects", firstProject?.id, "task-columns"],
    enabled: !!firstProject?.id,
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      const response = await apiRequest("POST", "/api/clients", data);
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
      return await apiRequest("POST", "/api/projects", data);
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
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      return await apiRequest(`/api/tasks/${taskId}`, "PATCH", { status });
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
      if (firstProject?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", firstProject.id, "tasks"] });
      }
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
      if (firstProject?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", firstProject.id, "tasks"] });
      }
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
  // Par définition, tous les projets sont "en cours" sauf ceux qui sont terminés
  const activeProjectsCount = projects.filter(p => p.stage !== "termine").length;
  const totalProjectsCount = projects.length;
  const clientsCount = clients.length;
  
  // Chiffre d'affaires de l'année: somme des budgets des projets signés, terminés ou en cours de l'année en cours
  const currentYear = new Date().getFullYear();
  const annualRevenue = projects
    .filter(p => {
      // Filtrer par stage
      const validStage = p.stage === "signe" || p.stage === "termine" || p.stage === "en_cours";
      if (!validStage) return false;
      
      // Filtrer par année (basé sur startDate ou createdAt)
      const dateToCheck = p.startDate || p.createdAt;
      if (!dateToCheck) return false;
      
      const projectYear = new Date(dateToCheck).getFullYear();
      return projectYear === currentYear;
    })
    .reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
  
  // Compter les tâches en cours (status !== 'done')
  const activeTasksCount = tasks.filter(t => t.status !== "done").length;

  // KPI data from real data
  const kpis: Array<{
    title: string;
    value: string;
    change: string;
    changeType: "positive" | "negative" | "neutral";
    icon: any;
    iconBg: string;
    iconColor: string;
    link?: { label: string; href: string };
  }> = [
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
    {
      title: "Clients",
      value: clientsCount.toString(),
      change: "+12.5%",
      changeType: "positive",
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      link: { label: "Voir tous", href: "/crm" },
    },
    {
      title: "Chiffre d'affaires",
      value: `€${annualRevenue.toLocaleString()}`,
      change: `CA ${currentYear}`,
      changeType: "neutral",
      icon: Euro,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      title: "Tâches en cours",
      value: activeTasksCount.toString(),
      change: `${tasks.length} au total`,
      changeType: "neutral",
      icon: CheckSquare,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      link: { label: "Voir plus", href: "/projects?tab=tasks" },
    },
  ];

  // Recent 5 projects from API, sorted by creation date
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Activity feed from API
  const activityFeed = activities.slice(0, 5);

  // Revenue data for chart - based on project budgets by start month (last 6 months)
  const revenueData = (() => {
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const now = new Date();
    const last6Months: Array<{ month: string; monthIndex: number; year: number }> = [];
    
    // Get the last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last6Months.push({
        month: monthNames[d.getMonth()],
        monthIndex: d.getMonth(),
        year: d.getFullYear()
      });
    }
    
    // Initialize monthly budgets and project counts for last 6 months
    const monthlyBudgets: Record<string, number> = {};
    const monthlyProjectCounts: Record<string, number> = {};
    last6Months.forEach(({ month }) => {
      monthlyBudgets[month] = 0;
      monthlyProjectCounts[month] = 0;
    });
    
    // Sum budgets and count projects by start month (only for last 6 months)
    projects.forEach(project => {
      if (project.startDate && project.budget) {
        const startDate = new Date(project.startDate);
        const projectMonth = startDate.getMonth();
        const projectYear = startDate.getFullYear();
        
        // Check if this project's start date is in the last 6 months
        const matchingMonth = last6Months.find(
          m => m.monthIndex === projectMonth && m.year === projectYear
        );
        
        if (matchingMonth) {
          monthlyBudgets[matchingMonth.month] += Number(project.budget) || 0;
          monthlyProjectCounts[matchingMonth.month] += 1;
        }
      }
    });
    
    return last6Months.map(({ month }) => ({
      month,
      revenue: monthlyBudgets[month],
      projectCount: monthlyProjectCounts[month]
    }));
  })();

  return (
    <div className="h-full overflow-auto">
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
                  <SelectContent className="bg-white dark:bg-gray-950">
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
                    <SelectContent className="bg-white dark:bg-gray-950">
                      <SelectItem value="prospection" className="cursor-pointer">Prospection</SelectItem>
                      <SelectItem value="signe" className="cursor-pointer">Signé</SelectItem>
                      <SelectItem value="en_cours" className="cursor-pointer">En cours</SelectItem>
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
                      startDate: projectFormData.startDate ? projectFormData.startDate.toISOString().split('T')[0] : null,
                      endDate: projectFormData.endDate ? projectFormData.endDate.toISOString().split('T')[0] : null,
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-4">
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
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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


        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Revenue Chart - Col Span 2 */}
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 space-y-0 pb-2">
              <CardTitle className="text-base font-heading font-semibold">
                Revenus Mensuels
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 text-[12px]">
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={200}>
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
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-heading font-semibold">
                Activités Récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityFeed.map((activity) => {
                  const payload = activity.payload as { description?: string };
                  const translatedKind = translateActivityKind(activity.kind);
                  const translatedSubject = translateSubjectType(activity.subjectType);
                  const description = payload.description 
                    ? translateActivityDescription(payload.description)
                    : `${translatedSubject} ${translatedKind}`;
                  return (
                    <div key={activity.id} className="flex items-start gap-3" data-testid={`activity-${activity.id}`}>
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground capitalize">
                          {description}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projets Récents & Ma Journée Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Recent Projects */}
          <Card>
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

          {/* Ma Journée Widget - Today's Tasks + Overdue */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base font-heading font-semibold">
                  Ma Journée
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={myDayFilter} onValueChange={(value: any) => setMyDayFilter(value)}>
                    <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-my-day-filter">
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

                    return (
                      <div
                        key={task.id}
                        className={`flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer ${
                          isOverdue ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20' : ''
                        }`}
                        data-testid={`today-task-${task.id}`}
                        onClick={() => handleTaskClick(task)}
                      >
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateTaskStatusMutation.mutate({ taskId: task.id, status: "done" });
                          }}
                          className="mt-1 h-4 w-4 shrink-0"
                          data-testid={`checkbox-task-${task.id}`}
                        />
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
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        users={users}
        projects={projects}
        columns={taskColumns}
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
      />
    </div>
  );
}
