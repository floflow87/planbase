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

const ONBOARDING_VERSION = "v1";

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
      await apiRequest("/api/onboarding/progress", "POST", { lastStep });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  // Mutation to complete onboarding
  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/onboarding/complete", "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  // Mutation to skip onboarding
  const skipMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/onboarding/skip", "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  // Flag to track if we're in reset mode (to prevent useEffect from overriding state)
  const [isResetting, setIsResetting] = useState(false);
  
  // Mutation to reset onboarding
  const resetMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/onboarding/reset", "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  // Initialize onboarding state from API data
  useEffect(() => {
    // Skip this effect if we're in the middle of resetting
    if (isResetting) return;
    
    if (!isLoading && onboardingData) {
      // If onboarding is completed or skipped, don't show it
      if (onboardingData.completed || onboardingData.skipped) {
        setIsOnboardingActive(false);
        setCurrentStep(null);
      } else if (!onboardingData.completed && !onboardingData.skipped) {
        // User hasn't completed onboarding - check version (null/undefined or matching version triggers onboarding)
        const shouldActivate = !onboardingData.version || onboardingData.version === ONBOARDING_VERSION;
        if (shouldActivate) {
          if (onboardingData.lastStep) {
            // Resume from last step
            setCurrentStep(onboardingData.lastStep as OnboardingStep);
            setIsOnboardingActive(true);
          } else {
            // First time - start onboarding
            setCurrentStep("welcome");
            setIsOnboardingActive(true);
          }
        } else {
          // Version mismatch - don't show onboarding
          setIsOnboardingActive(false);
          setCurrentStep(null);
        }
      }
    }
  }, [isLoading, onboardingData, isResetting]);

  const startOnboarding = useCallback(async () => {
    // Set resetting flag to prevent useEffect from interfering
    setIsResetting(true);
    
    try {
      // Reset onboarding in backend
      await resetMutation.mutateAsync(undefined);
      
      // Force refetch the onboarding data to ensure fresh state
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      const result = await queryClient.fetchQuery<UserOnboarding>({ 
        queryKey: ["/api/onboarding"],
        staleTime: 0  // Force fresh fetch
      });
      
      // Verify the reset was successful before activating
      if (result && !result.completed && !result.skipped) {
        setCurrentStep("welcome");
        setIsOnboardingActive(true);
        setLocation("/");
      }
      
      // Clear resetting flag only after data is confirmed fresh
      setIsResetting(false);
    } catch (error) {
      console.error("Failed to restart onboarding:", error);
      setIsResetting(false);
    }
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
