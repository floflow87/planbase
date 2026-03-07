import { useState, useCallback, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Trash2, Download, Save, Lock, LockOpen, MoreVertical, FolderKanban, ExternalLink, Users, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
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
  CommandList,
} from "@/components/ui/command";
import { Check, X } from "lucide-react";
import NoteEditor from "@/components/NoteEditor";
import { VoiceRecordingButton } from "@/components/VoiceRecordingButton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader } from "@/components/Loader";
import type { Document, Project, NoteLink, UpdateDocument } from "@shared/schema";
import type { Client } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDistanceToNow, format as formatDate } from "date-fns";
import { fr } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [isEditMode, setIsEditMode] = useState(() => {
    const saved = localStorage.getItem("documentEditMode");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("documentEditMode", String(isEditMode));
  }, [isEditMode]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>({ type: 'doc', content: [] });
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
  const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
  const [dateSelectorOpen, setDateSelectorOpen] = useState(false);
  const [documentDate, setDocumentDate] = useState<Date | null>(null);

  const { data: document, isLoading } = useQuery<Document>({
    queryKey: ["/api/documents", id],
    enabled: !!id,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: documentLinks = [] } = useQuery<NoteLink[]>({
    queryKey: ["/api/documents", id, "links"],
    enabled: !!id,
  });

  const linkedProject = documentLinks.find(link => link.targetType === "project");
  const currentProject = linkedProject ? projects.find(p => p.id === linkedProject.targetId) : null;
  const linkedClient = documentLinks.find(link => link.targetType === "client");
  const currentClient = linkedClient ? clients.find(c => c.id === linkedClient.targetId) : null;

  useEffect(() => {
    if (document && !title && !content.content?.length) {
      setTitle(document.name || "");
      let parsedContent = { type: 'doc', content: [] };
      if (document.content) {
        try {
          parsedContent = typeof document.content === 'string'
            ? JSON.parse(document.content)
            : document.content;
        } catch (e) {
          parsedContent = { type: 'doc', content: [] };
        }
      }
      setContent(parsedContent);
      setStatus((document.status === "signed" ? "published" : document.status) as any);
      if ((document as any).documentDate) {
        setDocumentDate(new Date((document as any).documentDate));
      }
    }
  }, [document]);

  const debouncedTitle = useDebounce(title, 1000);
  const debouncedContent = useDebounce(content, 1000);

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateDocument) => {
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

  // Autosave — always on
  useEffect(() => {
    if (!document || !isEditMode) return;

    const titleChanged = debouncedTitle !== document.name;
    const normalizedDocContent = typeof document.content === 'string'
      ? document.content
      : JSON.stringify(document.content);
    const normalizedCurrentContent = typeof debouncedContent === 'string'
      ? debouncedContent
      : JSON.stringify(debouncedContent);
    const contentChanged = normalizedCurrentContent !== normalizedDocContent;

    if (!titleChanged && !contentChanged) return;

    setIsSaving(true);

    const extractPlainText = (content: any): string => {
      if (!content) return "";
      const getText = (node: any): string => {
        if (node.type === "text") return node.text || "";
        if (node.content && Array.isArray(node.content)) return node.content.map(getText).join(" ");
        return "";
      };
      return getText(content);
    };

    const plainText = extractPlainText(debouncedContent);

    updateMutation.mutate({
      name: debouncedTitle || "Sans titre",
      content: typeof debouncedContent === 'string' ? debouncedContent : JSON.stringify(debouncedContent),
      plainText,
      status,
    });
  }, [debouncedTitle, debouncedContent, document, isEditMode]);

  const deleteDocumentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/documents/${id}`, "DELETE");
      return await response.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/documents"] });
      navigate("/documents");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès",
        variant: "success",
      });
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

  const exportPDFMutation = useMutation({
    mutationFn: async () => {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();

      const authHeaders: HeadersInit = session?.access_token
        ? { 'Authorization': `Bearer ${session.access_token}` }
        : import.meta.env.DEV
          ? {
              'x-test-account-id': '67a3cb31-7755-43f2-81e0-4436d5d0684f',
              'x-test-user-id': '9fe4ddc0-6d3f-4d69-9c77-fc9cb2e79c8d',
            }
          : {};

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

      const contentDisposition = response.headers.get('content-disposition');
      let fileName = 'document.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) fileName = match[1];
      }

      const blob = await response.blob();
      return { blob, fileName };
    },
    onSuccess: ({ blob, fileName }: { blob: Blob; fileName: string }) => {
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
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

  const handleManualSave = useCallback(() => {
    setIsSaving(true);
    const extractPlainText = (content: any): string => {
      if (!content) return "";
      const getText = (node: any): string => {
        if (node.type === "text") return node.text || "";
        if (node.content && Array.isArray(node.content)) return node.content.map(getText).join(" ");
        return "";
      };
      return getText(content);
    };
    updateMutation.mutate({
      name: title || "Sans titre",
      content: typeof content === 'string' ? content : JSON.stringify(content),
      plainText: extractPlainText(content),
      status,
    });
  }, [title, content, status, updateMutation]);

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

  const linkClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest(`/api/documents/${id}/links`, "POST", {
        targetType: "client",
        targetId: clientId,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "links"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Impossible de lier le client", variant: "destructive" });
    },
  });

  const unlinkClientMutation = useMutation({
    mutationFn: async () => {
      if (!linkedClient) return;
      const response = await apiRequest(
        `/api/documents/${id}/links/${linkedClient.targetType}/${linkedClient.targetId}`,
        "DELETE"
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "links"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Impossible de délier le client", variant: "destructive" });
    },
  });

  const handleSelectClient = useCallback(async (clientId: string) => {
    try {
      if (linkedClient) {
        await unlinkClientMutation.mutateAsync();
      }
      await linkClientMutation.mutateAsync(clientId);
      setClientSelectorOpen(false);
    } catch (error) {
      // Errors handled by mutations
    }
  }, [linkedClient, linkClientMutation, unlinkClientMutation]);

  const handleSelectDate = useCallback(async (date: Date | undefined) => {
    const newDate = date ?? null;
    setDocumentDate(newDate);
    setDateSelectorOpen(false);
    await apiRequest(`/api/documents/${id}`, "PATCH", {
      documentDate: newDate ? formatDate(newDate, "yyyy-MM-dd") : null,
    });
    queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
  }, [id, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader size="lg" />
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

  const ActionsDropdown = ({ align = "end" as "end" | "start" }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" data-testid="button-actions-menu">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuItem onClick={handleManualSave} data-testid="menu-item-save" className="text-xs">
          <Save className="w-4 h-4 mr-2 text-green-600" />
          Enregistrer
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF} data-testid="menu-item-export-pdf" className="text-xs" disabled={exportPDFMutation.isPending}>
          <Download className="w-4 h-4 mr-2 text-blue-600" />
          {exportPDFMutation.isPending ? "Export en cours..." : "Exporter en PDF"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDeleteClick}
          className="text-destructive focus:text-destructive focus:bg-destructive/10 text-xs"
          data-testid="menu-item-delete"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Supprimer le document
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            const newEditMode = !isEditMode;
            setIsEditMode(newEditMode);
            if (newEditMode && status === "published") {
              setStatus("draft");
              updateMutation.mutate({ status: "draft" });
            }
          }}
          data-testid="menu-item-toggle-edit"
          className="text-xs"
        >
          {isEditMode ? <LockOpen className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
          {isEditMode ? "Verrouiller" : "Déverrouiller"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => { setStatus("draft"); updateMutation.mutate({ status: "draft" }); }}
          data-testid="menu-item-status-draft"
          className="text-xs"
        >
          <Badge variant="outline" className="mr-2 bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 text-[10px]">●</Badge>
          Brouillon
          {status === "draft" && <Check className="w-3 h-3 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => { setStatus("published"); updateMutation.mutate({ status: "published" }); }}
          data-testid="menu-item-status-published"
          className="text-xs"
        >
          <Badge variant="outline" className="mr-2 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-[10px]">●</Badge>
          Publié
          {status === "published" && <Check className="w-3 h-3 ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] dark:bg-background">
      {/* Fixed Header */}
      <div className="flex-none bg-background">
        {isMobile ? (
          /* MOBILE HEADER */
          <div className="px-2 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => navigate("/documents")}
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sans titre"
                className="flex-1 h-8 text-base font-semibold border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:ring-offset-0 truncate"
                data-testid="input-title-mobile"
              />
              <span className="text-[10px] text-muted-foreground flex-shrink-0 min-w-[50px] text-right">
                {isSaving ? "..." : lastSaved ? "✓" : ""}
              </span>
              <ActionsDropdown align="end" />
            </div>
          </div>
        ) : (
          /* DESKTOP HEADER */
          <div className="px-6 pt-4 pb-3">
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/documents")}
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-default select-none" data-testid="autosave-status">
                    {isSaving ? "Sauvegarde..." : lastSaved ? "Sauvegardé" : document.updatedAt ? formatDistanceToNow(new Date(document.updatedAt), { addSuffix: true, locale: fr }) : ""}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border">Auto-sauvegarde activée</TooltipContent>
              </Tooltip>

              <div className="flex-1" />

              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Client selector */}
                <div className="flex items-center">
                  <Popover open={clientSelectorOpen} onOpenChange={setClientSelectorOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900 ${currentClient ? 'rounded-r-none border-r-0' : ''}`}
                        data-testid="button-client-selector"
                      >
                        <Users className="w-3 h-3 text-orange-500" />
                        <span className="truncate max-w-[100px]">
                          {currentClient ? currentClient.name : "Client"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0 bg-popover" align="start">
                      <Command>
                        <CommandInput placeholder="Rechercher un client..." />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                          <CommandGroup>
                            {currentClient && (
                              <CommandItem
                                onSelect={() => { unlinkClientMutation.mutate(); setClientSelectorOpen(false); }}
                                className="text-destructive"
                                data-testid="option-unlink-client"
                              >
                                <X className="mr-2 h-4 w-4" />
                                Délier du client
                              </CommandItem>
                            )}
                            {clients.map((client) => (
                              <CommandItem
                                key={client.id}
                                onSelect={() => handleSelectClient(client.id)}
                                data-testid={`option-client-${client.id}`}
                              >
                                <Check className={`mr-2 h-4 w-4 ${currentClient?.id === client.id ? "opacity-100" : "opacity-0"}`} />
                                {client.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {currentClient && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0 rounded-l-none hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                      onClick={(e) => { e.stopPropagation(); unlinkClientMutation.mutate(); }}
                      data-testid="button-unlink-client-x"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* Project selector */}
                <div className="flex items-center">
                  <Popover open={projectSelectorOpen} onOpenChange={setProjectSelectorOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900 ${currentProject ? 'rounded-r-none border-r-0' : ''}`}
                        data-testid="button-project-selector"
                      >
                        <FolderKanban className="w-3 h-3 text-violet-500" />
                        <span className="truncate max-w-[100px]">
                          {currentProject ? currentProject.name : "Projet"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0 bg-popover" align="start">
                      <Command>
                        <CommandInput placeholder="Rechercher un projet..." />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                          <CommandGroup>
                            {currentProject && (
                              <CommandItem
                                onSelect={() => { handleUnlinkProject(); setProjectSelectorOpen(false); }}
                                className="text-destructive"
                                data-testid="option-unlink-project"
                              >
                                <X className="mr-2 h-4 w-4" />
                                Délier du projet
                              </CommandItem>
                            )}
                            {projects.map((project) => (
                              <CommandItem
                                key={project.id}
                                onSelect={() => handleSelectProject(project.id)}
                                data-testid={`option-project-${project.id}`}
                              >
                                <Check className={`mr-2 h-4 w-4 ${currentProject?.id === project.id ? "opacity-100" : "opacity-0"}`} />
                                {project.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {currentProject && linkedProject && (
                    <>
                      <Link href={`/projects/${currentProject.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0 rounded-none border-r-0 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 dark:hover:bg-violet-950"
                          data-testid="button-go-to-project"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0 rounded-l-none hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                        onClick={(e) => { e.stopPropagation(); handleUnlinkProject(); }}
                        data-testid="button-unlink-project-x"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Date selector */}
                <Popover open={dateSelectorOpen} onOpenChange={setDateSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900"
                      data-testid="button-date-selector"
                    >
                      <CalendarDays className="w-3 h-3 text-muted-foreground" />
                      <span className="truncate max-w-[100px]">
                        {documentDate ? formatDate(documentDate, "dd MMM yyyy", { locale: fr }) : "Date"}
                      </span>
                      {documentDate && (
                        <span
                          className="ml-0.5 hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleSelectDate(undefined); }}
                        >
                          <X className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarWidget
                      mode="single"
                      selected={documentDate ?? undefined}
                      onSelect={handleSelectDate}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={`text-[10px] ${status === "draft"
                    ? "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800"
                    : "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                  }`}
                  data-testid="badge-status"
                >
                  {status === "draft" ? "Brouillon" : "Publié"}
                </Badge>
              </div>

              <ActionsDropdown align="end" />
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        <div className={isMobile ? "px-1 py-0" : ""}>
          <NoteEditor
            key={id}
            content={content}
            onChange={setContent}
            editable={isEditMode}
            placeholder="Commencez à rédiger votre document..."
            borderless={!isMobile}
            {...(!isMobile ? {
              title,
              onTitleChange: setTitle,
            } : {})}
          />
        </div>
      </div>

      {/* Voice Recording Button */}
      {isEditMode && (
        <VoiceRecordingButton
          onTranscript={(text) => {
            setContent((prev: any) => {
              const existingContent = prev?.content || [];
              return {
                type: 'doc',
                content: [
                  ...existingContent,
                  { type: 'paragraph', content: [{ type: 'text', text }] }
                ]
              };
            });
          }}
          onError={(msg) => toast({ variant: "destructive", title: "Erreur de transcription", description: msg })}
        />
      )}

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
