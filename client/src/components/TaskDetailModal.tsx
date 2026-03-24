import { useState, useEffect, useMemo, useRef } from "react";
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
import { CalendarIcon, Star, Trash2, CheckCircle2, ListTodo, Check, ChevronsUpDown, Paperclip, File, Image, Plus, Download, Circle, Package, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import type { Task, AppUser, Project, TaskColumn, Backlog, Sprint } from "@shared/schema";
import { formatDateForStorage, apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

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
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedToId, setAssignedToId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [selectedColumnId, setSelectedColumnId] = useState<string>("");
  const [projectId, setProjectId] = useState<string | undefined>();
  const [effort, setEffort] = useState<number | null>(null);
  const [scopeItemId, setScopeItemId] = useState<string | null>(null);

  // Fetch scope items for the livrable selector
  const { data: taskScopeItems = [] } = useQuery<any[]>({
    queryKey: ["/api/projects", task?.projectId, "scope-items-form"],
    queryFn: async () => {
      if (!task?.projectId) return [];
      const res = await apiRequest(`/api/projects/${task.projectId}/scope-items`, "GET");
      const data = await res.json();
      const items = data?.scopeItems ?? data ?? [];
      return items.filter((i: any) => i.isDeliverable === 1);
    },
    enabled: !!task?.projectId && isOpen,
  });

  // File attachments
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; mimeType: string } | null>(null);
  const taskFilesQK = ["/api/files", task?.id ?? "", "task-attachments"] as const;
  const { data: taskFiles = [] } = useQuery<any[]>({
    queryKey: taskFilesQK,
    queryFn: async () => {
      if (!task?.id) return [];
      const res = await apiRequest(`/api/files?taskId=${task.id}&kind=upload`, "GET");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!task?.id && isOpen,
  });
  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => apiRequest(`/api/files/${fileId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskFilesQK });
      toast({ title: "Fichier supprimé", variant: "success" as any });
    },
  });
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !task?.id) return;
    setUploadingFiles(true);
    let ok = 0; let ko = 0;
    for (const file of Array.from(fileList)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("taskId", task.id);
        if (task.projectId) formData.append("projectId", task.projectId);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || "";
        const res = await fetch("/api/files/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
        if (!res.ok) throw new Error(await res.text());
        ok++;
      } catch { ko++; }
    }
    setUploadingFiles(false);
    queryClient.invalidateQueries({ queryKey: taskFilesQK });
    if (e.target) e.target.value = "";
    if (ok > 0) toast({ title: `${ok} fichier${ok > 1 ? "s" : ""} joint${ok > 1 ? "s" : ""}`, variant: "success" as any });
    if (ko > 0) toast({ title: "Erreur", description: `${ko} fichier(s) n'ont pas pu être joints`, variant: "destructive" });
  };
  const handleOpenFilePreview = async (file: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      const res = await fetch(`/api/files/${file.id}/download-url`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      setPreviewFile({ name: file.name, url, mimeType: file.mimeType || "" });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ouvrir l'aperçu", variant: "destructive" });
    }
  };
  
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

  // Fetch scope items for the task's project (for timeline)
  const { data: projectScopeItems = [] } = useQuery<any[]>({
    queryKey: ["/api/projects", task?.projectId, "scope-items"],
    queryFn: async () => {
      if (!task?.projectId) return [];
      const res = await apiRequest(`/api/projects/${task.projectId}/scope-items`, "GET");
      return res.json();
    },
    select: (data: any) => Array.isArray(data) ? data : (data?.scopeItems ?? []),
    enabled: !!task?.projectId && !!task?.scopeItemId && isOpen,
  });

  // Fetch all tasks in the same project (for timeline siblings)
  const { data: projectTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/projects", task?.projectId, "tasks"],
    queryFn: async () => {
      if (!task?.projectId) return [];
      const res = await apiRequest(`/api/projects/${task.projectId}/tasks`, "GET");
      return res.json();
    },
    enabled: !!task?.projectId && !!task?.scopeItemId && isOpen,
  });

  // Compute timeline data
  const deliverableTimeline = useMemo(() => {
    if (!task?.scopeItemId) return null;
    const scopeItem = projectScopeItems.find((s: any) => s.id === task.scopeItemId);
    if (!scopeItem) return null;
    const siblings = projectTasks
      .filter((t: any) => t.scopeItemId === task.scopeItemId)
      .sort((a: any, b: any) => (a.positionInColumn ?? 0) - (b.positionInColumn ?? 0));
    const doneNames = ["terminé", "done", "complété", "termine", "finished", "closed"];
    const isDone = (t: any) => {
      if (t.status === "done") return true;
      const col = columns.find(c => c.id === t.columnId);
      if (col) return doneNames.some(n => col.name.toLowerCase().includes(n));
      return false;
    };
    const completedCount = siblings.filter(isDone).length;
    return { scopeItem, siblings, isDone, completedCount };
  }, [task, projectScopeItems, projectTasks, columns]);

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
      setScopeItemId((task as any).scopeItemId || null);
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
      ...({ scopeItemId: scopeItemId || null } as any),
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
      <SheetContent className="sm:max-w-lg w-full overflow-y-auto flex flex-col bg-white dark:bg-card" data-testid="dialog-task-detail">
        <SheetHeader className="space-y-0 pb-2">
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
        
        <div className="grid gap-2 py-2 flex-1">
          <div className="grid gap-1">
            <Label htmlFor="title" className="text-xs">Titre</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-sm"
              data-testid="input-task-title"
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="description" className="text-xs">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-sm"
              data-testid="textarea-task-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor="priority" className="text-xs">Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority" className="h-8 text-xs" data-testid="select-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" className="text-xs">Basse</SelectItem>
                  <SelectItem value="medium" className="text-xs">Moyenne</SelectItem>
                  <SelectItem value="high" className="text-xs">Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="status" className="text-xs">Statut</Label>
              <Select value={selectedColumnId} onValueChange={setSelectedColumnId}>
                <SelectTrigger id="status" className="h-8 text-xs" data-testid="select-task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columnOptions.map((column) => (
                    <SelectItem key={column.id} value={column.id} className="text-xs">
                      {column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Effort / Complexité</Label>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setEffort(rating)}
                  className="focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                  data-testid={`button-effort-${rating}`}
                >
                  <Star
                    className={`h-4 w-4 transition-colors ${(effort ?? 0) >= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-200'}`}
                  />
                </button>
              ))}
              {effort !== null && (
                <button
                  type="button"
                  onClick={() => setEffort(null)}
                  className="ml-1 text-xs text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-effort"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor="assignedTo" className="text-xs">Assigné à</Label>
              <Select 
                value={assignedToId || "unassigned"} 
                onValueChange={(value) => setAssignedToId(value === "unassigned" ? undefined : value)}
              >
                <SelectTrigger id="assignedTo" className="h-8" data-testid="select-task-assignee">
                  {(() => {
                    const sel = users.find(u => u.id === assignedToId);
                    if (!sel) return <span className="text-xs text-muted-foreground">Non assigné</span>;
                    const initials = sel.firstName ? sel.firstName[0] + (sel.lastName?.[0] || "") : sel.email[0];
                    const name = sel.firstName ? `${sel.firstName} ${sel.lastName || ""}`.trim() : sel.email;
                    return (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={sel.avatarUrl || ""} />
                          <AvatarFallback className="text-[9px]">{initials.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs truncate">{name}</span>
                      </div>
                    );
                  })()}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned" className="text-xs">Non assigné</SelectItem>
                  {users.map((u) => {
                    const initials = u.firstName ? u.firstName[0] + (u.lastName?.[0] || "") : u.email[0];
                    const name = u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.email;
                    return (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={u.avatarUrl || ""} />
                            <AvatarFallback className="text-[9px]">{initials.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span>{name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="project" className="text-xs">Projet</Label>
              <Select 
                value={projectId || "no-project"} 
                onValueChange={(value) => {
                  const newProjectId = value === "no-project" ? undefined : value;
                  setProjectId(newProjectId);
                  const newProjectColumns = columns.filter(col => col.projectId === newProjectId);
                  const sortedColumns = [...newProjectColumns].sort((a, b) => a.order - b.order);
                  setSelectedColumnId(sortedColumns[0]?.id || "");
                }}
              >
                <SelectTrigger id="project" className="h-8 text-xs" data-testid="select-task-project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-project" className="text-xs">Aucun projet</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id} className="text-xs">
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {task?.projectId && taskScopeItems.length > 0 && (
            <div className="grid gap-1">
              <Label className="text-xs">Livrable</Label>
              <Select
                value={scopeItemId || "none"}
                onValueChange={(v) => setScopeItemId(v === "none" ? null : v)}
              >
                <SelectTrigger className="h-8 text-xs" data-testid="select-task-scope-item">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">Aucun livrable</SelectItem>
                  {taskScopeItems.map((si: any) => (
                    <SelectItem key={si.id} value={si.id} className="text-xs">
                      {si.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-1">
            <Label className="text-xs">Date d'échéance</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-8 justify-start text-left font-normal text-xs"
                  data-testid="button-task-due-date"
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
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

          {/* File attachments */}
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Paperclip className="h-3 w-3" />
                Fichiers joints ({taskFiles.length})
              </Label>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                  onChange={handleFileUpload}
                  data-testid="input-task-file-upload"
                />
                <Button
                  size="icon"
                  className="bg-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFiles}
                  data-testid="button-add-task-file"
                >
                  {uploadingFiles ? (
                    <span className="h-3 w-3 animate-spin border border-white border-t-transparent rounded-full" />
                  ) : (
                    <Plus className="h-4 w-4 text-white" />
                  )}
                </Button>
              </div>
            </div>
            {taskFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {taskFiles.map((f: any) => {
                  const isImage = f.mimeType && f.mimeType.startsWith("image/");
                  return (
                    <div
                      key={f.id}
                      className="group relative border rounded-md p-2 bg-muted/30 hover-elevate cursor-pointer flex flex-col gap-1"
                      onClick={() => handleOpenFilePreview(f)}
                      data-testid={`task-file-${f.id}`}
                    >
                      <div className="flex items-center justify-center h-10">
                        {isImage ? <Image className="h-6 w-6 text-muted-foreground" /> : <File className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <p className="text-[10px] text-center truncate leading-tight">{f.name}</p>
                      <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={e => { e.stopPropagation(); deleteFileMutation.mutate(f.id); }}
                          data-testid={`button-delete-task-file-${f.id}`}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Deliverable Timeline */}
        {deliverableTimeline && (() => {
          const si = deliverableTimeline.scopeItem as any;
          const statusLabel = si.status === "delivered" ? "Livré" : si.status === "in_review" ? "À réviser" : si.status === "in_progress" ? "En cours" : "Planifié";
          const owner = si.owner;
          const ownerName = owner ? (owner.firstName ? `${owner.firstName} ${owner.lastName || ""}`.trim() : owner.email) : null;
          const allNodes = [
            { type: "scope" as const },
            ...deliverableTimeline.siblings.map((s: any) => ({ type: "task" as const, task: s })),
            { type: "delivery" as const },
          ];
          return (
            <div className="space-y-2 pt-2">
              <Separator />
              {/* Header block */}
              <div className="pt-1 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs font-semibold text-foreground leading-tight">{si.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground pl-4">
                  {statusLabel}{ownerName ? ` • ${ownerName}` : ""}
                </p>
                {deliverableTimeline.siblings.length > 0 && (
                  <p className="text-[10px] text-muted-foreground pl-4">
                    {deliverableTimeline.completedCount} / {deliverableTimeline.siblings.length} étapes
                  </p>
                )}
              </div>
              {/* Timeline */}
              <div className="flex flex-col pl-2">
                {allNodes.map((node, idx) => {
                  const isLast = idx === allNodes.length - 1;
                  let bullet: React.ReactNode;
                  let label: React.ReactNode;
                  let isActive = false;
                  if (node.type === "scope") {
                    bullet = <div className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0" />;
                    label = <span className="text-[11px] font-semibold text-foreground">{si.label}</span>;
                  } else if (node.type === "task") {
                    const t = node.task;
                    const isCurrent = t.id === task?.id;
                    const done = deliverableTimeline.isDone(t);
                    isActive = isCurrent;
                    if (done) {
                      bullet = <span className="text-primary flex-shrink-0 text-[11px] leading-none">🚀</span>;
                    } else if (isCurrent) {
                      bullet = <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ border: "1.5px dashed var(--primary)", background: "hsl(var(--primary)/0.12)" }} />;
                    } else {
                      bullet = <Circle className="h-3 w-3 text-muted-foreground/35 flex-shrink-0" />;
                    }
                    label = (
                      <span className={cn("text-[11px] leading-tight", done ? "text-primary/70 font-medium" : isCurrent ? "font-medium text-foreground" : "text-muted-foreground")}>
                        {t.title}
                        {isCurrent && <span className="ml-1.5 text-[11px]">👈</span>}
                      </span>
                    );
                  } else {
                    const delivered = !!(si as any).completedAt;
                    bullet = <div className={cn("h-2.5 w-2.5 rounded-full border-2 flex-shrink-0", delivered ? "border-green-500 bg-green-500" : "border-muted-foreground/25 bg-transparent")} />;
                    label = <span className={cn("text-[11px] italic", delivered ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground/50")}>Livraison du livrable</span>;
                  }
                  return (
                    <div key={idx}>
                      <div className={cn("flex items-center gap-2.5 py-1.5", isActive && "rounded px-1 -mx-1")}
                        style={isActive ? { border: "1px dashed hsl(var(--primary)/0.4)", background: "hsl(var(--primary)/0.05)" } : undefined}>
                        {bullet}
                        {label}
                      </div>
                      {!isLast && (
                        <div className="ml-[5px] w-px bg-muted-foreground/30" style={{ height: "10px" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* File preview dialog */}
        <Dialog open={!!previewFile} onOpenChange={open => !open && setPreviewFile(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{previewFile?.name}</DialogTitle>
              <DialogDescription />
            </DialogHeader>
            <div className="flex items-center justify-center min-h-[300px] bg-muted/30 rounded-md overflow-hidden">
              {previewFile?.mimeType?.startsWith("image/") ? (
                <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-[65vh] object-contain" />
              ) : previewFile?.mimeType === "application/pdf" ? (
                <iframe src={previewFile.url} className="w-full h-[65vh] border-0" title={previewFile.name} />
              ) : (
                <div className="text-center space-y-3 p-8">
                  <File className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Aperçu non disponible pour ce type de fichier.</p>
                  <Button size="sm" asChild>
                    <a href={previewFile?.url} download={previewFile?.name} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex gap-2 justify-between pt-4 border-t">
          <div className="flex gap-2">
            {onDelete && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs text-destructive hover:text-destructive"
                onClick={() => {
                  if (task) {
                    onDelete(task);
                    onClose();
                  }
                }}
                data-testid="button-delete-task"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Supprimer
              </Button>
            )}
            {onCreateTicket && backlogs.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={handleOpenCreateTicket}
                data-testid="button-create-ticket-from-task"
              >
                <ListTodo className="h-3.5 w-3.5 mr-1.5" />
                Créer un ticket
              </Button>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            <Button 
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={onClose}
              data-testid="button-cancel"
            >
              Annuler
            </Button>
            <Button 
              size="sm"
              className="text-xs"
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
