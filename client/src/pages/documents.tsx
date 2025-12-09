import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Filter, Home, ChevronRight, LayoutGrid, List, Upload, FolderPlus, FileText, File, Image, FileSpreadsheet, FileType, Link, Music, Archive, MoreVertical, FileEdit, Trash2, Copy, FolderInput, Download, PanelLeftClose, PanelLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Document, Client, Project, DocumentLink } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useMemo } from "react";
import { Folder, ChevronDown, ChevronRight as ChevronRightIcon, Building2, FolderOpen } from "lucide-react";

export default function Documents() {
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    const saved = localStorage.getItem("documentsViewMode");
    return (saved === "grid" || saved === "list") ? saved : "grid";
  });
  const [, setLocation] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["root"]));
  const [selectedNodeId, setSelectedNodeId] = useState<string>("all-documents");
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(() => {
    return localStorage.getItem("documentsTreeCollapsed") === "true";
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Persist viewMode changes
  useEffect(() => {
    localStorage.setItem("documentsViewMode", viewMode);
  }, [viewMode]);

  // Persist tree collapse state
  useEffect(() => {
    localStorage.setItem("documentsTreeCollapsed", String(isTreeCollapsed));
  }, [isTreeCollapsed]);

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: documentLinks = [] } = useQuery<DocumentLink[]>({
    queryKey: ["/api/document-links"],
  });

  // Delete mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
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
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le document",
        variant: "destructive",
      });
    },
  });

  // Duplicate mutation
  const duplicateDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/documents/${id}/duplicate`, "POST");
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document dupliqué",
        description: "Le document a été dupliqué avec succès",
        variant: "success",
      });
      setLocation(`/documents/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de dupliquer le document",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocumentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (documentToDelete) {
      await deleteDocumentMutation.mutateAsync(documentToDelete);
    }
  };

  const handleDuplicateClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateDocumentMutation.mutate(id);
  };

  // Export PDF mutation
  const exportPDFMutation = useMutation({
    mutationFn: async (id: string) => {
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
      return { blob, fileName };
    },
    onSuccess: ({ blob, fileName }: { blob: Blob; fileName: string }) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      
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

  const handleExportPDF = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    exportPDFMutation.mutate(id);
  };

  const handleMoveClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast({
      title: "Déplacer le document",
      description: "Fonctionnalité à venir - Déplacement vers un autre dossier",
    });
  };

  // Selection handlers
  const toggleDocumentSelection = (id: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllDocuments = (files: any[]) => {
    setSelectedDocuments(new Set(files.map(f => f.id)));
  };

  const clearSelection = () => {
    setSelectedDocuments(new Set());
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedDocuments.size === 0) return;
    
    try {
      await Promise.all(
        Array.from(selectedDocuments).map(id => 
          deleteDocumentMutation.mutateAsync(id)
        )
      );
      clearSelection();
    } catch (error) {
      // Errors already handled by mutation
    }
  };

  // Bulk PDF download handler
  const handleBulkDownloadPDF = async () => {
    if (selectedDocuments.size === 0) return;
    
    for (const id of Array.from(selectedDocuments)) {
      await exportPDFMutation.mutateAsync(id);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Build dynamic tree structure
  const folderTree = useMemo(() => {
    // Group projects by clientId
    const projectsByClient = projects.reduce((acc, project) => {
      if (project.clientId) {
        if (!acc[project.clientId]) {
          acc[project.clientId] = [];
        }
        acc[project.clientId].push(project);
      }
      return acc;
    }, {} as Record<string, Project[]>);

    // Count documents by project and by client
    const docCountByProject = documentLinks.reduce((acc, link) => {
      if (link.targetType === "project") {
        acc[link.targetId] = (acc[link.targetId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const docCountByClient = documentLinks.reduce((acc, link) => {
      if (link.targetType === "client") {
        acc[link.targetId] = (acc[link.targetId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Get set of linked document IDs (any target type)
    const linkedDocumentIds = new Set(documentLinks.map(link => link.documentId));
    
    // Count unlinked documents (documents not linked to anything)
    const unlinkedDocs = documents.filter(doc => !linkedDocumentIds.has(doc.id)).length;

    // Build client nodes with their projects
    const clientNodes = clients.map(client => {
      const clientProjects = projectsByClient[client.id] || [];
      const projectNodes = clientProjects.map(project => ({
        id: `project-${project.id}`,
        name: project.name,
        type: "project" as const,
        count: docCountByProject[project.id] || 0,
        icon: Folder,
        projectId: project.id,
      }));

      // Count total docs for this client: direct client links + sum of all project docs
      const directClientDocs = docCountByClient[client.id] || 0;
      const projectDocs = projectNodes.reduce((sum, p) => sum + (p.count || 0), 0);
      const clientDocCount = directClientDocs + projectDocs;

      return {
        id: `client-${client.id}`,
        name: client.name,
        type: "client" as const,
        count: clientDocCount,
        icon: Building2,
        children: projectNodes,
        clientId: client.id,
      };
    });

    return [
      {
        id: "root",
        name: "Racine",
        icon: Home,
        type: "root" as const,
        children: [
          {
            id: "all-documents",
            name: "Tous les documents",
            icon: FileText,
            type: "all" as const,
            count: documents.length,
            children: [],
          },
          {
            id: "clients",
            name: "Clients",
            type: "folder" as const,
            count: clientNodes.length,
            icon: FolderOpen,
            children: clientNodes,
          },
          {
            id: "other",
            name: "Autre",
            type: "folder" as const,
            count: unlinkedDocs,
            icon: Folder,
            children: [],
          },
        ],
      },
    ];
  }, [clients, projects, documents, documentLinks]);

  const getAuthorColor = (index: number) => {
    const colors = [
      "bg-violet-500", "bg-blue-500", "bg-green-500", "bg-orange-500",
      "bg-pink-500", "bg-cyan-500", "bg-indigo-500", "bg-red-500"
    ];
    return colors[index % colors.length];
  };

  // Get project info for a document
  const getDocumentProject = (documentId: string) => {
    const link = documentLinks.find(
      link => link.documentId === documentId && link.targetType === "project"
    );
    if (!link) return null;
    return projects.find(p => p.id === link.targetId);
  };

  // Filter documents based on selected node
  const filteredDocuments = useMemo(() => {
    if (selectedNodeId === "all-documents") {
      return documents;
    }
    
    if (selectedNodeId === "other") {
      // Show only unlinked documents
      const linkedDocumentIds = new Set(documentLinks.map(link => link.documentId));
      return documents.filter(doc => !linkedDocumentIds.has(doc.id));
    }
    
    if (selectedNodeId.startsWith("project-")) {
      // Extract project ID and filter documents linked to this project
      const projectId = selectedNodeId.replace("project-", "");
      const projectDocIds = new Set(
        documentLinks
          .filter(link => link.targetType === "project" && link.targetId === projectId)
          .map(link => link.documentId)
      );
      return documents.filter(doc => projectDocIds.has(doc.id));
    }
    
    if (selectedNodeId.startsWith("client-")) {
      // Extract client ID and filter documents linked to this client or its projects
      const clientId = selectedNodeId.replace("client-", "");
      const clientProjects = projects.filter(p => p.clientId === clientId);
      const projectIds = new Set(clientProjects.map(p => p.id));
      
      const relevantDocIds = new Set(
        documentLinks
          .filter(link => 
            (link.targetType === "client" && link.targetId === clientId) ||
            (link.targetType === "project" && projectIds.has(link.targetId))
          )
          .map(link => link.documentId)
      );
      return documents.filter(doc => relevantDocIds.has(doc.id));
    }
    
    // Default: show all documents
    return documents;
  }, [documents, documentLinks, projects, selectedNodeId]);

  const files = filteredDocuments.map((doc, index) => {
    const project = getDocumentProject(doc.id);
    return {
      id: doc.id,
      name: doc.name,
      type: doc.status === "signed" ? "pdf" : "note",
      status: doc.status as "draft" | "published" | "signed",
      size: doc.status === "signed" ? "Signé" : doc.status === "published" ? "Publié" : "Brouillon",
      updatedAt: formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true, locale: fr }),
      projectBadge: project ? {
        name: project.name.substring(0, 2).toUpperCase(),
        fullName: project.name,
        color: getAuthorColor(index),
      } : null,
    };
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="w-6 h-6 text-red-600" />;
      case "word":
        return <FileType className="w-6 h-6 text-blue-600" />;
      case "excel":
        return <FileSpreadsheet className="w-6 h-6 text-green-600" />;
      case "image":
        return <Image className="w-6 h-6 text-orange-600" />;
      case "link":
        return <Link className="w-6 h-6 text-cyan-600" />;
      case "note":
        return <FileText className="w-6 h-6 text-violet-600" />;
      case "audio":
        return <Music className="w-6 h-6 text-purple-600" />;
      case "zip":
        return <Archive className="w-6 h-6 text-gray-600" />;
      default:
        return <File className="w-6 h-6 text-gray-600" />;
    }
  };

  const handleNodeClick = (item: any) => {
    // Always select the node
    setSelectedNodeId(item.id);
    
    // If it has children, also toggle expansion
    const hasChildren = item.children && item.children.length > 0;
    if (hasChildren) {
      toggleNode(item.id);
    }
  };

  const FolderTree = ({ items, level = 0 }: any) => (
    <div className={level > 0 ? "ml-4" : ""}>
      {items.map((item: any) => {
        const isExpanded = expandedNodes.has(item.id);
        const hasChildren = item.children && item.children.length > 0;
        const isSelected = selectedNodeId === item.id;

        return (
          <div key={item.id}>
            <div 
              className={`flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer text-sm ${
                isSelected ? "bg-accent" : ""
              }`}
              onClick={() => handleNodeClick(item)}
              data-testid={`folder-${item.id}`}
            >
              {hasChildren && (
                isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRightIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )
              )}
              {!hasChildren && <div className="w-3" />}
              {item.icon ? <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              <span className="flex-1 text-foreground truncate">{item.name}</span>
              {item.count !== undefined && (
                <Badge variant="secondary" className="text-xs flex-shrink-0">{item.count}</Badge>
              )}
            </div>
            {hasChildren && isExpanded && (
              <FolderTree items={item.children} level={level + 1} />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex-1 overflow-hidden bg-background flex" data-testid="page-documents">
      {/* Left Sidebar - Folder Explorer (Collapsible) */}
      <div 
        className={`border-r border-border flex flex-col transition-all duration-300 ease-in-out ${
          isTreeCollapsed ? "w-0 overflow-hidden" : "w-72"
        }`}
        style={{ minWidth: isTreeCollapsed ? 0 : undefined }}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-lg">Explorer</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsTreeCollapsed(true)}
              data-testid="button-collapse-tree"
            >
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              className="pl-9"
              data-testid="input-search-files"
            />
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-2 justify-start gap-2" data-testid="button-filter">
            <Filter className="w-4 h-4" />
            Filtres
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <FolderTree items={folderTree} />
        </ScrollArea>
      </div>
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className={`max-w-7xl p-6 space-y-6 ${isTreeCollapsed ? 'ml-0' : 'mx-auto'}`}>
          {/* Breadcrumb & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px]">
              {isTreeCollapsed && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 mr-2"
                  onClick={() => setIsTreeCollapsed(false)}
                  data-testid="button-expand-tree"
                >
                  <PanelLeft className="w-4 h-4" />
                </Button>
              )}
              <Home className="w-4 h-4 text-muted-foreground" />
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Documentation</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-foreground">Produit</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border border-border rounded-md p-1">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  data-testid="button-view-grille"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  data-testid="button-view-liste"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="outline" className="gap-2 text-[12px]" data-testid="button-importer">
                <Upload className="w-4 h-4" />
                Importer
              </Button>
              <Button 
                variant="default" 
                className="gap-2 text-[12px]" 
                onClick={() => setLocation("/documents/templates")}
                data-testid="button-nouveau-document"
              >
                <FileEdit className="w-4 h-4" />
                Nouveau Document
              </Button>
            </div>
          </div>

          {/* Storage Indicator - moved above documents */}
          {files.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Stockage:</span>
                  <span className="text-muted-foreground text-[12px]">{files.length} document{files.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{files.length} élément{files.length > 1 ? 's' : ''}</span>
                  <span className="text-xs text-muted-foreground">Trié par date de modification</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Files Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Chargement des documents...</div>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <FileText className="w-16 h-16 text-muted-foreground/50" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">Aucun document</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Créez votre premier document pour commencer
                </p>
              </div>
              <Button 
                onClick={() => setLocation("/documents/templates")}
                data-testid="button-create-first-document"
              >
                <FileEdit className="w-4 h-4 mr-2" />
                Créer un document
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map((file) => (
                <Card 
                  key={file.id} 
                  className="hover-elevate cursor-pointer transition-shadow" 
                  onClick={() => setLocation(`/documents/${file.id}`)}
                  data-testid={`card-file-${file.id}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        {getFileIcon(file.type)}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0" 
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-menu-${file.id}`}
                          >
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => handleDuplicateClick(file.id, e)}
                            data-testid={`menu-item-duplicate-${file.id}`}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => handleExportPDF(file.id, e)}
                            data-testid={`menu-item-export-pdf-${file.id}`}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Télécharger le PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => handleMoveClick(file.id, e)}
                            data-testid={`menu-item-move-${file.id}`}
                          >
                            <FolderInput className="w-4 h-4 mr-2" />
                            Déplacer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteClick(file.id, e)}
                            className="text-destructive focus:text-destructive"
                            data-testid={`menu-item-delete-${file.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm text-foreground truncate">{file.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            file.status === "draft" 
                              ? "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300"
                              : file.status === "published"
                              ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300"
                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {file.status === "draft" ? "Brouillon" : file.status === "published" ? "Publié" : "Signé"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      {file.updatedAt && (
                        <span className="text-xs text-muted-foreground">{file.updatedAt}</span>
                      )}
                      {file.projectBadge && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`w-6 h-6 rounded-full ${file.projectBadge.color} flex items-center justify-center text-xs text-white font-medium cursor-help`}>
                              {file.projectBadge.name}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{file.projectBadge.fullName}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div>
              {/* Bulk actions bar */}
              {selectedDocuments.size > 0 && (
                <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {selectedDocuments.size} document{selectedDocuments.size > 1 ? 's' : ''} sélectionné{selectedDocuments.size > 1 ? 's' : ''}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                      data-testid="button-clear-selection"
                    >
                      Tout désélectionner
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDownloadPDF}
                      disabled={exportPDFMutation.isPending}
                      data-testid="button-bulk-download-pdf"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger PDF
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={deleteDocumentMutation.isPending}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              )}

              {/* Document list */}
              <div className="space-y-0 bg-card border border-border rounded-md overflow-hidden">
                {files.map((file, index) => (
                  <div key={file.id}>
                    <div 
                      className="hover-elevate cursor-pointer transition-all p-3" 
                      onClick={() => !selectedDocuments.has(file.id) && setLocation(`/documents/${file.id}`)}
                      data-testid={`list-item-${file.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={selectedDocuments.has(file.id)}
                          onCheckedChange={() => toggleDocumentSelection(file.id)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-document-${file.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm text-foreground truncate">{file.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                file.status === "draft" 
                                  ? "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300"
                                  : file.status === "published"
                                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300"
                                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                              }`}
                            >
                              {file.status === "draft" ? "Brouillon" : file.status === "published" ? "Publié" : "Signé"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">{file.updatedAt}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {file.projectBadge && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`w-6 h-6 rounded-full ${file.projectBadge.color} flex items-center justify-center text-xs text-white font-medium cursor-help`}>
                                  {file.projectBadge.name}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{file.projectBadge.fullName}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0" 
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`button-menu-list-${file.id}`}
                              >
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => handleDuplicateClick(file.id, e)}
                                data-testid={`menu-item-duplicate-list-${file.id}`}
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Dupliquer
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => handleExportPDF(file.id, e)}
                                data-testid={`menu-item-export-pdf-list-${file.id}`}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Télécharger PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => handleMoveClick(file.id, e)}
                                data-testid={`menu-item-move-list-${file.id}`}
                              >
                                <FolderInput className="w-4 h-4 mr-2" />
                                Déplacer
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => handleDeleteClick(file.id, e)}
                                className="text-destructive focus:text-destructive"
                                data-testid={`menu-item-delete-list-${file.id}`}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                    {index < files.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </div>
          )}
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
