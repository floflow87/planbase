import { celebrationService, CelebrationLevel } from "@/services/celebrationService";

export function useCelebration() {
  return {
    celebrate: (
      level: CelebrationLevel,
      options?: { label?: string; entityId?: string }
    ) => {
      celebrationService.trigger(level, options);
    },
  };
}
