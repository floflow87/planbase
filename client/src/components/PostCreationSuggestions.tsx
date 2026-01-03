import { useState } from "react";
import { FileText, Map, Lightbulb, Calculator, X, ChevronRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

interface PostCreationSuggestionsProps {
  project: Project;
  onOpenCdcWizard: () => void;
  onDismiss: () => void;
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  dev_saas: 'Développement SaaS',
  design: 'Design & Graphisme',
  conseil: 'Conseil & Accompagnement',
  ecommerce: 'E-commerce',
  site_vitrine: 'Site Vitrine',
  integration: 'Intégration & API',
  formation: 'Formation',
  cpo: 'Product Management',
  autre: 'Autre',
};

const BILLING_MODE_LABELS: Record<string, string> = {
  forfait: 'Forfait',
  regie: 'Régie',
  mixte: 'Mixte',
};

const PILOTING_STRATEGY_LABELS: Record<string, string> = {
  temps_critique: 'Temps critique',
  marge_critique: 'Marge critique',
  equilibre: 'Équilibre',
};

export function PostCreationSuggestions({
  project,
  onOpenCdcWizard,
  onDismiss,
}: PostCreationSuggestionsProps) {
  const [isVisible, setIsVisible] = useState(true);

  const dismissMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/projects/${project.id}`, "PATCH", {
        onboardingSuggestionsDismissed: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsVisible(false);
      onDismiss();
    },
  });

  const handleDismiss = () => {
    dismissMutation.mutate();
  };

  if (!isVisible || project.onboardingSuggestionsDismissed === 1) {
    return null;
  }

  const projectType = project.projectTypeInferred || 'autre';
  const billingMode = project.billingModeSuggested || 'forfait';
  const pilotingStrategy = project.pilotingStrategy || 'equilibre';

  const suggestions = [
    {
      id: 'cdc',
      icon: FileText,
      title: 'Lancer le CDC guidé',
      description: `Structure ton cahier des charges pour ce projet ${PROJECT_TYPE_LABELS[projectType]?.toLowerCase() || ''}`,
      action: onOpenCdcWizard,
      primary: true,
    },
    {
      id: 'roadmap',
      icon: Map,
      title: 'Créer une roadmap',
      description: 'Planifie les grandes étapes du projet',
      action: () => {
        window.location.href = `/roadmaps?projectId=${project.id}`;
      },
      primary: false,
    },
    {
      id: 'billing',
      icon: Calculator,
      title: 'Configurer la facturation',
      description: `Mode suggéré : ${BILLING_MODE_LABELS[billingMode] || billingMode}`,
      action: () => {
        window.location.href = `/projects/${project.id}?tab=financial`;
      },
      primary: false,
    },
  ];

  return (
    <Card className="border-primary/20 bg-primary/5" data-testid="card-post-creation-suggestions">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Projet pré-configuré</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8"
            data-testid="button-dismiss-suggestions"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="secondary" data-testid="badge-project-type">
            {PROJECT_TYPE_LABELS[projectType] || 'Autre'}
          </Badge>
          <Badge variant="outline" data-testid="badge-billing-mode">
            {BILLING_MODE_LABELS[billingMode] || billingMode}
          </Badge>
          <Badge variant="outline" data-testid="badge-piloting-strategy">
            {PILOTING_STRATEGY_LABELS[pilotingStrategy] || pilotingStrategy}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground mb-3">
          Suggestions pour démarrer ce projet :
        </p>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={suggestion.action}
            className={`w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors hover-elevate ${
              suggestion.primary 
                ? 'bg-primary/10 border border-primary/20' 
                : 'bg-muted/50'
            }`}
            data-testid={`button-suggestion-${suggestion.id}`}
          >
            <div className={`p-2 rounded-md ${suggestion.primary ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <suggestion.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{suggestion.title}</div>
              <div className="text-xs text-muted-foreground truncate">{suggestion.description}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
        <div className="pt-2 text-center">
          <button
            onClick={handleDismiss}
            className="text-xs text-muted-foreground hover:text-foreground"
            data-testid="link-dismiss-suggestions"
          >
            Ne plus afficher pour ce projet
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
