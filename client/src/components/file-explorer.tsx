import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Folder, File } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import {
  Folder as FolderIcon,
  FolderOpen,
  FileText,
  File as FileIcon,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronRight,
  Home,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  clientId?: string;
  projectId?: string;
}

type BreadcrumbItem = { id: string | null; name: string };

type CreateDialog = "folder" | "note" | "document" | null;
type RenameTarget = { id: string; kind: "folder" | "file"; name: string } | null;
type DeleteTarget = { id: string; kind: "folder" | "file"; name: string } | null;

function buildFolderQK(parentId: string | null, clientId?: string, projectId?: string) {
  return ["/api/folders", { parentId, clientId, projectId }];
}
function buildFileQK(folderId: string | null, clientId?: string, projectId?: string) {
  return ["/api/files", { folderId, clientId, projectId }];
}

export function FileExplorer({ clientId, projectId }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: "Fichiers" }]);

  const [createDialog, setCreateDialog] = useState<CreateDialog>(null);
  const [createName, setCreateName] = useState("");

  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [renameName, setRenameName] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const folderQK = buildFolderQK(currentFolderId, clientId, projectId);
  const fileQK = buildFileQK(currentFolderId, clientId, projectId);

  const foldersParams = new URLSearchParams();
  if (currentFolderId !== null) foldersParams.set("parentId", currentFolderId);
  else foldersParams.set("parentId", "");
  if (clientId) foldersParams.set("clientId", clientId);
  if (projectId) foldersParams.set("projectId", projectId);

  const filesParams = new URLSearchParams();
  if (currentFolderId !== null) filesParams.set("folderId", currentFolderId);
  else filesParams.set("folderId", "");
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

  const isLoading = foldersLoading || filesLoading;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/files"] });
  };

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("/api/folders", "POST", {
        name,
        parentId: currentFolderId || null,
        clientId: clientId || null,
        projectId: projectId || null,
        scope: clientId ? "client" : projectId ? "project" : "generic",
      }),
    onSuccess: () => { invalidate(); setCreateDialog(null); setCreateName(""); },
    onError: () => toast({ title: "Erreur", description: "Impossible de créer le dossier", variant: "destructive" }),
  });

  const createNoteMutation = useMutation({
    mutationFn: (title: string) =>
      apiRequest("/api/files/note", "POST", {
        title,
        folderId: currentFolderId || null,
        clientId: clientId || null,
        projectId: projectId || null,
      }),
    onSuccess: (data: any) => {
      invalidate();
      setCreateDialog(null);
      setCreateName("");
      if (data?.note?.id) setLocation(`/notes/${data.note.id}`);
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de créer la note", variant: "destructive" }),
  });

  const createDocumentMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("/api/files/document", "POST", {
        name,
        folderId: currentFolderId || null,
        clientId: clientId || null,
        projectId: projectId || null,
      }),
    onSuccess: (data: any) => {
      invalidate();
      setCreateDialog(null);
      setCreateName("");
      if (data?.document?.id) setLocation(`/documents/${data.document.id}`);
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de créer le document", variant: "destructive" }),
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

  const openFile = (file: File) => {
    if (file.kind === "note_ref" && file.entityId) {
      setLocation(`/notes/${file.entityId}`);
    } else if (file.kind === "doc_internal" && file.entityId) {
      setLocation(`/documents/${file.entityId}`);
    }
  };

  const handleCreate = () => {
    if (!createName.trim()) return;
    if (createDialog === "folder") createFolderMutation.mutate(createName.trim());
    else if (createDialog === "note") createNoteMutation.mutate(createName.trim());
    else if (createDialog === "document") createDocumentMutation.mutate(createName.trim());
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

  const isEmpty = !isLoading && folders.length === 0 && files.length === 0;

  return (
    <div className="flex flex-col h-full" data-testid="file-explorer">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b flex-wrap">
        {/* Breadcrumb */}
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

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={() => { setCreateDialog("folder"); setCreateName(""); }} data-testid="button-new-folder">
            <FolderIcon className="w-3.5 h-3.5" />
            Nouveau dossier
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setCreateDialog("note"); setCreateName(""); }} data-testid="button-new-note">
            <FileText className="w-3.5 h-3.5" />
            Note
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setCreateDialog("document"); setCreateName(""); }} data-testid="button-new-document">
            <FileIcon className="w-3.5 h-3.5" />
            Document
          </Button>
        </div>
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
            <p className="text-sm">Ce dossier est vide</p>
            <p className="text-xs opacity-70">Créez un dossier, une note ou un document pour commencer</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {/* Folders first */}
            {folders.map(folder => (
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
            {/* Files */}
            {files.map(file => (
              <ExplorerItem
                key={file.id}
                id={file.id}
                kind={file.kind === "note_ref" ? "note" : "document"}
                name={file.name}
                onOpen={() => openFile(file)}
                onRename={() => { setRenameTarget({ id: file.id, kind: "file", name: file.name }); setRenameName(file.name); }}
                onDelete={() => setDeleteTarget({ id: file.id, kind: "file", name: file.name })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialog !== null} onOpenChange={open => !open && setCreateDialog(null)}>
        <DialogContent data-testid="dialog-create">
          <DialogHeader>
            <DialogTitle>
              {createDialog === "folder" ? "Nouveau dossier" : createDialog === "note" ? "Nouvelle note" : "Nouveau document"}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            placeholder={createDialog === "folder" ? "Nom du dossier" : createDialog === "note" ? "Titre de la note" : "Nom du document"}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            autoFocus
            data-testid="input-create-name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(null)} data-testid="button-create-cancel">Annuler</Button>
            <Button
              onClick={handleCreate}
              disabled={!createName.trim() || createFolderMutation.isPending || createNoteMutation.isPending || createDocumentMutation.isPending}
              data-testid="button-create-confirm"
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
}

function ExplorerItem({ id, kind, name, onOpen, onRename, onDelete }: ExplorerItemProps) {
  const Icon = kind === "folder" ? FolderIcon : kind === "note" ? FileText : FileIcon;
  const iconColor =
    kind === "folder" ? "text-amber-500" : kind === "note" ? "text-violet-500" : "text-cyan-500";

  return (
    <div
      className="group relative flex flex-col items-center gap-2 p-3 rounded-md hover-elevate cursor-pointer select-none"
      onClick={onOpen}
      data-testid={`explorer-item-${id}`}
    >
      <Icon className={`w-10 h-10 ${iconColor}`} />
      <span className="text-xs text-center text-foreground line-clamp-2 w-full text-center leading-tight">{name}</span>

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
    </div>
  );
}
