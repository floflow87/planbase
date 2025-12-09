import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { 
  ArrowLeft, Plus, MoreVertical, ChevronDown, ChevronRight, 
  Folder, Clock, User, Calendar, Flag, Layers, ListTodo,
  Play, Square, CheckCircle, Pencil, Trash2, GripVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from "@dnd-kit/core";
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable 
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { 
  Backlog, Epic, UserStory, BacklogTask, Sprint, BacklogColumn, 
  ChecklistItem, AppUser, BacklogItemState, BacklogPriority, Complexity 
} from "@shared/schema";
import { 
  backlogItemStateOptions, backlogPriorityOptions, complexityOptions, 
  sprintStatusOptions 
} from "@shared/schema";

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
  
  const [showEpicDialog, setShowEpicDialog] = useState(false);
  const [showUserStoryDialog, setShowUserStoryDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showSprintDialog, setShowSprintDialog] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [editingUserStory, setEditingUserStory] = useState<UserStory | null>(null);
  const [parentUserStoryId, setParentUserStoryId] = useState<string | null>(null);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());

  const { data: backlog, isLoading } = useQuery<BacklogData>({
    queryKey: ["/api/backlogs", id],
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const createEpicMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; priority?: string; color?: string }) => {
      return apiRequest(`/api/backlogs/${id}/epics`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Epic créé" });
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
      toast({ title: "Epic mis à jour" });
      setEditingEpic(null);
      setShowEpicDialog(false);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteEpicMutation = useMutation({
    mutationFn: async (epicId: string) => apiRequest(`/api/epics/${epicId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Epic supprimé" });
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
      toast({ title: "User Story créée" });
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
      toast({ title: "User Story mise à jour" });
      setEditingUserStory(null);
      setShowUserStoryDialog(false);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteUserStoryMutation = useMutation({
    mutationFn: async (usId: string) => apiRequest(`/api/user-stories/${usId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "User Story supprimée" });
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
      toast({ title: "Tâche créée" });
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
      toast({ title: "Tâche supprimée" });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const createSprintMutation = useMutation({
    mutationFn: async (data: { name: string; goal?: string; startDate?: string; endDate?: string }) => {
      return apiRequest(`/api/backlogs/${id}/sprints`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Sprint créé" });
      setShowSprintDialog(false);
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const startSprintMutation = useMutation({
    mutationFn: async (sprintId: string) => apiRequest(`/api/sprints/${sprintId}/start`, "PATCH"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Sprint démarré" });
    },
    onError: (error: any) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const closeSprintMutation = useMutation({
    mutationFn: async (sprintId: string) => apiRequest(`/api/sprints/${sprintId}/close`, "PATCH"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs", id] });
      toast({ title: "Sprint clôturé" });
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

  const calculateProgress = (story: UserStory & { tasks: BacklogTask[] }) => {
    if (story.tasks.length === 0) return story.state === "termine" ? 100 : 0;
    const done = story.tasks.filter(t => t.state === "termine").length;
    return Math.round((done / story.tasks.length) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate" data-testid="text-backlog-title">{backlog.name}</h1>
          {backlog.description && (
            <p className="text-sm text-muted-foreground truncate">{backlog.description}</p>
          )}
        </div>
        <Badge variant="secondary" className="capitalize">
          {backlog.mode}
        </Badge>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <Button size="sm" onClick={() => setShowEpicDialog(true)} data-testid="button-add-epic">
            <Plus className="h-4 w-4 mr-1" />
            Epic
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowUserStoryDialog(true)} data-testid="button-add-user-story">
            <Plus className="h-4 w-4 mr-1" />
            User Story
          </Button>
          {backlog.mode === "scrum" && (
            <Button size="sm" variant="outline" onClick={() => setShowSprintDialog(true)} data-testid="button-add-sprint">
              <Plus className="h-4 w-4 mr-1" />
              Sprint
            </Button>
          )}
        </div>

        {backlog.mode === "scrum" && backlog.sprints.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Sprints
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {backlog.sprints.map(sprint => (
                <Card key={sprint.id} className="hover-elevate" data-testid={`card-sprint-${sprint.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base truncate" data-testid={`text-sprint-name-${sprint.id}`}>{sprint.name}</CardTitle>
                      <Badge 
                        variant="secondary"
                        style={{ backgroundColor: sprintStatusOptions.find(o => o.value === sprint.status)?.color }}
                        data-testid={`badge-sprint-status-${sprint.id}`}
                      >
                        {sprintStatusOptions.find(o => o.value === sprint.status)?.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {sprint.goal && <p className="text-sm text-muted-foreground mb-2" data-testid={`text-sprint-goal-${sprint.id}`}>{sprint.goal}</p>}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      {sprint.startDate && (
                        <span>{format(new Date(sprint.startDate), "d MMM", { locale: fr })}</span>
                      )}
                      {sprint.startDate && sprint.endDate && <span>-</span>}
                      {sprint.endDate && (
                        <span>{format(new Date(sprint.endDate), "d MMM yyyy", { locale: fr })}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {sprint.status === "preparation" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled={hasActiveSprint}
                          onClick={() => startSprintMutation.mutate(sprint.id)}
                          data-testid={`button-start-sprint-${sprint.id}`}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Démarrer
                        </Button>
                      )}
                      {sprint.status === "en_cours" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => closeSprintMutation.mutate(sprint.id)}
                          data-testid={`button-close-sprint-${sprint.id}`}
                        >
                          <Square className="h-3 w-3 mr-1" />
                          Clôturer
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Backlog
          </h2>

          {backlog.epics.map(epic => (
            <Collapsible 
              key={epic.id} 
              open={expandedEpics.has(epic.id)}
              onOpenChange={() => toggleEpic(epic.id)}
            >
              <Card data-testid={`card-epic-${epic.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-toggle-epic-${epic.id}`}>
                        {expandedEpics.has(epic.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <div 
                      className="h-3 w-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: epic.color || "#C4B5FD" }}
                    />
                    <span className="font-medium flex-1 truncate" data-testid={`text-epic-title-${epic.id}`}>{epic.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {getStoriesForEpic(epic.id).length} US
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-menu-epic-${epic.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setEditingEpic(epic);
                          setShowEpicDialog(true);
                        }} data-testid={`menu-edit-epic-${epic.id}`}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => deleteEpicMutation.mutate(epic.id)}
                          data-testid={`menu-delete-epic-${epic.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-2">
                    {getStoriesForEpic(epic.id).map(story => (
                      <UserStoryRow 
                        key={story.id}
                        story={story}
                        expanded={expandedStories.has(story.id)}
                        onToggle={() => toggleStory(story.id)}
                        onEdit={() => {
                          setEditingUserStory(story);
                          setShowUserStoryDialog(true);
                        }}
                        onDelete={() => deleteUserStoryMutation.mutate(story.id)}
                        onAddTask={() => {
                          setParentUserStoryId(story.id);
                          setShowTaskDialog(true);
                        }}
                        onUpdateTask={(taskId, data) => updateTaskMutation.mutate({ taskId, data })}
                        onDeleteTask={(taskId) => deleteTaskMutation.mutate(taskId)}
                        onToggleChecklist={(itemId, done) => toggleChecklistItemMutation.mutate({ itemId, done })}
                        getStateColor={getStateColor}
                        getStateLabel={getStateLabel}
                        getPriorityColor={getPriorityColor}
                        calculateProgress={calculateProgress}
                      />
                    ))}
                    {getStoriesForEpic(epic.id).length === 0 && (
                      <p className="text-sm text-muted-foreground py-2 text-center">
                        Aucune User Story dans cet Epic
                      </p>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}

          {storiesWithoutEpic.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Sans Epic
                  <Badge variant="outline" className="text-xs ml-2">
                    {storiesWithoutEpic.length} US
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {storiesWithoutEpic.map(story => (
                  <UserStoryRow 
                    key={story.id}
                    story={story}
                    expanded={expandedStories.has(story.id)}
                    onToggle={() => toggleStory(story.id)}
                    onEdit={() => {
                      setEditingUserStory(story);
                      setShowUserStoryDialog(true);
                    }}
                    onDelete={() => deleteUserStoryMutation.mutate(story.id)}
                    onAddTask={() => {
                      setParentUserStoryId(story.id);
                      setShowTaskDialog(true);
                    }}
                    onUpdateTask={(taskId, data) => updateTaskMutation.mutate({ taskId, data })}
                    onDeleteTask={(taskId) => deleteTaskMutation.mutate(taskId)}
                    onToggleChecklist={(itemId, done) => toggleChecklistItemMutation.mutate({ itemId, done })}
                    getStateColor={getStateColor}
                    getStateLabel={getStateLabel}
                    getPriorityColor={getPriorityColor}
                    calculateProgress={calculateProgress}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {backlog.epics.length === 0 && storiesWithoutEpic.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  Votre backlog est vide. Commencez par créer un Epic ou une User Story.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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

      <SprintDialog 
        open={showSprintDialog}
        onClose={() => setShowSprintDialog(false)}
        onCreate={(data) => createSprintMutation.mutate(data)}
        isPending={createSprintMutation.isPending}
      />
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
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" data-testid={`button-toggle-story-${story.id}`}>
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate" data-testid={`text-story-title-${story.id}`}>{story.title}</span>
              {story.complexity && (
                <Badge variant="outline" className="text-xs">{story.complexity}</Badge>
              )}
              {story.estimatePoints && (
                <Badge variant="secondary" className="text-xs">{story.estimatePoints} pts</Badge>
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
              {story.priority && (
                <div 
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: getPriorityColor(story.priority) }}
                  title={story.priority}
                />
              )}
              {story.tasks.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {story.tasks.filter(t => t.state === "termine").length}/{story.tasks.length} tâches
                </span>
              )}
            </div>
          </div>
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
        {story.tasks.length > 0 && (
          <div className="mt-2">
            <Progress value={progress} className="h-1" />
          </div>
        )}
        <CollapsibleContent>
          <div className="mt-3 space-y-2 border-t pt-3">
            {story.description && (
              <p className="text-sm text-muted-foreground">{story.description}</p>
            )}
            {story.checklistItems.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Critères d'acceptation</p>
                {story.checklistItems.map(item => (
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
            {story.tasks.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Tâches</p>
                {story.tasks.map(task => (
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{epic ? "Modifier l'Epic" : "Nouvel Epic"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de l'epic" data-testid="input-epic-title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-epic-description" />
          </div>
          <div className="space-y-2">
            <Label>Priorité</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger data-testid="select-epic-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                {backlogPriorityOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex gap-2">
              {colors.map((c, i) => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  data-testid={`button-epic-color-${i}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-epic">Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim()} data-testid="button-submit-epic">
            {isPending ? "..." : epic ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{userStory ? "Modifier la User Story" : "Nouvelle User Story"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="En tant que..." data-testid="input-userstory-title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-userstory-description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Epic</Label>
              <Select value={epicId || "none"} onValueChange={(v) => setEpicId(v === "none" ? null : v)}>
                <SelectTrigger data-testid="select-userstory-epic"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {epics.map(epic => (
                    <SelectItem key={epic.id} value={epic.id}>{epic.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-userstory-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {backlogPriorityOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Complexité</Label>
              <Select value={complexity || "none"} onValueChange={(v) => setComplexity(v === "none" ? null : v)}>
                <SelectTrigger data-testid="select-userstory-complexity"><SelectValue placeholder="--" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">--</SelectItem>
                  {complexityOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Story Points</Label>
              <Input 
                type="number" 
                value={estimatePoints ?? ""} 
                onChange={(e) => setEstimatePoints(e.target.value ? parseInt(e.target.value) : null)} 
                min={0}
                data-testid="input-userstory-points"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-userstory">Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim()} data-testid="button-submit-userstory">
            {isPending ? "..." : userStory ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function SprintDialog({ 
  open, 
  onClose, 
  onCreate, 
  isPending 
}: { 
  open: boolean; 
  onClose: () => void; 
  onCreate: (data: { name: string; goal?: string; startDate?: string; endDate?: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate({ 
      name, 
      goal: goal || undefined, 
      startDate: startDate || undefined, 
      endDate: endDate || undefined 
    });
    setName("");
    setGoal("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau Sprint</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nom *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 1" data-testid="input-sprint-name" />
          </div>
          <div className="space-y-2">
            <Label>Objectif</Label>
            <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} placeholder="Objectif du sprint..." data-testid="input-sprint-goal" />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-sprint">Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()} data-testid="button-submit-sprint">
            {isPending ? "..." : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
