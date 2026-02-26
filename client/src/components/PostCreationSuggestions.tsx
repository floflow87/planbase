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
      <Card className="border-violet-500/30 bg-violet-50 dark:bg-violet-950/20" data-testid="card-post-creation-suggestions">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-violet-600" />
              <CardTitle className="text-sm">Base de pilotage définie</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleDismiss}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                data-testid="link-dismiss-suggestions"
              >
                Ne plus afficher
              </button>
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
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary" className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400">
              CDC validé
            </Badge>
            <Badge variant="outline">
              Baseline créée
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setLocation(`/roadmap?projectId=${project.id}`)}
              className="flex flex-col items-center gap-2 p-4 rounded-lg text-center transition-all duration-200 bg-gradient-to-br from-white to-violet-50 dark:from-gray-800 dark:to-violet-950/20 border border-violet-200 dark:border-violet-700 text-foreground hover:border-violet-400 dark:hover:border-violet-500 hover:to-violet-100 hover:scale-[1.03] hover:shadow-md active:scale-[0.98]"
              data-testid="button-suggestion-roadmap"
            >
              <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-900/30">
                <Map className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <div className="font-medium text-sm text-foreground">Roadmap</div>
                <div className="text-xs text-muted-foreground mt-1">Visualiser les phases et milestones du projet</div>
              </div>
            </button>

            <button
              onClick={() => setLocation(`/backlog?projectId=${project.id}`)}
              className="flex flex-col items-center gap-2 p-4 rounded-lg text-center transition-all duration-200 bg-gradient-to-br from-white to-violet-50 dark:from-gray-800 dark:to-violet-950/20 border border-violet-200 dark:border-violet-700 text-foreground hover:border-violet-400 dark:hover:border-violet-500 hover:to-violet-100 hover:scale-[1.03] hover:shadow-md active:scale-[0.98]"
              data-testid="button-suggestion-backlog"
            >
              <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-900/30">
                <ListTodo className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <div className="font-medium text-sm text-foreground">Backlog</div>
                <div className="text-xs text-muted-foreground mt-1">Gérer les tickets et sprints</div>
              </div>
            </button>

            <button
              onClick={() => setLocation(`/projects/${project.id}?tab=time`)}
              className="flex flex-col items-center gap-2 p-4 rounded-lg text-center transition-all duration-200 bg-gradient-to-br from-white to-violet-50 dark:from-gray-800 dark:to-violet-950/20 border border-violet-200 dark:border-violet-700 text-foreground hover:border-violet-400 dark:hover:border-violet-500 hover:to-violet-100 hover:scale-[1.03] hover:shadow-md active:scale-[0.98]"
              data-testid="button-suggestion-time-tracking"
            >
              <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-900/30">
                <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <div className="font-medium text-sm text-foreground">Temps vs CDC</div>
                <div className="text-xs text-muted-foreground mt-1">Suivre le temps passé vs estimé</div>
              </div>
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
          <div className="flex items-center gap-1">
            <button
              onClick={handleDismiss}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
              data-testid="link-dismiss-suggestions"
            >
              Ne plus afficher
            </button>
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
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Avant de planifier ce projet, commence par poser une base d'estimation fiable.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={onOpenCdcWizard}
            className="flex flex-col items-center gap-2 p-4 rounded-lg text-center transition-all duration-200 bg-gradient-to-br from-white to-violet-50 dark:from-gray-800 dark:to-violet-950/20 border border-violet-200 dark:border-violet-700 text-foreground hover:border-violet-400 dark:hover:border-violet-500 hover:to-violet-100 hover:scale-[1.03] hover:shadow-md active:scale-[0.98]"
            data-testid="button-suggestion-cdc"
          >
            <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-900/30">
              <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <div className="font-medium text-sm text-foreground">CDC guidé</div>
              <div className="text-xs text-muted-foreground mt-1">Structure et estime l'effort</div>
            </div>
          </button>

          <button
            onClick={() => setLocation(`/projects/${project.id}?tab=billing`)}
            className="flex flex-col items-center gap-2 p-4 rounded-lg text-center transition-all duration-200 bg-gradient-to-br from-white to-violet-50 dark:from-gray-800 dark:to-violet-950/20 border border-violet-200 dark:border-violet-700 text-foreground hover:border-violet-400 dark:hover:border-violet-500 hover:to-violet-100 hover:scale-[1.03] hover:shadow-md active:scale-[0.98]"
            data-testid="button-suggestion-billing"
          >
            <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-900/30">
              <Calculator className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <div className="font-medium text-sm text-foreground">Facturation</div>
              <div className="text-xs text-muted-foreground mt-1">{BILLING_MODE_LABELS[billingMode]} (modifiable)</div>
            </div>
          </button>

          <button
            onClick={() => setLocation(`/projects/${project.id}?tab=time`)}
            className="flex flex-col items-center gap-2 p-4 rounded-lg text-center transition-all duration-200 bg-gradient-to-br from-white to-violet-50 dark:from-gray-800 dark:to-violet-950/20 border border-violet-200 dark:border-violet-700 text-foreground hover:border-violet-400 dark:hover:border-violet-500 hover:to-violet-100 hover:scale-[1.03] hover:shadow-md active:scale-[0.98]"
            data-testid="button-suggestion-hypotheses"
          >
            <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-900/30">
              <BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <div className="font-medium text-sm text-foreground">Hypothèses</div>
              <div className="text-xs text-muted-foreground mt-1">TJM, part facturable, risque</div>
            </div>
          </button>
        </div>

      </CardContent>
    </Card>
  );
}
