import { useState, useRef, useEffect, ComponentType } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, FolderKanban, FileText, BookOpen, Map, File } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function GlobalSearch() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        .slice(0, 4)
        .map(c => ({ id: c.id, label: c.name, category: "clients", href: `/crm/${c.id}` })),
    },
    {
      category: "projects",
      results: projects
        .filter(p => !q || p.name?.toLowerCase().includes(q))
        .slice(0, 4)
        .map(p => ({ id: p.id, label: p.name, category: "projects", href: `/projects/${p.id}` })),
    },
    {
      category: "notes",
      results: notes
        .filter(n => !q || n.title?.toLowerCase().includes(q))
        .slice(0, 4)
        .map(n => ({ id: n.id, label: n.title, category: "notes", href: `/notes/${n.id}` })),
    },
    {
      category: "backlogs",
      results: backlogs
        .filter(b => !q || b.name?.toLowerCase().includes(q))
        .slice(0, 4)
        .map(b => ({ id: b.id, label: b.name, category: "backlogs", href: `/product/backlog/${b.id}` })),
    },
    {
      category: "documents",
      results: documents
        .filter(d => !q || d.name?.toLowerCase().includes(q))
        .slice(0, 4)
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
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleOpen();
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      {!open ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpen}
          data-testid="button-global-search"
          title="Rechercher (⌘K)"
          className="h-7 w-7"
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
            className="bg-transparent text-xs outline-none placeholder:text-muted-foreground w-full text-foreground min-w-0"
            style={{ width: "13rem" }}
            data-testid="input-global-search"
            onKeyDown={e => e.key === "Escape" && setOpen(false)}
          />
        </div>
      )}

      {showDropdown && (
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
              <span className="text-[10px] text-muted-foreground">Tapez pour filtrer • <kbd className="bg-muted px-1 rounded text-[9px]">⌘K</kbd> pour ouvrir</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
