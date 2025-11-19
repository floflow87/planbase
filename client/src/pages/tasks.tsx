// Tasks page - Complete duplicate of tasks tab from projects page
import { useState, useEffect } from "react";
import { Plus, LayoutGrid, List, GripVertical, CalendarIcon, Calendar as CalendarLucide, Check, ChevronsUpDown, Star, Columns3, ChevronLeft, ChevronRight } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
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
import { ListView } from "@/components/ListView";
import { Loader } from "@/components/Loader";

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
  
  return "in_progress";
}

// Calendar View Component
interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

function CalendarView({ tasks, onTaskClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDisplayTitle = () => {
    if (viewMode === "month") {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (viewMode === "week") {
      return `Semaine du ${currentDate.toLocaleDateString("fr-FR")}`;
    } else {
      return currentDate.toLocaleDateString("fr-FR", { 
        weekday: "long", 
        year: "numeric", 
        month: "long", 
        day: "numeric" 
      });
    }
  };

  // Generate calendar grid for month view
  const generateMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1));
    
    const days: Date[] = [];
    const current = new Date(startDate);
    
    // Generate 6 weeks (42 days)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const getTasksForDay = (date: Date) => {
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return taskDate.toDateString() === date.toDateString();
    });
  };

  // Generate week view grid (7 days starting from Monday)
  const generateWeekGrid = () => {
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(startOfWeek.getDate() + diff);
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getPriorityColor = (priority: string | null) => {
    if (!priority) return "bg-gray-100 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300";
    switch (priority) {
      case "high": return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-l-2 border-red-500";
      case "medium": return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-l-2 border-yellow-500";
      case "low": return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-l-2 border-green-500";
      default: return "bg-gray-100 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* View Mode Toggles */}
          <div className="flex border border-border rounded-md">
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="rounded-r-none"
              data-testid="button-task-calendar-view-month"
            >
              Mois
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="rounded-none border-x border-border"
              data-testid="button-task-calendar-view-week"
            >
              Semaine
            </Button>
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("day")}
              className="rounded-l-none"
              data-testid="button-task-calendar-view-day"
            >
              Jour
            </Button>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={goToPrevious}
            data-testid="button-calendar-previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
            data-testid="button-calendar-today"
          >
            Aujourd'hui
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToNext}
            data-testid="button-calendar-next"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <div className="text-base font-semibold text-foreground ml-2">
            {getDisplayTitle()}
          </div>
        </div>
      </div>

      {/* Calendar Views */}
      {viewMode === "month" && (
      <Card>
        <CardContent className="p-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r border-border last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {generateMonthGrid().map((date, index) => {
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const isToday = date.toDateString() === new Date().toDateString();
              const dayTasks = getTasksForDay(date);

              return (
                <div
                  key={index}
                  className={`min-h-24 p-2 border-r border-b border-border last:border-r-0 ${
                    !isCurrentMonth ? "bg-muted/30" : "bg-card"
                  } ${isToday ? "bg-violet-50 dark:bg-violet-950/20" : ""}`}
                  data-testid={`calendar-day-${date.toDateString()}`}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                  } ${isToday ? "text-violet-600 dark:text-violet-400 font-bold" : ""}`}>
                    {date.getDate()}
                  </div>
                  
                  {/* Tasks */}
                  <div className="space-y-1">
                    {dayTasks.map(task => (
                      <div
                        key={task.id}
                        className={`text-xs p-1 rounded truncate cursor-pointer hover-elevate ${getPriorityColor(task.priority)}`}
                        title={task.title}
                        onClick={() => onTaskClick(task)}
                        data-testid={`calendar-task-${task.id}`}
                      >
                        <Check className="w-3 h-3 inline mr-1" />
                        {task.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Week View - Simple list of tasks for the week */}
      {viewMode === "week" && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {generateWeekGrid().map((date, dayIndex) => {
                const isToday = date.toDateString() === new Date().toDateString();
                const dayTasks = getTasksForDay(date);

                return (
                  <div key={dayIndex} className={`p-2 rounded-md border border-border ${isToday ? "bg-violet-50 dark:bg-violet-950/20" : ""}`}>
                    <div className="text-center mb-2">
                      <div className="text-xs text-muted-foreground">{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][dayIndex]}</div>
                      <div className={`text-sm font-semibold ${isToday ? "text-violet-600 dark:text-violet-400" : "text-foreground"}`}>
                        {date.getDate()}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {dayTasks.map(task => (
                        <div
                          key={task.id}
                          className={`text-xs p-1 rounded truncate cursor-pointer hover-elevate ${getPriorityColor(task.priority)}`}
                          title={task.title}
                          onClick={() => onTaskClick(task)}
                        >
                          <Check className="w-3 h-3 inline mr-1" />
                          {task.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day View - List of tasks for the selected day */}
      {viewMode === "day" && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              {getTasksForDay(currentDate).length > 0 ? (
                getTasksForDay(currentDate).map(task => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-md cursor-pointer hover-elevate ${getPriorityColor(task.priority)}`}
                    onClick={() => onTaskClick(task)}
                  >
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span className="font-medium">{task.title}</span>
                    </div>
                    {task.description && (
                      <p className="text-sm mt-1 ml-6">{task.description}</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Aucune tâche prévue pour cette journée
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface SortableTaskCardProps{
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
  } = useSortable({ 
    id: task.id,
    data: { type: 'task' }
  });

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
  dropIndicator: { columnId: string; position: 'before' | 'after'; type: 'task' | 'column' } | null;
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
  dropIndicator,
}: SortableColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: column.id,
    data: { type: 'column' }
  });

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

  // Show ring indicator only for task drags, not column drags
  // (Column drags use the before/after line indicators)
  const showDropIndicator = dropIndicator?.columnId === column.id && dropIndicator?.type === 'task';

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className={`flex flex-col h-full min-h-[500px] ${showDropIndicator ? 'ring-2 ring-primary ring-offset-2' : ''}`}
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
  const accountId = localStorage.getItem("demo_account_id");
  const userId = localStorage.getItem("demo_user_id");
  const { toast } = useToast();
  
  // Main states
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [quickAddTaskTitle, setQuickAddTaskTitle] = useState("");
  const [isQuickAddingTask, setIsQuickAddingTask] = useState(false);

  // Dialog states
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [isCreateColumnDialogOpen, setIsCreateColumnDialogOpen] = useState(false);
  const [isRenameColumnDialogOpen, setIsRenameColumnDialogOpen] = useState(false);
  const [isColorColumnDialogOpen, setIsColorColumnDialogOpen] = useState(false);
  const [isDeleteColumnDialogOpen, setIsDeleteColumnDialogOpen] = useState(false);
  const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState(false);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);

  // Selected items
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<TaskColumn | null>(null);

  // New task form states
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState<string | undefined>();
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>();
  const [newTaskEffort, setNewTaskEffort] = useState<number | null>(null);
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>("");
  const [createTaskColumnId, setCreateTaskColumnId] = useState<string | null>(null);
  const [projectComboboxOpen, setProjectComboboxOpen] = useState(false);
  const [columnComboboxOpen, setColumnComboboxOpen] = useState(false);

  // New column form
  const [newColumnName, setNewColumnName] = useState("");
  const [renameColumnName, setRenameColumnName] = useState("");
  const [columnColor, setColumnColor] = useState("#ffffff");

  // Drag and drop states
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    columnId: string;
    position: 'before' | 'after';
    type: 'task' | 'column';
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
    queryKey: ["/api/accounts", accountId, "users"],
    enabled: !!accountId,
  });

  // Get columns for the project selected in the form
  const { data: newTaskProjectColumns = [] } = useQuery<TaskColumn[]>({
    queryKey: ["/api/projects", newTaskProjectId, "task-columns"],
    enabled: !!newTaskProjectId && newTaskProjectId !== "none" && isCreateTaskDialogOpen,
  });

  // Get global columns for tasks without a project
  const { data: globalTaskColumns = [] } = useQuery<TaskColumn[]>({
    queryKey: ["/api/task-columns"],
    enabled: isCreateTaskDialogOpen,
  });

  // Auto-set column when project changes
  useEffect(() => {
    if (!isCreateTaskDialogOpen) return;
    
    const columnsToUse = newTaskProjectId === "none" ? globalTaskColumns : newTaskProjectColumns;
    if (columnsToUse.length > 0 && !createTaskColumnId) {
      const firstColumn = columnsToUse.sort((a, b) => a.order - b.order)[0];
      setCreateTaskColumnId(firstColumn.id);
    }
  }, [newTaskProjectId, newTaskProjectColumns, globalTaskColumns, isCreateTaskDialogOpen, createTaskColumnId]);

  // Filter tasks based on selected project
  const filteredTasks = selectedProjectId === "all"
    ? tasks
    : tasks.filter((t) => t.projectId === selectedProjectId);

  // Filter columns based on selected project
  const filteredColumns = selectedProjectId === "all"
    ? taskColumns
    : taskColumns.filter((c) => c.projectId === selectedProjectId);

  const sortedColumns = [...filteredColumns].sort((a, b) => a.order - b.order);

  // Allow all views (kanban, list, calendar) even when "all projects" is selected

  // Reset status filter to "all" when changing projects
  useEffect(() => {
    setStatusFilter("all");
  }, [selectedProjectId]);

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: async (data: InsertTask & { keepOpen?: boolean }) => {
      const { keepOpen, ...taskData } = data;
      const response = await apiRequest("/api/tasks", "POST", taskData);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      
      if (!variables.keepOpen) {
        setIsCreateTaskDialogOpen(false);
        setNewTaskTitle("");
        setNewTaskDescription("");
        setNewTaskPriority("medium");
        setNewTaskAssignedTo(undefined);
        setNewTaskDueDate(undefined);
        setNewTaskEffort(null);
        setNewTaskProjectId("");
      } else {
        // Keep open - just clear title
        setNewTaskTitle("");
      }
      
      toast({
        variant: "success",
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
        variant: "success",
        title: "Tâche supprimée",
        description: "La tâche a été supprimée avec succès.",
      });
    },
  });

  const duplicateTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");

      const columnTasks = tasks.filter((t) => t.columnId === task.columnId);
      const response = await apiRequest("/api/tasks", "POST", {
        ...task,
        id: undefined,
        title: `${task.title} (copie)`,
        positionInColumn: columnTasks.length,
        accountId: accountId!,
        createdBy: userId!,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        variant: "success",
        title: "Tâche dupliquée",
        description: "La tâche a été dupliquée avec succès.",
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
      setNewColumnName("");
      toast({
        variant: "success",
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
        variant: "success",
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
        variant: "success",
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

    if (active.data.current?.type === 'column' && over.data.current?.type === 'column') {
      const activeIndex = sortedColumns.findIndex(c => c.id === active.id);
      const overIndex = sortedColumns.findIndex(c => c.id === over.id);
      
      if (activeIndex !== -1 && overIndex !== -1) {
        setDropIndicator({
          columnId: over.id as string,
          position: activeIndex < overIndex ? 'after' : 'before',
          type: 'column'
        });
      }
    } else if (active.data.current?.type === 'task') {
      // When dragging a task, show indicator on the target column
      const task = filteredTasks.find(t => t.id === active.id);
      let targetColumnId: string | null = null;
      
      // Determine the target column based on what we're hovering over
      if (over.data.current?.type === 'column' && over.data.current?.columnId) {
        targetColumnId = over.data.current.columnId as string;
      } else if (over.data.current?.type === 'task') {
        const overTask = filteredTasks.find(t => t.id === over.id);
        if (overTask) {
          targetColumnId = overTask.columnId;
        }
      }
      
      // Show indicator if we're dragging to a different column
      if (targetColumnId && task && targetColumnId !== task.columnId) {
        setDropIndicator({
          columnId: targetColumnId,
          position: 'before', // Use 'before' to indicate we're targeting this column
          type: 'task'
        });
      } else {
        setDropIndicator(null);
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

      if (over.data.current?.type === 'column') {
        newColumnId = over.data.current.columnId;
      } else if (over.data.current?.type === 'task') {
        const overTask = tasks.find((t) => t.id === over.id);
        if (overTask) {
          newColumnId = overTask.columnId;
        }
      }

      const columnTasks = tasks
        .filter((t) => t.columnId === newColumnId)
        .sort((a, b) => a.positionInColumn - b.positionInColumn);

      if (over.data.current?.type === 'task') {
        const overIndex = columnTasks.findIndex((t) => t.id === over.id);
        newPosition = overIndex >= 0 ? columnTasks[overIndex].positionInColumn : 0;
      } else {
        newPosition = columnTasks.length;
      }

      const newColumn = taskColumns.find(c => c.id === newColumnId);
      const newStatus = newColumn ? getStatusFromColumnName(newColumn.name) : task.status;

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

  const handleCreateTask = (keepOpen = false) => {
    if (!newTaskTitle.trim() || !accountId || !userId) return;

    let targetColumns: TaskColumn[];
    if (newTaskProjectId === "none") {
      targetColumns = globalTaskColumns;
    } else if (newTaskProjectId && newTaskProjectId !== selectedProjectId) {
      targetColumns = newTaskProjectColumns;
    } else {
      targetColumns = taskColumns;
    }
    
    const sortedTargetColumns = [...targetColumns].sort((a, b) => a.order - b.order);
    const targetColumnId = createTaskColumnId || sortedTargetColumns[0]?.id;
    
    if (!targetColumnId) {
      toast({ title: "Erreur: Aucune colonne trouvée", variant: "destructive" });
      return;
    }

    const targetColumn = targetColumns.find((c) => c.id === targetColumnId);
    const taskStatus = targetColumn ? getStatusFromColumnName(targetColumn.name) : "todo";

    const targetProjectId = newTaskProjectId === "none" ? null : (newTaskProjectId || selectedProjectId);
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
      status: taskStatus,
      assignedToId: newTaskAssignedTo || null,
      assignees: [],
      progress: 0,
      positionInColumn: maxPosition + 1,
      order: 0,
      dueDate: (newTaskDueDate 
        ? (typeof newTaskDueDate === 'string' ? newTaskDueDate : formatDateForStorage(newTaskDueDate))
        : null) as any,
      effort: newTaskEffort,
      createdBy: userId,
      keepOpen,
    } as InsertTask & { keepOpen?: boolean });
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
    setNewTaskProjectId(selectedProjectId);
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

  const handleQuickCreateTask = () => {
    if (!quickAddTaskTitle.trim() || !accountId || !userId) return;
    
    const firstColumn = sortedColumns[0];
    if (!firstColumn) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Aucune colonne disponible",
      });
      return;
    }

    const targetProjectId = selectedProjectId === "all" ? null : selectedProjectId;
    const columnTasks = tasks.filter((t) => t.columnId === firstColumn.id && t.projectId === targetProjectId);

    createTaskMutation.mutate({
      accountId,
      projectId: targetProjectId,
      columnId: firstColumn.id,
      title: quickAddTaskTitle,
      description: null,
      priority: "medium",
      status: getStatusFromColumnName(firstColumn.name),
      assignedToId: null,
      assignees: [],
      progress: 0,
      positionInColumn: columnTasks.length,
      order: 0,
      dueDate: null,
      effort: null,
      createdBy: userId,
    } as InsertTask, {
      onSuccess: () => {
        setQuickAddTaskTitle("");
        setIsQuickAddingTask(false);
      },
    });
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskDetailOpen(true);
  };

  const handleSaveTaskDetail = (data: Partial<Task>) => {
    if (!selectedTask) return;
    
    const updatedData = { ...data };
    if (updatedData.dueDate && typeof updatedData.dueDate !== 'string') {
      updatedData.dueDate = formatDateForStorage(updatedData.dueDate as Date) as any;
    }
    
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
        <Loader size="lg" />
      </div>
    );
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header with project selector and buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 w-full sm:w-auto">
            {projects.length > 0 && (
              <Popover open={projectSelectorOpen} onOpenChange={setProjectSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={projectSelectorOpen}
                    className="w-full sm:w-[280px] justify-between text-[12px]"
                    data-testid="select-project"
                  >
                    {selectedProjectId === "all" 
                      ? "Tous les projets" 
                      : projects.find((p) => p.id === selectedProjectId)?.name || "Sélectionner un projet"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-white dark:bg-background">
                  <Command>
                    <CommandInput placeholder="Rechercher un projet..." />
                    <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-y-auto bg-[#ffffff]">
                      <CommandItem
                        onSelect={() => {
                          setSelectedProjectId("all");
                          setProjectSelectorOpen(false);
                        }}
                        data-testid="option-project-all"
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            selectedProjectId === "all" ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        Tous les projets
                      </CommandItem>
                      {projects.map((project) => (
                        <CommandItem
                          key={project.id}
                          onSelect={() => {
                            setSelectedProjectId(project.id);
                            setProjectSelectorOpen(false);
                          }}
                          data-testid={`option-project-${project.id}`}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedProjectId === project.id ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{project.name}</div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
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
            <div className="hidden md:flex border rounded-md">
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("kanban")}
                data-testid="button-view-kanban"
              >
                <Columns3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "calendar" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("calendar")}
                data-testid="button-view-calendar"
              >
                <CalendarLucide className="w-4 h-4" />
              </Button>
            </div>
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
                <span className="hidden sm:inline text-[12px]">Nouvelle Tâche</span>
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
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

        {/* Views */}
        {tasksLoading ? (
          <div className="text-center py-12">
            <Loader size="lg" />
          </div>
        ) : (
          <>
            {/* List View */}
            {viewMode === "list" && (
              <ListView
                tasks={filteredTasks}
                columns={taskColumns}
                users={users}
                projects={projects}
                onEditTask={handleTaskClick}
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
            )}

            {/* Calendar View */}
            {viewMode === "calendar" && (
              <CalendarView
                tasks={filteredTasks}
                onTaskClick={handleTaskClick}
              />
            )}
            
            {/* Kanban View */}
            {viewMode === "kanban" && (
              selectedProjectId === "all" ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center py-12">
                      <Columns3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">La vue Kanban nécessite la sélection d'un projet spécifique</p>
                      <p className="text-sm text-muted-foreground">Veuillez sélectionner un projet dans le menu déroulant ci-dessus</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
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
                                dropIndicator={dropIndicator}
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
              )
            )}
          </>
        )}

        {/* Create Task Sheet */}
        <Sheet open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
          <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col bg-[#ffffff]" data-testid="sheet-create-task">
            <SheetHeader>
              <SheetTitle>Nouvelle tâche</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 flex-1 py-4">
              <div>
                <Label>Projet</Label>
                <Popover open={projectComboboxOpen} onOpenChange={setProjectComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={projectComboboxOpen}
                      className="w-full justify-between"
                      data-testid="button-select-project"
                    >
                      {newTaskProjectId === "none"
                        ? "Aucun projet"
                        : newTaskProjectId
                        ? projects.find((p) => p.id === newTaskProjectId)?.name
                        : "Sélectionner un projet..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-white">
                    <Command>
                      <CommandInput placeholder="Rechercher un projet..." />
                      <CommandList>
                        <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="Aucun projet"
                            onSelect={() => {
                              setNewTaskProjectId("none");
                              setProjectComboboxOpen(false);
                              setCreateTaskColumnId(null);
                            }}
                            data-testid="project-option-none"
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                newTaskProjectId === "none" ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            Aucun projet
                          </CommandItem>
                          {projects.map((project) => (
                            <CommandItem
                              key={project.id}
                              value={project.name}
                              onSelect={() => {
                                setNewTaskProjectId(project.id);
                                setProjectComboboxOpen(false);
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
                    <SelectTrigger id="task-priority" className="bg-white" data-testid="select-new-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
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
                    <SelectTrigger id="task-assigned" className="bg-white" data-testid="select-new-task-assigned">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="unassigned">Non assigné</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Effort / Complexité</Label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setNewTaskEffort(rating)}
                      className="focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                      data-testid={`button-new-task-effort-${rating}`}
                    >
                      <Star
                        className={`h-6 w-6 transition-colors ${(newTaskEffort ?? 0) >= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-200'}`}
                      />
                    </button>
                  ))}
                  {newTaskEffort !== null && (
                    <button
                      type="button"
                      onClick={() => setNewTaskEffort(null)}
                      className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                      data-testid="button-clear-new-task-effort"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>
              <div>
                <Label>Colonne *</Label>
                <Popover open={columnComboboxOpen} onOpenChange={setColumnComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={columnComboboxOpen}
                      className="w-full justify-between"
                      data-testid="button-select-column"
                    >
                      {createTaskColumnId
                        ? (() => {
                            const columnsToDisplay = newTaskProjectId === "none" 
                              ? globalTaskColumns 
                              : (newTaskProjectId ? newTaskProjectColumns : taskColumns);
                            return columnsToDisplay.find((c) => c.id === createTaskColumnId)?.name;
                          })()
                        : "Sélectionner une colonne..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-white">
                    <Command>
                      <CommandInput placeholder="Rechercher une colonne..." />
                      <CommandList>
                        <CommandEmpty>Aucune colonne trouvée.</CommandEmpty>
                        <CommandGroup className="bg-[#ffffff]">
                          {(() => {
                            const columnsToDisplay = newTaskProjectId === "none" 
                              ? globalTaskColumns 
                              : (newTaskProjectId ? newTaskProjectColumns : taskColumns);
                            
                            // Remove duplicates by name - keep first occurrence
                            const uniqueColumns = new Map();
                            columnsToDisplay
                              .sort((a, b) => a.order - b.order)
                              .forEach((column) => {
                                if (!uniqueColumns.has(column.name)) {
                                  uniqueColumns.set(column.name, column);
                                }
                              });
                            
                            return Array.from(uniqueColumns.values()).map((column) => (
                              <CommandItem
                                key={column.id}
                                value={column.name}
                                onSelect={() => {
                                  setCreateTaskColumnId(column.id);
                                  setColumnComboboxOpen(false);
                                }}
                                data-testid={`column-option-${column.id}`}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    createTaskColumnId === column.id ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {column.name}
                              </CommandItem>
                            ));
                          })()}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                  <PopoverContent className="w-auto p-0 bg-white">
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
            <div className="flex gap-2 justify-end border-t pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateTaskDialogOpen(false);
                  setNewTaskTitle("");
                  setNewTaskDescription("");
                  setNewTaskPriority("medium");
                  setNewTaskAssignedTo(undefined);
                  setNewTaskDueDate(undefined);
                  setNewTaskEffort(null);
                  setNewTaskProjectId("");
                }}
                data-testid="button-cancel-create-task"
              >
                Annuler
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCreateTask(true)}
                disabled={!newTaskTitle.trim() || createTaskMutation.isPending}
                data-testid="button-create-and-add-task"
              >
                Créer et ajouter
              </Button>
              <Button
                onClick={() => handleCreateTask(false)}
                disabled={!newTaskTitle.trim() || createTaskMutation.isPending}
                data-testid="button-submit-create-task"
              >
                Créer
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Create Column Dialog */}
        <Dialog open={isCreateColumnDialogOpen} onOpenChange={setIsCreateColumnDialogOpen}>
          <DialogContent data-testid="dialog-create-column" className="bg-white">
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

        {/* Rename Column Dialog */}
        <Dialog open={isRenameColumnDialogOpen} onOpenChange={setIsRenameColumnDialogOpen}>
          <DialogContent data-testid="dialog-rename-column" className="bg-white">
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

        {/* Change Color Dialog */}
        <Dialog open={isColorColumnDialogOpen} onOpenChange={setIsColorColumnDialogOpen}>
          <DialogContent data-testid="dialog-color-column" className="bg-white">
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

        {/* Delete Column Dialog */}
        <AlertDialog open={isDeleteColumnDialogOpen} onOpenChange={setIsDeleteColumnDialogOpen}>
          <AlertDialogContent data-testid="dialog-delete-column" className="bg-white">
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

        {/* Delete Task Dialog */}
        <AlertDialog open={isDeleteTaskDialogOpen} onOpenChange={setIsDeleteTaskDialogOpen}>
          <AlertDialogContent data-testid="dialog-delete-task" className="bg-white">
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

        {/* Task Detail Modal */}
        {selectedTask && (
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
            onDelete={(task) => {
              setSelectedTask(task);
              setIsDeleteTaskDialogOpen(true);
            }}
          />
        )}
      </div>
    </div>
  );
}
