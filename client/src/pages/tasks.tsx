// Tasks page - Complete duplicate of tasks tab from projects page
import { useState, useEffect } from "react";
import { Plus, LayoutGrid, List, GripVertical, CalendarIcon, Calendar as CalendarLucide, Check, ChevronsUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, formatDateForStorage } from "@/lib/queryClient";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format as formatDate } from "date-fns";
import { fr } from "date-fns/locale";
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
import { useAuth } from "@/contexts/AuthContext";

// Import ListView component
import { ListView } from "@/components/ListView";

// Helper function to derive task status from column name
function getStatusFromColumnName(columnName: string): "todo" | "in_progress" | "review" | "done" {
  const lowerName = columnName.toLowerCase();
  
  if (lowerName.includes("à faire") || lowerName.includes("todo") || lowerName.includes("backlog")) {
    return "todo";
  } else if (lowerName.includes("terminé") || lowerName.includes("done") || lowerName.includes("complété")) {
    return "done";
  } else if (lowerName.includes("en cours") || lowerName.includes("progress") || lowerName.includes("doing")) {
    return "in_progress";
  } else if (lowerName.includes("revue") || lowerName.includes("review") || lowerName.includes("validation")) {
    return "review";
  }
  
  // Default to in_progress for custom columns
  return "in_progress";
}

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
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
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
      data-testid={`task-card-${task.id}`}
    >
      <Card className="hover-elevate active-elevate-2 mb-2">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing mt-0.5"
                data-testid={`drag-handle-${task.id}`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <h4
                className="text-xs font-medium text-foreground flex-1 cursor-pointer"
                onClick={() => onClick(task)}
              >
                {task.title}
              </h4>
            </div>
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
            <p className="text-[10px] text-muted-foreground line-clamp-2 ml-6">
              {task.description}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 ml-6">
            <div className="flex items-center gap-2 flex-1">
              <Badge className={`text-[10px] ${getPriorityColor(task.priority)}`}>
                {getPriorityLabel(task.priority)}
              </Badge>
              {task.dueDate && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CalendarLucide className="h-3 w-3" />
                  {formatDate(new Date(task.dueDate), "dd MMM yyyy", { locale: fr })}
                </div>
              )}
            </div>
            {assignedUser && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-6 w-6 cursor-pointer">
                      <AvatarImage src={assignedUser.avatarUrl || ""} />
                      <AvatarFallback className="text-[10px]">
                        {assignedUser.firstName?.[0]}
                        {assignedUser.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{assignedUser.firstName} {assignedUser.lastName}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `droppable-${column.id}`,
    data: { type: 'column', columnId: column.id }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
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
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-xs font-medium">
              {column.name}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[10px]">
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
        <CardContent ref={setDroppableRef} className="flex-1 overflow-y-auto pt-0 space-y-2">
          <SortableContext
            items={sortedTasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedTasks.map((task) => (
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
            ))}
          </SortableContext>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => onAddTask(column.id)}
            data-testid={`button-add-task-${column.id}`}
          >
            <Plus className="h-3 w-3 mr-1" />
            Ajouter une tâche
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Tasks() {
  const { accountId, userId } = useAuth();
  const { toast } = useToast();
  
  // Main states
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Quick add task state
  const [quickAddTaskTitle, setQuickAddTaskTitle] = useState("");
  const [isQuickAddingTask, setIsQuickAddingTask] = useState(false);

  // Dialog states
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false);
  const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState(false);
  const [isCreateColumnDialogOpen, setIsCreateColumnDialogOpen] = useState(false);
  const [isRenameColumnDialogOpen, setIsRenameColumnDialogOpen] = useState(false);
  const [isColorColumnDialogOpen, setIsColorColumnDialogOpen] = useState(false);
  const [isDeleteColumnDialogOpen, setIsDeleteColumnDialogOpen] = useState(false);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);

  // Selected items
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<TaskColumn | null>(null);

  // Form states
  const [taskFormData, setTaskFormData] = useState<InsertTask>({
    title: "",
    description: "",
    priority: "medium",
    status: "todo",
    projectId: "",
    columnId: "",
    positionInColumn: 0,
    accountId: accountId || "",
  });

  const [columnFormData, setColumnFormData] = useState<InsertTaskColumn>({
    name: "",
    color: "#ffffff",
    order: 0,
    projectId: "",
    isLocked: false,
    accountId: accountId || "",
  });

  const [renameColumnName, setRenameColumnName] = useState("");
  const [columnColor, setColumnColor] = useState("#ffffff");

  // Drag and drop states
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    columnId: string;
    position: 'before' | 'after';
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Queries
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!accountId,
  });

  const { data: taskColumns = [], isLoading: columnsLoading } = useQuery<TaskColumn[]>({
    queryKey: selectedProjectId === "all" 
      ? ["/api/task-columns"]
      : ["/api/projects", selectedProjectId, "task-columns"],
    enabled: !!accountId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !!accountId,
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
  });

  // Filter tasks based on selected project
  const filteredTasks = selectedProjectId === "all"
    ? tasks
    : tasks.filter((t) => t.projectId === selectedProjectId);

  // Filter columns based on selected project
  const filteredColumns = selectedProjectId === "all"
    ? taskColumns
    : taskColumns.filter((c) => c.projectId === selectedProjectId);

  const sortedColumns = [...filteredColumns].sort((a, b) => a.order - b.order);

  // Auto-select first project if "all" is selected and we're in kanban mode
  useEffect(() => {
    if (selectedProjectId === "all" && viewMode === "kanban" && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [selectedProjectId, viewMode, projects]);

  // When changing projects, reset view mode to list if "all" is selected
  useEffect(() => {
    if (selectedProjectId === "all") {
      setViewMode("list");
    }
  }, [selectedProjectId]);

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: async (data: InsertTask) => {
      const response = await apiRequest("/api/tasks", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsCreateTaskDialogOpen(false);
      setTaskFormData({
        title: "",
        description: "",
        priority: "medium",
        status: "todo",
        projectId: "",
        columnId: "",
        positionInColumn: 0,
        accountId: accountId || "",
      });
      toast({
        title: "Tâche créée",
        description: "La tâche a été créée avec succès.",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const response = await apiRequest(`/api/tasks/${id}`, "PATCH", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/tasks/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsDeleteTaskDialogOpen(false);
      setSelectedTask(null);
      toast({
        title: "Tâche supprimée",
        description: "La tâche a été supprimée avec succès.",
      });
    },
  });

  const createColumnMutation = useMutation({
    mutationFn: async (data: InsertTaskColumn) => {
      const response = await apiRequest("/api/task-columns", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-columns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "task-columns"] });
      setIsCreateColumnDialogOpen(false);
      setColumnFormData({
        name: "",
        color: "#ffffff",
        order: 0,
        projectId: "",
        isLocked: false,
        accountId: accountId || "",
      });
      toast({
        title: "Colonne créée",
        description: "La colonne a été créée avec succès.",
      });
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskColumn> }) => {
      const response = await apiRequest(`/api/task-columns/${id}`, "PATCH", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-columns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "task-columns"] });
      setIsRenameColumnDialogOpen(false);
      setIsColorColumnDialogOpen(false);
      setSelectedColumn(null);
      toast({
        title: "Colonne mise à jour",
        description: "La colonne a été mise à jour avec succès.",
      });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/task-columns/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-columns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "task-columns"] });
      setIsDeleteColumnDialogOpen(false);
      setSelectedColumn(null);
      toast({
        title: "Colonne supprimée",
        description: "La colonne a été supprimée avec succès.",
      });
    },
  });

  // Event handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    
    if (active.data.current?.type === 'task') {
      setActiveTaskId(active.id as string);
    } else if (active.data.current?.type === 'column') {
      setActiveColumnId(active.id as string);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setDropIndicator(null);
      return;
    }

    // Handle column reordering indicators
    if (active.data.current?.type === 'column' && over.data.current?.type === 'column') {
      const activeIndex = sortedColumns.findIndex(c => c.id === active.id);
      const overIndex = sortedColumns.findIndex(c => c.id === over.id);
      
      if (activeIndex !== -1 && overIndex !== -1) {
        setDropIndicator({
          columnId: over.id as string,
          position: activeIndex < overIndex ? 'after' : 'before'
        });
      }
    } else {
      setDropIndicator(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);
    setActiveColumnId(null);
    setDropIndicator(null);

    if (!over) return;

    // Handle task drag
    if (active.data.current?.type === 'task') {
      const taskId = active.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      let newColumnId = task.columnId;
      let newPosition = task.positionInColumn;

      // Determine new column
      if (over.data.current?.type === 'column') {
        newColumnId = over.data.current.columnId;
      } else if (over.data.current?.type === 'task') {
        const overTask = tasks.find((t) => t.id === over.id);
        if (overTask) {
          newColumnId = overTask.columnId;
        }
      }

      // Calculate new position
      const columnTasks = tasks
        .filter((t) => t.columnId === newColumnId)
        .sort((a, b) => a.positionInColumn - b.positionInColumn);

      if (over.data.current?.type === 'task') {
        const overIndex = columnTasks.findIndex((t) => t.id === over.id);
        newPosition = overIndex >= 0 ? columnTasks[overIndex].positionInColumn : 0;
      } else {
        newPosition = columnTasks.length;
      }

      // Get the new column and derive status from its name
      const newColumn = taskColumns.find(c => c.id === newColumnId);
      const newStatus = newColumn ? getStatusFromColumnName(newColumn.name) : task.status;

      // Update task
      if (newColumnId !== task.columnId || newPosition !== task.positionInColumn) {
        await updateTaskMutation.mutateAsync({
          id: taskId,
          data: { 
            columnId: newColumnId, 
            positionInColumn: newPosition,
            status: newStatus,
          },
        });
      }
    }

    // Handle column drag
    if (active.data.current?.type === 'column' && over.data.current?.type === 'column') {
      const activeIndex = sortedColumns.findIndex((c) => c.id === active.id);
      const overIndex = sortedColumns.findIndex((c) => c.id === over.id);

      if (activeIndex !== overIndex) {
        const newColumns = arrayMove(sortedColumns, activeIndex, overIndex);
        
        // Update column orders
        for (let i = 0; i < newColumns.length; i++) {
          if (newColumns[i].order !== i) {
            await updateColumnMutation.mutateAsync({
              id: newColumns[i].id,
              data: { order: i },
            });
          }
        }
      }
    }
  };

  const handleAddTask = (columnId: string) => {
    const column = taskColumns.find((c) => c.id === columnId);
    const columnTasks = tasks.filter((t) => t.columnId === columnId);
    
    setTaskFormData({
      title: "",
      description: "",
      priority: "medium",
      status: column ? getStatusFromColumnName(column.name) : "todo",
      projectId: selectedProjectId,
      columnId: columnId,
      positionInColumn: columnTasks.length,
      accountId: accountId || "",
    });
    setIsCreateTaskDialogOpen(true);
  };

  const handleDuplicateTask = (task: Task) => {
    const columnTasks = tasks.filter((t) => t.columnId === task.columnId);
    createTaskMutation.mutate({
      ...task,
      id: undefined as any,
      title: `${task.title} (copie)`,
      positionInColumn: columnTasks.length,
      accountId: accountId || "",
    });
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setTaskFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      projectId: task.projectId,
      columnId: task.columnId,
      positionInColumn: task.positionInColumn,
      assignedToId: task.assignedToId || undefined,
      dueDate: task.dueDate || undefined,
      accountId: accountId || "",
    });
    setIsEditTaskDialogOpen(true);
  };

  const handleDeleteTask = (task: Task) => {
    setSelectedTask(task);
    setIsDeleteTaskDialogOpen(true);
  };

  const handleAssignTask = (task: Task, userId: string) => {
    updateTaskMutation.mutate({
      id: task.id,
      data: { assignedToId: userId === task.assignedToId ? null : userId },
    });
  };

  const handleMarkComplete = async (task: Task) => {
    // Find the "done" column
    const doneColumn = taskColumns
      .filter(c => c.projectId === task.projectId)
      .find(c => {
        const lowerName = c.name.toLowerCase();
        return lowerName.includes("terminé") || lowerName.includes("done") || lowerName.includes("complété");
      });

    if (doneColumn) {
      // Count tasks in done column to get position
      const doneColumnTasks = tasks.filter(t => t.columnId === doneColumn.id);
      
      await updateTaskMutation.mutateAsync({
        id: task.id,
        data: { 
          status: "done",
          columnId: doneColumn.id,
          positionInColumn: doneColumnTasks.length,
        },
      });
    } else {
      // If no done column, just update status
      await updateTaskMutation.mutateAsync({
        id: task.id,
        data: { status: "done" },
      });
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskDetailOpen(true);
  };

  const handleQuickCreateTask = async () => {
    if (!quickAddTaskTitle.trim() || !selectedProjectId || selectedProjectId === "all") return;
    
    setIsQuickAddingTask(true);
    try {
      // Find first column for this project
      const firstColumn = sortedColumns[0];
      if (!firstColumn) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Aucune colonne disponible pour ce projet",
        });
        return;
      }

      const columnTasks = tasks.filter((t) => t.columnId === firstColumn.id);
      const taskData: InsertTask = {
        title: quickAddTaskTitle,
        description: "",
        priority: "medium",
        status: getStatusFromColumnName(firstColumn.name),
        projectId: selectedProjectId,
        columnId: firstColumn.id,
        positionInColumn: columnTasks.length,
        accountId: accountId || "",
      };

      await apiRequest("/api/tasks", "POST", taskData);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setQuickAddTaskTitle("");
      toast({
        title: "Tâche créée",
        description: "La tâche a été créée avec succès.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer la tâche",
      });
    } finally {
      setIsQuickAddingTask(false);
    }
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 w-full sm:w-auto">
            {projects.length > 0 && (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-full sm:w-[280px]" data-testid="select-project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all" className="cursor-pointer">Tous les projets</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id} className="cursor-pointer">
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {viewMode !== "kanban" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 h-9 text-sm bg-white" data-testid="select-status-filter">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {(() => {
                    const filteredColumns = taskColumns
                      .filter((col: TaskColumn) => selectedProjectId === "all" || col.projectId === selectedProjectId)
                      .sort((a: TaskColumn, b: TaskColumn) => a.order - b.order);
                    
                    if (selectedProjectId === "all") {
                      const uniqueNames = new Map<string, TaskColumn>();
                      filteredColumns.forEach((col: TaskColumn) => {
                        if (!uniqueNames.has(col.name)) {
                          uniqueNames.set(col.name, col);
                        }
                      });
                      return Array.from(uniqueNames.values()).map((column: TaskColumn) => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.name}
                        </SelectItem>
                      ));
                    }
                    
                    return filteredColumns.map((column: TaskColumn) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.name}
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            )}
            {selectedProjectId !== "all" && (
              <div className="hidden md:flex border rounded-md">
                <Button
                  variant={viewMode === "kanban" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("kanban")}
                  data-testid="button-view-kanban"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  data-testid="button-view-list"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            )}
            {selectedProjectId !== "all" && (
              <>
                <Button
                  onClick={() => setIsCreateTaskDialogOpen(true)}
                  data-testid="button-new-task"
                  className="flex-1 sm:flex-none md:hidden"
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => viewMode === "list" ? setIsCreateTaskDialogOpen(true) : setIsCreateColumnDialogOpen(true)}
                  data-testid={viewMode === "list" ? "button-new-task" : "button-new-column"}
                  className="hidden md:flex"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span>{viewMode === "list" ? "Nouvelle Tâche" : "Nouvelle Colonne"}</span>
                </Button>
              </>
            )}
            {selectedProjectId === "all" && (
              <Button
                onClick={() => setIsCreateTaskDialogOpen(true)}
                data-testid="button-new-task"
                className="flex-1 sm:flex-none"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Nouvelle Tâche</span>
              </Button>
            )}
          </div>
        </div>

        {selectedProjectId === "all" ? (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <h3 className="text-xs font-medium text-foreground mb-2">
                    Vue d'ensemble de toutes les tâches
                  </h3>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{filteredTasks.length} tâches au total</div>
                  <div>{projects.length} projets</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : selectedProject && (() => {
          const completedColumn = taskColumns
            .filter(c => c.isLocked && c.projectId === selectedProjectId)
            .sort((a, b) => b.order - a.order)[0];
          const completedTasks = completedColumn 
            ? filteredTasks.filter((t) => t.columnId === completedColumn.id).length 
            : 0;
          const progressPercentage = Math.round((completedTasks / Math.max(filteredTasks.length, 1)) * 100);

          return (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-medium text-foreground">
                        Progression du projet
                      </h3>
                      <span className="text-xs font-semibold text-foreground">
                        {progressPercentage}%
                      </span>
                    </div>
                    <Progress value={progressPercentage} />
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{filteredTasks.length} tâches</div>
                    <div>{completedTasks} terminées</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {tasksLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Chargement des tâches...
          </div>
        ) : (
          <>
            <div className={
              selectedProjectId === "all" || viewMode === "list" 
                ? "" 
                : "md:hidden"
            }>
              <ListView
                tasks={filteredTasks}
                columns={taskColumns}
                users={users}
                projects={projects}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onUpdateTask={(taskId, data) => {
                  updateTaskMutation.mutate({ id: taskId, data });
                }}
                quickAddTaskTitle={quickAddTaskTitle}
                setQuickAddTaskTitle={setQuickAddTaskTitle}
                isQuickAddingTask={isQuickAddingTask}
                setIsQuickAddingTask={setIsQuickAddingTask}
                onCreateTask={handleQuickCreateTask}
                selectedProjectId={selectedProjectId}
                statusFilter={statusFilter}
                accountId={accountId || undefined}
                userId={userId || undefined}
              />
            </div>
            
            {selectedProjectId !== "all" && viewMode === "kanban" && (
              <div className="hidden md:block">
                <DndContext
                  sensors={sensors}
                  collisionDetection={pointerWithin}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex gap-4 overflow-x-auto pb-4">
                    <SortableContext
                      items={sortedColumns.map((c) => c.id)}
                      strategy={horizontalListSortingStrategy}
                    >
                      {sortedColumns.map((column) => {
                        const columnTasks = filteredTasks.filter((t) => t.columnId === column.id);
                        const showBeforeIndicator = dropIndicator?.columnId === column.id && dropIndicator.position === 'before';
                        const showAfterIndicator = dropIndicator?.columnId === column.id && dropIndicator.position === 'after';
                        
                        return (
                          <div key={column.id} className="flex items-stretch">
                            {showBeforeIndicator && (
                              <div className="w-1 bg-primary rounded-full mx-2 animate-pulse" />
                            )}
                            <div className="min-w-[320px]">
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
                            {showAfterIndicator && (
                              <div className="w-1 bg-primary rounded-full mx-2 animate-pulse" />
                            )}
                          </div>
                        );
                      })}
                    </SortableContext>
                  </div>
                  <DragOverlay>
                    {activeTaskId ? (
                      <Card className="w-[300px] opacity-50">
                        <CardContent className="p-3">
                          <div className="text-xs font-medium">
                            {tasks.find((t) => t.id === activeTaskId)?.title}
                          </div>
                        </CardContent>
                      </Card>
                    ) : activeColumnId ? (
                      <div className="w-[320px] opacity-50">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-xs">
                              {taskColumns.find((c) => c.id === activeColumnId)?.name}
                            </CardTitle>
                          </CardHeader>
                        </Card>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            )}
          </>
        )}

        {/* Dialogs */}
        <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Créer une nouvelle tâche</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="task-title">Titre</Label>
                <Input
                  id="task-title"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  data-testid="input-task-title"
                />
              </div>
              <div>
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  data-testid="input-task-description"
                />
              </div>
              <div>
                <Label htmlFor="task-priority">Priorité</Label>
                <Select
                  value={taskFormData.priority}
                  onValueChange={(value: any) => setTaskFormData({ ...taskFormData, priority: value })}
                >
                  <SelectTrigger id="task-priority" className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedProjectId === "all" && (
                <div>
                  <Label htmlFor="task-project">Projet</Label>
                  <Select
                    value={taskFormData.projectId}
                    onValueChange={(value) => {
                      const firstColumn = taskColumns.find(c => c.projectId === value);
                      setTaskFormData({ 
                        ...taskFormData, 
                        projectId: value,
                        columnId: firstColumn?.id || "",
                      });
                    }}
                  >
                    <SelectTrigger id="task-project" className="bg-white">
                      <SelectValue placeholder="Sélectionner un projet" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateTaskDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={() => createTaskMutation.mutate(taskFormData)} data-testid="button-confirm-create-task">
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditTaskDialogOpen} onOpenChange={setIsEditTaskDialogOpen}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Modifier la tâche</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-task-title">Titre</Label>
                <Input
                  id="edit-task-title"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-task-description">Description</Label>
                <Textarea
                  id="edit-task-description"
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-task-priority">Priorité</Label>
                <Select
                  value={taskFormData.priority}
                  onValueChange={(value: any) => setTaskFormData({ ...taskFormData, priority: value })}
                >
                  <SelectTrigger id="edit-task-priority" className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditTaskDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (selectedTask) {
                    updateTaskMutation.mutate({
                      id: selectedTask.id,
                      data: taskFormData,
                    });
                    setIsEditTaskDialogOpen(false);
                  }
                }}
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteTaskDialogOpen} onOpenChange={setIsDeleteTaskDialogOpen}>
          <AlertDialogContent className="bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la tâche</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteTask}>
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isCreateColumnDialogOpen} onOpenChange={setIsCreateColumnDialogOpen}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Créer une nouvelle colonne</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="column-name">Nom</Label>
                <Input
                  id="column-name"
                  value={columnFormData.name}
                  onChange={(e) => setColumnFormData({ ...columnFormData, name: e.target.value })}
                  data-testid="input-column-name"
                />
              </div>
              <div>
                <Label htmlFor="column-color">Couleur</Label>
                <ColorPicker
                  color={columnFormData.color}
                  onChange={(color) => setColumnFormData({ ...columnFormData, color })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateColumnDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => {
                  const newColumn: InsertTaskColumn = {
                    ...columnFormData,
                    projectId: selectedProjectId,
                    order: sortedColumns.length,
                    accountId: accountId || "",
                  };
                  createColumnMutation.mutate(newColumn);
                }}
                data-testid="button-confirm-create-column"
              >
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isRenameColumnDialogOpen} onOpenChange={setIsRenameColumnDialogOpen}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Renommer la colonne</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="rename-column-name">Nom</Label>
                <Input
                  id="rename-column-name"
                  value={renameColumnName}
                  onChange={(e) => setRenameColumnName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRenameColumnDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveRename}>
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isColorColumnDialogOpen} onOpenChange={setIsColorColumnDialogOpen}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Changer la couleur de la colonne</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="color-picker">Couleur</Label>
                <ColorPicker
                  color={columnColor}
                  onChange={setColumnColor}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsColorColumnDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveColor}>
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteColumnDialogOpen} onOpenChange={setIsDeleteColumnDialogOpen}>
          <AlertDialogContent className="bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la colonne</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer cette colonne ? Toutes les tâches associées seront également supprimées. Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteColumn}>
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            isOpen={isTaskDetailOpen}
            onClose={() => {
              setIsTaskDetailOpen(false);
              setSelectedTask(null);
            }}
            users={users}
            columns={taskColumns}
            onUpdate={(data) => {
              updateTaskMutation.mutate({ id: selectedTask.id, data });
            }}
          />
        )}
      </div>
    </div>
  );
}
