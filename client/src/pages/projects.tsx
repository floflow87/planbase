// Projects page with task management
import { useState, useEffect } from "react";
import { Plus, Filter, LayoutGrid, List, GripVertical, Edit, Trash2, CalendarIcon, Calendar as CalendarLucide, Check, ChevronsUpDown, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, AlertCircle, UserCheck, MoreVertical, Eye, CheckCircle, FolderInput, Star } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, formatDateForStorage } from "@/lib/queryClient";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  pointerWithin,
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
  Client,
  InsertTask,
  InsertTaskColumn,
} from "@shared/schema";
import { TaskCardMenu } from "@/components/TaskCardMenu";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { ColumnHeaderMenu } from "@/components/ColumnHeaderMenu";
import { ColorPicker } from "@/components/ColorPicker";
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

  // Make the column droppable for tasks
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-heading font-semibold">
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
        <CardContent className="flex-1 overflow-auto p-0">
          <div
            ref={setDroppableRef}
            className={`min-h-full p-4 transition-all ${
              isOver ? 'border-2 border-dashed border-primary bg-primary/5' : ''
            }`}
            style={{ minHeight: '400px' }}
          >
            <div className="space-y-2">
              <SortableContext
                items={sortedTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {sortedTasks.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
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
            </div>
          </div>
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
  projects: Project[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onUpdateTask: (taskId: string, data: Partial<Task>) => void;
  quickAddTaskTitle: string;
  setQuickAddTaskTitle: (value: string) => void;
  isQuickAddingTask: boolean;
  setIsQuickAddingTask: (value: boolean) => void;
  onCreateTask: (data: InsertTask) => void;
  selectedProjectId?: string;
  statusFilter: string;
  accountId?: string;
  userId?: string;
}

function ListView({ 
  tasks, 
  columns, 
  users, 
  projects, 
  onEditTask, 
  onDeleteTask, 
  onUpdateTask,
  quickAddTaskTitle,
  setQuickAddTaskTitle,
  isQuickAddingTask,
  setIsQuickAddingTask,
  onCreateTask,
  selectedProjectId,
  statusFilter,
  accountId,
  userId
}: ListViewProps) {
  const { toast } = useToast();
  const [columnOrder, setColumnOrder] = useState(() => {
    const saved = localStorage.getItem('taskListColumnOrder');
    return saved ? JSON.parse(saved) : [
      'checkbox',
      'title',
      'assignedTo',
      'status',
      'priority',
      'effort',
      'dueDate',
      'actions'
    ];
  });
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(() => {
    const saved = localStorage.getItem('projectsTasksSortConfig');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: string } | null>(null);
  const [isAttachToProjectDialogOpen, setIsAttachToProjectDialogOpen] = useState(false);
  const [attachProjectId, setAttachProjectId] = useState<string>("");
  
  // Pagination states
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('taskListPageSize');
    return saved ? parseInt(saved) : 20;
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Save pageSize to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('taskListPageSize', pageSize.toString());
  }, [pageSize]);

  // Save sortConfig to localStorage when it changes
  useEffect(() => {
    if (sortConfig) {
      localStorage.setItem('projectsTasksSortConfig', JSON.stringify(sortConfig));
    } else {
      localStorage.removeItem('projectsTasksSortConfig');
    }
  }, [sortConfig]);

  // Reset to page 1 when filters/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [sortConfig, selectedProjectId]);

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

    setColumnOrder((items: string[]) => {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      const newOrder = arrayMove(items, oldIndex, newIndex);
      localStorage.setItem('taskListColumnOrder', JSON.stringify(newOrder));
      return newOrder;
    });
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

  const getColumnName = (task: Task) => {
    const column = columns.find(c => c.id === task.columnId);
    return column?.name || "—";
  };

  const handleSort = (column: string) => {
    // Don't sort actions column
    if (column === 'actions') return;
    
    setSortConfig((current) => {
      if (current?.column === column) {
        // Toggle direction or clear
        if (current.direction === 'asc') {
          return { column, direction: 'desc' };
        }
        return null; // Clear sort
      }
      return { column, direction: 'asc' };
    });
  };

  const getSortedTasks = () => {
    // First, filter by selected project
    let filtered = tasks;
    if (selectedProjectId && selectedProjectId !== "all") {
      filtered = filtered.filter(task => task.projectId === selectedProjectId);
    }
    
    // Then filter by status
    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter(task => task.columnId === statusFilter);
    }
    
    if (!sortConfig) return filtered;

    const sorted = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.column) {
        case 'title':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'assignedTo':
          const userA = users.find(u => u.id === a.assignedToId);
          const userB = users.find(u => u.id === b.assignedToId);
          aValue = userA ? `${userA.firstName} ${userA.lastName}`.toLowerCase() : 'zzz'; // Non assigné à la fin
          bValue = userB ? `${userB.firstName} ${userB.lastName}`.toLowerCase() : 'zzz';
          break;
        case 'status':
          const colA = columns.find(c => c.id === a.columnId);
          const colB = columns.find(c => c.id === b.columnId);
          aValue = colA?.name?.toLowerCase() || '';
          bValue = colB?.name?.toLowerCase() || '';
          break;
        case 'priority':
          const priorityOrder = { high: 1, medium: 2, low: 3 };
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 999;
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 999;
          break;
        case 'dueDate':
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const getPaginatedTasks = () => {
    const sorted = getSortedTasks();
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sorted.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(getSortedTasks().length / pageSize);

  const columnHeaders = {
    checkbox: { label: '', id: 'checkbox' },
    title: { label: 'Tâche', id: 'title' },
    assignedTo: { label: 'Assigné à', id: 'assignedTo' },
    status: { label: 'Statut', id: 'status' },
    priority: { label: 'Priorité', id: 'priority' },
    effort: { label: 'Effort', id: 'effort' },
    dueDate: { label: 'Échéance', id: 'dueDate' },
    actions: { label: 'Actions', id: 'actions' },
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const toggleAllTasks = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map(t => t.id)));
    }
  };

  const handleBulkAction = async (action: 'complete' | 'urgent') => {
    const completedColumn = [...columns]
      .filter(c => c.isLocked)
      .sort((a, b) => b.order - a.order)[0];
    
    for (const taskId of Array.from(selectedTasks)) {
      if (action === 'complete' && completedColumn) {
        onUpdateTask(taskId, { columnId: completedColumn.id });
      } else if (action === 'urgent') {
        onUpdateTask(taskId, { priority: 'high' });
      }
    }
    setSelectedTasks(new Set());
  };

  const handleBulkAssign = async (userId: string) => {
    for (const taskId of Array.from(selectedTasks)) {
      onUpdateTask(taskId, { assignedToId: userId });
    }
    setSelectedTasks(new Set());
  };

  const handleBulkDelete = async () => {
    for (const taskId of Array.from(selectedTasks)) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        onDeleteTask(task);
      }
    }
    setSelectedTasks(new Set());
  };

  const handleBulkAttachToProject = async () => {
    if (!attachProjectId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un projet",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get the first column of the target project
      const projectColumns = columns.filter(c => c.projectId === attachProjectId);
      if (projectColumns.length === 0) {
        toast({
          title: "Erreur",
          description: "Le projet sélectionné n'a pas de colonnes",
          variant: "destructive",
        });
        return;
      }

      const firstColumn = projectColumns.sort((a, b) => a.order - b.order)[0];

      await apiRequest("/api/tasks/bulk-update-project", "PATCH", {
        taskIds: Array.from(selectedTasks),
        projectId: attachProjectId,
        newColumnId: firstColumn.id,
      });

      toast({
        title: "Succès",
        description: `${selectedTasks.size} tâche(s) rattachée(s) au projet`,
        variant: "success",
      });

      setSelectedTasks(new Set());
      setIsAttachToProjectDialogOpen(false);
      setAttachProjectId("");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de rattacher les tâches",
        variant: "destructive",
      });
    }
  };

  const SortableTableHeader = ({ columnId }: { columnId: string }) => {
    // Special handling for checkbox column
    if (columnId === 'checkbox') {
      return (
        <TableHead className="w-12">
          <input
            type="checkbox"
            checked={selectedTasks.size === tasks.length && tasks.length > 0}
            onChange={toggleAllTasks}
            className="cursor-pointer"
            data-testid="checkbox-select-all"
          />
        </TableHead>
      );
    }

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
    };

    const header = columnHeaders[columnId as keyof typeof columnHeaders];
    const isSortable = columnId !== 'actions' && columnId !== 'checkbox';
    const isSorted = sortConfig?.column === columnId;

    return (
      <TableHead
        ref={setNodeRef}
        style={style}
        {...attributes}
        className="font-semibold text-[11px] h-10"
        data-testid={`table-header-${columnId}`}
      >
        <div className="flex items-center gap-2">
          {/* Drag handle - only this part is draggable */}
          <button
            {...listeners}
            className="cursor-grab hover:bg-accent p-1 rounded"
            title="Glisser pour réorganiser"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </button>
          
          {/* Sortable label - clickable for sorting */}
          <div 
            className={`flex items-center gap-1 flex-1 ${isSortable ? 'cursor-pointer' : ''}`}
            onClick={() => isSortable && handleSort(columnId)}
          >
            {header.label}
            {isSortable && (
              <span className="ml-1">
                {!isSorted && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                {isSorted && sortConfig.direction === 'asc' && <ArrowUp className="h-3 w-3 text-foreground" />}
                {isSorted && sortConfig.direction === 'desc' && <ArrowDown className="h-3 w-3 text-foreground" />}
              </span>
            )}
          </div>
        </div>
      </TableHead>
    );
  };

  return (
    <div className="space-y-4">
      {selectedTasks.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-accent rounded-md">
          <span className="text-xs font-medium">
            {selectedTasks.size} tâche{selectedTasks.size > 1 ? 's' : ''} sélectionnée{selectedTasks.size > 1 ? 's' : ''}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" data-testid="button-bulk-actions">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-white">
              <DropdownMenuItem onClick={() => handleBulkAction('complete')}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Marquer comme terminé
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkAction('urgent')}>
                <AlertCircle className="h-4 w-4 mr-2" />
                Marquer comme urgent
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Changer l'assignation
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-white">
                  {users.map(user => (
                    <DropdownMenuItem 
                      key={user.id}
                      onClick={() => handleBulkAssign(user.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatarUrl || ""} />
                          <AvatarFallback className="text-[10px]">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">
                          {user.firstName} {user.lastName}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setIsAttachToProjectDialogOpen(true)}
                data-testid="button-bulk-attach-project"
              >
                <FolderInput className="h-4 w-4 mr-2" />
                Rattacher à un projet
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive"
                onClick={handleBulkDelete}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <SortableContext items={columnOrder}>
                {columnOrder.map((columnId: string) => (
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
              getPaginatedTasks().map((task) => {
                const assignedUser = users.find((u) => u.id === task.assignedToId);
                const taskColumn = columns.find(c => c.id === task.columnId);
                const isEditing = editingCell?.taskId === task.id;
                
                return (
                  <TableRow key={task.id} className="h-12" data-testid={`table-row-${task.id}`}>
                    {columnOrder.map((columnId: string) => {
                      switch (columnId) {
                        case 'checkbox':
                          return (
                            <TableCell key={columnId} className="w-12">
                              <input
                                type="checkbox"
                                checked={selectedTasks.has(task.id)}
                                onChange={() => toggleTaskSelection(task.id)}
                                className="cursor-pointer"
                                data-testid={`checkbox-task-${task.id}`}
                              />
                            </TableCell>
                          );
                        case 'title':
                          return (
                            <TableCell 
                              key={columnId} 
                              className="font-medium cursor-pointer hover:text-primary text-[11px]"
                              onClick={() => onEditTask(task)}
                              data-testid={`cell-title-${task.id}`}
                            >
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
                                    <AvatarFallback className="text-[10px]">
                                      {assignedUser.firstName?.[0]}
                                      {assignedUser.lastName?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-[11px]">
                                    {assignedUser.firstName} {assignedUser.lastName}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">Non assigné</span>
                              )}
                            </TableCell>
                          );
                        case 'status':
                          return (
                            <TableCell key={columnId}>
                              <Popover
                                open={isEditing && editingCell.field === 'status'}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setEditingCell({ taskId: task.id, field: 'status' });
                                  } else {
                                    setEditingCell(null);
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <Badge 
                                    style={{ backgroundColor: taskColumn?.color || 'transparent' }}
                                    className="text-foreground text-[10px] min-w-[80px] cursor-pointer hover-elevate"
                                    data-testid={`badge-status-${task.id}`}
                                  >
                                    {taskColumn?.name || '—'}
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2 bg-white">
                                  <div className="space-y-1">
                                    {(() => {
                                      // Only show columns from the task's project to prevent cross-project moves
                                      const taskProjectColumns = columns
                                        .filter(col => col.projectId === task.projectId)
                                        .sort((a, b) => a.order - b.order);
                                      
                                      return taskProjectColumns.map(col => (
                                        <button
                                          key={col.id}
                                          onClick={() => {
                                            const tasksInNewColumn = tasks.filter(t => t.columnId === col.id);
                                            const maxPosition = tasksInNewColumn.length > 0
                                              ? Math.max(...tasksInNewColumn.map(t => t.positionInColumn))
                                              : -1;
                                            onUpdateTask(task.id, {
                                              columnId: col.id,
                                              positionInColumn: maxPosition + 1,
                                            });
                                            setEditingCell(null);
                                          }}
                                          className="w-full text-left px-3 py-2 rounded hover-elevate flex items-center gap-2"
                                        >
                                          <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: col.color }}
                                          />
                                          <span className="text-xs">{col.name}</span>
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                          );
                        case 'priority':
                          return (
                            <TableCell key={columnId}>
                              <Popover
                                open={isEditing && editingCell.field === 'priority'}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setEditingCell({ taskId: task.id, field: 'priority' });
                                  } else {
                                    setEditingCell(null);
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <Badge 
                                    className={`text-[10px] cursor-pointer hover-elevate ${getPriorityColor(task.priority)}`}
                                    data-testid={`badge-priority-${task.id}`}
                                  >
                                    {getPriorityLabel(task.priority)}
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-40 p-2 bg-white">
                                  <div className="space-y-1">
                                    {[
                                      { value: 'high', label: 'Urgent', color: 'bg-red-100 text-red-700' },
                                      { value: 'medium', label: 'Moyen', color: 'bg-yellow-100 text-yellow-700' },
                                      { value: 'low', label: 'Faible', color: 'bg-green-100 text-green-700' },
                                    ].map(priority => (
                                      <button
                                        key={priority.value}
                                        onClick={() => {
                                          onUpdateTask(task.id, { priority: priority.value });
                                          setEditingCell(null);
                                        }}
                                        className="w-full text-left px-3 py-2 rounded hover-elevate"
                                      >
                                        <Badge className={`text-[10px] ${priority.color}`}>
                                          {priority.label}
                                        </Badge>
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                          );
                        case 'effort':
                          return (
                            <TableCell key={columnId}>
                              <div className="flex items-center gap-0.5" data-testid={`stars-effort-${task.id}`}>
                                {[1, 2, 3, 4, 5].map(star => (
                                  <Star
                                    key={star}
                                    className={`h-4 w-4 cursor-pointer transition-colors ${(task.effort ?? 0) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-200'}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateTask(task.id, { effort: star } as any);
                                    }}
                                    data-testid={`star-${star}-task-${task.id}`}
                                  />
                                ))}
                              </div>
                            </TableCell>
                          );
                        case 'dueDate':
                          return (
                            <TableCell key={columnId}>
                              <Popover
                                open={isEditing && editingCell.field === 'dueDate'}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setEditingCell({ taskId: task.id, field: 'dueDate' });
                                  } else {
                                    setEditingCell(null);
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] cursor-pointer hover-elevate min-w-[100px]"
                                    data-testid={`badge-due-date-${task.id}`}
                                  >
                                    {task.dueDate 
                                      ? formatDate(new Date(task.dueDate), 'dd MMM yyyy', { locale: fr })
                                      : '—'
                                    }
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-white" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={task.dueDate ? new Date(task.dueDate) : undefined}
                                    onSelect={(date) => {
                                      onUpdateTask(task.id, { 
                                        dueDate: date ? formatDateForStorage(date) : null 
                                      } as any);
                                      setEditingCell(null);
                                    }}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                          );
                        case 'actions':
                          return (
                            <TableCell key={columnId}>
                              <div className="flex items-center gap-2">
                                {task.status === "done" ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground cursor-default"
                                    disabled
                                    data-testid={`button-complete-task-${task.id}`}
                                    title="Terminée"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-green-600 hover:text-green-700"
                                    onClick={() => {
                                      // Find the "done" column
                                      const doneColumn = columns.find(c => 
                                        c.name.toLowerCase().includes("terminé") || 
                                        c.name.toLowerCase().includes("done") || 
                                        c.name.toLowerCase().includes("complété")
                                      );
                                      
                                      // Update status and move to done column if found
                                      onUpdateTask(task.id, { 
                                        status: "done",
                                        ...(doneColumn && { columnId: doneColumn.id })
                                      } as any);
                                    }}
                                    data-testid={`button-complete-task-${task.id}`}
                                    title="Marquer comme terminée"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
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
            {/* Quick add task row */}
            <TableRow className="h-12">
              {columnOrder.map((columnId: string) => {
                if (columnId === 'title') {
                  return (
                    <TableCell key={columnId} colSpan={columnOrder.length}>
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Nouvelle tâche..."
                          value={quickAddTaskTitle}
                          onChange={(e) => setQuickAddTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && quickAddTaskTitle.trim()) {
                              setIsQuickAddingTask(true);
                              const firstColumn = columns.find(c => c.name.toLowerCase().includes("à faire")) || columns[0];
                              onCreateTask({
                                title: quickAddTaskTitle.trim(),
                                description: "",
                                status: "todo",
                                priority: "medium",
                                projectId: selectedProjectId && selectedProjectId !== "all" ? selectedProjectId : undefined,
                                columnId: firstColumn?.id,
                                positionInColumn: tasks.filter(t => t.columnId === firstColumn?.id).length,
                                accountId: accountId!,
                                createdBy: userId!,
                              });
                            } else if (e.key === "Escape") {
                              setQuickAddTaskTitle("");
                            }
                          }}
                          disabled={isQuickAddingTask}
                          className="border-0 focus-visible:ring-0 text-[11px] h-8"
                          data-testid="input-quick-add-task"
                        />
                      </div>
                    </TableCell>
                  );
                }
                return null;
              })}
            </TableRow>
          </TableBody>
        </Table>
      </DndContext>
            </div>
          </CardContent>
        </Card>

      {/* Pagination */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Lignes par page:
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(parseInt(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-20 h-8 text-xs bg-white" data-testid="select-page-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {tasks.length} tâche{tasks.length > 1 ? 's' : ''} au total
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Page {currentPage} sur {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                data-testid="button-first-page"
              >
                Première
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                data-testid="button-prev-page"
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                Suivant
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                data-testid="button-last-page"
              >
                Dernière
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogue de rattachement à un projet */}
      <Dialog open={isAttachToProjectDialogOpen} onOpenChange={setIsAttachToProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rattacher les tâches à un projet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Projet de destination</Label>
              <Select value={attachProjectId} onValueChange={setAttachProjectId}>
                <SelectTrigger data-testid="select-attach-project">
                  <SelectValue placeholder="Sélectionner un projet" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAttachToProjectDialogOpen(false);
                setAttachProjectId("");
              }}
              data-testid="button-cancel-attach"
            >
              Annuler
            </Button>
            <Button onClick={handleBulkAttachToProject} data-testid="button-confirm-attach">
              Rattacher {selectedTasks.size} tâche{selectedTasks.size > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    );
  }

// Sortable project column header component with sorting
interface SortableProjectColumnHeaderProps {
  id: string;
  label: string;
  className?: string;
  isDraggable?: boolean;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (columnId: string) => void;
  isSortable?: boolean;
}

function SortableProjectColumnHeader({ 
  id, 
  label, 
  className, 
  isDraggable = true,
  sortColumn,
  sortDirection,
  onSort,
  isSortable = true
}: SortableProjectColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isActive = sortColumn === id;

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={`text-[11px] h-10 ${isDraggable ? 'cursor-move' : ''} ${className || ''}`}
    >
      <div className="flex items-center gap-2">
        {isDraggable && (
          <GripVertical className="h-3 w-3 text-muted-foreground" {...attributes} {...listeners} />
        )}
        <span>{label}</span>
        {isSortable && onSort && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onSort(id);
            }}
            className="p-0.5 hover:bg-muted rounded"
            data-testid={`sort-${id}`}
          >
            {isActive ? (
              sortDirection === "asc" ? (
                <ArrowUp className="h-3 w-3 text-primary" />
              ) : (
                <ArrowDown className="h-3 w-3 text-primary" />
              )
            ) : (
              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    </TableHead>
  );
}

// Kanban Stage Column Component
interface KanbanStageColumnProps {
  stage: { value: string; label: string; color: string };
  projects: Project[];
  clients: Client[];
  tasks: Task[];
  taskColumns: TaskColumn[];
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onCompleteProject: (project: Project) => void;
}

function KanbanStageColumn({
  stage,
  projects,
  clients,
  tasks,
  taskColumns,
  onEditProject,
  onDeleteProject,
  onCompleteProject,
}: KanbanStageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.value,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border ${stage.color} ${isOver ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <h3 className="font-medium text-sm">{stage.label}</h3>
        <Badge variant="secondary" className="text-xs">
          {projects.length}
        </Badge>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
        <SortableContext
          items={projects.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {projects.map((project) => (
            <DraggableProjectCard
              key={project.id}
              project={project}
              client={clients.find(c => c.id === project.clientId)}
              tasks={tasks}
              taskColumns={taskColumns}
              onEdit={() => onEditProject(project)}
              onDelete={() => onDeleteProject(project)}
              onComplete={() => onCompleteProject(project)}
            />
          ))}
        </SortableContext>
        {projects.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground italic">
            Aucun projet
          </div>
        )}
      </div>
    </div>
  );
}

// Draggable Project Card for Kanban
interface DraggableProjectCardProps {
  project: Project;
  client?: Client;
  tasks: Task[];
  taskColumns: TaskColumn[];
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
}

function DraggableProjectCard({
  project,
  client,
  tasks,
  taskColumns,
  onEdit,
  onDelete,
  onComplete,
}: DraggableProjectCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Calculate incomplete tasks
  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const completedColumn = taskColumns
    .filter(c => c.isLocked && c.projectId === project.id)
    .sort((a, b) => b.order - a.order)[0];
  const incompleteTasks = projectTasks.filter(t => 
    !completedColumn || t.columnId !== completedColumn.id
  ).length;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`hover-elevate active-elevate-2 bg-white dark:bg-background cursor-grab ${isDragging ? 'shadow-lg' : ''}`}
      {...attributes}
      {...listeners}
      data-testid={`kanban-project-card-${project.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link href={`/projects/${project.id}`}>
              <h4 className="font-medium text-xs truncate hover:text-primary cursor-pointer transition-colors">
                {project.name}
              </h4>
            </Link>
            {client && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {client.name}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 flex-shrink-0"
                data-testid={`button-kanban-project-menu-${project.id}`}
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-3 w-3 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onComplete}>
                <CheckCircle className="h-3 w-3 mr-2" />
                Terminé
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {incompleteTasks > 0 && (
          <Badge variant="secondary" className="text-[10px] mt-2">
            {incompleteTasks} tâche{incompleteTasks > 1 ? 's' : ''}
          </Badge>
        )}
        
        {project.budget && (
          <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <span className="font-medium text-foreground">
              {parseFloat(project.budget).toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
                minimumFractionDigits: 0,
              })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  categories: { id: string; name: string }[];
}

function CategoryCombobox({ value, onChange, categories }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const handleCreateCategory = async () => {
    const trimmedValue = searchValue.trim();
    if (!trimmedValue) return;

    try {
      await apiRequest('/api/project-categories', 'POST', { name: trimmedValue });
      queryClient.invalidateQueries({ queryKey: ['/api/project-categories'] });
      onChange(trimmedValue);
      setOpen(false);
      setSearchValue("");
    } catch (error: any) {
      console.error('Error creating category:', error);
    }
  };

  const filteredCategories = categories
    .filter((cat) => 
      cat.name.toLowerCase().includes(searchValue.toLowerCase())
    )
    .slice(0, 4);
  
  // Ensure currently selected category is always included
  if (value && !filteredCategories.some(cat => cat.name === value)) {
    const selectedCategory = categories.find(cat => cat.name === value);
    if (selectedCategory) {
      filteredCategories.unshift(selectedCategory);
      // Only remove the last item if we now have more than 4
      if (filteredCategories.length > 4) {
        filteredCategories.pop();
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-[12px] h-9"
          data-testid="button-category-selector"
        >
          {value || "Sélectionnez une catégorie..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Rechercher ou créer..." 
            value={searchValue}
            onValueChange={setSearchValue}
            data-testid="input-category-search"
          />
          <CommandList>
            <CommandEmpty>
              {searchValue.trim() && (
                <button
                  className="w-full text-sm py-2 px-4 hover-elevate active-elevate-2 rounded-sm text-left"
                  onClick={handleCreateCategory}
                  data-testid="button-create-category"
                >
                  Créer "{searchValue.trim()}"
                </button>
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredCategories.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.name}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                    setSearchValue("");
                  }}
                  data-testid={`option-category-${cat.name}`}
                >
                  <Check
                    className={value === cat.name ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"}
                  />
                  {cat.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function Projects() {
  const [, setLocation] = useLocation();
  const accountId = localStorage.getItem("demo_account_id");
  const userId = localStorage.getItem("demo_user_id");
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<"kanban" | "list">("list");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ columnId: string; position: 'before' | 'after' } | null>(null);

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

  // Project states
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [isEditProjectDialogOpen, setIsEditProjectDialogOpen] = useState(false);
  const [isDeleteProjectDialogOpen, setIsDeleteProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
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
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [projectStageFilters, setProjectStageFilters] = useState<string[]>(() => {
    const saved = localStorage.getItem('projectStageFilters');
    return saved ? JSON.parse(saved) : [];
  });
  const [projectViewMode, setProjectViewMode] = useState<"grid" | "list" | "kanban">("list");
  
  // Sorting state with localStorage persistence
  const [projectSortColumn, setProjectSortColumn] = useState<string>(() => {
    const saved = localStorage.getItem('projectSortColumn');
    return saved || "name";
  });
  const [projectSortDirection, setProjectSortDirection] = useState<"asc" | "desc">(() => {
    const saved = localStorage.getItem('projectSortDirection');
    return (saved as "asc" | "desc") || "asc";
  });
  
  // Project pagination states
  const [projectPageSize, setProjectPageSize] = useState(() => {
    const saved = localStorage.getItem('projectListPageSize');
    return saved ? parseInt(saved) : 20;
  });
  const [projectCurrentPage, setProjectCurrentPage] = useState(1);

  // Save projectPageSize to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('projectListPageSize', projectPageSize.toString());
  }, [projectPageSize]);

  // Save stage filters to localStorage when they change
  useEffect(() => {
    localStorage.setItem('projectStageFilters', JSON.stringify(projectStageFilters));
  }, [projectStageFilters]);

  // Save sort settings to localStorage
  useEffect(() => {
    localStorage.setItem('projectSortColumn', projectSortColumn);
  }, [projectSortColumn]);
  
  useEffect(() => {
    localStorage.setItem('projectSortDirection', projectSortDirection);
  }, [projectSortDirection]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setProjectCurrentPage(1);
  }, [projectSearchQuery, projectStageFilters]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  
  // Column order state for project list view
  const defaultColumnOrder = ["name", "client", "stage", "progress", "category", "startDate", "budget", "actions"];
  const [projectColumnOrder, setProjectColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem("projectColumnOrder");
    return saved ? JSON.parse(saved) : defaultColumnOrder;
  });
  const [activeProjectColumnId, setActiveProjectColumnId] = useState<string | null>(null);
  
  // Inline category editing
  const [editingCategoryProjectId, setEditingCategoryProjectId] = useState<string | null>(null);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  
  // Inline stage editing
  const [editingStageProjectId, setEditingStageProjectId] = useState<string | null>(null);
  const [stagePopoverOpen, setStagePopoverOpen] = useState(false);
  
  // Inline date editing
  const [editingStartDateProjectId, setEditingStartDateProjectId] = useState<string | null>(null);
  const [startDatePopoverOpen, setStartDatePopoverOpen] = useState(false);
  
  // Inline budget editing
  const [editingBudgetProjectId, setEditingBudgetProjectId] = useState<string | null>(null);
  const [tempBudgetValue, setTempBudgetValue] = useState("");

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState<string | undefined>(userId || undefined);
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>();
  const [newTaskEffort, setNewTaskEffort] = useState<number | null>(null);
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>("");
  const [projectComboboxOpen, setProjectComboboxOpen] = useState(false);
  const [columnComboboxOpen, setColumnComboboxOpen] = useState(false);
  const [editClientComboboxOpen, setEditClientComboboxOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [renameColumnName, setRenameColumnName] = useState("");
  const [columnColor, setColumnColor] = useState("rgba(229, 231, 235, 0.4)");
  
  // Quick add task states
  const [quickAddTaskTitle, setQuickAddTaskTitle] = useState("");
  const [isQuickAddingTask, setIsQuickAddingTask] = useState(false);
  
  // Quick add project states
  const [quickAddProjectName, setQuickAddProjectName] = useState("");
  const [isQuickAddingProject, setIsQuickAddingProject] = useState(false);

  // Check for tab query parameter - default to projects instead of tasks
  const [activeTab, setActiveTab] = useState<string>("projects");

  // Update activeTab when URL changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/accounts", accountId, "users"],
    enabled: !!accountId,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  
  const { data: projectCategories = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/project-categories"],
  });
  
  // Get unique categories and recent ones (after projects is declared)
  const uniqueCategories = Array.from(new Set(
    projects
      .filter(p => p.category && p.category.trim())
      .map(p => p.category!)
  )).sort();
  
  const recentCategories = projects
    .filter(p => p.category && p.category.trim())
    .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
    .map(p => p.category!)
    .filter((cat, index, self) => self.indexOf(cat) === index)
    .slice(0, 5);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const { data: taskColumns = [], isLoading: columnsLoading } = useQuery<TaskColumn[]>({
    queryKey: selectedProjectId === "all" 
      ? ["/api/task-columns"]
      : ["/api/projects", selectedProjectId, "task-columns"],
    enabled: !!selectedProjectId,
  });

  // Fetch global columns (for tasks without a project)
  const { data: globalTaskColumns = [] } = useQuery<TaskColumn[]>({
    queryKey: ["/api/task-columns/global"],
    enabled: isCreateTaskDialogOpen,
  });

  // Fetch columns for the project selected in task creation form
  const { data: newTaskProjectColumns = [] } = useQuery<TaskColumn[]>({
    queryKey: ["/api/projects", newTaskProjectId, "task-columns"],
    enabled: !!newTaskProjectId && newTaskProjectId !== "none" && isCreateTaskDialogOpen,
  });

  // Auto-select first column when project changes in task creation form
  useEffect(() => {
    if (!isCreateTaskDialogOpen) return;
    
    const columnsToUse = newTaskProjectId === "none" ? globalTaskColumns : newTaskProjectColumns;
    if (columnsToUse.length > 0 && !createTaskColumnId) {
      const sortedColumns = [...columnsToUse].sort((a, b) => a.order - b.order);
      setCreateTaskColumnId(sortedColumns[0].id);
    }
  }, [newTaskProjectId, newTaskProjectColumns, globalTaskColumns, isCreateTaskDialogOpen, createTaskColumnId]);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: selectedProjectId === "all" ? ["/api/tasks"] : ["/api/projects", selectedProjectId, "tasks"],
    enabled: !!selectedProjectId,
  });

  // Load all tasks for projects view to calculate progress
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: activeTab === "projects",
  });

  // Load all task columns for projects view to check "done" columns
  const { data: allTaskColumns = [] } = useQuery<TaskColumn[]>({
    queryKey: ["/api/task-columns"],
    enabled: activeTab === "projects",
  });

  const sortedColumns = [...taskColumns].sort((a, b) => a.order - b.order);

  // Calculate project progress based on completed tasks
  const calculateProjectProgress = (projectId: string): number => {
    const projectTasks = allTasks.filter(t => t.projectId === projectId);
    if (projectTasks.length === 0) return 0;
    
    const completedTasks = projectTasks.filter(t => {
      // Check if task status is "done"
      if (t.status === "done") return true;
      
      // Check if task is in a column named "terminé" or "done"
      if (t.columnId) {
        const column = allTaskColumns.find(c => c.id === t.columnId);
        if (column && (column.name.toLowerCase() === "terminé" || column.name.toLowerCase() === "done")) {
          return true;
        }
      }
      
      return false;
    }).length;
    
    return Math.round((completedTasks / projectTasks.length) * 100);
  };

  const createTaskMutation = useMutation({
    mutationFn: async (data: InsertTask & { keepOpen?: boolean }) => {
      const { keepOpen, ...taskData } = data;
      const response = await apiRequest("/api/tasks", "POST", taskData);
      return { data: await response.json(), keepOpen };
    },
    onSuccess: (result, variables) => {
      // Invalidate tasks for the project where the task was created
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.projectId, "tasks"] });
      // Also invalidate current project if different
      if (variables.projectId !== selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "tasks"] });
      }
      // Invalidate aggregated tasks for "all projects" view
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      
      // Reset form
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
      setNewTaskAssignedTo(userId || undefined);
      setNewTaskDueDate(undefined);
      setNewTaskEffort(null);
      
      // Only close dialog and reset project/column if not keeping it open
      if (!result.keepOpen) {
        setIsCreateTaskDialogOpen(false);
        setNewTaskProjectId("");
        setCreateTaskColumnId(null);
      }
      
      toast({ title: "Tâche créée avec succès", variant: "success" });
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
      const response = await apiRequest(`/api/tasks/${id}`, "PATCH", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Tâche mise à jour", variant: "success" });
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
      const response = await apiRequest(`/api/tasks/${taskId}/duplicate`, "POST", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Tâche dupliquée avec succès", variant: "success" });
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
      const response = await apiRequest(`/api/tasks/${taskId}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsDeleteTaskDialogOpen(false);
      setSelectedTask(null);
      toast({ title: "Tâche supprimée", variant: "success" });
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
      const response = await apiRequest("/api/tasks/bulk-update-positions", "PATCH", { updates });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Tâche déplacée",
        description: "La position de la tâche a été mise à jour avec succès.",
        variant: "success",
      });
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
      const response = await apiRequest("/api/task-columns", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "task-columns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-columns"] });
      setIsCreateColumnDialogOpen(false);
      setNewColumnName("");
      toast({ title: "Colonne créée avec succès", variant: "success" });
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
      const response = await apiRequest(`/api/task-columns/${id}`, "PATCH", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "task-columns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-columns"] });
      setIsRenameColumnDialogOpen(false);
      setIsColorColumnDialogOpen(false);
      setSelectedColumn(null);
      toast({ title: "Colonne mise à jour", variant: "success" });
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
      const response = await apiRequest(`/api/task-columns/${columnId}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "task-columns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-columns"] });
      setIsDeleteColumnDialogOpen(false);
      setSelectedColumn(null);
      toast({ title: "Colonne supprimée", variant: "success" });
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
      // Map columnIds to { id, order } format expected by backend
      const columnOrders = columnIds.map((id, index) => ({ id, order: index }));
      const response = await apiRequest(
        `/api/projects/${selectedProjectId}/task-columns/reorder`,
        "PATCH",
        { columnOrders }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "task-columns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-columns"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors du réordonnancement",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/projects", "POST", data);
      return response.json();
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
    onError: (error: Error) => {
      toast({
        title: "Erreur lors de la création",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // Auto-set progress to 100% when stage is "termine"
      if (data.stage === "termine" && data.progress === undefined) {
        data.progress = 100;
      }
      const response = await apiRequest(`/api/projects/${id}`, "PATCH", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsEditProjectDialogOpen(false);
      setEditingProject(null);
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
      toast({ title: "Projet mis à jour avec succès", variant: "success" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors de la mise à jour",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest(`/api/projects/${projectId}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsDeleteProjectDialogOpen(false);
      setEditingProject(null);
      toast({ title: "Projet supprimé avec succès", variant: "success" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors de la suppression",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handlers for project column drag and drop
  const handleProjectColumnDragStart = (event: DragStartEvent) => {
    setActiveProjectColumnId(event.active.id as string);
  };

  const handleProjectColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveProjectColumnId(null);

    if (!over || active.id === over.id || active.id === "actions" || over.id === "actions") {
      return;
    }

    const oldIndex = projectColumnOrder.indexOf(active.id as string);
    const newIndex = projectColumnOrder.indexOf(over.id as string);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(projectColumnOrder, oldIndex, newIndex);
      setProjectColumnOrder(newOrder);
      localStorage.setItem("projectColumnOrder", JSON.stringify(newOrder));
    }
  };

  // Project selection handlers
  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const toggleAllProjects = (filteredProjects: any[]) => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
    }
  };

  const handleBulkDeleteProjects = async () => {
    for (const projectId of Array.from(selectedProjects)) {
      await deleteProjectMutation.mutateAsync(projectId);
    }
    setSelectedProjects(new Set());
    toast({ 
      title: `${selectedProjects.size} projet(s) supprimé(s)`, 
      variant: "success" 
    });
  };

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

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    
    // Only show indicators when dragging columns, not tasks
    if (!activeColumnId || !over) {
      setDropIndicator(null);
      return;
    }

    // Check if over a column
    const overColumn = taskColumns.find(c => c.id === over.id);
    if (!overColumn || overColumn.id === active.id) {
      setDropIndicator(null);
      return;
    }

    // Determine if we should show indicator before or after
    const columns = [...taskColumns].sort((a, b) => a.order - b.order);
    const activeIndex = columns.findIndex(c => c.id === active.id);
    const overIndex = columns.findIndex(c => c.id === over.id);
    
    setDropIndicator({
      columnId: over.id,
      position: activeIndex < overIndex ? 'after' : 'before'
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);
    setActiveColumnId(null);
    setDropIndicator(null);

    if (!over) {
      return;
    }

    const draggedTask = tasks.find((t) => t.id === active.id);
    const draggedColumn = taskColumns.find((c) => c.id === active.id);

    if (draggedTask) {
      // Check if dropped on a droppable column zone
      const isDroppableZone = over.id.toString().startsWith('droppable-');
      const overColumn = isDroppableZone 
        ? taskColumns.find((c) => `droppable-${c.id}` === over.id)
        : taskColumns.find((c) => c.id === over.id);
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

  const handleCreateTask = (keepOpen = false) => {
    if (!newTaskTitle.trim() || !accountId || !userId) return;

    // Determine which columns to use
    let targetColumns: TaskColumn[];
    if (newTaskProjectId === "none") {
      // Use global columns for tasks without a project
      targetColumns = globalTaskColumns;
    } else if (newTaskProjectId && newTaskProjectId !== selectedProjectId) {
      // Use columns from the selected project in form
      targetColumns = newTaskProjectColumns;
    } else {
      // Use columns from currently selected project
      targetColumns = taskColumns;
    }
    
    // Use createTaskColumnId if set, otherwise use first column (sorted by order)
    const sortedTargetColumns = [...targetColumns].sort((a, b) => a.order - b.order);
    const targetColumnId = createTaskColumnId || sortedTargetColumns[0]?.id;
    
    if (!targetColumnId) {
      toast({ title: "Erreur: Aucune colonne trouvée", variant: "destructive" });
      return;
    }

    // Find the target column to derive status from its name
    const targetColumn = targetColumns.find((c) => c.id === targetColumnId);
    const taskStatus = targetColumn ? getStatusFromColumnName(targetColumn.name) : "todo";

    // Calculate position - fetch tasks from the target project if different
    // For tasks without a project, projectId will be null
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

  const handleQuickCreateTask = (data: InsertTask) => {
    createTaskMutation.mutate(data, {
      onSuccess: () => {
        setQuickAddTaskTitle("");
        setIsQuickAddingTask(false);
      },
      onError: () => {
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
    
    // Fix date format if dueDate is provided (only if it's a Date object, not a string)
    const updatedData = { ...data };
    if (updatedData.dueDate && typeof updatedData.dueDate !== 'string') {
      updatedData.dueDate = formatDateForStorage(updatedData.dueDate as Date) as any;
    }
    // If it's already a string, it's in the correct format, no need to transform
    
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
        <Loader size="lg" />
      </div>
    );
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-4">
        {/* Projects View Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  placeholder="Rechercher des projets..."
                  className="max-w-sm"
                  data-testid="input-search-projects"
                  value={projectSearchQuery}
                  onChange={(e) => setProjectSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-between bg-white dark:bg-background" data-testid="select-project-stage-filter">
                      <span className="truncate">
                        {projectStageFilters.length === 0 
                          ? "Toutes les étapes" 
                          : projectStageFilters.length === 1 
                            ? [
                                { value: "prospection", label: "Prospection" },
                                { value: "signe", label: "Signé" },
                                { value: "en_cours", label: "En cours" },
                                { value: "termine", label: "Terminé" }
                              ].find(s => s.value === projectStageFilters[0])?.label
                            : `${projectStageFilters.length} étapes`
                        }
                      </span>
                      <Filter className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-2 bg-white" align="end">
                    <div className="space-y-2">
                      {[
                        { value: "prospection", label: "Prospection" },
                        { value: "signe", label: "Signé" },
                        { value: "en_cours", label: "En cours" },
                        { value: "termine", label: "Terminé" }
                      ].map((stage) => (
                        <div 
                          key={stage.value} 
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover-elevate cursor-pointer"
                          onClick={() => {
                            setProjectStageFilters(prev => 
                              prev.includes(stage.value)
                                ? prev.filter(s => s !== stage.value)
                                : [...prev, stage.value]
                            );
                          }}
                        >
                          <Checkbox 
                            checked={projectStageFilters.includes(stage.value)}
                            data-testid={`checkbox-stage-${stage.value}`}
                          />
                          <span className="text-sm">{stage.label}</span>
                        </div>
                      ))}
                      {projectStageFilters.length > 0 && (
                        <div className="border-t pt-2 mt-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-xs"
                            onClick={() => setProjectStageFilters([])}
                            data-testid="button-clear-filters"
                          >
                            Effacer les filtres
                          </Button>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="flex border rounded-md">
                  <Button
                    variant={projectViewMode === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setProjectViewMode("grid")}
                    data-testid="button-project-view-grid"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={projectViewMode === "list" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setProjectViewMode("list")}
                    data-testid="button-project-view-list"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={projectViewMode === "kanban" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setProjectViewMode("kanban")}
                    data-testid="button-project-view-kanban"
                  >
                    <LayoutGrid className="w-4 h-4 rotate-90" />
                  </Button>
                </div>
                <Button 
                  data-testid="button-create-project"
                  onClick={() => {
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
                    setIsCreateProjectDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline text-[12px]">Nouveau projet</span>
                </Button>
              </div>
            </div>

            {/* Projects Grid */}
            {(() => {
              // Handle column sort
              const handleSort = (columnId: string) => {
                if (projectSortColumn === columnId) {
                  setProjectSortDirection(projectSortDirection === "asc" ? "desc" : "asc");
                } else {
                  setProjectSortColumn(columnId);
                  setProjectSortDirection("asc");
                }
              };

              // Filter projects based on search and stage
              const filteredProjects = projects.filter((project) => {
                const matchesSearch = projectSearchQuery === "" || 
                  project.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                  project.description?.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                  project.category?.toLowerCase().includes(projectSearchQuery.toLowerCase());
                
                const matchesStage = projectStageFilters.length === 0 || projectStageFilters.includes(project.stage || "");
                
                return matchesSearch && matchesStage;
              });

              // Sort filtered projects
              const sortedProjects = [...filteredProjects].sort((a, b) => {
                let comparison = 0;
                
                switch (projectSortColumn) {
                  case "name":
                    comparison = (a.name || "").localeCompare(b.name || "");
                    break;
                  case "client":
                    const clientA = clients.find(c => c.id === a.clientId)?.name || "";
                    const clientB = clients.find(c => c.id === b.clientId)?.name || "";
                    comparison = clientA.localeCompare(clientB);
                    break;
                  case "stage":
                    const stageOrder = { prospection: 0, signe: 1, en_cours: 2, termine: 3 };
                    comparison = (stageOrder[a.stage as keyof typeof stageOrder] || 0) - (stageOrder[b.stage as keyof typeof stageOrder] || 0);
                    break;
                  case "category":
                    comparison = (a.category || "").localeCompare(b.category || "");
                    break;
                  case "startDate":
                    const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
                    const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
                    comparison = dateA - dateB;
                    break;
                  case "budget":
                    const budgetA = parseFloat(a.budget || "0");
                    const budgetB = parseFloat(b.budget || "0");
                    comparison = budgetA - budgetB;
                    break;
                  default:
                    comparison = 0;
                }
                
                return projectSortDirection === "asc" ? comparison : -comparison;
              });

              // Paginate filtered projects (only for list view)
              const getPaginatedProjects = () => {
                if (projectViewMode === "grid") return sortedProjects; // No pagination for grid view
                const startIndex = (projectCurrentPage - 1) * projectPageSize;
                const endIndex = startIndex + projectPageSize;
                return sortedProjects.slice(startIndex, endIndex);
              };

              const projectTotalPages = Math.ceil(filteredProjects.length / projectPageSize);

              if (projects.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground mb-4">Aucun projet pour le moment</p>
                    <Button 
                      data-testid="button-create-first-project"
                      onClick={() => {
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
                        setIsCreateProjectDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Créer votre premier projet
                    </Button>
                  </div>
                );
              }

              if (filteredProjects.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground">Aucun projet ne correspond à vos critères de recherche</p>
                  </div>
                );
              }

              const getStageColor = (stage: string | null) => {
                switch (stage) {
                  case "prospection":
                    return "bg-yellow-100 text-yellow-700 border-yellow-200";
                  case "signe":
                    return "bg-purple-100 text-purple-700 border-purple-200";
                  case "en_cours":
                    return "bg-blue-100 text-blue-700 border-blue-200";
                  case "termine":
                    return "bg-green-100 text-green-700 border-green-200";
                  default:
                    return "bg-gray-100 text-gray-700 border-gray-200";
                }
              };

              const getStageLabel = (stage: string | null) => {
                switch (stage) {
                  case "prospection":
                    return "Prospection";
                  case "signe":
                    return "Signé";
                  case "en_cours":
                    return "En cours";
                  case "termine":
                    return "Terminé";
                  default:
                    return stage || "Non défini";
                }
              };

              if (projectViewMode === "kanban") {
                const stages = [
                  { value: "prospection", label: "Prospection", color: "bg-yellow-100 border-yellow-200" },
                  { value: "signe", label: "Signé", color: "bg-purple-100 border-purple-200" },
                  { value: "en_cours", label: "En cours", color: "bg-blue-100 border-blue-200" },
                  { value: "termine", label: "Terminé", color: "bg-green-100 border-green-200" },
                ];
                
                const handleKanbanDragEnd = (event: DragEndEvent) => {
                  const { active, over } = event;
                  if (!over) return;
                  
                  const projectId = active.id as string;
                  const newStage = over.id as string;
                  
                  // Update project stage
                  updateProjectMutation.mutate({
                    id: projectId,
                    data: { stage: newStage }
                  });
                };
                
                return (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={pointerWithin}
                    onDragEnd={handleKanbanDragEnd}
                  >
                    <div className="grid grid-cols-4 gap-4">
                      {stages.map((stage) => {
                        const stageProjects = filteredProjects.filter(p => p.stage === stage.value);
                        
                        return (
                          <KanbanStageColumn
                            key={stage.value}
                            stage={stage}
                            projects={stageProjects}
                            clients={clients}
                            tasks={tasks}
                            taskColumns={taskColumns}
                            onEditProject={(project) => {
                              setEditingProject(project);
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
                              setIsEditProjectDialogOpen(true);
                            }}
                            onDeleteProject={(project) => {
                              setEditingProject(project);
                              setIsDeleteProjectDialogOpen(true);
                            }}
                            onCompleteProject={(project) => {
                              updateProjectMutation.mutate({ id: project.id, data: { stage: "termine" } });
                            }}
                          />
                        );
                      })}
                    </div>
                  </DndContext>
                );
              }
              
              return projectViewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects.map((project) => {
                    const client = clients.find((c) => c.id === project.clientId);
                    
                    // Calculate number of incomplete tasks
                    const projectTasks = tasks.filter(t => t.projectId === project.id);
                    const completedColumn = taskColumns
                      .filter(c => c.isLocked && c.projectId === project.id)
                      .sort((a, b) => b.order - a.order)[0];
                    const incompleteTasks = projectTasks.filter(t => 
                      !completedColumn || t.columnId !== completedColumn.id
                    ).length;

                    return (
                      <Card
                        key={project.id}
                        className="hover-elevate active-elevate-2"
                        data-testid={`project-card-${project.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 flex-1">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-primary text-primary-foreground">
                                  {client?.name.substring(0, 2).toUpperCase() || "??"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Link href={`/projects/${project.id}`}>
                                    <h3 className="font-medium text-xs truncate hover:text-primary cursor-pointer transition-colors" data-testid={`project-name-${project.id}`}>
                                      {project.name}
                                    </h3>
                                  </Link>
                                  {incompleteTasks > 0 && (
                                    <Badge variant="secondary" className="text-[10px]" data-testid={`badge-tasks-count-${project.id}`}>
                                      {incompleteTasks}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {client?.name || "Client non défini"}
                                </p>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  data-testid={`button-project-menu-${project.id}`}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-white">
                                <DropdownMenuItem 
                                  data-testid={`button-edit-project-${project.id}`}
                                  onClick={() => {
                                    setEditingProject(project);
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
                                    setIsEditProjectDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  data-testid={`button-complete-project-${project.id}`}
                                  onClick={() => updateProjectMutation.mutate({ id: project.id, data: { stage: "termine" } })}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Marquer comme terminé
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  data-testid={`button-delete-project-${project.id}`}
                                  onClick={() => {
                                    setEditingProject(project);
                                    setIsDeleteProjectDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge className={`${getStageColor(project.stage)} text-xs`} data-testid={`badge-stage-${project.id}`}>
                                {getStageLabel(project.stage)}
                              </Badge>
                              {project.category && (
                                <Badge variant="outline" className="text-xs" data-testid={`badge-category-${project.id}`}>
                                  {project.category}
                                </Badge>
                              )}
                            </div>

                            {project.description && (
                              <p className="text-[10px] text-muted-foreground line-clamp-2">
                                {project.description}
                              </p>
                            )}

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t">
                              <div className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {project.startDate
                                  ? formatDate(new Date(project.startDate), "dd MMM yyyy", { locale: fr })
                                  : "Pas de date"}
                              </div>
                              {project.budget && (
                                <div className="font-medium text-foreground">
                                  {parseFloat(project.budget).toLocaleString("fr-FR", {
                                    style: "currency",
                                    currency: "EUR",
                                    minimumFractionDigits: 0,
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  onDragStart={handleProjectColumnDragStart}
                  onDragEnd={handleProjectColumnDragEnd}
                >
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <SortableContext
                            items={projectColumnOrder.filter(id => id !== "actions")}
                            strategy={horizontalListSortingStrategy}
                          >
                            <TableRow className="bg-muted/40">
                              {projectColumnOrder.map((columnId) => {
                                const columnLabels: Record<string, string> = {
                                  name: "Projet",
                                  client: "Client",
                                  stage: "Étape",
                                  progress: "Progression",
                                  category: "Catégorie",
                                  startDate: "Date de début",
                                  budget: "Budget",
                                  actions: "Actions",
                                };
                                
                                const isSortableColumn = !["progress", "actions"].includes(columnId);
                                
                                const columnClasses: Record<string, string> = {
                                  name: "max-w-[250px]",
                                  budget: "text-right",
                                  actions: "w-[80px] bg-white",
                                };
                                
                                return (
                                  <SortableProjectColumnHeader
                                    key={columnId}
                                    id={columnId}
                                    label={columnLabels[columnId] || columnId}
                                    className={columnClasses[columnId] || ""}
                                    isDraggable={columnId !== "actions"}
                                    sortColumn={projectSortColumn}
                                    sortDirection={projectSortDirection}
                                    onSort={handleSort}
                                    isSortable={isSortableColumn}
                                  />
                                );
                              })}
                            </TableRow>
                          </SortableContext>
                        </TableHeader>
                        <TableBody>
                          {getPaginatedProjects().map((project) => {
                            const client = clients.find((c) => c.id === project.clientId);
                            const progress = calculateProjectProgress(project.id);
                            
                            // Create a mapping of column IDs to their cell content
                            const cellContent: Record<string, JSX.Element> = {
                              name: (
                                <TableCell key="name" className="max-w-[250px]">
                                  <Link href={`/projects/${project.id}`}>
                                    <div className="font-medium hover:text-primary cursor-pointer transition-colors text-[12px] truncate" data-testid={`project-name-${project.id}`}>
                                      {project.name}
                                    </div>
                                  </Link>
                                  {project.description && (
                                    <div className="text-[10px] text-muted-foreground line-clamp-1">
                                      {project.description}
                                    </div>
                                  )}
                                </TableCell>
                              ),
                              client: (
                                <TableCell key="client">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                                        {client?.name.substring(0, 2).toUpperCase() || "??"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-[11px]">{client?.name || "Non défini"}</span>
                                  </div>
                                </TableCell>
                              ),
                              stage: (
                                <TableCell key="stage">
                                  <Popover
                                    open={stagePopoverOpen && editingStageProjectId === project.id}
                                    onOpenChange={(open) => {
                                      setStagePopoverOpen(open);
                                      if (open) {
                                        setEditingStageProjectId(project.id);
                                      } else {
                                        setEditingStageProjectId(null);
                                      }
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <button
                                        className="hover-elevate active-elevate-2 rounded-md"
                                        data-testid={`button-edit-stage-${project.id}`}
                                      >
                                        <Badge className={`${getStageColor(project.stage)} cursor-pointer text-[10px]`}>
                                          {getStageLabel(project.stage)}
                                        </Badge>
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2 bg-white" align="start">
                                      <div className="space-y-1">
                                        {[
                                          { value: "prospection", label: "Prospection" },
                                          { value: "signe", label: "Signé" },
                                          { value: "en_cours", label: "En cours" },
                                          { value: "termine", label: "Terminé" }
                                        ].map((stage) => (
                                          <button
                                            key={stage.value}
                                            onClick={() => {
                                              updateProjectMutation.mutate({
                                                id: project.id,
                                                data: { stage: stage.value }
                                              });
                                              setStagePopoverOpen(false);
                                              setEditingStageProjectId(null);
                                            }}
                                            className="w-full text-left px-3 py-2 rounded hover-elevate"
                                            data-testid={`item-stage-${stage.value}`}
                                          >
                                            <Badge className={`${getStageColor(stage.value)} text-[10px]`}>
                                              {stage.label}
                                            </Badge>
                                          </button>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                              ),
                              progress: (
                                <TableCell key="progress">
                                  <div className="flex items-center gap-2" data-testid={`progress-container-${project.id}`}>
                                    <Progress value={project.stage === "termine" ? 100 : progress} className="w-24 h-2" data-testid={`progress-bar-${project.id}`} />
                                    <span className="text-[11px] text-muted-foreground min-w-[3rem]" data-testid={`progress-text-${project.id}`}>{project.stage === "termine" ? 100 : progress}%</span>
                                  </div>
                                </TableCell>
                              ),
                              category: (
                                <TableCell key="category">
                                  <Popover
                                    open={categoryPopoverOpen && editingCategoryProjectId === project.id}
                                    onOpenChange={(open) => {
                                      setCategoryPopoverOpen(open);
                                      if (open) {
                                        setEditingCategoryProjectId(project.id);
                                        setCategorySearchQuery("");
                                      } else {
                                        setEditingCategoryProjectId(null);
                                        setCategorySearchQuery("");
                                      }
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <button
                                        className="text-left hover-elevate active-elevate-2 rounded-md px-2 py-1"
                                        data-testid={`button-edit-category-${project.id}`}
                                      >
                                        {project.category ? (
                                          <Badge variant="outline" className="cursor-pointer text-[10px]">
                                            {project.category}
                                          </Badge>
                                        ) : (
                                          <span className="text-[11px] text-muted-foreground">—</span>
                                        )}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-0 bg-white" align="start">
                                      <Command className="bg-white">
                                        <CommandInput
                                          placeholder="Rechercher ou créer..."
                                          value={categorySearchQuery}
                                          onValueChange={setCategorySearchQuery}
                                          data-testid="input-category-search"
                                        />
                                        <CommandList>
                                          <CommandEmpty>
                                            <button
                                              className="w-full text-left px-2 py-1.5 text-sm hover-elevate active-elevate-2 rounded-md"
                                              onClick={() => {
                                                if (categorySearchQuery.trim()) {
                                                  updateProjectMutation.mutate({
                                                    id: project.id,
                                                    data: { category: categorySearchQuery.trim() }
                                                  });
                                                  setCategoryPopoverOpen(false);
                                                  setEditingCategoryProjectId(null);
                                                  setCategorySearchQuery("");
                                                }
                                              }}
                                              data-testid="button-create-category"
                                            >
                                              <Plus className="inline h-4 w-4 mr-2" />
                                              Créer "{categorySearchQuery}"
                                            </button>
                                          </CommandEmpty>
                                          
                                          {(() => {
                                            // Filter categories based on search query
                                            const filteredCategories = uniqueCategories.filter(cat =>
                                              cat.toLowerCase().includes(categorySearchQuery.toLowerCase())
                                            ).slice(0, 20); // Limit to 20 results
                                            
                                            const filteredRecent = recentCategories.filter(cat =>
                                              cat.toLowerCase().includes(categorySearchQuery.toLowerCase())
                                            );
                                            
                                            const filteredOthers = filteredCategories.filter(
                                              cat => !recentCategories.includes(cat)
                                            );
                                            
                                            return (
                                              <>
                                                {filteredRecent.length > 0 && (
                                                  <CommandGroup heading="Récentes">
                                                    {filteredRecent.map((cat) => (
                                                      <CommandItem
                                                        key={cat}
                                                        onSelect={() => {
                                                          updateProjectMutation.mutate({
                                                            id: project.id,
                                                            data: { category: cat }
                                                          });
                                                          setCategoryPopoverOpen(false);
                                                          setEditingCategoryProjectId(null);
                                                          setCategorySearchQuery("");
                                                        }}
                                                        data-testid={`item-category-${cat}`}
                                                      >
                                                        <Check
                                                          className={`mr-2 h-4 w-4 ${
                                                            project.category === cat ? 'opacity-100' : 'opacity-0'
                                                          }`}
                                                        />
                                                        {cat}
                                                      </CommandItem>
                                                    ))}
                                                  </CommandGroup>
                                                )}
                                                
                                                {filteredOthers.length > 0 && (
                                                  <CommandGroup heading="Toutes">
                                                    {filteredOthers.map((cat) => (
                                                      <CommandItem
                                                        key={cat}
                                                        onSelect={() => {
                                                          updateProjectMutation.mutate({
                                                            id: project.id,
                                                            data: { category: cat }
                                                          });
                                                          setCategoryPopoverOpen(false);
                                                          setEditingCategoryProjectId(null);
                                                          setCategorySearchQuery("");
                                                        }}
                                                        data-testid={`item-category-${cat}`}
                                                      >
                                                        <Check
                                                          className={`mr-2 h-4 w-4 ${
                                                            project.category === cat ? 'opacity-100' : 'opacity-0'
                                                          }`}
                                                        />
                                                        {cat}
                                                      </CommandItem>
                                                    ))}
                                                  </CommandGroup>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                              ),
                              startDate: (
                                <TableCell key="startDate">
                                  <Popover
                                    open={startDatePopoverOpen && editingStartDateProjectId === project.id}
                                    onOpenChange={(open) => {
                                      setStartDatePopoverOpen(open);
                                      if (open) {
                                        setEditingStartDateProjectId(project.id);
                                      } else {
                                        setEditingStartDateProjectId(null);
                                      }
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <button
                                        className="flex items-center gap-1 text-[11px] hover-elevate active-elevate-2 rounded-md px-2 py-1 whitespace-nowrap"
                                        data-testid={`button-edit-start-date-${project.id}`}
                                      >
                                        <CalendarIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        {project.startDate
                                          ? formatDate(new Date(project.startDate), "dd/MM/yy", { locale: fr })
                                          : <span className="text-muted-foreground">—</span>
                                        }
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-white" align="start">
                                      <Calendar
                                        mode="single"
                                        selected={project.startDate ? new Date(project.startDate) : undefined}
                                        onSelect={(date) => {
                                          updateProjectMutation.mutate({
                                            id: project.id,
                                            data: { startDate: date ? formatDate(date, "yyyy-MM-dd") : null }
                                          });
                                          setStartDatePopoverOpen(false);
                                          setEditingStartDateProjectId(null);
                                        }}
                                        locale={fr}
                                        data-testid="calendar-start-date"
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                              ),
                              budget: (
                                <TableCell key="budget" className="text-right">
                                  {editingBudgetProjectId === project.id ? (
                                    <Input
                                      type="number"
                                      value={tempBudgetValue}
                                      onChange={(e) => setTempBudgetValue(e.target.value)}
                                      onBlur={() => {
                                        const budgetValue = tempBudgetValue.trim() === "" ? null : parseFloat(tempBudgetValue);
                                        updateProjectMutation.mutate({
                                          id: project.id,
                                          data: { budget: budgetValue }
                                        });
                                        setEditingBudgetProjectId(null);
                                        setTempBudgetValue("");
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          const budgetValue = tempBudgetValue.trim() === "" ? null : parseFloat(tempBudgetValue);
                                          updateProjectMutation.mutate({
                                            id: project.id,
                                            data: { budget: budgetValue }
                                          });
                                          setEditingBudgetProjectId(null);
                                          setTempBudgetValue("");
                                        } else if (e.key === "Escape") {
                                          setEditingBudgetProjectId(null);
                                          setTempBudgetValue("");
                                        }
                                      }}
                                      autoFocus
                                      className="h-8 text-[11px] text-right w-24"
                                      placeholder="Budget"
                                      data-testid={`input-edit-budget-${project.id}`}
                                    />
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingBudgetProjectId(project.id);
                                        setTempBudgetValue(project.budget || "");
                                      }}
                                      className="hover-elevate active-elevate-2 rounded-md px-2 py-1 text-right w-full"
                                      data-testid={`button-edit-budget-${project.id}`}
                                    >
                                      {project.budget ? (
                                        <span className="font-medium text-[11px]">
                                          {parseFloat(project.budget).toLocaleString("fr-FR", {
                                            style: "currency",
                                            currency: "EUR",
                                            minimumFractionDigits: 0,
                                          })}
                                        </span>
                                      ) : (
                                        <span className="text-[11px] text-muted-foreground">—</span>
                                      )}
                                    </button>
                                  )}
                                </TableCell>
                              ),
                              actions: (
                                <TableCell key="actions">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        data-testid={`button-project-menu-${project.id}`}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-white">
                                      <DropdownMenuItem 
                                        data-testid={`button-edit-project-${project.id}`}
                                        onClick={() => {
                                          setEditingProject(project);
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
                                          setIsEditProjectDialogOpen(true);
                                        }}
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Modifier
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        data-testid={`button-complete-project-${project.id}`}
                                        onClick={() => updateProjectMutation.mutate({ id: project.id, data: { stage: "termine" } })}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Marquer comme terminé
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        data-testid={`button-delete-project-${project.id}`}
                                        onClick={() => {
                                          setEditingProject(project);
                                          setIsDeleteProjectDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Supprimer
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              ),
                            };
                          
                            return (
                              <TableRow key={project.id} className="h-12" data-testid={`project-row-${project.id}`}>
                                {projectColumnOrder.map((columnId) => cellContent[columnId])}
                              </TableRow>
                            );
                          })}
                          
                          {/* Quick add project row */}
                          <TableRow className="h-12">
                            {projectColumnOrder.map((columnId) => {
                              if (columnId === 'name') {
                                return (
                                  <TableCell key={columnId} colSpan={projectColumnOrder.length}>
                                    <div className="flex items-center gap-2">
                                      <Plus className="h-4 w-4 text-muted-foreground" />
                                      <Input
                                        placeholder="Nouveau projet..."
                                        value={quickAddProjectName}
                                        onChange={(e) => setQuickAddProjectName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && quickAddProjectName.trim()) {
                                            setIsQuickAddingProject(true);
                                            createProjectMutation.mutate({
                                              name: quickAddProjectName.trim(),
                                              description: "",
                                              stage: "prospection",
                                              accountId: accountId!,
                                              clientId: null,
                                              category: null,
                                              startDate: null,
                                              endDate: null,
                                              budget: null,
                                            });
                                            setQuickAddProjectName("");
                                            setIsQuickAddingProject(false);
                                          } else if (e.key === "Escape") {
                                            setQuickAddProjectName("");
                                          }
                                        }}
                                        disabled={isQuickAddingProject}
                                        className="border-0 focus-visible:ring-0 text-[12px] h-8"
                                        data-testid="input-quick-add-project"
                                      />
                                    </div>
                                  </TableCell>
                                );
                              }
                              return null;
                            })}
                          </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                </DndContext>
              );
            })()}
            
            {/* Project List Pagination */}
            {projectViewMode === "list" && projects.length > 0 && (() => {
              const filtered = projects.filter((project) => {
                const matchesSearch = projectSearchQuery === "" || 
                  project.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                  project.description?.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                  project.category?.toLowerCase().includes(projectSearchQuery.toLowerCase());
                
                const matchesStage = projectStageFilters.length === 0 || projectStageFilters.includes(project.stage || "");
                
                return matchesSearch && matchesStage;
              });
              const projectTotalPages = Math.ceil(filtered.length / projectPageSize);
              
              if (filtered.length === 0) return null;
              
              return (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Lignes par page:
                    </span>
                    <Select
                      value={projectPageSize.toString()}
                      onValueChange={(value) => {
                        setProjectPageSize(parseInt(value));
                        setProjectCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-20 h-8 text-xs bg-white" data-testid="select-project-page-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">
                      {filtered.length} projet{filtered.length > 1 ? 's' : ''} au total
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Page {projectCurrentPage} sur {projectTotalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProjectCurrentPage(1)}
                        disabled={projectCurrentPage === 1}
                        data-testid="button-project-first-page"
                      >
                        Première
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProjectCurrentPage(p => Math.max(1, p - 1))}
                        disabled={projectCurrentPage === 1}
                        data-testid="button-project-prev-page"
                      >
                        Précédent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProjectCurrentPage(p => Math.min(projectTotalPages, p + 1))}
                        disabled={projectCurrentPage === projectTotalPages}
                        data-testid="button-project-next-page"
                      >
                        Suivant
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProjectCurrentPage(projectTotalPages)}
                        disabled={projectCurrentPage === projectTotalPages}
                        data-testid="button-project-last-page"
                      >
                        Dernière
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
      </div>
      <Sheet open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
        <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col" data-testid="dialog-create-project">
          <SheetHeader>
            <SheetTitle>Créer un nouveau projet</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 flex-1 py-4">
            <div>
              <Label className="text-[12px]" htmlFor="project-name">Nom du projet *</Label>
              <Input
                id="project-name"
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                data-testid="input-project-name"
              />
            </div>
            <div>
              <Label className="text-[12px]" htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={projectFormData.description}
                onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                rows={3}
                data-testid="textarea-project-description"
              />
            </div>
            <div>
              <Label className="text-[12px]" htmlFor="project-client">Client</Label>
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
                <Label className="text-[12px]" htmlFor="project-stage">Étape</Label>
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
                <Label className="text-[12px]" htmlFor="project-category">Catégorie</Label>
                <CategoryCombobox
                  value={projectFormData.category || ""}
                  onChange={(value) => setProjectFormData({ ...projectFormData, category: value })}
                  categories={projectCategories}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[12px]">Date de début</Label>
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
                <Label className="text-[12px]">Date de fin</Label>
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
              <Label className="text-[12px]" htmlFor="project-budget">Budget (€)</Label>
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
                data-testid="button-cancel-create-project"
              >
                Annuler
              </Button>
              <Button
                onClick={() => {
                  createProjectMutation.mutate({
                    name: projectFormData.name.trim(),
                    description: projectFormData.description?.trim() || null,
                    clientId: projectFormData.clientId || null,
                    stage: projectFormData.stage,
                    category: projectFormData.category?.trim() || null,
                    startDate: projectFormData.startDate ? formatDateForStorage(projectFormData.startDate) : null,
                    endDate: projectFormData.endDate ? formatDateForStorage(projectFormData.endDate) : null,
                    budget: projectFormData.budget?.trim() || null,
                  });
                }}
                disabled={!projectFormData.name.trim() || createProjectMutation.isPending}
                data-testid="button-submit-create-project"
              >
                Créer le projet
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={isEditProjectDialogOpen} onOpenChange={setIsEditProjectDialogOpen}>
        <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col" data-testid="dialog-edit-project">
          <SheetHeader>
            <SheetTitle>Modifier le projet</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 flex-1 py-4">
            <div>
              <Label className="text-[12px]" htmlFor="edit-project-name">Nom du projet *</Label>
              <Input
                id="edit-project-name"
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                data-testid="input-edit-project-name"
              />
            </div>
            <div>
              <Label className="text-[12px]" htmlFor="edit-project-description">Description</Label>
              <Textarea
                id="edit-project-description"
                value={projectFormData.description}
                onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                rows={3}
                data-testid="textarea-edit-project-description"
              />
            </div>
            <div>
              <Label className="text-[12px]" htmlFor="edit-project-client">Client</Label>
              <Popover open={editClientComboboxOpen} onOpenChange={setEditClientComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={editClientComboboxOpen}
                    className="w-full justify-between"
                    id="edit-project-client"
                    data-testid="select-edit-project-client"
                  >
                    {projectFormData.clientId
                      ? (() => {
                          const selectedClient = clients.find((c) => c.id === projectFormData.clientId);
                          return selectedClient?.company || selectedClient?.name || "Sélectionner un client";
                        })()
                      : "Sélectionner un client"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 bg-white" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher une société..." />
                    <CommandList>
                      <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                      <CommandGroup>
                        {clients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.company || client.name || ""}
                            onSelect={() => {
                              setProjectFormData({ ...projectFormData, clientId: client.id });
                              setEditClientComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                projectFormData.clientId === client.id ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {client.company || client.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[12px]" htmlFor="edit-project-stage">Étape</Label>
                <Select
                  value={projectFormData.stage}
                  onValueChange={(value) => setProjectFormData({ ...projectFormData, stage: value })}
                >
                  <SelectTrigger id="edit-project-stage" data-testid="select-edit-project-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="prospection" className="cursor-pointer">Prospection</SelectItem>
                    <SelectItem value="signe" className="cursor-pointer">Signé</SelectItem>
                    <SelectItem value="en_cours" className="cursor-pointer">En cours</SelectItem>
                    <SelectItem value="termine" className="cursor-pointer">Terminé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[12px]" htmlFor="edit-project-category">Catégorie</Label>
                <CategoryCombobox
                  value={projectFormData.category || ""}
                  onChange={(value) => setProjectFormData({ ...projectFormData, category: value })}
                  categories={projectCategories}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[12px]">Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-edit-project-start-date"
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
                <Label className="text-[12px]">Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-edit-project-end-date"
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
              <Label className="text-[12px]" htmlFor="edit-project-budget">Budget (€)</Label>
              <Input
                id="edit-project-budget"
                type="number"
                value={projectFormData.budget}
                onChange={(e) => setProjectFormData({ ...projectFormData, budget: e.target.value })}
                data-testid="input-edit-project-budget"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditProjectDialogOpen(false);
                setEditingProject(null);
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
              data-testid="button-cancel-edit-project"
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (!editingProject) return;
                updateProjectMutation.mutate({
                  id: editingProject.id,
                  data: {
                    name: projectFormData.name.trim(),
                    description: projectFormData.description?.trim() || null,
                    clientId: projectFormData.clientId || null,
                    stage: projectFormData.stage,
                    category: projectFormData.category?.trim() || null,
                    startDate: projectFormData.startDate ? formatDateForStorage(projectFormData.startDate) : null,
                    endDate: projectFormData.endDate ? formatDateForStorage(projectFormData.endDate) : null,
                    budget: projectFormData.budget?.trim() || null,
                  },
                });
              }}
              disabled={!projectFormData.name.trim() || updateProjectMutation.isPending}
              data-testid="button-submit-edit-project"
            >
              Enregistrer les modifications
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={isDeleteProjectDialogOpen} onOpenChange={setIsDeleteProjectDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-project">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-project">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (editingProject) {
                  deleteProjectMutation.mutate(editingProject.id);
                }
              }}
              data-testid="button-confirm-delete-project"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
        <DialogContent data-testid="dialog-create-task">
          <DialogHeader>
            <DialogTitle>Nouvelle tâche</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[12px]">Projet</Label>
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
                <PopoverContent className="w-full p-0">
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
              <Label className="text-[12px]" htmlFor="task-title">Titre *</Label>
              <Input
                id="task-title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                data-testid="input-new-task-title"
              />
            </div>
            <div>
              <Label className="text-[12px]" htmlFor="task-description">Description</Label>
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
                <Label className="text-[12px]" htmlFor="task-priority">Priorité</Label>
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
                <Label className="text-[12px]" htmlFor="task-assigned">Assigné à</Label>
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
              <Label className="text-[12px]">Effort / Complexité</Label>
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
              <Label className="text-[12px]">Colonne *</Label>
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
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Rechercher une colonne..." />
                    <CommandList>
                      <CommandEmpty>Aucune colonne trouvée.</CommandEmpty>
                      <CommandGroup>
                        {(() => {
                          const columnsToDisplay = newTaskProjectId === "none" 
                            ? globalTaskColumns 
                            : (newTaskProjectId ? newTaskProjectColumns : taskColumns);
                          return columnsToDisplay
                            .sort((a, b) => a.order - b.order)
                            .map((column) => (
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
              <Label className="text-[12px]">Date d'échéance</Label>
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
              <Label className="text-[12px]" htmlFor="column-name">Nom de la colonne *</Label>
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
              <Label className="text-[12px]" htmlFor="rename-column">Nom de la colonne *</Label>
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
              <Label className="text-[12px]">Sélectionner une couleur</Label>
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
        onDelete={(task) => {
          setSelectedTask(task);
          setIsDeleteTaskDialogOpen(true);
        }}
      />
    </div>
  );
}
