import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Eye, Save, Loader2, Users, FolderKanban, Package, Rocket, DollarSign, FolderOpen, ChevronDown, ChevronRight, UserCheck, UserMinus } from "lucide-react";
import { useState, useEffect } from "react";
import { LoadingState } from "@/design-system/patterns/LoadingState";
import type { RbacModule, RbacRole } from "@shared/schema";

interface ModuleViewConfig {
  subviewsEnabled?: Record<string, boolean>;
  layout?: string;
}

interface TemplateResponse {
  module: string;
  config: ModuleViewConfig;
}

interface SubviewDefinition {
  key: string;
  label: string;
}

interface ModuleDefinition {
  id: RbacModule;
  label: string;
  icon: React.ElementType;
  subviews: SubviewDefinition[];
  guestDefaultConfig: Record<string, boolean>;
  memberDefaultConfig: Record<string, boolean>;
}

const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: "crm",
    label: "CRM",
    icon: Users,
    subviews: [
      { key: "crm.clients", label: "Clients" },
      { key: "crm.opportunities", label: "Pipeline Opportunités" },
      { key: "crm.kpis", label: "KPIs" },
    ],
    guestDefaultConfig: { "crm.clients": true, "crm.opportunities": false, "crm.kpis": false },
    memberDefaultConfig: { "crm.clients": true, "crm.opportunities": true, "crm.kpis": true },
  },
  {
    id: "projects",
    label: "Projets",
    icon: FolderKanban,
    subviews: [
      { key: "projects.list", label: "Liste des projets" },
      { key: "projects.details", label: "Détails projet" },
      { key: "projects.scope", label: "Périmètre / CDC" },
      { key: "projects.billing", label: "Facturation" },
    ],
    guestDefaultConfig: { "projects.list": true, "projects.details": true, "projects.scope": false, "projects.billing": false },
    memberDefaultConfig: { "projects.list": true, "projects.details": true, "projects.scope": true, "projects.billing": true },
  },
  {
    id: "product",
    label: "Product",
    icon: Package,
    subviews: [
      { key: "product.backlog", label: "Backlog" },
      { key: "product.epics", label: "Epics" },
      { key: "product.stats", label: "Statistiques" },
      { key: "product.retrospective", label: "Rétrospectives" },
      { key: "product.recipe", label: "Recette" },
    ],
    guestDefaultConfig: { "product.backlog": false, "product.epics": false, "product.stats": false, "product.retrospective": false, "product.recipe": false },
    memberDefaultConfig: { "product.backlog": true, "product.epics": true, "product.stats": true, "product.retrospective": true, "product.recipe": true },
  },
  {
    id: "roadmap",
    label: "Roadmap",
    icon: Rocket,
    subviews: [
      { key: "roadmap.gantt", label: "Gantt" },
      { key: "roadmap.output", label: "Output" },
      { key: "roadmap.okr", label: "OKR" },
      { key: "roadmap.tree", label: "Arborescence" },
    ],
    guestDefaultConfig: { "roadmap.gantt": false, "roadmap.output": false, "roadmap.okr": false, "roadmap.tree": false },
    memberDefaultConfig: { "roadmap.gantt": true, "roadmap.output": true, "roadmap.okr": true, "roadmap.tree": true },
  },
  {
    id: "profitability",
    label: "Rentabilité",
    icon: DollarSign,
    subviews: [
      { key: "profitability.overview", label: "Vue d'ensemble" },
      { key: "profitability.byProject", label: "Par projet" },
      { key: "profitability.simulations", label: "Simulations" },
      { key: "profitability.resources", label: "Ressources" },
    ],
    guestDefaultConfig: { "profitability.overview": false, "profitability.byProject": false, "profitability.simulations": false, "profitability.resources": false },
    memberDefaultConfig: { "profitability.overview": true, "profitability.byProject": true, "profitability.simulations": false, "profitability.resources": false },
  },
  {
    id: "documents",
    label: "Documents",
    icon: FolderOpen,
    subviews: [
      { key: "documents.list", label: "Liste des documents" },
      { key: "documents.upload", label: "Upload" },
      { key: "documents.integrations", label: "Intégrations" },
    ],
    guestDefaultConfig: { "documents.list": false, "documents.upload": false, "documents.integrations": false },
    memberDefaultConfig: { "documents.list": true, "documents.upload": true, "documents.integrations": false },
  },
];

function ModuleSection({ 
  module, 
  subviewsState, 
  onToggle, 
  isExpanded, 
  onToggleExpand,
  roleKey,
}: {
  module: ModuleDefinition;
  subviewsState: Record<string, boolean>;
  onToggle: (key: string, enabled: boolean) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  roleKey: "guest" | "member";
}) {
  const IconComponent = module.icon;
  const enabledCount = module.subviews.filter(sv => subviewsState[sv.key]).length;

  return (
    <div className="border rounded-md" data-testid={`section-module-${roleKey}-${module.id}`}>
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between gap-4 p-3 hover-elevate"
        data-testid={`button-toggle-${roleKey}-${module.id}`}
      >
        <div className="flex items-center gap-2">
          <IconComponent className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{module.label}</span>
          <span className="text-xs text-muted-foreground">
            ({enabledCount}/{module.subviews.length} activés)
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && (
        <div className="border-t p-3 space-y-2 bg-muted/30">
          {module.subviews.map((subview) => (
            <div 
              key={subview.key}
              className="flex items-center justify-between gap-4 flex-wrap py-2 px-3 rounded-md border bg-background"
              data-testid={`row-subview-${roleKey}-${subview.key}`}
            >
              <Label 
                htmlFor={`${roleKey}-${subview.key}`}
                className="text-sm cursor-pointer"
                data-testid={`label-subview-${roleKey}-${subview.key}`}
              >
                {subview.label}
              </Label>
              <Switch
                id={`${roleKey}-${subview.key}`}
                checked={subviewsState[subview.key] || false}
                onCheckedChange={(checked) => onToggle(subview.key, checked)}
                data-testid={`switch-subview-${roleKey}-${subview.key}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface RoleViewPanelProps {
  role: "guest" | "member";
  roleLabel: string;
  roleDescription: string;
}

function RoleViewPanel({ role, roleLabel, roleDescription }: RoleViewPanelProps) {
  const { toast } = useToast();
  const [allSubviews, setAllSubviews] = useState<Record<string, boolean>>({});
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(["crm"]));
  const [hasChanges, setHasChanges] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const { data: templates, isLoading } = useQuery<TemplateResponse[]>({
    queryKey: [`/api/views/template/${role}/all`],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (initialLoaded) return;
    
    const defaults: Record<string, boolean> = {};
    MODULE_DEFINITIONS.forEach(mod => {
      const defaultConfig = role === "guest" ? mod.guestDefaultConfig : mod.memberDefaultConfig;
      Object.entries(defaultConfig).forEach(([key, value]) => {
        defaults[key] = value;
      });
    });

    if (templates && templates.length > 0) {
      templates.forEach((tpl) => {
        if (tpl.config.subviewsEnabled) {
          Object.entries(tpl.config.subviewsEnabled).forEach(([key, value]) => {
            defaults[key] = value;
          });
        }
      });
    }

    setAllSubviews(defaults);
    if (templates !== undefined) {
      setInitialLoaded(true);
    }
  }, [templates, initialLoaded, role]);

  const saveTemplateMutation = useMutation({
    mutationFn: async ({ configs }: { configs: { module: string; config: ModuleViewConfig }[] }) => {
      const promises = configs.map(({ module, config }) => 
        apiRequest("POST", `/api/views/template/${role}`, { module, config, applyToAll: true })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/views/template/${role}/all`] });
      setHasChanges(false);
      toast({ 
        title: "Configuration enregistrée", 
        description: `Les paramètres de vue ${roleLabel.toLowerCase()} ont été mis à jour pour tous les modules.` 
      });
    },
    onError: () => {
      toast({ 
        title: "Erreur", 
        description: "Impossible d'enregistrer la configuration.", 
        variant: "destructive" 
      });
    },
  });

  const handleToggle = (key: string, enabled: boolean) => {
    setAllSubviews(prev => ({ ...prev, [key]: enabled }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const configs: { module: string; config: ModuleViewConfig }[] = [];
    
    MODULE_DEFINITIONS.forEach((mod) => {
      const subviewsEnabled: Record<string, boolean> = {};
      mod.subviews.forEach(sv => {
        subviewsEnabled[sv.key] = allSubviews[sv.key] || false;
      });
      configs.push({
        module: mod.id,
        config: { subviewsEnabled },
      });
    });

    saveTemplateMutation.mutate({ configs });
  };

  const toggleExpand = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  if (isLoading) {
    return <LoadingState message="Chargement de la configuration..." />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{roleDescription}</p>
      
      <div className="space-y-3">
        {MODULE_DEFINITIONS.map((mod) => (
          <ModuleSection
            key={mod.id}
            module={mod}
            subviewsState={allSubviews}
            onToggle={handleToggle}
            isExpanded={expandedModules.has(mod.id)}
            onToggleExpand={() => toggleExpand(mod.id)}
            roleKey={role}
          />
        ))}
      </div>

      {hasChanges && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={saveTemplateMutation.isPending}
            data-testid={`button-save-${role}-views`}
          >
            {saveTemplateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}

export function RoleViewConfig() {
  return (
    <Card data-testid="card-role-view-config">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Eye className="w-4 h-4" />
          Vues par défaut
        </CardTitle>
        <CardDescription>
          Configurez les vues et sous-modules visibles par défaut pour chaque rôle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="member" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="member" className="text-xs" data-testid="tab-member-views">
              <UserCheck className="w-3.5 h-3.5 mr-1.5" />
              Membres
            </TabsTrigger>
            <TabsTrigger value="guest" className="text-xs" data-testid="tab-guest-views">
              <UserMinus className="w-3.5 h-3.5 mr-1.5" />
              Invités
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="member">
            <RoleViewPanel
              role="member"
              roleLabel="Membre"
              roleDescription="Configurez les vues par défaut pour les membres. Les membres ont généralement accès à plus de fonctionnalités que les invités."
            />
          </TabsContent>
          
          <TabsContent value="guest">
            <RoleViewPanel
              role="guest"
              roleLabel="Invité"
              roleDescription="Configurez les vues par défaut pour les invités. Les invités ont un accès limité aux fonctionnalités."
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
