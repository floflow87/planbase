import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Star, Trash2, CheckCircle2, ListTodo, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Task, AppUser, Project, TaskColumn, Backlog, Sprint } from "@shared/schema";
import { formatDateForStorage } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type BacklogWithSprints = Backlog & { sprints?: Sprint[] };

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

interface TaskDetailModalProps {
  task: Task | null;
  users: AppUser[];
  projects: Project[];
  columns: TaskColumn[];
  backlogs?: BacklogWithSprints[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  onDelete?: (task: Task) => void;
  onCreateTicket?: (task: Task, backlogId: string, sprintId: string | null, ticketTitle: string) => void;
}

export function TaskDetailModal({
  task,
  users,
  projects,
  columns,
  backlogs = [],
  isOpen,
  onClose,
  onSave,
  onDelete,
  onCreateTicket,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedToId, setAssignedToId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [selectedColumnId, setSelectedColumnId] = useState<string>("");
  const [projectId, setProjectId] = useState<string | undefined>();
  const [effort, setEffort] = useState<number | null>(null);
  
  // Create ticket dialog state
  const [showCreateTicketDialog, setShowCreateTicketDialog] = useState(false);
  const [selectedBacklogId, setSelectedBacklogId] = useState<string>("");
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [ticketTitle, setTicketTitle] = useState("");
  const [backlogSearchOpen, setBacklogSearchOpen] = useState(false);

  // Display ONLY columns from the task's project (no global columns to avoid duplicates)
  const columnOptions = useMemo(() => {
    // Filter to only show columns for the task's project (not global columns)
    const projectColumns = projectId 
      ? columns.filter(col => col.projectId === projectId)
      : columns.filter(col => !col.projectId);
    
    // Sort columns by order to maintain a consistent sequence
    const sortedColumns = [...projectColumns].sort((a, b) => a.order - b.order);
    
    return sortedColumns.map(column => ({
      id: column.id,
      name: column.name,
      status: getStatusFromColumnName(column.name),
    }));
  }, [columns, projectId]);

  // Get sprints for selected backlog
  const selectedBacklog = useMemo(() => {
    return backlogs.find(b => b.id === selectedBacklogId);
  }, [backlogs, selectedBacklogId]);
  
  const sprintsForBacklog = useMemo(() => {
    return selectedBacklog?.sprints || [];
  }, [selectedBacklog]);

  // Handle opening create ticket dialog
  const handleOpenCreateTicket = () => {
    setTicketTitle(title); // Pre-fill with task title
    setSelectedBacklogId("");
    setSelectedSprintId(null);
    setShowCreateTicketDialog(true);
  };

  // Handle creating ticket
  const handleCreateTicket = () => {
    if (!task || !selectedBacklogId || !ticketTitle.trim()) return;
    onCreateTicket?.(task, selectedBacklogId, selectedSprintId, ticketTitle.trim());
    setShowCreateTicketDialog(false);
  };

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setAssignedToId(task.assignedToId || undefined);
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
      setSelectedColumnId(task.columnId || "");
      setProjectId(task.projectId || undefined);
      setEffort(task.effort ?? null);
    }
  }, [task]);

  const handleSave = () => {
    if (!task) return;

    // Get the selected column to derive the status
    const selectedColumn = columns.find((c) => c.id === selectedColumnId);
    const derivedStatus = selectedColumn ? getStatusFromColumnName(selectedColumn.name) : task.status;

    // Build the update object
    // If projectId is undefined, user selected "no-project", so we send null
    // If projectId has a value, we send that value
    const updates: Partial<Task> = {
      id: task.id,
      title,
      description,
      priority,
      assignedToId: assignedToId || null,
      dueDate: dueDate ? formatDateForStorage(dueDate) : null,
      status: derivedStatus,
      columnId: selectedColumnId || null,
      projectId: projectId === undefined ? null : projectId,
      effort: effort,
    };

    // Set progress to 100 if moving to a "done" column
    if (derivedStatus === "done" && task.status !== "done") {
      updates.progress = 100;
    }

    onSave(updates);
    onClose();
  };

  if (!task) return null;

  // Derive current status from selected column
  const currentColumn = columns.find((c) => c.id === selectedColumnId);
  const currentStatus = currentColumn ? getStatusFromColumnName(currentColumn.name) : "todo";

  const handleMarkComplete = () => {
    if (currentStatus === "done") {
      // If already in a done column, move to first todo column
      const todoColumn = columns.find((c) => getStatusFromColumnName(c.name) === "todo");
      if (todoColumn) {
        setSelectedColumnId(todoColumn.id);
      }
    } else {
      // Move to done column
      const doneColumn = columns.find((c) => getStatusFromColumnName(c.name) === "done");
      if (doneColumn) {
        setSelectedColumnId(doneColumn.id);
      }
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col bg-white dark:bg-card" data-testid="dialog-task-detail">
        <SheetHeader className="space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <SheetTitle>Détails de la tâche</SheetTitle>
            {/* Check button just after title on the left */}
            <Button
              variant={currentStatus === "done" ? "default" : "outline"}
              size="icon"
              className={`h-10 w-10 ${
                currentStatus === "done" 
                  ? "bg-green-500 hover:bg-green-600 text-white border-green-600" 
                  : "hover-elevate"
              }`}
              style={{ borderRadius: '10px' }}
              onClick={handleMarkComplete}
              data-testid="button-mark-complete"
              title={currentStatus === "done" ? "Décocher la tâche" : "Marquer comme terminée"}
            >
              <CheckCircle2 className="h-6 w-6" />
            </Button>
          </div>
        </SheetHeader>
        
        <div className="grid gap-4 py-4 flex-1">
          <div className="grid gap-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-task-title"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              data-testid="textarea-task-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="priority">Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority" data-testid="select-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Statut</Label>
              <Select value={selectedColumnId} onValueChange={setSelectedColumnId}>
                <SelectTrigger id="status" data-testid="select-task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columnOptions.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Effort / Complexité</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setEffort(rating)}
                  className="focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                  data-testid={`button-effort-${rating}`}
                >
                  <Star
                    className={`h-6 w-6 transition-colors ${(effort ?? 0) >= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-200'}`}
                  />
                </button>
              ))}
              {effort !== null && (
                <button
                  type="button"
                  onClick={() => setEffort(null)}
                  className="ml-2 text-sm text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-effort"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="assignedTo">Assigné à</Label>
              <Select 
                value={assignedToId || "unassigned"} 
                onValueChange={(value) => setAssignedToId(value === "unassigned" ? undefined : value)}
              >
                <SelectTrigger id="assignedTo" data-testid="select-task-assignee">
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

            <div className="grid gap-2">
              <Label htmlFor="project">Projet</Label>
              <Select 
                value={projectId || "no-project"} 
                onValueChange={(value) => {
                  const newProjectId = value === "no-project" ? undefined : value;
                  setProjectId(newProjectId);
                  // Reset columnId when project changes - get first column of new project or empty
                  const newProjectColumns = columns.filter(col => col.projectId === newProjectId);
                  const sortedColumns = [...newProjectColumns].sort((a, b) => a.order - b.order);
                  setSelectedColumnId(sortedColumns[0]?.id || "");
                }}
              >
                <SelectTrigger id="project" data-testid="select-task-project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-project">Aucun projet</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Date d'échéance</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-start text-left font-normal text-[14px] pt-[0px] pb-[0px] pl-[16px] pr-[16px]"
                  data-testid="button-task-due-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? (
                    format(dueDate, "PPP", { locale: fr })
                  ) : (
                    <span>Choisir une date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className="bg-[#ffffff]"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex gap-2 justify-between pt-4 border-t">
          <div className="flex gap-2">
            {onDelete && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (task) {
                    onDelete(task);
                    onClose();
                  }
                }}
                data-testid="button-delete-task"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            )}
            {onCreateTicket && backlogs.length > 0 && (
              <Button
                variant="outline"
                onClick={handleOpenCreateTicket}
                data-testid="button-create-ticket-from-task"
              >
                <ListTodo className="h-4 w-4 mr-2" />
                Créer un ticket
              </Button>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            <Button 
              variant="outline" 
              onClick={onClose}
              data-testid="button-cancel"
            >
              Annuler
            </Button>
            <Button 
              onClick={handleSave}
              data-testid="button-save-task"
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </SheetContent>
      
      {/* Create Ticket Dialog */}
      <Dialog open={showCreateTicketDialog} onOpenChange={setShowCreateTicketDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-card">
          <DialogHeader>
            <DialogTitle>Créer un ticket</DialogTitle>
            <DialogDescription>
              Créer un ticket à partir de cette tâche dans un backlog.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ticketTitle">Titre du ticket</Label>
              <Input
                id="ticketTitle"
                value={ticketTitle}
                onChange={(e) => setTicketTitle(e.target.value)}
                placeholder="Titre du ticket"
                data-testid="input-ticket-title"
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Backlog</Label>
              <Popover open={backlogSearchOpen} onOpenChange={setBacklogSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={backlogSearchOpen}
                    className="justify-between"
                    data-testid="select-backlog"
                  >
                    {selectedBacklogId
                      ? backlogs.find(b => b.id === selectedBacklogId)?.name || "Sélectionner"
                      : "Sélectionner un backlog"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-white dark:bg-card">
                  <Command>
                    <CommandInput placeholder="Rechercher un backlog..." />
                    <CommandList>
                      <CommandEmpty>Aucun backlog trouvé</CommandEmpty>
                      <CommandGroup>
                        {backlogs.map((backlog) => (
                          <CommandItem
                            key={backlog.id}
                            value={backlog.name}
                            onSelect={() => {
                              setSelectedBacklogId(backlog.id);
                              setSelectedSprintId(null);
                              setBacklogSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedBacklogId === backlog.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {backlog.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            {selectedBacklogId && (
              <div className="grid gap-2">
                <Label htmlFor="sprint">Sprint (optionnel)</Label>
                <Select
                  value={selectedSprintId || "no-sprint"}
                  onValueChange={(val) => setSelectedSprintId(val === "no-sprint" ? null : val)}
                >
                  <SelectTrigger data-testid="select-sprint">
                    <SelectValue placeholder="Backlog (pas de sprint)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-sprint">Backlog (pas de sprint)</SelectItem>
                    {sprintsForBacklog.map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateTicketDialog(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateTicket}
              disabled={!selectedBacklogId || !ticketTitle.trim()}
              data-testid="button-confirm-create-ticket"
            >
              Créer le ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
