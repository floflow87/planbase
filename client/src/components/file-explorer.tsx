import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Props {
  clientId?: string;
  projectId?: string;
}

type BreadcrumbItem = { id: string | null; name: string };
type SortBy = "name" | "date";
type RenameTarget = { id: string; kind: "folder" | "file"; name: string } | null;
type DeleteTarget = { id: string; kind: "folder" | "file"; name: string } | null;

type ExplorerEntry = {
  id: string;
  kind: "folder" | "note" | "document";
  name: string;
  updatedAt?: string | Date | null;
  entityId?: string | null;
  isFileEntry?: boolean;
};

function buildFolderQK(parentId: string | null, clientId?: string, projectId?: string) {
  return ["/api/folders", { parentId, clientId, projectId }];
}
function buildFileQK(folderId: string | null, clientId?: string, projectId?: string) {
  return ["/api/files", { folderId, clientId, projectId }];
}

function FilledFolderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
    </svg>
  );
}

const noteSchema = z.object({ title: z.string().min(1, "Titre requis") });
const folderSchema = z.object({ name: z.string().min(1, "Nom requis") });

export function FileExplorer({ clientId, projectId }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: "Fichiers" }]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");

  const [folderSheetOpen, setFolderSheetOpen] = useState(false);
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);

  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const isAtRoot = currentFolderId === null;

  const folderQK = buildFolderQK(currentFolderId, clientId, projectId);
  const fileQK = buildFileQK(currentFolderId, clientId, projectId);

  const foldersParams = new URLSearchParams();
  foldersParams.set("parentId", currentFolderId ?? "");
  if (clientId) foldersParams.set("clientId", clientId);
  if (projectId) foldersParams.set("projectId", projectId);

  const filesParams = new URLSearchParams();
  filesParams.set("folderId", currentFolderId ?? "");
  if (clientId) filesParams.set("clientId", clientId);
  if (projectId) filesParams.set("projectId", projectId);

  const { data: folders = [], isLoading: foldersLoading } = useQuery<Folder[]>({
    queryKey: folderQK,
    queryFn: () => apiRequest(`/api/folders?${foldersParams.toString()}`, "GET").then(r => r.json()),
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<File[]>({
    queryKey: fileQK,
    queryFn: () => apiRequest(`/api/files?${filesParams.toString()}`, "GET").then(r => r.json()),
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/files"] });
  };

  const noteForm = useForm({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: "" },
  });

  const folderForm = useForm({
    resolver: zodResolver(folderSchema),
    defaultValues: { name: "" },
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("/api/folders", "POST", {
        name,
        parentId: currentFolderId || null,
        clientId: clientId || null,
        projectId: projectId || null,
        scope: clientId ? "client" : projectId ? "project" : "generic",
      }),
    onSuccess: () => {
      invalidate();
      setFolderSheetOpen(false);
      folderForm.reset();
    },
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
      const noteId = data?.note?.id;
      if (noteId) setLocation(`/notes/${noteId}`);
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de créer la note", variant: "destructive" }),
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiRequest(`/api/folders/${id}`, "PATCH", { name }),
    onSuccess: () => { invalidate(); setRenameTarget(null); },
    onError: () => toast({ title: "Erreur", description: "Impossible de renommer", variant: "destructive" }),
  });

  const renameFileMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiRequest(`/api/files/${id}`, "PATCH", { name }),
    onSuccess: () => { invalidate(); setRenameTarget(null); },
    onError: () => toast({ title: "Erreur", description: "Impossible de renommer", variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/folders/${id}`, "DELETE"),
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
    onError: () => toast({ title: "Erreur", description: "Impossible de supprimer le dossier", variant: "destructive" }),
  });

  const deleteFileMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/files/${id}`, "DELETE"),
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
    onError: () => toast({ title: "Erreur", description: "Impossible de supprimer le fichier", variant: "destructive" }),
  });

  const openFolder = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumb(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateBreadcrumb = (idx: number) => {
    const item = breadcrumb[idx];
    setCurrentFolderId(item.id);
    setBreadcrumb(prev => prev.slice(0, idx + 1));
  };

  const openFile = (entry: ExplorerEntry) => {
    if (entry.kind === "note") {
      const targetId = entry.entityId || entry.id;
      setLocation(`/notes/${targetId}`);
    } else if (entry.kind === "document") {
      const targetId = entry.entityId || entry.id;
      setLocation(`/documents/${targetId}`);
    }
  };

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

  const indexedNoteIds = useMemo(() => new Set(files.filter(f => f.kind === "note_ref" && f.entityId).map(f => f.entityId!)), [files]);
  const indexedDocIds = useMemo(() => new Set(files.filter(f => f.kind === "doc_internal" && f.entityId).map(f => f.entityId!)), [files]);

  const entries: ExplorerEntry[] = useMemo(() => {
    const result: ExplorerEntry[] = [];

    if (isAtRoot) {
      const filteredNotes = allNotes
        .filter(n => !indexedNoteIds.has(n.id))
        .filter(n => !clientId || n.clientId === clientId)
        .filter(n => !projectId || n.projectId === projectId);

      const filteredDocs = allDocuments
        .filter(d => !indexedDocIds.has(d.id))
        .filter(d => !clientId || d.clientId === clientId)
        .filter(d => !projectId || d.projectId === projectId);

      for (const n of filteredNotes) {
        result.push({ id: n.id, kind: "note", name: n.title || "Sans titre", updatedAt: n.updatedAt, entityId: n.id });
      }
      for (const d of filteredDocs) {
        result.push({ id: d.id, kind: "document", name: d.name || "Sans titre", updatedAt: d.updatedAt, entityId: d.id });
      }
    }

    for (const f of files) {
      result.push({
        id: f.id,
        kind: f.kind === "note_ref" ? "note" : "document",
        name: f.name,
        updatedAt: f.createdAt,
        entityId: f.entityId,
        isFileEntry: true,
      });
    }

    return result;
  }, [isAtRoot, allNotes, allDocuments, files, indexedNoteIds, indexedDocIds, clientId, projectId]);

  const filteredFolders = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const list = q ? folders.filter(f => f.name.toLowerCase().includes(q)) : folders;
    if (sortBy === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [folders, searchQuery, sortBy]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const list = q ? entries.filter(e => e.name.toLowerCase().includes(q)) : entries;
    if (sortBy === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "date") {
      return [...list].sort((a, b) => {
        const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bDate - aDate;
      });
    }
    return list;
  }, [entries, searchQuery, sortBy]);

  const isEmpty = !isLoading && filteredFolders.length === 0 && filteredEntries.length === 0;

  return (
    <div className="flex flex-col h-full" data-testid="file-explorer">
      {/* Top toolbar: breadcrumb + actions */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b flex-wrap">
        <nav className="flex items-center gap-1 text-sm overflow-hidden" data-testid="breadcrumb-nav">
          {breadcrumb.map((item, idx) => (
            <span key={idx} className="flex items-center gap-1 min-w-0">
              {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
              {idx === breadcrumb.length - 1 ? (
                <span className="font-medium text-foreground truncate flex items-center gap-1">
                  {idx === 0 ? <Home className="w-3 h-3" /> : null}
                  {item.name}
                </span>
              ) : (
                <button
                  onClick={() => navigateBreadcrumb(idx)}
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  data-testid={`breadcrumb-item-${idx}`}
                >
                  {idx === 0 ? <Home className="w-3 h-3" /> : null}
                  {item.name}
                </button>
              )}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={() => { setFolderSheetOpen(true); folderForm.reset(); }} data-testid="button-new-folder">
            <FolderPlus className="w-3.5 h-3.5" />
            Nouveau dossier
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setNoteSheetOpen(true); noteForm.reset(); }} data-testid="button-new-note">
            <FileText className="w-3.5 h-3.5" />
            Note
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLocation("/documents/templates")} data-testid="button-new-document">
            <FileIcon className="w-3.5 h-3.5" />
            Document
          </Button>
        </div>
      </div>

      {/* Search + sort bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="pl-8 h-8 text-xs"
            data-testid="input-search-files"
          />
        </div>
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-sort-files">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Trier par Nom</SelectItem>
            <SelectItem value="date">Trier par Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-md" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <FolderOpen className="w-10 h-10 opacity-40" />
            <p className="text-sm">
              {searchQuery ? "Aucun résultat" : "Ce dossier est vide"}
            </p>
            {!searchQuery && (
              <p className="text-xs opacity-70">Créez un dossier, une note ou un document pour commencer</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredFolders.map(folder => (
              <ExplorerItem
                key={folder.id}
                id={folder.id}
                kind="folder"
                name={folder.name}
                onOpen={() => openFolder(folder)}
                onRename={() => { setRenameTarget({ id: folder.id, kind: "folder", name: folder.name }); setRenameName(folder.name); }}
                onDelete={() => setDeleteTarget({ id: folder.id, kind: "folder", name: folder.name })}
              />
            ))}
            {filteredEntries.map(entry => (
              <ExplorerItem
                key={entry.isFileEntry ? `file-${entry.id}` : `raw-${entry.id}`}
                id={entry.id}
                kind={entry.kind}
                name={entry.name}
                onOpen={() => openFile(entry)}
                onRename={() => {
                  if (entry.isFileEntry) {
                    setRenameTarget({ id: entry.id, kind: "file", name: entry.name });
                    setRenameName(entry.name);
                  }
                }}
                onDelete={() => {
                  if (entry.isFileEntry) {
                    setDeleteTarget({ id: entry.id, kind: "file", name: entry.name });
                  }
                }}
                canEdit={!!entry.isFileEntry}
              />
            ))}
          </div>
        )}
      </div>

      {/* Folder creation sheet */}
      <Sheet open={folderSheetOpen} onOpenChange={setFolderSheetOpen}>
        <SheetContent className="sm:max-w-md" data-testid="sheet-create-folder">
          <SheetHeader>
            <SheetTitle>Nouveau dossier</SheetTitle>
          </SheetHeader>
          <Form {...folderForm}>
            <form
              onSubmit={folderForm.handleSubmit(data => createFolderMutation.mutate(data.name))}
              className="space-y-4 mt-4"
            >
              <FormField
                control={folderForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du dossier</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus data-testid="input-folder-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setFolderSheetOpen(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" disabled={createFolderMutation.isPending} className="flex-1" data-testid="button-create-folder-confirm">
                  Créer
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Note creation sheet */}
      <Sheet open={noteSheetOpen} onOpenChange={setNoteSheetOpen}>
        <SheetContent className="sm:max-w-md" data-testid="sheet-create-note">
          <SheetHeader>
            <SheetTitle>Nouvelle note</SheetTitle>
          </SheetHeader>
          <Form {...noteForm}>
            <form
              onSubmit={noteForm.handleSubmit(data => createNoteMutation.mutate(data.title))}
              className="space-y-4 mt-4"
            >
              <FormField
                control={noteForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus data-testid="input-note-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setNoteSheetOpen(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" disabled={createNoteMutation.isPending} className="flex-1" data-testid="button-create-note-confirm">
                  Créer
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Rename Dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={open => !open && setRenameTarget(null)}>
        <DialogContent data-testid="dialog-rename">
          <DialogHeader>
            <DialogTitle>Renommer</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={e => setRenameName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleRename()}
            autoFocus
            data-testid="input-rename"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)} data-testid="button-rename-cancel">Annuler</Button>
            <Button
              onClick={handleRename}
              disabled={!renameName.trim() || renameFolderMutation.isPending || renameFileMutation.isPending}
              data-testid="button-rename-confirm"
            >
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="dialog-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleteTarget?.kind === "folder" ? "le dossier" : "le fichier"}</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer <strong>{deleteTarget?.name}</strong> ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-confirm"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ExplorerItemProps {
  id: string;
  kind: "folder" | "note" | "document";
  name: string;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  canEdit?: boolean;
}

function ExplorerItem({ id, kind, name, onOpen, onRename, onDelete, canEdit = true }: ExplorerItemProps) {
  const iconColor =
    kind === "folder" ? "text-amber-300" : kind === "note" ? "text-violet-400" : "text-cyan-400";

  return (
    <div
      className="group relative flex flex-col items-center gap-2 p-3 rounded-md hover-elevate cursor-pointer select-none"
      onClick={onOpen}
      data-testid={`explorer-item-${id}`}
    >
      {kind === "folder" ? (
        <FilledFolderIcon className={`w-10 h-10 ${iconColor}`} />
      ) : kind === "note" ? (
        <FileText className={`w-10 h-10 ${iconColor}`} />
      ) : (
        <FileIcon className={`w-10 h-10 ${iconColor}`} />
      )}
      <span className="text-xs text-center text-foreground line-clamp-2 w-full text-center leading-tight">{name}</span>

      {canEdit && (
        <div
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6" data-testid={`button-item-menu-${id}`}>
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onOpen} data-testid={`menu-open-${id}`}>
                {kind === "folder" ? <FolderOpen className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                Ouvrir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRename} data-testid={`menu-rename-${id}`}>
                <Pencil className="w-3.5 h-3.5" />
                Renommer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
                data-testid={`menu-delete-${id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
