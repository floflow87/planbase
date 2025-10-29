import { useState } from "react";
import { Search, Filter, Settings as SettingsIcon, LayoutGrid, List, Table2, Plus, MoreVertical, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Projects() {
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "table">("kanban");
  const [selectedProject, setSelectedProject] = useState("fintech-mvp");

  // Mock data
  const projects = [
    { id: "fintech-mvp", name: "FinTech Startup MVP", progress: 68 },
    { id: "ecommerce", name: "E-commerce Platform", progress: 45 },
    { id: "greentech", name: "GreenTech Solution", progress: 90 },
  ];

  const columns = [
    {
      id: "todo",
      title: "À faire",
      count: 5,
      tasks: [
        {
          id: "1",
          title: "MVP Product Design",
          description: "Créer les maquettes et prototypes pour la version beta",
          priority: "urgent",
          assignees: [
            { name: "Marie", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marie" },
            { name: "Pierre", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Pierre" },
          ],
          dueDate: "Due: 2 jours",
        },
        {
          id: "2",
          title: "Market Research",
          description: "Analyser la concurrence et les tendances du marché",
          priority: "medium",
          assignees: [
            { name: "Sophie", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie" },
          ],
          dueDate: "Due: 1 semaine",
        },
        {
          id: "3",
          title: "User Stories",
          description: "Définir les parcours utilisateurs principaux",
          priority: "low",
          assignees: [
            { name: "Alex", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" },
          ],
          dueDate: "Due: 2 semaines",
        },
      ],
    },
    {
      id: "in-progress",
      title: "En cours",
      count: 3,
      tasks: [
        {
          id: "4",
          title: "Business Plan Rédaction",
          description: "Finaliser le business plan pour la levée de fonds",
          priority: "urgent",
          assignees: [
            { name: "Marie", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marie" },
          ],
          dueDate: "65% terminé",
          progress: 65,
        },
        {
          id: "5",
          title: "Développement Backend",
          description: "API REST et base de données",
          priority: "medium",
          assignees: [
            { name: "Pierre", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Pierre" },
            { name: "Alex", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" },
          ],
          dueDate: "40% terminé",
          progress: 40,
        },
      ],
    },
    {
      id: "review",
      title: "En revue",
      count: 2,
      tasks: [
        {
          id: "6",
          title: "Wireframes Mobile",
          description: "Validation des maquettes par l'équipe produit",
          priority: "review",
          assignees: [
            { name: "Sophie", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie" },
          ],
          dueDate: "En attente",
        },
      ],
    },
    {
      id: "done",
      title: "Terminé",
      count: 8,
      tasks: [
        {
          id: "7",
          title: "Logo Design",
          description: "Identité visuelle complète",
          priority: "done",
          assignees: [
            { name: "Marie", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marie" },
          ],
          dueDate: "Terminé",
        },
      ],
    },
  ];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge className="bg-red-100 text-red-700 border-red-200 border">Urgent</Badge>;
      case "medium":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200 border">Moyen</Badge>;
      case "low":
        return <Badge className="bg-green-100 text-green-700 border-green-200 border">Faible</Badge>;
      case "review":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 border">Revue</Badge>;
      case "done":
        return <Badge className="bg-green-100 text-green-700 border-green-200 border">Terminé</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background" data-testid="page-projects">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-heading font-semibold text-foreground" data-testid="text-page-title">
            To-Do & Project Management
          </h1>
          <Button className="gap-2" data-testid="button-nouvelle-tache">
            <Plus className="w-4 h-4" />
            Nouvelle Tâche
          </Button>
        </div>

        {/* Project Selector & Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Project:</span>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-64" data-testid="select-project">
                  <SelectValue />
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

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                className="pl-9 w-48"
                data-testid="input-rechercher"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-filtres">
              <Filter className="w-4 h-4" />
              Filtres
            </Button>
            <Button variant="ghost" size="sm" data-testid="button-settings">
              <SettingsIcon className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1 border border-border rounded-md p-1">
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                data-testid="button-view-kanban"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                data-testid="button-view-liste"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                data-testid="button-view-tableau"
              >
                <Table2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Progression du projet: 68%</span>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted" />
                  <span>À faire: 5</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>En cours: 3</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span>En revue: 2</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Terminé: 8</span>
                </div>
              </div>
            </div>
            <Progress value={68} className="h-2" indicatorClassName="bg-violet-600" />
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {columns.map((column) => (
            <div key={column.id} className="space-y-3" data-testid={`column-${column.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    column.id === "todo" ? "bg-muted" :
                    column.id === "in-progress" ? "bg-blue-500" :
                    column.id === "review" ? "bg-yellow-500" :
                    "bg-green-500"
                  }`} />
                  <h3 className="font-semibold text-foreground">{column.title}</h3>
                  <Badge variant="secondary" className="text-xs">{column.count}</Badge>
                </div>
                <Button variant="ghost" size="sm" data-testid={`button-add-${column.id}`}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {column.tasks.map((task) => (
                  <Card key={task.id} className="hover-elevate cursor-move" data-testid={`card-task-${task.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground text-sm mb-1">{task.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center -space-x-2">
                          {task.assignees.map((assignee, idx) => (
                            <Avatar key={idx} className="w-6 h-6 border-2 border-background">
                              <AvatarImage src={assignee.avatar} />
                              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                {assignee.name[0]}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                        {getPriorityBadge(task.priority)}
                      </div>

                      {task.progress !== undefined && (
                        <div className="space-y-1">
                          <Progress value={task.progress} className="h-1.5" indicatorClassName="bg-blue-600" />
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">{task.dueDate}</p>
                    </CardContent>
                  </Card>
                ))}

                <button
                  className="w-full p-3 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover-elevate transition-colors"
                  data-testid={`button-ajouter-tache-${column.id}`}
                >
                  + Ajouter une tâche
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
