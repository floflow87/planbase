import { useEffect, useState, useRef } from "react";
import { celebrationService, CelebrationEvent } from "@/services/celebrationService";
import { CheckCircle2 } from "lucide-react";

type Toast = {
  id: number;
  label: string;
  level: "medium" | "major";
};

let toastIdCounter = 0;

async function fireMajorConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    const colors = ["#7C3AED", "#a78bfa", "#ffffff", "#c4b5fd", "#06B6D4"];

    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.15, x: 0.5 },
      colors,
      gravity: 1.2,
      scalar: 0.9,
      ticks: 180,
      disableForReducedMotion: true,
    });

    setTimeout(() => {
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.1, x: 0.35 },
        colors,
        gravity: 1.1,
        scalar: 0.8,
        ticks: 140,
        disableForReducedMotion: true,
      });
    }, 180);

    setTimeout(() => {
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.1, x: 0.65 },
        colors,
        gravity: 1.1,
        scalar: 0.8,
        ticks: 140,
        disableForReducedMotion: true,
      });
    }, 280);
  } catch {}
}

async function fireMediumConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    const colors = ["#7C3AED", "#a78bfa", "#c4b5fd", "#06B6D4"];

    confetti({
      particleCount: 25,
      spread: 45,
      origin: { y: 0.2, x: 0.5 },
      colors,
      gravity: 1.3,
      scalar: 0.75,
      ticks: 120,
      disableForReducedMotion: true,
    });
  } catch {}
}

export function CelebrationLayer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRefs = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const unsub = celebrationService.subscribe((event: CelebrationEvent) => {
      if (event.level === "micro") return;

      const id = ++toastIdCounter;
      const label =
        event.label ??
        (event.level === "major" ? "Mission accomplie !" : "Livrable terminé");

      if (event.level === "major") {
        fireMajorConfetti();
      } else if (event.level === "medium") {
        fireMediumConfetti();
      }

      setToasts((prev) => [...prev, { id, label, level: event.level }]);

      timerRefs.current[id] = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        delete timerRefs.current[id];
      }, event.level === "major" ? 3500 : 2800);
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
            className={
              t.level === "major"
                ? "w-4 h-4 text-white"
                : "w-3.5 h-3.5 text-white"
            }
            strokeWidth={2.5}
          />
          <span className="text-sm font-semibold text-white leading-tight">
            {t.label}
          </span>
        </div>
      ))}
    </div>
  );
}
