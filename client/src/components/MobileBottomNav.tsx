import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  CheckSquare,
  FileText,
  Users,
  MoreHorizontal,
  Plus,
  Search,
  Home,
  FolderKanban,
  Package,
  Rocket,
  Network,
  FolderOpen,
  Wallet,
  DollarSign,
  Mail,
  Calendar,
  BookOpen,
  Settings,
  LifeBuoy,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";

type ModuleItem = {
  label: string;
  icon: typeof Plus;
  href: string;
  color: string;
};

const REMAINING_MODULES: ModuleItem[] = [
  { label: "Tableau de bord", icon: Home,         href: "/",          color: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" },
  { label: "Projets",          icon: FolderKanban, href: "/projects",  color: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" },
  { label: "Product",          icon: Package,      href: "/product",   color: "bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/40 dark:text-fuchsia-400" },
  { label: "Roadmap",          icon: Rocket,       href: "/roadmap",   color: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400" },
  { label: "Fichiers",         icon: FolderOpen,   href: "/files",     color: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" },
  { label: "Cashflow",         icon: Wallet,       href: "/cashflow",  color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" },
  { label: "Finance",          icon: DollarSign,   href: "/finance",   color: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400" },
  { label: "Emails",           icon: Mail,         href: "/emails",    color: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400" },
  { label: "Calendrier",       icon: Calendar,     href: "/calendar",  color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400" },
  { label: "Réglages",         icon: Settings,     href: "/settings",  color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300" },
  { label: "Support",          icon: LifeBuoy,     href: "/settings?tab=support", color: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400" },
];

export function MobileBottomNav() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [isModulesOpen, setIsModulesOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchExpanded) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isSearchExpanded]);

  if (!user) return null;
  if (location === "/login" || location === "/signup") return null;

  const isActive = (path: string) =>
    location === path || location.startsWith(path + "/");

  const navTo = (path: string) => () => setLocation(path);

  const openQuickCreate = () => {
    window.dispatchEvent(new CustomEvent("planbase:open-quick-create"));
  };

  const collapseSearch = () => {
    setIsSearchExpanded(false);
    setSearchQuery("");
  };

  const submitSearch = () => {
    const q = searchQuery.trim();
    window.dispatchEvent(
      new CustomEvent("planbase:open-global-search", { detail: { query: q } }),
    );
    collapseSearch();
  };

  return (
    <div
      className="md:hidden fixed left-0 right-0 z-50 flex items-center justify-center gap-2 px-3 pointer-events-none"
      style={{ bottom: "max(6px, calc(env(safe-area-inset-bottom, 0px) - 20px))" }}
    >
      {/* Main pill */}
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full border bg-background/95 backdrop-blur-md px-3 py-2 transition-all duration-300 ease-out ${
          isSearchExpanded ? "opacity-0 scale-95 pointer-events-none -translate-x-2" : "opacity-100 scale-100"
        }`}
        style={{
          boxShadow:
            "0 8px 24px -8px rgba(0,0,0,0.18), 0 2px 6px -2px rgba(0,0,0,0.08)",
        }}
        data-testid="mobile-bottom-nav"
      >
        <NavButton
          label="Tâches"
          icon={CheckSquare}
          active={isActive("/tasks")}
          onClick={navTo("/tasks")}
          testId="button-mobile-nav-tasks"
        />
        <NavButton
          label="Notes"
          icon={FileText}
          active={isActive("/notes")}
          onClick={navTo("/notes")}
          testId="button-mobile-nav-notes"
        />

        <button
          type="button"
          aria-label="Nouveau"
          onClick={openQuickCreate}
          data-testid="button-mobile-nav-create"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground hover-elevate active-elevate-2"
        >
          <Plus className="h-6 w-6" />
        </button>

        <NavButton
          label="CRM"
          icon={Users}
          active={isActive("/crm")}
          onClick={navTo("/crm")}
          testId="button-mobile-nav-crm"
        />
        <NavButton
          label="Plus de modules"
          icon={MoreHorizontal}
          active={false}
          onClick={() => setIsModulesOpen(true)}
          testId="button-mobile-nav-more"
        />
      </div>

      {/* Separate search pill (expands right-to-left like iOS) */}
      <div
        className={`pointer-events-auto absolute right-3 flex items-center rounded-full border bg-background/95 backdrop-blur-md transition-all duration-300 ease-out ${
          isSearchExpanded ? "p-1.5 pl-4 left-3" : "p-2"
        }`}
        style={{
          boxShadow:
            "0 8px 24px -8px rgba(0,0,0,0.18), 0 2px 6px -2px rgba(0,0,0,0.08)",
        }}
      >
        {isSearchExpanded ? (
          <>
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSearch();
                if (e.key === "Escape") collapseSearch();
              }}
              placeholder="Rechercher..."
              data-testid="input-mobile-nav-search"
              className="flex-1 min-w-0 bg-transparent outline-none border-0 text-sm px-3 py-1 text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={collapseSearch}
              aria-label="Fermer la recherche"
              data-testid="button-mobile-nav-search-close"
              className="shrink-0 text-sm font-medium text-primary px-2 py-1 rounded-full hover-elevate active-elevate-2"
            >
              Annuler
            </button>
          </>
        ) : (
          <NavButton
            label="Rechercher"
            icon={Search}
            active={false}
            onClick={() => setIsSearchExpanded(true)}
            testId="button-mobile-nav-search"
          />
        )}
      </div>

      {/* Modules sheet — same visual style as the header "+" popover */}
      <Sheet open={isModulesOpen} onOpenChange={setIsModulesOpen}>
        <SheetContent
          side="bottom"
          className="h-auto rounded-t-xl bg-card pb-8"
          data-testid="sheet-mobile-modules"
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">Modules</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {REMAINING_MODULES.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.href}
                  type="button"
                  onClick={() => {
                    setIsModulesOpen(false);
                    setLocation(m.href);
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover-elevate active-elevate-2 cursor-pointer"
                  data-testid={`button-mobile-module-${m.href.replace(/\//g, "-") || "home"}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${m.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-foreground/80 leading-tight text-center">
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NavButton({
  label,
  icon: Icon,
  active,
  onClick,
  testId,
}: {
  label: string;
  icon: typeof Plus;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      data-testid={testId}
      className={`flex h-10 w-10 items-center justify-center rounded-full hover-elevate active-elevate-2 ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
