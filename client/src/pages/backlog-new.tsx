import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, FolderKanban, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader } from "@/components/Loader";
import { useToast } from "@/hooks/use-toast";
import { toastSuccess } from "@/design-system/feedback";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Project, BacklogMode, Roadmap } from "@shared/schema";
import { backlogModeOptions } from "@shared/schema";

export default function BacklogNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    mode: "scrum" as BacklogMode,
    projectId: "" as string | null,
    importTasks: false,
    generateEpics: false,
    selectedRoadmapId: "" as string | null,
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: roadmaps = [], isLoading: roadmapsLoading } = useQuery<Roadmap[]>({
    queryKey: [`/api/projects/${formData.projectId}/roadmaps`],
    enabled: !!formData.projectId,
  });

  useEffect(() => {
    if (roadmaps.length === 1) {
      setFormData(prev => ({ ...prev, selectedRoadmapId: roadmaps[0].id }));
    } else if (roadmaps.length === 0) {
      setFormData(prev => ({ ...prev, selectedRoadmapId: null, generateEpics: false }));
    }
  }, [roadmaps]);

  const createBacklogMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("/api/backlogs", "POST", {
        name: data.name,
        description: data.description || null,
        mode: data.mode,
        projectId: data.projectId || null,
        generateEpics: data.generateEpics,
        roadmapId: data.generateEpics ? data.selectedRoadmapId : null,
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
      toastSuccess({ title: "Backlog créé", description: `Le backlog "${backlog.name}" a été créé.` });
      navigate(`/product/backlog/${backlog.id}`);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Erreur", description: "Le nom du backlog est requis", variant: "destructive" });
      return;
    }
    createBacklogMutation.mutate(formData);
  };

  const hasMultipleRoadmaps = roadmaps.length > 1;
  const hasNoRoadmaps = formData.projectId && roadmaps.length === 0;
  const canGenerateEpics = formData.projectId && roadmaps.length > 0;

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate("/product")}
          data-testid="button-back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-light">Nouveau Backlog</h1>
          <p className="text-xs text-muted-foreground">Créez un nouveau backlog pour organiser vos epics et tâches</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            Informations du backlog
          </CardTitle>
          <CardDescription className="text-xs">
            Configurez les paramètres de votre nouveau backlog
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Nom du backlog *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Sprint Planning Q1"
                className="text-sm"
                data-testid="input-backlog-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description optionnelle du backlog..."
                className="text-sm resize-none"
                rows={3}
                data-testid="input-backlog-description"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mode" className="text-xs">Mode de gestion</Label>
              <Select
                value={formData.mode}
                onValueChange={(value: BacklogMode) => setFormData({ ...formData, mode: value })}
              >
                <SelectTrigger className="text-sm" data-testid="select-backlog-mode">
                  <SelectValue placeholder="Sélectionner un mode" />
                </SelectTrigger>
                <SelectContent>
                  {backlogModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project" className="text-xs">Projet associé</Label>
              <Select
                value={formData.projectId || "none"}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  projectId: value === "none" ? null : value,
                  generateEpics: false,
                  selectedRoadmapId: null,
                })}
              >
                <SelectTrigger className="text-sm" data-testid="select-project">
                  <SelectValue placeholder="Aucun projet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun projet</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.projectId && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="importTasks"
                    checked={formData.importTasks}
                    onCheckedChange={(checked) => setFormData({ ...formData, importTasks: !!checked })}
                    data-testid="checkbox-import-tasks"
                  />
                  <Label htmlFor="importTasks" className="text-xs cursor-pointer">
                    Importer les tâches existantes du projet
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="generateEpics"
                    checked={formData.generateEpics}
                    onCheckedChange={(checked) => setFormData({ ...formData, generateEpics: !!checked })}
                    disabled={!canGenerateEpics}
                    data-testid="checkbox-generate-epics"
                  />
                  <div className="flex items-center gap-1">
                    <Label 
                      htmlFor="generateEpics" 
                      className={`text-xs cursor-pointer ${!canGenerateEpics ? 'text-muted-foreground' : ''}`}
                    >
                      Générer les EPICs
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-white text-foreground border">
                        <p className="text-xs">
                          Générer automatiquement les EPICs depuis les rubriques de la roadmap du projet parent. 
                          Chaque rubrique de la roadmap deviendra une EPIC liée.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {hasNoRoadmaps && formData.projectId && (
                  <p className="text-xs text-muted-foreground pl-6">
                    Aucune roadmap disponible pour ce projet. Créez d'abord une roadmap pour générer les EPICs.
                  </p>
                )}

                {formData.generateEpics && hasMultipleRoadmaps && (
                  <div className="space-y-1.5 pl-6">
                    <Label htmlFor="roadmap" className="text-xs">Sélectionner la roadmap à utiliser</Label>
                    <Select
                      value={formData.selectedRoadmapId || ""}
                      onValueChange={(value) => setFormData({ ...formData, selectedRoadmapId: value })}
                    >
                      <SelectTrigger className="text-sm" data-testid="select-roadmap">
                        <SelectValue placeholder="Choisir une roadmap" />
                      </SelectTrigger>
                      <SelectContent>
                        {roadmaps.map((roadmap) => (
                          <SelectItem key={roadmap.id} value={roadmap.id}>
                            {roadmap.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/product")}
                data-testid="button-cancel"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createBacklogMutation.isPending || !formData.name.trim() || (formData.generateEpics && hasMultipleRoadmaps && !formData.selectedRoadmapId)}
                data-testid="button-create-backlog"
              >
                {createBacklogMutation.isPending ? "Création..." : "Créer le backlog"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
