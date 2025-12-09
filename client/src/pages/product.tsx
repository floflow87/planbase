import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Kanban, LayoutGrid, Folder, ArrowRight, Calendar, MoreVertical, Pencil, Trash2 } from "lucide-react";
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

type BacklogWithProject = Backlog & { project?: Project | null };

export default function Product() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBacklog, setSelectedBacklog] = useState<Backlog | null>(null);
  
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
      const backlog = await apiRequest("/api/backlogs", "POST", {
        name: data.name,
        description: data.description || null,
        mode: data.mode,
        projectId: data.projectId || null,
      });
      
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
      toast({ title: "Backlog supprimé" });
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
      <div className="flex items-center justify-between p-4 md:p-6 border-b">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Backlogs</h1>
          <p className="text-muted-foreground">Gérez vos backlogs produit en mode Kanban ou Scrum</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-backlog">
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Backlog
        </Button>
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
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-backlog">
              <Plus className="h-4 w-4 mr-2" />
              Créer un backlog
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {backlogs.map((backlog) => (
              <Card 
                key={backlog.id} 
                className="hover-elevate cursor-pointer group"
                onClick={() => navigate(`/product/backlog/${backlog.id}`)}
                data-testid={`card-backlog-${backlog.id}`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{backlog.name}</CardTitle>
                    {backlog.description && (
                      <CardDescription className="line-clamp-2 mt-1">
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
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => navigate(`/product/backlog/${backlog.id}`)} data-testid={`menu-open-backlog-${backlog.id}`}>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Ouvrir
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
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
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {getModeIcon(backlog.mode)}
                      {getModeLabel(backlog.mode)}
                    </Badge>
                    {backlog.project && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Folder className="h-3 w-3" />
                        {backlog.project.name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(backlog.createdAt), "d MMM yyyy", { locale: fr })}
                  </div>
                </CardContent>
              </Card>
            ))}
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
