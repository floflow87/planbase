import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, Link } from "wouter";
import {
  Home, FolderKanban, CheckSquare, Rocket, Package,
  FileText, FolderOpen, Users, DollarSign, Settings,
  Network, HelpCircle, Wallet, Zap, Bot, LogOut,
  X, Moon, Sun,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useConfigAll } from "@/hooks/useConfigAll";
import { useBilling } from "@/hooks/useBilling";
import { useAiAssistantState } from "@/components/ai/AiAssistant";
import type { RbacModule } from "@shared/schema";
import defaultAvatar from "@/assets/default-avatar.png";
import planbaseLogo from "@assets/planbase-logo.png";

// ─── Nav items (mirrors app-sidebar.tsx) ─────────────────────────────────────
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
  "/documents": "documents",
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
  "/documents": "documents_module",
  "/finance": "profitability_module",
  "/cashflow": "treasury_module",
};

const ALL_NAV = [
  { title: "Tableau de bord", url: "/", icon: Home },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Projets", url: "/projects", icon: FolderKanban },
  { title: "Product", url: "/product", icon: Package },
  { title: "Roadmap", url: "/roadmap", icon: Rocket },
  { title: "Notes", url: "/notes", icon: FileText },
  { title: "Tâches", url: "/tasks", icon: CheckSquare },
  { title: "Whiteboards", url: "/mindmaps", icon: Network, badge: "Beta" },
  { title: "Fichiers", url: "/files", icon: FolderOpen },
  { title: "Trésorerie", url: "/cashflow", icon: Wallet },
  { title: "Rentabilité", url: "/finance", icon: DollarSign, badge: "Beta" },
];

// ─── Two-step animation heights ───────────────────────────────────────────────
// Step 1 = 52 vh  →  Step 2 = 90 vh
// Spring-like cubic-bezier for step 2
const STEP1_H = "52vh";
const STEP2_H = "90vh";
const SPRING = "cubic-bezier(0.34, 1.30, 0.64, 1)";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MobileSidebarSheet({ open, onClose }: Props) {
  const [location, setLocation] = useLocation();
  const { user, userProfile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, role, can } = usePermissions();
  const { data: configData } = useConfigAll();
  const featureFlags = configData?.featureFlagsMap ?? {};
  const { billingState } = useBilling();
  const aiAssistant = useAiAssistantState();
  const showUpgradeCTA =
    billingState !== "loading" &&
    billingState !== "admin" &&
    billingState !== "active" &&
    billingState !== "past_due";

  // ── Two-step animation state ──────────────────────────────────────────────
  // 0 = closed/hidden, 1 = first snap, 2 = fully expanded
  const [animStep, setAnimStep] = useState<0 | 1 | 2>(0);
  const [mounted, setMounted] = useState(false);
  const step2Timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Next frame → step 1 (slide up to 52vh)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimStep(1));
      });
      // After 220ms → step 2 (spring to 90vh)
      step2Timer.current = setTimeout(() => setAnimStep(2), 220);
    } else {
      if (step2Timer.current) clearTimeout(step2Timer.current);
      setAnimStep(0);
      // Unmount after exit animation
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
    return () => {
      if (step2Timer.current) clearTimeout(step2Timer.current);
    };
  }, [open]);

  // ── Scroll lock (same robust iOS technique) ───────────────────────────────
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    document.body.dataset.sidebarScrollY = String(scrollY);
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.overflow = "hidden";
    return () => {
      const saved = parseInt(document.body.dataset.sidebarScrollY || "0", 10);
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      delete document.body.dataset.sidebarScrollY;
      window.scrollTo(0, saved);
    };
  }, [open]);

  // ── Permission helpers ────────────────────────────────────────────────────
  const isModuleEnabled = (url: string) => {
    const flagKey = URL_TO_FEATURE_FLAG[url];
    if (!flagKey) return true;
    if (flagKey in featureFlags) return featureFlags[flagKey] !== false;
    return true;
  };

  const canAccessModule = (url: string) => {
    if (!isModuleEnabled(url)) return false;
    if (isAdmin) return true;
    const module = URL_TO_MODULE[url];
    if (module === null) return true;
    return can(module, "read");
  };

  const navItems = ALL_NAV.filter((item) => canAccessModule(item.url));

  const isActive = (url: string) =>
    url === "/" ? location === "/" : location === url || location.startsWith(url + "/");

  const goTo = (url: string) => {
    onClose();
    setLocation(url);
  };

  // ── User display ──────────────────────────────────────────────────────────
  const fullName =
    userProfile?.firstName && userProfile?.lastName
      ? `${userProfile.firstName} ${userProfile.lastName}`
      : user?.email || "Utilisateur";

  const initials =
    userProfile?.firstName && userProfile?.lastName
      ? `${userProfile.firstName[0]}${userProfile.lastName[0]}`.toUpperCase()
      : user?.email?.substring(0, 2).toUpperCase() || "U";

  const roleLabel =
    role === "admin" ? "Admin" :
    role === "member" ? "Membre" :
    role === "guest" ? "Invité" :
    userProfile?.position || "Membre";

  // ── Sheet height & transition logic ──────────────────────────────────────
  let sheetHeight = "0px";
  let transition = "transform 300ms ease-in-out";

  if (animStep === 0) {
    sheetHeight = STEP1_H; // keep DOM size, we translate
  } else if (animStep === 1) {
    sheetHeight = STEP1_H;
    transition = "height 260ms ease-out, transform 260ms ease-out";
  } else {
    sheetHeight = STEP2_H;
    transition = `height 380ms ${SPRING}, transform 300ms ease-out`;
  }

  const translateY = animStep === 0 ? "100%" : "0%";

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998]" data-testid="mobile-sidebar-sheet-root">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        style={{
          opacity: animStep === 0 ? 0 : 1,
          transition: "opacity 280ms ease",
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col bg-card rounded-t-2xl shadow-2xl overflow-hidden"
        style={{
          height: sheetHeight,
          transform: `translateY(${translateY})`,
          transition,
        }}
        data-testid="mobile-sidebar-sheet"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <img src={planbaseLogo} alt="PlanBase" className="w-7 h-7 rounded-lg" />
            <span
              className="font-semibold text-base italic bg-gradient-to-r from-violet-600 via-purple-600 to-violet-500 bg-clip-text text-transparent"
              style={{ fontFamily: 'Futura, "Century Gothic", CenturyGothic, AppleGothic, sans-serif' }}
            >
              Navigation
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover-elevate text-muted-foreground"
            data-testid="button-close-mobile-sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto px-3 pb-4"
          style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" as any }}
        >
          {/* Nav items */}
          <div className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const active = isActive(item.url);
              return (
                <button
                  key={item.url}
                  onClick={() => goTo(item.url)}
                  className={`flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left active-elevate-2 transition-colors ${
                    active
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover-elevate"
                  }`}
                  data-testid={`mobile-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm flex-1">{item.title}</span>
                  {(item as any).badge && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-violet-100 text-violet-700 border-violet-300">
                      {(item as any).badge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="h-px bg-border my-3 mx-1" />

          {/* Assistant IA */}
          {aiAssistant.hasAccess && (
            <button
              onClick={() => { onClose(); aiAssistant.toggle(); }}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-xl mb-1 bg-gradient-to-r from-primary to-purple-400 text-primary-foreground active-elevate-2"
              data-testid="mobile-nav-ai-assistant"
            >
              <Bot className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">Assistant IA</span>
            </button>
          )}

          {/* Aide et support */}
          <button
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left hover-elevate active-elevate-2"
            data-testid="mobile-nav-aide"
          >
            <HelpCircle className="w-5 h-5 shrink-0 text-muted-foreground" />
            <span className="text-sm text-foreground">Aide et support</span>
          </button>

          {/* Upgrade CTA */}
          {showUpgradeCTA && (
            <button
              onClick={() => goTo("/pricing")}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-xl mt-1 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 hover-elevate active-elevate-2"
              data-testid="mobile-nav-upgrade"
            >
              <Zap className="w-5 h-5 shrink-0 text-violet-600 dark:text-violet-400" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">Passer à l'Agence</span>
                <span className="text-[11px] text-violet-500 dark:text-violet-400">Débloquer tous les modules</span>
              </div>
            </button>
          )}

          {/* Divider */}
          <div className="h-px bg-border my-3 mx-1" />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left hover-elevate active-elevate-2"
            data-testid="mobile-nav-theme"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 shrink-0 text-muted-foreground" />
            ) : (
              <Moon className="w-5 h-5 shrink-0 text-muted-foreground" />
            )}
            <span className="text-sm text-foreground">
              {theme === "dark" ? "Mode clair" : "Mode sombre"}
            </span>
          </button>

          {/* Settings */}
          <button
            onClick={() => goTo("/settings")}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left hover-elevate active-elevate-2"
            data-testid="mobile-nav-settings"
          >
            <Settings className="w-5 h-5 shrink-0 text-muted-foreground" />
            <span className="text-sm text-foreground">Paramètres</span>
          </button>

          {/* Logout */}
          <button
            onClick={async () => { onClose(); await signOut(); setLocation("/login"); }}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left hover-elevate active-elevate-2"
            data-testid="mobile-nav-logout"
          >
            <LogOut className="w-5 h-5 shrink-0 text-destructive" />
            <span className="text-sm text-destructive">Déconnexion</span>
          </button>
        </div>

        {/* User profile footer — sticky bottom */}
        <div className="shrink-0 border-t border-border bg-gradient-to-r from-violet-600 via-purple-600 to-violet-500 px-5 py-4">
          <button
            onClick={() => goTo("/settings")}
            className="flex items-center gap-3 w-full hover:bg-white/10 rounded-xl p-2 -m-2 active-elevate-2"
            data-testid="mobile-nav-profile"
          >
            <Avatar className="w-9 h-9 shrink-0">
              <AvatarImage src={userProfile?.avatarUrl || defaultAvatar} />
              <AvatarFallback className="bg-white/20 text-white text-xs font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-white truncate">{fullName}</p>
              <p className="text-[11px] text-white/70">{roleLabel}</p>
            </div>
            <Settings className="w-4 h-4 text-white/70 shrink-0" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
