import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Spotlight } from "./Spotlight";
import { AvatarCompanion, type AvatarMood } from "./AvatarCompanion";
import { WelcomeScreen } from "./WelcomeScreen";
import { ProfileSelector } from "./ProfileSelector";
import { ProjectTransition } from "./ProjectTransition";
import { GuidedProjectCreation } from "./GuidedProjectCreation";
import { ONBOARDING_STEPS, ONBOARDING_VERSION, getStepById, getNextStep, isLastStep, type OnboardingStep } from "./steps";

import type { UserOnboarding, User } from "@shared/schema";
import type { UserProfileType } from "@shared/userProfiles";

function getMoodForStep(stepId: string): AvatarMood {
  if (stepId === "welcome") return "waving";
  if (stepId === "complete") return "celebrating";
  return "neutral";
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingOverlay() {
  const [location, setLocation] = useLocation();
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isElementReady, setIsElementReady] = useState(false);
  const lastNavigatedStepRef = useRef<string | null>(null);
  const [selectedProfileType, setSelectedProfileType] = useState<UserProfileType | null>(null);

  const { data: onboardingData, isLoading } = useQuery<UserOnboarding>({
    queryKey: ["/api/onboarding"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const { data: userData } = useQuery<User>({
    queryKey: ["/api/me"],
    retry: false,
  });

  const progressMutation = useMutation({
    mutationFn: async (lastStep: string) => {
      await apiRequest("/api/onboarding/progress", "POST", { lastStep });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/onboarding/complete", "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      setIsActive(false);
      setCurrentStepId(null);
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/onboarding/skip", "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      setIsActive(false);
      setCurrentStepId(null);
    },
    onError: (error) => {
      console.error("Error skipping onboarding:", error);
    },
  });

  useEffect(() => {
    if (userData?.profile && typeof userData.profile === 'object' && 'type' in userData.profile) {
      setSelectedProfileType((userData.profile as { type: UserProfileType }).type);
    }
  }, [userData]);

  useEffect(() => {
    if (!isLoading && onboardingData) {
      if (onboardingData.completed || onboardingData.skipped) {
        setIsActive(false);
        setCurrentStepId(null);
      } else if (onboardingData.version === ONBOARDING_VERSION) {
        if (onboardingData.lastStep) {
          const step = getStepById(onboardingData.lastStep);
          if (step) {
            setCurrentStepId(onboardingData.lastStep);
            setIsActive(true);
          } else {
            setCurrentStepId("welcome");
            setIsActive(true);
          }
        } else {
          setCurrentStepId("welcome");
          setIsActive(true);
        }
      }
    }
  }, [isLoading, onboardingData]);

  const currentStep = currentStepId ? getStepById(currentStepId) : null;

  useEffect(() => {
    if (!isActive || !currentStep) return;

    if (currentStep.isCustomScreen) {
      setIsElementReady(true);
      return;
    }

    if (lastNavigatedStepRef.current !== currentStep.id && location !== currentStep.route) {
      lastNavigatedStepRef.current = currentStep.id;
      setLocation(currentStep.route);
    }

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
      }, 3000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [isActive, currentStep, location, setLocation]);

  const goToStep = useCallback((stepId: string) => {
    progressMutation.mutate(stepId);
    setCurrentStepId(stepId);
    setIsElementReady(false);
  }, [progressMutation]);

  const handleNext = useCallback(() => {
    if (!currentStepId) return;

    if (isLastStep(currentStepId)) {
      completeMutation.mutate();
      return;
    }

    const nextStep = getNextStep(currentStepId);
    if (nextStep) {
      goToStep(nextStep.id);
    }
  }, [currentStepId, goToStep, completeMutation]);

  const handleSkip = useCallback(() => {
    skipMutation.mutate();
  }, [skipMutation]);

  const handleLater = useCallback(() => {
    setIsActive(false);
    setCurrentStepId(null);
  }, []);

  const handleWelcomeContinue = useCallback(() => {
    goToStep("profile");
  }, [goToStep]);

  const handleProfileSelected = useCallback((profileType: UserProfileType) => {
    setSelectedProfileType(profileType);
    goToStep("project-transition");
  }, [goToStep]);

  const handleProfileSkip = useCallback(() => {
    goToStep("project-transition");
  }, [goToStep]);

  const handleProjectTransitionCreate = useCallback(() => {
    goToStep("guided-project");
  }, [goToStep]);

  const handleProjectTransitionSkip = useCallback(() => {
    goToStep("dashboard");
  }, [goToStep]);

  const handleProjectCreationComplete = useCallback((projectId: string) => {
    setLocation(`/projects/${projectId}`);
    goToStep("dashboard");
  }, [goToStep, setLocation]);

  const handleProjectCreationBack = useCallback(() => {
    goToStep("project-transition");
  }, [goToStep]);

  if (!isActive || !currentStep || !isElementReady) {
    return null;
  }

  if (currentStep.id === "welcome") {
    return <WelcomeScreen onContinue={handleWelcomeContinue} />;
  }

  if (currentStep.id === "profile") {
    return (
      <ProfileSelector
        onProfileSelected={handleProfileSelected}
        onSkip={handleProfileSkip}
      />
    );
  }

  if (currentStep.id === "project-transition") {
    return (
      <ProjectTransition
        profileType={selectedProfileType}
        onCreateProject={handleProjectTransitionCreate}
        onSkip={handleProjectTransitionSkip}
      />
    );
  }

  if (currentStep.id === "guided-project") {
    return (
      <GuidedProjectCreation
        profileType={selectedProfileType}
        onComplete={handleProjectCreationComplete}
        onBack={handleProjectCreationBack}
      />
    );
  }

  const showSpotlight = currentStep.highlightSelector && currentStep.placement !== "center";

  return (
    <>
      <Spotlight
        targetSelector={currentStep.highlightSelector}
        isActive={showSpotlight || false}
      />

      <div
        className={!showSpotlight ? "fixed inset-0 z-[9998] bg-black/60 pointer-events-none" : ""}
      />

      <AvatarCompanion
        message={currentStep.copy}
        isVisible={true}
        placement={showSpotlight ? "spotlight" : "bottom-right"}
        spotlightRect={targetRect || undefined}
        tooltipPlacement={currentStep.placement}
        mood={getMoodForStep(currentStep.id)}
        primaryAction={{
          label: currentStep.ctaPrimaryLabel,
          onClick: handleNext,
        }}
        secondaryAction={
          currentStep.ctaSecondaryLabel === "Passer"
            ? { label: "Passer", onClick: handleSkip }
            : currentStep.ctaSecondaryLabel === "Plus tard"
            ? { label: "Plus tard", onClick: handleLater }
            : undefined
        }
        tertiaryAction={
          currentStep.id !== "welcome" && currentStep.id !== "complete" && currentStep.id !== "profile"
            ? { label: "Plus tard", onClick: handleLater }
            : undefined
        }
      />
    </>
  );
}
