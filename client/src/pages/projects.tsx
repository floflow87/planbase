import { useState, useEffect } from "react";
import { Plus, Filter, LayoutGrid, List, Table2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  Task,
  TaskColumn,
  AppUser,
  Project,
  InsertTask,
  InsertTaskColumn,
} from "@shared/schema";
import { TaskCardMenu } from "@/components/TaskCardMenu";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { ColumnHeaderMenu } from "@/components/ColumnHeaderMenu";
import { ColorPicker } from "@/components/ColorPicker";

interface SortableTaskCardProps {
  task: Task;
  users: AppUser[];
  onDuplicate: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAssign: (task: Task, userId: string) => void;
  onMarkComplete: (task: Task) => void;
  onClick: (task: Task) => void;
}

function SortableTaskCard({
  task,
  users,
  onDuplicate,
  onEdit,
  onDelete,
  onAssign,
  onMarkComplete,
  onClick,
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
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

  const assignedUser = users.find((u) => u.id === task.assignedToId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`task-card-${task.id}`}
    >
      <Card
        className="hover-elevate active-elevate-2 cursor-pointer mb-2"
        onClick={() => onClick(task)}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium text-foreground flex-1">
              {task.title}
            </h4>
            <div onClick={(e) => e.stopPropagation()}>
              <TaskCardMenu
                task={task}
                users={users}
                onDuplicate={onDuplicate}
                onEdit={onEdit}
                onDelete={onDelete}
                onAssign={onAssign}
                onMarkComplete={onMarkComplete}
              />
            </div>
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
              {getPriorityLabel(task.priority)}
            </Badge>
            {assignedUser && (
              <Avatar className="h-5 w-5">
                <AvatarImage src={assignedUser.avatarUrl || ""} />
                <AvatarFallback className="text-xs">
                  {assignedUser.firstName?.[0]}
                  {assignedUser.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface SortableColumnProps {
  column: TaskColumn;
  tasks: Task[];
  users: AppUser[];
  onRename: (column: TaskColumn) => void;
  onChangeColor: (column: TaskColumn) => void;
  onDelete: (column: TaskColumn) => void;
  onAddTask: (columnId: string) => void;
  onDuplicate: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onAssign: (task: Task, userId: string) => void;
  onMarkComplete: (task: Task) => void;
  onTaskClick: (task: Task) => void;
}

function SortableColumn({
  column,
  tasks,
  users,
  onRename,
  onChangeColor,
  onDelete,
  onAddTask,
  onDuplicate,
  onEditTask,
  onDeleteTask,
  onAssign,
  onMarkComplete,
  onTaskClick,
}: SortableColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sortedTasks = [...tasks].sort(
    (a, b) => a.positionInColumn - b.positionInColumn
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className="flex flex-col h-full min-h-[500px]"
        style={{ backgroundColor: column.color }}
        data-testid={`column-${column.id}`}
      >
        <CardHeader className="pb-3" {...listeners}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-heading font-semibold">
              {column.name}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-xs">
                {tasks.length}
              </Badge>
              <ColumnHeaderMenu
                column={column}
                onRename={onRename}
                onChangeColor={onChangeColor}
                onDelete={onDelete}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-2 overflow-auto">
          <SortableContext
            items={sortedTasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedTasks.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Aucune tâche
              </div>
            ) : (
              sortedTasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  users={users}
                  onDuplicate={onDuplicate}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  onAssign={onAssign}
                  onMarkComplete={onMarkComplete}
                  onClick={onTaskClick}
                />
              ))
            )}
          </SortableContext>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => onAddTask(column.id)}
            data-testid={`button-add-task-${column.id}`}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une tâche
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Projects() {
  const [, setLocation] = useLocation();
  const accountId = localStorage.getItem("demo_account_id");
  const userId = localStorage.getItem("demo_user_id");
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<"kanban" | "list" | "table">("kanban");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [createTaskColumnId, setCreateTaskColumnId] = useState<string | null>(null);
  const [isCreateColumnDialogOpen, setIsCreateColumnDialogOpen] = useState(false);
  const [isRenameColumnDialogOpen, setIsRenameColumnDialogOpen] = useState(false);
  const [isColorColumnDialogOpen, setIsColorColumnDialogOpen] = useState(false);
  const [isDeleteColumnDialogOpen, setIsDeleteColumnDialogOpen] = useState(false);
  const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<TaskColumn | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [newColumnName, setNewColumnName] = useState("");
  const [renameColumnName, setRenameColumnName] = useState("");
  const [columnColor, setColumnColor] = useState("#e5e7eb");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (!accountId) {
      setLocation("/init");
    }
  }, [accountId, setLocation]);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/accounts", accountId, "users"],
    enabled: !!accountId,
  });

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const { data: taskColumns = [], isLoading: columnsLoading } = useQuery<TaskColumn[]>({
    queryKey: ["/api/projects", selectedProjectId, "task-columns"],
    enabled: !!selectedProjectId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/projects", selectedProjectId, "tasks"],
    enabled: !!selectedProjectId,
  });

  const sortedColumns = [...taskColumns].sort((a, b) => a.order - b.order);

  const createTaskMutation = useMutation({
    mutationFn: async (data: InsertTask) => {
      const response = await apiRequest("POST", "/api/tasks", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "tasks"] });
      setIsCreateTaskDialogOpen(false);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
      setCreateTaskColumnId(null);
      toast({ title: "Tâche créée avec succès" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors de la création",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "tasks"] });
      toast({ title: "Tâche mise à jour" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors de la mise à jour",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest("POST", `/api/tasks/${taskId}/duplicate`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "tasks"] });
      toast({ title: "Tâche dupliquée avec succès" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors de la duplication",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest("DELETE", `/api/tasks/${taskId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "tasks"] });
      setIsDeleteTaskDialogOpen(false);
      setSelectedTask(null);
      toast({ title: "Tâche supprimée" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors de la suppression",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkUpdatePositionsMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; columnId: string; positionInColumn: number }>) => {
      const response = await apiRequest("PATCH", "/api/tasks/bulk-update-positions", { updates });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "tasks"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors du déplacement",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createColumnMutation = useMutation({
    mutationFn: async (data: InsertTaskColumn) => {
      const response = await apiRequest("POST", "/api/task-columns", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "task-columns"] });
      setIsCreateColumnDialogOpen(false);
      setNewColumnName("");
      toast({ title: "Colonne créée avec succès" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors de la création",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskColumn> }) => {
      const response = await apiRequest("PATCH", `/api/task-columns/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "task-columns"] });
      setIsRenameColumnDialogOpen(false);
      setIsColorColumnDialogOpen(false);
      setSelectedColumn(null);
      toast({ title: "Colonne mise à jour" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors de la mise à jour",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      const response = await apiRequest("DELETE", `/api/task-columns/${columnId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "task-columns"] });
      setIsDeleteColumnDialogOpen(false);
      setSelectedColumn(null);
      toast({ title: "Colonne supprimée" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors de la suppression",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reorderColumnsMutation = useMutation({
    mutationFn: async (columnIds: string[]) => {
      const response = await apiRequest(
        "PATCH",
        `/api/projects/${selectedProjectId}/task-columns/reorder`,
        { columnIds }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "task-columns"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors du réordonnancement",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const draggedTask = tasks.find((t) => t.id === active.id);
    const draggedColumn = taskColumns.find((c) => c.id === active.id);

    if (draggedTask) {
      setActiveTaskId(active.id as string);
    } else if (draggedColumn) {
      setActiveColumnId(active.id as string);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);
    setActiveColumnId(null);

    if (!over) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    const draggedColumn = taskColumns.find((c) => c.id === active.id);

    if (draggedTask) {
      const overColumn = taskColumns.find((c) => c.id === over.id);
      const overTask = tasks.find((t) => t.id === over.id);
      
      let targetColumnId: string;
      let targetPosition: number;

      if (overColumn) {
        targetColumnId = overColumn.id;
        const tasksInColumn = tasks.filter((t) => t.columnId === targetColumnId);
        targetPosition = tasksInColumn.length;
      } else if (overTask) {
        targetColumnId = overTask.columnId!;
        targetPosition = overTask.positionInColumn;
      } else {
        return;
      }

      const tasksInTargetColumn = tasks
        .filter((t) => t.columnId === targetColumnId)
        .sort((a, b) => a.positionInColumn - b.positionInColumn);

      const updates: Array<{ id: string; columnId: string; positionInColumn: number }> = [];

      if (draggedTask.columnId === targetColumnId) {
        const oldIndex = tasksInTargetColumn.findIndex((t) => t.id === draggedTask.id);
        const newIndex = overTask
          ? tasksInTargetColumn.findIndex((t) => t.id === overTask.id)
          : tasksInTargetColumn.length;

        if (oldIndex !== newIndex) {
          tasksInTargetColumn.splice(oldIndex, 1);
          tasksInTargetColumn.splice(newIndex, 0, draggedTask);

          tasksInTargetColumn.forEach((task, index) => {
            updates.push({
              id: task.id,
              columnId: targetColumnId,
              positionInColumn: index,
            });
          });
        }
      } else {
        const tasksInSourceColumn = tasks
          .filter((t) => t.columnId === draggedTask.columnId && t.id !== draggedTask.id)
          .sort((a, b) => a.positionInColumn - b.positionInColumn);

        tasksInSourceColumn.forEach((task, index) => {
          updates.push({
            id: task.id,
            columnId: task.columnId!,
            positionInColumn: index,
          });
        });

        tasksInTargetColumn.splice(targetPosition, 0, draggedTask);

        tasksInTargetColumn.forEach((task, index) => {
          updates.push({
            id: task.id,
            columnId: targetColumnId,
            positionInColumn: index,
          });
        });
      }

      if (updates.length > 0) {
        bulkUpdatePositionsMutation.mutate(updates);
      }
    } else if (draggedColumn && active.id !== over.id) {
      const oldIndex = sortedColumns.findIndex((c) => c.id === active.id);
      const newIndex = sortedColumns.findIndex((c) => c.id === over.id);

      const reordered = [...sortedColumns];
      const [removed] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, removed);

      reorderColumnsMutation.mutate(reordered.map((c) => c.id));
    }
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim() || !createTaskColumnId || !accountId || !userId) return;

    const tasksInColumn = tasks.filter((t) => t.columnId === createTaskColumnId);
    const maxPosition = tasksInColumn.length > 0
      ? Math.max(...tasksInColumn.map((t) => t.positionInColumn))
      : -1;

    createTaskMutation.mutate({
      accountId,
      projectId: selectedProjectId,
      columnId: createTaskColumnId,
      title: newTaskTitle,
      description: newTaskDescription,
      priority: newTaskPriority,
      status: "todo",
      assignees: [],
      progress: 0,
      positionInColumn: maxPosition + 1,
      order: 0,
      createdBy: userId,
    });
  };

  const handleCreateColumn = () => {
    if (!newColumnName.trim() || !accountId) return;

    const maxOrder = taskColumns.length > 0
      ? Math.max(...taskColumns.map((c) => c.order))
      : -1;

    createColumnMutation.mutate({
      accountId,
      projectId: selectedProjectId,
      name: newColumnName,
      color: "#e5e7eb",
      order: maxOrder + 1,
      isLocked: 0,
    });
  };

  const handleAddTask = (columnId: string) => {
    setCreateTaskColumnId(columnId);
    setIsCreateTaskDialogOpen(true);
  };

  const handleDuplicateTask = (task: Task) => {
    duplicateTaskMutation.mutate(task.id);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setIsTaskDetailOpen(true);
  };

  const handleDeleteTask = (task: Task) => {
    setSelectedTask(task);
    setIsDeleteTaskDialogOpen(true);
  };

  const handleAssignTask = (task: Task, userId: string) => {
    updateTaskMutation.mutate({
      id: task.id,
      data: { assignedToId: userId },
    });
  };

  const handleMarkComplete = (task: Task) => {
    const doneColumn = taskColumns.find((c) => c.name.toLowerCase().includes("terminé"));
    if (doneColumn && task.columnId !== doneColumn.id) {
      const tasksInDoneColumn = tasks.filter((t) => t.columnId === doneColumn.id);
      const maxPosition = tasksInDoneColumn.length > 0
        ? Math.max(...tasksInDoneColumn.map((t) => t.positionInColumn))
        : -1;

      updateTaskMutation.mutate({
        id: task.id,
        data: {
          columnId: doneColumn.id,
          positionInColumn: maxPosition + 1,
          status: "done",
          progress: 100,
        },
      });
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskDetailOpen(true);
  };

  const handleSaveTaskDetail = (data: Partial<Task>) => {
    if (!selectedTask) return;
    updateTaskMutation.mutate({
      id: selectedTask.id,
      data,
    });
    setIsTaskDetailOpen(false);
    setSelectedTask(null);
  };

  const handleRenameColumn = (column: TaskColumn) => {
    setSelectedColumn(column);
    setRenameColumnName(column.name);
    setIsRenameColumnDialogOpen(true);
  };

  const handleChangeColor = (column: TaskColumn) => {
    setSelectedColumn(column);
    setColumnColor(column.color);
    setIsColorColumnDialogOpen(true);
  };

  const handleDeleteColumn = (column: TaskColumn) => {
    setSelectedColumn(column);
    setIsDeleteColumnDialogOpen(true);
  };

  const handleSaveRename = () => {
    if (!selectedColumn || !renameColumnName.trim()) return;
    updateColumnMutation.mutate({
      id: selectedColumn.id,
      data: { name: renameColumnName },
    });
  };

  const handleSaveColor = () => {
    if (!selectedColumn) return;
    updateColumnMutation.mutate({
      id: selectedColumn.id,
      data: { color: columnColor },
    });
  };

  const handleConfirmDeleteColumn = () => {
    if (!selectedColumn) return;
    deleteColumnMutation.mutate(selectedColumn.id);
  };

  const handleConfirmDeleteTask = () => {
    if (!selectedTask) return;
    deleteTaskMutation.mutate(selectedTask.id);
  };

  if (!accountId) {
    return null;
  }

  if (projectsLoading || columnsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                To-Do & Projects
              </h1>
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
                      {project.name}
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
            <Button
              onClick={() => setIsCreateColumnDialogOpen(true)}
              data-testid="button-new-column"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Colonne
            </Button>
          </div>
        </div>

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
                      {Math.round(
                        (tasks.filter((t) => t.status === "done").length / Math.max(tasks.length, 1)) * 100
                      )}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      (tasks.filter((t) => t.status === "done").length / Math.max(tasks.length, 1)) * 100
                    }
                  />
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div>{tasks.length} tâches</div>
                  <div>{tasks.filter((t) => t.status === "done").length} terminées</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {tasksLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Chargement des tâches...
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              <SortableContext
                items={sortedColumns.map((c) => c.id)}
                strategy={horizontalListSortingStrategy}
              >
                {sortedColumns.map((column) => {
                  const columnTasks = tasks.filter((t) => t.columnId === column.id);
                  return (
                    <div key={column.id} className="min-w-[320px]">
                      <SortableColumn
                        column={column}
                        tasks={columnTasks}
                        users={users}
                        onRename={handleRenameColumn}
                        onChangeColor={handleChangeColor}
                        onDelete={handleDeleteColumn}
                        onAddTask={handleAddTask}
                        onDuplicate={handleDuplicateTask}
                        onEditTask={handleEditTask}
                        onDeleteTask={handleDeleteTask}
                        onAssign={handleAssignTask}
                        onMarkComplete={handleMarkComplete}
                        onTaskClick={handleTaskClick}
                      />
                    </div>
                  );
                })}
              </SortableContext>
            </div>
            <DragOverlay>
              {activeTaskId ? (
                <Card className="w-[300px] opacity-50">
                  <CardContent className="p-3">
                    <div className="text-sm font-medium">
                      {tasks.find((t) => t.id === activeTaskId)?.title}
                    </div>
                  </CardContent>
                </Card>
              ) : activeColumnId ? (
                <div className="w-[320px] opacity-50">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {taskColumns.find((c) => c.id === activeColumnId)?.name}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
        <DialogContent data-testid="dialog-create-task">
          <DialogHeader>
            <DialogTitle>Nouvelle tâche</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Titre *</Label>
              <Input
                id="task-title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                data-testid="input-new-task-title"
              />
            </div>
            <div>
              <Label htmlFor="task-description">Description</Label>
              <Input
                id="task-description"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                data-testid="input-new-task-description"
              />
            </div>
            <div>
              <Label htmlFor="task-priority">Priorité</Label>
              <Select
                value={newTaskPriority}
                onValueChange={(value: "low" | "medium" | "high") => setNewTaskPriority(value)}
              >
                <SelectTrigger id="task-priority" data-testid="select-new-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Faible</SelectItem>
                  <SelectItem value="medium">Moyen</SelectItem>
                  <SelectItem value="high">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateTaskDialogOpen(false)}
              data-testid="button-cancel-create-task"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={!newTaskTitle.trim() || createTaskMutation.isPending}
              data-testid="button-submit-create-task"
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateColumnDialogOpen} onOpenChange={setIsCreateColumnDialogOpen}>
        <DialogContent data-testid="dialog-create-column">
          <DialogHeader>
            <DialogTitle>Nouvelle colonne</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="column-name">Nom de la colonne *</Label>
              <Input
                id="column-name"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                data-testid="input-new-column-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateColumnDialogOpen(false)}
              data-testid="button-cancel-create-column"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateColumn}
              disabled={!newColumnName.trim() || createColumnMutation.isPending}
              data-testid="button-submit-create-column"
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRenameColumnDialogOpen} onOpenChange={setIsRenameColumnDialogOpen}>
        <DialogContent data-testid="dialog-rename-column">
          <DialogHeader>
            <DialogTitle>Renommer la colonne</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rename-column">Nom de la colonne *</Label>
              <Input
                id="rename-column"
                value={renameColumnName}
                onChange={(e) => setRenameColumnName(e.target.value)}
                data-testid="input-rename-column"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRenameColumnDialogOpen(false)}
              data-testid="button-cancel-rename"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveRename}
              disabled={!renameColumnName.trim() || updateColumnMutation.isPending}
              data-testid="button-submit-rename"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isColorColumnDialogOpen} onOpenChange={setIsColorColumnDialogOpen}>
        <DialogContent data-testid="dialog-color-column">
          <DialogHeader>
            <DialogTitle>Changer la couleur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sélectionner une couleur</Label>
              <div className="mt-2">
                <ColorPicker value={columnColor} onChange={setColumnColor} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsColorColumnDialogOpen(false)}
              data-testid="button-cancel-color"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveColor}
              disabled={updateColumnMutation.isPending}
              data-testid="button-submit-color"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteColumnDialogOpen} onOpenChange={setIsDeleteColumnDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-column">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette colonne ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-column">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteColumn}
              data-testid="button-confirm-delete-column"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteTaskDialogOpen} onOpenChange={setIsDeleteTaskDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-task">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-task">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteTask}
              data-testid="button-confirm-delete-task"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskDetailModal
        task={selectedTask}
        users={users}
        isOpen={isTaskDetailOpen}
        onClose={() => {
          setIsTaskDetailOpen(false);
          setSelectedTask(null);
        }}
        onSave={handleSaveTaskDetail}
      />
    </div>
  );
}
