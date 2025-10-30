import { useState, useEffect } from "react";
import { Plus, Filter, LayoutGrid, List, GripVertical, Edit, Trash2, CalendarIcon, Calendar as CalendarLucide, Check, ChevronsUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  useDroppable,
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
                className="text-sm font-medium text-foreground flex-1 cursor-pointer"
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
            <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
              {task.description}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 ml-6">
            <div className="flex items-center gap-2 flex-1">
              <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                {getPriorityLabel(task.priority)}
              </Badge>
              {task.dueDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
                      <AvatarFallback className="text-xs">
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

  // Make the column droppable for tasks
  const { setNodeRef: setDroppableRef } = useDroppable({
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
        <CardContent ref={setDroppableRef} className="flex-1 space-y-2 overflow-auto">
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

// List View Component
interface ListViewProps {
  tasks: Task[];
  columns: TaskColumn[];
  users: AppUser[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

function ListView({ tasks, columns, users, onEditTask, onDeleteTask }: ListViewProps) {
  const [columnOrder, setColumnOrder] = useState([
    'title',
    'assignedTo',
    'status',
    'priority',
    'dueDate',
    'actions'
  ]);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveColumnId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveColumnId(null);

    if (!over || active.id === over.id) return;

    setColumnOrder((items) => {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      return arrayMove(items, oldIndex, newIndex);
    });
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

  const getColumnName = (task: Task) => {
    const column = columns.find(c => c.id === task.columnId);
    return column?.name || "—";
  };

  const columnHeaders = {
    title: { label: 'Tâche', id: 'title' },
    assignedTo: { label: 'Assigné à', id: 'assignedTo' },
    status: { label: 'Statut', id: 'status' },
    priority: { label: 'Priorité', id: 'priority' },
    dueDate: { label: 'Échéance', id: 'dueDate' },
    actions: { label: 'Actions', id: 'actions' },
  };

  const SortableTableHeader = ({ columnId }: { columnId: string }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: columnId });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      cursor: isDragging ? 'grabbing' : 'grab',
    };

    const header = columnHeaders[columnId as keyof typeof columnHeaders];

    return (
      <TableHead
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="font-semibold"
        data-testid={`table-header-${columnId}`}
      >
        {header.label}
      </TableHead>
    );
  };

  return (
    <div className="overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <SortableContext items={columnOrder}>
                {columnOrder.map((columnId) => (
                  <SortableTableHeader key={columnId} columnId={columnId} />
                ))}
              </SortableContext>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Aucune tâche
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => {
                const assignedUser = users.find((u) => u.id === task.assignedToId);
                
                return (
                  <TableRow key={task.id} data-testid={`table-row-${task.id}`}>
                    {columnOrder.map((columnId) => {
                      switch (columnId) {
                        case 'title':
                          return (
                            <TableCell key={columnId} className="font-medium">
                              {task.title}
                            </TableCell>
                          );
                        case 'assignedTo':
                          return (
                            <TableCell key={columnId}>
                              {assignedUser ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={assignedUser.avatarUrl || ""} />
                                    <AvatarFallback className="text-xs">
                                      {assignedUser.firstName?.[0]}
                                      {assignedUser.lastName?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">
                                    {assignedUser.firstName} {assignedUser.lastName}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">Non assigné</span>
                              )}
                            </TableCell>
                          );
                        case 'status':
                          return (
                            <TableCell key={columnId}>
                              <Badge variant="secondary">{getColumnName(task)}</Badge>
                            </TableCell>
                          );
                        case 'priority':
                          return (
                            <TableCell key={columnId}>
                              <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                                {getPriorityLabel(task.priority)}
                              </Badge>
                            </TableCell>
                          );
                        case 'dueDate':
                          return (
                            <TableCell key={columnId}>
                              {task.dueDate ? (
                                <span className="text-sm">
                                  {formatDate(new Date(task.dueDate), 'dd MMM yyyy', { locale: fr })}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        case 'actions':
                          return (
                            <TableCell key={columnId}>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => onEditTask(task)}
                                  data-testid={`button-edit-task-${task.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => onDeleteTask(task)}
                                  data-testid={`button-delete-task-${task.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          );
                        default:
                          return null;
                      }
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </DndContext>
    </div>
  );
}

export default function Projects() {
  const [, setLocation] = useLocation();
  const accountId = localStorage.getItem("demo_account_id");
  const userId = localStorage.getItem("demo_user_id");
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
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
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState<string | undefined>();
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>();
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>("");
  const [projectComboboxOpen, setProjectComboboxOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [renameColumnName, setRenameColumnName] = useState("");
  const [columnColor, setColumnColor] = useState("rgba(229, 231, 235, 0.4)");

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

  // Fetch columns for the project selected in task creation form
  const { data: newTaskProjectColumns = [] } = useQuery<TaskColumn[]>({
    queryKey: ["/api/projects", newTaskProjectId, "task-columns"],
    enabled: !!newTaskProjectId && isCreateTaskDialogOpen,
  });

  // Auto-select first column when project changes in task creation form
  useEffect(() => {
    if (newTaskProjectId && newTaskProjectColumns.length > 0) {
      const sortedColumns = [...newTaskProjectColumns].sort((a, b) => a.order - b.order);
      setCreateTaskColumnId(sortedColumns[0].id);
    }
  }, [newTaskProjectId, newTaskProjectColumns]);

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
    onSuccess: (_data, variables) => {
      // Invalidate tasks for the project where the task was created
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.projectId, "tasks"] });
      // Also invalidate current project if different
      if (variables.projectId !== selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "tasks"] });
      }
      setIsCreateTaskDialogOpen(false);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
      setNewTaskAssignedTo(undefined);
      setNewTaskDueDate(undefined);
      setNewTaskProjectId("");
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

    console.log("[DRAG] handleDragEnd called", { 
      activeId: active.id, 
      overId: over?.id,
      hasOver: !!over 
    });

    if (!over) {
      console.log("[DRAG] No over target, aborting");
      return;
    }

    const draggedTask = tasks.find((t) => t.id === active.id);
    const draggedColumn = taskColumns.find((c) => c.id === active.id);

    console.log("[DRAG] Dragged entities:", {
      isDraggedTask: !!draggedTask,
      isDraggedColumn: !!draggedColumn
    });

    if (draggedTask) {
      // Check if dropped on a droppable column zone
      const isDroppableZone = over.id.toString().startsWith('droppable-');
      const overColumn = isDroppableZone 
        ? taskColumns.find((c) => `droppable-${c.id}` === over.id)
        : taskColumns.find((c) => c.id === over.id);
      const overTask = tasks.find((t) => t.id === over.id);
      
      console.log("[DRAG] Drop targets:", {
        isDroppableZone,
        isOverColumn: !!overColumn,
        isOverTask: !!overTask,
        overId: over.id,
        overData: over.data
      });

      let targetColumnId: string;
      let targetPosition: number;

      if (overColumn) {
        targetColumnId = overColumn.id;
        const tasksInColumn = tasks.filter((t) => t.columnId === targetColumnId);
        targetPosition = tasksInColumn.length;
        console.log("[DRAG] Dropped on column", { targetColumnId, targetPosition });
      } else if (overTask) {
        targetColumnId = overTask.columnId!;
        targetPosition = overTask.positionInColumn;
        console.log("[DRAG] Dropped on task", { targetColumnId, targetPosition });
      } else {
        console.log("[DRAG] No valid drop target found, aborting");
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

      console.log("[DRAG] Updates calculated:", { 
        updatesCount: updates.length,
        updates: updates 
      });

      if (updates.length > 0) {
        console.log("[DRAG] Calling bulkUpdatePositionsMutation...");
        bulkUpdatePositionsMutation.mutate(updates);
      } else {
        console.log("[DRAG] No updates to perform");
      }
    } else if (draggedColumn && active.id !== over.id) {
      console.log("[DRAG] Reordering column");
      const oldIndex = sortedColumns.findIndex((c) => c.id === active.id);
      const newIndex = sortedColumns.findIndex((c) => c.id === over.id);

      const reordered = [...sortedColumns];
      const [removed] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, removed);

      reorderColumnsMutation.mutate(reordered.map((c) => c.id));
    }
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim() || !accountId || !userId) return;

    // Determine which columns to use (from selected project in form or current project)
    const targetColumns = newTaskProjectId && newTaskProjectId !== selectedProjectId 
      ? newTaskProjectColumns 
      : taskColumns;
    
    // Use createTaskColumnId if set, otherwise use first column (sorted by order)
    const sortedTargetColumns = [...targetColumns].sort((a, b) => a.order - b.order);
    const targetColumnId = createTaskColumnId || sortedTargetColumns[0]?.id;
    
    if (!targetColumnId) {
      toast({ title: "Erreur: Aucune colonne trouvée", variant: "destructive" });
      return;
    }

    // Calculate position - fetch tasks from the target project if different
    const targetProjectId = newTaskProjectId || selectedProjectId;
    const tasksInColumn = tasks
      .filter((t) => t.columnId === targetColumnId && t.projectId === targetProjectId);
    const maxPosition = tasksInColumn.length > 0
      ? Math.max(...tasksInColumn.map((t) => t.positionInColumn))
      : -1;

    createTaskMutation.mutate({
      accountId,
      projectId: targetProjectId,
      columnId: targetColumnId,
      title: newTaskTitle,
      description: newTaskDescription || null,
      priority: newTaskPriority,
      status: "todo",
      assignedToId: newTaskAssignedTo || null,
      assignees: [],
      progress: 0,
      positionInColumn: maxPosition + 1,
      order: 0,
      dueDate: (newTaskDueDate ? newTaskDueDate.toISOString() : null) as any,
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
      color: "rgba(229, 231, 235, 0.4)",
      order: maxOrder + 1,
      isLocked: 0,
    });
  };

  const handleAddTask = (columnId: string) => {
    setCreateTaskColumnId(columnId);
    setNewTaskProjectId(selectedProjectId); // Default to current project
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
    
    // Fix date format if dueDate is provided
    const updatedData = { ...data };
    if (updatedData.dueDate && typeof updatedData.dueDate !== 'string') {
      updatedData.dueDate = (updatedData.dueDate as Date).toISOString() as any;
    }
    
    // If columnId changed, calculate new position at end of target column
    if (updatedData.columnId && updatedData.columnId !== selectedTask.columnId) {
      const tasksInTargetColumn = tasks.filter((t) => t.columnId === updatedData.columnId);
      const maxPosition = tasksInTargetColumn.length > 0
        ? Math.max(...tasksInTargetColumn.map((t) => t.positionInColumn))
        : -1;
      updatedData.positionInColumn = maxPosition + 1;
    }
    
    updateTaskMutation.mutate({
      id: selectedTask.id,
      data: updatedData,
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
                Gestion des tâches en mode Kanban et Liste
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
                <LayoutGrid className="w-4 h-4 mr-2" />
                Kanban
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="w-4 h-4 mr-2" />
                Liste
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
        ) : viewMode === "kanban" ? (
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
        ) : (
          <ListView
            tasks={tasks}
            columns={taskColumns}
            users={users}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
          />
        )}
      </div>

      <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
        <DialogContent data-testid="dialog-create-task">
          <DialogHeader>
            <DialogTitle>Nouvelle tâche</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Projet *</Label>
              <Popover open={projectComboboxOpen} onOpenChange={setProjectComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={projectComboboxOpen}
                    className="w-full justify-between"
                    data-testid="button-select-project"
                  >
                    {newTaskProjectId
                      ? projects.find((p) => p.id === newTaskProjectId)?.name
                      : "Sélectionner un projet..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Rechercher un projet..." />
                    <CommandList>
                      <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                      <CommandGroup>
                        {projects.map((project) => (
                          <CommandItem
                            key={project.id}
                            value={project.name}
                            onSelect={() => {
                              setNewTaskProjectId(project.id);
                              setProjectComboboxOpen(false);
                              // Reset columnId when project changes - will be set to first column of new project
                              setCreateTaskColumnId(null);
                            }}
                            data-testid={`project-option-${project.id}`}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                newTaskProjectId === project.id ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {project.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
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
              <Textarea
                id="task-description"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                rows={3}
                data-testid="textarea-new-task-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="task-assigned">Assigné à</Label>
                <Select
                  value={newTaskAssignedTo || "unassigned"}
                  onValueChange={(value) => setNewTaskAssignedTo(value === "unassigned" ? undefined : value)}
                >
                  <SelectTrigger id="task-assigned" data-testid="select-new-task-assigned">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Non assigné</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Date d'échéance</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-new-task-due-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newTaskDueDate ? (
                      formatDate(newTaskDueDate, "PPP", { locale: fr })
                    ) : (
                      <span>Choisir une date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={newTaskDueDate}
                    onSelect={setNewTaskDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateTaskDialogOpen(false);
                setNewTaskTitle("");
                setNewTaskDescription("");
                setNewTaskPriority("medium");
                setNewTaskAssignedTo(undefined);
                setNewTaskDueDate(undefined);
                setNewTaskProjectId("");
              }}
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
        projects={projects}
        columns={sortedColumns}
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
