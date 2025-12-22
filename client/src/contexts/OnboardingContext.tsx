import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import type { UserOnboarding } from "@shared/schema";

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
  isLoading: boolean;
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
  const { user, loading: authLoading } = useAuth();

  // Fetch onboarding state from API - only when user is authenticated
  const { data: onboardingData, isLoading } = useQuery<UserOnboarding>({
    queryKey: ["/api/onboarding"],
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!user && !authLoading, // Only fetch when user is authenticated
  });

  // Mutation to update progress
  const progressMutation = useMutation({
    mutationFn: async (lastStep: string) => {
      await apiRequest("POST", "/api/onboarding/progress", { lastStep });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  // Mutation to complete onboarding
  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/complete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  // Mutation to skip onboarding
  const skipMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/skip");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  // Mutation to reset onboarding
  const resetMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/reset");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  // Initialize onboarding state from API data
  useEffect(() => {
    if (!isLoading && onboardingData) {
      // If onboarding is completed or skipped, don't show it
      if (onboardingData.completed || onboardingData.skipped) {
        setIsOnboardingActive(false);
        setCurrentStep(null);
      } else if (!onboardingData.completed && !onboardingData.skipped) {
        // User hasn't completed onboarding - check if they have a saved step
        if (onboardingData.lastStep) {
          // Resume from last step
          setCurrentStep(onboardingData.lastStep as OnboardingStep);
          setIsOnboardingActive(true);
        } else {
          // First time - start onboarding
          setCurrentStep("welcome");
          setIsOnboardingActive(true);
        }
      }
    }
  }, [isLoading, onboardingData]);

  const startOnboarding = useCallback(() => {
    // Reset onboarding in backend and start fresh
    resetMutation.mutate(undefined, {
      onSuccess: () => {
        setCurrentStep("welcome");
        setIsOnboardingActive(true);
        setLocation("/");
      },
    });
  }, [setLocation, resetMutation]);

  const nextStep = useCallback(() => {
    if (!currentStep) return;
    
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      const nextStepValue = ONBOARDING_STEPS[currentIndex + 1];
      setCurrentStep(nextStepValue);
      
      // Save progress to backend
      if (nextStepValue) {
        progressMutation.mutate(nextStepValue);
      }
      
      if (nextStepValue && STEP_TO_ROUTE[nextStepValue]) {
        setLocation(STEP_TO_ROUTE[nextStepValue]);
      }
    }
  }, [currentStep, setLocation, progressMutation]);

  const goToStep = useCallback((step: OnboardingStep) => {
    setCurrentStep(step);
    if (step) {
      progressMutation.mutate(step);
    }
    if (step && STEP_TO_ROUTE[step]) {
      setLocation(STEP_TO_ROUTE[step]);
    }
  }, [setLocation, progressMutation]);

  const skipOnboarding = useCallback(() => {
    skipMutation.mutate(undefined, {
      onSuccess: () => {
        setIsOnboardingActive(false);
        setCurrentStep(null);
      },
    });
  }, [skipMutation]);

  const completeOnboarding = useCallback(() => {
    completeMutation.mutate(undefined, {
      onSuccess: () => {
        setIsOnboardingActive(false);
        setCurrentStep(null);
      },
    });
  }, [completeMutation]);

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
        toggleContextualHelp,
        isLoading,
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
