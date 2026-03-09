import { useState } from "react";
import { useLocation } from "wouter";
import { FileText, Map, Calculator, X, BarChart3, ListTodo, Clock, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  if (!isVisible || project.onboardingSuggestionsDismissed === 1) {
    return null;
  }

  const hasCdc = scopeItems && scopeItems.length > 0;
  const billingMode = project.billingModeSuggested || 'forfait';
  const projectType = project.projectTypeInferred || 'autre';

  if (hasCdc) {
    return (
      <div
        className="w-full bg-violet-50 dark:bg-violet-950/20 border-b border-violet-200 dark:border-violet-800 px-4 py-2 flex items-center gap-3 flex-wrap"
        data-testid="card-post-creation-suggestions"
      >
        <CheckCircle2 className="h-4 w-4 text-violet-600 shrink-0" />
        <span className="text-xs font-medium text-violet-800 dark:text-violet-300 shrink-0">Base de pilotage définie</span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
          {[
            { icon: Map, label: "Roadmap", action: () => setLocation(`/roadmap?projectId=${project.id}`), testId: "button-suggestion-roadmap" },
            { icon: ListTodo, label: "Backlog", action: () => setLocation(`/backlog?projectId=${project.id}`), testId: "button-suggestion-backlog" },
            { icon: Clock, label: "Temps vs CDC", action: () => setLocation(`/projects/${project.id}?tab=time`), testId: "button-suggestion-time-tracking" },
          ].map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-violet-400 shrink-0" />}
              <button
                onClick={item.action}
                className="flex items-center gap-1 text-xs text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-100 bg-white dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded px-2 py-0.5 transition-colors"
                data-testid={item.testId}
              >
                <item.icon className="h-3 w-3 shrink-0" />
                {item.label}
              </button>
            </span>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => dismissMutation.mutate()}
          className="h-6 w-6 shrink-0 ml-auto text-violet-500 hover:text-violet-800"
          data-testid="button-dismiss-suggestions"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="w-full bg-primary/5 border-b border-primary/15 px-4 py-2 flex items-center gap-3 flex-wrap"
      data-testid="card-post-creation-suggestions"
    >
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <span className="text-xs font-medium text-foreground shrink-0">
        Projet pré-configuré
        <span className="ml-1.5 text-muted-foreground font-normal">
          {PROJECT_TYPE_LABELS[projectType] || 'Autre'} · {BILLING_MODE_LABELS[billingMode] || billingMode}
        </span>
      </span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
        {[
          { icon: FileText, label: "CDC guidé", action: onOpenCdcWizard, testId: "button-suggestion-cdc" },
          { icon: Calculator, label: "Facturation", action: () => setLocation(`/projects/${project.id}?tab=billing`), testId: "button-suggestion-billing" },
          { icon: BarChart3, label: "Hypothèses", action: () => setLocation(`/projects/${project.id}?tab=time`), testId: "button-suggestion-hypotheses" },
        ].map((item, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-primary/40 shrink-0" />}
            <button
              onClick={item.action}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 bg-white dark:bg-primary/10 border border-primary/20 rounded px-2 py-0.5 transition-colors"
              data-testid={item.testId}
            >
              <item.icon className="h-3 w-3 shrink-0" />
              {item.label}
            </button>
          </span>
        ))}
      </div>
      <button
        onClick={() => dismissMutation.mutate()}
        className="text-xs text-muted-foreground hover:text-foreground shrink-0 ml-auto"
        data-testid="link-dismiss-suggestions"
      >
        Ne plus afficher
      </button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => dismissMutation.mutate()}
        className="h-6 w-6 shrink-0 text-muted-foreground"
        data-testid="button-dismiss-suggestions"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
