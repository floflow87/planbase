import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useLocation } from "wouter";

export type OnboardingStep = 
  | "welcome"
  | "dashboard"
  | "crm"
  | "project"
  | "time-tracker"
  | "tasks"
  | "notes"
  | "backlog"
  | "roadmap"
  | "finance"
  | "complete"
  | null;

interface OnboardingContextType {
  currentStep: OnboardingStep;
  isOnboardingActive: boolean;
  startOnboarding: () => void;
  nextStep: () => void;
  skipOnboarding: () => void;
  goToStep: (step: OnboardingStep) => void;
  completeOnboarding: () => void;
  showContextualHelp: boolean;
  toggleContextualHelp: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const ONBOARDING_STEPS: OnboardingStep[] = [
  "welcome",
  "dashboard",
  "crm",
  "project",
  "time-tracker",
  "tasks",
  "notes",
  "backlog",
  "roadmap",
  "finance",
  "complete"
];

const STEP_TO_ROUTE: Record<NonNullable<OnboardingStep>, string> = {
  "welcome": "/",
  "dashboard": "/",
  "crm": "/crm",
  "project": "/projects",
  "time-tracker": "/projects",
  "tasks": "/tasks",
  "notes": "/notes",
  "backlog": "/product",
  "roadmap": "/roadmap",
  "finance": "/finance",
  "complete": "/"
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(null);
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [showContextualHelp, setShowContextualHelp] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem("planbase_onboarding_completed");
    const isFirstVisit = !localStorage.getItem("planbase_visited");
    
    if (isFirstVisit && !hasCompletedOnboarding) {
      localStorage.setItem("planbase_visited", "true");
      setCurrentStep("welcome");
      setIsOnboardingActive(true);
    }
  }, []);

  const startOnboarding = useCallback(() => {
    setCurrentStep("welcome");
    setIsOnboardingActive(true);
    setLocation("/");
  }, [setLocation]);

  const nextStep = useCallback(() => {
    if (!currentStep) return;
    
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      const nextStepValue = ONBOARDING_STEPS[currentIndex + 1];
      setCurrentStep(nextStepValue);
      
      if (nextStepValue && STEP_TO_ROUTE[nextStepValue]) {
        setLocation(STEP_TO_ROUTE[nextStepValue]);
      }
    }
  }, [currentStep, setLocation]);

  const goToStep = useCallback((step: OnboardingStep) => {
    setCurrentStep(step);
    if (step && STEP_TO_ROUTE[step]) {
      setLocation(STEP_TO_ROUTE[step]);
    }
  }, [setLocation]);

  const skipOnboarding = useCallback(() => {
    setIsOnboardingActive(false);
    setCurrentStep(null);
  }, []);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem("planbase_onboarding_completed", "true");
    setIsOnboardingActive(false);
    setCurrentStep(null);
  }, []);

  const toggleContextualHelp = useCallback(() => {
    setShowContextualHelp(prev => !prev);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        isOnboardingActive,
        startOnboarding,
        nextStep,
        skipOnboarding,
        goToStep,
        completeOnboarding,
        showContextualHelp,
        toggleContextualHelp
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
