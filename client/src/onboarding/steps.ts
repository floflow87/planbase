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
    copy: "Salut ! Je vais t'aider a prendre Planbase en main. Ici, tout est connecte : clients, projets, temps, taches, rentabilite. On ne va pas tout voir d'un coup - je te guide, pas a pas.",
    ctaPrimaryLabel: "C'est parti",
    ctaSecondaryLabel: "Plus tard",
  },
  {
    id: "dashboard",
    route: "/",
    highlightSelector: "[data-testid='dashboard-kpis'], .dashboard-stats, main",
    placement: "bottom",
    copy: "Ici, tu commences toujours par un coup d'oeil. Tu vois tes principaux KPIs, ce qui avance, ce qui bloque, et ce qui merite ton attention aujourd'hui. Chaque chiffre vient de tes projets, de ton temps et de tes taches. Rien n'est isole.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "crm",
    route: "/crm",
    highlightSelector: "[data-testid='kanban-board']",
    placement: "top",
    copy: "Ici, tu ajoutes tes clients et tu suis ton pipe d'opportunites. Tu peux personnaliser les etapes pour qu'elles collent a ta facon de travailler. Quand une opportunite devient concrete, tu la transformes en projet - sans ressaisie.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "project",
    route: "/projects",
    highlightSelector: "[data-testid='projects-list']",
    placement: "top",
    copy: "Ici, tout se rejoint. Un projet relie un client, un budget, un perimetre et un objectif. A partir d'un projet, tu pilotes le temps, les taches, le backlog et la rentabilite.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "time-tracker",
    route: "/projects",
    highlightSelector: "[data-testid='time-tracker'], .time-entries, main",
    placement: "top",
    copy: "Ici, tu enregistres chaque temps passe sur un projet. Tu peux le lier a une tache, un ticket ou une etape du cahier des charges. Plus tu saisis ton temps, plus je peux t'aider a anticiper et te proposer des recommandations utiles.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "tasks",
    route: "/tasks",
    highlightSelector: "[data-testid='tasks-board'], .kanban-board, main",
    placement: "bottom",
    copy: "Ici, tu passes a l'action. Tu ajoutes des taches a un projet, tu les priorises, et tu vois ce qui avance ou bloque. Chaque tache peut se relier a ton backlog et a ton temps.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "notes",
    route: "/notes",
    highlightSelector: "[data-testid='notes-list'], .notes-container, main",
    placement: "bottom",
    copy: "Ici, tu poses tout ce que tu as en tete : idees, decisions, comptes rendus. Tu peux organiser tes notes et les regrouper par projet pour garder le contexte au bon endroit.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "backlog",
    route: "/product",
    highlightSelector: "[data-testid='backlog-board'], .backlog-container, main",
    placement: "bottom",
    copy: "Ici, tu decoupes le travail avant de le lancer. Epics, tickets, sprints : tu structures ton perimetre pour garder le controle. Les tickets peuvent etre lies au projet, au temps et aux taches.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "roadmap",
    route: "/roadmap",
    highlightSelector: "[data-testid='roadmap-view'], .roadmap-container, main",
    placement: "bottom",
    copy: "Ici, je te fais prendre de la hauteur. Tu visualises les etapes, les priorites et les dependances dans le temps. Ta roadmap peut connecter des epics, des tickets, des jalons projet... ou des blocs libres.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "profitability",
    route: "/finance",
    highlightSelector: "[data-testid='page-finance'], main",
    placement: "bottom",
    copy: "Ici, tu vois si tes projets sont vraiment sains. Je croise ton budget, ton temps passe et ton avancement pour t'aider a decider : ajuster ton TJM, accelerer, ou apprendre pour les prochains projets.",
    ctaPrimaryLabel: "Suivant",
    ctaSecondaryLabel: "Passer",
  },
  {
    id: "complete",
    route: "/",
    placement: "center",
    copy: "Voila. Tu as une vision claire de comment tout s'imbrique. Je reste la si tu as besoin d'aide, mais maintenant, c'est toi qui pilotes !",
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
