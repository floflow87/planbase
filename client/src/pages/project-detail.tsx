import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Calendar as CalendarIcon, Euro, Tag, Edit, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Project, Task, Client, AppUser, TaskColumn } from "@shared/schema";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

  const updateProjectMutation = {
    mutate: async ({ data }: { data: Partial<Project> }) => {
      try {
        await apiRequest("PATCH", `/api/projects/${id}`, data);
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
        toast({
          title: "Projet mis à jour",
          description: "Le projet a été mis à jour avec succès.",
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
        await apiRequest("DELETE", `/api/projects/${id}`);
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        toast({
          title: "Projet supprimé",
          description: "Le projet a été supprimé avec succès.",
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
        <div className="text-muted-foreground">Chargement...</div>
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
                <p className="text-muted-foreground text-sm">
                  {project.client?.name || "Client non défini"}
                </p>
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Tâches associées
              </CardTitle>
              <Badge variant="secondary" data-testid="tasks-count">
                {projectTasks.length} tâche{projectTasks.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {projectTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune tâche associée à ce projet.
              </div>
            ) : (
              <div className="space-y-4">
                {columns.map((column) => {
                  const columnTasks = tasksByStatus[column.id] || [];
                  if (columnTasks.length === 0) return null;
                  
                  return (
                    <div key={column.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: column.color }}
                        />
                        <h3 className="font-semibold">{column.name}</h3>
                        <Badge variant="outline">{columnTasks.length}</Badge>
                      </div>
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
                                  <h4 className="font-medium mb-1">{task.title}</h4>
                                  {task.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                                {assignedUser && (
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                      {assignedUser.firstName?.[0]}{assignedUser.lastName?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                              </div>
                              {task.dueDate && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                  <CalendarIcon className="h-3 w-3" />
                                  {format(new Date(task.dueDate), "dd MMM yyyy", { locale: fr })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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
        <DialogContent className="max-w-2xl" data-testid="dialog-task-detail">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              {selectedTask.description && (
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedTask.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Priorité</Label>
                  <div className="mt-1">
                    <Badge variant={
                      selectedTask.priority === "high" ? "destructive" :
                      selectedTask.priority === "medium" ? "default" :
                      "secondary"
                    }>
                      {selectedTask.priority === "high" ? "Haute" :
                       selectedTask.priority === "medium" ? "Moyenne" :
                       "Basse"}
                    </Badge>
                  </div>
                </div>
                
                {selectedTask.assignedToId && (
                  <div>
                    <Label className="text-sm font-medium">Assigné à</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {users.find(u => u.id === selectedTask.assignedToId) && (
                        <>
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                              {users.find(u => u.id === selectedTask.assignedToId)?.firstName?.[0]}
                              {users.find(u => u.id === selectedTask.assignedToId)?.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {users.find(u => u.id === selectedTask.assignedToId)?.firstName}{' '}
                            {users.find(u => u.id === selectedTask.assignedToId)?.lastName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedTask.dueDate && (
                <div>
                  <Label className="text-sm font-medium">Date d'échéance</Label>
                  <div className="flex items-center gap-2 mt-1 text-sm">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    {format(new Date(selectedTask.dueDate), "dd MMMM yyyy", { locale: fr })}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Statut</Label>
                <div className="mt-1">
                  {columns.find(c => c.id === selectedTask.columnId) && (
                    <Badge 
                      variant="outline"
                      style={{
                        backgroundColor: columns.find(c => c.id === selectedTask.columnId)?.color,
                      }}
                    >
                      {columns.find(c => c.id === selectedTask.columnId)?.name}
                    </Badge>
                  )}
                </div>
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
    </div>
  );
}
