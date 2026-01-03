import { useState } from "react";
import { useLocation } from "wouter";
import { FileText, Map, Calculator, X, ChevronRight, Sparkles, CheckCircle2, BarChart3, ListTodo, Clock, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, ProjectScopeItem } from "@shared/schema";

interface PostCreationSuggestionsProps {
  project: Project;
  scopeItems: ProjectScopeItem[];
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
  scopeItems,
  onOpenCdcWizard,
  onDismiss,
}: PostCreationSuggestionsProps) {
  const [, setLocation] = useLocation();
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

  const hasCdc = scopeItems && scopeItems.length > 0;
  const projectType = project.projectTypeInferred || 'autre';
  const billingMode = project.billingModeSuggested || 'forfait';
  const pilotingStrategy = project.pilotingStrategy || 'equilibre';

  if (hasCdc) {
    return (
      <Card className="border-green-500/20 bg-green-500/5" data-testid="card-post-creation-suggestions">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">Base de pilotage définie</CardTitle>
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
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              CDC validé
            </Badge>
            <Badge variant="outline">
              Baseline créée
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <button
            onClick={() => setLocation(`/roadmap?projectId=${project.id}`)}
            className="w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors hover-elevate bg-muted/50"
            data-testid="button-suggestion-roadmap"
          >
            <div className="p-2 rounded-md bg-muted">
              <Map className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">Consulter la roadmap générée</div>
              <div className="text-xs text-muted-foreground">Visualise les phases et jalons du projet</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            onClick={() => setLocation(`/backlog?projectId=${project.id}`)}
            className="w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors hover-elevate bg-muted/50"
            data-testid="button-suggestion-backlog"
          >
            <div className="p-2 rounded-md bg-muted">
              <ListTodo className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">Ajuster le backlog</div>
              <div className="text-xs text-muted-foreground">Priorise et affine les user stories</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            onClick={() => setLocation(`/projects/${project.id}?tab=cdc`)}
            className="w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors hover-elevate bg-muted/50"
            data-testid="button-suggestion-time-tracking"
          >
            <div className="p-2 rounded-md bg-muted">
              <Clock className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">Suivre Temps vs CDC</div>
              <div className="text-xs text-muted-foreground">Compare le temps passé à l'estimation</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

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
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Avant de planifier ce projet, commence par poser une base d'estimation fiable.
        </p>

        <button
          onClick={onOpenCdcWizard}
          className="w-full flex items-center gap-3 p-4 rounded-md text-left transition-colors hover-elevate bg-primary/10 border border-primary/20"
          data-testid="button-suggestion-cdc"
        >
          <div className="p-2 rounded-md bg-primary text-primary-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Lancer le CDC guidé</div>
            <div className="text-xs text-muted-foreground">
              Structure ton cahier des charges, estime l'effort et prépare le pilotage du projet.
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-primary" />
        </button>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => setLocation(`/projects/${project.id}?tab=financial`)}
            className="w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors hover-elevate bg-muted/50"
            data-testid="button-suggestion-billing"
          >
            <div className="p-2 rounded-md bg-muted">
              <Calculator className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">Configurer la facturation</div>
              <div className="text-xs text-muted-foreground">
                Mode suggéré : {BILLING_MODE_LABELS[billingMode]} (modifiable plus tard)
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            onClick={() => setLocation(`/projects/${project.id}?tab=settings`)}
            className="w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors hover-elevate bg-muted/50"
            data-testid="button-suggestion-hypotheses"
          >
            <div className="p-2 rounded-md bg-muted">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">Définir les hypothèses projet</div>
              <div className="text-xs text-muted-foreground">
                TJM cible, part facturable, niveau de risque
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="bg-muted/30 rounded-md p-3 border border-border/50">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Une fois le CDC validé, PlanBase générera automatiquement :</p>
              <ul className="space-y-0.5 ml-2">
                <li>• un backlog structuré</li>
                <li>• une roadmap par phases (T1 → LT)</li>
                <li>• une baseline de pilotage</li>
                <li>• des alertes de trajectoire (temps, marge, dérive)</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="pt-1 text-center">
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
