import { useState, useEffect } from "react";
import { Plus, Filter, LayoutGrid, List, GripVertical, Edit, Trash2, CalendarIcon, Calendar as CalendarLucide, Check, ChevronsUpDown, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, AlertCircle, UserCheck, MoreVertical, Eye, CheckCircle } from "lucide-react";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onUpdateTask: (taskId: string, data: Partial<Task>) => void;
}

function ListView({ tasks, columns, users, onEditTask, onDeleteTask, onUpdateTask }: ListViewProps) {
  const [columnOrder, setColumnOrder] = useState([
    'checkbox',
    'title',
    'assignedTo',
    'status',
    'priority',
    'dueDate',
    'actions'
  ]);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: string } | null>(null);

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
    if (!sortConfig) return tasks;

    const sorted = [...tasks].sort((a, b) => {
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

  const columnHeaders = {
    checkbox: { label: '', id: 'checkbox' },
    title: { label: 'Tâche', id: 'title' },
    assignedTo: { label: 'Assigné à', id: 'assignedTo' },
    status: { label: 'Statut', id: 'status' },
    priority: { label: 'Priorité', id: 'priority' },
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
        className="font-semibold"
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
          <span className="text-sm font-medium">
            {selectedTasks.size} tâche{selectedTasks.size > 1 ? 's' : ''} sélectionnée{selectedTasks.size > 1 ? 's' : ''}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" data-testid="button-bulk-actions">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
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
                <DropdownMenuSubContent>
                  {users.map(user => (
                    <DropdownMenuItem 
                      key={user.id}
                      onClick={() => handleBulkAssign(user.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatarUrl || ""} />
                          <AvatarFallback className="text-xs">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {user.firstName} {user.lastName}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
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
              getSortedTasks().map((task) => {
                const assignedUser = users.find((u) => u.id === task.assignedToId);
                const taskColumn = columns.find(c => c.id === task.columnId);
                const isEditing = editingCell?.taskId === task.id;
                
                return (
                  <TableRow key={task.id} data-testid={`table-row-${task.id}`}>
                    {columnOrder.map((columnId) => {
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
                              className="font-medium cursor-pointer hover:text-primary"
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
                                    className="text-foreground text-xs min-w-[80px] cursor-pointer hover-elevate"
                                    data-testid={`badge-status-${task.id}`}
                                  >
                                    {taskColumn?.name || '—'}
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2">
                                  <div className="space-y-1">
                                    {[...columns].sort((a, b) => a.order - b.order).map(col => (
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
                                        <span className="text-sm">{col.name}</span>
                                      </button>
                                    ))}
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
                                    className={`text-xs cursor-pointer hover-elevate ${getPriorityColor(task.priority)}`}
                                    data-testid={`badge-priority-${task.id}`}
                                  >
                                    {getPriorityLabel(task.priority)}
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-40 p-2">
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
                                        <Badge className={`text-xs ${priority.color}`}>
                                          {priority.label}
                                        </Badge>
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
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
                                    className="text-xs cursor-pointer hover-elevate min-w-[100px]"
                                    data-testid={`badge-due-date-${task.id}`}
                                  >
                                    {task.dueDate 
                                      ? formatDate(new Date(task.dueDate), 'dd MMM yyyy', { locale: fr })
                                      : '—'
                                    }
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={task.dueDate ? new Date(task.dueDate) : undefined}
                                    onSelect={(date) => {
                                      onUpdateTask(task.id, { 
                                        dueDate: date ? date.toISOString() : null 
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

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
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
  const [projectStageFilter, setProjectStageFilter] = useState("all");
  const [projectViewMode, setProjectViewMode] = useState<"grid" | "list">("grid");
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState<string | undefined>();
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>();
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>("");
  const [projectComboboxOpen, setProjectComboboxOpen] = useState(false);
  const [columnComboboxOpen, setColumnComboboxOpen] = useState(false);
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
    const columnsToUse = newTaskProjectId === "none" ? globalTaskColumns : newTaskProjectColumns;
    if (columnsToUse.length > 0) {
      const sortedColumns = [...columnsToUse].sort((a, b) => a.order - b.order);
      setCreateTaskColumnId(sortedColumns[0].id);
    }
  }, [newTaskProjectId, newTaskProjectColumns, globalTaskColumns]);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: selectedProjectId === "all" ? ["/api/tasks"] : ["/api/projects", selectedProjectId, "tasks"],
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
      // Invalidate aggregated tasks for "all projects" view
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsCreateTaskDialogOpen(false);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
      setNewTaskAssignedTo(undefined);
      setNewTaskDueDate(undefined);
      setNewTaskProjectId("");
      setCreateTaskColumnId(null);
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
      const response = await apiRequest("PATCH", `/api/tasks/${id}`, data);
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
      const response = await apiRequest("POST", `/api/tasks/${taskId}/duplicate`, {});
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
      const response = await apiRequest("DELETE", `/api/tasks/${taskId}`, {});
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
      const response = await apiRequest("PATCH", "/api/tasks/bulk-update-positions", { updates });
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
      const response = await apiRequest("POST", "/api/task-columns", data);
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
      const response = await apiRequest("PATCH", `/api/task-columns/${id}`, data);
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
      const response = await apiRequest("DELETE", `/api/task-columns/${columnId}`, {});
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
        "PATCH",
        `/api/projects/${selectedProjectId}/task-columns/reorder`,
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
      const response = await apiRequest("POST", "/api/projects", data);
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
      const response = await apiRequest("PATCH", `/api/projects/${id}`, data);
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
      const response = await apiRequest("DELETE", `/api/projects/${projectId}`, {});
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

  const handleCreateTask = () => {
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
      dueDate: (newTaskDueDate ? newTaskDueDate.toISOString() : null) as any,
      createdBy: userId,
    } as InsertTask);
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
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList>
            <TabsTrigger value="tasks" data-testid="tab-tasks">
              Tâches
            </TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-projects">
              Projets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                {projects.length > 0 && (
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="w-[280px]" data-testid="select-project">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les projets</SelectItem>
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
                {selectedProjectId !== "all" && (
                  <div className="flex border rounded-md">
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
                  <Button
                    onClick={() => viewMode === "list" ? setIsCreateTaskDialogOpen(true) : setIsCreateColumnDialogOpen(true)}
                    data-testid={viewMode === "list" ? "button-new-task" : "button-new-column"}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {viewMode === "list" ? "Nouvelle Tâche" : "Nouvelle Colonne"}
                  </Button>
                )}
                {selectedProjectId === "all" && (
                  <Button
                    onClick={() => setIsCreateTaskDialogOpen(true)}
                    data-testid="button-new-task"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvelle Tâche
                  </Button>
                )}
              </div>
            </div>

            {selectedProjectId === "all" ? (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-foreground mb-2">
                        Vue d'ensemble de toutes les tâches
                      </h3>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>{tasks.length} tâches au total</div>
                      <div>{projects.length} projets</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : selectedProject && (() => {
              // Find the "Terminé" column (last locked column with highest order)
              const completedColumn = taskColumns
                .filter(c => c.isLocked)
                .sort((a, b) => b.order - a.order)[0];
              const completedTasks = completedColumn 
                ? tasks.filter((t) => t.columnId === completedColumn.id).length 
                : 0;
              const progressPercentage = Math.round((completedTasks / Math.max(tasks.length, 1)) * 100);

              return (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-foreground">
                            Progression du projet
                          </h3>
                          <span className="text-sm font-semibold text-foreground">
                            {progressPercentage}%
                          </span>
                        </div>
                        <Progress value={progressPercentage} />
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>{tasks.length} tâches</div>
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
            ) : selectedProjectId === "all" || viewMode === "list" ? (
              <ListView
                tasks={tasks}
                columns={taskColumns}
                users={users}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onUpdateTask={(taskId, data) => {
                  updateTaskMutation.mutate({ id: taskId, data });
                }}
              />
            ) : (
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
                      const columnTasks = tasks.filter((t) => t.columnId === column.id);
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
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
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
                <Select value={projectStageFilter} onValueChange={setProjectStageFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-project-stage-filter">
                    <SelectValue placeholder="Toutes les étapes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les étapes</SelectItem>
                    <SelectItem value="prospection">Prospection</SelectItem>
                    <SelectItem value="signe">Signé</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="termine">Terminé</SelectItem>
                  </SelectContent>
                </Select>
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
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau projet
                </Button>
              </div>
            </div>

            {/* Projects Grid */}
            {(() => {
              // Filter projects based on search and stage
              const filteredProjects = projects.filter((project) => {
                const matchesSearch = projectSearchQuery === "" || 
                  project.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                  project.description?.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                  project.category?.toLowerCase().includes(projectSearchQuery.toLowerCase());
                
                const matchesStage = projectStageFilter === "all" || project.stage === projectStageFilter;
                
                return matchesSearch && matchesStage;
              });

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

              return projectViewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects.map((project) => {
                    const client = clients.find((c) => c.id === project.clientId);

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
                                <Link href={`/projects/${project.id}`}>
                                  <h3 className="font-medium text-sm truncate hover:text-primary cursor-pointer transition-colors" data-testid={`project-name-${project.id}`}>
                                    {project.name}
                                  </h3>
                                </Link>
                                <p className="text-xs text-muted-foreground truncate">
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
                              <DropdownMenuContent align="end">
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
                              <Badge className={getStageColor(project.stage)} data-testid={`badge-stage-${project.id}`}>
                                {getStageLabel(project.stage)}
                              </Badge>
                              {project.category && (
                                <Badge variant="outline" data-testid={`badge-category-${project.id}`}>
                                  {project.category}
                                </Badge>
                              )}
                            </div>

                            {project.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {project.description}
                              </p>
                            )}

                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
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
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Projet</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Étape</TableHead>
                          <TableHead>Catégorie</TableHead>
                          <TableHead>Date de début</TableHead>
                          <TableHead className="text-right">Budget</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProjects.map((project) => {
                          const client = clients.find((c) => c.id === project.clientId);
                          
                          return (
                            <TableRow key={project.id} data-testid={`project-row-${project.id}`}>
                              <TableCell>
                                <Link href={`/projects/${project.id}`}>
                                  <div className="font-medium hover:text-primary cursor-pointer transition-colors" data-testid={`project-name-${project.id}`}>
                                    {project.name}
                                  </div>
                                </Link>
                                {project.description && (
                                  <div className="text-xs text-muted-foreground line-clamp-1">
                                    {project.description}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                      {client?.name.substring(0, 2).toUpperCase() || "??"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{client?.name || "Non défini"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={getStageColor(project.stage)} data-testid={`badge-stage-${project.id}`}>
                                  {getStageLabel(project.stage)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {project.category ? (
                                  <Badge variant="outline" data-testid={`badge-category-${project.id}`}>
                                    {project.category}
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                  {project.startDate
                                    ? formatDate(new Date(project.startDate), "dd MMM yyyy", { locale: fr })
                                    : <span className="text-muted-foreground">—</span>
                                  }
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {project.budget ? (
                                  <span className="font-medium">
                                    {parseFloat(project.budget).toLocaleString("fr-FR", {
                                      style: "currency",
                                      currency: "EUR",
                                      minimumFractionDigits: 0,
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
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
                                  <DropdownMenuContent align="end">
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
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
        <DialogContent data-testid="dialog-create-project">
          <DialogHeader>
            <DialogTitle>Créer un nouveau projet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-name">Nom du projet *</Label>
              <Input
                id="project-name"
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                data-testid="input-project-name"
              />
            </div>
            <div>
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={projectFormData.description}
                onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                rows={3}
                data-testid="textarea-project-description"
              />
            </div>
            <div>
              <Label htmlFor="project-client">Client</Label>
              <Select
                value={projectFormData.clientId}
                onValueChange={(value) => setProjectFormData({ ...projectFormData, clientId: value })}
              >
                <SelectTrigger id="project-client" data-testid="select-project-client">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="project-stage">Étape</Label>
                <Select
                  value={projectFormData.stage}
                  onValueChange={(value) => setProjectFormData({ ...projectFormData, stage: value })}
                >
                  <SelectTrigger id="project-stage" data-testid="select-project-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospection">Prospection</SelectItem>
                    <SelectItem value="signe">Signé</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="termine">Terminé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="project-category">Catégorie</Label>
                <Input
                  id="project-category"
                  value={projectFormData.category}
                  onChange={(e) => setProjectFormData({ ...projectFormData, category: e.target.value })}
                  data-testid="input-project-category"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de début</Label>
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
                <Label>Date de fin</Label>
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
              <Label htmlFor="project-budget">Budget (€)</Label>
              <Input
                id="project-budget"
                type="number"
                value={projectFormData.budget}
                onChange={(e) => setProjectFormData({ ...projectFormData, budget: e.target.value })}
                data-testid="input-project-budget"
              />
            </div>
          </div>
          <DialogFooter>
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
                  startDate: projectFormData.startDate ? projectFormData.startDate.toISOString().split('T')[0] : null,
                  endDate: projectFormData.endDate ? projectFormData.endDate.toISOString().split('T')[0] : null,
                  budget: projectFormData.budget?.trim() || null,
                });
              }}
              disabled={!projectFormData.name.trim() || createProjectMutation.isPending}
              data-testid="button-submit-create-project"
            >
              Créer le projet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditProjectDialogOpen} onOpenChange={setIsEditProjectDialogOpen}>
        <DialogContent data-testid="dialog-edit-project">
          <DialogHeader>
            <DialogTitle>Modifier le projet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-project-name">Nom du projet *</Label>
              <Input
                id="edit-project-name"
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                data-testid="input-edit-project-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-project-description">Description</Label>
              <Textarea
                id="edit-project-description"
                value={projectFormData.description}
                onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                rows={3}
                data-testid="textarea-edit-project-description"
              />
            </div>
            <div>
              <Label htmlFor="edit-project-client">Client</Label>
              <Select
                value={projectFormData.clientId}
                onValueChange={(value) => setProjectFormData({ ...projectFormData, clientId: value })}
              >
                <SelectTrigger id="edit-project-client" data-testid="select-edit-project-client">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-project-stage">Étape</Label>
                <Select
                  value={projectFormData.stage}
                  onValueChange={(value) => setProjectFormData({ ...projectFormData, stage: value })}
                >
                  <SelectTrigger id="edit-project-stage" data-testid="select-edit-project-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospection">Prospection</SelectItem>
                    <SelectItem value="signe">Signé</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="termine">Terminé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-project-category">Catégorie</Label>
                <Input
                  id="edit-project-category"
                  value={projectFormData.category}
                  onChange={(e) => setProjectFormData({ ...projectFormData, category: e.target.value })}
                  data-testid="input-edit-project-category"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de début</Label>
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
                <Label>Date de fin</Label>
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
              <Label htmlFor="edit-project-budget">Budget (€)</Label>
              <Input
                id="edit-project-budget"
                type="number"
                value={projectFormData.budget}
                onChange={(e) => setProjectFormData({ ...projectFormData, budget: e.target.value })}
                data-testid="input-edit-project-budget"
              />
            </div>
          </div>
          <DialogFooter>
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
                    startDate: projectFormData.startDate ? projectFormData.startDate.toISOString().split('T')[0] : null,
                    endDate: projectFormData.endDate ? projectFormData.endDate.toISOString().split('T')[0] : null,
                    budget: projectFormData.budget?.trim() || null,
                  },
                });
              }}
              disabled={!projectFormData.name.trim() || updateProjectMutation.isPending}
              data-testid="button-submit-edit-project"
            >
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
