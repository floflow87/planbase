import { useState, useEffect } from "react";
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
import { CalendarIcon, Star, Trash2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Task, AppUser, Project, TaskColumn } from "@shared/schema";

interface TaskDetailModalProps {
  task: Task | null;
  users: AppUser[];
  projects: Project[];
  columns: TaskColumn[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  onDelete?: (task: Task) => void;
}

export function TaskDetailModal({
  task,
  users,
  projects,
  columns,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedToId, setAssignedToId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [status, setStatus] = useState("todo");
  const [projectId, setProjectId] = useState<string | undefined>();
  const [effort, setEffort] = useState<number | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setAssignedToId(task.assignedToId || undefined);
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
      setStatus(task.status || "todo");
      setProjectId(task.projectId || undefined);
      setEffort(task.effort ?? null);
    }
  }, [task]);

  const handleSave = () => {
    if (!task) return;

    // Build the update object
    const updates: Partial<Task> = {
      id: task.id,
      title,
      description,
      priority,
      assignedToId: assignedToId || null,
      dueDate: dueDate ? dueDate.toISOString() : null,
      status,
      projectId: projectId || task.projectId,
      effort: effort,
    };

    // Only sync columnId if status changed to "done"
    if (status === "done" && status !== task.status) {
      // Find the "Terminé" column by name
      const doneColumn = columns.find((c) => c.name.toLowerCase().includes("terminé") || c.name.toLowerCase().includes("done"));
      
      // If we found the done column, move the task there
      if (doneColumn && task.columnId !== doneColumn.id) {
        updates.columnId = doneColumn.id;
        updates.progress = 100;
      }
    } else if (status !== "done" && task.status === "done") {
      // If unmarking as done, try to find the appropriate column based on the new status
      let targetColumn;
      
      if (status === "todo") {
        targetColumn = columns.find((c) => c.name.toLowerCase().includes("à faire") || c.name.toLowerCase().includes("todo") || c.name.toLowerCase().includes("backlog"));
      } else if (status === "in_progress") {
        targetColumn = columns.find((c) => c.name.toLowerCase().includes("en cours") || c.name.toLowerCase().includes("progress") || c.name.toLowerCase().includes("doing"));
      } else if (status === "review") {
        targetColumn = columns.find((c) => c.name.toLowerCase().includes("revue") || c.name.toLowerCase().includes("review") || c.name.toLowerCase().includes("validation"));
      }
      
      // If we found a matching column, update columnId
      if (targetColumn) {
        updates.columnId = targetColumn.id;
      }
    }

    onSave(updates);
    onClose();
  };

  if (!task) return null;

  const handleMarkComplete = () => {
    // Toggle: if already done, set back to todo, otherwise set to done
    setStatus(status === "done" ? "todo" : "done");
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col" data-testid="dialog-task-detail">
        <SheetHeader className="space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <SheetTitle>Détails de la tâche</SheetTitle>
            {/* Check button just after title on the left */}
            <Button
              variant={status === "done" ? "default" : "outline"}
              size="icon"
              className={`h-10 w-10 ${
                status === "done" 
                  ? "bg-green-500 hover:bg-green-600 text-white border-green-600" 
                  : "hover-elevate"
              }`}
              style={{ borderRadius: '10px' }}
              onClick={handleMarkComplete}
              data-testid="button-mark-complete"
              title={status === "done" ? "Décocher la tâche" : "Marquer comme terminée"}
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
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status" data-testid="select-task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="review">En révision</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
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
                onValueChange={(value) => setProjectId(value === "no-project" ? undefined : value)}
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
    </Sheet>
  );
}
