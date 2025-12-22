export interface OnboardingStep {
  id: string;
  route: string;
  highlightSelector?: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
  copy: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel?: string;
  onEnter?: () => void;
  waitFor?: () => Promise<boolean>;
}

export const ONBOARDING_VERSION = "v1";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "intro",
    route: "/",
    placement: "center",
    copy: "Salut ! Je vais t'aider à prendre Planbase en main. Ici, tout est connecté : clients, projets, temps, tâches, rentabilité. On ne va pas tout voir d'un coup — je te guide, pas à pas.",
    ctaPrimaryLabel: "C'est parti",
    ctaSecondaryLabel: "Plus tard",
  },
  {
    id: "dashboard",
    route: "/",
    highlightSelector: "[data-testid='dashboard-kpis'], .dashboard-stats, main",
    placement: "bottom",
    copy: "Ici, tu commences toujours par un coup d'œil. Tu vois tes principaux KPIs, ce qui avance, ce qui bloque, et ce qui mérite ton attention aujourd'hui. Chaque chiffre vient de tes projets, de ton temps et de tes tâches. Rien n'est isolé.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "crm",
    route: "/crm",
    highlightSelector: "[data-testid='crm-pipeline'], .pipeline-container, main",
    placement: "bottom",
    copy: "Ici, tu ajoutes tes clients et tu suis ton pipe d'opportunités. Tu peux personnaliser les étapes pour qu'elles collent à ta façon de travailler. Quand une opportunité devient concrète, tu la transformes en projet — sans ressaisie.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "project",
    route: "/projects",
    highlightSelector: "[data-testid='projects-list'], .projects-container, main",
    placement: "bottom",
    copy: "Ici, tout se rejoint. Un projet relie un client, un budget, un périmètre et un objectif. À partir d'un projet, tu pilotes le temps, les tâches, le backlog et la rentabilité.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "time-tracker",
    route: "/projects",
    highlightSelector: "[data-testid='time-tracker'], .time-entries, main",
    placement: "top",
    copy: "Ici, tu enregistres chaque temps passé sur un projet. Tu peux le lier à une tâche, un ticket ou une étape du cahier des charges. Plus tu saisis ton temps, plus je peux t'aider à anticiper et te proposer des recommandations utiles.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "tasks",
    route: "/tasks",
    highlightSelector: "[data-testid='tasks-board'], .kanban-board, main",
    placement: "bottom",
    copy: "Ici, tu passes à l'action. Tu ajoutes des tâches à un projet, tu les priorises, et tu vois ce qui avance ou bloque. Chaque tâche peut se relier à ton backlog et à ton temps.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "notes",
    route: "/notes",
    highlightSelector: "[data-testid='notes-list'], .notes-container, main",
    placement: "bottom",
    copy: "Ici, tu poses tout ce que tu as en tête : idées, décisions, comptes rendus. Tu peux organiser tes notes et les regrouper par projet pour garder le contexte au bon endroit.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "backlog",
    route: "/product",
    highlightSelector: "[data-testid='backlog-board'], .backlog-container, main",
    placement: "bottom",
    copy: "Ici, tu découpes le travail avant de le lancer. Épics, tickets, sprints : tu structures ton périmètre pour garder le contrôle. Les tickets peuvent être liés au projet, au temps et aux tâches.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "roadmap",
    route: "/roadmap",
    highlightSelector: "[data-testid='roadmap-view'], .roadmap-container, main",
    placement: "bottom",
    copy: "Ici, je te fais prendre de la hauteur. Tu visualises les étapes, les priorités et les dépendances dans le temps. Ta roadmap peut connecter des épics, des tickets, des jalons projet… ou des blocs libres.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "finance",
    route: "/finance",
    highlightSelector: "[data-testid='finance-dashboard'], .finance-container, main",
    placement: "bottom",
    copy: "Ici, tu vois si tes projets sont vraiment sains. Je croise ton budget, ton temps passé et ton avancement pour t'aider à décider : ajuster ton TJM, accélérer, ou apprendre pour les prochains projets.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "complete",
    route: "/",
    placement: "center",
    copy: "Voilà. Tu as une vision claire de comment tout s'imbrique. Je reste là si tu as besoin d'aide, mais maintenant, c'est toi qui pilotes !",
    ctaPrimaryLabel: "Terminer",
  },
];

export function getStepById(id: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((step) => step.id === id);
}

export function getStepIndex(id: string): number {
  return ONBOARDING_STEPS.findIndex((step) => step.id === id);
}

export function getNextStep(currentId: string): OnboardingStep | undefined {
  const currentIndex = getStepIndex(currentId);
  if (currentIndex === -1 || currentIndex >= ONBOARDING_STEPS.length - 1) {
    return undefined;
  }
  return ONBOARDING_STEPS[currentIndex + 1];
}

export function isLastStep(id: string): boolean {
  return id === "complete";
}
