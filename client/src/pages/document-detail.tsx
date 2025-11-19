import { useState, useCallback, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Eye, EyeOff, Trash2, Download, ChevronDown } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  // Fetch document links
  const { data: documentLinks = [] } = useQuery<NoteLink[]>({
    queryKey: ["/api/documents", id, "links"],
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
        variant: "success",
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

  // Export PDF mutation
  const exportPDFMutation = useMutation({
    mutationFn: async () => {
      // Use fetch directly to avoid body consumption in apiRequest error handler
      const authHeaders = await (async () => {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          return { 'Authorization': `Bearer ${session.access_token}` };
        }
        if (import.meta.env.DEV) {
          return {
            'x-test-account-id': '67a3cb31-7755-43f2-81e0-4436d5d0684f',
            'x-test-user-id': '9fe4ddc0-6d3f-4d69-9c77-fc9cb2e79c8d',
          };
        }
        return {};
      })();
      
      const response = await fetch(`/api/documents/${id}/export-pdf`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = 'document.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) fileName = match[1];
      }
      
      // Get PDF blob
      const blob = await response.blob();
      console.log('📄 PDF blob received:', blob.size, 'bytes, type:', blob.type);
      return { blob, fileName };
    },
    onSuccess: ({ blob, fileName }: { blob: Blob; fileName: string }) => {
      console.log('📄 Creating download for:', fileName, ', size:', blob.size);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link); // Append to body for Firefox
      link.click();
      window.document.body.removeChild(link); // Clean up
      
      // Cleanup
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      
      toast({
        title: "PDF exporté",
        description: "Le document a été exporté en PDF avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'exporter le document en PDF",
        variant: "destructive",
      });
    },
  });

  const handleExportPDF = useCallback(() => {
    if (!id) return;
    exportPDFMutation.mutate();
  }, [id, exportPDFMutation]);

  // Project link mutations
  const linkProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest(`/api/documents/${id}/links`, "POST", {
        targetType: "project",
        targetId: projectId,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "links"] });
      toast({
        title: "Projet lié",
        description: "Le document a été lié au projet avec succès",
        variant: "success",
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
        `/api/documents/${id}/links/${linkedProject.targetType}/${linkedProject.targetId}`,
        "DELETE"
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "links"] });
      toast({
        title: "Projet délié",
        description: "Le document n'est plus lié au projet",
        variant: "success",
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
                <h1 className="text-xl font-bold text-foreground truncate mb-2">
                  {title || "Nouveau document"}
                </h1>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Badge 
                        variant="outline" 
                        className={`cursor-pointer hover-elevate ${
                          status === "draft" 
                            ? "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800"
                            : "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                        }`}
                        data-testid="badge-status"
                      >
                        {status === "draft" ? "Brouillon" : "Publié"}
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </Badge>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={() => {
                          setStatus("draft");
                          updateMutation.mutate({ status: "draft" });
                        }}
                        data-testid="menu-item-draft"
                      >
                        <Badge 
                          variant="outline" 
                          className="mr-2 bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800"
                        >
                          ●
                        </Badge>
                        Brouillon
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setStatus("published");
                          updateMutation.mutate({ status: "published" });
                        }}
                        data-testid="menu-item-published"
                      >
                        <Badge 
                          variant="outline" 
                          className="mr-2 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                        >
                          ●
                        </Badge>
                        Publié
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                <Label htmlFor="autosave" className="cursor-pointer text-[12px]">
                  Auto save {autoSaveEnabled ? "ON" : "OFF"}
                </Label>
              </div>
              
              {/* Preview/Edit Toggle */}
              <Button
                variant="outline"
                onClick={() => {
                  const newEditMode = !isEditMode;
                  setIsEditMode(newEditMode);
                  
                  // If switching to edit mode and document is published, revert to draft
                  if (newEditMode && status === "published") {
                    setStatus("draft");
                    updateMutation.mutate({ status: "draft" });
                    toast({
                      title: "Retour en brouillon",
                      description: "Le document est repassé en brouillon pour édition",
                      variant: "default",
                    });
                  }
                }}
                data-testid="button-toggle-edit"
              >
                {isEditMode ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                {isEditMode ? "Aperçu" : "Modifier"}
              </Button>
              
              {/* Save Button - Only in Edit Mode */}
              {isEditMode && (
                <Button
                  onClick={() => {
                    setIsSaving(true);
                    
                    const extractPlainText = (content: any): string => {
                      if (!content) return "";
                      const getText = (node: any): string => {
                        if (node.type === "text") return node.text || "";
                        if (node.content && Array.isArray(node.content)) {
                          return node.content.map(getText).join(" ");
                        }
                        return "";
                      };
                      return getText(content);
                    };

                    const plainText = extractPlainText(content);
                    
                    updateMutation.mutate({
                      name: title || "Sans titre",
                      content,
                      plainText,
                      status,
                    });
                  }}
                  disabled={updateMutation.isPending || isSaving}
                  data-testid="button-save"
                >
                  {updateMutation.isPending || isSaving ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              )}
              
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
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Projet:</Label>
            <Popover open={projectSelectorOpen} onOpenChange={setProjectSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={projectSelectorOpen}
                  className="justify-between min-w-[200px] text-[12px]"
                  data-testid="button-select-project"
                >
                  {currentProject ? currentProject.name : "Sélectionner un projet"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 bg-white dark:bg-background">
                <Command>
                  <CommandInput placeholder="Rechercher un projet..." />
                  <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                  <CommandGroup className="max-h-[300px] overflow-y-auto bg-[#ffffff]">
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
            {currentProject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnlinkProject}
                data-testid="button-unlink-project"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <NoteEditor
            content={content}
            onChange={setContent}
            title={title}
            onTitleChange={setTitle}
            editable={isEditMode}
            placeholder="Commencez à rédiger votre document..."
          />
        </div>
      </div>

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
