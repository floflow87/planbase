import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface WelcomeScreenProps {
  onContinue: () => void;
}

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-card rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold mb-3">Bienvenue sur PlanBase</h1>
          <p className="text-muted-foreground leading-relaxed">
            PlanBase t'aide à structurer ton travail, piloter tes projets et prendre de meilleures décisions au quotidien.
          </p>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            Avant de commencer, on va juste te poser deux questions pour adapter l'expérience à ta façon de travailler.
          </p>
        </div>

        <Button 
          onClick={onContinue} 
          size="lg" 
          className="w-full"
          data-testid="button-welcome-continue"
        >
          Continuer
        </Button>
      </div>
    </div>
  );
}
