import { useOnboarding, type OnboardingStep } from "@/contexts/OnboardingContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ArrowRight, ChevronRight } from "lucide-react";
import astronautAvatar from "@assets/E2C9617D-45A3-4B6C-AAFC-BE05B63ADC44_1764889729769.png";
import { motion, AnimatePresence } from "framer-motion";

interface StepContent {
  title?: string;
  text: string;
  link?: string;
  actions: {
    label: string;
    action: "next" | "navigate" | "complete" | "skip";
    target?: OnboardingStep;
    primary?: boolean;
  }[];
}

const STEP_CONTENT: Record<NonNullable<OnboardingStep>, StepContent> = {
  welcome: {
    text: `Salut 👋
Je vais t'aider à prendre Planbase en main.
Ici, tout est connecté : clients, projets, temps, tâches, rentabilité.
On ne va pas tout voir d'un coup — je te guide, pas à pas.`,
    actions: [
      { label: "Commencer", action: "next", primary: true },
      { label: "Plus tard", action: "skip" }
    ]
  },
  dashboard: {
    text: `Ici, tu commences toujours par un coup d'œil.
Tu vois tes principaux KPIs, ce qui avance, ce qui bloque, et ce qui mérite ton attention aujourd'hui.

Chaque chiffre vient de tes projets, de ton temps et de tes tâches.
Rien n'est isolé ici.`,
    actions: [
      { label: "Aller voir le CRM", action: "navigate", target: "crm", primary: true },
      { label: "Voir un projet", action: "navigate", target: "project" },
      { label: "Suivant", action: "next" }
    ]
  },
  crm: {
    text: `Ici, tu ajoutes tes clients et tu suis ton pipe d'opportunités.
Tu peux personnaliser les étapes pour qu'elles collent vraiment à ta façon de travailler.

Quand une opportunité devient concrète, tu peux la transformer en projet — sans ressaisie.`,
    link: "👉 Ce que tu fais ici alimente directement tes projets et ta rentabilité.",
    actions: [
      { label: "Créer un projet", action: "navigate", target: "project", primary: true },
      { label: "Suivant", action: "next" }
    ]
  },
  project: {
    text: `Ici, tout se rejoint.
Un projet relie un client, un budget, un périmètre et un objectif.

À partir d'un projet, tu pilotes le temps, les tâches, le backlog et la rentabilité.`,
    link: "👉 C'est le point de départ de tout le reste.",
    actions: [
      { label: "Suivre le temps", action: "navigate", target: "time-tracker", primary: true },
      { label: "Voir les tâches", action: "navigate", target: "tasks" },
      { label: "Suivant", action: "next" }
    ]
  },
  "time-tracker": {
    text: `Ici, tu enregistres chaque temps passé sur un projet.
Tu peux le lier à une tâche, un ticket ou une étape du cahier des charges.

Plus tu saisis ton temps, plus je peux t'aider à anticiper, ajuster et décider.`,
    link: "👉 Le temps nourrit directement la rentabilité et les recommandations.",
    actions: [
      { label: "Voir les tâches", action: "navigate", target: "tasks", primary: true },
      { label: "Suivant", action: "next" }
    ]
  },
  tasks: {
    text: `Ici, tu passes à l'action.
Tu ajoutes des tâches à un projet, tu les priorises et tu vois ce qui avance ou bloque.

Une tâche peut être liée à un projet, un client ou un ticket du backlog.`,
    link: "👉 Chaque tâche a un impact visible sur l'avancement global.",
    actions: [
      { label: "Voir les notes", action: "navigate", target: "notes", primary: true },
      { label: "Suivant", action: "next" }
    ]
  },
  notes: {
    text: `Ici, tu poses tout ce que tu as en tête.
Idées, décisions, comptes rendus.

Tu peux organiser tes notes et les regrouper par projet pour garder le contexte au bon endroit.`,
    link: "👉 Les notes donnent du sens à tes projets et à tes décisions.",
    actions: [
      { label: "Voir le backlog", action: "navigate", target: "backlog", primary: true },
      { label: "Suivant", action: "next" }
    ]
  },
  backlog: {
    text: `Ici, tu découpes le travail avant de le lancer.
Tu structures ton périmètre en épics, tickets et sprints pour garder le contrôle.

Chaque ticket peut être relié au projet, au temps passé et aux tâches.`,
    link: "👉 Le backlog t'évite les dérives invisibles.",
    actions: [
      { label: "Voir la roadmap", action: "navigate", target: "roadmap", primary: true },
      { label: "Suivant", action: "next" }
    ]
  },
  roadmap: {
    text: `Ici, tu prends de la hauteur.
Tu visualises les grandes étapes, les priorités et les dépendances dans le temps.

Ta roadmap peut connecter des épics, des tickets ou des jalons projet.`,
    link: "👉 Elle t'aide à décider ce que tu fais maintenant… et ce que tu assumes de faire plus tard.",
    actions: [
      { label: "Voir la rentabilité", action: "navigate", target: "finance", primary: true },
      { label: "Suivant", action: "next" }
    ]
  },
  finance: {
    text: `Ici, tu vois si tes projets sont vraiment sains.
Je croise ton budget, ton temps passé et ton avancement pour t'aider à décider.

Je peux te dire quand ajuster ton TJM, accélérer ou apprendre pour les prochains projets.`,
    link: "👉 Tout ce que tu fais ailleurs se reflète ici.",
    actions: [
      { label: "Terminer la visite", action: "complete", primary: true }
    ]
  },
  complete: {
    text: `Voilà.
Tu as maintenant une vision claire de comment tout s'imbrique.

Je reste là si tu as besoin d'aide, mais maintenant, c'est toi qui pilotes 🚀`,
    actions: [
      { label: "C'est parti !", action: "complete", primary: true }
    ]
  }
};

export function OnboardingAvatar() {
  const { currentStep, isOnboardingActive, nextStep, goToStep, skipOnboarding, completeOnboarding } = useOnboarding();

  if (!isOnboardingActive || !currentStep) return null;

  const content = STEP_CONTENT[currentStep];
  if (!content) return null;

  const handleAction = (action: StepContent["actions"][0]) => {
    switch (action.action) {
      case "next":
        nextStep();
        break;
      case "navigate":
        if (action.target) goToStep(action.target);
        break;
      case "complete":
        completeOnboarding();
        break;
      case "skip":
        skipOnboarding();
        break;
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/30 z-[998] pointer-events-auto"
        onClick={skipOnboarding}
        data-testid="onboarding-overlay"
      />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-4 right-4 z-[999] flex items-end gap-3 max-w-md"
          data-testid="onboarding-container"
        >
          <Card className="p-4 shadow-xl border-primary/20 bg-card relative">
            <button
              onClick={skipOnboarding}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
              data-testid="button-close-onboarding"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            
            <div className="pr-6">
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed" data-testid="text-onboarding-content">
                {content.text}
              </p>
              
              {content.link && (
                <p className="text-sm text-primary font-medium mt-3" data-testid="text-onboarding-link">
                  {content.link}
                </p>
              )}
              
              <div className="flex flex-wrap gap-2 mt-4">
                {content.actions.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.primary ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleAction(action)}
                    className="gap-1"
                    data-testid={`button-onboarding-${action.action}-${index}`}
                  >
                    {action.label}
                    {action.primary && <ChevronRight className="w-4 h-4" />}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
          
          <motion.img
            src={astronautAvatar}
            alt="Planbase Assistant"
            className="w-20 h-20 object-contain flex-shrink-0"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            data-testid="img-onboarding-avatar"
          />
        </motion.div>
      </AnimatePresence>
    </>
  );
}
