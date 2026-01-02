import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  FileText,
  Clock,
  Layers,
  Wand2,
  Loader2,
  CheckCheck,
  Euro,
  Target,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import type { ProjectScopeItem, CdcSession, ProjectBaseline } from "@shared/schema";

interface CdcWizardProps {
  projectId: string;
  projectName: string;
  dailyRate: number;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (sessionId: string, backlogId?: string, roadmapId?: string) => void;
}

type ScopeType = 'functional' | 'technical' | 'design' | 'gestion' | 'strategy' | 'autre';
type Phase = 'T1' | 'T2' | 'T3' | 'T4' | 'LT';

interface ScopeItemForm {
  label: string;
  description: string;
  scopeType: ScopeType;
  isBillable: boolean;
  phase: Phase | null;
  estimatedDays: string;
  isOptional: boolean;
}

const SCOPE_TYPES: { value: ScopeType; label: string; color: string }[] = [
  { value: 'functional', label: 'Fonctionnel', color: 'bg-violet-500' },
  { value: 'technical', label: 'Technique', color: 'bg-cyan-500' },
  { value: 'design', label: 'Design', color: 'bg-amber-500' },
  { value: 'gestion', label: 'Gestion', color: 'bg-emerald-500' },
  { value: 'strategy', label: 'Stratégie', color: 'bg-blue-500' },
  { value: 'autre', label: 'Autre', color: 'bg-gray-500' },
];

const PHASES: { value: Phase; label: string }[] = [
  { value: 'T1', label: 'T1 - Premier trimestre' },
  { value: 'T2', label: 'T2 - Deuxième trimestre' },
  { value: 'T3', label: 'T3 - Troisième trimestre' },
  { value: 'T4', label: 'T4 - Quatrième trimestre' },
  { value: 'LT', label: 'LT - Long terme' },
];

const STEPS = [
  { id: 1, title: 'Périmètre', icon: FileText },
  { id: 2, title: 'Estimation', icon: Clock },
  { id: 3, title: 'Phase', icon: Layers },
  { id: 4, title: 'Génération', icon: Wand2 },
  { id: 5, title: 'Confirmation', icon: CheckCircle2 },
];

const emptyForm: ScopeItemForm = {
  label: '',
  description: '',
  scopeType: 'functional',
  isBillable: true,
  phase: null,
  estimatedDays: '',
  isOptional: false,
};

export function CdcWizard({
  projectId,
  projectName,
  dailyRate,
  isOpen,
  onClose,
  onComplete,
}: CdcWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [newItemForm, setNewItemForm] = useState<ScopeItemForm>({ ...emptyForm });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [generateBacklog, setGenerateBacklog] = useState(true);
  const [generateRoadmap, setGenerateRoadmap] = useState(true);
  const [generationResult, setGenerationResult] = useState<{
    backlogId?: string;
    roadmapId?: string;
    baseline?: ProjectBaseline;
  } | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const { data: session, refetch: refetchSession } = useQuery<CdcSession & { scopeItems: ProjectScopeItem[] }>({
    queryKey: ['/api/cdc-sessions', sessionId],
    enabled: !!sessionId,
  });

  const scopeItems = session?.scopeItems || [];

  useEffect(() => {
    if (isOpen && !sessionId && !isCreatingSession) {
      createSession();
    }
  }, [isOpen]);

  const createSession = async (): Promise<string | null> => {
    if (isCreatingSession) return null;
    setIsCreatingSession(true);
    try {
      const newSession = await apiRequest(`/api/projects/${projectId}/cdc-sessions`, 'POST', {});
      setSessionId(newSession.id);
      sessionIdRef.current = newSession.id;
      return newSession.id;
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de créer la session CDC",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreatingSession(false);
    }
  };

  const addScopeItemMutation = useMutation({
    mutationFn: async (item: ScopeItemForm) => {
      let currentSessionId = sessionId || sessionIdRef.current;
      
      if (!currentSessionId) {
        currentSessionId = await createSession();
        if (!currentSessionId) {
          throw new Error("Impossible de créer la session CDC");
        }
      }
      
      return apiRequest(`/api/cdc-sessions/${currentSessionId}/scope-items`, 'POST', {
        label: item.label,
        description: item.description || null,
        scopeType: item.scopeType,
        isBillable: item.isBillable ? 1 : 0,
        phase: item.phase,
        estimatedDays: item.estimatedDays ? parseFloat(item.estimatedDays) : null,
        isOptional: item.isOptional ? 1 : 0,
      });
    },
    onSuccess: () => {
      refetchSession();
      setNewItemForm({ ...emptyForm });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateScopeItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProjectScopeItem> }) => {
      return apiRequest(`/api/scope-items/${id}`, 'PATCH', data);
    },
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/cdc-sessions', sessionId] });
      
      // Snapshot previous value
      const previousSession = queryClient.getQueryData(['/api/cdc-sessions', sessionId]);
      
      // Optimistic update
      queryClient.setQueryData(['/api/cdc-sessions', sessionId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          scopeItems: old.scopeItems?.map((item: ProjectScopeItem) =>
            item.id === id ? { ...item, ...data } : item
          ),
        };
      });
      
      return { previousSession };
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousSession) {
        queryClient.setQueryData(['/api/cdc-sessions', sessionId], context.previousSession);
      }
      console.error('Update scope item error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'élément",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refetch to sync
      queryClient.invalidateQueries({ queryKey: ['/api/cdc-sessions', sessionId] });
    },
  });

  const deleteScopeItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/scope-items/${id}`, 'DELETE');
    },
    onSuccess: () => {
      refetchSession();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      return apiRequest(`/api/cdc-sessions/${sessionId}/complete`, 'POST', {
        generateBacklog,
        generateRoadmap,
      });
    },
    onSuccess: (result: any) => {
      setIsGenerating(false);
      setGenerationResult({
        backlogId: result.generatedBacklogId,
        roadmapId: result.generatedRoadmapId,
        baseline: result.baseline,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'scope-items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/backlogs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/roadmaps'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'baselines'] });
      setCurrentStep(5);
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast({
        title: "Erreur de génération",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddItem = () => {
    if (!newItemForm.label.trim()) return;
    addScopeItemMutation.mutate(newItemForm);
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    completeMutation.mutate();
  };

  const handleClose = () => {
    setCurrentStep(1);
    setSessionId(null);
    setNewItemForm({ ...emptyForm });
    setGenerationResult(null);
    onClose();
  };

  const handleFinish = () => {
    if (generationResult) {
      onComplete(sessionId!, generationResult.backlogId, generationResult.roadmapId);
    }
    handleClose();
  };

  const totalDays = scopeItems.reduce((sum, item) => {
    if (item.isOptional) return sum;
    return sum + (parseFloat(item.estimatedDays?.toString() || '0') || 0);
  }, 0);

  const totalPrice = totalDays * dailyRate;

  const canProceed = currentStep === 1 
    ? scopeItems.length > 0
    : currentStep === 2 
    ? scopeItems.every(item => parseFloat(item.estimatedDays?.toString() || '0') > 0)
    : true;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-600" />
            Session CDC - {projectName}
          </DialogTitle>
          <DialogDescription>
            Structurez le périmètre de votre projet en 4 étapes
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between px-4 py-3 border-b">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            return (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    isCompleted
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-violet-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={`text-sm font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.title}
                </span>
                {index < STEPS.length - 1 && (
                  <div className="w-8 h-px bg-border mx-2" />
                )}
              </div>
            );
          })}
        </div>

        <ScrollArea className="flex-1 px-4">
          {currentStep === 1 && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Listez les rubriques du périmètre du projet. Vous pourrez les estimer à l'étape suivante.
              </p>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Intitulé de la rubrique"
                  value={newItemForm.label}
                  onChange={(e) => setNewItemForm({ ...newItemForm, label: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  data-testid="input-scope-label"
                />
                <Select
                  value={newItemForm.scopeType}
                  onValueChange={(value: ScopeType) => setNewItemForm({ ...newItemForm, scopeType: value })}
                >
                  <SelectTrigger className="w-40" data-testid="select-scope-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${type.color}`} />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddItem} disabled={!newItemForm.label.trim()} data-testid="button-add-scope-item">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {scopeItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Aucune rubrique ajoutée</p>
                  <p className="text-sm">Commencez par ajouter les éléments du périmètre</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scopeItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 border rounded-md bg-background"
                      data-testid={`scope-item-${item.id}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${SCOPE_TYPES.find(t => t.value === item.scopeType)?.color || 'bg-gray-500'}`} />
                      <span className="flex-1">{item.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {SCOPE_TYPES.find(t => t.value === item.scopeType)?.label}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteScopeItemMutation.mutate(item.id)}
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Estimez le temps nécessaire pour chaque rubrique et indiquez si elle est facturable.
              </p>

              <div className="space-y-2">
                {scopeItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 border rounded-md bg-background"
                    data-testid={`estimate-item-${item.id}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${SCOPE_TYPES.find(t => t.value === item.scopeType)?.color || 'bg-gray-500'}`} />
                    <span className="flex-1 min-w-0 truncate">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        className="w-20"
                        placeholder="jours"
                        defaultValue={item.estimatedDays?.toString() || ''}
                        onBlur={(e) => {
                          const value = e.target.value;
                          updateScopeItemMutation.mutate({
                            id: item.id,
                            data: { estimatedDays: value ? parseFloat(value) : null },
                          });
                        }}
                        data-testid={`input-days-${item.id}`}
                      />
                      <span className="text-sm text-muted-foreground">j</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Facturable</Label>
                      <Switch
                        checked={Boolean(item.isBillable)}
                        onCheckedChange={(checked) => {
                          updateScopeItemMutation.mutate({
                            id: item.id,
                            data: { isBillable: checked ? 1 : 0 },
                          });
                        }}
                        data-testid={`switch-billable-${item.id}`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Optionnel</Label>
                      <Switch
                        checked={Boolean(item.isOptional)}
                        onCheckedChange={(checked) => {
                          updateScopeItemMutation.mutate({
                            id: item.id,
                            data: { isOptional: checked ? 1 : 0 },
                          });
                        }}
                        data-testid={`switch-optional-${item.id}`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Card className="bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-violet-600" />
                      <span className="font-medium">Total estimé</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-semibold">{totalDays.toFixed(1)} jours</span>
                      <span className="text-lg font-semibold text-violet-600">{totalPrice.toFixed(0)} €</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Attribuez une phase temporelle à chaque rubrique pour la planification de la roadmap.
              </p>

              <div className="space-y-2">
                {scopeItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 border rounded-md bg-background"
                    data-testid={`phase-item-${item.id}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${SCOPE_TYPES.find(t => t.value === item.scopeType)?.color || 'bg-gray-500'}`} />
                    <span className="flex-1 min-w-0 truncate">{item.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.estimatedDays || 0}j
                    </Badge>
                    <Select
                      value={item.phase || ''}
                      onValueChange={(value: Phase | '') => {
                        updateScopeItemMutation.mutate({
                          id: item.id,
                          data: { phase: value || null },
                        });
                      }}
                    >
                      <SelectTrigger className="w-48" data-testid={`select-phase-${item.id}`}>
                        <SelectValue placeholder="Sélectionner une phase" />
                      </SelectTrigger>
                      <SelectContent>
                        {PHASES.map((phase) => (
                          <SelectItem key={phase.value} value={phase.value}>
                            {phase.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6 py-4">
              <p className="text-sm text-muted-foreground">
                Choisissez ce que vous souhaitez générer à partir du périmètre défini.
              </p>

              <div className="grid gap-4">
                <Card className={`cursor-pointer transition-all ${generateBacklog ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20' : ''}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={generateBacklog}
                        onCheckedChange={setGenerateBacklog}
                        data-testid="switch-generate-backlog"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium">Générer un Backlog</h4>
                        <p className="text-sm text-muted-foreground">
                          Crée automatiquement des Epics et User Stories à partir du périmètre
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-all ${generateRoadmap ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20' : ''}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={generateRoadmap}
                        onCheckedChange={setGenerateRoadmap}
                        data-testid="switch-generate-roadmap"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium">Générer une Roadmap</h4>
                        <p className="text-sm text-muted-foreground">
                          Crée automatiquement des items sur la roadmap selon les phases définies
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCheck className="h-4 w-4" />
                    Récapitulatif
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Nombre de rubriques</span>
                    <span className="font-medium">{scopeItems.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Temps total estimé</span>
                    <span className="font-medium">{totalDays.toFixed(1)} jours</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Prix estimé (TJM: {dailyRate}€)</span>
                    <span className="font-medium text-violet-600">{totalPrice.toFixed(0)} €</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 5 && generationResult && (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold">Session CDC terminée !</h3>
                <p className="text-sm text-muted-foreground">
                  Le périmètre projet a été validé et la baseline de pilotage est créée.
                </p>
              </div>

              <div className="grid gap-4">
                {generationResult.baseline && (
                  <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4 text-violet-600" />
                        Baseline de pilotage créée
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        La baseline capture vos estimations initiales comme référence pour le suivi du projet.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 p-2 rounded-md bg-background border">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-xs text-muted-foreground">Total estimé</span>
                            <p className="font-semibold">
                              {parseFloat(generationResult.baseline.totalEstimatedDays?.toString() || '0').toFixed(1)} jours
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-md bg-background border">
                          <Euro className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-xs text-muted-foreground">Facturable</span>
                            <p className="font-semibold">
                              {parseFloat(generationResult.baseline.billableEstimatedDays?.toString() || '0').toFixed(1)} jours
                            </p>
                          </div>
                        </div>
                      </div>
                      {generationResult.baseline.byType && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Répartition par type</span>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(generationResult.baseline.byType as Record<string, number>).map(([type, days]) => {
                              const typeConfig = SCOPE_TYPES.find(t => t.value === type);
                              return (
                                <Badge key={type} variant="outline" className="text-xs">
                                  <span className={`w-2 h-2 rounded-full mr-1 ${typeConfig?.color || 'bg-gray-500'}`} />
                                  {typeConfig?.label || type}: {days.toFixed(1)}j
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {generationResult.backlogId && (
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-cyan-100 dark:bg-cyan-950 flex items-center justify-center">
                          <Layers className="h-5 w-5 text-cyan-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">Backlog généré</h4>
                          <p className="text-sm text-muted-foreground">
                            Epics et User Stories créés à partir du périmètre
                          </p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 ml-auto" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {generationResult.roadmapId && (
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">Roadmap générée</h4>
                          <p className="text-sm text-muted-foreground">
                            Items planifiés selon les phases définies
                          </p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 ml-auto" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-muted/50">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <BarChart3 className="h-5 w-5 text-violet-600 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="font-medium">Pilotage activé</h4>
                        <p className="text-sm text-muted-foreground">
                          Vous pouvez maintenant suivre l'avancement réel vs. estimé dans l'onglet Temps du projet, 
                          et rattacher vos entrées de temps aux lignes du périmètre CDC.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t">
          {currentStep < 5 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
              data-testid="button-wizard-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Précédent
            </Button>
          )}

          {currentStep === 5 && <div />}

          <div className="flex items-center gap-2">
            <Progress value={(currentStep / 5) * 100} className="w-24 h-2" />
            <span className="text-sm text-muted-foreground">{currentStep}/5</span>
          </div>

          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              data-testid="button-wizard-next"
            >
              Suivant
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : currentStep === 4 ? (
            <Button
              onClick={handleComplete}
              disabled={isGenerating || (!generateBacklog && !generateRoadmap)}
              data-testid="button-wizard-complete"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-1" />
                  Générer
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              data-testid="button-wizard-finish"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Terminer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
