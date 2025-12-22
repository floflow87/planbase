import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ModuleHelp } from "./faqs";

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
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/50"
        onClick={onClose}
        data-testid="help-drawer-overlay"
      />

      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[101] bg-card rounded-t-2xl shadow-xl max-h-[85vh] overflow-hidden flex flex-col",
          "sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:max-w-lg sm:max-h-[80vh]",
          !prefersReducedMotion && "animate-fade-in"
        )}
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
      </div>
    </>
  );
}
