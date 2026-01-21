import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  Loader2, User, Mail, Briefcase, UserCircle, Phone, Building2, Lock, Eye, EyeOff, 
  Settings as SettingsIcon, Puzzle, Shield, Clock, AlertTriangle, Save, RotateCcw, 
  DollarSign, Info, HelpCircle, Hash, Target, Palette, FolderKanban, Code, Terminal, Check, Users, Trash2
} from "lucide-react";
import { PermissionsTab } from "@/components/settings/PermissionsTab";
import { AuditTab } from "@/components/settings/AuditTab";
import { USER_PROFILES, type UserProfileType } from "@shared/userProfiles";
import { LoadingState } from "@/design-system/patterns/LoadingState";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useConfig, type ConfigResponse } from "@/hooks/useConfig";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { appUsers } from "@shared/schema";
import { usePermissions } from "@/hooks/usePermissions";

const profileSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  gender: z.enum(["male", "female", "other"]).optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
});

const passwordSchema = z.object({
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const accountSchema = z.object({
  name: z.string().min(1, "Le nom du compte est requis"),
  siret: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type AccountFormData = z.infer<typeof accountSchema>;
type AppUser = typeof appUsers.$inferSelect;

interface Account {
  id: string;
  name: string;
  siret?: string | null;
  ownerId?: string | null;
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
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xs">{title}</CardTitle>
            <CardDescription className="text-[10px] mt-1">{description}</CardDescription>
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-xs flex items-center gap-2">
                TJM par défaut
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Ce taux journalier sera utilisé par défaut pour tous les projets.
                      Vous pouvez définir un TJM spécifique sur chaque projet pour l'overrider.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription className="text-[10px] mt-1">
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
            <Label htmlFor="tjmDefault" className="text-xs">Montant (€/jour)</Label>
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

  const formatSiret = (siret: string) => {
    if (!siret) return "";
    return siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4");
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-xs flex items-center gap-2">
                SIRET
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Votre numéro SIRET (14 chiffres) est utilisé pour vos documents de facturation.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription className="text-[10px] mt-1">
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
            <Label htmlFor="siretNumber" className="text-xs">Numéro SIRET</Label>
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
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xs flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Seuils et délais
            </CardTitle>
            <CardDescription className="text-[10px] mt-1">
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
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="billingWarning" className="text-xs flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
              Alerte facturation (jours)
            </Label>
            <Input
              id="billingWarning"
              type="number"
              min="1"
              value={billingWarning}
              onChange={handleChange(setBillingWarning)}
              className="max-w-[120px]"
              data-testid="input-billing-warning"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingCritical" className="text-xs flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              Critique facturation (jours)
            </Label>
            <Input
              id="billingCritical"
              type="number"
              min="1"
              value={billingCritical}
              onChange={handleChange(setBillingCritical)}
              className="max-w-[120px]"
              data-testid="input-billing-critical"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectOverdue" className="text-xs flex items-center gap-2">
              <Clock className="w-3 h-3 text-orange-500" />
              Retard projet (jours)
            </Label>
            <Input
              id="projectOverdue"
              type="number"
              min="1"
              value={projectOverdue}
              onChange={handleChange(setProjectOverdue)}
              className="max-w-[120px]"
              data-testid="input-project-overdue"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const PROFILE_ICONS: Record<string, typeof Briefcase> = {
  Briefcase,
  Palette,
  Target,
  FolderKanban,
  Code,
  Terminal,
};

function ProfileTypeCard({ currentProfileType, embedded = false }: { currentProfileType?: UserProfileType; embedded?: boolean }) {
  const { toast } = useToast();
  const [selectedProfile, setSelectedProfile] = useState<UserProfileType | undefined>(currentProfileType);

  useEffect(() => {
    setSelectedProfile(currentProfileType);
  }, [currentProfileType]);

  const saveProfileMutation = useMutation({
    mutationFn: async (profileType: UserProfileType) => {
      await apiRequest("/api/me/profile-type", "PATCH", { profileType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({
        title: "Profil mis à jour",
        description: "Votre profil a été sauvegardé.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le profil.",
        variant: "destructive",
      });
    },
  });

  const handleProfileChange = (profileId: UserProfileType) => {
    if (profileId === selectedProfile) return;
    setSelectedProfile(profileId);
    saveProfileMutation.mutate(profileId);
  };

  const handleResetDashboard = () => {
    if (!selectedProfile) return;
    
    localStorage.removeItem('planbase_profile_applied');
    localStorage.removeItem('planbase_dashboard_config_v2');
    
    toast({
      title: "Dashboard réinitialisé",
      description: "Le dashboard sera adapté à votre profil au prochain chargement.",
      variant: "success",
    });
    
    window.location.href = '/';
  };

  const content = (
    <>
      <p className="text-xs text-muted-foreground mb-3">
        Choisissez le profil qui correspond à votre façon de travailler.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {USER_PROFILES.map((profile) => {
          const IconComponent = PROFILE_ICONS[profile.icon] || Briefcase;
          const isSelected = selectedProfile === profile.id;
          
          return (
            <div
              key={profile.id}
              className={`cursor-pointer transition-all border rounded-lg p-3 hover-elevate ${
                isSelected 
                  ? "ring-2 ring-primary bg-primary/5 border-primary" 
                  : "hover:bg-accent/50"
              }`}
              onClick={() => handleProfileChange(profile.id)}
              data-testid={`settings-profile-option-${profile.id}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${isSelected ? "bg-primary/10" : "bg-muted"}`}>
                  <IconComponent className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-xs">{profile.label}</h3>
                    {isSelected && <Check className="w-3 h-3 text-primary" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{profile.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="text-xs text-muted-foreground">
          Réinitialiser le dashboard avec la configuration de votre profil
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetDashboard}
          disabled={!selectedProfile || saveProfileMutation.isPending}
          data-testid="button-reset-dashboard"
          className="text-xs"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Réinitialiser
        </Button>
      </div>
      
      {saveProfileMutation.isPending && (
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Mise à jour...
        </div>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold tracking-tight flex items-center gap-2 text-sm">
          <Target className="w-4 h-4" />
          Mon profil métier
        </CardTitle>
        <CardDescription className="text-xs">
          Choisissez le profil qui correspond à votre façon de travailler.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [, setLocation] = useLocation();
  
  const { startOnboarding } = useOnboarding();
  const { config, isLoading: configLoading, refetch: refetchConfig } = useConfig();
  const { role: membershipRole, isAdmin } = usePermissions();
  
  const { data: userProfile, isLoading } = useQuery<AppUser>({
    queryKey: ["/api/me"],
    enabled: !!user,
  });

  const { data: account, isLoading: accountLoading } = useQuery<Account>({
    queryKey: ["/api/accounts", userProfile?.accountId],
    enabled: !!userProfile?.accountId, // Fetch for all users to show organization name
  });

  const isOwner = userProfile?.role === "owner";
  const isInvitedUser = userProfile?.role === "user"; // Invited users have role "user"

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: userProfile?.firstName || "",
      lastName: userProfile?.lastName || "",
      gender: (userProfile?.gender as "male" | "female" | "other") || undefined,
      position: userProfile?.position || "",
      phone: userProfile?.phone || "",
      company: userProfile?.company || "",
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account?.name || "",
      siret: account?.siret || "",
    },
  });

  useEffect(() => {
    if (userProfile) {
      form.reset({
        firstName: userProfile.firstName || "",
        lastName: userProfile.lastName || "",
        gender: userProfile.gender as "male" | "female" | "other" | undefined,
        position: userProfile.position || "",
        phone: userProfile.phone || "",
        company: userProfile.company || "",
      });
    }
  }, [userProfile, form]);

  useEffect(() => {
    if (account) {
      accountForm.reset({
        name: account.name || "",
        siret: account.siret || "",
      });
    }
  }, [account, accountForm]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest("/api/me", "PATCH", data);
      return response.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/me"], updatedUser);
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été enregistrées avec succès",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le profil",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      const response = await apiRequest("/api/me/password", "PATCH", {
        newPassword: data.newPassword
      });
      return response.json();
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({
        title: "Mot de passe mis à jour",
        description: "Votre mot de passe a été changé avec succès",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le mot de passe",
      });
    },
  });

  const { signOut } = useAuth();
  
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/me/delete", "DELETE");
      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Compte supprimé",
        description: "Votre compte a été supprimé avec succès",
        variant: "success",
      });
      await signOut();
      setLocation("/login");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de supprimer le compte",
      });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      if (!userProfile?.accountId) {
        throw new Error("Account ID not found");
      }
      const response = await apiRequest(`/api/accounts/${userProfile.accountId}`, "PATCH", data);
      return response.json();
    },
    onSuccess: (updatedAccount) => {
      queryClient.setQueryData(["/api/accounts", userProfile?.accountId], updatedAccount);
      toast({
        title: "Compte mis à jour",
        description: "Les informations du compte ont été enregistrées avec succès",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le compte",
      });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      return apiRequest(`/api/config/${key}`, "PUT", { value });
    },
    onSuccess: () => {
      toast({ title: "Configuration mise à jour" });
      refetchConfig();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = (key: string, value: unknown) => {
    updateConfigMutation.mutate({ key, value });
  };

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    updatePasswordMutation.mutate(data);
  };

  const onAccountSubmit = (data: AccountFormData) => {
    updateAccountMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="p-6">
        <Tabs defaultValue="informations" className="space-y-6">
          <TabsList className="w-full justify-start mb-3 overflow-x-auto overflow-y-hidden flex-nowrap h-10 p-0.5" data-testid="tabs-settings">
            <TabsTrigger value="informations" className="gap-1.5 text-xs h-9 px-3" data-testid="tab-informations">
              <UserCircle className="w-3.5 h-3.5" />
              Informations
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5 text-xs h-9 px-3" data-testid="tab-config">
              <SettingsIcon className="w-3.5 h-3.5" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-1.5 text-xs h-9 px-3" data-testid="tab-permissions">
              <Users className="w-3.5 h-3.5" />
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 text-xs h-9 px-3" data-testid="tab-audit">
              <Clock className="w-3.5 h-3.5" />
              Audit
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5 text-xs h-9 px-3" data-testid="tab-integrations">
              <Puzzle className="w-3.5 h-3.5" />
              Intégrations
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs h-9 px-3" data-testid="tab-security">
              <Shield className="w-3.5 h-3.5" />
              Sécurité
            </TabsTrigger>
          </TabsList>

          <TabsContent value="informations" className="space-y-4">
            <Accordion type="multiple" defaultValue={["account", "personal", "profile", "tour"]} className="space-y-3">
              <AccordionItem value="account" className="border rounded-lg px-4 bg-white dark:bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      <span className="text-sm font-semibold">Informations du compte</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {userProfile?.account?.plan && (
                        <Badge 
                          className="bg-green-600 hover:bg-green-700 text-white font-semibold" 
                          data-testid="badge-plan"
                        >
                          {userProfile.account.plan === 'starter' ? 'Start' : userProfile.account.plan}
                        </Badge>
                      )}
                      <Badge 
                        variant={isAdmin ? "default" : membershipRole === 'member' ? "secondary" : "outline"}
                        className="mr-2"
                        data-testid="badge-role-header"
                      >
                        {isAdmin ? "Administrateur" : 
                         membershipRole === 'member' ? "Membre" : 
                         membershipRole === 'guest' ? "Invité" : 
                         isOwner ? "Propriétaire" : "Membre"}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground mb-4">Informations de votre organisation</p>
                  {accountLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-white dark:bg-card rounded-lg border">
                        <div>
                          <Label className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                            <Hash className="w-3 h-3" />
                            ID du compte
                          </Label>
                          <p className="font-mono text-sm" data-testid="text-account-id">
                            {account?.id || "—"}
                          </p>
                        </div>
                        <div>
                          <Label className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                            <Building2 className="w-3 h-3" />
                            Organisation
                          </Label>
                          <p className="text-sm font-medium" data-testid="text-organization-name">
                            {account?.name || "—"}
                          </p>
                        </div>
                      </div>

                      <Form {...accountForm}>
                        <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={accountForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex items-center gap-2 text-xs">
                                    <Building2 className="w-3.5 h-3.5" />
                                    Nom du compte *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Mon entreprise"
                                      data-testid="input-account-name"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={accountForm.control}
                              name="siret"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex items-center gap-2 text-xs">
                                    <Building2 className="w-3.5 h-3.5" />
                                    SIRET
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="123 456 789 00012"
                                      data-testid="input-account-siret"
                                      {...field}
                                    />
                                  </FormControl>
                                  <p className="text-xs text-muted-foreground">
                                    Numéro SIRET de votre entreprise (14 chiffres)
                                  </p>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="flex justify-end gap-3 pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => accountForm.reset()}
                              data-testid="button-cancel-account-info"
                              className="text-[12px]"
                            >
                              Annuler
                            </Button>
                            <Button
                              type="submit"
                              disabled={updateAccountMutation.isPending}
                              data-testid="button-save-account-info"
                              className="text-[12px]"
                            >
                              {updateAccountMutation.isPending && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              )}
                              Enregistrer
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="personal" className="border rounded-lg px-4 bg-white dark:bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-4 h-4" />
                    <span className="text-sm font-semibold">Informations personnelles</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground mb-3">Ces informations seront visibles par les autres membres de votre équipe</p>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="flex items-center gap-2 text-xs">
                                <User className="w-3.5 h-3.5" />
                                Prénom *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Jean"
                                  data-testid="input-first-name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="flex items-center gap-2 text-xs">
                                <User className="w-3.5 h-3.5" />
                                Nom *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Dupont"
                                  data-testid="input-last-name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="space-y-1">
                          <Label className="flex items-center gap-2 text-xs">
                            <Mail className="w-3.5 h-3.5" />
                            Email *
                          </Label>
                          <Input
                            type="email"
                            value={userProfile?.email || ""}
                            disabled
                            className="bg-muted"
                            data-testid="input-email"
                          />
                          <p className="text-xs text-muted-foreground">
                            L'email ne peut pas être modifié depuis cette page
                          </p>
                        </div>

                        <FormField
                          control={form.control}
                          name="gender"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-xs">Civilité</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                data-testid="select-gender"
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Sélectionner" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-background">
                                  <SelectItem value="male">Homme</SelectItem>
                                  <SelectItem value="female">Femme</SelectItem>
                                  <SelectItem value="other">Autre</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="position"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="flex items-center gap-2 text-xs">
                                <Briefcase className="w-3.5 h-3.5" />
                                Poste
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Développeur Full-Stack"
                                  data-testid="input-position"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="flex items-center gap-2 text-xs">
                                <Phone className="w-3.5 h-3.5" />
                                Téléphone
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="tel"
                                  placeholder="+33 6 12 34 56 78"
                                  data-testid="input-phone"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="flex items-center gap-2 text-xs">
                                <Building2 className="w-3.5 h-3.5" />
                                Nom de société
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ma Société"
                                  data-testid="input-company"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => form.reset()}
                          data-testid="button-cancel"
                          className="text-[12px]"
                        >
                          Annuler
                        </Button>
                        <Button
                          type="submit"
                          disabled={updateProfileMutation.isPending}
                          data-testid="button-save-profile"
                          className="text-[12px]"
                        >
                          {updateProfileMutation.isPending && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          Enregistrer
                        </Button>
                      </div>
                    </form>
                  </Form>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="profile" className="border rounded-lg px-4 bg-white dark:bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    <span className="text-sm font-semibold">Type de profil</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ProfileTypeCard 
                    currentProfileType={(userProfile?.profile as { type?: UserProfileType } | null)?.type}
                    embedded={true}
                  />
                </AccordionContent>
              </AccordionItem>

<AccordionItem value="tour" className="border rounded-lg px-4 bg-white dark:bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    <span className="text-sm font-semibold">Visite guidée</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Relancez la visite guidée pour redécouvrir les modules et fonctionnalités de l'application.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => startOnboarding()}
                      className="text-[12px]"
                      data-testid="button-restart-onboarding"
                    >
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Relancer la visite guidée
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">Configuration du compte</h2>
                    <p className="text-xs text-muted-foreground">
                      Personnalisez les statuts et seuils pour votre compte
                    </p>
                  </div>
                </div>

                <TJMEditor onRefetch={refetchConfig} />

                <ThresholdEditor
                  thresholds={config?.thresholds as ThresholdConfig}
                  onSave={handleSave}
                  isPending={updateConfigMutation.isPending}
                />

              </div>
            )}
          </TabsContent>

          <TabsContent value="permissions" className="space-y-6">
            <PermissionsTab />
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <AuditTab />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xs">Intégrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
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

          <TabsContent value="security" className="space-y-4">
            <Accordion type="multiple" defaultValue={["password", "delete-account"]} className="space-y-3">
              <AccordionItem value="password" className="border rounded-lg px-4 bg-white dark:bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span className="text-sm font-semibold">Modifier le mot de passe</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground mb-3">Changez votre mot de passe pour sécuriser votre compte</p>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={passwordForm.control}
                          name="newPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Nouveau mot de passe *</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type={showNewPassword ? "text" : "password"}
                                    placeholder="Minimum 8 caractères"
                                    data-testid="input-new-password"
                                    {...field}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                    data-testid="button-toggle-new-password"
                                  >
                                    {showNewPassword ? (
                                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={passwordForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Confirmer le mot de passe *</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Retapez le mot de passe"
                                    data-testid="input-confirm-password"
                                    {...field}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                    data-testid="button-toggle-confirm-password"
                                  >
                                    {showConfirmPassword ? (
                                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => passwordForm.reset()}
                          data-testid="button-cancel-password"
                          className="text-[12px]"
                        >
                          Annuler
                        </Button>
                        <Button
                          type="submit"
                          disabled={updatePasswordMutation.isPending}
                          data-testid="button-save-password"
                          className="text-[12px]"
                        >
                          {updatePasswordMutation.isPending && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          Mettre à jour le mot de passe
                        </Button>
                      </div>
                    </form>
                  </Form>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="delete-account" className="border rounded-lg px-4 bg-white dark:bg-card border-red-200 dark:border-red-900">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-semibold">Supprimer mon compte</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-900">
                      <p className="text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          Une fois votre compte supprimé, il est impossible de revenir en arrière. Veuillez en être certain.
                          {isInvitedUser && (
                            <span className="block mt-1 font-medium">
                              Vous serez retiré de l'organisation mais les données de l'organisation seront conservées.
                            </span>
                          )}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Pour confirmer, tapez <span className="font-mono font-semibold text-red-600 dark:text-red-400">supprimer mon compte</span> ci-dessous
                      </Label>
                      <Input
                        type="text"
                        placeholder="supprimer mon compte"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        data-testid="input-delete-confirmation"
                        className="font-mono"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deleteConfirmation !== "supprimer mon compte" || deleteAccountMutation.isPending}
                        onClick={() => deleteAccountMutation.mutate()}
                        data-testid="button-delete-account"
                        className="text-[12px]"
                      >
                        {deleteAccountMutation.isPending && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer mon compte
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
