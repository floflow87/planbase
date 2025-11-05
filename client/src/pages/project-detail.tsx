import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Calendar as CalendarIcon, Euro, Tag, Edit, Trash2, Users, Star, FileText } from "lucide-react";
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
import type { Project, Task, Client, AppUser, TaskColumn, Note } from "@shared/schema";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader } from "@/components/Loader";

interface ProjectWithRelations extends Project {
  client?: Client;
  tasks?: Task[];
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

  const updateProjectMutation = {
    mutate: async ({ data }: { data: Partial<Project> }) => {
      try {
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
      }
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

  const handleSubmitEdit = () => {
    updateProjectMutation.mutate({
      data: {
        name: projectFormData.name,
        description: projectFormData.description,
        clientId: projectFormData.clientId || null,
        stage: projectFormData.stage,
        category: projectFormData.category || null,
        startDate: projectFormData.startDate?.toISOString() || null,
        endDate: projectFormData.endDate?.toISOString() || null,
        budget: projectFormData.budget || null,
      },
    });
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
                      {project.client.name}
                    </p>
                  </Link>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Client non défini
                  </p>
                )}
                {project.budget && (
                  <Badge className="bg-orange-500 hover:bg-orange-600 text-white shrink-0" data-testid="badge-budget">
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
              <span className="hidden sm:inline">Supprimer</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          {project.description && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground" data-testid="project-description">
                  {project.description}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className={!project.description ? "lg:col-span-3" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Période</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Début:</span>
                    <span data-testid="project-start-date">
                      {project.startDate 
                        ? format(new Date(project.startDate), "dd MMM yyyy", { locale: fr })
                        : "Non définie"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Fin:</span>
                    <span data-testid="project-end-date">
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
          </TabsList>

          <TabsContent value="tasks" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                {projectTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune tâche associée à ce projet.
                  </div>
                ) : (
                  <Accordion type="multiple" defaultValue={columns.map(c => c.id)} className="space-y-2">
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
                  <div className="text-center py-8 text-muted-foreground">
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
        </Tabs>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-project">
          <DialogHeader>
            <DialogTitle>Modifier le projet</DialogTitle>
            <DialogDescription>
              Modifiez les informations du projet ci-dessous.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
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
              <Input
                id="edit-category"
                value={projectFormData.category}
                onChange={(e) => setProjectFormData({ ...projectFormData, category: e.target.value })}
                data-testid="input-edit-category"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-start-date">Date de début</Label>
                <Input
                  id="edit-start-date"
                  type="date"
                  value={projectFormData.startDate ? projectFormData.startDate.toISOString().split('T')[0] : ""}
                  onChange={(e) => setProjectFormData({ 
                    ...projectFormData, 
                    startDate: e.target.value ? new Date(e.target.value) : undefined 
                  })}
                  data-testid="input-edit-start-date"
                />
              </div>
              <div>
                <Label htmlFor="edit-end-date">Date de fin</Label>
                <Input
                  id="edit-end-date"
                  type="date"
                  value={projectFormData.endDate ? projectFormData.endDate.toISOString().split('T')[0] : ""}
                  onChange={(e) => setProjectFormData({ 
                    ...projectFormData, 
                    endDate: e.target.value ? new Date(e.target.value) : undefined 
                  })}
                  data-testid="input-edit-end-date"
                />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
              Annuler
            </Button>
            <Button onClick={handleSubmitEdit} data-testid="button-submit-edit">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
