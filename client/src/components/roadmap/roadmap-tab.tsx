import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Map, LayoutGrid, Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/Loader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Roadmap, RoadmapItem } from "@shared/schema";

interface RoadmapTabProps {
  projectId: string;
  accountId: string;
}

type ViewMode = "gantt" | "output";

export function RoadmapTab({ projectId, accountId }: RoadmapTabProps) {
  const { toast } = useToast();
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("gantt");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoadmapName, setNewRoadmapName] = useState("");
  const [newRoadmapHorizon, setNewRoadmapHorizon] = useState("");

  const { data: roadmaps = [], isLoading: isLoadingRoadmaps } = useQuery<Roadmap[]>({
    queryKey: ['/api/projects', projectId, 'roadmaps'],
  });

  const activeRoadmapId = selectedRoadmapId || (roadmaps.length > 0 ? roadmaps[0].id : null);

  const { data: roadmapItems = [], isLoading: isLoadingItems } = useQuery<RoadmapItem[]>({
    queryKey: ['/api/roadmaps', activeRoadmapId, 'items'],
    enabled: !!activeRoadmapId,
  });

  const createRoadmapMutation = useMutation({
    mutationFn: async (data: { name: string; horizon?: string }) => {
      return apiRequest('/api/roadmaps', 'POST', {
        accountId,
        projectId,
        name: data.name,
        horizon: data.horizon || null,
      });
    },
    onSuccess: (newRoadmap: Roadmap) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'roadmaps'] });
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

  if (isLoadingRoadmaps) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (roadmaps.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Map className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune roadmap</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Créez une roadmap pour planifier et suivre les livrables, jalons et initiatives de ce projet.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-roadmap">
              <Plus className="h-4 w-4 mr-2" />
              Créer une roadmap
            </Button>
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
        </CardContent>
      </Card>
    );
  }

  const activeRoadmap = roadmaps.find(r => r.id === activeRoadmapId);

  return (
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
            <Button variant="outline" size="sm" data-testid="button-add-first-item">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter un élément
            </Button>
          </div>
        ) : (
          <div className="min-h-[400px]">
            {viewMode === "gantt" ? (
              <div className="text-center py-12 text-muted-foreground">
                Vue Gantt - À implémenter
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Vue Output - À implémenter
              </div>
            )}
          </div>
        )}
      </CardContent>

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
              <Label htmlFor="roadmap-name-2">Nom de la roadmap</Label>
              <Input
                id="roadmap-name-2"
                value={newRoadmapName}
                onChange={(e) => setNewRoadmapName(e.target.value)}
                placeholder="Ex: Roadmap Q1 2025"
                data-testid="input-roadmap-name-modal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roadmap-horizon-2">Horizon (optionnel)</Label>
              <Input
                id="roadmap-horizon-2"
                value={newRoadmapHorizon}
                onChange={(e) => setNewRoadmapHorizon(e.target.value)}
                placeholder="Ex: 2025-Q1"
                data-testid="input-roadmap-horizon-modal"
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
              data-testid="button-confirm-create-roadmap-modal"
            >
              {createRoadmapMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
