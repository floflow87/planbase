import { useState } from "react";
import { useLocation } from "wouter";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpDrawer } from "./HelpDrawer";
import { getModuleIdFromPath, getModuleHelp } from "./faqs";

export function HelpButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  const moduleId = getModuleIdFromPath(location);
  const moduleHelp = moduleId ? getModuleHelp(moduleId) : undefined;

  if (!moduleHelp) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary/10 hover:bg-primary/20 text-primary shadow-lg"
        data-testid="help-button"
        aria-label="Aide"
      >
        <HelpCircle className="w-6 h-6" />
      </Button>

      <HelpDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        moduleHelp={moduleHelp}
      />
    </>
  );
}
