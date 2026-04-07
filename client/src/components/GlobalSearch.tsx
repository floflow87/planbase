import { useState, useRef, useEffect, ComponentType } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, FolderKanban, FileText, BookOpen, Map, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";

type SearchResult = {
  id: string;
  label: string;
  category: string;
  href: string;
};

const CATEGORY_META: Record<string, { label: string; icon: ComponentType<{ className?: string }>; color: string }> = {
  clients: { label: "Clients", icon: Users, color: "text-blue-500" },
  projects: { label: "Projets", icon: FolderKanban, color: "text-violet-500" },
  notes: { label: "Notes", icon: FileText, color: "text-yellow-500" },
  backlogs: { label: "Backlogs", icon: BookOpen, color: "text-green-500" },
  documents: { label: "Documents", icon: File, color: "text-orange-500" },
  roadmaps: { label: "Roadmap", icon: Map, color: "text-cyan-500" },
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

// Locks body scroll in a way that works on iOS Safari.
// Saves scroll position, fixes body, restores on unlock.
function lockBodyScroll() {
  const scrollY = window.scrollY;
  document.body.dataset.scrollY = String(scrollY);
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  const scrollY = parseInt(document.body.dataset.scrollY || "0", 10);
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.overflow = "";
  delete document.body.dataset.scrollY;
  window.scrollTo(0, scrollY);
}

export function GlobalSearch() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { data: clients = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/clients"] });
  const { data: projects = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/projects"] });
  const { data: notes = [] } = useQuery<{ id: string; title: string }[]>({ queryKey: ["/api/notes"] });
  const { data: backlogs = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/backlogs"] });
  const { data: documents = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/documents"] });
  const { data: roadmaps = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/roadmaps"] });

  const q = query.trim().toLowerCase();

  const grouped: { category: string; results: SearchResult[] }[] = [
    {
      category: "clients",
      results: clients
        .filter(c => !q || c.name?.toLowerCase().includes(q))
        .slice(0, 5)
        .map(c => ({ id: c.id, label: c.name, category: "clients", href: `/crm/${c.id}` })),
    },
    {
      category: "projects",
      results: projects
        .filter(p => !q || p.name?.toLowerCase().includes(q))
        .slice(0, 5)
        .map(p => ({ id: p.id, label: p.name, category: "projects", href: `/projects/${p.id}` })),
    },
    {
      category: "notes",
      results: notes
        .filter(n => !q || n.title?.toLowerCase().includes(q))
        .slice(0, 5)
        .map(n => ({ id: n.id, label: n.title, category: "notes", href: `/notes/${n.id}` })),
    },
    {
      category: "backlogs",
      results: backlogs
        .filter(b => !q || b.name?.toLowerCase().includes(q))
        .slice(0, 5)
        .map(b => ({ id: b.id, label: b.name, category: "backlogs", href: `/product/backlog/${b.id}` })),
    },
    {
      category: "documents",
      results: documents
        .filter(d => !q || d.name?.toLowerCase().includes(q))
        .slice(0, 5)
        .map(d => ({ id: d.id, label: d.name, category: "documents", href: `/documents/${d.id}` })),
    },
    {
      category: "roadmaps",
      results: roadmaps
        .filter(r => !q || r.name?.toLowerCase().includes(q))
        .slice(0, 3)
        .map(r => ({ id: r.id, label: r.name, category: "roadmaps", href: `/roadmap` })),
    },
  ].filter(g => g.results.length > 0);

  const hasResults = grouped.some(g => g.results.length > 0);
  const showDropdown = open && (q.length > 0 || hasResults);

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery("");
    setLocation(href);
  };

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => {
      if (isMobile) {
        mobileInputRef.current?.focus();
      } else {
        inputRef.current?.focus();
      }
    }, 50);
  };

  const handleClose = () => {
    setOpen(false);
    setQuery("");
  };

  // Lock / unlock body scroll on iOS when modal is open.
  // We use the position:fixed trick which is the only reliable method on iOS Safari.
  useEffect(() => {
    if (isMobile && open) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }
    return () => unlockBodyScroll();
  }, [isMobile, open]);

  // Block touchmove on the modal BACKDROP (header bar) to prevent any body scroll leak.
  // The results area handles its own scrolling via overscroll-behavior: contain.
  useEffect(() => {
    if (!isMobile || !open) return;

    const preventTouchMove = (e: TouchEvent) => {
      // Allow scrolling only inside the results container
      if (resultsRef.current && resultsRef.current.contains(e.target as Node)) {
        return; // let it scroll naturally (contained by CSS)
      }
      e.preventDefault();
    };

    document.addEventListener("touchmove", preventTouchMove, { passive: false });
    return () => document.removeEventListener("touchmove", preventTouchMove);
  }, [isMobile, open]);

  // Desktop: close on outside click
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleOpen();
      }
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isMobile]);

  // ── Mobile full-screen modal (via portal) ──────────────────────
  const mobileModal = isMobile && open ? createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-background flex flex-col"
      style={{ animation: "fadeIn 120ms ease-out forwards" }}
      data-testid="search-modal-mobile"
    >
      {/* Top bar — non-scrollable; safe-area-inset-top so it clears the status bar in PWA standalone */}
      <div
        className="flex items-center gap-2 px-4 border-b border-border shrink-0"
        style={{ paddingTop: "max(var(--safe-top, 12px), 12px)", paddingBottom: "12px" }}
      >
        <div className="flex-1 flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={mobileInputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher…"
            autoFocus
            className="bg-transparent text-sm outline-none placeholder:text-muted-foreground w-full text-foreground"
            data-testid="input-global-search-mobile"
            onKeyDown={e => e.key === "Escape" && handleClose()}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-sm font-medium text-primary shrink-0 px-1"
          data-testid="button-search-cancel-mobile"
        >
          Annuler
        </button>
      </div>

      {/* Results — independently scrollable, scroll contained here */}
      <div
        ref={resultsRef}
        className="flex-1 overflow-y-auto"
        style={{
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch" as any,
        }}
      >
        {q.length > 0 && !hasResults ? (
          <div className="px-4 py-8 text-sm text-muted-foreground text-center">
            Aucun résultat pour « {query} »
          </div>
        ) : hasResults ? (
          grouped.map(group => {
            const meta = CATEGORY_META[group.category];
            const Icon = meta.icon;
            return (
              <div key={group.category}>
                <div className="flex items-center gap-2 px-4 pt-5 pb-2">
                  <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
                {group.results.map(result => (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result.href)}
                    className="w-full text-left px-4 py-3.5 text-base font-medium text-foreground active-elevate-2 border-b border-border/30 last:border-0"
                    data-testid={`search-result-${result.category}-${result.id}`}
                  >
                    {result.label}
                  </button>
                ))}
              </div>
            );
          })
        ) : (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            Tapez pour rechercher
          </div>
        )}

        {/* Bottom padding so last item isn't hidden behind keyboard */}
        <div className="h-16" />
      </div>
    </div>,
    document.body
  ) : null;

  // ── Desktop view ────────────────────────────────────────────────
  return (
    <>
      {mobileModal}
      <div ref={containerRef} className="relative flex-shrink-0">
        {!open || isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpen}
            data-testid="button-global-search"
            title="Rechercher (⌘K)"
            className="h-9 w-9"
          >
            <Search className="w-4 h-4 text-muted-foreground" />
          </Button>
        ) : (
          <div
            className="flex items-center gap-2 bg-white dark:bg-card border border-primary/40 rounded-md px-3 py-1.5"
            style={{ animation: "searchExpand 180ms cubic-bezier(0.4,0,0.2,1) forwards" }}
          >
            <Search className="w-3.5 h-3.5 text-primary shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="bg-transparent text-xs outline-none placeholder:text-[10px] placeholder:text-muted-foreground w-full text-foreground min-w-0"
              style={{ width: "13rem" }}
              data-testid="input-global-search"
              onKeyDown={e => e.key === "Escape" && setOpen(false)}
            />
          </div>
        )}

        {/* Desktop dropdown */}
        {!isMobile && showDropdown && (
          <div
            className="absolute left-0 top-full mt-1 w-72 bg-card border border-border rounded-md shadow-md z-[200] overflow-y-auto"
            style={{ maxHeight: "420px" }}
            data-testid="dropdown-global-search"
          >
            {!hasResults && q.length > 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">Aucun résultat</div>
            ) : (
              grouped.map(group => {
                const meta = CATEGORY_META[group.category];
                const Icon = meta.icon;
                return (
                  <div key={group.category} className="mb-1">
                    <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
                      <Icon className={`w-3 h-3 ${meta.color}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
                    </div>
                    {group.results.map(result => (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result.href)}
                        className="w-full text-left px-4 py-1.5 text-xs text-foreground hover-elevate rounded-none flex items-center gap-2 truncate"
                        data-testid={`search-result-${result.category}-${result.id}`}
                      >
                        <span className="truncate">{result.label}</span>
                      </button>
                    ))}
                  </div>
                );
              })
            )}
            {!q && (
              <div className="px-3 py-2 border-t border-border mt-1">
                <span className="text-[10px] text-muted-foreground">
                  Tapez pour filtrer • <kbd className="bg-muted px-1 rounded text-[9px]">⌘K</kbd> pour ouvrir
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
