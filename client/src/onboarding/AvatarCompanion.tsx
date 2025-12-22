import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AvatarCompanionProps {
  message?: string;
  isVisible: boolean;
  placement?: "bottom-right" | "spotlight";
  spotlightRect?: { top: number; left: number; width: number; height: number };
  tooltipPlacement?: "top" | "bottom" | "left" | "right" | "center";
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  tertiaryAction?: { label: string; onClick: () => void };
}

export function AvatarCompanion({
  message,
  isVisible,
  placement = "bottom-right",
  spotlightRect,
  tooltipPlacement = "top",
  primaryAction,
  secondaryAction,
  tertiaryAction,
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
    if (placement === "spotlight" && spotlightRect && tooltipPlacement !== "center") {
      const padding = 16;
      const tooltipWidth = 320;
      const avatarSize = 56;

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
          return {};
      }
    }
    return {};
  };

  const tooltipStyle = placement === "spotlight" && tooltipPlacement !== "center" ? getTooltipPosition() : {};

  return (
    <>
      {placement === "bottom-right" && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-[9999] pointer-events-auto",
            !prefersReducedMotion && "animate-float"
          )}
          data-testid="avatar-companion"
        >
          <div
            className={cn(
              "w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg flex items-center justify-center text-white text-2xl cursor-pointer transition-transform",
              !prefersReducedMotion && isAnimating && "animate-bounce-in",
              !prefersReducedMotion && "hover:scale-105"
            )}
          >
            <span className="select-none">P</span>
          </div>
        </div>
      )}

      {message && (
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
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white text-lg flex-shrink-0",
                    !prefersReducedMotion && "animate-float-subtle"
                  )}
                >
                  <span className="select-none">P</span>
                </div>
                <span className="font-medium text-foreground">Planbase</span>
              </div>
            )}

            <p className="text-sm text-foreground leading-relaxed mb-4">
              {message}
            </p>

            <div className="flex flex-wrap gap-2">
              {primaryAction && (
                <button
                  onClick={primaryAction.onClick}
                  className="flex-1 min-w-[100px] px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover-elevate active-elevate-2 transition-colors"
                  data-testid="onboarding-primary-action"
                >
                  {primaryAction.label}
                </button>
              )}
              {secondaryAction && (
                <button
                  onClick={secondaryAction.onClick}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium text-sm hover-elevate active-elevate-2 transition-colors"
                  data-testid="onboarding-secondary-action"
                >
                  {secondaryAction.label}
                </button>
              )}
              {tertiaryAction && (
                <button
                  onClick={tertiaryAction.onClick}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
                  data-testid="onboarding-tertiary-action"
                >
                  {tertiaryAction.label}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
