import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Filter, Home, ChevronRight, LayoutGrid, List, Upload, FolderPlus, FileText, File, Image, FileSpreadsheet, FileType, Link, Music, Archive, MoreVertical, FileEdit, Trash2, Copy, FolderInput } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import type { Document } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function Documents() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [, setLocation] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
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

  const handleMoveClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast({
      title: "Déplacer le document",
      description: "Fonctionnalité à venir - Déplacement vers un autre dossier",
    });
  };

  const folders = [
    {
      id: "root",
      name: "Racine",
      icon: Home,
      expanded: true,
      children: [
        { id: "clients", name: "Clients", count: 8, children: [] },
        { id: "projects", name: "Projets internes", count: 12, children: [] },
        {
          id: "documentation",
          name: "Documentation",
          count: 24,
          expanded: true,
          children: [
            { id: "product", name: "Produit", count: 8 },
            { id: "technique", name: "Technique", count: 6 },
            { id: "equipe", name: "Équipe", count: 4 },
            { id: "fundraising", name: "Levée de fonds", count: 6 },
          ],
        },
      ],
    },
  ];

  const getAuthorColor = (index: number) => {
    const colors = [
      "bg-violet-500", "bg-blue-500", "bg-green-500", "bg-orange-500",
      "bg-pink-500", "bg-cyan-500", "bg-indigo-500", "bg-red-500"
    ];
    return colors[index % colors.length];
  };

  const files = documents.map((doc, index) => ({
    id: doc.id,
    name: doc.name,
    type: doc.status === "signed" ? "pdf" : "note",
    status: doc.status as "draft" | "published" | "signed",
    size: doc.status === "signed" ? "Signé" : doc.status === "published" ? "Publié" : "Brouillon",
    updatedAt: formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true, locale: fr }),
    author: { name: doc.createdBy?.substring(0, 2).toUpperCase() || "U", color: getAuthorColor(index) },
  }));

  const getFileIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="w-8 h-8 text-red-600" />;
      case "word":
        return <FileType className="w-8 h-8 text-blue-600" />;
      case "excel":
        return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
      case "image":
        return <Image className="w-8 h-8 text-orange-600" />;
      case "link":
        return <Link className="w-8 h-8 text-cyan-600" />;
      case "note":
        return <FileText className="w-8 h-8 text-violet-600" />;
      case "audio":
        return <Music className="w-8 h-8 text-purple-600" />;
      case "zip":
        return <Archive className="w-8 h-8 text-gray-600" />;
      default:
        return <File className="w-8 h-8 text-gray-600" />;
    }
  };

  const FolderTree = ({ items, level = 0 }: any) => (
    <div className={level > 0 ? "ml-4" : ""}>
      {items.map((item: any) => (
        <div key={item.id}>
          <div className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer text-sm">
            {item.icon ? <item.icon className="w-4 h-4 text-muted-foreground" /> : <FileText className="w-4 h-4 text-muted-foreground" />}
            <span className="flex-1 text-foreground">{item.name}</span>
            {item.count !== undefined && (
              <Badge variant="secondary" className="text-xs">{item.count}</Badge>
            )}
          </div>
          {item.children && item.expanded && (
            <FolderTree items={item.children} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex-1 overflow-hidden bg-background flex" data-testid="page-documents">
      {/* Left Sidebar - Folder Explorer */}
      <div className="w-72 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-heading font-semibold text-lg mb-3">Explorer</h2>
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
          <FolderTree items={folders} />
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Breadcrumb & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
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
              <Button variant="outline" className="gap-2" data-testid="button-importer">
                <Upload className="w-4 h-4" />
                Importer
              </Button>
              <Button 
                variant="default" 
                className="gap-2" 
                onClick={() => setLocation("/documents/templates")}
                data-testid="button-nouveau-document"
              >
                <FileEdit className="w-4 h-4" />
                Nouveau Document
              </Button>
            </div>
          </div>

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
                          {file.size}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      {file.updatedAt && (
                        <span className="text-xs text-muted-foreground">{file.updatedAt}</span>
                      )}
                      <div className={`w-6 h-6 rounded-full ${file.author.color} flex items-center justify-center text-xs text-white font-medium`}>
                        {file.author.name}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <Card 
                  key={file.id} 
                  className="hover-elevate cursor-pointer transition-shadow" 
                  onClick={() => setLocation(`/documents/${file.id}`)}
                  data-testid={`list-item-${file.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        {getFileIcon(file.type)}
                      </div>
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
                            {file.size}
                          </Badge>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{file.updatedAt}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`w-6 h-6 rounded-full ${file.author.color} flex items-center justify-center text-xs text-white font-medium`}>
                          {file.author.name}
                        </div>
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Storage Indicator */}
          {files.length > 0 && (
            <Card className="mt-8">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Stockage:</span>
                  <span className="text-sm text-muted-foreground">{files.length} document{files.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{files.length} élément{files.length > 1 ? 's' : ''}</span>
                  <span className="text-xs text-muted-foreground">Trié par date de modification</span>
                </div>
              </CardContent>
            </Card>
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
