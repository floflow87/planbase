import { useState, useEffect } from "react";
import { Search, Filter, Settings as SettingsIcon, LayoutGrid, List, Table2, Plus, MoreVertical, GripVertical, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Project, type Task, type InsertTask, insertTaskSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Projects() {
  const [, setLocation] = useLocation();
  const accountId = localStorage.getItem("demo_account_id");
  const { toast } = useToast();
  
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "table">("kanban");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Redirect if no account
  useEffect(() => {
    if (!accountId) {
      setLocation("/init");
    }
  }, [accountId, setLocation]);

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/accounts", accountId, "projects"],
    enabled: !!accountId,
  });

  // Set first project as selected by default
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Fetch tasks for selected project
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/projects", selectedProjectId, "tasks"],
    enabled: !!selectedProjectId,
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: Partial<InsertTask>) => {
      const response = await apiRequest("POST", "/api/tasks", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "tasks"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Tâche créée avec succès" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la création", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Form for creating tasks
  const form = useForm<Partial<InsertTask>>({
    defaultValues: {
      projectId: selectedProjectId,
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      assignees: [],
      progress: 0,
      order: 0,
    },
  });

  // Update form when selected project changes
  useEffect(() => {
    form.setValue("projectId", selectedProjectId);
  }, [selectedProjectId, form]);

  const onSubmit = (data: Partial<InsertTask>) => {
    // Validate that we have a selected project before creating task
    if (!selectedProjectId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Aucun projet sélectionné. Veuillez sélectionner un projet d'abord.",
      });
      return;
    }
    
    // Ensure projectId is included
    createTaskMutation.mutate({
      ...data,
      projectId: selectedProjectId,
    } as InsertTask);
  };

  // Group tasks by status
  const tasksByStatus = {
    todo: tasks.filter(t => t.status === "todo"),
    in_progress: tasks.filter(t => t.status === "in_progress"),
    review: tasks.filter(t => t.status === "review"),
    done: tasks.filter(t => t.status === "done"),
  };

  const columns = [
    { id: "todo", title: "À faire", tasks: tasksByStatus.todo },
    { id: "in_progress", title: "En cours", tasks: tasksByStatus.in_progress },
    { id: "review", title: "En revue", tasks: tasksByStatus.review },
    { id: "done", title: "Terminé", tasks: tasksByStatus.done },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-100";
      case "medium":
        return "text-yellow-600 bg-yellow-100";
      case "low":
        return "text-green-600 bg-green-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Urgent";
      case "medium":
        return "Moyen";
      case "low":
        return "Faible";
      default:
        return priority;
    }
  };

  if (!accountId) {
    return null;
  }

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">To-Do & Projects</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestion des tâches en mode Kanban
              </p>
            </div>
            {projects.length > 0 && (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-[280px]" data-testid="select-project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} - {project.progress}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" data-testid="button-filters">
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </Button>
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                data-testid="button-view-kanban"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                data-testid="button-view-table"
              >
                <Table2 className="w-4 h-4" />
              </Button>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-task">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle Tâche
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nouvelle tâche</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Titre *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-task-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value || ""}
                              rows={3}
                              data-testid="input-task-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Statut</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-task-status">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="todo">À faire</SelectItem>
                                <SelectItem value="in_progress">En cours</SelectItem>
                                <SelectItem value="review">En revue</SelectItem>
                                <SelectItem value="done">Terminé</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priorité</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-task-priority">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Faible</SelectItem>
                                <SelectItem value="medium">Moyen</SelectItem>
                                <SelectItem value="high">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="progress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Progression (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={field.value || 0}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                              disabled={field.disabled}
                              data-testid="input-task-progress"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                        data-testid="button-cancel"
                      >
                        Annuler
                      </Button>
                      <Button
                        type="submit"
                        disabled={createTaskMutation.isPending}
                        data-testid="button-submit-task"
                      >
                        Créer
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Project Progress */}
        {selectedProject && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-foreground">
                      Progression du projet
                    </h3>
                    <span className="text-sm font-semibold text-foreground">
                      {selectedProject.progress}%
                    </span>
                  </div>
                  <Progress value={selectedProject.progress} />
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div>{tasks.length} tâches</div>
                  <div>{tasksByStatus.done.length} terminées</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Kanban Board */}
        {tasksLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Chargement des tâches...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {columns.map((column) => (
              <Card key={column.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-heading font-semibold">
                      {column.title}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {column.tasks.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-2">
                  {column.tasks.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Aucune tâche
                    </div>
                  ) : (
                    column.tasks.map((task) => (
                      <Card
                        key={task.id}
                        className="hover-elevate active-elevate-2 cursor-pointer"
                        data-testid={`task-card-${task.id}`}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-medium text-foreground flex-1">
                              {task.title}
                            </h4>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <Badge
                              variant="secondary"
                              className={`text-xs ${getPriorityColor(task.priority)}`}
                            >
                              {getPriorityLabel(task.priority)}
                            </Badge>
                            {task.progress !== null && task.progress > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {task.progress}%
                              </span>
                            )}
                          </div>
                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
