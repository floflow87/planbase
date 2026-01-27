import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Copy,
  Edit,
  Trash2,
  UserPlus,
  CheckCircle2,
} from "lucide-react";
import type { Task, AppUser } from "@shared/schema";

interface TaskCardMenuProps {
  task: Task;
  users: AppUser[];
  onDuplicate: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAssign: (task: Task, userId: string) => void;
  onMarkComplete: (task: Task) => void;
  canUpdate?: boolean;
  canDelete?: boolean;
}

export function TaskCardMenu({
  task,
  users,
  onDuplicate,
  onEdit,
  onDelete,
  onAssign,
  onMarkComplete,
  canUpdate = true,
  canDelete = true,
}: TaskCardMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          data-testid={`button-task-menu-${task.id}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid={`menu-task-${task.id}`}>
        <DropdownMenuItem
          onClick={() => onDuplicate(task)}
          data-testid="menu-item-duplicate"
        >
          <Copy className="mr-2 h-4 w-4" />
          Dupliquer
        </DropdownMenuItem>
        {canUpdate && (
          <DropdownMenuItem
            onClick={() => onEdit(task)}
            data-testid="menu-item-edit"
          >
            <Edit className="mr-2 h-4 w-4" />
            Modifier
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        
        {canUpdate && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid="menu-item-assign">
              <UserPlus className="mr-2 h-4 w-4" />
              Assigner à
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {users.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => onAssign(task, user.id)}
                  data-testid={`menu-item-assign-${user.id}`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {user.firstName} {user.lastName}
                    </span>
                    {user.position && (
                      <span className="text-xs text-muted-foreground">
                        {user.position}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        
        {canUpdate && (
          <DropdownMenuItem
            onClick={() => onMarkComplete(task)}
            data-testid="menu-item-mark-complete"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Marquer comme terminé
          </DropdownMenuItem>
        )}
        
        {canDelete && <DropdownMenuSeparator />}
        
        {canDelete && (
          <DropdownMenuItem
            onClick={() => onDelete(task)}
            className="text-destructive"
            data-testid="menu-item-delete"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
