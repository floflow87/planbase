import { useState, useCallback, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Eye, EyeOff, Trash2, LinkIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import NoteEditor from "@/components/NoteEditor";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Document, Project, NoteLink } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditMode, setIsEditMode] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>({ type: 'doc', content: [] });
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

  // Fetch document
  const { data: document, isLoading } = useQuery<Document>({
    queryKey: ["/api/documents", id],
    enabled: !!id,
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch document links (we'll use the same note links table)
  const { data: documentLinks = [] } = useQuery<NoteLink[]>({
    queryKey: ["/api/notes", id, "links"],
    enabled: !!id,
  });

  // Find linked project
  const linkedProject = documentLinks.find(link => link.targetType === "project");
  const currentProject = linkedProject ? projects.find(p => p.id === linkedProject.targetId) : null;

  // Initialize form with document data ONLY on first load
  useEffect(() => {
    if (document && !title && !content.content?.length) {
      setTitle(document.name || "");
      setContent(document.content || { type: 'doc', content: [] });
      setStatus((document.status === "signed" ? "published" : document.status) as any);
    }
  }, [document]);

  // Debounced values for autosave
  const debouncedTitle = useDebounce(title, 1000);
  const debouncedContent = useDebounce(content, 1000);

  // Update document mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Document>) => {
      const response = await apiRequest(`/api/documents/${id}`, "PATCH", data);
      return await response.json();
    },
    onSuccess: () => {
      setLastSaved(new Date());
      setIsSaving(false);
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder le document",
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  // Autosave effect
  useEffect(() => {
    if (!document || !isEditMode || !autoSaveEnabled) return;
    
    const titleChanged = debouncedTitle !== document.name;
    const contentChanged = JSON.stringify(debouncedContent) !== JSON.stringify(document.content);
    const statusChanged = status !== document.status;
    
    if (!titleChanged && !contentChanged && !statusChanged) {
      return;
    }

    setIsSaving(true);

    // Extract plain text from content
    const extractPlainText = (content: any): string => {
      if (!content) return "";
      
      const getText = (node: any): string => {
        if (node.type === "text") {
          return node.text || "";
        }
        if (node.content && Array.isArray(node.content)) {
          return node.content.map(getText).join(" ");
        }
        return "";
      };

      return getText(content);
    };

    const plainText = extractPlainText(debouncedContent);

    updateMutation.mutate({
      name: debouncedTitle || "Sans titre",
      content: debouncedContent,
      plainText,
      status,
    });
  }, [debouncedTitle, debouncedContent, status, document, isEditMode, autoSaveEnabled]);

  // Delete mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/documents/${id}`, "DELETE");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès",
      });
      navigate("/documents");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le document",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    try {
      await deleteDocumentMutation.mutateAsync();
    } finally {
      setDeleteDialogOpen(false);
    }
  }, [deleteDocumentMutation]);

  const handleExportPDF = () => {
    toast({
      title: "Export PDF",
      description: "Fonctionnalité à venir - Export en PDF du document",
    });
  };

  // Project link mutations
  const linkProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest(`/api/notes/${id}/links`, "POST", {
        targetType: "project",
        targetId: projectId,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id, "links"] });
      toast({
        title: "Projet lié",
        description: "Le document a été lié au projet avec succès",
        className: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de lier le projet",
        variant: "destructive",
      });
    },
  });

  const unlinkProjectMutation = useMutation({
    mutationFn: async () => {
      if (!linkedProject) return;
      const response = await apiRequest(
        `/api/notes/${id}/links/${linkedProject.targetType}/${linkedProject.targetId}`,
        "DELETE"
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id, "links"] });
      toast({
        title: "Projet délié",
        description: "Le document n'est plus lié au projet",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de délier le projet",
        variant: "destructive",
      });
    },
  });

  const handleSelectProject = useCallback(async (projectId: string) => {
    try {
      if (linkedProject) {
        await unlinkProjectMutation.mutateAsync();
      }
      await linkProjectMutation.mutateAsync(projectId);
      setProjectSelectorOpen(false);
    } catch (error) {
      // Errors handled by mutations
    }
  }, [linkedProject, linkProjectMutation, unlinkProjectMutation]);

  const handleUnlinkProject = useCallback(() => {
    unlinkProjectMutation.mutate();
  }, [unlinkProjectMutation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Document non trouvé</p>
        <Button onClick={() => navigate("/documents")}>Retour aux documents</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-none border-b border-border bg-background">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <Link href="/documents">
                <Button variant="ghost" size="icon" data-testid="button-back" className="mt-1">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nouveau document"
                  className="text-2xl font-bold border-0 p-0 h-auto focus-visible:ring-0 mb-2"
                  data-testid="input-document-title"
                />
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={
                      status === "draft" 
                        ? "bg-gray-100 text-gray-700 border-gray-200"
                        : "bg-green-50 text-green-700 border-green-200"
                    }
                  >
                    {status === "draft" ? "Brouillon" : "Publié"}
                  </Badge>
                  {isSaving ? (
                    <span className="text-xs text-muted-foreground">Sauvegarde en cours...</span>
                  ) : lastSaved ? (
                    <span className="text-xs text-muted-foreground">
                      Sauvegardé {formatDistanceToNow(lastSaved, { addSuffix: true, locale: fr })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Modifié {formatDistanceToNow(new Date(document.updatedAt), { addSuffix: true, locale: fr })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Auto Save Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="autosave"
                  checked={autoSaveEnabled}
                  onCheckedChange={setAutoSaveEnabled}
                  data-testid="switch-autosave"
                />
                <Label htmlFor="autosave" className="text-sm cursor-pointer">
                  Auto save {autoSaveEnabled ? "ON" : "OFF"}
                </Label>
              </div>
              
              {/* Preview/Edit Toggle */}
              <Button
                variant="outline"
                onClick={() => setIsEditMode(!isEditMode)}
                data-testid="button-toggle-edit"
              >
                {isEditMode ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                {isEditMode ? "Aperçu" : "Modifier"}
              </Button>
              
              {/* Status Dropdown */}
              <select
                value={status}
                onChange={(e) => {
                  const newStatus = e.target.value as any;
                  setStatus(newStatus);
                  updateMutation.mutate({ status: newStatus });
                }}
                className="border border-border rounded-md px-3 h-9 text-sm bg-background"
                data-testid="select-status"
              >
                <option value="draft">Brouillon</option>
                <option value="published">Publié</option>
              </select>
              
              {/* Link to Project */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setProjectSelectorOpen(true)}
                    className={currentProject ? "bg-violet-50 border-violet-200 text-violet-700" : ""}
                    data-testid="button-link-project"
                  >
                    <LinkIcon className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {currentProject ? `Lié à ${currentProject.name}` : "Lier à un projet"}
                </TooltipContent>
              </Tooltip>
              
              {/* Export PDF */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleExportPDF}
                    className="bg-blue-50 border-blue-200 text-blue-700"
                    data-testid="button-export-pdf"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export PDF</TooltipContent>
              </Tooltip>
              
              {/* Delete */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteClick} 
                    size="icon"
                    data-testid="button-delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Supprimer</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Project Selector */}
          {currentProject && (
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Projet:</Label>
              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                {currentProject.name}
                <X 
                  className="ml-2 h-3 w-3 cursor-pointer" 
                  onClick={handleUnlinkProject}
                />
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <NoteEditor
            content={content}
            onChange={setContent}
            editable={isEditMode}
            placeholder="Commencez à rédiger votre document..."
          />
        </div>
      </div>

      {/* Project Selector Dialog */}
      <Popover open={projectSelectorOpen} onOpenChange={setProjectSelectorOpen}>
        <PopoverTrigger asChild>
          <div className="hidden" />
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="end">
          <Command>
            <CommandInput placeholder="Rechercher un projet..." />
            <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-y-auto">
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  onSelect={() => handleSelectProject(project.id)}
                  data-testid={`option-project-${project.id}`}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      currentProject?.id === project.id ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{project.name}</div>
                    {project.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {project.description}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le document</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteDocumentMutation.isPending}
            >
              {deleteDocumentMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
