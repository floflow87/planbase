import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Kanban, LayoutGrid, Folder, ArrowRight, Calendar, MoreVertical, Pencil, Trash2, List, Grid3X3, Play, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Backlog, Project, BacklogMode } from "@shared/schema";
import { backlogModeOptions } from "@shared/schema";

type BacklogWithProject = Backlog & { 
  project?: Project | null;
  creator?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
  ticketCounts?: {
    todo: number;
    inProgress: number;
    done: number;
    total: number;
  };
  activeSprint?: {
    id: string;
    name: string;
  } | null;
};

export default function Product() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBacklog, setSelectedBacklog] = useState<Backlog | null>(null);
  
  // Default to list view, persist choice in localStorage
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    const saved = localStorage.getItem("backlog-view-mode");
    return (saved === "grid" || saved === "list") ? saved : "list";
  });
  
  // Persist view mode changes
  useEffect(() => {
    localStorage.setItem("backlog-view-mode", viewMode);
  }, [viewMode]);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    mode: "scrum" as BacklogMode,
    projectId: "" as string | null,
    importTasks: false,
  });

  const { data: backlogs = [], isLoading } = useQuery<BacklogWithProject[]>({
    queryKey: ["/api/backlogs"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createBacklogMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("/api/backlogs", "POST", {
        name: data.name,
        description: data.description || null,
        mode: data.mode,
        projectId: data.projectId || null,
      });
      const backlog = await response.json();
      
      if (data.importTasks && data.projectId) {
        await apiRequest(`/api/backlogs/${backlog.id}/import-from-project`, "POST");
      }
      
      return backlog;
    },
    onSuccess: async (backlog) => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs"] });
      await queryClient.prefetchQuery({
        queryKey: ["/api/backlogs", backlog.id],
        queryFn: async () => {
          const response = await fetch(`/api/backlogs/${backlog.id}`);
          if (!response.ok) throw new Error("Failed to fetch backlog");
          return response.json();
        },
      });
      toast({ title: "Backlog créé", description: `Le backlog "${backlog.name}" a été créé.`, className: "bg-green-500 text-white border-green-600", duration: 3000 });
      setShowCreateDialog(false);
      resetForm();
      navigate(`/product/backlog/${backlog.id}`);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteBacklogMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/backlogs/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backlogs"] });
      toast({ title: "Backlog supprimé", className: "bg-green-500 text-white border-green-600", duration: 3000 });
      setShowDeleteDialog(false);
      setSelectedBacklog(null);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      mode: "scrum",
      projectId: "",
      importTasks: false,
    });
  };

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast({ title: "Erreur", description: "Le nom est requis", variant: "destructive" });
      return;
    }
    createBacklogMutation.mutate(formData);
  };

  const getModeIcon = (mode: string) => {
    return mode === "kanban" ? <Kanban className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />;
  };

  const getModeLabel = (mode: string) => {
    const option = backlogModeOptions.find(o => o.value === mode);
    return option?.label || mode;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end p-4 md:p-6 border-b">
        <div className="flex items-center gap-2" data-testid="container-backlog-actions">
          <div className="flex items-center border rounded-md" data-testid="container-view-toggle">
            <Button 
              variant={viewMode === "grid" ? "secondary" : "ghost"} 
              size="icon" 
              className="rounded-r-none"
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === "list" ? "secondary" : "ghost"} 
              size="icon" 
              className="rounded-l-none"
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => navigate("/product/backlog/new")} data-testid="button-create-backlog">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Backlog
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {backlogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="rounded-full bg-muted p-6 mb-4">
              <LayoutGrid className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Aucun backlog</h2>
            <p className="text-muted-foreground mb-4 max-w-md">
              Créez votre premier backlog pour commencer à organiser vos epics, user stories et tâches.
            </p>
            <Button onClick={() => navigate("/product/backlog/new")} data-testid="button-create-first-backlog">
              <Plus className="h-4 w-4 mr-2" />
              Créer un backlog
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {backlogs.map((backlog) => (
              <Card 
                key={backlog.id} 
                className="hover-elevate cursor-pointer group"
                onClick={() => navigate(`/product/backlog/${backlog.id}`)}
                data-testid={`card-backlog-${backlog.id}`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2 p-3 pb-1">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm truncate">{backlog.name}</CardTitle>
                    {backlog.description && (
                      <CardDescription className="line-clamp-1 mt-0.5 text-xs">
                        {backlog.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" data-testid={`button-menu-backlog-${backlog.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-white border shadow-md">
                      <DropdownMenuItem onClick={() => navigate(`/product/backlog/${backlog.id}`)} className="cursor-pointer text-gray-900" data-testid={`menu-open-backlog-${backlog.id}`}>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Ouvrir
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive cursor-pointer"
                        onClick={() => {
                          setSelectedBacklog(backlog);
                          setShowDeleteDialog(true);
                        }}
                        data-testid={`menu-delete-backlog-${backlog.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="p-3 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                      {getModeIcon(backlog.mode)}
                      {getModeLabel(backlog.mode)}
                    </Badge>
                    {backlog.project && (
                      <Badge variant="outline" className="flex items-center gap-1 text-xs">
                        <Folder className="h-3 w-3" />
                        {backlog.project.name}
                      </Badge>
                    )}
                    {backlog.activeSprint && (
                      <Badge className="bg-violet-500 text-white flex items-center gap-1 text-xs" data-testid={`badge-active-sprint-${backlog.id}`}>
                        <Play className="h-3 w-3" />
                        {backlog.activeSprint.name}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Ticket counts */}
                  {backlog.ticketCounts && backlog.ticketCounts.total > 0 && (
                    <div className="flex items-center gap-1.5 mt-2" data-testid={`container-ticket-counts-${backlog.id}`}>
                      <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px]">
                        {backlog.ticketCounts.todo} à faire
                      </Badge>
                      <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px]">
                        {backlog.ticketCounts.inProgress} en cours
                      </Badge>
                      <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-[10px]">
                        {backlog.ticketCounts.done} terminé
                      </Badge>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                    <Calendar className="h-2.5 w-2.5" />
                    {format(new Date(backlog.createdAt), "d MMM yyyy", { locale: fr })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-2">Nom</th>
                  <th className="px-4 py-2 hidden sm:table-cell">Mode</th>
                  <th className="px-4 py-2 hidden md:table-cell">Sprint actif</th>
                  <th className="px-4 py-2 hidden lg:table-cell">Tickets</th>
                  <th className="px-4 py-2 hidden xl:table-cell">Projet</th>
                  <th className="px-4 py-2 hidden xl:table-cell">Créateur</th>
                  <th className="px-4 py-2 hidden lg:table-cell">Créé le</th>
                  <th className="px-4 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white dark:bg-gray-900">
                {backlogs.map((backlog) => (
                  <tr 
                    key={backlog.id}
                    className="hover:bg-muted/30 cursor-pointer group"
                    onClick={() => navigate(`/product/backlog/${backlog.id}`)}
                    data-testid={`row-backlog-${backlog.id}`}
                  >
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{backlog.name}</span>
                        {backlog.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1">{backlog.description}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit text-xs">
                        {getModeIcon(backlog.mode)}
                        {getModeLabel(backlog.mode)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      {backlog.activeSprint ? (
                        <Badge className="bg-violet-500 text-white flex items-center gap-1 w-fit text-xs" data-testid={`list-badge-active-sprint-${backlog.id}`}>
                          <Play className="h-3 w-3" />
                          {backlog.activeSprint.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 hidden lg:table-cell">
                      {backlog.ticketCounts && backlog.ticketCounts.total > 0 ? (
                        <div className="flex items-center gap-1" data-testid={`list-ticket-counts-${backlog.id}`}>
                          <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs px-1.5">
                            {backlog.ticketCounts.todo}
                          </Badge>
                          <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs px-1.5">
                            {backlog.ticketCounts.inProgress}
                          </Badge>
                          <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs px-1.5">
                            {backlog.ticketCounts.done}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2 hidden xl:table-cell">
                      {backlog.project ? (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit text-xs">
                          <Folder className="h-3 w-3" />
                          {backlog.project.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 hidden xl:table-cell">
                      {backlog.creator ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`text-creator-${backlog.id}`}>
                          <User className="h-3 w-3" />
                          <span>
                            {backlog.creator.firstName && backlog.creator.lastName 
                              ? `${backlog.creator.firstName} ${backlog.creator.lastName}`
                              : backlog.creator.email || "Inconnu"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(backlog.createdAt), "d MMM yyyy", { locale: fr })}
                      </div>
                    </td>
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" data-testid={`button-list-menu-backlog-${backlog.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white dark:bg-white border shadow-md">
                          <DropdownMenuItem onClick={() => navigate(`/product/backlog/${backlog.id}`)} className="cursor-pointer text-gray-900" data-testid={`list-menu-open-backlog-${backlog.id}`}>
                            <ArrowRight className="h-4 w-4 mr-2" />
                            Ouvrir
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive cursor-pointer"
                            onClick={() => {
                              setSelectedBacklog(backlog);
                              setShowDeleteDialog(true);
                            }}
                            data-testid={`list-menu-delete-backlog-${backlog.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau Backlog</DialogTitle>
            <DialogDescription>
              Choisissez le mode de gestion et configurez votre backlog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              {backlogModeOptions.map((option) => (
                <div
                  key={option.value}
                  className={`relative flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    formData.mode === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setFormData({ ...formData, mode: option.value as BacklogMode })}
                  data-testid={`button-mode-${option.value}`}
                >
                  {option.value === "kanban" ? (
                    <Kanban className="h-8 w-8 mb-2 text-primary" />
                  ) : (
                    <LayoutGrid className="h-8 w-8 mb-2 text-primary" />
                  )}
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">
                    {option.description}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nom du backlog *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Mon backlog produit"
                data-testid="input-backlog-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description optionnelle..."
                rows={2}
                data-testid="input-backlog-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Projet associé (optionnel)</Label>
              <Select
                value={formData.projectId || "none"}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  projectId: value === "none" ? null : value,
                  importTasks: value !== "none" && formData.importTasks
                })}
              >
                <SelectTrigger data-testid="select-project">
                  <SelectValue placeholder="Sélectionner un projet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun projet (from scratch)</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.projectId && (
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted">
                <Checkbox
                  id="importTasks"
                  checked={formData.importTasks}
                  onCheckedChange={(checked) => setFormData({ ...formData, importTasks: !!checked })}
                  data-testid="checkbox-import-tasks"
                />
                <Label htmlFor="importTasks" className="text-sm font-normal cursor-pointer">
                  Importer les tâches existantes du projet comme Tasks
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }} data-testid="button-cancel-create">
              Annuler
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={createBacklogMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createBacklogMutation.isPending ? "Création..." : "Créer le backlog"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le backlog</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer "{selectedBacklog?.name}" ? Cette action est irréversible et supprimera toutes les données associées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} data-testid="button-cancel-delete">
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedBacklog && deleteBacklogMutation.mutate(selectedBacklog.id)}
              disabled={deleteBacklogMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteBacklogMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
