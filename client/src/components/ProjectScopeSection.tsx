import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Calculator,
  FileText,
  Clock,
  DollarSign,
  Target,
  Lightbulb,
  FileDown,
  Copy,
  Check,
  Puzzle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ProjectScopeItem } from "@shared/schema";
import { CdcWizard } from "@/components/cdc/CdcWizard";
import { Wand2 } from "lucide-react";

interface ProjectScopeSectionProps {
  projectId: string;
  projectName?: string;
  dailyRate: number;
  internalDailyCost: number;
  targetMarginPercent: number;
  budget: number;
  projectStage?: string;
  tjmSource?: 'project' | 'global' | null;
}

const stageBadges: Record<string, { emoji: string; label: string }> = {
  prospection: { emoji: '🔵', label: 'Prospection' },
  en_cours: { emoji: '🟣', label: 'En cours' },
  termine: { emoji: '🟢', label: 'Terminé' },
  en_attente: { emoji: '🟡', label: 'En attente' },
  archive: { emoji: '⚫', label: 'Archivé' },
};

const SCOPE_TYPES = [
  { value: 'functional', label: 'Fonctionnel', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  { value: 'technical', label: 'Technique', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  { value: 'design', label: 'Design', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'gestion', label: 'Gestion', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { value: 'strategy', label: 'Stratégie', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'autre', label: 'Autre', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
];

const PHASES = [
  { value: 'T1', label: 'T1' },
  { value: 'T2', label: 'T2' },
  { value: 'T3', label: 'T3' },
  { value: 'T4', label: 'T4' },
  { value: 'LT', label: 'LT' },
];

interface ScopeItemRowProps {
  item: ProjectScopeItem;
  onUpdate: (id: string, data: Partial<ProjectScopeItem>) => void;
  onDelete: (id: string) => void;
}

function SortableScopeItem({ item, onUpdate, onDelete }: ScopeItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [estimatedDays, setEstimatedDays] = useState(item.estimatedDays?.toString() || "0");
  const [description, setDescription] = useState(item.description || "");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    const days = parseFloat(estimatedDays);
    if (!label.trim()) return;
    if (!Number.isFinite(days) || days < 0) return;
    onUpdate(item.id, {
      label: label.trim(),
      estimatedDays: days.toString(),
      description: description || null,
    });
    setIsEditing(false);
  };

  const scopeTypeInfo = SCOPE_TYPES.find(t => t.value === item.scopeType);
  const hasEnrichment = item.scopeType || item.phase || (item.isBillable !== null && item.isBillable !== 1);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-background border rounded-md ${isDragging ? 'shadow-lg' : 'hover-elevate'}`}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        {isEditing ? (
          <div className="flex-1 space-y-1.5">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Intitulé de la rubrique"
              className="h-8 text-sm"
              data-testid={`input-scope-label-${item.id}`}
            />
            <div className="flex gap-2 items-center">
              <div className="w-20">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={estimatedDays}
                  onChange={(e) => setEstimatedDays(e.target.value)}
                  placeholder="Jours"
                  className="h-8 text-sm"
                  data-testid={`input-scope-days-${item.id}`}
                />
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optionnel)"
                className="flex-1 resize-none text-sm min-h-[32px]"
                rows={1}
                data-testid={`input-scope-description-${item.id}`}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} data-testid={`button-save-scope-${item.id}`}>
                Enregistrer
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setIsEditing(true)}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm truncate">{item.label}</span>
                {item.isOptional === 1 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">Opt.</Badge>
                )}
                {scopeTypeInfo && (
                  <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${scopeTypeInfo.color}`}>
                    {scopeTypeInfo.label}
                  </Badge>
                )}
                {item.phase && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-primary/50">
                    {item.phase}
                  </Badge>
                )}
                {item.isBillable === 1 && (
                  <Badge className="text-[10px] px-1.5 py-0 shrink-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    <DollarSign className="h-2.5 w-2.5" />
                  </Badge>
                )}
              </div>
              {item.description && (
                <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 text-xs px-1.5 py-0">
                <Clock className="h-3 w-3 mr-0.5" />
                {parseFloat(item.estimatedDays?.toString() || "0")} j
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className={`h-7 w-7 ${hasEnrichment ? 'text-primary' : 'text-muted-foreground'} hover:text-primary`}
                onClick={() => setIsEnriching(!isEnriching)}
                data-testid={`button-enrich-scope-${item.id}`}
                title="Enrichir avec type, phase, facturable"
              >
                {isEnriching ? <ChevronUp className="h-3.5 w-3.5" /> : <Puzzle className="h-3.5 w-3.5" />}
              </Button>
              <Switch
                id={`optional-${item.id}`}
                checked={item.isOptional === 1}
                onCheckedChange={(checked) => onUpdate(item.id, { isOptional: checked ? 1 : 0 })}
                className="scale-75"
                data-testid={`switch-optional-${item.id}`}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(item.id)}
                data-testid={`button-delete-scope-${item.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>

      {isEnriching && !isEditing && (
        <div className="px-2 pb-2 pt-1 border-t bg-muted/30 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Type:</Label>
            <Select
              value={item.scopeType || ''}
              onValueChange={(value) => onUpdate(item.id, { scopeType: value || null })}
            >
              <SelectTrigger className="h-7 w-28 text-xs" data-testid={`select-scope-type-${item.id}`}>
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value} className="text-xs">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Phase:</Label>
            <Select
              value={item.phase || ''}
              onValueChange={(value) => onUpdate(item.id, { phase: value || null })}
            >
              <SelectTrigger className="h-7 w-20 text-xs" data-testid={`select-phase-${item.id}`}>
                <SelectValue placeholder="--" />
              </SelectTrigger>
              <SelectContent>
                {PHASES.map(phase => (
                  <SelectItem key={phase.value} value={phase.value} className="text-xs">
                    {phase.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor={`billable-${item.id}`} className="text-xs text-muted-foreground">Facturable:</Label>
            <Switch
              id={`billable-${item.id}`}
              checked={item.isBillable === 1}
              onCheckedChange={(checked) => onUpdate(item.id, { isBillable: checked ? 1 : 0 })}
              className="scale-75"
              data-testid={`switch-billable-${item.id}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface ScopeAlert {
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  icon: typeof AlertTriangle;
}

type PriorityLevel = 'information' | 'suggestion' | 'a_planifier' | 'a_traiter' | 'critique';

const priorityConfig: Record<PriorityLevel, { emoji: string; label: string; color: string; bgColor: string; borderColor: string }> = {
  information: { emoji: 'ℹ️', label: 'Information', color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-200 dark:border-blue-700' },
  suggestion: { emoji: '💡', label: 'Suggestion', color: 'text-cyan-700 dark:text-cyan-300', bgColor: 'bg-cyan-50 dark:bg-cyan-900/20', borderColor: 'border-cyan-200 dark:border-cyan-700' },
  a_planifier: { emoji: '📅', label: 'À planifier', color: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-700' },
  a_traiter: { emoji: '⚡', label: 'À traiter', color: 'text-orange-700 dark:text-orange-300', bgColor: 'bg-orange-50 dark:bg-orange-900/20', borderColor: 'border-orange-200 dark:border-orange-700' },
  critique: { emoji: '🚨', label: 'Critique', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-700' },
};

interface ScopeRecommendation {
  title: string;
  priorityAction: string; // Phrase de décision prioritaire
  why: string;
  action: string;
  type: 'action' | 'learning';
  priority: PriorityLevel;
  timing: 'maintenant' | 'avant_signature' | 'plus_tard' | 'retrospective';
  impact?: {
    amount: number;
    unit: 'par jour' | 'par projet' | 'potentiel' | 'futur';
    direction: 'gain' | 'perte';
  };
}

export function ProjectScopeSection({ 
  projectId, 
  projectName = 'Projet',
  dailyRate, 
  internalDailyCost, 
  targetMarginPercent,
  budget,
  tjmSource,
  projectStage = 'prospection'
}: ProjectScopeSectionProps) {
  const currentStageBadge = stageBadges[projectStage] || stageBadges.prospection;
  const isProjectCompleted = projectStage === 'termine' || projectStage === 'archive';
  const { toast } = useToast();
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemDays, setNewItemDays] = useState("");
  const [showCdcDraft, setShowCdcDraft] = useState(false);
  const [showCdcWizard, setShowCdcWizard] = useState(false);
  const [copied, setCopied] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: scopeData, isLoading } = useQuery<{
    scopeItems: ProjectScopeItem[];
    totals: {
      mandatoryDays: number;
      optionalDays: number;
      totalDays: number;
      estimatedCost: number;
      recommendedPrice: number;
      estimatedMargin: number;
      marginPercent: number;
    };
  }>({
    queryKey: ['/api/projects', projectId, 'scope-items'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { label: string; estimatedDays: string }) => {
      return apiRequest(`/api/projects/${projectId}/scope-items`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'scope-items'] });
      setNewItemLabel("");
      setNewItemDays("");
      toast({ title: "Rubrique ajoutée", variant: "success" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProjectScopeItem> }) => {
      return apiRequest(`/api/scope-items/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'scope-items'] });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/scope-items/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'scope-items'] });
      toast({ title: "Rubrique supprimée", variant: "success" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orders: { id: string; order: number }[]) => {
      return apiRequest(`/api/projects/${projectId}/scope-items/reorder`, "POST", { orders });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'scope-items'] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !scopeData?.scopeItems) return;

    const oldIndex = scopeData.scopeItems.findIndex((item) => item.id === active.id);
    const newIndex = scopeData.scopeItems.findIndex((item) => item.id === over.id);
    const newItems = arrayMove(scopeData.scopeItems, oldIndex, newIndex);

    const orders = newItems.map((item, index) => ({ id: item.id, order: index }));
    reorderMutation.mutate(orders);
  };

  const handleAddItem = () => {
    if (!newItemLabel.trim()) return;
    const days = parseFloat(newItemDays);
    if (!Number.isFinite(days) || days <= 0) return;
    createMutation.mutate({
      label: newItemLabel.trim(),
      estimatedDays: days.toString(),
    });
  };

  const handleUpdate = (id: string, data: Partial<ProjectScopeItem>) => {
    updateMutation.mutate({ id, data });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const totals = scopeData?.totals || {
    mandatoryDays: 0,
    optionalDays: 0,
    totalDays: 0,
    estimatedCost: 0,
    recommendedPrice: 0,
    estimatedMargin: 0,
    marginPercent: 0,
  };

  const alerts: ScopeAlert[] = [];
  const recommendations: ScopeRecommendation[] = [];

  const hasValidConfig = dailyRate > 0 && internalDailyCost > 0;
  const safeMargin = isNaN(totals.estimatedMargin) ? 0 : totals.estimatedMargin;
  const safeMarginPercent = isNaN(totals.marginPercent) ? 0 : totals.marginPercent;
  const safeCost = isNaN(totals.estimatedCost) ? 0 : totals.estimatedCost;
  const safePrice = isNaN(totals.recommendedPrice) ? 0 : totals.recommendedPrice;

  // Génération du CDC brouillon
  const generateCdcDraft = (): string => {
    if (!scopeData?.scopeItems || scopeData.scopeItems.length === 0) {
      return "Aucune rubrique définie. Ajoutez des rubriques obligatoires pour générer un brouillon.";
    }

    const mandatoryItems = scopeData.scopeItems.filter(item => item.isOptional !== 1);
    const optionalItems = scopeData.scopeItems.filter(item => item.isOptional === 1);

    if (mandatoryItems.length === 0) {
      return "Aucune rubrique obligatoire définie. Ajoutez au moins une rubrique non-optionnelle pour générer un brouillon de CDC.";
    }

    const today = new Date().toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let draft = `CAHIER DES CHARGES - BROUILLON
═══════════════════════════════════════════════════════════════

⚠️ DOCUMENT À VALIDER
Ce document est un brouillon généré automatiquement.
Il doit être relu, complété et validé avant envoi au client.

Date de génération : ${today}

═══════════════════════════════════════════════════════════════
1. PÉRIMÈTRE DU PROJET
═══════════════════════════════════════════════════════════════

`;

    if (mandatoryItems.length > 0) {
      draft += `1.1 Livrables obligatoires
───────────────────────────────────────────────────────────────

`;
      mandatoryItems.forEach((item, index) => {
        const days = parseFloat(item.estimatedDays?.toString() || "0");
        draft += `${index + 1}. ${item.label}
   Temps estimé : ${days} jour${days > 1 ? 's' : ''}
`;
        if (item.description) {
          draft += `   Description : ${item.description}
`;
        }
        draft += `
`;
      });
    }

    if (optionalItems.length > 0) {
      draft += `1.2 Livrables optionnels
───────────────────────────────────────────────────────────────

`;
      optionalItems.forEach((item, index) => {
        const days = parseFloat(item.estimatedDays?.toString() || "0");
        draft += `${index + 1}. ${item.label} (optionnel)
   Temps estimé : ${days} jour${days > 1 ? 's' : ''}
`;
        if (item.description) {
          draft += `   Description : ${item.description}
`;
        }
        draft += `
`;
      });
    }

    draft += `═══════════════════════════════════════════════════════════════
2. ESTIMATION PRÉVISIONNELLE
═══════════════════════════════════════════════════════════════

Temps total obligatoire : ${totals.mandatoryDays} jour${totals.mandatoryDays > 1 ? 's' : ''}
`;

    if (totals.optionalDays > 0) {
      draft += `Temps optionnel : ${totals.optionalDays} jour${totals.optionalDays > 1 ? 's' : ''}
`;
    }

    if (hasValidConfig) {
      draft += `
Prix recommandé : ${safePrice.toFixed(0)} € HT
(Base : TJM de ${dailyRate} €/jour)
`;
    }

    draft += `
═══════════════════════════════════════════════════════════════
3. CONDITIONS
═══════════════════════════════════════════════════════════════

[À compléter : modalités de paiement, délais, garanties...]

═══════════════════════════════════════════════════════════════
FIN DU DOCUMENT - BROUILLON À VALIDER
═══════════════════════════════════════════════════════════════
`;

    return draft;
  };

  const handleCopyDraft = () => {
    const draft = generateCdcDraft();
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Brouillon copié", description: "Le texte a été copié dans le presse-papiers", variant: "success" });
  };

  // Message spécifique si TJM manquant
  const hasTJM = dailyRate > 0;
  const tjmSourceLabel = tjmSource === 'project' ? 'projet' : tjmSource === 'global' ? 'global' : null;
  
  if (!hasTJM && totals.mandatoryDays > 0) {
    alerts.push({
      type: 'error',
      title: 'TJM non défini',
      message: 'Aucun TJM n\'est défini pour ce projet. Définissez un TJM dans les paramètres du projet ou un TJM par défaut dans les paramètres du compte.',
      icon: AlertTriangle,
    });
  } else if (!hasValidConfig && totals.mandatoryDays > 0) {
    alerts.push({
      type: 'warning',
      title: 'Configuration incomplète',
      message: 'Le coût interne journalier n\'est pas défini. Complétez la configuration du projet pour activer le chiffrage.',
      icon: AlertTriangle,
    });
  }

  // Calculs pour impacts financiers contextualisés
  const marginGap = targetMarginPercent > 0 ? (targetMarginPercent - safeMarginPercent) : 0;
  const priceGapWithBudget = budget > 0 ? safePrice - budget : 0;
  const dailyMarginLoss = hasValidConfig && internalDailyCost > 0 ? dailyRate - internalDailyCost : 0;

  if (hasValidConfig && safeMargin < 0) {
    alerts.push({
      type: 'error',
      title: '🔴 Rentabilité non atteinte',
      message: 'À ce stade, ce projet n\'atteint pas votre objectif de rentabilité.',
      icon: AlertTriangle,
    });
    recommendations.push({
      title: "Augmenter le prix",
      priorityAction: isProjectCompleted 
        ? `Retenir : ce projet a généré une perte de ${Math.abs(safeMargin).toFixed(0)} € par projet.`
        : `Augmenter le prix de ${Math.abs(safeMargin).toFixed(0)} € avant signature.`,
      why: "La marge actuelle est négative. Le prix ne couvre pas les coûts de production estimés.",
      action: `Augmentez le prix d'au moins ${Math.abs(safeMargin).toFixed(0)} € pour atteindre l'équilibre sur ce projet.`,
      type: isProjectCompleted ? 'learning' : 'action',
      priority: isProjectCompleted ? 'information' : 'critique',
      timing: isProjectCompleted ? 'retrospective' : 'maintenant',
      impact: {
        amount: Math.abs(safeMargin),
        unit: 'par projet',
        direction: 'perte',
      },
    });
    recommendations.push({
      title: "Rendre certaines rubriques optionnelles",
      priorityAction: isProjectCompleted 
        ? `Retenir : réduire le périmètre de ${Math.ceil(Math.abs(safeMargin) / internalDailyCost)} jour(s) aurait équilibré ce projet.`
        : `Réduire le périmètre de ${Math.ceil(Math.abs(safeMargin) / internalDailyCost)} jour(s) pour équilibrer.`,
      why: `Le périmètre actuel (${totals.mandatoryDays} jours) génère un coût de ${safeCost.toFixed(0)} € supérieur au prix prévu.`,
      action: `Réduisez d'environ ${Math.ceil(Math.abs(safeMargin) / internalDailyCost)} jour(s) le périmètre obligatoire pour atteindre l'équilibre.`,
      type: isProjectCompleted ? 'learning' : 'action',
      priority: isProjectCompleted ? 'suggestion' : 'a_traiter',
      timing: isProjectCompleted ? 'retrospective' : 'avant_signature',
      impact: {
        amount: Math.abs(safeMargin),
        unit: 'par projet',
        direction: 'perte',
      },
    });
  } else if (hasValidConfig && targetMarginPercent > 0 && safeMarginPercent < targetMarginPercent) {
    const targetMarginAmount = safeCost * (targetMarginPercent / 100);
    const missingMargin = targetMarginAmount - safeMargin;
    alerts.push({
      type: 'warning',
      title: '🟠 Marge insuffisante',
      message: 'La marge prévisionnelle est inférieure à votre objectif. Une adaptation du prix ou du périmètre est recommandée.',
      icon: TrendingDown,
    });
    recommendations.push({
      title: "Augmenter le prix",
      priorityAction: isProjectCompleted 
        ? `Retenir : ajouter ${missingMargin.toFixed(0)} € aurait atteint votre objectif de marge.`
        : `Ajouter ${missingMargin.toFixed(0)} € au prix pour atteindre votre objectif de marge.`,
      why: `La marge actuelle (${safeMarginPercent.toFixed(1)}%) est inférieure à votre objectif (${targetMarginPercent}%).`,
      action: `Augmentez le prix d'environ ${missingMargin.toFixed(0)} € pour atteindre votre objectif de marge.`,
      type: isProjectCompleted ? 'learning' : 'action',
      priority: isProjectCompleted ? 'suggestion' : 'a_traiter',
      timing: isProjectCompleted ? 'retrospective' : 'avant_signature',
      impact: missingMargin > 0 ? {
        amount: missingMargin,
        unit: 'potentiel',
        direction: 'perte',
      } : undefined,
    });
  }

  if (hasValidConfig && dailyRate < internalDailyCost * 1.2) {
    const dailyGap = internalDailyCost * 1.2 - dailyRate;
    const totalGap = dailyGap * totals.mandatoryDays;
    alerts.push({
      type: 'warning',
      title: '⚠️ TJM implicite faible',
      message: 'Le TJM implicite de ce projet est inférieur à votre TJM cible.',
      icon: AlertTriangle,
    });
    recommendations.push({
      title: "Revoir le TJM",
      priorityAction: isProjectCompleted 
        ? `Retenir : un TJM trop faible a coûté ${totalGap.toFixed(0)} € sur ce projet.`
        : `Négocier un TJM supérieur ou réduire le scope pour limiter la perte.`,
      why: `Le TJM actuel (${dailyRate} €/j) ne couvre pas suffisamment votre coût interne (${internalDailyCost} €/j + 20% de marge cible).`,
      action: `Négociez un TJM supérieur ou réduisez le nombre de jours pour limiter la perte estimée sur ce projet.`,
      type: isProjectCompleted ? 'learning' : 'action',
      priority: isProjectCompleted ? 'information' : 'a_planifier',
      timing: isProjectCompleted ? 'retrospective' : 'avant_signature',
      impact: {
        amount: totalGap,
        unit: 'par projet',
        direction: 'perte',
      },
    });
  }

  if (budget > 0 && safePrice > budget) {
    alerts.push({
      type: 'info',
      title: 'ℹ️ Écart avec budget client',
      message: 'Le prix recommandé dépasse le budget client renseigné. Une discussion ou un ajustement du périmètre peut être nécessaire.',
      icon: TrendingUp,
    });
    recommendations.push({
      title: "Renégocier le projet",
      priorityAction: isProjectCompleted 
        ? `Retenir : l'écart de ${priceGapWithBudget.toFixed(0)} € avec le budget client a impacté ce projet.`
        : `Discuter avec le client pour combler l'écart de ${priceGapWithBudget.toFixed(0)} € avant signature.`,
      why: `Le prix recommandé (${safePrice.toFixed(0)} €) dépasse le budget client (${budget.toFixed(0)} €) de ${priceGapWithBudget.toFixed(0)} €.`,
      action: "Discutez avec le client pour augmenter le budget ou réduire le périmètre avant signature.",
      type: isProjectCompleted ? 'learning' : 'action',
      priority: isProjectCompleted ? 'information' : 'a_traiter',
      timing: isProjectCompleted ? 'retrospective' : 'avant_signature',
      impact: {
        amount: priceGapWithBudget,
        unit: 'potentiel',
        direction: 'perte',
      },
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-lg flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              Cahier des Charges - Chiffrage
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowCdcWizard(true)}
                data-testid="button-cdc-wizard"
              >
                <Wand2 className="h-4 w-4 mr-1" />
                Session guidée
              </Button>
              {scopeData?.scopeItems && scopeData.scopeItems.filter(item => item.isOptional !== 1).length > 0 && (
              <Dialog open={showCdcDraft} onOpenChange={setShowCdcDraft}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-generate-cdc-draft">
                    <FileDown className="h-4 w-4 mr-1" />
                    Générer brouillon
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-violet-600" />
                      Brouillon de Cahier des Charges
                    </DialogTitle>
                    <DialogDescription>
                      Document généré automatiquement. À valider et compléter avant envoi.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm">
                    <span className="shrink-0">!</span>
                    <p className="text-amber-700 dark:text-amber-300">
                      Ce brouillon doit être relu, adapté et validé selon votre contexte avant toute diffusion.
                    </p>
                  </div>
                  <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                    <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                      {generateCdcDraft()}
                    </pre>
                  </ScrollArea>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={handleCopyDraft}
                      data-testid="button-copy-cdc-draft"
                    >
                      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      {copied ? 'Copié !' : 'Copier le texte'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Formulaire d'ajout */}
          <div className="flex gap-2">
            <Input
              placeholder="Intitulé de la rubrique"
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              className="flex-1 h-8 text-sm"
              data-testid="input-new-scope-label"
            />
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="Jours"
              value={newItemDays}
              onChange={(e) => setNewItemDays(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              className="w-20 h-8 text-sm"
              data-testid="input-new-scope-days"
            />
            <Button 
              size="sm"
              onClick={handleAddItem} 
              disabled={!newItemLabel.trim() || !newItemDays}
              data-testid="button-add-scope-item"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>

          {/* Liste des rubriques */}
          {scopeData?.scopeItems && scopeData.scopeItems.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={scopeData.scopeItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {scopeData.scopeItems.map((item) => (
                    <SortableScopeItem
                      key={item.id}
                      item={item}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucune rubrique définie</p>
              <p className="text-xs">Ajoutez des rubriques pour estimer le projet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Texte de cadrage global */}
      <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 text-xs">
        <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-600" />
        <p className="text-muted-foreground">
          Les estimations et recommandations constituent une aide à la décision. Elles doivent être adaptées à votre contexte.
        </p>
      </div>

      {recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base flex-wrap">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Recommandations {isProjectCompleted ? '' : 'pré-vente'}
              </div>
              <Badge variant="outline" className="text-xs">
                {currentStageBadge.emoji} {currentStageBadge.label}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isProjectCompleted && (
              <div className="flex items-start gap-2 p-2 mb-3 rounded-lg bg-muted/50 border border-muted text-sm">
                <span>📚</span>
                <p className="text-muted-foreground">
                  Apprentissage pour les prochains projets. Ces recommandations ne sont pas actionnables immédiatement.
                </p>
              </div>
            )}
            <div className="space-y-4">
              {recommendations.map((rec, index) => {
                const priorityStyle = priorityConfig[rec.priority];
                const timingLabels: Record<string, { emoji: string; label: string }> = {
                  maintenant: { emoji: '🔥', label: 'Maintenant' },
                  avant_signature: { emoji: '✍️', label: 'Avant signature' },
                  plus_tard: { emoji: '📅', label: 'Plus tard' },
                  retrospective: { emoji: '📖', label: 'Rétrospective' },
                };
                const timingStyle = timingLabels[rec.timing] || timingLabels.maintenant;

                return (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border-l-4 ${priorityStyle.bgColor} ${priorityStyle.borderColor}`}
                    data-testid={`recommendation-card-${index}`}
                  >
                    {/* Ligne 1 : Badges priorité + timing + étape projet */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs font-medium ${priorityStyle.bgColor} ${priorityStyle.color} ${priorityStyle.borderColor}`}
                      >
                        {priorityStyle.emoji} {priorityStyle.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-muted/50">
                        {timingStyle.emoji} {timingStyle.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-muted/50">
                        {currentStageBadge.emoji} {currentStageBadge.label}
                      </Badge>
                    </div>

                    {/* Ligne 2 : Phrase de décision prioritaire (en gras, visible immédiatement) */}
                    <p className={`font-semibold text-sm mb-2 ${priorityStyle.color}`}>
                      {rec.priorityAction}
                    </p>

                    {/* Ligne 3 : Titre + Type action/learning */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-sm text-foreground">{rec.title}</p>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${rec.type === 'action' ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-700' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'}`}
                      >
                        {rec.type === 'action' ? '⚡ Action' : '📚 Apprentissage'}
                      </Badge>
                    </div>

                    {/* Ligne 4 : Pourquoi (contexte) */}
                    <p className="text-xs text-muted-foreground mb-1">
                      <strong>Pourquoi :</strong> {rec.why}
                    </p>

                    {/* Ligne 5 : Action détaillée */}
                    <p className="text-sm text-foreground mb-2">
                      <strong>Action :</strong> {rec.action}
                    </p>

                    {/* Ligne 6 : Impact financier avec unité explicite */}
                    {rec.impact && rec.impact.amount > 0 && (
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                        rec.impact.direction === 'gain' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {rec.impact.direction === 'gain' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>
                          {rec.impact.direction === 'gain' ? '+' : '-'}{rec.impact.amount.toFixed(0)} € ({rec.impact.unit})
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <CdcWizard
        projectId={projectId}
        projectName={projectName}
        dailyRate={dailyRate}
        isOpen={showCdcWizard}
        onClose={() => setShowCdcWizard(false)}
        onComplete={(sessionId, backlogId, roadmapId) => {
          setShowCdcWizard(false);
          queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'scope-items'] });
          toast({
            title: "Session CDC terminée",
            description: backlogId || roadmapId 
              ? "Le backlog et/ou la roadmap ont été générés avec succès"
              : "La session a été enregistrée",
            variant: "success",
          });
        }}
      />
    </div>
  );
}
