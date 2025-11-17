import { Search, FileText, Plus, Trash2, MoreVertical, File, Calendar, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Document, AppUser, DocumentTemplate } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function Documents() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "signed">("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('documentListPageSize');
    return saved ? parseInt(saved) : 20;
  });
  const [currentPage, setCurrentPage] = useState(1);

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  useEffect(() => {
    localStorage.setItem('documentListPageSize', pageSize.toString());
  }, [pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, pageSize]);

  const filteredDocuments = useMemo(() => {
    let result = [...documents];

    if (statusFilter !== "all") {
      result = result.filter((doc) => doc.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query) ||
          doc.plainText?.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [documents, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredDocuments.length / pageSize);
  const paginatedDocuments = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    return filteredDocuments.slice(startIdx, endIdx);
  }, [filteredDocuments, currentPage, pageSize]);

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "bg-gray-100 text-gray-700 border-gray-200",
      signed: "bg-green-50 text-green-700 border-green-200",
    };
    return variants[status as keyof typeof variants] || variants.draft;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès",
      });
      setDeleteDialogOpen(false);
      setDeleteDocumentId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le document",
        variant: "destructive",
      });
    },
  });

  const handleDeleteConfirm = () => {
    if (deleteDocumentId) {
      deleteMutation.mutate(deleteDocumentId);
    }
  };

  const handleCreateNew = () => {
    navigate("/documents/templates");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" data-testid="icon-documents" />
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">Documents</h1>
          </div>
          <Button onClick={handleCreateNew} data-testid="button-create-document">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau document
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher des documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-documents"
            />
          </div>

          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-48" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="signed">Signé</SelectItem>
            </SelectContent>
          </Select>

          <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
            <SelectTrigger className="w-32" data-testid="select-page-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 par page</SelectItem>
              <SelectItem value="20">20 par page</SelectItem>
              <SelectItem value="50">50 par page</SelectItem>
              <SelectItem value="100">100 par page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Chargement...</div>
          </div>
        ) : paginatedDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <FileText className="h-16 w-16 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-muted-foreground font-medium mb-1">Aucun document</p>
              <p className="text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "Aucun document ne correspond à vos critères"
                  : "Commencez par créer un nouveau document"}
              </p>
            </div>
            {!searchQuery && statusFilter === "all" && (
              <Button onClick={handleCreateNew} data-testid="button-create-first-document">
                <Plus className="h-4 w-4 mr-2" />
                Créer un document
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {paginatedDocuments.map((document) => {
              return (
                <Card
                  key={document.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => navigate(`/documents/${document.id}`)}
                  data-testid={`card-document-${document.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-2">
                          <File className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-base mb-1 truncate" data-testid={`text-document-title-${document.id}`}>
                              {document.title}
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Modifié {formatDistanceToNow(new Date(document.updatedAt), { addSuffix: true, locale: { localize: { day: () => 'jour' } } as any })}</span>
                          </div>

                          {document.signedAt && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Signé le {new Date(document.signedAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={getStatusBadge(document.status)} data-testid={`badge-status-${document.id}`}>
                          {document.status === "draft" ? "Brouillon" : "Signé"}
                        </Badge>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" data-testid={`button-document-menu-${document.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/documents/${document.id}`);
                            }}>
                              <File className="h-4 w-4 mr-2" />
                              Ouvrir
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteDocumentId(document.id);
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-document-${document.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              data-testid="button-prev-page"
            >
              Précédent
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} sur {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              data-testid="button-next-page"
            >
              Suivant
            </Button>
          </div>
        )}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le document</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} data-testid="button-cancel-delete">
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
