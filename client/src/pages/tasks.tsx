import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import type { Task, TaskColumn, AppUser, Project } from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format as formatDate } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "wouter";

export default function Tasks() {
  const { accountId } = useAuth();
  
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !!accountId,
  });

  const { data: taskColumns = [] } = useQuery<TaskColumn[]>({
    queryKey: ["/api/task-columns"],
    enabled: !!accountId,
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!accountId,
  });

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-blue-50 text-blue-700 border-blue-200",
      medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
      high: "bg-red-50 text-red-700 border-red-200",
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      todo: "bg-gray-50 text-gray-700 border-gray-200",
      in_progress: "bg-blue-50 text-blue-700 border-blue-200",
      review: "bg-purple-50 text-purple-700 border-purple-200",
      done: "bg-green-50 text-green-700 border-green-200",
    };
    return colors[status as keyof typeof colors] || colors.todo;
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      todo: "À faire",
      in_progress: "En cours",
      review: "Revue",
      done: "Terminé",
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      low: "Basse",
      medium: "Moyenne",
      high: "Haute",
    };
    return labels[priority as keyof typeof labels] || priority;
  };

  if (tasksLoading) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="text-center py-12 text-muted-foreground">
          Chargement des tâches...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Tâche</TableHead>
              <TableHead className="w-[15%]">Projet</TableHead>
              <TableHead className="w-[10%]">Assigné à</TableHead>
              <TableHead className="w-[10%]">Priorité</TableHead>
              <TableHead className="w-[10%]">Statut</TableHead>
              <TableHead className="w-[15%]">Date d'échéance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Aucune tâche trouvée
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => {
                const project = projects.find(p => p.id === task.projectId);
                const assignedUser = users.find(u => u.id === task.assignedToId);
                
                return (
                  <TableRow key={task.id} className="cursor-pointer hover-elevate">
                    <TableCell>
                      <div className="font-medium text-sm">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {task.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {project ? (
                        <Link href={`/projects/${project.id}`}>
                          <span className="text-sm text-primary hover:underline">
                            {project.name}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {assignedUser ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-[10px]">
                              {assignedUser.firstName?.[0]}{assignedUser.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs truncate">
                            {assignedUser.firstName} {assignedUser.lastName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getPriorityColor(task.priority)}`}
                      >
                        {getPriorityLabel(task.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getStatusColor(task.status)}`}
                      >
                        {getStatusLabel(task.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.dueDate ? (
                        <span className="text-sm">
                          {formatDate(new Date(task.dueDate), "dd MMM yyyy", { locale: fr })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
