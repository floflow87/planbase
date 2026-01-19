import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Plus, Map, LayoutGrid, Calendar, Search, Filter, X, AlertTriangle, CheckCircle2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader } from "@/components/Loader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GanttView } from "./gantt-view";
import { OutputView } from "./output-view";
import { RoadmapIndicators } from "./roadmap-indicators";
import { RoadmapRecommendations } from "./roadmap-recommendations";
import { MilestonesZone } from "./milestones-zone";
import { RoadmapItemLinks } from "./roadmap-item-links";
import type { Roadmap, RoadmapItem } from "@shared/schema";

// Milestone types
const MILESTONE_TYPES = [
  { value: "DELIVERY", label: "Livraison" },
  { value: "VALIDATION", label: "Validation" },
  { value: "DECISION", label: "Décision" },
  { value: "GO_NO_GO", label: "Go/No-Go" },
  { value: "DEMO", label: "Démonstration" },
  { value: "RELEASE", label: "Release" },
  { value: "PHASE_END", label: "Fin de phase" },
];

// Completion rules
const COMPLETION_RULES = [
  { value: "MANUAL", label: "Manuelle" },
  { value: "ALL_LINKED_EPICS_DONE", label: "Tous les Epics liés terminés" },
  { value: "PERCENT_THRESHOLD", label: "Seuil de pourcentage" },
];

// Validation requirements
const VALIDATION_REQUIREMENTS = [
  { value: "NONE", label: "Aucune" },
  { value: "CLIENT", label: "Client" },
  { value: "INTERNAL", label: "Interne" },
  { value: "EXTERNAL", label: "Externe" },
];

interface PhaseInfo {
  projectStartDate: string | null;
  currentPhase: string;
  phases: {
    [key: string]: {
      start: string;
      end: string | null;
      isCurrent: boolean;
      itemCount: number;
    };
  };
  nextPhaseTransition: {
    date: string;
    phase: string;
    daysUntil: number;
  } | null;
  indicators: {
    totalItems: number;
    lateItemsCount: number;
    itemsWithoutDatesCount: number;
    unassignedPhaseCount: number;
  };
}

const PHASE_LABELS: { [key: string]: string } = {
  T1: "Court terme (T1)",
  T2: "Moyen terme (T2)",
  T3: "Long terme (T3)",
  LT: "Très long terme",
  all: "Toutes les phases",
};

const STATUS_LABELS: { [key: string]: string } = {
  planned: "Planifié",
  in_progress: "En cours",
  done: "Terminé",
  blocked: "Bloqué",
  all: "Tous les statuts",
};

const TYPE_LABELS: { [key: string]: string } = {
  deliverable: "Livrable",
  milestone: "Jalon",
  initiative: "Initiative",
  feature: "Fonctionnalité",
  all: "Tous les types",
};

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
    // Milestone-specific fields
    milestoneType: "DELIVERY",
    isCritical: false,
    completionRule: "MANUAL",
    completionThreshold: 80,
    validationRequired: "NONE",
    impactEstimate: { timeImpactDays: 0, marginImpactPercent: 0, riskLevel: "low" } as { timeImpactDays: number; marginImpactPercent: number; riskLevel: string },
  });
  
  // Filters state
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const { data: roadmaps = [], isLoading: isLoadingRoadmaps } = useQuery<Roadmap[]>({
    queryKey: [`/api/projects/${projectId}/roadmaps`],
  });

  const activeRoadmapId = selectedRoadmapId || (roadmaps.length > 0 ? roadmaps[0].id : null);

  const { data: roadmapItems = [], isLoading: isLoadingItems } = useQuery<RoadmapItem[]>({
    queryKey: [`/api/roadmaps/${activeRoadmapId}/items`],
    enabled: !!activeRoadmapId,
  });
  
  // Query for phases data
  const { data: phasesData } = useQuery<PhaseInfo>({
    queryKey: [`/api/projects/${projectId}/roadmap/phases`],
  });

  // Calculate phase for an item based on its dates
  const getItemPhase = (item: RoadmapItem): string | null => {
    if (!phasesData?.phases) return null;
    const itemPhase = (item as any).phase;
    if (itemPhase) return itemPhase;
    
    const startDate = item.startDate || (item as any).targetDate || item.endDate;
    if (!startDate) return null;
    
    const date = new Date(startDate);
    for (const [phase, info] of Object.entries(phasesData.phases)) {
      const phaseStart = new Date(info.start);
      const phaseEnd = info.end ? new Date(info.end) : null;
      if (date >= phaseStart && (!phaseEnd || date < phaseEnd)) {
        return phase;
      }
    }
    return 'LT';
  };

  // Filter items based on filters
  const filteredItems = useMemo(() => {
    let items = [...roadmapItems];
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.title.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
      );
    }
    
    // Filter by phase
    if (filterPhase !== "all") {
      items = items.filter(item => {
        const phase = getItemPhase(item);
        return phase === filterPhase;
      });
    }
    
    // Filter by status
    if (filterStatus !== "all") {
      items = items.filter(item => item.status === filterStatus);
    }
    
    // Filter by type
    if (filterType !== "all") {
      items = items.filter(item => item.type === filterType);
    }
    
    return items;
  }, [roadmapItems, searchQuery, filterPhase, filterStatus, filterType, phasesData]);
  
  const hasActiveFilters = filterPhase !== "all" || filterStatus !== "all" || filterType !== "all" || searchQuery.trim() !== "";

  const clearFilters = () => {
    setFilterPhase("all");
    setFilterStatus("all");
    setFilterType("all");
    setSearchQuery("");
  };

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
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/roadmaps`] });
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
      const payload: Record<string, unknown> = {
        roadmapId: activeRoadmapId,
        projectId,
        title: data.title,
        type: data.type,
        priority: data.priority,
        status: data.status,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        description: data.description || null,
        orderIndex: roadmapItems.length,
      };
      // Add milestone-specific fields only for milestones
      if (data.type === "milestone") {
        payload.milestoneType = data.milestoneType;
        payload.isCritical = data.isCritical;
        payload.completionRule = data.completionRule;
        payload.completionThreshold = data.completionRule === "PERCENT_THRESHOLD" ? data.completionThreshold : null;
        payload.validationRequired = data.validationRequired;
        payload.impactEstimate = data.impactEstimate;
        // For milestones, use endDate as targetDate
        payload.targetDate = data.endDate || null;
      }
      return apiRequest('/api/roadmap-items', 'POST', payload);
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
      const payload: Record<string, unknown> = {
        title: data.title,
        type: data.type,
        priority: data.priority,
        status: data.status,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        description: data.description || null,
      };
      // Add milestone-specific fields only for milestones
      if (data.type === "milestone") {
        payload.milestoneType = data.milestoneType;
        payload.isCritical = data.isCritical;
        payload.completionRule = data.completionRule;
        payload.completionThreshold = data.completionRule === "PERCENT_THRESHOLD" ? data.completionThreshold : null;
        payload.validationRequired = data.validationRequired;
        payload.impactEstimate = data.impactEstimate;
        payload.targetDate = data.endDate || null;
      } else {
        // Clear milestone fields if type changed from milestone to something else
        payload.milestoneType = null;
        payload.isCritical = false;
        payload.completionRule = "MANUAL";
        payload.completionThreshold = null;
        payload.validationRequired = "NONE";
        payload.impactEstimate = {};
      }
      return apiRequest(`/api/roadmap-items/${id}`, 'PATCH', payload);
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
      milestoneType: "DELIVERY",
      isCritical: false,
      completionRule: "MANUAL",
      completionThreshold: 80,
      validationRequired: "NONE",
      impactEstimate: { timeImpactDays: 0, marginImpactPercent: 0, riskLevel: "low" },
    });
  };

  const handleOpenAddItem = () => {
    resetItemForm();
    setEditingItem(null);
    setIsItemDialogOpen(true);
  };

  const handleOpenEditItem = (item: RoadmapItem) => {
    setEditingItem(item);
    const impactEst = (item as any).impactEstimate || { timeImpactDays: 0, marginImpactPercent: 0, riskLevel: "low" };
    setItemForm({
      title: item.title,
      type: item.type,
      priority: item.priority,
      status: item.status,
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      description: item.description || "",
      milestoneType: (item as any).milestoneType || "DELIVERY",
      isCritical: (item as any).isCritical || false,
      completionRule: (item as any).completionRule || "MANUAL",
      completionThreshold: (item as any).completionThreshold || 80,
      validationRequired: (item as any).validationRequired || "NONE",
      impactEstimate: impactEst,
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

  const handleUpdateItemDates = async (itemId: string, startDate: Date, endDate: Date) => {
    try {
      await apiRequest(`/api/roadmap-items/${itemId}`, 'PATCH', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/items`] });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les dates.",
        variant: "destructive",
      });
    }
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
            <Button
              variant={showFilters ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filtres
              {hasActiveFilters && (
                <Badge variant="default" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-xs">
                  {[filterPhase !== "all", filterStatus !== "all", filterType !== "all", searchQuery.trim() !== ""].filter(Boolean).length}
                </Badge>
              )}
            </Button>
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
        
        {showFilters && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg border">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8"
                  data-testid="input-search-roadmap"
                />
              </div>
              
              <Select value={filterPhase} onValueChange={setFilterPhase}>
                <SelectTrigger className="w-[160px] h-8" data-testid="select-filter-phase">
                  <SelectValue placeholder="Phase" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PHASE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px] h-8" data-testid="select-filter-status">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px] h-8" data-testid="select-filter-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 text-muted-foreground"
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4 mr-1" />
                  Effacer
                </Button>
              )}
            </div>
            
            {phasesData?.currentPhase && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Phase actuelle:</span>
                <Badge variant="outline" className="font-medium">
                  {PHASE_LABELS[phasesData.currentPhase] || phasesData.currentPhase}
                </Badge>
                {phasesData.nextPhaseTransition && (
                  <span className="text-xs">
                    (transition vers {phasesData.nextPhaseTransition.phase} dans {phasesData.nextPhaseTransition.daysUntil}j)
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <RoadmapIndicators projectId={projectId} />
        <RoadmapRecommendations projectId={projectId} onItemClick={(id) => {
          const item = roadmapItems.find(i => i.id === id);
          if (item) handleOpenEditItem(item);
        }} />
        <MilestonesZone projectId={projectId} onMilestoneClick={handleOpenEditItem as any} />
        
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
        ) : filteredItems.length === 0 && hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
            <Filter className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Aucun élément ne correspond aux filtres sélectionnés.
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters} data-testid="button-clear-filters-empty">
              <X className="h-4 w-4 mr-1" />
              Effacer les filtres
            </Button>
          </div>
        ) : (
          <div className="min-h-[400px]">
            {hasActiveFilters && (
              <div className="mb-3 text-sm text-muted-foreground">
                {filteredItems.length} sur {roadmapItems.length} éléments affichés
              </div>
            )}
            {viewMode === "gantt" ? (
              <GanttView 
                items={filteredItems} 
                onItemClick={handleOpenEditItem}
                onAddItem={handleOpenAddItem}
                onUpdateItemDates={handleUpdateItemDates}
              />
            ) : (
              <OutputView 
                items={filteredItems}
                onItemClick={handleOpenEditItem}
                onAddItem={handleOpenAddItem}
                onItemMove={handleItemMove}
              />
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

            {/* Milestone-specific fields */}
            {itemForm.type === "milestone" && (
              <div className="border rounded-md p-4 space-y-4 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Paramètres du jalon</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="milestone-type">Type de jalon</Label>
                    <Select value={itemForm.milestoneType} onValueChange={(v) => setItemForm(prev => ({ ...prev, milestoneType: v }))}>
                      <SelectTrigger id="milestone-type" data-testid="select-milestone-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MILESTONE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="validation-required">Validation requise</Label>
                    <Select value={itemForm.validationRequired} onValueChange={(v) => setItemForm(prev => ({ ...prev, validationRequired: v }))}>
                      <SelectTrigger id="validation-required" data-testid="select-validation-required">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VALIDATION_REQUIREMENTS.map((req) => (
                          <SelectItem key={req.value} value={req.value}>{req.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is-critical" className="text-sm">Jalon critique</Label>
                    <p className="text-xs text-muted-foreground">Bloque la progression du projet si en retard</p>
                  </div>
                  <Switch
                    id="is-critical"
                    checked={itemForm.isCritical}
                    onCheckedChange={(checked) => setItemForm(prev => ({ ...prev, isCritical: checked }))}
                    data-testid="switch-is-critical"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="completion-rule">Règle de complétion</Label>
                    <Select value={itemForm.completionRule} onValueChange={(v) => setItemForm(prev => ({ ...prev, completionRule: v }))}>
                      <SelectTrigger id="completion-rule" data-testid="select-completion-rule">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPLETION_RULES.map((rule) => (
                          <SelectItem key={rule.value} value={rule.value}>{rule.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {itemForm.completionRule === "PERCENT_THRESHOLD" && (
                    <div className="space-y-2">
                      <Label htmlFor="completion-threshold">Seuil (%)</Label>
                      <Input
                        id="completion-threshold"
                        type="number"
                        min={0}
                        max={100}
                        value={itemForm.completionThreshold}
                        onChange={(e) => setItemForm(prev => ({ ...prev, completionThreshold: parseInt(e.target.value) || 0 }))}
                        data-testid="input-completion-threshold"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Estimation d'impact en cas de retard</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="impact-days" className="text-xs text-muted-foreground">Jours</Label>
                      <Input
                        id="impact-days"
                        type="number"
                        min={0}
                        value={itemForm.impactEstimate.timeImpactDays}
                        onChange={(e) => setItemForm(prev => ({ 
                          ...prev, 
                          impactEstimate: { ...prev.impactEstimate, timeImpactDays: parseInt(e.target.value) || 0 }
                        }))}
                        data-testid="input-impact-days"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="impact-margin" className="text-xs text-muted-foreground">Marge (%)</Label>
                      <Input
                        id="impact-margin"
                        type="number"
                        min={0}
                        max={100}
                        value={itemForm.impactEstimate.marginImpactPercent}
                        onChange={(e) => setItemForm(prev => ({ 
                          ...prev, 
                          impactEstimate: { ...prev.impactEstimate, marginImpactPercent: parseInt(e.target.value) || 0 }
                        }))}
                        data-testid="input-impact-margin"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="impact-risk" className="text-xs text-muted-foreground">Risque</Label>
                      <Select 
                        value={itemForm.impactEstimate.riskLevel} 
                        onValueChange={(v) => setItemForm(prev => ({ 
                          ...prev, 
                          impactEstimate: { ...prev.impactEstimate, riskLevel: v }
                        }))}
                      >
                        <SelectTrigger id="impact-risk" data-testid="select-impact-risk">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Faible</SelectItem>
                          <SelectItem value="medium">Moyen</SelectItem>
                          <SelectItem value="high">Élevé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {itemForm.type === "milestone" ? (
              <div className="space-y-2">
                <Label htmlFor="item-target-date">Date cible</Label>
                <Input
                  id="item-target-date"
                  type="date"
                  value={itemForm.endDate}
                  onChange={(e) => setItemForm(prev => ({ ...prev, endDate: e.target.value, startDate: e.target.value }))}
                  data-testid="input-item-target-date"
                />
              </div>
            ) : (
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
            )}

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

            {editingItem && (
              <RoadmapItemLinks roadmapItemId={editingItem.id} projectId={projectId} />
            )}
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
    </Card>
  );
}
