import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, X } from "lucide-react";
import avatarWaving from "@assets/E2C9617D-45A3-4B6C-AAFC-BE05B63ADC44_1766391167518.png";
import avatarCelebrating from "@assets/97FA848E-CB40-4ADC-9F33-36793D7CA0B1_1766391167518.png";
import avatarThinking from "@assets/4A1310C2-F869-4A53-A8DC-B871545DDB79_1766391167518.png";
import avatarNeutral from "@assets/899AB3E8-58FE-4555-8E35-19571A40EDA5_1766391167518.png";

export type AvatarMood = "waving" | "celebrating" | "thinking" | "neutral";

interface AvatarCompanionProps {
  message?: string;
  isVisible: boolean;
  placement?: "bottom-right" | "spotlight";
  spotlightRect?: { top: number; left: number; width: number; height: number };
  tooltipPlacement?: "top" | "bottom" | "left" | "right" | "center" | "top-right" | "top-left";
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  tertiaryAction?: { label: string; onClick: () => void };
  onClose?: () => void;
  previousAction?: { label: string; onClick: () => void };
  mood?: AvatarMood;
  onClick?: () => void;
  showTooltip?: boolean;
  currentStep?: number;
  totalSteps?: number;
}

const AVATAR_IMAGES: Record<AvatarMood, string> = {
  waving: avatarWaving,
  celebrating: avatarCelebrating,
  thinking: avatarThinking,
  neutral: avatarNeutral,
};

export function AvatarCompanion({
  message,
  isVisible,
  placement = "bottom-right",
  spotlightRect,
  tooltipPlacement = "top",
  primaryAction,
  secondaryAction,
  tertiaryAction,
  onClose,
  previousAction,
  mood = "neutral",
  onClick,
  showTooltip = true,
  currentStep,
  totalSteps,
}: AvatarCompanionProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isVisible, message]);

  if (!isVisible) return null;

  const getTooltipPosition = () => {
    if (placement === "spotlight" && tooltipPlacement !== "center") {
      const padding = 16;
      const tooltipWidth = 320;

      // Fallback position when spotlightRect is not available
      // Use sensible edge positions based on intended tooltipPlacement
      if (!spotlightRect) {
        const fallbackPadding = 100;
        switch (tooltipPlacement) {
          case "bottom":
            return {
              top: fallbackPadding,
              left: "50%",
              transform: "translateX(-50%)",
            };
          case "top":
            return {
              bottom: fallbackPadding,
              left: "50%",
              transform: "translateX(-50%)",
            };
          case "right":
            return {
              top: "50%",
              left: fallbackPadding,
              transform: "translateY(-50%)",
            };
          case "left":
            return {
              top: "50%",
              right: fallbackPadding,
              transform: "translateY(-50%)",
            };
          default:
            return {
              bottom: 100,
              right: 100,
            };
        }
      }

      switch (tooltipPlacement) {
        case "bottom":
          return {
            top: spotlightRect.top + spotlightRect.height + padding,
            left: Math.max(16, Math.min(spotlightRect.left + spotlightRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16)),
          };
        case "top":
          return {
            bottom: window.innerHeight - spotlightRect.top + padding,
            left: Math.max(16, Math.min(spotlightRect.left + spotlightRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16)),
          };
        case "top-right":
          return {
            top: Math.max(16, spotlightRect.top - padding),
            right: Math.max(16, window.innerWidth - spotlightRect.left - spotlightRect.width + padding),
          };
        case "top-left":
          return {
            top: Math.max(16, spotlightRect.top - padding),
            left: Math.max(16, spotlightRect.left + padding),
          };
        case "right":
          return {
            top: spotlightRect.top + spotlightRect.height / 2 - 80,
            left: spotlightRect.left + spotlightRect.width + padding,
          };
        case "left":
          return {
            top: spotlightRect.top + spotlightRect.height / 2 - 80,
            right: window.innerWidth - spotlightRect.left + padding,
          };
        default:
          return {
            bottom: 100,
            right: 100,
          };
      }
    }
    return {};
  };

  const tooltipStyle = placement === "spotlight" && tooltipPlacement !== "center" ? getTooltipPosition() : {};
  const avatarImage = AVATAR_IMAGES[mood];

  return (
    <>
      {placement === "bottom-right" && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-[9999] pointer-events-auto",
            !prefersReducedMotion && "animate-float"
          )}
          data-testid="avatar-companion"
          onClick={onClick}
        >
          <div
            className={cn(
              "w-16 h-16 rounded-full bg-card shadow-lg flex items-center justify-center cursor-pointer transition-transform overflow-hidden border-2 border-primary/20",
              !prefersReducedMotion && isAnimating && "animate-bounce-in",
              !prefersReducedMotion && "hover:scale-105"
            )}
          >
            <img
              src={avatarImage}
              alt="Planbase Assistant"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {message && showTooltip && (
        <div
          className={cn(
            "fixed z-[9999] pointer-events-auto",
            placement === "bottom-right" && "bottom-24 right-6",
            placement === "spotlight" && tooltipPlacement === "center" && "inset-0 flex items-center justify-center",
            !prefersReducedMotion && isAnimating && "animate-fade-in"
          )}
          style={tooltipStyle}
          data-testid="avatar-tooltip"
        >
          <div
            className={cn(
              "bg-card border border-border rounded-xl shadow-xl p-4 max-w-xs sm:max-w-sm",
              tooltipPlacement === "center" && "max-w-md"
            )}
          >
            {placement === "spotlight" && (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-16 h-16 rounded-[12px] bg-white dark:bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-primary",
                      !prefersReducedMotion && "animate-float-subtle"
                    )}
                  >
                    <img
                      src={avatarImage}
                      alt="Planbase Assistant"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="font-medium text-foreground">Planbase</span>
                </div>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                    data-testid="onboarding-close"
                    aria-label="Fermer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            <p className="text-sm text-foreground leading-relaxed mb-4">
              {message}
            </p>

            <div className="flex items-center gap-2">
              {secondaryAction && (
                <button
                  onClick={secondaryAction.onClick}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium text-sm hover-elevate active-elevate-2 transition-colors"
                  data-testid="onboarding-secondary-action"
                >
                  {secondaryAction.label}
                </button>
              )}
              <div className="flex-1" />
              {previousAction && (
                <button
                  onClick={previousAction.onClick}
                  className="flex items-center gap-1 px-3 py-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
                  data-testid="onboarding-previous-action"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {previousAction.label}
                </button>
              )}
              {primaryAction && (
                <button
                  onClick={primaryAction.onClick}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover-elevate active-elevate-2 transition-colors"
                  data-testid="onboarding-primary-action"
                >
                  {primaryAction.label}
                </button>
              )}
              {currentStep !== undefined && totalSteps !== undefined && (
                <span className="text-xs text-muted-foreground ml-2" data-testid="onboarding-step-counter">
                  {currentStep + 1}/{totalSteps}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
