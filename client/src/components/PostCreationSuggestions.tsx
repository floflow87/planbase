import { useState } from "react";
import { useLocation } from "wouter";
import { FileText, Map, Calculator, X, BarChart3, ListTodo, Clock, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

const BILLING_MODE_DESCRIPTIONS: Record<string, string> = {
  forfait: 'Projet à prix fixe : vous avez estimé un budget global. Suivez le temps passé vs votre estimation pour piloter votre rentabilité.',
  regie: 'Régie : vous facturez au temps réel. Chaque heure loggée génère du chiffre d\'affaires directement.',
  mixte: 'Modèle mixte : une partie forfaitaire et une partie au temps passé. Idéal pour les projets avec un périmètre variable.',
};

const PROJECT_TYPE_DESCRIPTIONS: Record<string, string> = {
  dev_saas: 'Développement d\'un produit SaaS ou application web. Pilotez les sprints, le backlog et la roadmap produit.',
  design: 'Projet de design ou création graphique. Gérez les livrables, versions et validations client.',
  conseil: 'Mission de conseil ou accompagnement. Suivez vos recommandations et le temps passé par thématique.',
  ecommerce: 'Création ou refonte d\'une boutique en ligne. Gérez les modules, les intégrations et les mises en production.',
  site_vitrine: 'Création d\'un site vitrine. Suivez les pages, les contenus et les validations.',
  integration: 'Intégration technique ou développement API. Gérez les endpoints, les tests et les environnements.',
  formation: 'Prestation de formation. Structurez votre programme, supports et livrables pédagogiques.',
  cpo: 'Mission CPO ou Product Management. Pilotez la stratégie produit, les OKRs et la roadmap.',
  autre: 'Projet personnalisé. Adaptez le pilotage selon vos besoins.',
};

const tooltipContentClass = "max-w-xs text-xs bg-white text-foreground border shadow-md";

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

  const btnClass = "flex items-center gap-1.5 text-xs font-medium bg-white/15 hover:bg-white/30 text-white border border-white/30 rounded px-3 py-2 transition-colors cursor-pointer";

  const DismissButton = () => (
    <div className="shrink-0 ml-auto flex items-center gap-1">
      <button
        onClick={() => dismissMutation.mutate()}
        className="text-white/70 hover:text-white text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer"
        data-testid="button-dismiss-suggestions"
      >
        Ne plus afficher
      </button>
      <button
        onClick={() => dismissMutation.mutate()}
        className="flex items-center justify-center rounded p-0.5 text-white/70 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
        data-testid="button-dismiss-suggestions-x"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  if (hasCdc) {
    return (
      <div
        className="w-full bg-primary px-4 py-2.5 flex items-center gap-3 flex-wrap"
        data-testid="card-post-creation-suggestions"
      >
        <CheckCircle2 className="h-4 w-4 text-white/80 shrink-0" />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs font-semibold text-white shrink-0 cursor-help underline decoration-dotted underline-offset-2">
              Base de pilotage définie
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className={tooltipContentClass}>
            Votre Cahier des Charges a été généré avec {scopeItems.length} item{scopeItems.length > 1 ? "s" : ""}. Le temps loggé sera comparé à vos estimations pour mesurer la rentabilité en temps réel.
          </TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
          {[
            { icon: Map, label: "Roadmap", tooltip: "Planifiez vos milestones et jalons sur la timeline du projet.", action: () => setLocation(`/roadmap?projectId=${project.id}`), testId: "button-suggestion-roadmap" },
            { icon: ListTodo, label: "Backlog", tooltip: "Gérez vos epics, user stories et tickets de développement.", action: () => setLocation(`/backlog?projectId=${project.id}`), testId: "button-suggestion-backlog" },
            { icon: Clock, label: "Temps vs CDC", tooltip: "Comparez le temps réellement passé à vos estimations initiales.", action: () => setLocation(`/projects/${project.id}?tab=time`), testId: "button-suggestion-time-tracking" },
          ].map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3 text-white/40 shrink-0" />}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={item.action} className={btnClass} data-testid={item.testId}>
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className={tooltipContentClass}>{item.tooltip}</TooltipContent>
              </Tooltip>
            </span>
          ))}
        </div>
        <DismissButton />
      </div>
    );
  }

  return (
    <div
      className="w-full bg-primary px-4 py-2.5 flex items-center gap-3 flex-wrap"
      data-testid="card-post-creation-suggestions"
    >
      <Sparkles className="h-4 w-4 text-white/80 shrink-0" />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs font-semibold text-white shrink-0 cursor-help underline decoration-dotted underline-offset-2">
            Projet pré-configuré
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className={`${tooltipContentClass} space-y-1`}>
          <p className="font-medium">{PROJECT_TYPE_LABELS[projectType] || 'Projet'} · {BILLING_MODE_LABELS[billingMode] || billingMode}</p>
          <p className="text-muted-foreground">{PROJECT_TYPE_DESCRIPTIONS[projectType]}</p>
          <p className="text-muted-foreground">{BILLING_MODE_DESCRIPTIONS[billingMode]}</p>
        </TooltipContent>
      </Tooltip>
      <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
        {[
          { icon: FileText, label: "CDC guidé", tooltip: "Générez votre Cahier des Charges pas à pas avec nos questions guidées.", action: onOpenCdcWizard, testId: "button-suggestion-cdc" },
          { icon: Calculator, label: "Facturation", tooltip: "Définissez votre TJM, budget et modalités de facturation.", action: () => setLocation(`/projects/${project.id}?tab=billing`), testId: "button-suggestion-billing" },
          { icon: BarChart3, label: "Hypothèses", tooltip: "Posez vos hypothèses de temps et comparez avec le réel.", action: () => setLocation(`/projects/${project.id}?tab=time`), testId: "button-suggestion-hypotheses" },
        ].map((item, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3 text-white/40 shrink-0" />}
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={item.action} className={btnClass} data-testid={item.testId}>
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className={tooltipContentClass}>{item.tooltip}</TooltipContent>
            </Tooltip>
          </span>
        ))}
      </div>
      <DismissButton />
    </div>
  );
}
