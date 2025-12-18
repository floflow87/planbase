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
  Check
} from "lucide-react";
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

interface ProjectScopeSectionProps {
  projectId: string;
  dailyRate: number;
  internalDailyCost: number;
  targetMarginPercent: number;
  budget: number;
  projectStage?: string;
}

const stageBadges: Record<string, { emoji: string; label: string }> = {
  prospection: { emoji: '🔵', label: 'Prospection' },
  en_cours: { emoji: '🟣', label: 'En cours' },
  termine: { emoji: '🟢', label: 'Terminé' },
  en_attente: { emoji: '🟡', label: 'En attente' },
  archive: { emoji: '⚫', label: 'Archivé' },
};

interface ScopeItemRowProps {
  item: ProjectScopeItem;
  onUpdate: (id: string, data: Partial<ProjectScopeItem>) => void;
  onDelete: (id: string) => void;
}

function SortableScopeItem({ item, onUpdate, onDelete }: ScopeItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-background border rounded-lg ${isDragging ? 'shadow-lg' : 'hover-elevate'}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {isEditing ? (
        <div className="flex-1 space-y-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Intitulé de la rubrique"
            data-testid={`input-scope-label-${item.id}`}
          />
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Input
                type="number"
                step="0.5"
                min="0"
                value={estimatedDays}
                onChange={(e) => setEstimatedDays(e.target.value)}
                placeholder="Jours"
                data-testid={`input-scope-days-${item.id}`}
              />
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optionnel)"
              className="flex-[2] resize-none"
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
          <div className="flex-1 min-w-0" onClick={() => setIsEditing(true)}>
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{item.label}</span>
              {item.isOptional === 1 && (
                <Badge variant="outline" className="text-xs shrink-0">Optionnel</Badge>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              <Clock className="h-3 w-3 mr-1" />
              {parseFloat(item.estimatedDays?.toString() || "0")} j
            </Badge>
            <div className="flex items-center gap-1">
              <Label htmlFor={`optional-${item.id}`} className="text-xs text-muted-foreground">
                Opt.
              </Label>
              <Switch
                id={`optional-${item.id}`}
                checked={item.isOptional === 1}
                onCheckedChange={(checked) => onUpdate(item.id, { isOptional: checked ? 1 : 0 })}
                data-testid={`switch-optional-${item.id}`}
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(item.id)}
              data-testid={`button-delete-scope-${item.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </>
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

interface ScopeRecommendation {
  title: string;
  why: string;
  action: string;
  type: 'action' | 'learning';
  impact?: {
    amount: number;
    unit: 'par jour' | 'par projet' | 'total';
    direction: 'gain' | 'perte';
  };
}

export function ProjectScopeSection({ 
  projectId, 
  dailyRate, 
  internalDailyCost, 
  targetMarginPercent,
  budget,
  projectStage = 'prospection'
}: ProjectScopeSectionProps) {
  const currentStageBadge = stageBadges[projectStage] || stageBadges.prospection;
  const isProjectCompleted = projectStage === 'termine' || projectStage === 'archive';
  const { toast } = useToast();
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemDays, setNewItemDays] = useState("");
  const [showCdcDraft, setShowCdcDraft] = useState(false);
  const [copied, setCopied] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
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

  if (!hasValidConfig && totals.mandatoryDays > 0) {
    alerts.push({
      type: 'warning',
      title: '⚠️ Configuration incomplète',
      message: 'Certains paramètres nécessaires au chiffrage (TJM ou coût interne) ne sont pas encore définis.',
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
      why: "La marge actuelle est négative. Le prix ne couvre pas les coûts de production estimés.",
      action: `Augmentez le prix d'au moins ${Math.abs(safeMargin).toFixed(0)} € pour atteindre l'équilibre sur ce projet.`,
      type: isProjectCompleted ? 'learning' : 'action',
      impact: {
        amount: Math.abs(safeMargin),
        unit: 'par projet',
        direction: 'perte',
      },
    });
    recommendations.push({
      title: "Rendre certaines rubriques optionnelles",
      why: `Le périmètre actuel (${totals.mandatoryDays} jours) génère un coût de ${safeCost.toFixed(0)} € supérieur au prix prévu.`,
      action: `Réduisez d'environ ${Math.ceil(Math.abs(safeMargin) / internalDailyCost)} jour(s) le périmètre obligatoire pour atteindre l'équilibre.`,
      type: isProjectCompleted ? 'learning' : 'action',
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
      why: `La marge actuelle (${safeMarginPercent.toFixed(1)}%) est inférieure à votre objectif (${targetMarginPercent}%).`,
      action: `Augmentez le prix d'environ ${missingMargin.toFixed(0)} € pour atteindre votre objectif de marge.`,
      type: isProjectCompleted ? 'learning' : 'action',
      impact: missingMargin > 0 ? {
        amount: missingMargin,
        unit: 'par projet',
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
      why: `Le TJM actuel (${dailyRate} €/j) ne couvre pas suffisamment votre coût interne (${internalDailyCost} €/j + 20% de marge cible).`,
      action: `Négociez un TJM supérieur ou réduisez le nombre de jours pour limiter la perte estimée sur ce projet.`,
      type: isProjectCompleted ? 'learning' : 'action',
      impact: {
        amount: totalGap,
        unit: 'total',
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
      why: `Le prix recommandé (${safePrice.toFixed(0)} €) dépasse le budget client (${budget.toFixed(0)} €) de ${priceGapWithBudget.toFixed(0)} €.`,
      action: "Discutez avec le client pour augmenter le budget ou réduire le périmètre avant signature.",
      type: isProjectCompleted ? 'learning' : 'action',
      impact: {
        amount: priceGapWithBudget,
        unit: 'par projet',
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
      {/* Texte de cadrage global */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 text-sm">
        <span className="shrink-0">💡</span>
        <p className="text-muted-foreground">
          Les estimations et recommandations fournies ici constituent une aide à la décision.<br />
          Elles doivent être adaptées à votre contexte, à votre client et validées selon votre expertise.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-lg flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              Cahier des Charges - Chiffrage
            </div>
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
                    <span>⚠️</span>
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
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Intitulé de la rubrique"
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              className="flex-1"
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
              className="w-24"
              data-testid="input-new-scope-days"
            />
            <Button 
              onClick={handleAddItem} 
              disabled={!newItemLabel.trim() || !newItemDays}
              data-testid="button-add-scope-item"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>

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
                <div className="space-y-2">
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
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Aucune rubrique définie</p>
              <p className="text-sm">Ajoutez des rubriques pour estimer le projet</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="h-4 w-4" />
              <span>Temps total estimé</span>
            </div>
            <p className="text-2xl font-bold">{totals.mandatoryDays} j</p>
            {totals.optionalDays > 0 && (
              <p className="text-xs text-muted-foreground">+ {totals.optionalDays} j optionnels</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calculator className="h-4 w-4" />
              <span>Coût estimé</span>
            </div>
            <p className="text-2xl font-bold">{hasValidConfig ? `${safeCost.toFixed(0)} €` : '-'}</p>
            <p className="text-xs text-muted-foreground">
              {hasValidConfig ? `Coût estimé sur ${totals.mandatoryDays} jours travaillés` : 'Coût interne non défini'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              <span>Prix recommandé</span>
            </div>
            <p className="text-2xl font-bold text-violet-600">{hasValidConfig ? `${safePrice.toFixed(0)} €` : '-'}</p>
            <p className="text-xs text-muted-foreground">
              {hasValidConfig ? `TJM ${dailyRate} €/j × ${totals.mandatoryDays} j estimés` : 'TJM non défini'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Target className="h-4 w-4" />
              <span>Marge prévisionnelle</span>
            </div>
            <p className={`text-2xl font-bold ${!hasValidConfig ? 'text-muted-foreground' : safeMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {hasValidConfig ? `${safeMargin.toFixed(0)} €` : '-'}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasValidConfig ? `${safeMarginPercent.toFixed(1)}% de marge prévisionnelle` : 'Configuration requise'}
            </p>
          </CardContent>
        </Card>
      </div>

      {alerts.length > 0 && (
        <Card className={
          alerts[0].type === 'error' ? 'border-red-200 bg-red-50/50 dark:bg-red-900/10' :
          alerts[0].type === 'warning' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-900/10' :
          'border-blue-200 bg-blue-50/50 dark:bg-blue-900/10'
        }>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {alerts.map((alert, index) => {
                const Icon = alert.icon;
                return (
                  <div key={index} className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 shrink-0 ${
                      alert.type === 'error' ? 'text-red-600' :
                      alert.type === 'warning' ? 'text-amber-600' :
                      'text-blue-600'
                    }`} />
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <div key={index} className="p-3 rounded-lg bg-muted/50 border border-muted">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 text-xs font-bold shrink-0">
                      {index + 1}
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{rec.title}</p>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${rec.type === 'action' ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-700' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'}`}
                        >
                          {rec.type === 'action' ? '⚡ Action immédiate' : '📚 Apprentissage'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground"><strong>Pourquoi :</strong> {rec.why}</p>
                      <p className="text-sm text-foreground"><strong>Action :</strong> {rec.action}</p>
                      {rec.impact && rec.impact.amount > 0 && (
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium mt-1 ${
                          rec.impact.direction === 'gain' 
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' 
                            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                        }`}>
                          {rec.impact.direction === 'gain' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          <span>
                            {rec.impact.direction === 'gain' ? '+' : '-'}{rec.impact.amount.toFixed(0)} € {rec.impact.unit}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
