import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Plus, Map, LayoutGrid, Calendar, Rocket, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/Loader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { GanttView } from "@/components/roadmap/gantt-view";
import { OutputView } from "@/components/roadmap/output-view";
import type { Roadmap, RoadmapItem, Project } from "@shared/schema";

type ViewMode = "gantt" | "output";

export default function RoadmapPage() {
  const { toast } = useToast();
  const { accountId } = useAuth();
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    const saved = localStorage.getItem("roadmap-selected-project");
    return saved || null;
  });
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("gantt");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoadmapName, setNewRoadmapName] = useState("");
  const [newRoadmapHorizon, setNewRoadmapHorizon] = useState("");
  
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [itemForm, setItemForm] = useState({
    title: "",
    type: "deliverable",
    priority: "normal",
    status: "planned",
    startDate: "",
    endDate: "",
    description: "",
  });

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem("roadmap-selected-project", selectedProjectId);
    }
  }, [selectedProjectId]);

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: roadmaps = [], isLoading: isLoadingRoadmaps } = useQuery<Roadmap[]>({
    queryKey: [`/api/projects/${selectedProjectId}/roadmaps`],
    enabled: !!selectedProjectId,
  });

  const activeRoadmapId = selectedRoadmapId || (roadmaps.length > 0 ? roadmaps[0].id : null);

  const { data: roadmapItems = [], isLoading: isLoadingItems } = useQuery<RoadmapItem[]>({
    queryKey: [`/api/roadmaps/${activeRoadmapId}/items`],
    enabled: !!activeRoadmapId,
  });

  useEffect(() => {
    setSelectedRoadmapId(null);
  }, [selectedProjectId]);

  const createRoadmapMutation = useMutation({
    mutationFn: async (data: { name: string; horizon?: string }) => {
      return apiRequest('/api/roadmaps', 'POST', {
        accountId,
        projectId: selectedProjectId,
        name: data.name,
        horizon: data.horizon || null,
      });
    },
    onSuccess: (newRoadmap: Roadmap) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/roadmaps`] });
      setSelectedRoadmapId(newRoadmap.id);
      setIsCreateDialogOpen(false);
      setNewRoadmapName("");
      setNewRoadmapHorizon("");
      toast({
        title: "Roadmap créée",
        description: `La roadmap "${newRoadmap.name}" a été créée avec succès.`,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la roadmap.",
        variant: "destructive",
      });
    },
  });

  const handleCreateRoadmap = () => {
    if (!newRoadmapName.trim()) return;
    createRoadmapMutation.mutate({
      name: newRoadmapName.trim(),
      horizon: newRoadmapHorizon.trim() || undefined,
    });
  };

  const createItemMutation = useMutation({
    mutationFn: async (data: typeof itemForm) => {
      return apiRequest('/api/roadmap-items', 'POST', {
        roadmapId: activeRoadmapId,
        projectId: selectedProjectId,
        title: data.title,
        type: data.type,
        priority: data.priority,
        status: data.status,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        description: data.description || null,
        orderIndex: roadmapItems.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/items`] });
      setIsItemDialogOpen(false);
      resetItemForm();
      toast({
        title: "Élément créé",
        description: "L'élément a été ajouté à la roadmap.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'élément.",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof itemForm> }) => {
      return apiRequest(`/api/roadmap-items/${id}`, 'PATCH', {
        title: data.title,
        type: data.type,
        priority: data.priority,
        status: data.status,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        description: data.description || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/items`] });
      setIsItemDialogOpen(false);
      setEditingItem(null);
      resetItemForm();
      toast({
        title: "Élément mis à jour",
        description: "Les modifications ont été enregistrées.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'élément.",
        variant: "destructive",
      });
    },
  });

  const resetItemForm = () => {
    setItemForm({
      title: "",
      type: "deliverable",
      priority: "normal",
      status: "planned",
      startDate: "",
      endDate: "",
      description: "",
    });
  };

  const handleOpenAddItem = () => {
    resetItemForm();
    setEditingItem(null);
    setIsItemDialogOpen(true);
  };

  const handleOpenEditItem = (item: RoadmapItem) => {
    setEditingItem(item);
    setItemForm({
      title: item.title,
      type: item.type,
      priority: item.priority,
      status: item.status,
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      description: item.description || "",
    });
    setIsItemDialogOpen(true);
  };

  const handleSubmitItem = () => {
    if (!itemForm.title.trim()) return;
    
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data: itemForm });
    } else {
      createItemMutation.mutate(itemForm);
    }
  };

  const handleItemMove = async (itemId: string, newStatus: string, newOrderIndex: number) => {
    try {
      await apiRequest(`/api/roadmap-items/${itemId}`, 'PATCH', {
        status: newStatus,
        orderIndex: newOrderIndex,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/items`] });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de déplacer l'élément.",
        variant: "destructive",
      });
    }
  };

  const handleCreateAtDate = (startDate: Date, endDate: Date) => {
    resetItemForm();
    setEditingItem(null);
    setItemForm(prev => ({
      ...prev,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }));
    setIsItemDialogOpen(true);
  };

  const handleUpdateItemDates = async (itemId: string, startDate: Date, endDate: Date) => {
    try {
      await apiRequest(`/api/roadmap-items/${itemId}`, 'PATCH', {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/items`] });
      toast({
        title: "Dates mises à jour",
        description: "Les dates de l'élément ont été modifiées.",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les dates.",
        variant: "destructive",
      });
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const activeRoadmap = roadmaps.find(r => r.id === activeRoadmapId);

  if (isLoadingProjects) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Rocket className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Roadmap</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-[250px]" data-testid="select-project">
                  <SelectValue placeholder="Sélectionner un projet" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id} data-testid={`select-project-${project.id}`}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {!selectedProjectId ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderKanban className="h-16 w-16 text-muted-foreground mb-6" />
                <h3 className="text-xl font-semibold mb-2">Sélectionnez un projet</h3>
                <p className="text-muted-foreground max-w-md">
                  Choisissez un projet dans le menu déroulant ci-dessus pour afficher et gérer ses roadmaps.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : isLoadingRoadmaps ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-12">
                <Loader />
              </div>
            </CardContent>
          </Card>
        ) : roadmaps.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Map className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune roadmap pour ce projet</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md">
                  Créez une roadmap pour planifier et suivre les livrables, jalons et initiatives de "{selectedProject?.name}".
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-roadmap">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une roadmap
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  {roadmaps.length > 1 ? (
                    <Select value={activeRoadmapId || ""} onValueChange={setSelectedRoadmapId}>
                      <SelectTrigger className="w-[200px]" data-testid="select-roadmap">
                        <SelectValue placeholder="Sélectionner une roadmap" />
                      </SelectTrigger>
                      <SelectContent>
                        {roadmaps.map((roadmap) => (
                          <SelectItem key={roadmap.id} value={roadmap.id}>
                            {roadmap.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <CardTitle className="text-base font-semibold">{activeRoadmap?.name}</CardTitle>
                  )}
                  {activeRoadmap?.horizon && (
                    <Badge variant="outline" className="text-xs">
                      {activeRoadmap.horizon}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center border rounded-md p-1">
                    <Button
                      variant={viewMode === "gantt" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("gantt")}
                      className="h-7 px-3"
                      data-testid="button-view-gantt"
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Gantt
                    </Button>
                    <Button
                      variant={viewMode === "output" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("output")}
                      className="h-7 px-3"
                      data-testid="button-view-output"
                    >
                      <LayoutGrid className="h-4 w-4 mr-1" />
                      Output
                    </Button>
                  </div>
                  <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-roadmap">
                    <Plus className="h-4 w-4 mr-1" />
                    Nouvelle
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {isLoadingItems ? (
                <div className="flex items-center justify-center py-12">
                  <Loader />
                </div>
              ) : roadmapItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                  <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Cette roadmap est vide. Ajoutez des éléments pour commencer.
                  </p>
                  <Button variant="outline" size="sm" onClick={handleOpenAddItem} data-testid="button-add-first-item">
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter un élément
                  </Button>
                </div>
              ) : (
                <div className="min-h-[400px]">
                  {viewMode === "gantt" ? (
                    <GanttView 
                      items={roadmapItems} 
                      onItemClick={handleOpenEditItem}
                      onAddItem={handleOpenAddItem}
                      onCreateAtDate={handleCreateAtDate}
                      onUpdateItemDates={handleUpdateItemDates}
                    />
                  ) : (
                    <OutputView 
                      items={roadmapItems}
                      onItemClick={handleOpenEditItem}
                      onAddItem={handleOpenAddItem}
                      onItemMove={handleItemMove}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une roadmap</DialogTitle>
            <DialogDescription>
              Donnez un nom à votre roadmap et définissez optionnellement un horizon temporel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="roadmap-name">Nom de la roadmap</Label>
              <Input
                id="roadmap-name"
                value={newRoadmapName}
                onChange={(e) => setNewRoadmapName(e.target.value)}
                placeholder="Ex: Roadmap Q1 2025"
                data-testid="input-roadmap-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roadmap-horizon">Horizon (optionnel)</Label>
              <Input
                id="roadmap-horizon"
                value={newRoadmapHorizon}
                onChange={(e) => setNewRoadmapHorizon(e.target.value)}
                placeholder="Ex: 2025-Q1"
                data-testid="input-roadmap-horizon"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleCreateRoadmap} 
              disabled={!newRoadmapName.trim() || createRoadmapMutation.isPending}
              data-testid="button-confirm-create-roadmap"
            >
              {createRoadmapMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Modifier l'élément" : "Ajouter un élément"}</DialogTitle>
            <DialogDescription>
              {editingItem 
                ? "Modifiez les informations de cet élément de la roadmap."
                : "Créez un nouvel élément pour votre roadmap."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-title">Titre</Label>
              <Input
                id="item-title"
                value={itemForm.title}
                onChange={(e) => setItemForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Livraison MVP"
                data-testid="input-item-title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-type">Type</Label>
                <Select value={itemForm.type} onValueChange={(v) => setItemForm(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger id="item-type" data-testid="select-item-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deliverable">Livrable</SelectItem>
                    <SelectItem value="milestone">Jalon</SelectItem>
                    <SelectItem value="initiative">Initiative</SelectItem>
                    <SelectItem value="free_block">Bloc libre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-priority">Priorité</Label>
                <Select value={itemForm.priority} onValueChange={(v) => setItemForm(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger id="item-priority" data-testid="select-item-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="strategic">Stratégique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-status">Statut</Label>
              <Select value={itemForm.status} onValueChange={(v) => setItemForm(prev => ({ ...prev, status: v }))}>
                <SelectTrigger id="item-status" data-testid="select-item-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planifié</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
                  <SelectItem value="blocked">Bloqué</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-start-date">Date de début</Label>
                <Input
                  id="item-start-date"
                  type="date"
                  value={itemForm.startDate}
                  onChange={(e) => setItemForm(prev => ({ ...prev, startDate: e.target.value }))}
                  data-testid="input-item-start-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-end-date">Date de fin</Label>
                <Input
                  id="item-end-date"
                  type="date"
                  value={itemForm.endDate}
                  onChange={(e) => setItemForm(prev => ({ ...prev, endDate: e.target.value }))}
                  data-testid="input-item-end-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-description">Description (optionnel)</Label>
              <Textarea
                id="item-description"
                value={itemForm.description}
                onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Décrivez cet élément..."
                rows={3}
                data-testid="input-item-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSubmitItem} 
              disabled={!itemForm.title.trim() || createItemMutation.isPending || updateItemMutation.isPending}
              data-testid="button-confirm-item"
            >
              {(createItemMutation.isPending || updateItemMutation.isPending) 
                ? "Enregistrement..." 
                : editingItem ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
