import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";
import { getProfileById, type UserProfileType } from "@shared/userProfiles";

interface ProjectTransitionProps {
  profileType: UserProfileType | null;
  onCreateProject: () => void;
  onSkip: () => void;
}

export function ProjectTransition({ profileType, onCreateProject, onSkip }: ProjectTransitionProps) {
  const profile = profileType ? getProfileById(profileType) : null;
  
  const title = profile?.transitionTitle || "Créons ton premier projet";
  const description = profile?.transitionDescription || "On va poser les bases pour suivre ton travail efficacement.";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-card rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Rocket className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-3">{title}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={onSkip}
            className="flex-1"
            data-testid="button-skip-project"
          >
            Plus tard
          </Button>
          <Button 
            onClick={onCreateProject} 
            className="flex-1"
            data-testid="button-create-first-project"
          >
            Créer mon premier projet
          </Button>
        </div>
      </div>
    </div>
  );
}
