import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings as SettingsIcon, Shield, Palette, Clock, AlertTriangle, Save, RotateCcw, DollarSign, Info, Receipt, Building2, HelpCircle } from "lucide-react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { LoadingState } from "@/design-system/patterns/LoadingState";
import { useState, useEffect } from "react";
import { useConfig, type ConfigResponse } from "@/hooks/useConfig";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Account {
  id: string;
  name: string;
}

interface StageConfig {
  key: string;
  label: string;
  order: number;
  colorClass: string;
  textColorClass: string;
  darkColorClass: string;
  isTerminal?: boolean;
}

interface ThresholdConfig {
  billing?: {
    warningDays?: number;
    criticalDays?: number;
  };
  project?: {
    overdueWarningDays?: number;
  };
}

function ConfigEditor({ 
  configKey, 
  title, 
  description,
  currentValue,
  onSave,
  isPending
}: { 
  configKey: string;
  title: string;
  description: string;
  currentValue: StageConfig[] | ThresholdConfig | undefined;
  onSave: (key: string, value: unknown) => void;
  isPending: boolean;
}) {
  const [editValue, setEditValue] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (currentValue !== undefined && !hasChanges) {
      setEditValue(JSON.stringify(currentValue, null, 2));
    }
  }, [currentValue, hasChanges]);

  const handleChange = (value: string) => {
    setEditValue(value);
    setHasChanges(true);
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(editValue);
      onSave(configKey, parsed);
      setHasChanges(false);
    } catch (e) {
      console.error("Invalid JSON");
    }
  };

  const handleReset = () => {
    setEditValue(JSON.stringify(currentValue, null, 2));
    setHasChanges(false);
  };

  const isValidJson = (() => {
    try {
      JSON.parse(editValue);
      return true;
    } catch {
      return false;
    }
  })();

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs mt-1">{description}</CardDescription>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReset}
                data-testid={`button-reset-${configKey}`}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Annuler
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || !isValidJson || isPending}
              data-testid={`button-save-${configKey}`}
            >
              {isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Save className="w-3 h-3 mr-1" />
              )}
              Enregistrer
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <textarea
          className="w-full h-48 p-3 font-mono text-xs bg-muted rounded-md border resize-y"
          value={editValue}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          data-testid={`textarea-${configKey}`}
        />
        {!isValidJson && (
          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            JSON invalide
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface TJMSetting {
  value: number;
}

function TJMEditor({
  onRefetch,
}: {
  onRefetch: () => void;
}) {
  const { toast } = useToast();
  const [tjmValue, setTjmValue] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const { data: tjmSetting, isLoading } = useQuery<{ value: number }>({
    queryKey: ["/api/settings/billing.defaultTJM"],
    retry: false,
  });

  useEffect(() => {
    if (tjmSetting?.value !== undefined && !hasChanges) {
      setTjmValue(String(tjmSetting.value));
    }
  }, [tjmSetting, hasChanges]);

  const saveMutation = useMutation({
    mutationFn: async (value: number) => {
      return apiRequest(`/api/settings/billing.defaultTJM`, "PUT", { value });
    },
    onSuccess: () => {
      toast({
        title: "TJM mis à jour",
        description: "Le taux journalier par défaut a été enregistré.",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/billing.defaultTJM"] });
      onRefetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le TJM",
        variant: "destructive",
      });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTjmValue(e.target.value);
    setHasChanges(true);
  };

  const handleSave = () => {
    const value = parseFloat(tjmValue);
    if (!isNaN(value) && value > 0) {
      saveMutation.mutate(value);
    }
  };

  const handleReset = () => {
    setTjmValue(tjmSetting?.value ? String(tjmSetting.value) : "");
    setHasChanges(false);
  };

  const isValid = !isNaN(parseFloat(tjmValue)) && parseFloat(tjmValue) > 0;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                TJM par défaut
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Ce taux journalier sera utilisé par défaut pour tous les projets.
                      Vous pouvez définir un TJM spécifique sur chaque projet pour l'overrider.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Taux journalier moyen utilisé pour le chiffrage et les calculs de rentabilité
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReset}
                data-testid="button-reset-tjm"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Annuler
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || !isValid || saveMutation.isPending}
              data-testid="button-save-tjm"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Save className="w-3 h-3 mr-1" />
              )}
              Enregistrer
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="space-y-2 flex-1 max-w-xs">
            <Label htmlFor="tjmDefault" className="text-sm">Montant (€/jour)</Label>
            <Input
              id="tjmDefault"
              type="number"
              min="0"
              step="10"
              value={tjmValue}
              onChange={handleChange}
              placeholder={isLoading ? "Chargement..." : "Ex: 500"}
              className="max-w-[200px]"
              data-testid="input-tjm-default"
            />
          </div>
          {tjmSetting?.value && (
            <Badge variant="secondary" className="mt-6">
              Actuel: {tjmSetting.value}€/jour
            </Badge>
          )}
        </div>
        {!isValid && tjmValue && (
          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Le TJM doit être un nombre positif
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SIRETEditor({
  onRefetch,
}: {
  onRefetch: () => void;
}) {
  const { toast } = useToast();
  const [siretValue, setSiretValue] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const { data: siretSetting, isLoading } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/billing.siret"],
    retry: false,
  });

  useEffect(() => {
    if (siretSetting?.value !== undefined && !hasChanges) {
      setSiretValue(siretSetting.value);
    }
  }, [siretSetting, hasChanges]);

  const saveMutation = useMutation({
    mutationFn: async (value: string) => {
      return apiRequest(`/api/settings/billing.siret`, "PUT", { value });
    },
    onSuccess: () => {
      toast({
        title: "SIRET mis à jour",
        description: "Votre numéro SIRET a été enregistré.",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/billing.siret"] });
      onRefetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le SIRET",
        variant: "destructive",
      });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Filter to only allow digits
    const value = e.target.value.replace(/\D/g, '').slice(0, 14);
    setSiretValue(value);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (siretValue.length === 14 || siretValue.length === 0) {
      saveMutation.mutate(siretValue);
    }
  };

  const handleReset = () => {
    setSiretValue(siretSetting?.value || "");
    setHasChanges(false);
  };

  const isValid = siretValue.length === 14 || siretValue.length === 0;

  // Format SIRET for display (XXX XXX XXX XXXXX)
  const formatSiret = (siret: string) => {
    if (!siret) return "";
    return siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4");
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                SIRET
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Votre numéro SIRET (14 chiffres) est utilisé pour vos documents de facturation.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Numéro d'identification de votre entreprise (14 chiffres)
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReset}
                data-testid="button-reset-siret"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Annuler
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || !isValid || saveMutation.isPending}
              data-testid="button-save-siret"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Save className="w-3 h-3 mr-1" />
              )}
              Enregistrer
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="space-y-2 flex-1 max-w-xs">
            <Label htmlFor="siretNumber" className="text-sm">Numéro SIRET</Label>
            <Input
              id="siretNumber"
              type="text"
              value={siretValue}
              onChange={handleChange}
              placeholder={isLoading ? "Chargement..." : "Ex: 12345678901234"}
              className="max-w-[200px] font-mono"
              data-testid="input-siret"
            />
          </div>
          {siretSetting?.value && (
            <Badge variant="secondary" className="mt-6 font-mono" data-testid="badge-siret-current">
              {formatSiret(siretSetting.value)}
            </Badge>
          )}
        </div>
        {!isValid && siretValue && (
          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Le SIRET doit contenir exactement 14 chiffres
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ThresholdEditor({
  thresholds,
  onSave,
  isPending
}: {
  thresholds: ThresholdConfig | undefined;
  onSave: (key: string, value: unknown) => void;
  isPending: boolean;
}) {
  const [billingWarning, setBillingWarning] = useState("30");
  const [billingCritical, setBillingCritical] = useState("60");
  const [projectOverdue, setProjectOverdue] = useState("7");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (thresholds && !hasChanges) {
      setBillingWarning(thresholds.billing?.warningDays?.toString() || "30");
      setBillingCritical(thresholds.billing?.criticalDays?.toString() || "60");
      setProjectOverdue(thresholds.project?.overdueWarningDays?.toString() || "7");
    }
  }, [thresholds, hasChanges]);

  const handleSave = () => {
    onSave("thresholds", {
      billing: {
        warningDays: parseInt(billingWarning),
        criticalDays: parseInt(billingCritical)
      },
      project: {
        overdueWarningDays: parseInt(projectOverdue)
      }
    });
    setHasChanges(false);
  };

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setHasChanges(true);
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Seuils et délais
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Configurez les seuils d'alerte pour la facturation et les projets
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isPending}
            data-testid="button-save-thresholds"
          >
            {isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Save className="w-3 h-3 mr-1" />
            )}
            Enregistrer
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="billingWarning" className="text-sm">Alerte facturation (jours)</Label>
            <Input
              id="billingWarning"
              type="number"
              value={billingWarning}
              onChange={handleChange(setBillingWarning)}
              data-testid="input-billing-warning"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingCritical" className="text-sm">Facturation critique (jours)</Label>
            <Input
              id="billingCritical"
              type="number"
              value={billingCritical}
              onChange={handleChange(setBillingCritical)}
              data-testid="input-billing-critical"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="projectOverdue" className="text-sm">Projet en retard (jours)</Label>
          <Input
            id="projectOverdue"
            type="number"
            value={projectOverdue}
            onChange={handleChange(setProjectOverdue)}
            className="max-w-[200px]"
            data-testid="input-project-overdue"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { startOnboarding } = useOnboarding();
  
  const { data: currentUser } = useQuery<{ accountId: string; role?: string }>({
    queryKey: ["/api/me"],
  });

  const { data: account, isLoading: accountLoading } = useQuery<Account>({
    queryKey: ["/api/accounts", currentUser?.accountId],
    enabled: !!currentUser?.accountId,
  });

  const { config, isLoading: configLoading, refetch: refetchConfig } = useConfig();

  const isOwner = currentUser?.role === "owner" || user?.role === "owner";

  const updateConfigMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      return apiRequest(`/api/config/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value, scope: "ACCOUNT" }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Configuration mise à jour",
        description: "Les modifications ont été enregistrées.",
      });
      refetchConfig();
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour la configuration",
        variant: "destructive",
      });
    },
  });

  const handleSave = (key: string, value: unknown) => {
    updateConfigMutation.mutate({ key, value });
  };

  if (accountLoading || configLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-settings-title">Paramètres</h1>
          <p className="text-muted-foreground mt-2">Configurez votre compte et vos préférences</p>
        </div>

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="account" data-testid="tab-account">
              <SettingsIcon className="w-4 h-4 mr-2" />
              Compte
            </TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing">
              <Receipt className="w-4 h-4 mr-2" />
              Facturation
            </TabsTrigger>
            <TabsTrigger value="config" data-testid="tab-config">
              <Palette className="w-4 h-4 mr-2" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">
              <Shield className="w-4 h-4 mr-2" />
              Intégrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-violet-100 dark:bg-violet-900/30">
                    <SettingsIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <CardTitle>Informations du compte</CardTitle>
                    <CardDescription>
                      Gérez les paramètres de votre compte
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Nom du compte</p>
                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-account-name">
                      {account?.name || "Chargement..."}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">ID du compte</p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono" data-testid="text-account-id">
                      {account?.id || "Chargement..."}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Rôle</p>
                    <Badge variant={isOwner ? "default" : "secondary"} className="mt-1" data-testid="badge-role">
                      {isOwner ? "Propriétaire" : "Collaborateur"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-cyan-100 dark:bg-cyan-900/30">
                    <HelpCircle className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <CardTitle>Visite guidée</CardTitle>
                    <CardDescription>
                      Redécouvrez les fonctionnalités de Planbase
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Relancez la visite guidée pour redécouvrir les modules et fonctionnalités de l'application.
                  </p>
                  <Button
                    variant="outline"
                    onClick={startOnboarding}
                    data-testid="button-restart-onboarding"
                  >
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Relancer la visite guidée
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            {!isOwner ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Seuls les propriétaires du compte peuvent modifier les paramètres de facturation.</p>
                    <p className="text-xs mt-2">Contactez votre administrateur pour effectuer des modifications.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Paramètres de facturation</h2>
                    <p className="text-sm text-muted-foreground">
                      Configurez vos informations de facturation et votre tarification
                    </p>
                  </div>
                </div>

                <TJMEditor onRefetch={refetchConfig} />

                <SIRETEditor onRefetch={refetchConfig} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="config">
            {!isOwner ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Seuls les propriétaires du compte peuvent modifier la configuration.</p>
                    <p className="text-xs mt-2">Contactez votre administrateur pour effectuer des modifications.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Configuration du compte</h2>
                    <p className="text-sm text-muted-foreground">
                      Personnalisez les étapes, statuts et seuils pour votre compte
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Portée: ACCOUNT
                  </Badge>
                </div>

                <ThresholdEditor
                  thresholds={config?.thresholds as ThresholdConfig}
                  onSave={handleSave}
                  isPending={updateConfigMutation.isPending}
                />

                <ConfigEditor
                  configKey="project.stages"
                  title="Étapes de projet"
                  description="Définissez les étapes du pipeline de projets"
                  currentValue={config?.["project.stages"] as StageConfig[]}
                  onSave={handleSave}
                  isPending={updateConfigMutation.isPending}
                />

                <ConfigEditor
                  configKey="task.statuses"
                  title="Statuts de tâches"
                  description="Configurez les statuts du workflow de tâches"
                  currentValue={config?.["task.statuses"] as StageConfig[]}
                  onSave={handleSave}
                  isPending={updateConfigMutation.isPending}
                />

                <ConfigEditor
                  configKey="task.priorities"
                  title="Priorités des tâches"
                  description="Personnalisez les niveaux de priorité"
                  currentValue={config?.["task.priorities"] as StageConfig[]}
                  onSave={handleSave}
                  isPending={updateConfigMutation.isPending}
                />

                <ConfigEditor
                  configKey="billing.statuses"
                  title="Statuts de facturation"
                  description="Configurez les états de facturation"
                  currentValue={config?.["billing.statuses"] as StageConfig[]}
                  onSave={handleSave}
                  isPending={updateConfigMutation.isPending}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="integrations">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Intégrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-muted-foreground">Google Calendar - Connectez votre calendrier depuis la page Calendrier</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Les credentials Google OAuth sont configurés au niveau de l'application.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
