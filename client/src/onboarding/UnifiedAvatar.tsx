import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Spotlight } from "./Spotlight";
import { AvatarCompanion, type AvatarMood } from "./AvatarCompanion";
import { ONBOARDING_VERSION, getStepById, getNextStep, isLastStep, getPreviousStep, getStepIndex, getTotalSteps } from "./steps";
import { HelpDrawer } from "@/help/HelpDrawer";
import { getModuleIdFromPath, getModuleHelp, MODULE_HELP } from "@/help/faqs";
import { HelpCircle } from "lucide-react";

import type { UserOnboarding } from "@shared/schema";

function getMoodForStep(stepId: string): AvatarMood {
  if (stepId === "intro") return "waving";
  if (stepId === "complete") return "celebrating";
  return "neutral";
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function UnifiedAvatar() {
  const [location, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isElementReady, setIsElementReady] = useState(false);
  const lastNavigatedStepRef = useRef<string | null>(null);
  
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const { data: onboardingData, isLoading } = useQuery<UserOnboarding>({
    queryKey: ["/api/onboarding"],
    retry: false,
    staleTime: 1000 * 60 * 5,
    enabled: !!user && !authLoading, // Only fetch when user is authenticated
  });

  const progressMutation = useMutation({
    mutationFn: async (lastStep: string) => {
      await apiRequest("POST", "/api/onboarding/progress", { lastStep });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/complete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      setIsOnboardingActive(false);
      setCurrentStepId(null);
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/skip");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      setIsOnboardingActive(false);
      setCurrentStepId(null);
    },
  });

  useEffect(() => {
    if (!isLoading && onboardingData) {
      if (onboardingData.completed || onboardingData.skipped) {
        setIsOnboardingActive(false);
        setCurrentStepId(null);
      } else if (onboardingData.version === ONBOARDING_VERSION) {
        if (onboardingData.lastStep) {
          const step = getStepById(onboardingData.lastStep);
          if (step) {
            setCurrentStepId(onboardingData.lastStep);
            setIsOnboardingActive(true);
          } else {
            setCurrentStepId("intro");
            setIsOnboardingActive(true);
          }
        } else {
          setCurrentStepId("intro");
          setIsOnboardingActive(true);
        }
      }
    }
  }, [isLoading, onboardingData]);

  const currentStep = currentStepId ? getStepById(currentStepId) : null;

  useEffect(() => {
    if (!isOnboardingActive || !currentStep) return;

    // Navigate to the step's route if we're not already there
    if (location !== currentStep.route) {
      lastNavigatedStepRef.current = currentStep.id;
      setLocation(currentStep.route);
      // Don't wait for element yet, let navigation complete first
      return;
    }

    // We're on the correct route, now wait for element
    if (!currentStep.highlightSelector) {
      setIsElementReady(true);
      return;
    }

    setIsElementReady(false);

    const waitForElement = () => {
      const selectors = currentStep.highlightSelector!.split(",").map((s) => s.trim());
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          const padding = 8;
          setTargetRect({
            top: rect.top - padding + window.scrollY,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
          });
          setIsElementReady(true);
          return true;
        }
      }
      return false;
    };

    if (!waitForElement()) {
      const interval = setInterval(() => {
        if (waitForElement()) {
          clearInterval(interval);
        }
      }, 200);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        setIsElementReady(true);
      }, 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [isOnboardingActive, currentStep, location, setLocation]);

  const handleNext = useCallback(() => {
    if (!currentStepId) return;

    if (isLastStep(currentStepId)) {
      completeMutation.mutate();
      return;
    }

    const nextStep = getNextStep(currentStepId);
    if (nextStep) {
      progressMutation.mutate(nextStep.id);
      setCurrentStepId(nextStep.id);
      setIsElementReady(false);
    }
  }, [currentStepId, progressMutation, completeMutation]);

  const handleSkip = useCallback(() => {
    skipMutation.mutate();
  }, [skipMutation]);

  const handleLater = useCallback(() => {
    setIsOnboardingActive(false);
    setCurrentStepId(null);
  }, []);

  const handlePrevious = useCallback(() => {
    if (!currentStepId) return;
    const prevStep = getPreviousStep(currentStepId);
    if (prevStep) {
      progressMutation.mutate(prevStep.id);
      setCurrentStepId(prevStep.id);
      setIsElementReady(false);
    }
  }, [currentStepId, progressMutation]);

  const handleAvatarClick = useCallback(() => {
    setIsHelpOpen(true);
  }, []);

  const moduleId = getModuleIdFromPath(location);
  const moduleHelp = moduleId ? getModuleHelp(moduleId) : MODULE_HELP.dashboard;
  const effectiveModuleHelp = moduleHelp || MODULE_HELP.dashboard;

  // Don't render on auth pages or when user is not authenticated
  const isOnLoginOrSignup = location === "/login" || location === "/signup";
  if (isOnLoginOrSignup || !user) return null;

  const showOnboardingOverlay = isOnboardingActive && currentStep && isElementReady;
  const showSpotlight = showOnboardingOverlay && currentStep?.highlightSelector && currentStep?.placement !== "center";

  return (
    <>
      {showOnboardingOverlay && (
        <>
          {showSpotlight ? (
            <Spotlight
              targetSelector={currentStep.highlightSelector}
              isActive={true}
              onClickOutside={handleLater}
            />
          ) : (
            <div
              onClick={handleLater}
              className="fixed inset-0 z-[9998] bg-black/60 cursor-pointer"
            />
          )}

          <AvatarCompanion
            message={currentStep.copy}
            isVisible={true}
            placement={showSpotlight ? "spotlight" : "bottom-right"}
            spotlightRect={targetRect || undefined}
            tooltipPlacement={currentStep.placement}
            mood={getMoodForStep(currentStep.id)}
            stepTitle={currentStep.title}
            primaryAction={{
              label: currentStep.ctaPrimaryLabel,
              onClick: handleNext,
            }}
            secondaryAction={
              currentStep.ctaSecondaryLabel === "Passer"
                ? { label: "Passer", onClick: handleSkip }
                : undefined
            }
            onClose={
              currentStep.id !== "complete"
                ? handleLater
                : undefined
            }
            previousAction={
              currentStepId && currentStepId !== "intro"
                ? { label: "Préc.", onClick: handlePrevious }
                : undefined
            }
            currentStep={currentStepId ? getStepIndex(currentStepId) : 0}
            totalSteps={getTotalSteps()}
          />

        </>
      )}


      <HelpDrawer
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        moduleHelp={effectiveModuleHelp}
      />
    </>
  );
}
