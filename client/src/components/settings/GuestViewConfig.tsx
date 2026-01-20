import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { LoadingState } from "@/design-system/patterns/LoadingState";

interface ModuleViewConfig {
  subviewsEnabled?: Record<string, boolean>;
  layout?: string;
}

interface GuestTemplateResponse {
  module: string;
  config: ModuleViewConfig;
}

const CRM_SUBVIEWS = [
  { key: "crm.clients", label: "Clients" },
  { key: "crm.opportunities", label: "Pipeline Opportunités" },
  { key: "crm.kpis", label: "KPIs" },
];

const DEFAULT_CRM_CONFIG: GuestTemplateResponse = {
  module: "crm",
  config: { subviewsEnabled: { "crm.clients": true, "crm.opportunities": false, "crm.kpis": false } },
};

export function GuestViewConfig() {
  const { toast } = useToast();
  const [crmSubviews, setCrmSubviews] = useState<Record<string, boolean>>({
    "crm.clients": true,
    "crm.opportunities": false,
    "crm.kpis": false,
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: guestTemplate, isLoading } = useQuery<GuestTemplateResponse>({
    queryKey: ["/api/views/template/guest?module=crm"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const config = guestTemplate?.config?.subviewsEnabled || DEFAULT_CRM_CONFIG.config.subviewsEnabled;
    if (config) {
      setCrmSubviews(prev => ({
        ...prev,
        ...config,
      }));
    }
  }, [guestTemplate]);

  const saveTemplateMutation = useMutation({
    mutationFn: async ({ module, config, applyToAll }: { 
      module: string; 
      config: ModuleViewConfig; 
      applyToAll: boolean;
    }) => {
      return apiRequest("POST", "/api/views/template/guest", { module, config, applyToAll });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/views/template/guest?module=crm"] });
      setHasChanges(false);
      toast({ 
        title: "Configuration enregistrée", 
        description: "Les paramètres de vue invité ont été mis à jour." 
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
    setCrmSubviews(prev => ({
      ...prev,
      [key]: enabled,
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveTemplateMutation.mutate({
      module: "crm",
      config: { subviewsEnabled: crmSubviews },
      applyToAll: true,
    });
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
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 
            className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            data-testid="heading-crm-module"
          >
            Module CRM
          </h4>
          <div className="space-y-3">
            {CRM_SUBVIEWS.map((subview) => (
              <div 
                key={subview.key} 
                className="flex items-center justify-between gap-4 flex-wrap p-3 rounded-md border"
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
                  checked={crmSubviews[subview.key] || false}
                  onCheckedChange={(checked) => handleSubviewToggle(subview.key, checked)}
                  data-testid={`switch-subview-${subview.key}`}
                />
              </div>
            ))}
          </div>
        </div>

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
