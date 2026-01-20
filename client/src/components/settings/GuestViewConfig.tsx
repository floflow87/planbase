import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, Save, Loader2, Users, FolderKanban, Package, Rocket, DollarSign, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { LoadingState } from "@/design-system/patterns/LoadingState";
import type { RbacModule } from "@shared/schema";

interface ModuleViewConfig {
  subviewsEnabled?: Record<string, boolean>;
  layout?: string;
}

interface GuestTemplateResponse {
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
  defaultConfig: Record<string, boolean>;
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
    defaultConfig: { "crm.clients": true, "crm.opportunities": false, "crm.kpis": false },
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
    defaultConfig: { "projects.list": true, "projects.details": true, "projects.scope": false, "projects.billing": false },
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
    defaultConfig: { "product.backlog": false, "product.epics": false, "product.stats": false, "product.retrospective": false, "product.recipe": false },
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
    defaultConfig: { "roadmap.gantt": false, "roadmap.output": false, "roadmap.okr": false, "roadmap.tree": false },
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
    defaultConfig: { "profitability.overview": false, "profitability.byProject": false, "profitability.simulations": false, "profitability.resources": false },
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
    defaultConfig: { "documents.list": false, "documents.upload": false, "documents.integrations": false },
  },
];

function ModuleSection({ 
  module, 
  subviewsState, 
  onToggle, 
  isExpanded, 
  onToggleExpand 
}: {
  module: ModuleDefinition;
  subviewsState: Record<string, boolean>;
  onToggle: (key: string, enabled: boolean) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const IconComponent = module.icon;
  const enabledCount = module.subviews.filter(sv => subviewsState[sv.key]).length;

  return (
    <div className="border rounded-md" data-testid={`section-module-${module.id}`}>
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between gap-4 p-3 hover-elevate"
        data-testid={`button-toggle-${module.id}`}
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
              data-testid={`row-subview-${subview.key}`}
            >
              <Label 
                htmlFor={subview.key}
                className="text-sm cursor-pointer"
                data-testid={`label-subview-${subview.key}`}
              >
                {subview.label}
              </Label>
              <Switch
                id={subview.key}
                checked={subviewsState[subview.key] || false}
                onCheckedChange={(checked) => onToggle(subview.key, checked)}
                data-testid={`switch-subview-${subview.key}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GuestViewConfig() {
  const { toast } = useToast();
  const [allSubviews, setAllSubviews] = useState<Record<string, boolean>>({});
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(["crm"]));
  const [hasChanges, setHasChanges] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const { data: guestTemplates, isLoading } = useQuery<GuestTemplateResponse[]>({
    queryKey: ["/api/views/template/guest/all"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (initialLoaded) return;
    
    const defaults: Record<string, boolean> = {};
    MODULE_DEFINITIONS.forEach(mod => {
      Object.entries(mod.defaultConfig).forEach(([key, value]) => {
        defaults[key] = value;
      });
    });

    if (guestTemplates && guestTemplates.length > 0) {
      guestTemplates.forEach(template => {
        if (template.config?.subviewsEnabled) {
          Object.entries(template.config.subviewsEnabled).forEach(([key, value]) => {
            defaults[key] = value;
          });
        }
      });
      setInitialLoaded(true);
    }

    setAllSubviews(defaults);
  }, [guestTemplates, initialLoaded]);

  const saveTemplateMutation = useMutation({
    mutationFn: async ({ configs }: { configs: { module: string; config: ModuleViewConfig }[] }) => {
      const promises = configs.map(({ module, config }) => 
        apiRequest("POST", "/api/views/template/guest", { module, config, applyToAll: true })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/views/template/guest/all"] });
      setHasChanges(false);
      toast({ 
        title: "Configuration enregistrée", 
        description: "Les paramètres de vue invité ont été mis à jour pour tous les modules." 
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

  const handleSubviewToggle = (key: string, enabled: boolean) => {
    setAllSubviews(prev => ({
      ...prev,
      [key]: enabled,
    }));
    setHasChanges(true);
  };

  const toggleModuleExpand = (moduleId: string) => {
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

  const handleSave = () => {
    const configs = MODULE_DEFINITIONS.map(mod => {
      const moduleSubviews: Record<string, boolean> = {};
      mod.subviews.forEach(sv => {
        moduleSubviews[sv.key] = allSubviews[sv.key] ?? false;
      });
      return {
        module: mod.id,
        config: { subviewsEnabled: moduleSubviews },
      };
    });
    
    saveTemplateMutation.mutate({ configs });
  };

  if (isLoading) {
    return <LoadingState size="sm" />;
  }

  return (
    <Card data-testid="card-guest-view-config">
      <CardHeader>
        <div className="flex items-center gap-2" data-testid="header-guest-view">
          <Eye className="w-4 h-4" />
          <CardTitle className="text-sm">Vue par défaut des invités</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Configurez quelles sections les invités peuvent voir par défaut dans chaque module
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {MODULE_DEFINITIONS.map((module) => (
          <ModuleSection
            key={module.id}
            module={module}
            subviewsState={allSubviews}
            onToggle={handleSubviewToggle}
            isExpanded={expandedModules.has(module.id)}
            onToggleExpand={() => toggleModuleExpand(module.id)}
          />
        ))}

        <div className="flex flex-wrap justify-end gap-2 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveTemplateMutation.isPending}
            data-testid="button-save-guest-view"
          >
            {saveTemplateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
