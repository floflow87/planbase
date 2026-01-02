import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Palette, Target, FolderKanban, Code, Terminal, Check } from "lucide-react";
import { USER_PROFILES, type UserProfileType } from "@shared/userProfiles";

const PROFILE_ICONS: Record<string, typeof Briefcase> = {
  Briefcase,
  Palette,
  Target,
  FolderKanban,
  Code,
  Terminal,
};

interface ProfileSelectorProps {
  onProfileSelected: (profileType: UserProfileType) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export function ProfileSelector({ onProfileSelected, onSkip, isLoading }: ProfileSelectorProps) {
  const [selectedProfile, setSelectedProfile] = useState<UserProfileType | null>(null);

  const saveProfileMutation = useMutation({
    mutationFn: async (profileType: UserProfileType) => {
      await apiRequest("/api/me/profile-type", "PATCH", { profileType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      if (selectedProfile) {
        onProfileSelected(selectedProfile);
      }
    },
  });

  const handleConfirm = () => {
    if (selectedProfile) {
      saveProfileMutation.mutate(selectedProfile);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-card rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold mb-2">Quel est ton rôle principal aujourd'hui ?</h2>
          <p className="text-muted-foreground text-sm">
            Cela nous permet d'utiliser les bons termes et de te montrer les informations les plus utiles en priorité.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {USER_PROFILES.map((profile) => {
            const IconComponent = PROFILE_ICONS[profile.icon] || Briefcase;
            const isSelected = selectedProfile === profile.id;
            
            return (
              <Card
                key={profile.id}
                className={`cursor-pointer transition-all hover-elevate ${
                  isSelected 
                    ? "ring-2 ring-primary bg-primary/5" 
                    : "hover:bg-accent/50"
                }`}
                onClick={() => setSelectedProfile(profile.id)}
                data-testid={`profile-option-${profile.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${isSelected ? "bg-primary/10" : "bg-muted"}`}>
                      <IconComponent className={`w-5 h-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{profile.label}</h3>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{profile.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center text-xs text-muted-foreground mb-4">
          Tu pourras modifier ce choix à tout moment dans les paramètres.
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onSkip}
            disabled={isLoading || saveProfileMutation.isPending}
            className="flex-1"
            data-testid="button-skip-profile"
          >
            Passer
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedProfile || isLoading || saveProfileMutation.isPending}
            className="flex-1"
            data-testid="button-confirm-profile"
          >
            {saveProfileMutation.isPending ? "Enregistrement..." : "Continuer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
