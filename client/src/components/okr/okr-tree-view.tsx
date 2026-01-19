import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, ChevronDown, ChevronRight, Target, Key, TrendingUp, Package, Megaphone,
  AlertTriangle, CheckCircle, Clock, BarChart, DollarSign, Users, Trash2, Edit, Link2, ListPlus,
  List, GitBranch, Wand2
} from "lucide-react";
import type { OkrObjective, OkrKeyResult, OkrLink, Task, Epic, Sprint, RoadmapItem, AppUser, Project, TaskColumn, Backlog } from "@shared/schema";
import { okrObjectiveTypeOptions, okrTargetPhaseOptions, okrStatusOptions, okrMetricTypeOptions } from "@shared/schema";
import { TaskDetailModal } from "@/components/TaskDetailModal";

interface EnrichedOkrLink extends OkrLink {
  entity?: Task | Epic | Sprint | RoadmapItem | null;
}

interface OkrObjectiveWithKRs extends OkrObjective {
  keyResults: (OkrKeyResult & { links: EnrichedOkrLink[] })[];
}

interface OkrTreeViewProps {
  projectId: string;
}

type ViewMode = "list" | "tree";

const OKR_VIEW_MODE_KEY = "planbase_okr_view_mode";

function getStoredViewMode(): ViewMode {
  if (typeof window === 'undefined') return "list";
  try {
    const saved = localStorage.getItem(OKR_VIEW_MODE_KEY);
    return (saved === "list" || saved === "tree") ? saved : "list";
  } catch {
    return "list";
  }
}

export function OkrTreeView({ projectId }: OkrTreeViewProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode);
  
  useEffect(() => {
    try {
      localStorage.setItem(OKR_VIEW_MODE_KEY, viewMode);
    } catch {
      // Ignore storage errors
    }
  }, [viewMode]);
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [expandedKRs, setExpandedKRs] = useState<Set<string>>(new Set());
  const [showObjectiveSheet, setShowObjectiveSheet] = useState(false);
  const [showKRSheet, setShowKRSheet] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showDeleteObjectiveDialog, setShowDeleteObjectiveDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [objectiveToDelete, setObjectiveToDelete] = useState<string | null>(null);
  const [editingObjective, setEditingObjective] = useState<OkrObjective | null>(null);
  const [editingKR, setEditingKR] = useState<OkrKeyResult | null>(null);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [selectedKRId, setSelectedKRId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [linkEntityType, setLinkEntityType] = useState<"task" | "epic" | "sprint" | "roadmap_item">("task");
  const [linkEntityId, setLinkEntityId] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);

  const { data: okrTree = [], isLoading } = useQuery<OkrObjectiveWithKRs[]>({
    queryKey: ["/api/projects", projectId, "okr"],
  });

  // Queries for linking entities
  const { data: projectEpics = [] } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "epics"],
  });

  const { data: projectSprints = [] } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "sprints"],
  });

  // First get roadmaps for this project
  const { data: projectRoadmaps = [] } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/roadmaps`],
  });

  // Then get items from the first roadmap (if any)
  const firstRoadmapId = projectRoadmaps[0]?.id;
  const { data: projectRoadmapItems = [] } = useQuery<any[]>({
    queryKey: [`/api/roadmaps/${firstRoadmapId}/items`],
    enabled: !!firstRoadmapId,
  });

  // Get tasks for this project (from /tasks page - generic tasks, project-scoped)
  const { data: projectTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
  });

  // Queries for TaskDetailModal
  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: taskColumns = [] } = useQuery<TaskColumn[]>({
    queryKey: ["/api/task-columns"],
  });

  const { data: backlogs = [] } = useQuery<Backlog[]>({
    queryKey: ["/api/backlogs"],
  });

  const createObjectiveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest(`/api/projects/${projectId}/okr/objectives`, "POST", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "okr"] });
      toast({ title: "Objectif créé", variant: "success" });
      setShowObjectiveSheet(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateObjectiveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest(`/api/okr/objectives/${id}`, "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "okr"] });
      toast({ title: "Objectif mis à jour", variant: "success" });
      setShowObjectiveSheet(false);
      setEditingObjective(null);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteObjectiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/okr/objectives/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "okr"] });
      toast({ title: "Objectif supprimé", variant: "success" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const createKRMutation = useMutation({
    mutationFn: async ({ objectiveId, data }: { objectiveId: string; data: any }) => {
      const res = await apiRequest(`/api/okr/objectives/${objectiveId}/key-results`, "POST", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "okr"] });
      toast({ title: "Key Result créé", variant: "success" });
      setShowKRSheet(false);
      setSelectedObjectiveId(null);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateKRMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest(`/api/okr/key-results/${id}`, "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "okr"] });
      toast({ title: "Key Result mis à jour", variant: "success" });
      setShowKRSheet(false);
      setEditingKR(null);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteKRMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/okr/key-results/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "okr"] });
      toast({ title: "Key Result supprimé", variant: "success" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const createTaskFromKRMutation = useMutation({
    mutationFn: async ({ keyResultId, title }: { keyResultId: string; title: string }) => {
      const res = await apiRequest(`/api/okr/key-results/${keyResultId}/create-task`, "POST", { title });
      return res.json();
    },
    onSuccess: (data: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "okr"] });
      // Invalidate /api/tasks and project-scoped tasks so the new task appears in /tasks page
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
      toast({ title: "Tâche créée et liée au Key Result", variant: "success" });
      setShowCreateTaskDialog(false);
      setSelectedKRId(null);
      setNewTaskTitle("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: async ({ keyResultId, entityType, entityId }: { keyResultId: string; entityType: string; entityId: string }) => {
      const res = await apiRequest(`/api/okr/key-results/${keyResultId}/links`, "POST", { entityType, entityId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "okr"] });
      toast({ title: "Lien créé", variant: "success" });
      setShowLinkDialog(false);
      setSelectedKRId(null);
      setLinkEntityId("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await apiRequest(`/api/okr/links/${linkId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "okr"] });
      toast({ title: "Lien supprimé", variant: "success" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const regenerateOkrMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/projects/${projectId}/okr/regenerate`, "POST");
      return res.json();
    },
    onSuccess: (data: { objectivesCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "okr"] });
      toast({ 
        title: "OKR régénérés", 
        description: `${data.objectivesCount} objectif${data.objectivesCount > 1 ? 's' : ''} créé${data.objectivesCount > 1 ? 's' : ''}`, 
        variant: "success" 
      });
      setShowRegenerateDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setShowRegenerateDialog(false);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task> & { id: string }) => {
      const res = await apiRequest(`/api/tasks/${data.id}`, "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "okr"] });
      toast({ title: "Tâche mise à jour", variant: "success" });
      setIsTaskDetailOpen(false);
      setSelectedTask(null);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleTaskClick = (link: EnrichedOkrLink) => {
    if (link.entityType === "task" && link.entity) {
      setSelectedTask(link.entity as Task);
      setIsTaskDetailOpen(true);
    }
  };

  const handleSaveTaskDetail = (taskData: Partial<Task>) => {
    if (selectedTask) {
      updateTaskMutation.mutate({ id: selectedTask.id, ...taskData });
    }
  };

  const toggleObjective = (id: string) => {
    const newSet = new Set(expandedObjectives);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedObjectives(newSet);
  };

  const toggleKR = (id: string) => {
    const newSet = new Set(expandedKRs);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedKRs(newSet);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on_track": return "bg-green-500";
      case "at_risk": return "bg-amber-500";
      case "critical": return "bg-red-500";
      case "achieved": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    const option = okrStatusOptions.find(o => o.value === status);
    return option?.label || status;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "business": return <TrendingUp className="h-4 w-4" />;
      case "product": return <Package className="h-4 w-4" />;
      case "marketing": return <Megaphone className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getMetricIcon = (type: string) => {
    switch (type) {
      case "delivery": return <Package className="h-4 w-4" />;
      case "time": return <Clock className="h-4 w-4" />;
      case "margin": return <DollarSign className="h-4 w-4" />;
      case "adoption": return <Users className="h-4 w-4" />;
      case "volume": return <BarChart className="h-4 w-4" />;
      default: return <Key className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-end gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRegenerateDialog(true)}
              disabled={regenerateOkrMutation.isPending}
              data-testid="button-regenerate-okr"
            >
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              Générer
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-white text-foreground border">
            Régénérer les OKR depuis le type de projet
          </TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={viewMode === "list" ? "default" : "ghost"}
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-white text-foreground border">Vue liste</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={viewMode === "tree" ? "default" : "ghost"}
                onClick={() => setViewMode("tree")}
                data-testid="button-view-tree"
              >
                <GitBranch className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-white text-foreground border">Vue hiérarchique</TooltipContent>
          </Tooltip>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingObjective(null);
            setShowObjectiveSheet(true);
          }}
          data-testid="button-add-objective"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Nouvel objectif
        </Button>
      </div>

      {okrTree.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Target className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-sm font-medium mb-1">Aucun objectif défini</h3>
            <p className="text-xs text-muted-foreground text-center max-w-md mb-3">
              Les OKR vous permettent de définir des objectifs stratégiques et de mesurer leur progression via des résultats clés mesurables.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setEditingObjective(null);
                setShowObjectiveSheet(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Créer mon premier objectif
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <div className="space-y-3">
          {okrTree.map((objective) => (
            <Card key={objective.id} className="overflow-hidden" data-testid={`card-objective-${objective.id}`}>
              <Collapsible
                open={expandedObjectives.has(objective.id)}
                onOpenChange={() => toggleObjective(objective.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover-elevate py-3">
                    <div className="flex items-center gap-2">
                      {expandedObjectives.has(objective.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className={`p-1.5 rounded-lg ${getStatusColor(objective.status)} bg-opacity-20`}>
                        {getTypeIcon(objective.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm truncate">{objective.title}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {okrObjectiveTypeOptions.find(o => o.value === objective.type)?.label || objective.type}
                          </Badge>
                          {objective.targetPhase && (
                            <Badge variant="secondary" className="text-xs">
                              {objective.targetPhase}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <Progress value={objective.progress || 0} className="h-2 w-32" />
                          <span className="text-xs text-muted-foreground">{objective.progress || 0}%</span>
                          <Badge className={`${getStatusColor(objective.status)} text-white text-xs`}>
                            {getStatusLabel(objective.status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingObjective(objective);
                                setShowObjectiveSheet(true);
                              }}
                              data-testid={`button-edit-objective-${objective.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white text-foreground border">Modifier</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedObjectiveId(objective.id);
                                setEditingKR(null);
                                setShowKRSheet(true);
                              }}
                              data-testid={`button-add-kr-${objective.id}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white text-foreground border">Ajouter un Key Result</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Supprimer cet objectif et ses Key Results ?")) {
                                  deleteObjectiveMutation.mutate(objective.id);
                                }
                              }}
                              data-testid={`button-delete-objective-${objective.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white text-foreground border">Supprimer</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4">
                    {objective.description && (
                      <p className="text-sm text-muted-foreground mb-4 ml-8">{objective.description}</p>
                    )}
                    {objective.keyResults.length === 0 ? (
                      <div className="ml-8 p-4 border border-dashed rounded-lg text-center">
                        <p className="text-sm text-muted-foreground mb-2">Aucun Key Result défini</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedObjectiveId(objective.id);
                            setEditingKR(null);
                            setShowKRSheet(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Ajouter un Key Result
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 ml-8">
                        {objective.keyResults.map((kr) => (
                          <div key={kr.id} className="space-y-1">
                            <div
                              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover-elevate"
                              data-testid={`kr-item-${kr.id}`}
                            >
                              <div className="p-1 rounded bg-primary/10">
                                {getMetricIcon(kr.metricType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-xs truncate">{kr.title}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {okrMetricTypeOptions.find(o => o.value === kr.metricType)?.label || kr.metricType}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <Progress
                                    value={kr.targetValue > 0 ? ((kr.currentValue || 0) / kr.targetValue) * 100 : 0}
                                    className="h-1.5 w-24"
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {kr.currentValue || 0} / {kr.targetValue} {kr.unit || ""}
                                  </span>
                                  {kr.links.length > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Link2 className="h-3 w-3 mr-1" />
                                      {kr.links.length} lien(s)
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setSelectedKRId(kr.id);
                                        setNewTaskTitle(`Tâche pour: ${kr.title}`);
                                        setShowCreateTaskDialog(true);
                                      }}
                                      data-testid={`button-create-task-${kr.id}`}
                                    >
                                      <ListPlus className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-white text-foreground border">Créer une tâche</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setSelectedKRId(kr.id);
                                        setShowLinkDialog(true);
                                      }}
                                      data-testid={`button-link-kr-${kr.id}`}
                                    >
                                      <Link2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-white text-foreground border">Lier à Epic/Sprint/Roadmap</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setSelectedObjectiveId(objective.id);
                                        setEditingKR(kr);
                                        setShowKRSheet(true);
                                      }}
                                      data-testid={`button-edit-kr-${kr.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-white text-foreground border">Modifier</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        if (confirm("Supprimer ce Key Result ?")) {
                                          deleteKRMutation.mutate(kr.id);
                                        }
                                      }}
                                      data-testid={`button-delete-kr-${kr.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-white text-foreground border">Supprimer</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                            {kr.links.length > 0 && (
                              <div className="ml-8 space-y-1">
                                {kr.links.map((link) => {
                                  const entityTitle = link.entity 
                                    ? ('title' in link.entity ? link.entity.title : 
                                       'name' in link.entity ? link.entity.name : 'Élément lié')
                                    : (link.entityId ? `${link.entityType} (${link.entityId.slice(0, 8)}...)` : 'Élément inconnu');
                                  const entityState = link.entity 
                                    ? ('state' in link.entity ? link.entity.state : 
                                       'status' in link.entity ? link.entity.status : null)
                                    : null;
                                  const typeLabels: Record<string, string> = {
                                    task: 'Tâche',
                                    epic: 'Epic',
                                    sprint: 'Sprint',
                                    roadmap_item: 'Roadmap'
                                  };
                                  return (
                                    <div
                                      key={link.id}
                                      className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 border rounded text-xs cursor-pointer hover-elevate"
                                      data-testid={`linked-entity-${link.id}`}
                                      onClick={() => handleTaskClick(link)}
                                    >
                                      <Badge variant="secondary" className="text-[10px]">
                                        {typeLabels[link.entityType] || link.entityType}
                                      </Badge>
                                      <span className="flex-1 truncate">{entityTitle}</span>
                                      {entityState && (
                                        <Badge variant="outline" className="text-[10px]">
                                          {entityState}
                                        </Badge>
                                      )}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={(e) => { e.stopPropagation(); deleteLinkMutation.mutate(link.id); }}
                                            data-testid={`button-unlink-${link.id}`}
                                          >
                                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-white text-foreground border">Supprimer le lien</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto pb-4" data-testid="okr-tree-view">
          <div className="flex flex-col items-center min-w-max">
            {okrTree.map((objective, objIndex) => (
              <div key={objective.id} className="flex flex-col items-center">
                <Card 
                  className="min-w-[200px] max-w-[280px] text-center cursor-pointer hover-elevate active-elevate-2 overflow-visible focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  style={{ backgroundColor: '#7C3AED' }}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setEditingObjective(objective);
                    setShowObjectiveSheet(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setEditingObjective(objective);
                      setShowObjectiveSheet(true);
                    }
                  }}
                  data-testid={`tree-objective-${objective.id}`}
                >
                  <CardContent className="px-6 py-4">
                    <div className="flex justify-center mb-2">
                      <Badge className="bg-white/20 text-white text-[10px] px-1.5 py-0.5">Obj.</Badge>
                    </div>
                    <div className="font-semibold text-sm mb-1 text-white">{objective.title}</div>
                    <div className="text-xs text-white/90 mb-2">
                      {okrObjectiveTypeOptions.find(o => o.value === objective.type)?.label || objective.type}
                      {objective.targetPhase && ` - ${objective.targetPhase}`}
                    </div>
                    <div className="bg-white/20 rounded-full h-1.5 mb-1">
                      <div 
                        className="bg-white rounded-full h-1.5 transition-all"
                        style={{ width: `${objective.progress || 0}%` }}
                      />
                    </div>
                    <div className="text-xs text-white/75">{objective.progress || 0}%</div>
                  </CardContent>
                </Card>

                {objective.keyResults.length > 0 && (
                  <>
                    <div className="w-0.5 h-6 bg-border" />
                    <div className="flex items-start relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 bg-border" 
                           style={{ 
                             width: objective.keyResults.length > 1 
                               ? `calc(${(objective.keyResults.length - 1) * 180}px + 50%)` 
                               : '0px',
                             left: objective.keyResults.length > 1 ? '0' : '50%',
                             transform: objective.keyResults.length > 1 ? 'none' : 'translateX(-50%)'
                           }} 
                      />
                      <div className="flex gap-4">
                        {objective.keyResults.map((kr) => (
                          <div key={kr.id} className="flex flex-col items-center">
                            <div className="w-0.5 h-4 bg-border" />
                            <Card 
                              className="min-w-[160px] max-w-[200px] text-center cursor-pointer hover-elevate active-elevate-2 overflow-visible focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-violet-200"
                              style={{ backgroundColor: '#EFE8FC' }}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setEditingKR(kr);
                                setSelectedObjectiveId(objective.id);
                                setShowKRSheet(true);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setEditingKR(kr);
                                  setSelectedObjectiveId(objective.id);
                                  setShowKRSheet(true);
                                }
                              }}
                              data-testid={`tree-kr-${kr.id}`}
                            >
                              <CardContent className="px-4 py-3">
                                <div className="flex justify-center mb-2">
                                  <Badge className="text-[10px] px-1.5 py-0.5" style={{ backgroundColor: '#7C3AED', color: 'white' }}>KR</Badge>
                                </div>
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                  {getMetricIcon(kr.metricType)}
                                  <span className="font-medium text-xs text-violet-900">{kr.title}</span>
                                </div>
                                <div className="text-xs text-violet-700">
                                  {kr.currentValue || 0} / {kr.targetValue} {kr.unit || ''}
                                </div>
                                <div className="rounded-full h-1 mt-2" style={{ backgroundColor: 'rgba(124, 58, 237, 0.2)' }}>
                                  <div 
                                    className="rounded-full h-1 transition-all"
                                    style={{ width: `${Math.min((kr.currentValue || 0) / kr.targetValue * 100, 100)}%`, backgroundColor: '#7C3AED' }}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                            {kr.links.length > 0 && (
                              <div className="flex flex-col items-center mt-2">
                                <div className="w-0.5 h-3 bg-border" />
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {kr.links.map((link) => {
                                    const entityTitle = link.entity 
                                      ? ('title' in link.entity ? link.entity.title : 
                                         'name' in link.entity ? link.entity.name : 'Élément lié')
                                      : (link.entityId ? `${link.entityType} (${link.entityId.slice(0, 8)}...)` : 'Élément inconnu');
                                    const typeLabels: Record<string, string> = {
                                      task: 'Tâche',
                                      epic: 'Epic',
                                      sprint: 'Sprint',
                                      roadmap_item: 'Roadmap'
                                    };
                                    return (
                                      <div
                                        key={link.id}
                                        className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-gray-900 border rounded text-[11px] min-w-[140px] max-w-[180px] cursor-pointer hover-elevate"
                                        data-testid={`tree-linked-entity-${link.id}`}
                                        onClick={() => handleTaskClick(link)}
                                      >
                                        <Badge variant="secondary" className="text-[9px] px-1 py-0">
                                          {typeLabels[link.entityType] || link.entityType}
                                        </Badge>
                                        <span className="flex-1 truncate">{entityTitle}</span>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteLinkMutation.mutate(link.id);
                                          }}
                                          data-testid={`button-tree-unlink-${link.id}`}
                                        >
                                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {objIndex < okrTree.length - 1 && (
                  <div className="w-0.5 h-8 bg-border my-4" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ObjectiveSheet
        open={showObjectiveSheet}
        onOpenChange={setShowObjectiveSheet}
        objective={editingObjective}
        onSave={(data) => {
          if (editingObjective) {
            updateObjectiveMutation.mutate({ id: editingObjective.id, data });
          } else {
            createObjectiveMutation.mutate(data);
          }
        }}
        onDelete={editingObjective ? () => {
          setObjectiveToDelete(editingObjective.id);
          setShowDeleteObjectiveDialog(true);
        } : undefined}
        onAddKR={editingObjective ? () => {
          setSelectedObjectiveId(editingObjective.id);
          setEditingKR(null);
          setShowObjectiveSheet(false);
          setShowKRSheet(true);
        } : undefined}
        isPending={createObjectiveMutation.isPending || updateObjectiveMutation.isPending}
        isDeleting={deleteObjectiveMutation.isPending}
      />

      {/* AlertDialog pour confirmation de suppression d'objectif */}
      <AlertDialog open={showDeleteObjectiveDialog} onOpenChange={setShowDeleteObjectiveDialog}>
        <AlertDialogContent data-testid="dialog-delete-objective-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'objectif</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet objectif ? Cette action est irréversible et supprimera également tous les résultats clés et liens associés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-objective">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (objectiveToDelete) {
                  deleteObjectiveMutation.mutate(objectiveToDelete);
                  setShowDeleteObjectiveDialog(false);
                  setShowObjectiveSheet(false);
                  setObjectiveToDelete(null);
                }
              }}
              disabled={deleteObjectiveMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-objective"
            >
              {deleteObjectiveMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent data-testid="dialog-regenerate-okr-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Régénérer les OKR</AlertDialogTitle>
            <AlertDialogDescription>
              Vous vous apprêtez à réinitialiser les OKR selon les informations du projet. Les OKR existants seront supprimés et remplacés par de nouveaux OKR basés sur le type de projet. Êtes-vous sûr ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-regenerate-okr">Non</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => regenerateOkrMutation.mutate()}
              disabled={regenerateOkrMutation.isPending}
              data-testid="button-confirm-regenerate-okr"
            >
              {regenerateOkrMutation.isPending ? "Génération..." : "Oui, régénérer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <KeyResultSheet
        open={showKRSheet}
        onOpenChange={setShowKRSheet}
        keyResult={editingKR}
        objectiveId={selectedObjectiveId}
        onSave={(data) => {
          if (editingKR) {
            updateKRMutation.mutate({ id: editingKR.id, data });
          } else if (selectedObjectiveId) {
            createKRMutation.mutate({ objectiveId: selectedObjectiveId, data });
          }
        }}
        isPending={createKRMutation.isPending || updateKRMutation.isPending}
        onLink={(krId) => {
          setSelectedKRId(krId);
          setShowKRSheet(false);
          setShowLinkDialog(true);
        }}
        onCreateTask={(krId, krTitle) => {
          setSelectedKRId(krId);
          setNewTaskTitle(`Tâche pour: ${krTitle}`);
          setShowKRSheet(false);
          setShowCreateTaskDialog(true);
        }}
      />

      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent className="bg-white dark:bg-background" aria-describedby="create-task-description">
          <DialogHeader>
            <DialogTitle>Créer une tâche depuis ce Key Result</DialogTitle>
            <p id="create-task-description" className="text-sm text-muted-foreground">
              La tâche sera ajoutée au backlog du projet et liée à ce Key Result.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Titre de la tâche</Label>
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Titre de la nouvelle tâche"
                data-testid="input-task-title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTaskDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (selectedKRId && newTaskTitle.trim()) {
                  createTaskFromKRMutation.mutate({ keyResultId: selectedKRId, title: newTaskTitle });
                }
              }}
              disabled={!newTaskTitle.trim() || createTaskFromKRMutation.isPending}
              data-testid="button-confirm-create-task"
            >
              Créer la tâche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pour lier un KR à un Epic/Sprint/Roadmap */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="bg-white dark:bg-background" aria-describedby="link-dialog-description">
          <DialogHeader>
            <DialogTitle>Lier ce Key Result</DialogTitle>
            <p id="link-dialog-description" className="text-sm text-muted-foreground">
              Créez un lien vers une Tâche, Epic, Sprint ou une étape de roadmap existante.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Type d'élément</Label>
              <Select value={linkEntityType} onValueChange={(v: "task" | "epic" | "sprint" | "roadmap_item") => { setLinkEntityType(v); setLinkEntityId(""); }}>
                <SelectTrigger data-testid="select-link-entity-type">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Tâche</SelectItem>
                  <SelectItem value="epic">Epic</SelectItem>
                  <SelectItem value="sprint">Sprint</SelectItem>
                  <SelectItem value="roadmap_item">Étape Roadmap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Élément à lier</Label>
              <Select value={linkEntityId} onValueChange={setLinkEntityId}>
                <SelectTrigger data-testid="select-link-entity">
                  <SelectValue placeholder="Sélectionner un élément" />
                </SelectTrigger>
                <SelectContent>
                  {linkEntityType === "task" && projectTasks.map((task: any) => (
                    <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                  ))}
                  {linkEntityType === "epic" && projectEpics.map((epic: any) => (
                    <SelectItem key={epic.id} value={epic.id}>{epic.name || epic.title}</SelectItem>
                  ))}
                  {linkEntityType === "sprint" && projectSprints.map((sprint: any) => (
                    <SelectItem key={sprint.id} value={sprint.id}>{sprint.name}</SelectItem>
                  ))}
                  {linkEntityType === "roadmap_item" && projectRoadmapItems.map((item: any) => (
                    <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (selectedKRId && linkEntityId) {
                  createLinkMutation.mutate({ keyResultId: selectedKRId, entityType: linkEntityType, entityId: linkEntityId });
                }
              }}
              disabled={!linkEntityId || createLinkMutation.isPending}
              data-testid="button-confirm-create-link"
            >
              Créer le lien
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Modal */}
      {selectedTask && (() => {
        const taskProjectColumns = selectedTask.projectId
          ? taskColumns.filter((c) => c.projectId === selectedTask.projectId)
          : taskColumns.filter((c) => !c.projectId);
        const sortedTaskColumns = [...taskProjectColumns].sort((a, b) => a.order - b.order);
        return (
          <TaskDetailModal
            task={selectedTask}
            users={users}
            projects={projects}
            columns={sortedTaskColumns}
            backlogs={backlogs}
            isOpen={isTaskDetailOpen}
            onClose={() => {
              setIsTaskDetailOpen(false);
              setSelectedTask(null);
            }}
            onSave={handleSaveTaskDetail}
          />
        );
      })()}
    </div>
  );
}

function ObjectiveSheet({
  open,
  onOpenChange,
  objective,
  onSave,
  onDelete,
  onAddKR,
  isPending,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objective: OkrObjective | null;
  onSave: (data: any) => void;
  onDelete?: () => void;
  onAddKR?: () => void;
  isPending: boolean;
  isDeleting?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("business");
  const [targetPhase, setTargetPhase] = useState<string | null>(null);

  useEffect(() => {
    if (objective) {
      setTitle(objective.title);
      setDescription(objective.description || "");
      setType(objective.type);
      setTargetPhase(objective.targetPhase || null);
    } else {
      setTitle("");
      setDescription("");
      setType("business");
      setTargetPhase(null);
    }
  }, [objective]);

  const handleSave = () => {
    onSave({
      title,
      description: description || null,
      type,
      targetPhase: targetPhase || null,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-white dark:bg-background">
        <SheetHeader>
          <SheetTitle>{objective ? "Modifier l'objectif" : "Nouvel objectif"}</SheetTitle>
          <SheetDescription>
            Définissez un objectif stratégique pour ce projet
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-6">
          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Augmenter la rentabilité du MVP"
              data-testid="input-objective-title"
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-objective-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {okrObjectiveTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Phase cible</Label>
            <Select value={targetPhase || "none"} onValueChange={(v) => setTargetPhase(v === "none" ? null : v)}>
              <SelectTrigger data-testid="select-objective-phase">
                <SelectValue placeholder="Aucune phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune phase</SelectItem>
                {okrTargetPhaseOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description (optionnelle)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez l'objectif..."
              rows={3}
              data-testid="input-objective-description"
            />
          </div>
          {objective && (onAddKR || onDelete) && (
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              {onAddKR && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddKR}
                  data-testid="button-add-kr-from-objective-sheet"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Ajouter un KR
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={onDelete}
                  disabled={isDeleting}
                  data-testid="button-delete-objective-sheet"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Supprimer
                </Button>
              )}
            </div>
          )}
        </div>
        <SheetFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || isPending}
            data-testid="button-save-objective"
          >
            {objective ? "Mettre à jour" : "Créer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function KeyResultSheet({
  open,
  onOpenChange,
  keyResult,
  objectiveId,
  onSave,
  isPending,
  onLink,
  onCreateTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResult: OkrKeyResult | null;
  onLink?: (krId: string) => void;
  onCreateTask?: (krId: string, krTitle: string) => void;
  objectiveId: string | null;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [metricType, setMetricType] = useState<string>("delivery");
  const [targetValue, setTargetValue] = useState<number>(100);
  const [currentValue, setCurrentValue] = useState<number>(0);
  const [unit, setUnit] = useState<string>("%");

  useEffect(() => {
    if (keyResult) {
      setTitle(keyResult.title);
      setMetricType(keyResult.metricType);
      setTargetValue(keyResult.targetValue);
      setCurrentValue(keyResult.currentValue || 0);
      setUnit(keyResult.unit || "%");
    } else {
      setTitle("");
      setMetricType("delivery");
      setTargetValue(100);
      setCurrentValue(0);
      setUnit("%");
    }
  }, [keyResult]);

  const handleSave = () => {
    onSave({
      title,
      metricType,
      targetValue,
      currentValue,
      unit: unit || null,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-white dark:bg-background">
        <SheetHeader>
          <SheetTitle>{keyResult ? "Modifier le Key Result" : "Nouveau Key Result"}</SheetTitle>
          <SheetDescription>
            Définissez un résultat clé mesurable
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-6">
          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Livrer 5 features du MVP"
              data-testid="input-kr-title"
            />
          </div>
          <div className="space-y-2">
            <Label>Type de mesure</Label>
            <Select value={metricType} onValueChange={setMetricType}>
              <SelectTrigger data-testid="select-kr-metric-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {okrMetricTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valeur cible *</Label>
              <Input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
                data-testid="input-kr-target"
              />
            </div>
            <div className="space-y-2">
              <Label>Valeur actuelle</Label>
              <Input
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(Number(e.target.value))}
                data-testid="input-kr-current"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Unité</Label>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Ex: %, features, jours, €"
              data-testid="input-kr-unit"
            />
          </div>
          {keyResult && (onLink || onCreateTask) && (
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
              {onLink && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLink(keyResult.id)}
                  data-testid="button-link-kr-sheet"
                >
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Lier
                </Button>
              )}
              {onCreateTask && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreateTask(keyResult.id, keyResult.title)}
                  data-testid="button-create-task-kr-sheet"
                >
                  <ListPlus className="h-4 w-4 mr-1.5" />
                  Créer tâche
                </Button>
              )}
            </div>
          )}
        </div>
        <SheetFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || targetValue <= 0 || isPending}
            data-testid="button-save-kr"
          >
            {keyResult ? "Mettre à jour" : "Créer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
