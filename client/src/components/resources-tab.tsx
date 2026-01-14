import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { format, parse } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  Info,
  AlertTriangle,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type {
  ProjectResource,
  humanProfileTypeOptions,
  humanModeOptions,
  nonHumanCategoryOptions,
  costTypeOptions,
} from "@shared/schema";

function parseDateString(dateStr: string): Date {
  return parse(dateStr, "yyyy-MM-dd", new Date());
}

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
  { value: "template", label: "Template site internet" },
  { value: "payment_fees", label: "Commissions de paiement" },
  { value: "inpi", label: "Dépôt INPI" },
  { value: "compliance", label: "RGPD / SOC2" },
  { value: "monitoring", label: "Sentry / Datadog" },
  { value: "cdn", label: "Cloudflare" },
  { value: "backup", label: "Backups externalisés" },
  { value: "ads", label: "Ads" },
  { value: "seo", label: "SEO tools" },
  { value: "design", label: "Design assets" },
  { value: "communication", label: "Outil de communication" },
  { value: "product", label: "Outil product" },
  { value: "marketing", label: "Outil marketing & Branding" },
  { value: "training", label: "Formation" },
  { value: "storage", label: "Stockage" },
  { value: "shipping", label: "Expédition" },
  { value: "other", label: "Autre" },
];

const costTypeOptionsLocal: { value: string; label: string }[] = [
  { value: "monthly", label: "Mensuel" },
  { value: "annual", label: "Annuel" },
  { value: "one_time", label: "Ponctuel" },
];

const humanResourceSuggestions = [
  "Développeur Frontend",
  "Développeur Backend",
  "Développeur Fullstack",
  "Designer UI/UX",
  "Product Owner",
  "Scrum Master",
  "Chef de projet",
  "DevOps Engineer",
  "Data Scientist",
  "QA Engineer",
  "Tech Lead",
  "Architecte logiciel",
  "Business Analyst",
  "Consultant technique",
];

const materialResourceSuggestions = [
  "Template site internet",
  "Commissions de paiement",
  "Dépôt INPI",
  "RGPD / SOC2",
  "Sentry / Datadog",
  "Cloudflare",
  "Backups externalisés",
  "Ads",
  "SEO tools",
  "Design assets",
  "Outil de communication",
  "Outil product",
  "Outil marketing & Branding",
  "Formation",
  "Stockage",
  "Expédition",
  "AWS / GCP / Azure",
  "Serveur dédié",
  "Base de données managée",
  "CDN",
  "Nom de domaine",
  "Certificat SSL",
  "Email professionnel",
  "CRM",
  "Analytics",
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
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const { data: resources = [], isLoading } = useQuery<ProjectResource[]>({
    queryKey: ["/api/projects", projectId, "resources"],
  });

  const summaryUrl = showSimulations 
    ? `/api/projects/${projectId}/resources/summary` 
    : `/api/projects/${projectId}/resources/summary?isSimulation=false`;
  
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
    queryKey: [summaryUrl],
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
      return apiRequest(`/api/projects/${projectId}/resources`, "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "resources"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === 'string' && query.queryKey[0].includes(`/api/projects/${projectId}/resources/summary`)
      });
      toast({ title: "Ressource créée", description: "La ressource a été ajoutée au projet.", variant: "success" });
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
      return apiRequest(`/api/resources/${id}`, "PATCH", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "resources"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === 'string' && query.queryKey[0].includes(`/api/projects/${projectId}/resources/summary`)
      });
      toast({ title: "Ressource modifiée", description: "Les modifications ont été enregistrées.", variant: "success" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/resources/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "resources"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === 'string' && query.queryKey[0].includes(`/api/projects/${projectId}/resources/summary`)
      });
      toast({ title: "Ressource supprimée", description: "La ressource a été retirée du projet.", variant: "success" });
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

  // Calculate non-billable resources cost for display
  const nonBillableCost = useMemo(() => {
    const filteredResources = resources.filter(r => showSimulations || r.isSimulation !== 1);
    return filteredResources.reduce((total, r) => {
      if (r.isBillable === 1) return total;
      if (r.type === "human") {
        const dailyCost = parseFloat(r.dailyCostInternal?.toString() || "0");
        const capacity = parseFloat(r.capacity?.toString() || "0");
        return total + (dailyCost * capacity);
      } else {
        return total + parseFloat(r.amount?.toString() || "0");
      }
    }, 0);
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="bg-white text-black font-light border shadow-sm text-[11px] max-w-[220px]">
                  Une ressource n'impacte les KPIs financiers que si un montant est renseigné.<br/>
                  Elle est ensuite considérée comme un coût interne et, si facturable, comme du chiffre d'affaires.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-lg font-bold" data-testid="kpi-margin">
              {summary ? formatCurrency(summary.margin) : "-"}
              {summary && summary.marginPercent > 0 && (
                <span className={`ml-2 text-sm ${summary.marginPercent >= 30 ? "text-green-600" : summary.marginPercent >= 15 ? "text-amber-600" : "text-red-600"}`}>
                  ({summary.marginPercent.toFixed(0)}%)
                </span>
              )}
            </div>
            {nonBillableCost > 0 && (
              <div className="text-xs text-muted-foreground mt-1" data-testid="non-billable-breakdown">
                Dont ressources non facturables : <span className="text-red-600">–{formatCurrency(nonBillableCost)}</span>
              </div>
            )}
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
                ({summary?.humanCount || 0} humaines, {summary?.nonHumanCount || 0} matérielles)
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
          <Button size="sm" variant="secondary" className="bg-white hover:bg-gray-50 dark:bg-gray-100 dark:hover:bg-gray-200 dark:text-gray-900" onClick={() => openCreateDialog("non_human")} data-testid="button-add-non-human">
            <Plus className="h-4 w-4 mr-1" />
            Ressource matérielle
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent className="bg-white text-black font-light border shadow-sm text-[11px] max-w-[200px] text-center">
              Afficher/masquer les simulations<br/>pour estimer l'impact financier
            </TooltipContent>
          </Tooltip>
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
                              <div className="flex flex-col items-center">
                                <Calculator className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground leading-none">simul.</span>
                              </div>
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
                          <div className="flex items-center gap-2">
                            {resource.isBillable === 1 ? (
                              <Badge variant="default" className="text-xs bg-green-600">Oui</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Non</Badge>
                            )}
                            {(() => {
                              const resourceCost = parseFloat(resource.dailyCostInternal?.toString() || "0") * parseFloat(resource.capacity?.toString() || "0");
                              const isSignificant = resource.isBillable !== 1 && 
                                resourceCost >= 500 && 
                                summary && summary.marginPercent < 15 &&
                                nonBillableCost > 0 && 
                                (resourceCost / nonBillableCost) >= 0.2;
                              return isSignificant && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-4 w-4 text-amber-500 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-white text-black font-light border shadow-sm text-[11px] max-w-[220px]">
                                    Cette ressource dégrade significativement la marge du projet.
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })()}
                          </div>
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
                <CardTitle className="text-sm">Ressources matérielles</CardTitle>
                <Badge variant="secondary" className="ml-2">{nonHumanResources.length}</Badge>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {nonHumanResources.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune ressource matérielle</p>
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
                              <div className="flex flex-col items-center">
                                <Calculator className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground leading-none">simul.</span>
                              </div>
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
                          <div className="flex items-center gap-2">
                            {resource.isBillable === 1 ? (
                              <Badge variant="default" className="text-xs bg-green-600">Oui</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Non</Badge>
                            )}
                            {(() => {
                              const resourceCost = parseFloat(resource.amount?.toString() || "0");
                              const isSignificant = resource.isBillable !== 1 && 
                                resourceCost >= 500 && 
                                summary && summary.marginPercent < 15 &&
                                nonBillableCost > 0 && 
                                (resourceCost / nonBillableCost) >= 0.2;
                              return isSignificant && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-4 w-4 text-amber-500 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-white text-black font-light border shadow-sm text-[11px] max-w-[220px]">
                                    Cette ressource dégrade significativement la marge du projet.
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })()}
                          </div>
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

      <Sheet open={showDialog} onOpenChange={setShowDialog}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-white dark:bg-background">
          <SheetHeader>
            <SheetTitle>
              {editingResource ? "Modifier la ressource" : formData.type === "human" ? "Nouvelle ressource humaine" : "Nouvelle ressource"}
            </SheetTitle>
            <SheetDescription>
              {formData.type === "human"
                ? "Ajoutez les informations de la personne qui travaille sur le projet."
                : "Ajoutez les coûts liés aux outils, services ou infrastructures."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={formData.type === "human" ? "Ex: Jean Dupont" : "Ex: Serveur AWS"}
                data-testid="input-resource-name"
                list={formData.type === "human" ? "human-suggestions" : "material-suggestions"}
              />
              <datalist id="human-suggestions">
                {humanResourceSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <datalist id="material-suggestions">
                {materialResourceSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
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
                    <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isCategoryOpen}
                          className="w-full justify-between font-normal"
                          data-testid="select-category"
                        >
                          {categoryOptions.find(opt => opt.value === formData.category)?.label || "Sélectionner..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Rechercher..." />
                          <CommandList>
                            <CommandEmpty>Aucun résultat.</CommandEmpty>
                            <CommandGroup>
                              {categoryOptions.map((opt) => (
                                <CommandItem
                                  key={opt.value}
                                  value={opt.label}
                                  onSelect={() => {
                                    setFormData({ ...formData, category: opt.value });
                                    setIsCategoryOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.category === opt.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {opt.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
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
                <Label>Date de début</Label>
                <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.startDate && "text-muted-foreground"
                      )}
                      data-testid="button-start-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.startDate
                        ? format(parseDateString(formData.startDate), "dd/MM/yyyy", { locale: fr })
                        : "Sélectionner"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.startDate ? parseDateString(formData.startDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          setFormData({ ...formData, startDate: `${year}-${month}-${day}` });
                        } else {
                          setFormData({ ...formData, startDate: "" });
                        }
                        setIsStartDateOpen(false);
                      }}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Date de fin</Label>
                <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.endDate && "text-muted-foreground"
                      )}
                      data-testid="button-end-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.endDate
                        ? format(parseDateString(formData.endDate), "dd/MM/yyyy", { locale: fr })
                        : "Sélectionner"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.endDate ? parseDateString(formData.endDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          setFormData({ ...formData, endDate: `${year}-${month}-${day}` });
                        } else {
                          setFormData({ ...formData, endDate: "" });
                        }
                        setIsEndDateOpen(false);
                      }}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
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

          <SheetFooter className="mt-6">
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
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
