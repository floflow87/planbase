import { useEffect, useState, useRef } from "react";
import { celebrationService, CelebrationEvent, CelebrationLevel } from "@/services/celebrationService";
import { CheckCircle2 } from "lucide-react";

type Toast = {
  id: number;
  label: string;
  level: CelebrationLevel;
};

const DURATIONS: Record<CelebrationLevel, number> = {
  micro: 900,
  medium: 2800,
  major: 3500,
};

const LABELS: Record<CelebrationLevel, string> = {
  micro: "Tâche terminée",
  medium: "Livrable terminé",
  major: "Mission accomplie !",
};

let toastIdCounter = 0;

const RAINBOW_COLORS = [
  "#FF0080", "#FF6600", "#FFD700", "#00E676",
  "#00BCD4", "#7C3AED", "#F06292", "#FFCA28",
  "#26C6DA", "#AB47BC", "#66BB6A", "#EF5350",
];

const MEDIUM_COLORS = [
  "#7C3AED", "#a78bfa", "#c4b5fd", "#06B6D4",
  "#FFD700", "#00E676", "#FF6600",
];

async function fireMajorConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;

    // First burst — center, full rainbow
    confetti({
      particleCount: 80,
      spread: 80,
      origin: { y: 0.12, x: 0.5 },
      colors: RAINBOW_COLORS,
      gravity: 1.1,
      scalar: 0.95,
      ticks: 200,
      disableForReducedMotion: true,
    });

    // Left burst
    setTimeout(() => {
      confetti({
        particleCount: 45,
        spread: 60,
        angle: 55,
        origin: { y: 0.08, x: 0.15 },
        colors: RAINBOW_COLORS,
        gravity: 1.0,
        scalar: 0.85,
        ticks: 160,
        disableForReducedMotion: true,
      });
    }, 160);

    // Right burst
    setTimeout(() => {
      confetti({
        particleCount: 45,
        spread: 60,
        angle: 125,
        origin: { y: 0.08, x: 0.85 },
        colors: RAINBOW_COLORS,
        gravity: 1.0,
        scalar: 0.85,
        ticks: 160,
        disableForReducedMotion: true,
      });
    }, 280);

    // Late center sparkle
    setTimeout(() => {
      confetti({
        particleCount: 30,
        spread: 100,
        origin: { y: 0.2, x: 0.5 },
        colors: RAINBOW_COLORS,
        gravity: 0.9,
        scalar: 0.7,
        ticks: 130,
        disableForReducedMotion: true,
      });
    }, 450);
  } catch {}
}

async function fireMediumConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;

    confetti({
      particleCount: 40,
      spread: 55,
      origin: { y: 0.18, x: 0.5 },
      colors: MEDIUM_COLORS,
      gravity: 1.2,
      scalar: 0.8,
      ticks: 140,
      disableForReducedMotion: true,
    });

    setTimeout(() => {
      confetti({
        particleCount: 20,
        spread: 40,
        origin: { y: 0.15, x: 0.4 },
        colors: MEDIUM_COLORS,
        gravity: 1.1,
        scalar: 0.75,
        ticks: 110,
        disableForReducedMotion: true,
      });
    }, 200);
  } catch {}
}

export function CelebrationLayer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRefs = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const unsub = celebrationService.subscribe((event: CelebrationEvent) => {
      const id = ++toastIdCounter;
      const label = event.label ?? LABELS[event.level];

      if (event.level === "major") {
        fireMajorConfetti();
      } else if (event.level === "medium") {
        fireMediumConfetti();
      }

      setToasts((prev) => [...prev, { id, label, level: event.level }]);

      timerRefs.current[id] = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        delete timerRefs.current[id];
      }, DURATIONS[event.level]);
    });

    return () => {
      unsub();
      Object.values(timerRefs.current).forEach(clearTimeout);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="celebration-toast"
          data-level={t.level}
        >
          <CheckCircle2
            className={t.level === "major" ? "w-4 h-4 text-white" : "w-3.5 h-3.5 text-white"}
            strokeWidth={2.5}
          />
          <span
            className={`font-semibold text-white leading-tight ${t.level === "micro" ? "text-xs" : "text-sm"}`}
          >
            {t.label}
          </span>
        </div>
      ))}
    </div>
  );
}
