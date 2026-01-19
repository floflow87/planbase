import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ModuleHelp } from "./faqs";
import avatarNeutral from "@assets/899AB3E8-58FE-4555-8E35-19571A40EDA5_1766391167518.png";

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  moduleHelp: ModuleHelp;
}

export function HelpDrawer({ isOpen, onClose, moduleHelp }: HelpDrawerProps) {
  const [, setLocation] = useLocation();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleCtaClick = () => {
    if (moduleHelp.ctaAction) {
      if (moduleHelp.ctaAction.startsWith("/")) {
        setLocation(moduleHelp.ctaAction);
      } else {
        const actionButton = document.querySelector(`[data-testid="button-${moduleHelp.ctaAction}"]`);
        if (actionButton instanceof HTMLElement) {
          onClose();
          setTimeout(() => actionButton.click(), 100);
          return;
        }
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[1000] bg-black/50"
        onClick={onClose}
        data-testid="help-drawer-overlay"
      />

      <div
        className={cn(
          "fixed top-0 right-0 bottom-0 z-[1001] bg-card shadow-xl w-full max-w-md overflow-hidden flex flex-col",
          "sm:w-96",
          !prefersReducedMotion && "animate-slide-in-right"
        )}
        style={{
          animation: prefersReducedMotion ? 'none' : 'slideInRight 0.3s ease-out forwards'
        }}
        data-testid="help-drawer"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white text-lg flex-shrink-0">
              <span className="select-none">P</span>
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{moduleHelp.title}</h2>
              <p className="text-xs text-muted-foreground">{moduleHelp.avatarMessage}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="help-drawer-close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            {moduleHelp.summary}
          </p>

          <div className="space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Questions fréquentes
            </h3>
            {moduleHelp.faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-secondary/50 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-3 text-left hover-elevate"
                  data-testid={`faq-question-${index}`}
                >
                  <span className="text-sm font-medium text-foreground pr-4">
                    {faq.question}
                  </span>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-3 pb-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {moduleHelp.ctaLabel && (
          <div className="p-4 border-t border-border">
            <Button
              onClick={handleCtaClick}
              className="w-full"
              data-testid="help-drawer-cta"
            >
              {moduleHelp.ctaLabel}
            </Button>
          </div>
        )}

        {/* Avatar at bottom of panel */}
        <div className="p-4 border-t border-border flex justify-center">
          <div
            className={cn(
              "w-16 h-16 rounded-full",
              "bg-gradient-to-br from-violet-500 to-violet-600",
              "shadow-lg shadow-violet-500/30",
              "overflow-hidden",
              "border-2 border-white/20"
            )}
            data-testid="help-drawer-avatar"
          >
            <img
              src={avatarNeutral}
              alt="Assistant Planbase"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </>
  );
}
