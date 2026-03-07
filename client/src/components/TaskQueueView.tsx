import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, formatDateForStorage } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  X,
  SkipForward,
  CheckCircle2,
  CalendarIcon,
  ChevronLeft,
  Star,
  Send,
  Play,
  MessageSquare,
  Clock,
  Briefcase,
  User,
  Tag,
  RotateCcw,
  Trash2,
  Pencil,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getTaskPriorityLabel,
  getTaskPriorityBadgeClass,
  getTaskStatusLabel,
} from "@shared/config";
import type { Task, TaskColumn, Project, Client, AppUser, TicketComment } from "@shared/schema";

function getProjectColor(id: string): string {
  const colors = ["#7C3AED", "#2563EB", "#16A34A", "#EA580C", "#DB2777", "#0891B2", "#D97706", "#4F46E5"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

interface TaskQueueViewProps {
  tasks: Task[];
  taskColumns: TaskColumn[];
  projects: Project[];
  users: AppUser[];
  onClose: () => void;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function buildInitialQueue(tasks: Task[], taskColumns: TaskColumn[]): Task[] {
  const doneColumnIds = new Set(
    taskColumns
      .filter((c) => c.isLocked)
      .sort((a, b) => b.order - a.order)
      .filter((_, i) => i === 0 || true)
      .map((c) => c.id)
  );

  const completedColIds = taskColumns
    .filter((c) => {
      const name = (c.name || "").toLowerCase();
      return (
        name.includes("terminé") ||
        name.includes("done") ||
        name.includes("complété") ||
        name.includes("termine")
      );
    })
    .map((c) => c.id);

  return tasks
    .filter((t) => {
      if (t.status === "done") return false;
      if (completedColIds.includes(t.columnId || "")) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (diff !== 0) return diff;
      } else if (a.dueDate && !b.dueDate) return -1;
      else if (!a.dueDate && b.dueDate) return 1;
      const pa = PRIORITY_ORDER[a.priority || "medium"] ?? 1;
      const pb = PRIORITY_ORDER[b.priority || "medium"] ?? 1;
      return pa - pb;
    });
}

function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          className="text-muted-foreground hover:text-yellow-400 transition-colors"
          data-testid={`star-effort-${i}`}
        >
          <Star
            className={`w-4 h-4 ${(hovered ?? value ?? 0) >= i ? "fill-yellow-400 text-yellow-400" : ""}`}
          />
        </button>
      ))}
    </div>
  );
}

function CommentItem({
  comment,
  users,
  currentUserId,
  onDelete,
  onEdit,
}: {
  comment: TicketComment;
  users: AppUser[];
  currentUserId?: string;
  onDelete?: (commentId: string) => void;
  onEdit?: (commentId: string, content: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.content);

  const author = users.find((u) => u.id === comment.authorId);
  const initials = author
    ? `${(author.firstName || "")[0] || ""}${(author.lastName || "")[0] || ""}`.toUpperCase() || "?"
    : "?";
  const displayName = author
    ? `${author.firstName || ""} ${author.lastName || ""}`.trim() || author.email
    : "Inconnu";
  const isAuthor = comment.authorId === currentUserId;

  const handleSaveEdit = () => {
    if (editValue.trim() && onEdit) {
      onEdit(comment.id, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(comment.content);
    setIsEditing(false);
  };

  return (
    <div className="flex gap-3 group" data-testid={`comment-item-${comment.id}`}>
      <Avatar className="w-7 h-7 shrink-0 mt-0.5">
        <AvatarImage src={author?.avatarUrl || undefined} />
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground">{displayName}</span>
          <span className="text-[10px] text-muted-foreground">
            {comment.createdAt
              ? format(new Date(comment.createdAt), "d MMM yyyy à HH:mm", { locale: fr })
              : ""}
          </span>
          {isAuthor && !isEditing && (
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { setEditValue(comment.content); setIsEditing(true); }}
                data-testid={`button-edit-comment-${comment.id}`}
              >
                <Pencil className="w-3 h-3" />
              </button>
              {onDelete && (
                <button
                  type="button"
                  className="text-destructive hover:text-destructive/80 transition-colors"
                  onClick={() => onDelete(comment.id)}
                  data-testid={`button-delete-comment-${comment.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
        {isEditing ? (
          <div className="mt-1 flex gap-2 items-start">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit();
                if (e.key === "Escape") handleCancelEdit();
              }}
              className="text-sm flex-1 h-8"
              autoFocus
              data-testid={`input-edit-comment-${comment.id}`}
            />
            <button
              type="button"
              className="text-green-600 hover:text-green-700 transition-colors mt-1.5"
              onClick={handleSaveEdit}
              data-testid={`button-save-comment-${comment.id}`}
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors mt-1.5"
              onClick={handleCancelEdit}
              data-testid={`button-cancel-comment-${comment.id}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
        )}
      </div>
    </div>
  );
}

export function TaskQueueView({ tasks, taskColumns, projects, users, onClose }: TaskQueueViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Find the current user's DB record (app_users ID, distinct from Supabase auth UUID)
  const currentDbUser = useMemo(
    () => users.find(u => u.email === user?.email),
    [users, user?.email]
  );

  // Sync URL with queue view being open
  useEffect(() => {
    setLocation("/tasks?queue=1");
    return () => {
      setLocation("/tasks");
    };
  }, []);

  const [initialQueue] = useState<Task[]>(() => buildInitialQueue(tasks, taskColumns));
  const [pendingQueue, setPendingQueue] = useState<Task[]>(() => buildInitialQueue(tasks, taskColumns));
  const [skippedStack, setSkippedStack] = useState<Task[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  const [commentText, setCommentText] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [localTitle, setLocalTitle] = useState("");
  const [localDescription, setLocalDescription] = useState("");
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTask = pendingQueue[0] ?? null;

  useEffect(() => {
    if (currentTask) {
      setLocalTitle(currentTask.title || "");
      setLocalDescription(currentTask.description || "");
      setRescheduleDate(currentTask.dueDate ? new Date(currentTask.dueDate) : undefined);
    }
  }, [currentTask?.id]);

  const { data: comments = [], isLoading: commentsLoading } = useQuery<TicketComment[]>({
    queryKey: ["/api/tickets", currentTask?.id, "task/comments"],
    enabled: !!currentTask?.id,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const patchTask = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      return apiRequest(`/api/tasks/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour la tâche.", variant: "destructive" });
    },
  });

  const addComment = useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      return apiRequest(`/api/tickets/${taskId}/task/comments`, "POST", { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", currentTask?.id, "task/comments"] });
      setCommentText("");
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'ajouter le commentaire.", variant: "destructive" });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest(`/api/ticket-comments/${commentId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", currentTask?.id, "task/comments"] });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le commentaire.", variant: "destructive" });
    },
  });

  const editComment = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      return apiRequest(`/api/ticket-comments/${commentId}`, "PATCH", { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", currentTask?.id, "task/comments"] });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le commentaire.", variant: "destructive" });
    },
  });

  const transition = useCallback((next: () => void) => {
    setIsTransitioning(true);
    setTimeout(() => {
      next();
      setIsTransitioning(false);
    }, 180);
  }, []);

  const handleComplete = useCallback(() => {
    if (!currentTask) return;
    const doneColumn = taskColumns
      .filter((c) => {
        const name = (c.name || "").toLowerCase();
        return name.includes("terminé") || name.includes("done") || name.includes("complété") || name.includes("termine");
      })
      .sort((a, b) => b.order - a.order)[0];

    patchTask.mutate({
      id: currentTask.id,
      data: {
        status: "done",
        ...(doneColumn ? { columnId: doneColumn.id } : {}),
      },
    });
    setProcessedCount((c) => c + 1);
    transition(() => {
      setPendingQueue((q) => q.slice(1));
    });
  }, [currentTask, taskColumns, patchTask, transition]);

  const handleSkip = useCallback(() => {
    if (!currentTask) return;
    setSkippedStack((s) => [...s, currentTask]);
    transition(() => {
      setPendingQueue((q) => q.slice(1));
    });
  }, [currentTask, transition]);

  const handleReschedule = useCallback(() => {
    if (!currentTask || !rescheduleDate) return;
    patchTask.mutate({
      id: currentTask.id,
      data: { dueDate: formatDateForStorage(rescheduleDate) as any },
    });
    setProcessedCount((c) => c + 1);
    setRescheduleOpen(false);
    transition(() => {
      setPendingQueue((q) => q.slice(1));
    });
  }, [currentTask, rescheduleDate, patchTask, transition]);

  const handleBack = useCallback(() => {
    if (skippedStack.length === 0) return;
    const last = skippedStack[skippedStack.length - 1];
    setSkippedStack((s) => s.slice(0, -1));
    transition(() => {
      setPendingQueue((q) => [last, ...q]);
    });
  }, [skippedStack, transition]);

  const handleFieldPatch = useCallback(
    (field: keyof Task, value: unknown) => {
      if (!currentTask) return;
      patchTask.mutate({ id: currentTask.id, data: { [field]: value } as Partial<Task> });
      setPendingQueue((q) =>
        q.map((t, i) => (i === 0 ? { ...t, [field]: value } : t))
      );
    },
    [currentTask, patchTask]
  );

  const handleTitleChange = (v: string) => {
    setLocalTitle(v);
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(() => {
      if (currentTask && v.trim()) handleFieldPatch("title", v.trim());
    }, 800);
  };

  const handleDescChange = (v: string) => {
    setLocalDescription(v);
    if (descSaveTimer.current) clearTimeout(descSaveTimer.current);
    descSaveTimer.current = setTimeout(() => {
      if (currentTask) handleFieldPatch("description", v);
    }, 800);
  };

  const handleAddComment = () => {
    if (!currentTask || !commentText.trim()) return;
    addComment.mutate({ taskId: currentTask.id, content: commentText.trim() });
  };

  const totalInitial = initialQueue.length;
  const remaining = pendingQueue.length;
  const position = totalInitial - remaining + 1;
  const progressPct = totalInitial > 0 ? Math.round((processedCount / totalInitial) * 100) : 0;

  const currentProject = currentTask?.projectId
    ? projects.find((p) => p.id === currentTask.projectId)
    : null;
  const currentClient = currentTask?.clientId
    ? clients.find((c) => c.id === currentTask.clientId)
    : null;

  const doneColumn = taskColumns
    .filter((c) => {
      const name = (c.name || "").toLowerCase();
      return name.includes("terminé") || name.includes("done") || name.includes("complété") || name.includes("termine");
    })
    .sort((a, b) => b.order - a.order)[0];

  const statusColumns = taskColumns.filter((c) => !doneColumn || c.id !== doneColumn.id);

  if (initialQueue.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-background flex flex-col items-center justify-center gap-6 p-8">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold">Aucune tâche à traiter</h2>
          <p className="text-muted-foreground text-sm">
            Toutes vos tâches sont déjà terminées ou aucune tâche n'est disponible.
          </p>
          <Button onClick={onClose} data-testid="button-queue-close-empty">
            Retour à la liste
          </Button>
        </div>
      </div>
    );
  }

  if (pendingQueue.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-background flex flex-col items-center justify-center gap-6 p-8">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold">File de tâches terminée !</h2>
          <p className="text-muted-foreground text-sm">
            {processedCount > 0
              ? `Vous avez traité ${processedCount} tâche${processedCount > 1 ? "s" : ""} avec succès.`
              : "Vous avez parcouru toute la file."}
            {skippedStack.length > 0 && ` ${skippedStack.length} tâche${skippedStack.length > 1 ? "s ont" : " a"} été passée${skippedStack.length > 1 ? "s" : ""}.`}
          </p>
          {skippedStack.length > 0 && (
            <Button variant="outline" onClick={handleBack} data-testid="button-queue-review-skipped">
              <RotateCcw className="w-4 h-4 mr-2" />
              Revoir les tâches passées ({skippedStack.length})
            </Button>
          )}
          <Button onClick={onClose} data-testid="button-queue-close-done">
            Retour à la liste
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-background flex flex-col" data-testid="task-queue-view">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b bg-white dark:bg-background shrink-0">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Play className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">File de tâches</span>
        </div>
        <div className="flex-1 flex items-center gap-3">
          <Progress value={progressPct} className="h-1.5 max-w-xs" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {position} / {totalInitial}
          </span>
        </div>
        {currentTask?.dueDate && (
          <Badge variant="outline" className="text-xs gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(currentTask.dueDate), "d MMM", { locale: fr })}
          </Badge>
        )}
        {currentProject && (
          <Badge
            variant="secondary"
            className="text-xs max-w-[180px] truncate cursor-pointer hover-elevate text-white"
            style={{ backgroundColor: getProjectColor(currentProject.id) }}
            onClick={() => { onClose(); setLocation(`/projects/${currentProject.id}`); }}
          >
            {currentProject.name}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-queue-close"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Main content */}
      <div
        className={`flex-1 flex overflow-hidden transition-opacity duration-150 ${isTransitioning ? "opacity-0" : "opacity-100"}`}
      >
        {/* Left panel */}
        <div className="w-64 shrink-0 border-r bg-muted/20 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Tag className="w-3 h-3" />
              Priorité
            </label>
            <Select
              value={currentTask?.priority || "medium"}
              onValueChange={(v) => handleFieldPatch("priority", v)}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-queue-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Haute</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="low">Basse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status / Column */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <RotateCcw className="w-3 h-3" />
              Statut
            </label>
            <Select
              value={currentTask?.columnId || ""}
              onValueChange={(v) => handleFieldPatch("columnId", v)}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-queue-status">
                <SelectValue placeholder="Colonne..." />
              </SelectTrigger>
              <SelectContent>
                {taskColumns.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Effort */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Star className="w-3 h-3" />
              Effort
            </label>
            <StarRating
              value={currentTask?.effort ?? null}
              onChange={(v) => handleFieldPatch("effort", v)}
            />
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CalendarIcon className="w-3 h-3" />
              Échéance
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-8 w-full justify-start text-xs font-normal"
                  data-testid="button-queue-duedate"
                >
                  {currentTask?.dueDate
                    ? format(new Date(currentTask.dueDate), "d MMM yyyy", { locale: fr })
                    : "Aucune date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={currentTask?.dueDate ? new Date(currentTask.dueDate) : undefined}
                  onSelect={(d) => {
                    if (d) handleFieldPatch("dueDate", formatDateForStorage(d) as any);
                  }}
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <User className="w-3 h-3" />
              Assigné à
            </label>
            <Select
              value={currentTask?.assignedToId || "none"}
              onValueChange={(v) => handleFieldPatch("assignedToId", v === "none" ? null : v)}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-queue-assignee">
                <SelectValue placeholder="Personne..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Briefcase className="w-3 h-3" />
              Projet
            </label>
            <Select
              value={currentTask?.projectId || "none"}
              onValueChange={(v) => handleFieldPatch("projectId", v === "none" ? null : v)}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-queue-project">
                <SelectValue placeholder="Aucun projet..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun projet</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <User className="w-3 h-3" />
              Client
            </label>
            <Select
              value={currentTask?.clientId || "none"}
              onValueChange={(v) => handleFieldPatch("clientId", v === "none" ? null : v)}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-queue-client">
                <SelectValue placeholder="Aucun client..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun client</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Action bar */}
          <div className="flex items-center justify-between px-8 py-3 border-b shrink-0 gap-3">
            <div className="flex items-center gap-2">
              {skippedStack.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  data-testid="button-queue-back"
                  className="text-xs gap-1.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Revenir
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {skippedStack.length}
                  </Badge>
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                data-testid="button-queue-skip"
                className="text-xs gap-1.5"
                disabled={patchTask.isPending}
              >
                <SkipForward className="w-3.5 h-3.5" />
                Passer
              </Button>

              <Popover open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-queue-reschedule"
                    className="text-xs gap-1.5"
                    disabled={patchTask.isPending}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    Replanifier
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-3 pb-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Nouvelle date d'échéance</p>
                    <Calendar
                      mode="single"
                      selected={rescheduleDate}
                      onSelect={setRescheduleDate}
                      locale={fr}
                    />
                    <div className="flex gap-2 mt-2 pt-2 border-t">
                      <Button
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={handleReschedule}
                        disabled={!rescheduleDate || patchTask.isPending}
                        data-testid="button-queue-reschedule-confirm"
                      >
                        Confirmer
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => setRescheduleOpen(false)}
                        data-testid="button-queue-reschedule-cancel"
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                size="sm"
                onClick={handleComplete}
                data-testid="button-queue-complete"
                className="text-xs gap-1.5"
                disabled={patchTask.isPending}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Terminer
              </Button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {/* Title */}
            <Input
              value={localTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="font-bold border-none shadow-none px-0 h-auto text-foreground focus-visible:ring-0 bg-transparent"
              style={{ fontSize: "30px", lineHeight: "1.2" }}
              placeholder="Titre de la tâche..."
              data-testid="input-queue-title"
            />

            {/* Description */}
            <div>
              <Textarea
                value={localDescription}
                onChange={(e) => handleDescChange(e.target.value)}
                className="min-h-[140px] resize-none text-sm text-foreground/90 border-muted focus-visible:ring-1 placeholder:text-xs"
                placeholder="Description de la tâche... (optionnel)"
                data-testid="textarea-queue-description"
              />
            </div>

            {/* Comments */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">
                  Commentaires
                  {comments.length > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">({comments.length})</span>
                  )}
                </h3>
              </div>

              {/* Comment input */}
              <div className="flex gap-3">
                <Avatar className="w-7 h-7 shrink-0 mt-1">
                  <AvatarImage src={currentDbUser?.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {currentDbUser
                      ? (`${(currentDbUser.firstName || "")[0] ?? ""}${(currentDbUser.lastName || "")[0] ?? ""}`.toUpperCase() || currentDbUser.email?.[0]?.toUpperCase() || "?")
                      : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <Input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                    placeholder="Ajouter un commentaire..."
                    className="text-sm flex-1 placeholder:text-xs"
                    data-testid="input-queue-comment"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || addComment.isPending}
                    data-testid="button-queue-comment-submit"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Comment list */}
              {commentsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-muted rounded w-1/4" />
                        <div className="h-4 bg-muted rounded w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Aucun commentaire pour l'instant.</p>
              ) : (
                <div className="space-y-4">
                  {comments.map((c) => (
                    <CommentItem
                      key={c.id}
                      comment={c}
                      users={users}
                      currentUserId={currentDbUser?.id}
                      onDelete={(id) => deleteComment.mutate(id)}
                      onEdit={(id, content) => editComment.mutate({ commentId: id, content })}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
