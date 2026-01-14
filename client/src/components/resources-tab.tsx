import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  Users,
  Server,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  MoreVertical,
  Calculator,
  TrendingUp,
  Wallet,
  FlaskConical,
  Eye,
  EyeOff,
} from "lucide-react";
import type {
  ProjectResource,
  humanProfileTypeOptions,
  humanModeOptions,
  nonHumanCategoryOptions,
  costTypeOptions,
} from "@shared/schema";

interface ResourcesTabProps {
  projectId: string;
  accountId: string;
}

type ResourceFormData = {
  name: string;
  type: "human" | "non_human";
  profileType?: string;
  mode?: string;
  dailyCostInternal?: string;
  dailyRateBilled?: string;
  capacity?: string;
  category?: string;
  costType?: string;
  amount?: string;
  startDate?: string;
  endDate?: string;
  roadmapPhase?: string;
  isBillable: boolean;
  isSimulation: boolean;
  notes?: string;
};

const initialFormData: ResourceFormData = {
  name: "",
  type: "human",
  profileType: "developer",
  mode: "internal",
  dailyCostInternal: "",
  dailyRateBilled: "",
  capacity: "",
  category: "hosting",
  costType: "monthly",
  amount: "",
  startDate: "",
  endDate: "",
  roadmapPhase: "",
  isBillable: true,
  isSimulation: false,
  notes: "",
};

const profileTypeOptions: { value: string; label: string }[] = [
  { value: "developer", label: "Développeur" },
  { value: "designer", label: "Designer" },
  { value: "product_manager", label: "Product Manager" },
  { value: "marketing", label: "Marketing" },
  { value: "qa", label: "QA / Testeur" },
  { value: "devops", label: "DevOps" },
  { value: "project_manager", label: "Chef de projet" },
  { value: "consultant", label: "Consultant" },
  { value: "other", label: "Autre" },
];

const modeOptions: { value: string; label: string }[] = [
  { value: "internal", label: "Interne" },
  { value: "freelance", label: "Freelance" },
  { value: "contractor", label: "Sous-traitant" },
];

const categoryOptions: { value: string; label: string }[] = [
  { value: "hosting", label: "Hébergement" },
  { value: "saas", label: "Outils SaaS" },
  { value: "api", label: "API / IA" },
  { value: "license", label: "Licences" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "outsourcing", label: "Sous-traitance" },
  { value: "other", label: "Autre" },
];

const costTypeOptionsLocal: { value: string; label: string }[] = [
  { value: "monthly", label: "Mensuel" },
  { value: "annual", label: "Annuel" },
  { value: "one_time", label: "Ponctuel" },
];

export function ResourcesTab({ projectId, accountId }: ResourcesTabProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingResource, setEditingResource] = useState<ProjectResource | null>(null);
  const [formData, setFormData] = useState<ResourceFormData>(initialFormData);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<ProjectResource | null>(null);
  const [humanExpanded, setHumanExpanded] = useState(true);
  const [nonHumanExpanded, setNonHumanExpanded] = useState(true);
  const [showSimulations, setShowSimulations] = useState(false);

  const { data: resources = [], isLoading } = useQuery<ProjectResource[]>({
    queryKey: ["/api/projects", projectId, "resources"],
  });

  const { data: summary } = useQuery<{
    humanCount: number;
    nonHumanCount: number;
    totalCount: number;
    totalInternalCost: number;
    totalBilledAmount: number;
    totalNonHumanCost: number;
    margin: number;
    marginPercent: number;
  }>({
    queryKey: ["/api/projects", projectId, "resources", "summary", { isSimulation: showSimulations ? undefined : "false" }],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ResourceFormData) => {
      const payload = {
        name: data.name,
        type: data.type,
        profileType: data.type === "human" ? data.profileType : null,
        mode: data.type === "human" ? data.mode : null,
        dailyCostInternal: data.type === "human" && data.dailyCostInternal ? data.dailyCostInternal : null,
        dailyRateBilled: data.type === "human" && data.dailyRateBilled ? data.dailyRateBilled : null,
        capacity: data.type === "human" && data.capacity ? parseFloat(data.capacity) : null,
        category: data.type === "non_human" ? data.category : null,
        costType: data.type === "non_human" ? data.costType : null,
        amount: data.type === "non_human" && data.amount ? data.amount : null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        roadmapPhase: data.roadmapPhase || null,
        isBillable: data.isBillable ? 1 : 0,
        isSimulation: data.isSimulation ? 1 : 0,
        notes: data.notes || null,
      };
      return apiRequest(`/api/projects/${projectId}/resources`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "resources"] });
      toast({ title: "Ressource créée", description: "La ressource a été ajoutée au projet." });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ResourceFormData }) => {
      const payload = {
        name: data.name,
        type: data.type,
        profileType: data.type === "human" ? data.profileType : null,
        mode: data.type === "human" ? data.mode : null,
        dailyCostInternal: data.type === "human" && data.dailyCostInternal ? data.dailyCostInternal : null,
        dailyRateBilled: data.type === "human" && data.dailyRateBilled ? data.dailyRateBilled : null,
        capacity: data.type === "human" && data.capacity ? parseFloat(data.capacity) : null,
        category: data.type === "non_human" ? data.category : null,
        costType: data.type === "non_human" ? data.costType : null,
        amount: data.type === "non_human" && data.amount ? data.amount : null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        roadmapPhase: data.roadmapPhase || null,
        isBillable: data.isBillable ? 1 : 0,
        isSimulation: data.isSimulation ? 1 : 0,
        notes: data.notes || null,
      };
      return apiRequest(`/api/resources/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "resources"] });
      toast({ title: "Ressource modifiée", description: "Les modifications ont été enregistrées." });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/resources/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "resources"] });
      toast({ title: "Ressource supprimée", description: "La ressource a été retirée du projet." });
      setShowDeleteDialog(false);
      setResourceToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingResource(null);
  };

  const openCreateDialog = (type: "human" | "non_human") => {
    resetForm();
    setFormData({ ...initialFormData, type });
    setShowDialog(true);
  };

  const openEditDialog = (resource: ProjectResource) => {
    setEditingResource(resource);
    setFormData({
      name: resource.name,
      type: resource.type as "human" | "non_human",
      profileType: resource.profileType || "developer",
      mode: resource.mode || "internal",
      dailyCostInternal: resource.dailyCostInternal?.toString() || "",
      dailyRateBilled: resource.dailyRateBilled?.toString() || "",
      capacity: resource.capacity?.toString() || "",
      category: resource.category || "hosting",
      costType: resource.costType || "monthly",
      amount: resource.amount?.toString() || "",
      startDate: resource.startDate || "",
      endDate: resource.endDate || "",
      roadmapPhase: resource.roadmapPhase || "",
      isBillable: resource.isBillable === 1,
      isSimulation: resource.isSimulation === 1,
      notes: resource.notes || "",
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Erreur", description: "Le nom est requis.", variant: "destructive" });
      return;
    }

    if (editingResource) {
      updateMutation.mutate({ id: editingResource.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const humanResources = useMemo(() => {
    return resources.filter((r) => r.type === "human" && (showSimulations || r.isSimulation !== 1));
  }, [resources, showSimulations]);

  const nonHumanResources = useMemo(() => {
    return resources.filter((r) => r.type === "non_human" && (showSimulations || r.isSimulation !== 1));
  }, [resources, showSimulations]);

  const getProfileLabel = (value: string | null) =>
    profileTypeOptions.find((o) => o.value === value)?.label || value || "-";
  const getModeLabel = (value: string | null) =>
    modeOptions.find((o) => o.value === value)?.label || value || "-";
  const getCategoryLabel = (value: string | null) =>
    categoryOptions.find((o) => o.value === value)?.label || value || "-";
  const getCostTypeLabel = (value: string | null) =>
    costTypeOptionsLocal.find((o) => o.value === value)?.label || value || "-";

  const formatCurrency = (value: number) =>
    value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calculator className="h-4 w-4" />
              <span className="text-xs">Coût interne total</span>
            </div>
            <div className="text-lg font-bold" data-testid="kpi-internal-cost">
              {summary ? formatCurrency(summary.totalInternalCost) : "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Wallet className="h-4 w-4" />
              <span className="text-xs">CA facturable</span>
            </div>
            <div className="text-lg font-bold" data-testid="kpi-billed-amount">
              {summary ? formatCurrency(summary.totalBilledAmount) : "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Marge prévisionnelle</span>
            </div>
            <div className="text-lg font-bold" data-testid="kpi-margin">
              {summary ? formatCurrency(summary.margin) : "-"}
              {summary && summary.marginPercent > 0 && (
                <span className={`ml-2 text-sm ${summary.marginPercent >= 30 ? "text-green-600" : summary.marginPercent >= 15 ? "text-amber-600" : "text-red-600"}`}>
                  ({summary.marginPercent.toFixed(0)}%)
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">Ressources</span>
            </div>
            <div className="text-lg font-bold" data-testid="kpi-resource-count">
              {summary ? summary.totalCount : 0}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({summary?.humanCount || 0} humaines, {summary?.nonHumanCount || 0} autres)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => openCreateDialog("human")} data-testid="button-add-human">
            <Plus className="h-4 w-4 mr-1" />
            Ressource humaine
          </Button>
          <Button size="sm" variant="outline" onClick={() => openCreateDialog("non_human")} data-testid="button-add-non-human">
            <Plus className="h-4 w-4 mr-1" />
            Autre ressource
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={showSimulations ? "secondary" : "ghost"}
            onClick={() => setShowSimulations(!showSimulations)}
            data-testid="button-toggle-simulations"
          >
            {showSimulations ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
            <FlaskConical className="h-4 w-4 mr-1" />
            Simulations
          </Button>
        </div>
      </div>

      <Card>
        <Collapsible open={humanExpanded} onOpenChange={setHumanExpanded}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover-elevate py-3">
              <div className="flex items-center gap-2">
                {humanExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Users className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Ressources humaines</CardTitle>
                <Badge variant="secondary" className="ml-2">{humanResources.length}</Badge>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {humanResources.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune ressource humaine</p>
                  <Button variant="link" size="sm" onClick={() => openCreateDialog("human")}>
                    Ajouter une ressource
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Profil</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Coût/j</TableHead>
                      <TableHead className="text-right">TJM facturé</TableHead>
                      <TableHead className="text-right">Capacité</TableHead>
                      <TableHead>Facturable</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {humanResources.map((resource) => (
                      <TableRow key={resource.id} className={resource.isSimulation === 1 ? "opacity-60 bg-muted/30" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {resource.name}
                            {resource.isSimulation === 1 && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <FlaskConical className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>Simulation</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getProfileLabel(resource.profileType)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getModeLabel(resource.mode)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {resource.dailyCostInternal ? `${parseFloat(resource.dailyCostInternal).toLocaleString("fr-FR")} €` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {resource.dailyRateBilled ? `${parseFloat(resource.dailyRateBilled).toLocaleString("fr-FR")} €` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {resource.capacity ? `${resource.capacity} j` : "-"}
                        </TableCell>
                        <TableCell>
                          {resource.isBillable === 1 ? (
                            <Badge variant="default" className="text-xs bg-green-600">Oui</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Non</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-resource-menu-${resource.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(resource)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setResourceToDelete(resource);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card>
        <Collapsible open={nonHumanExpanded} onOpenChange={setNonHumanExpanded}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover-elevate py-3">
              <div className="flex items-center gap-2">
                {nonHumanExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Server className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Autres ressources</CardTitle>
                <Badge variant="secondary" className="ml-2">{nonHumanResources.length}</Badge>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {nonHumanResources.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune autre ressource</p>
                  <Button variant="link" size="sm" onClick={() => openCreateDialog("non_human")}>
                    Ajouter une ressource
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Type de coût</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Facturable</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nonHumanResources.map((resource) => (
                      <TableRow key={resource.id} className={resource.isSimulation === 1 ? "opacity-60 bg-muted/30" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {resource.name}
                            {resource.isSimulation === 1 && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <FlaskConical className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>Simulation</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getCategoryLabel(resource.category)}
                          </Badge>
                        </TableCell>
                        <TableCell>{getCostTypeLabel(resource.costType)}</TableCell>
                        <TableCell className="text-right">
                          {resource.amount ? `${parseFloat(resource.amount).toLocaleString("fr-FR")} €` : "-"}
                        </TableCell>
                        <TableCell>
                          {resource.isBillable === 1 ? (
                            <Badge variant="default" className="text-xs bg-green-600">Oui</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Non</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-resource-menu-${resource.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(resource)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setResourceToDelete(resource);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingResource ? "Modifier la ressource" : formData.type === "human" ? "Nouvelle ressource humaine" : "Nouvelle ressource"}
            </DialogTitle>
            <DialogDescription>
              {formData.type === "human"
                ? "Ajoutez les informations de la personne qui travaille sur le projet."
                : "Ajoutez les coûts liés aux outils, services ou infrastructures."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={formData.type === "human" ? "Ex: Jean Dupont" : "Ex: Serveur AWS"}
                data-testid="input-resource-name"
              />
            </div>

            {formData.type === "human" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Profil</Label>
                    <Select
                      value={formData.profileType}
                      onValueChange={(v) => setFormData({ ...formData, profileType: v })}
                    >
                      <SelectTrigger data-testid="select-profile-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {profileTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Mode</Label>
                    <Select
                      value={formData.mode}
                      onValueChange={(v) => setFormData({ ...formData, mode: v })}
                    >
                      <SelectTrigger data-testid="select-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dailyCostInternal">Coût journalier interne (€)</Label>
                    <Input
                      id="dailyCostInternal"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.dailyCostInternal}
                      onChange={(e) => setFormData({ ...formData, dailyCostInternal: e.target.value })}
                      placeholder="Ex: 350"
                      data-testid="input-daily-cost"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dailyRateBilled">TJM facturé au client (€)</Label>
                    <Input
                      id="dailyRateBilled"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.dailyRateBilled}
                      onChange={(e) => setFormData({ ...formData, dailyRateBilled: e.target.value })}
                      placeholder="Ex: 600"
                      data-testid="input-daily-rate"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="capacity">Capacité (jours)</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    placeholder="Ex: 20"
                    data-testid="input-capacity"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Nombre de jours prévus sur le projet
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Catégorie</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger data-testid="select-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type de coût</Label>
                    <Select
                      value={formData.costType}
                      onValueChange={(v) => setFormData({ ...formData, costType: v })}
                    >
                      <SelectTrigger data-testid="select-cost-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {costTypeOptionsLocal.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="amount">Montant (€)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="Ex: 99"
                    data-testid="input-amount"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Date de début</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label htmlFor="endDate">Date de fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Informations complémentaires..."
                rows={2}
                data-testid="input-notes"
              />
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="isBillable"
                  checked={formData.isBillable}
                  onCheckedChange={(checked) => setFormData({ ...formData, isBillable: checked })}
                  data-testid="switch-billable"
                />
                <Label htmlFor="isBillable" className="text-sm">
                  Facturable au client
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isSimulation"
                  checked={formData.isSimulation}
                  onCheckedChange={(checked) => setFormData({ ...formData, isSimulation: checked })}
                  data-testid="switch-simulation"
                />
                <Label htmlFor="isSimulation" className="text-sm flex items-center gap-1">
                  <FlaskConical className="h-3 w-3" />
                  Simulation
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-resource"
            >
              {createMutation.isPending || updateMutation.isPending ? "Enregistrement..." : editingResource ? "Modifier" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la ressource ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement "{resourceToDelete?.name}" du projet. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resourceToDelete && deleteMutation.mutate(resourceToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
