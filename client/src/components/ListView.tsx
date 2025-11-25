import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, GripVertical, Check, CheckCircle2, AlertCircle, UserCheck, FolderInput, Star, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format as formatDate } from "date-fns";
import { fr } from "date-fns/locale";
import type { Task, TaskColumn, AppUser, Project, InsertTask } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, formatDateForStorage } from "@/lib/queryClient";

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
  onCreateTask: () => void;
  selectedProjectId?: string;
  statusFilter: string;
  accountId?: string;
  userId?: string;
}

export function ListView({ 
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
    const saved = localStorage.getItem('tasksListViewSortConfig');
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
  
  // Column visibility states
  const defaultTaskColumns = ['checkbox', 'title', 'assignedTo', 'status', 'priority', 'effort', 'dueDate', 'actions'];
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('taskListVisibleColumns');
    return saved ? new Set(JSON.parse(saved)) : new Set(defaultTaskColumns);
  });
  const [isColumnSheetOpen, setIsColumnSheetOpen] = useState(false);
  
  const toggleColumnVisibility = (columnId: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnId)) {
        if (columnId === "checkbox" || columnId === "title" || columnId === "actions") return prev;
        newSet.delete(columnId);
      } else {
        newSet.add(columnId);
      }
      return newSet;
    });
  };
  
  // Save visible columns to localStorage
  useEffect(() => {
    localStorage.setItem('taskListVisibleColumns', JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

  // Save pageSize to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('taskListPageSize', pageSize.toString());
  }, [pageSize]);

  // Save sortConfig to localStorage when it changes
  useEffect(() => {
    if (sortConfig) {
      localStorage.setItem('tasksListViewSortConfig', JSON.stringify(sortConfig));
    } else {
      localStorage.removeItem('tasksListViewSortConfig');
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

  const handleSort = (column: string) => {
    if (column === 'actions') return;
    
    setSortConfig((current) => {
      if (current?.column === column) {
        if (current.direction === 'asc') {
          return { column, direction: 'desc' };
        }
        return null;
      }
      return { column, direction: 'asc' };
    });
  };

  const getSortedTasks = () => {
    let filtered = tasks;
    if (selectedProjectId && selectedProjectId !== "all") {
      filtered = filtered.filter(task => task.projectId === selectedProjectId);
    }
    
    if (statusFilter && statusFilter !== "all") {
      // When "all projects" is selected, filter by column name instead of ID
      // since different projects have different column IDs for the same status
      if (selectedProjectId === "all") {
        const filterColumn = columns.find(c => c.id === statusFilter);
        if (filterColumn) {
          filtered = filtered.filter(task => {
            const taskColumn = columns.find(c => c.id === task.columnId);
            return taskColumn?.name === filterColumn.name;
          });
        }
      } else {
        // For a specific project, filter by column ID
        filtered = filtered.filter(task => task.columnId === statusFilter);
      }
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
          aValue = userA ? `${userA.firstName} ${userA.lastName}`.toLowerCase() : 'zzz';
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
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className="font-semibold text-[11px] flex items-center"
        data-testid={`table-header-${columnId}`}
      >
        <div className="flex items-center gap-1">
          <button
            {...listeners}
            className="cursor-grab hover:bg-accent p-0.5 rounded"
            title="Glisser pour réorganiser"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </button>
          
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
      </div>
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
          <div className="flex justify-end p-2 border-b">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsColumnSheetOpen(true)}
              data-testid="button-task-columns"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>
          {(() => {
            // Calculate visible data columns (exclude checkbox and actions)
            const visibleDataColumns = columnOrder.filter((id: string) => 
              visibleColumns.has(id) && id !== 'checkbox' && id !== 'actions'
            );
            const hasCheckbox = visibleColumns.has('checkbox');
            const hasActions = visibleColumns.has('actions');
            
            // Build grid template conditionally
            const gridParts = [];
            if (hasCheckbox) gridParts.push('40px');
            gridParts.push(`repeat(${visibleDataColumns.length}, minmax(0, 1fr))`);
            if (hasActions) gridParts.push('80px');
            const gridTemplate = gridParts.join(' ');
            
            return (
              <div className="overflow-x-auto">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  {/* Table Header */}
                  <div 
                    className="gap-2 px-4 h-10 items-center text-xs font-medium text-muted-foreground bg-muted/50 rounded-t-md min-w-max"
                    style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
                  >
                    {/* Checkbox column - outside SortableContext */}
                    {hasCheckbox && (
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedTasks.size === tasks.length && tasks.length > 0}
                          onChange={() => {
                            if (selectedTasks.size === tasks.length) {
                              setSelectedTasks(new Set());
                            } else {
                              setSelectedTasks(new Set(tasks.map(t => t.id)));
                            }
                          }}
                          className="cursor-pointer"
                          data-testid="checkbox-select-all-tasks"
                        />
                      </div>
                    )}
                    {/* Data columns - inside SortableContext */}
                    <SortableContext items={visibleDataColumns}>
                      {visibleDataColumns.map((columnId: string) => (
                        <SortableTableHeader key={columnId} columnId={columnId} />
                      ))}
                    </SortableContext>
                    {/* Actions column - outside SortableContext */}
                    {hasActions && (
                      <div className="text-right pr-2">Actions</div>
                    )}
                  </div>
                  
                  {/* Table Body */}
                  <div className="divide-y divide-border">
                    {tasks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Aucune tâche
                      </div>
                    ) : (
                      getPaginatedTasks().map((task) => {
                        const assignedUser = users.find((u) => u.id === task.assignedToId);
                        const taskColumn = columns.find(c => c.id === task.columnId);
                        const isEditing = editingCell?.taskId === task.id;
                        
                        return (
                          <div 
                            key={task.id} 
                            className="gap-2 px-4 py-2 items-center hover-elevate active-elevate-2 rounded-md min-w-max"
                            style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
                            data-testid={`table-row-${task.id}`}
                          >
                            {/* Checkbox */}
                            {hasCheckbox && (
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={selectedTasks.has(task.id)}
                                  onChange={() => toggleTaskSelection(task.id)}
                                  className="cursor-pointer"
                                  data-testid={`checkbox-task-${task.id}`}
                                />
                              </div>
                            )}
                            
                            {/* Data columns */}
                            {visibleDataColumns.map((columnId: string) => {
                              switch (columnId) {
                                case 'title':
                                  return (
                                    <div 
                                      key={columnId} 
                                      className="font-medium cursor-pointer hover:text-primary text-[12px] truncate"
                                      onClick={() => onEditTask(task)}
                                      data-testid={`cell-title-${task.id}`}
                                    >
                                      {task.title}
                                    </div>
                                  );
                                case 'assignedTo':
                                  return (
                                    <div key={columnId} className="flex items-center">
                                      {assignedUser ? (
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-6 w-6 flex-shrink-0">
                                            <AvatarImage src={assignedUser.avatarUrl || ""} />
                                            <AvatarFallback className="text-[10px]">
                                              {assignedUser.firstName?.[0]}
                                              {assignedUser.lastName?.[0]}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="text-[11px] truncate">
                                            {assignedUser.firstName} {assignedUser.lastName}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[11px] text-muted-foreground">Non assigné</span>
                                      )}
                                    </div>
                                  );
                                case 'status':
                                  return (
                                    <div key={columnId} className="flex items-center">
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
                                            className="text-foreground min-w-[80px] cursor-pointer hover-elevate text-[12px]"
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
                                    </div>
                                  );
                                case 'priority':
                                  return (
                                    <div key={columnId} className="flex items-center">
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
                                    </div>
                                  );
                                case 'effort':
                                  return (
                                    <div key={columnId} className="flex items-center">
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
                                    </div>
                                  );
                                case 'dueDate':
                                  const dueDateInfo = (() => {
                                    if (!task.dueDate) return { progress: 0, color: '' };
                                    
                                    const due = new Date(task.dueDate).getTime();
                                    const now = Date.now();
                                    
                                    // Calculate days remaining
                                    const daysRemaining = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
                                    
                                    // Calculate progress based on urgency (days remaining)
                                    let progress = 0;
                                    let color = '';
                                    
                                    if (daysRemaining <= 0) {
                                      progress = 100;
                                      color = '[&>div]:bg-gradient-to-r [&>div]:from-red-500 [&>div]:to-red-600';
                                    } else if (daysRemaining <= 2) {
                                      progress = 75;
                                      color = '[&>div]:bg-gradient-to-r [&>div]:from-orange-400 [&>div]:to-red-500';
                                    } else if (daysRemaining <= 3) {
                                      progress = 50;
                                      color = '[&>div]:bg-gradient-to-r [&>div]:from-orange-400 [&>div]:to-orange-500';
                                    } else if (daysRemaining <= 5) {
                                      progress = 35;
                                      color = '[&>div]:bg-gradient-to-r [&>div]:from-yellow-400 [&>div]:to-orange-400';
                                    } else if (daysRemaining <= 8) {
                                      progress = 15;
                                      color = '[&>div]:bg-gradient-to-r [&>div]:from-green-400 [&>div]:to-green-500';
                                    } else {
                                      progress = 1;
                                      color = '[&>div]:bg-gradient-to-r [&>div]:from-green-400 [&>div]:to-green-500';
                                    }
                                    
                                    return { progress, color };
                                  })();
                                  
                                  return (
                                    <div key={columnId} className="flex items-center">
                                      <div className="flex flex-col gap-1.5">
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
                                              className="cursor-pointer hover-elevate min-w-[100px] text-[12px]"
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
                                        {task.dueDate && (
                                          <Progress 
                                            value={dueDateInfo.progress} 
                                            className={`h-1 w-full ${dueDateInfo.color}`}
                                            data-testid={`progress-due-date-${task.id}`}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  );
                                default:
                                  return null;
                              }
                            })}
                            
                            {/* Actions column */}
                            {hasActions && (
                              <div className="flex items-center justify-end">
                                <div className="flex items-center gap-1">
                                  {task.status === "done" ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground cursor-default"
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
                                      className="h-7 w-7 text-green-600 hover:text-green-700"
                                      onClick={() => {
                                        const doneColumn = columns.find(c => 
                                          c.name.toLowerCase().includes("terminé") || 
                                          c.name.toLowerCase().includes("done") || 
                                          c.name.toLowerCase().includes("complété")
                                        );
                                        
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
                                    className="h-7 w-7"
                                    onClick={() => onEditTask(task)}
                                    data-testid={`button-edit-task-${task.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => onDeleteTask(task)}
                                    data-testid={`button-delete-task-${task.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    
                    {/* Quick add task row */}
                    <div 
                      className="gap-2 px-4 py-2 items-center border-t min-w-max"
                      style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
                    >
                      {hasCheckbox && <div />}
                      <div style={{ gridColumn: `span ${visibleDataColumns.length}` }} className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Nouvelle tâche..."
                          value={quickAddTaskTitle}
                          onChange={(e) => setQuickAddTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && quickAddTaskTitle.trim()) {
                              onCreateTask();
                            } else if (e.key === "Escape") {
                              setQuickAddTaskTitle("");
                            }
                          }}
                          disabled={isQuickAddingTask}
                          className="border-0 focus-visible:ring-0 text-[11px] h-8 flex-1"
                          data-testid="input-quick-add-task"
                        />
                      </div>
                      {hasActions && <div />}
                    </div>
                  </div>
                </DndContext>
              </div>
            );
          })()}
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
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Rattacher les tâches à un projet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[12px]">Projet de destination</Label>
              <Select value={attachProjectId} onValueChange={setAttachProjectId}>
                <SelectTrigger data-testid="select-attach-project">
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
      
      {/* Sheet for column visibility management */}
      <Sheet open={isColumnSheetOpen} onOpenChange={setIsColumnSheetOpen}>
        <SheetContent className="w-80" data-testid="sheet-task-columns">
          <SheetHeader>
            <SheetTitle>Colonnes visibles</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-4">
            {defaultTaskColumns.map((columnId) => {
              const columnLabels: Record<string, string> = {
                checkbox: "Sélection",
                title: "Tâche",
                assignedTo: "Assigné à",
                status: "Statut",
                priority: "Priorité",
                effort: "Effort",
                dueDate: "Échéance",
                actions: "Actions",
              };
              const isDisabled = columnId === "checkbox" || columnId === "title" || columnId === "actions";
              return (
                <div key={columnId} className="flex items-center justify-between">
                  <Label htmlFor={`task-col-${columnId}`} className="text-sm">
                    {columnLabels[columnId]}
                  </Label>
                  <Switch
                    id={`task-col-${columnId}`}
                    checked={visibleColumns.has(columnId)}
                    onCheckedChange={() => toggleColumnVisibility(columnId)}
                    disabled={isDisabled}
                    data-testid={`switch-task-column-${columnId}`}
                  />
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
