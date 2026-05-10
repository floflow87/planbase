import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useConfigAll } from "@/hooks/useConfigAll";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Home,
  FolderKanban,
  CheckSquare,
  Rocket,
  Package,
  FileText,
  FolderOpen,
  Users,
  DollarSign,
  Network,
  Wallet,
  X,
  Rocket as RocketIcon,
} from "lucide-react";
import type { RbacModule } from "@shared/schema";

const URL_TO_MODULE: Record<string, RbacModule | null> = {
  "/": null,
  "/crm": "crm",
  "/projects": "projects",
  "/product": "product",
  "/roadmap": "roadmap",
  "/tasks": "tasks",
  "/mindmaps": "whiteboards",
  "/notes": "notes",
  "/files": "documents",
  "/finance": "profitability",
  "/cashflow": "treasury",
};

const URL_TO_FEATURE_FLAG: Record<string, string> = {
  "/crm": "crm_module",
  "/projects": "projects_module",
  "/product": "product_module",
  "/roadmap": "roadmap_module",
  "/tasks": "tasks_module",
  "/mindmaps": "whiteboards_module",
  "/notes": "notes_module",
  "/files": "documents_module",
  "/finance": "profitability_module",
  "/cashflow": "treasury_module",
};

export function MobileRadialNav() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { isAdmin, can } = usePermissions();
  const { data: configData } = useConfigAll();
  const { t } = useLanguage();
  const featureFlags = configData?.featureFlagsMap ?? {};

  const [isOpen, setIsOpen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const dragStartRef = useRef<{ x: number; y: number; angle: number; startRotation: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allItems = [
    { title: t.nav.dashboard, url: "/", icon: Home },
    { title: t.nav.crm, url: "/crm", icon: Users },
    { title: t.nav.projects, url: "/projects", icon: FolderKanban },
    { title: t.nav.product, url: "/product", icon: Package },
    { title: t.nav.roadmap, url: "/roadmap", icon: Rocket },
    { title: t.nav.notes, url: "/notes", icon: FileText },
    { title: t.nav.tasks, url: "/tasks", icon: CheckSquare },
    { title: t.nav.whiteboards, url: "/mindmaps", icon: Network },
    { title: t.nav.files, url: "/files", icon: FolderOpen },
    { title: t.nav.cashflow, url: "/cashflow", icon: Wallet },
    { title: t.nav.finance, url: "/finance", icon: DollarSign },
  ];

  const isModuleEnabled = (url: string) => {
    const flagKey = URL_TO_FEATURE_FLAG[url];
    if (!flagKey) return true;
    if (flagKey in featureFlags) return featureFlags[flagKey] !== false;
    return true;
  };

  const canAccess = (url: string) => {
    if (!isModuleEnabled(url)) return false;
    if (isAdmin) return true;
    const m = URL_TO_MODULE[url];
    if (m === null) return true;
    return can(m, "read");
  };

  const items = allItems.filter((i) => canAccess(i.url));

  const radius = 72;
  const buttonSize = 38;
  const count = items.length;

  const movedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isOpen || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
    dragStartRef.current = { x: e.clientX, y: e.clientY, angle, startRotation: rotation };
    movedRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.hypot(dx, dy) > 6) movedRef.current = true;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const delta = ((angle - dragStartRef.current.angle) * 180) / Math.PI;
    setRotation(dragStartRef.current.startRotation + delta);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleBackdropClick = () => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    setIsOpen(false);
  };

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Freeze background scroll while menu is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, [isOpen]);

  // Prevent native touch scroll/zoom while rotating
  useEffect(() => {
    if (!isOpen) return;
    const prevent = (e: TouchEvent) => {
      e.preventDefault();
    };
    window.addEventListener("touchmove", prevent, { passive: false });
    return () => window.removeEventListener("touchmove", prevent);
  }, [isOpen]);

  // Hide on auth screens / when no user — placed after all hooks
  if (!user) return null;

  return (
    <>
      {/* Backdrop when open — also captures the rotate gesture */}
      {isOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Fermer le menu"
          className="md:hidden fixed inset-0 z-[60] bg-background/40 backdrop-blur-sm touch-none"
          onClick={handleBackdropClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          data-testid="radial-nav-backdrop"
        />
      )}

      <div
        ref={containerRef}
        className="md:hidden fixed left-1/2 -translate-x-1/2 z-[61]"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          width: 64,
          height: 64,
        }}
        data-testid="mobile-radial-nav"
      >
        {/* Radial icons */}
        {isOpen && (
          <div className="absolute inset-0" style={{ width: 64, height: 64 }}>
            {items.map((item, idx) => {
              // Distribute on the upper half-circle (180°), since the button sits at the bottom of the screen
              const baseAngle = -180 + (idx * 180) / Math.max(count - 1, 1);
              const angleDeg = baseAngle + rotation;
              const angleRad = (angleDeg * Math.PI) / 180;
              const x = Math.cos(angleRad) * radius;
              const y = Math.sin(angleRad) * radius;
              const Icon = item.icon;
              return (
                <button
                  key={item.url}
                  type="button"
                  className="radial-nav-item absolute top-1/2 left-1/2 flex items-center justify-center rounded-full bg-card border border-border shadow-md hover-elevate active-elevate-2"
                  style={{
                    width: buttonSize,
                    height: buttonSize,
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    animationDelay: `${idx * 30}ms`,
                  }}
                  onClick={() => {
                    setLocation(item.url);
                    setIsOpen(false);
                  }}
                  data-testid={`radial-nav-item-${item.url.replace(/\//g, "") || "home"}`}
                  title={item.title}
                  aria-label={item.title}
                >
                  <Icon className="w-4 h-4 text-foreground" />
                </button>
              );
            })}
          </div>
        )}

        {/* Center button (logo / close) */}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-primary border border-primary shadow-lg hover-elevate active-elevate-2"
          data-testid="button-mobile-radial-toggle"
          aria-label={isOpen ? "Fermer le menu de navigation" : "Ouvrir le menu de navigation"}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <X className="w-4 h-4 text-primary-foreground" />
          ) : (
            <RocketIcon className="w-6 h-6 text-primary-foreground" />
          )}
        </button>
      </div>
    </>
  );
}
