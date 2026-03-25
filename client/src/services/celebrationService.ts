export type CelebrationLevel = "micro" | "medium" | "major";

export interface CelebrationEvent {
  level: CelebrationLevel;
  label?: string;
  entityId?: string;
}

const THROTTLE_MS: Record<CelebrationLevel, number> = {
  micro: 400,
  medium: 3000,
  major: 10000,
};

class CelebrationService {
  private lastFired: Record<CelebrationLevel, number> = {
    micro: 0,
    medium: 0,
    major: 0,
  };
  private celebratedIds = new Set<string>();
  private listeners: Array<(event: CelebrationEvent) => void> = [];

  subscribe(cb: (event: CelebrationEvent) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  trigger(
    level: CelebrationLevel,
    options?: { label?: string; entityId?: string }
  ): void {
    const now = Date.now();

    if (now - this.lastFired[level] < THROTTLE_MS[level]) return;

    if (options?.entityId && level === "major") {
      if (this.celebratedIds.has(options.entityId)) return;
      this.celebratedIds.add(options.entityId);
    }

    this.lastFired[level] = now;

    const event: CelebrationEvent = {
      level,
      label: options?.label,
      entityId: options?.entityId,
    };
    this.listeners.forEach((l) => l(event));
  }
}

export const celebrationService = new CelebrationService();
