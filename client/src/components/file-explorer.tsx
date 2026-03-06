import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import type { Folder, File } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  FolderOpen,
  FileText,
  File as FileIcon,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronRight,
  Home,
  Search,
  FolderPlus,
  Plus,
  Copy,
  X,
  Upload,
  Download,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Props {
  clientId?: string;
  projectId?: string;
}

type BreadcrumbItem = { id: string | null; name: string };
type SortBy = "name" | "date" | "type";
type FilterKind = "folder" | "note" | "document" | "pdf" | "image";
type RenameTarget = { id: string; kind: "folder" | "file"; name: string } | null;
type DeleteTarget = { id: string; kind: "folder" | "file"; name: string } | null;

interface FolderStats {
  subFolderCount: number;
  fileCount: number;
}

type ExplorerEntry = {
  id: string;
  kind: "folder" | "note" | "document" | "upload";
  name: string;
  updatedAt?: string | Date | null;
  entityId?: string | null;
  isFileEntry?: boolean;
  storageUrl?: string | null;
  mimeType?: string | null;
};

function buildFolderQK(parentId: string | null, clientId?: string, projectId?: string) {
  return ["/api/folders", { parentId, clientId, projectId }];
}
function buildFileQK(folderId: string | null, clientId?: string, projectId?: string) {
  return ["/api/files", { folderId, clientId, projectId }];
}

function FilledFolderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
    </svg>
  );
}

const noteSchema = z.object({ title: z.string().min(1, "Titre requis") });
const folderSchema = z.object({ name: z.string().min(1, "Nom requis") });

const FILTER_LABELS: Record<FilterKind, string> = {
  folder: "Dossiers",
  note: "Notes",
  document: "Documents",
  pdf: "PDF",
  image: "Images",
};

export function FileExplorer({ clientId, projectId }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: "Fichiers" }]);
  const isAtRoot = currentFolderId === null;

  // Search, sort, filter
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [activeFilters, setActiveFilters] = useState<Set<FilterKind>>(new Set());

  // Creation sheets
  const [folderSheetOpen, setFolderSheetOpen] = useState(false);
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);

  // Single-item rename / delete
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  // Multi-selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);

  // Rubber-band state (viewport coordinates)
  const [rubberBandStart, setRubberBandStart] = useState<{ x: number; y: number } | null>(null);
  const [rubberBandCurrent, setRubberBandCurrent] = useState<{ x: number; y: number } | null>(null);
  const rubberBandDraggedRef = useRef(false); // true if rubber-band drag occurred
  const contentRef = useRef<HTMLDivElement>(null);

  // Drag & drop
  const draggedIdsRef = useRef<string[]>([]);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Folder stats (hover tooltip)
  const [folderStatsCache, setFolderStatsCache] = useState<Record<string, FolderStats | "loading">>({});

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]); // names being uploaded

  // File preview dialog (images / PDFs)
  const [previewFile, setPreviewFile] = useState<{ url: string; mimeType: string; name: string } | null>(null);

  // Track virtual entries being optimistically "linked" to a folder (so they hide instantly at root)
  const [pendingLinkedEntityIds, setPendingLinkedEntityIds] = useState(new Set<string>());

  // Forms
  const noteForm = useForm({ resolver: zodResolver(noteSchema), defaultValues: { title: "" } });
  const folderForm = useForm({ resolver: zodResolver(folderSchema), defaultValues: { name: "" } });

  // ---------- Queries ----------
  const foldersParams = new URLSearchParams();
  foldersParams.set("parentId", currentFolderId ?? "");
  if (clientId) foldersParams.set("clientId", clientId);
  if (projectId) foldersParams.set("projectId", projectId);

  const filesParams = new URLSearchParams();
  filesParams.set("folderId", currentFolderId ?? "");
  if (clientId) filesParams.set("clientId", clientId);
  if (projectId) filesParams.set("projectId", projectId);

  const { data: folders = [], isLoading: foldersLoading } = useQuery<Folder[]>({
    queryKey: buildFolderQK(currentFolderId, clientId, projectId),
    queryFn: () => apiRequest(`/api/folders?${foldersParams}`, "GET").then(r => r.json()),
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<File[]>({
    queryKey: buildFileQK(currentFolderId, clientId, projectId),
    queryFn: () => apiRequest(`/api/files?${filesParams}`, "GET").then(r => r.json()),
  });

  const { data: allNotes = [] } = useQuery<any[]>({
    queryKey: ["/api/notes"],
    queryFn: () => apiRequest("/api/notes", "GET").then(r => r.json()),
    enabled: isAtRoot,
  });

  const { data: allDocuments = [] } = useQuery<any[]>({
    queryKey: ["/api/documents"],
    queryFn: () => apiRequest("/api/documents", "GET").then(r => r.json()),
    enabled: isAtRoot,
  });

  const isLoading = foldersLoading || filesLoading;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/files"] });
  }, []);

  // ---------- Mutations ----------
  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("/api/folders", "POST", {
        name,
        parentId: currentFolderId || null,
        clientId: clientId || null,
        projectId: projectId || null,
        scope: clientId ? "client" : projectId ? "project" : "generic",
      }),
    onSuccess: () => { invalidate(); setFolderSheetOpen(false); folderForm.reset(); },
    onError: () => toast({ title: "Erreur", description: "Impossible de créer le dossier", variant: "destructive" }),
  });

  const createNoteMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("/api/files/note", "POST", {
        title,
        folderId: currentFolderId || null,
        clientId: clientId || null,
        projectId: projectId || null,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setNoteSheetOpen(false);
      noteForm.reset();
      if (data?.note?.id) setLocation(`/notes/${data.note.id}`);
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de créer la note", variant: "destructive" }),
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiRequest(`/api/folders/${id}`, "PATCH", { name }),
    onSuccess: () => { invalidate(); setRenameTarget(null); },
    onError: () => toast({ title: "Erreur", description: "Impossible de renommer", variant: "destructive" }),
  });

  const renameFileMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiRequest(`/api/files/${id}`, "PATCH", { name }),
    onSuccess: () => { invalidate(); setRenameTarget(null); },
    onError: () => toast({ title: "Erreur", description: "Impossible de renommer", variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/folders/${id}`, "DELETE"),
    onMutate: async (id) => {
      const qk = buildFolderQK(currentFolderId, clientId, projectId);
      await queryClient.cancelQueries({ queryKey: qk });
      const prev = queryClient.getQueryData(qk);
      queryClient.setQueryData(qk, (old: any[]) => old?.filter((f: any) => f.id !== id) ?? []);
      return { prev };
    },
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
    onError: (_e, _id, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(buildFolderQK(currentFolderId, clientId, projectId), ctx.prev);
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/files/${id}`, "DELETE"),
    onMutate: async (id) => {
      const qk = buildFileQK(currentFolderId, clientId, projectId);
      await queryClient.cancelQueries({ queryKey: qk });
      const prev = queryClient.getQueryData(qk);
      queryClient.setQueryData(qk, (old: any[]) => old?.filter((f: any) => f.id !== id) ?? []);
      return { prev };
    },
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
    onError: (_e, _id, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(buildFileQK(currentFolderId, clientId, projectId), ctx.prev);
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      apiRequest(`/api/folders/${id}`, "PATCH", { parentId }),
    onMutate: async ({ id }) => {
      const qk = buildFolderQK(currentFolderId, clientId, projectId);
      await queryClient.cancelQueries({ queryKey: qk });
      const prev = queryClient.getQueryData(qk);
      queryClient.setQueryData(qk, (old: any[]) => old?.filter((f: any) => f.id !== id) ?? []);
      return { prev };
    },
    onSuccess: () => invalidate(),
    onError: (_e, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(buildFolderQK(currentFolderId, clientId, projectId), ctx.prev);
      toast({ title: "Erreur", description: "Impossible de déplacer", variant: "destructive" });
    },
  });

  const moveFileMutation = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      apiRequest(`/api/files/${id}`, "PATCH", { folderId }),
    onMutate: async ({ id }) => {
      const qk = buildFileQK(currentFolderId, clientId, projectId);
      await queryClient.cancelQueries({ queryKey: qk });
      const prev = queryClient.getQueryData(qk);
      queryClient.setQueryData(qk, (old: any[]) => old?.filter((f: any) => f.id !== id) ?? []);
      return { prev };
    },
    onSuccess: () => invalidate(),
    onError: (_e, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(buildFileQK(currentFolderId, clientId, projectId), ctx.prev);
      toast({ title: "Erreur", description: "Impossible de déplacer", variant: "destructive" });
    },
  });

  // Creates a file_ref / doc_internal entry to "move" a virtual note or document into a folder
  const linkEntryToFolderMutation = useMutation({
    mutationFn: ({ entry, folderId }: { entry: ExplorerEntry; folderId: string }) =>
      apiRequest("/api/files", "POST", {
        kind: entry.kind === "note" ? "note_ref" : "doc_internal",
        entityId: entry.entityId || entry.id,
        folderId,
        name: entry.name,
      }),
    onMutate: async ({ entry }) => {
      const entityId = entry.entityId || entry.id;
      setPendingLinkedEntityIds(prev => new Set([...prev, entityId]));
      return { entityId };
    },
    onSuccess: (_data, _vars, ctx: any) => {
      setPendingLinkedEntityIds(prev => { const n = new Set(prev); n.delete(ctx?.entityId); return n; });
      invalidate();
    },
    onError: (_e, _v, ctx: any) => {
      setPendingLinkedEntityIds(prev => { const n = new Set(prev); n.delete(ctx?.entityId); return n; });
      toast({ title: "Erreur", description: "Impossible de déplacer", variant: "destructive" });
    },
  });

  const duplicateSelectedMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const isFolder = folders.some(f => f.id === id);
        if (isFolder) await apiRequest(`/api/folders/${id}/duplicate`, "POST");
        else await apiRequest(`/api/files/${id}/duplicate`, "POST");
      }
    },
    onSuccess: () => {
      invalidate();
      setSelectedIds(new Set());
      toast({ title: "Éléments dupliqués", className: "bg-green-600 border-green-600 text-white" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de dupliquer", variant: "destructive" }),
  });

  const deleteSelectedMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const isFolder = folders.some(f => f.id === id);
        if (isFolder) await apiRequest(`/api/folders/${id}`, "DELETE");
        else await apiRequest(`/api/files/${id}`, "DELETE");
      }
    },
    onMutate: async (ids) => {
      const folderQK = buildFolderQK(currentFolderId, clientId, projectId);
      const fileQK = buildFileQK(currentFolderId, clientId, projectId);
      await queryClient.cancelQueries({ queryKey: folderQK });
      await queryClient.cancelQueries({ queryKey: fileQK });
      const prevFolders = queryClient.getQueryData(folderQK);
      const prevFiles = queryClient.getQueryData(fileQK);
      queryClient.setQueryData(folderQK, (old: any[]) => old?.filter((f: any) => !ids.includes(f.id)) ?? []);
      queryClient.setQueryData(fileQK, (old: any[]) => old?.filter((f: any) => !ids.includes(f.id)) ?? []);
      return { prevFolders, prevFiles };
    },
    onSuccess: () => {
      invalidate();
      setSelectedIds(new Set());
      setDeleteSelectedOpen(false);
      toast({ title: "Éléments supprimés", className: "bg-green-600 border-green-600 text-white" });
    },
    onError: (_e, _ids, ctx: any) => {
      if (ctx?.prevFolders) queryClient.setQueryData(buildFolderQK(currentFolderId, clientId, projectId), ctx.prevFolders);
      if (ctx?.prevFiles) queryClient.setQueryData(buildFileQK(currentFolderId, clientId, projectId), ctx.prevFiles);
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    },
  });

  // ---------- Navigation ----------
  const openFolder = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumb(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedIds(new Set());
    setActiveFilters(new Set());
  };

  const navigateBreadcrumb = (idx: number) => {
    const item = breadcrumb[idx];
    setCurrentFolderId(item.id);
    setBreadcrumb(prev => prev.slice(0, idx + 1));
    setSelectedIds(new Set());
  };

  const openFile = async (entry: ExplorerEntry) => {
    if (entry.kind === "note") {
      setLocation(`/notes/${entry.entityId || entry.id}`);
    } else if (entry.kind === "document") {
      setLocation(`/documents/${entry.entityId || entry.id}`);
    } else if (entry.kind === "upload") {
      try {
        const res = await apiRequest(`/api/files/${entry.id}/download-url`, "GET");
        const data = await res.json();
        if (!data.url) return;
        const mime = entry.mimeType || "";
        if (mime.startsWith("image/") || mime === "application/pdf") {
          setPreviewFile({ url: data.url, mimeType: mime, name: entry.name });
        } else {
          window.open(data.url, "_blank");
        }
      } catch {
        toast({ title: "Erreur", description: "Impossible d'ouvrir ce fichier", variant: "destructive" });
      }
    }
  };

  // ---------- Computed entries ----------
  const indexedNoteIds = useMemo(() => new Set(files.filter(f => f.kind === "note_ref" && f.entityId).map(f => f.entityId!)), [files]);
  const indexedDocIds = useMemo(() => new Set(files.filter(f => f.kind === "doc_internal" && f.entityId).map(f => f.entityId!)), [files]);

  const entries: ExplorerEntry[] = useMemo(() => {
    const result: ExplorerEntry[] = [];
    if (isAtRoot) {
      allNotes
        .filter(n => !indexedNoteIds.has(n.id))
        .filter(n => !pendingLinkedEntityIds.has(n.id))
        .filter(n => !clientId || n.clientId === clientId)
        .filter(n => !projectId || n.projectId === projectId)
        .forEach(n => result.push({ id: n.id, kind: "note", name: n.title || "Sans titre", updatedAt: n.updatedAt, entityId: n.id }));
      allDocuments
        .filter(d => !indexedDocIds.has(d.id))
        .filter(d => !pendingLinkedEntityIds.has(d.id))
        .filter(d => !clientId || d.clientId === clientId)
        .filter(d => !projectId || d.projectId === projectId)
        .forEach(d => result.push({ id: d.id, kind: "document", name: d.name || "Sans titre", updatedAt: d.updatedAt, entityId: d.id }));
    }
    files.forEach(f => result.push({
      id: f.id,
      kind: f.kind === "note_ref" ? "note" : f.kind === "upload" ? "upload" : "document",
      name: f.name,
      updatedAt: (f as any).createdAt,
      entityId: f.entityId,
      isFileEntry: true,
      storageUrl: (f as any).storageUrl,
      mimeType: (f as any).mimeType,
    }));
    return result;
  }, [isAtRoot, allNotes, allDocuments, files, indexedNoteIds, indexedDocIds, pendingLinkedEntityIds, clientId, projectId]);

  // Sort helper for entries
  const typeOrder: Record<string, number> = { note: 0, document: 1, upload: 2 };

  const filteredFolders = useMemo(() => {
    if (activeFilters.size > 0 && !activeFilters.has("folder")) return [];
    const q = searchQuery.toLowerCase();
    const list = q ? folders.filter(f => f.name.toLowerCase().includes(q)) : folders;
    if (sortBy === "name" || sortBy === "type") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [folders, searchQuery, sortBy, activeFilters]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = q ? entries.filter(e => e.name.toLowerCase().includes(q)) : entries;
    if (activeFilters.size > 0) {
      list = list.filter(e => {
        if (e.kind === "note" && activeFilters.has("note")) return true;
        if (e.kind === "document" && activeFilters.has("document")) return true;
        if (e.kind === "upload") {
          if (activeFilters.has("pdf") && e.mimeType === "application/pdf") return true;
          if (activeFilters.has("image") && e.mimeType?.startsWith("image/")) return true;
          return false;
        }
        return false;
      });
    }
    if (sortBy === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "date") return [...list].sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
    if (sortBy === "type") return [...list].sort((a, b) => {
      const diff = (typeOrder[a.kind] ?? 9) - (typeOrder[b.kind] ?? 9);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
    return list;
  }, [entries, searchQuery, sortBy, activeFilters]);

  const isEmpty = !isLoading && filteredFolders.length === 0 && filteredEntries.length === 0;

  // ---------- Filter toggle ----------
  const toggleFilter = (kind: FilterKind) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      return next;
    });
  };

  // ---------- Selection helpers ----------
  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else if (e.shiftKey) {
      setSelectedIds(prev => new Set([...prev, id]));
    } else {
      setSelectedIds(prev => {
        if (prev.size === 1 && prev.has(id)) return new Set();
        return new Set([id]);
      });
    }
  }, []);

  // ---------- Rubber band ----------
  useEffect(() => {
    if (!rubberBandStart) return;

    const handleMouseMove = (e: MouseEvent) => {
      setRubberBandCurrent({ x: e.clientX, y: e.clientY });

      if (!contentRef.current) return;
      const selLeft = Math.min(rubberBandStart.x, e.clientX);
      const selRight = Math.max(rubberBandStart.x, e.clientX);
      const selTop = Math.min(rubberBandStart.y, e.clientY);
      const selBottom = Math.max(rubberBandStart.y, e.clientY);

      if (selRight - selLeft < 5 && selBottom - selTop < 5) return;

      // Mark that a drag occurred (so click handler won't clear selection)
      rubberBandDraggedRef.current = true;

      const items = contentRef.current.querySelectorAll("[data-explorer-id]");
      const next = new Set<string>();
      items.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.left < selRight && rect.right > selLeft && rect.top < selBottom && rect.bottom > selTop) {
          const id = el.getAttribute("data-explorer-id");
          if (id) next.add(id);
        }
      });
      setSelectedIds(next);
    };

    const handleMouseUp = () => {
      setRubberBandStart(null);
      setRubberBandCurrent(null);
      // Do NOT reset rubberBandDraggedRef here — click event fires after mouseup
      // It is reset inside handleContentClick instead
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [rubberBandStart]);

  const handleContentMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-explorer-id]")) return;
    // Reset drag flag at start of each mousedown
    rubberBandDraggedRef.current = false;
    setSelectedIds(new Set());
    setRubberBandStart({ x: e.clientX, y: e.clientY });
    setRubberBandCurrent({ x: e.clientX, y: e.clientY });
  };

  const handleContentClick = () => {
    if (rubberBandDraggedRef.current) {
      // A rubber-band drag just ended — preserve the selection
      rubberBandDraggedRef.current = false;
      return;
    }
    setSelectedIds(new Set());
  };

  // ---------- Folder stats ----------
  const fetchFolderStats = useCallback(async (folderId: string) => {
    if (folderStatsCache[folderId]) return;
    setFolderStatsCache(prev => ({ ...prev, [folderId]: "loading" }));
    try {
      const res = await apiRequest(`/api/folders/${folderId}/stats`, "GET");
      const data = await res.json();
      setFolderStatsCache(prev => ({ ...prev, [folderId]: data }));
    } catch {
      setFolderStatsCache(prev => ({ ...prev, [folderId]: { subFolderCount: 0, fileCount: 0 } }));
    }
  }, [folderStatsCache]);

  // ---------- Drag & drop ----------
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    const ids = selectedIds.has(itemId) ? [...selectedIds] : [itemId];
    draggedIdsRef.current = ids;
    // Store in dataTransfer AND keep in ref (ref is the authoritative source)
    try { e.dataTransfer.setData("application/json", JSON.stringify(ids)); } catch { /* ignore */ }
    e.dataTransfer.effectAllowed = "move";
  };

  // ---------- Drag & drop — event delegation on content area ----------
  // Using event delegation avoids Radix Tooltip interfering with per-item events.

  /** Returns the folderId of the folder element under e.target, or null */
  const getFolderIdFromTarget = (e: React.DragEvent): string | null => {
    const el = (e.target as HTMLElement).closest('[data-explorer-id]') as HTMLElement | null;
    const candidate = el?.dataset.explorerId ?? null;
    if (!candidate) return null;
    if (!folders.some(f => f.id === candidate)) return null; // must be a folder
    if (draggedIdsRef.current.includes(candidate)) return null; // cannot drop onto self
    return candidate;
  };

  const handleContentDragOver = (e: React.DragEvent) => {
    if (draggedIdsRef.current.length === 0) return;
    const folderId = getFolderIdFromTarget(e);
    if (folderId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverFolderId(prev => prev !== folderId ? folderId : prev);
    } else {
      setDragOverFolderId(null);
    }
  };

  const handleContentDragLeave = (e: React.DragEvent) => {
    // Clear highlight only when truly leaving the content container
    if (!contentRef.current?.contains(e.relatedTarget as Node)) {
      setDragOverFolderId(null);
    }
  };

  const handleContentDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);

    const targetFolderId = getFolderIdFromTarget(e);
    if (!targetFolderId) return;

    const ids = draggedIdsRef.current.length > 0
      ? draggedIdsRef.current
      : (() => { try { return JSON.parse(e.dataTransfer.getData("application/json")); } catch { return []; } })();

    if (ids.length === 0) return;

    ids.forEach((id: string) => {
      if (id === targetFolderId) return;
      const isAFolder = folders.some(f => f.id === id);
      if (isAFolder) {
        moveFolderMutation.mutate({ id, parentId: targetFolderId });
      } else {
        const fileEntry = files.find(f => f.id === id);
        if (fileEntry) {
          moveFileMutation.mutate({ id, folderId: targetFolderId });
        } else {
          // Virtual note or document — create a file_ref to link it to the folder
          const entry = entries.find(e => e.id === id);
          if (entry && (entry.kind === "note" || entry.kind === "document")) {
            linkEntryToFolderMutation.mutate({ entry, folderId: targetFolderId });
          }
        }
      }
    });
    draggedIdsRef.current = [];
    setSelectedIds(new Set());
  };

  const handleDragEnd = () => {
    setDragOverFolderId(null);
    draggedIdsRef.current = [];
  };

  // ---------- File upload ----------
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesToUpload = Array.from(fileList);
    setUploadingFiles(filesToUpload.map(f => f.name));

    let successCount = 0;
    let errorCount = 0;

    for (const file of filesToUpload) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (currentFolderId) formData.append("folderId", currentFolderId);
        if (clientId) formData.append("clientId", clientId);
        if (projectId) formData.append("projectId", projectId);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || "";
        const uploadRes = await fetch("/api/files/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => "erreur inconnue");
          throw new Error(`${uploadRes.status}: ${errText}`);
        }
        await uploadRes.json();

        successCount++;
      } catch {
        errorCount++;
      }
    }

    setUploadingFiles([]);
    invalidate();
    if (e.target) e.target.value = "";

    if (successCount > 0) toast({ title: `${successCount} fichier${successCount > 1 ? "s" : ""} uploadé${successCount > 1 ? "s" : ""}`, className: "bg-green-600 border-green-600 text-white" });
    if (errorCount > 0) toast({ title: "Erreur", description: `${errorCount} fichier(s) n'ont pas pu être uploadés`, variant: "destructive" });
  };

  // ---------- Misc handlers ----------
  const handleRename = () => {
    if (!renameTarget || !renameName.trim()) return;
    if (renameTarget.kind === "folder") renameFolderMutation.mutate({ id: renameTarget.id, name: renameName.trim() });
    else renameFileMutation.mutate({ id: renameTarget.id, name: renameName.trim() });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "folder") deleteFolderMutation.mutate(deleteTarget.id);
    else deleteFileMutation.mutate(deleteTarget.id);
  };

  const selectedFolderIds = [...selectedIds].filter(id => folders.some(f => f.id === id));
  const selectedFileIds = [...selectedIds].filter(id => files.some(f => f.id === id));
  const operableSelectedCount = selectedFolderIds.length + selectedFileIds.length;

  // Rubber band rect
  const rubberRect = rubberBandStart && rubberBandCurrent
    ? {
        left: Math.min(rubberBandStart.x, rubberBandCurrent.x),
        top: Math.min(rubberBandStart.y, rubberBandCurrent.y),
        width: Math.abs(rubberBandCurrent.x - rubberBandStart.x),
        height: Math.abs(rubberBandCurrent.y - rubberBandStart.y),
      }
    : null;

  return (
    <div className="flex flex-col h-full select-none" data-testid="file-explorer">
      {/* Top toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b flex-wrap">
        <nav className="flex items-center gap-1 text-sm overflow-hidden flex-1 min-w-0" data-testid="breadcrumb-nav">
          {breadcrumb.map((item, idx) => (
            <span key={idx} className="flex items-center gap-1 min-w-0">
              {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
              {idx === breadcrumb.length - 1 ? (
                <span className="font-medium text-foreground truncate flex items-center gap-1">
                  {idx === 0 && <Home className="w-3 h-3" />}
                  {item.name}
                </span>
              ) : (
                <button
                  onClick={() => navigateBreadcrumb(idx)}
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  data-testid={`breadcrumb-item-${idx}`}
                >
                  {idx === 0 && <Home className="w-3 h-3" />}
                  {item.name}
                </button>
              )}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" variant="secondary" className="bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/20" onClick={() => { setFolderSheetOpen(true); folderForm.reset(); }} data-testid="button-new-folder">
            <Plus className="w-3.5 h-3.5" />
            Dossier
          </Button>
          <Button size="sm" variant="secondary" className="bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/20" onClick={() => { setNoteSheetOpen(true); noteForm.reset(); }} data-testid="button-new-note">
            <Plus className="w-3.5 h-3.5" />
            Note
          </Button>
          <Button size="sm" variant="secondary" className="bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/20" onClick={() => setLocation("/documents/templates")} data-testid="button-new-document">
            <Plus className="w-3.5 h-3.5" />
            Document
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/20"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFiles.length > 0}
            data-testid="button-upload-file"
          >
            {uploadingFiles.length > 0
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Upload className="w-3.5 h-3.5" />}
            Importer
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
            data-testid="input-file-upload"
          />
        </div>
      </div>

      {/* Search + sort + filters bar OR selection bar */}
      {selectedIds.size > 0 ? (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-primary/5" data-testid="selection-bar">
          <span className="text-xs font-medium flex-1">
            {selectedIds.size} élément{selectedIds.size > 1 ? "s" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          {operableSelectedCount > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => duplicateSelectedMutation.mutate([...selectedFolderIds, ...selectedFileIds])} disabled={duplicateSelectedMutation.isPending} data-testid="button-duplicate-selected">
                <Copy className="w-3.5 h-3.5" />
                Dupliquer
              </Button>
              <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => setDeleteSelectedOpen(true)} data-testid="button-delete-selected">
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} data-testid="button-deselect">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b">
          {/* Search input - smaller */}
          <div className="relative w-44 flex-shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher…"
              className="pl-7 h-7 text-xs"
              data-testid="input-search-files"
            />
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-32 h-7 text-xs flex-shrink-0" data-testid="select-sort-files">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="type">Type</SelectItem>
            </SelectContent>
          </Select>

          {/* Type filter toggles */}
          <div className="flex items-center gap-1 flex-1 overflow-x-auto" data-testid="filter-type-group">
            {(["folder", "note", "document", "pdf", "image"] as FilterKind[]).map(kind => (
              <button
                key={kind}
                onClick={() => toggleFilter(kind)}
                className={[
                  "flex-shrink-0 text-xs px-2 py-0.5 rounded-md border transition-colors",
                  activeFilters.has(kind)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/30",
                ].join(" ")}
                data-testid={`filter-${kind}`}
              >
                {FILTER_LABELS[kind]}
              </button>
            ))}
            {activeFilters.size > 0 && (
              <button onClick={() => setActiveFilters(new Set())} className="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground px-1" data-testid="filter-clear">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload progress indicator */}
      {uploadingFiles.length > 0 && (
        <div className="px-3 py-1.5 bg-primary/5 border-b text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Upload en cours : {uploadingFiles.join(", ")}
        </div>
      )}

      {/* Content area — also handles drag & drop via event delegation */}
      <div
        ref={contentRef}
        className="flex-1 overflow-auto p-3 relative"
        onMouseDown={handleContentMouseDown}
        onClick={handleContentClick}
        onDragOver={handleContentDragOver}
        onDragLeave={handleContentDragLeave}
        onDrop={handleContentDrop}
        data-testid="explorer-content"
      >
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <FolderOpen className="w-10 h-10 opacity-40" />
            <p className="text-sm">{searchQuery || activeFilters.size > 0 ? "Aucun résultat" : "Ce dossier est vide"}</p>
            {!searchQuery && activeFilters.size === 0 && (
              <p className="text-xs opacity-70">Créez un dossier, une note ou importez un document</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {filteredFolders.map(folder => (
              <ExplorerItem
                key={folder.id}
                id={folder.id}
                kind="folder"
                name={folder.name}
                isSelected={selectedIds.has(folder.id)}
                isDragOver={dragOverFolderId === folder.id}
                folderStats={folderStatsCache[folder.id]}
                onHoverEnter={() => fetchFolderStats(folder.id)}
                onSingleClick={e => toggleSelect(folder.id, e)}
                onDoubleClick={e => { e.stopPropagation(); openFolder(folder); }}
                onRename={() => { setRenameTarget({ id: folder.id, kind: "folder", name: folder.name }); setRenameName(folder.name); }}
                onDelete={() => setDeleteTarget({ id: folder.id, kind: "folder", name: folder.name })}
                onDuplicate={() => duplicateSelectedMutation.mutate([folder.id])}
                canEdit
                onDragStart={e => handleDragStart(e, folder.id)}
                onDragEnd={handleDragEnd}
              />
            ))}
            {filteredEntries.map(entry => (
              <ExplorerItem
                key={entry.isFileEntry ? `file-${entry.id}` : `raw-${entry.id}`}
                id={entry.id}
                kind={entry.kind}
                name={entry.name}
                mimeType={entry.mimeType}
                isSelected={selectedIds.has(entry.id)}
                isDragOver={false}
                onSingleClick={e => toggleSelect(entry.id, e)}
                onDoubleClick={e => { e.stopPropagation(); openFile(entry); }}
                onRename={() => {
                  if (entry.isFileEntry) {
                    setRenameTarget({ id: entry.id, kind: "file", name: entry.name });
                    setRenameName(entry.name);
                  }
                }}
                onDelete={() => { if (entry.isFileEntry) setDeleteTarget({ id: entry.id, kind: "file", name: entry.name }); }}
                onDuplicate={entry.isFileEntry ? () => duplicateSelectedMutation.mutate([entry.id]) : undefined}
                canEdit={!!entry.isFileEntry}
                onDragStart={e => handleDragStart(e, entry.id)}
                onDragEnd={handleDragEnd}
                onDownload={entry.kind === "upload" ? () => openFile(entry) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rubber band overlay */}
      {rubberRect && rubberRect.width > 4 && rubberRect.height > 4 && (
        <div
          style={{
            position: "fixed",
            left: rubberRect.left,
            top: rubberRect.top,
            width: rubberRect.width,
            height: rubberRect.height,
            border: "1.5px dashed rgba(124,58,237,0.7)",
            backgroundColor: "rgba(124,58,237,0.08)",
            pointerEvents: "none",
            zIndex: 9999,
            borderRadius: 4,
          }}
        />
      )}

      {/* Folder creation sheet */}
      <Sheet open={folderSheetOpen} onOpenChange={setFolderSheetOpen}>
        <SheetContent className="sm:max-w-md" data-testid="sheet-create-folder">
          <SheetHeader><SheetTitle>Nouveau dossier</SheetTitle></SheetHeader>
          <Form {...folderForm}>
            <form onSubmit={folderForm.handleSubmit(data => createFolderMutation.mutate(data.name))} className="space-y-4 mt-4">
              <FormField control={folderForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du dossier</FormLabel>
                  <FormControl><Input {...field} autoFocus data-testid="input-folder-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setFolderSheetOpen(false)} className="flex-1">Annuler</Button>
                <Button type="submit" disabled={createFolderMutation.isPending} className="flex-1" data-testid="button-create-folder-confirm">Créer</Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Note creation sheet */}
      <Sheet open={noteSheetOpen} onOpenChange={setNoteSheetOpen}>
        <SheetContent className="sm:max-w-md" data-testid="sheet-create-note">
          <SheetHeader><SheetTitle>Nouvelle note</SheetTitle></SheetHeader>
          <Form {...noteForm}>
            <form onSubmit={noteForm.handleSubmit(data => createNoteMutation.mutate(data.title))} className="space-y-4 mt-4">
              <FormField control={noteForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre</FormLabel>
                  <FormControl><Input {...field} autoFocus data-testid="input-note-title" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setNoteSheetOpen(false)} className="flex-1">Annuler</Button>
                <Button type="submit" disabled={createNoteMutation.isPending} className="flex-1" data-testid="button-create-note-confirm">Créer</Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Single rename dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={open => !open && setRenameTarget(null)}>
        <DialogContent data-testid="dialog-rename">
          <DialogHeader><DialogTitle>Renommer</DialogTitle></DialogHeader>
          <Input value={renameName} onChange={e => setRenameName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRename()} autoFocus data-testid="input-rename" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)} data-testid="button-rename-cancel">Annuler</Button>
            <Button onClick={handleRename} disabled={!renameName.trim() || renameFolderMutation.isPending || renameFileMutation.isPending} data-testid="button-rename-confirm">Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="dialog-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleteTarget?.kind === "folder" ? "le dossier" : "le fichier"}</AlertDialogTitle>
            <AlertDialogDescription>Voulez-vous vraiment supprimer <strong>{deleteTarget?.name}</strong> ? Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-delete-confirm">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Multi-selection delete confirmation */}
      <AlertDialog open={deleteSelectedOpen} onOpenChange={setDeleteSelectedOpen}>
        <AlertDialogContent data-testid="dialog-delete-selected">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {operableSelectedCount} élément{operableSelectedCount > 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription>Cette action supprimera définitivement les {operableSelectedCount} éléments sélectionnés. Elle est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSelectedMutation.mutate([...selectedFolderIds, ...selectedFileIds])} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-selected">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File preview dialog — images & PDFs */}
      <Dialog open={previewFile !== null} onOpenChange={open => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden" data-testid="dialog-file-preview">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm font-medium truncate">{previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted/30 min-h-[60vh] max-h-[80vh]">
            {previewFile?.mimeType?.startsWith("image/") ? (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="max-w-full max-h-[78vh] object-contain"
                data-testid="preview-image"
              />
            ) : previewFile?.mimeType === "application/pdf" ? (
              <iframe
                src={previewFile.url}
                title={previewFile.name}
                className="w-full min-h-[75vh]"
                data-testid="preview-pdf"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- ExplorerItem sub-component ----------
interface ExplorerItemProps {
  id: string;
  kind: "folder" | "note" | "document" | "upload";
  name: string;
  mimeType?: string | null;
  isSelected: boolean;
  isDragOver: boolean;
  folderStats?: FolderStats | "loading";
  onHoverEnter?: () => void;
  onSingleClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onRename: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  canEdit?: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDownload?: () => void;
}

function FolderStatsLabel({ stats }: { stats: FolderStats | "loading" | undefined }) {
  if (!stats || stats === "loading") return <span className="text-xs text-muted-foreground">Chargement…</span>;
  const parts: string[] = [];
  if (stats.subFolderCount > 0) parts.push(`${stats.subFolderCount} sous-dossier${stats.subFolderCount > 1 ? "s" : ""}`);
  if (stats.fileCount > 0) parts.push(`${stats.fileCount} fichier${stats.fileCount > 1 ? "s" : ""}`);
  return <span className="text-xs">{parts.length ? parts.join(", ") : "Vide"}</span>;
}

function kindIcon(kind: string, mimeType?: string | null): { icon: React.ReactNode; color: string } {
  if (kind === "note") return { icon: <FileText className="w-8 h-8" />, color: "text-violet-400" };
  if (kind === "document") return { icon: <FileIcon className="w-8 h-8" />, color: "text-cyan-400" };
  if (kind === "upload") {
    if (mimeType?.startsWith("image/")) return { icon: <FileIcon className="w-8 h-8" />, color: "text-emerald-400" };
    if (mimeType === "application/pdf") return { icon: <FileIcon className="w-8 h-8" />, color: "text-rose-400" };
    return { icon: <FileIcon className="w-8 h-8" />, color: "text-orange-400" };
  }
  return { icon: <FileIcon className="w-8 h-8" />, color: "text-muted-foreground" };
}

function ExplorerItem({
  id, kind, name, mimeType, isSelected, isDragOver, folderStats, onHoverEnter,
  onSingleClick, onDoubleClick, onRename, onDelete, onDuplicate, canEdit = true,
  onDragStart, onDragEnter, onDragOver, onDragLeave, onDrop, onDragEnd, onDownload,
}: ExplorerItemProps) {
  const isFolder = kind === "folder";
  const { icon, color } = isFolder
    ? { icon: <FilledFolderIcon className="w-8 h-8 text-amber-300" />, color: "text-amber-300" }
    : kindIcon(kind, mimeType);

  const inner = (
    <div
      data-explorer-id={id}
      draggable
      className={[
        "group relative flex flex-col items-center gap-1.5 p-2 rounded-md cursor-pointer transition-colors",
        isSelected ? "bg-primary/15 ring-1 ring-primary/40" : "hover-elevate",
        isDragOver ? "bg-primary/20 ring-2 ring-primary" : "",
      ].join(" ")}
      onClick={onSingleClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onHoverEnter}
      onDragStart={onDragStart}
      onDragEnter={isFolder ? onDragEnter : undefined}
      onDragOver={isFolder ? onDragOver : undefined}
      onDragLeave={isFolder ? onDragLeave : undefined}
      onDrop={isFolder ? onDrop : undefined}
      onDragEnd={onDragEnd}
      data-testid={`explorer-item-${id}`}
    >
      <div className={color}>{isFolder ? <FilledFolderIcon className="w-8 h-8" /> : icon}</div>
      <span className="text-xs text-center text-foreground line-clamp-2 w-full leading-tight">{name}</span>

      {/* Kind badge for non-folder items */}
      {!isFolder && (() => {
        let label = "Fichier";
        let cls = "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
        if (kind === "note") { label = "Note"; cls = "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"; }
        else if (kind === "document") { label = "Doc"; cls = "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"; }
        else if (kind === "upload" && mimeType) {
          if (mimeType === "application/pdf") { label = "PDF"; cls = "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"; }
          else if (mimeType.startsWith("image/")) {
            label = (mimeType.split("/")[1] || "image").toUpperCase().slice(0, 4);
            cls = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
          }
        }
        return <span className={`text-[9px] px-1 rounded-sm font-medium ${cls}`}>{label}</span>;
      })()}

      {/* Context menu */}
      <div
        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-5 w-5" data-testid={`button-item-menu-${id}`}>
              <MoreVertical className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onDoubleClick as any} data-testid={`menu-open-${id}`}>
              {isFolder ? <FolderOpen className="w-3.5 h-3.5" /> : kind === "upload" ? <Download className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              {isFolder ? "Ouvrir" : kind === "upload" ? "Télécharger" : "Ouvrir"}
            </DropdownMenuItem>
            {(canEdit || onDuplicate) && (
              <>
                {canEdit && (
                  <DropdownMenuItem onClick={onRename} data-testid={`menu-rename-${id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                    Renommer
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); onDuplicate(); }} data-testid={`menu-duplicate-${id}`}>
                    <Copy className="w-3.5 h-3.5" />
                    Dupliquer
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {canEdit && (
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive" data-testid={`menu-delete-${id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  if (isFolder) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="flex flex-col gap-0.5 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-md"
        >
          <span className="font-medium text-xs">{name}</span>
          <FolderStatsLabel stats={folderStats} />
        </TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}
