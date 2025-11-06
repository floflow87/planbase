import { Search, Filter, Settings as SettingsIcon, Download, LayoutGrid, List, Table2, Plus, Sparkles, File, Trash2, MoreVertical, CheckCircle2, Copy, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Note, AppUser, Project, NoteLink } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Notes() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "archived">("all");
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkPublishDialogOpen, setBulkPublishDialogOpen] = useState(false);
  const [quickAddNoteTitle, setQuickAddNoteTitle] = useState("");
  const [isQuickAddingNote, setIsQuickAddingNote] = useState(false);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('noteListPageSize');
    return saved ? parseInt(saved) : 20;
  });
  const [currentPage, setCurrentPage] = useState(1);

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: noteLinks = [] } = useQuery<NoteLink[]>({
    queryKey: ["/api/note-links"],
  });

  // Save pageSize to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('noteListPageSize', pageSize.toString());
  }, [pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, pageSize]);

  // Filter and search notes
  const filteredNotes = useMemo(() => {
    // Clone the notes array to avoid mutating the cache
    let result = [...notes];

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((note) => note.status === statusFilter);
    }

    // Search by title or plainText
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.plainText?.toLowerCase().includes(query) ||
          note.summary?.toLowerCase().includes(query)
      );
    }

    // Sort by updatedAt (most recent first)
    return result.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [notes, searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredNotes.length / pageSize);
  const paginatedNotes = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    return filteredNotes.slice(startIdx, endIdx);
  }, [filteredNotes, currentPage, pageSize]);

  const getUserById = (userId: string) => {
    return users.find((u) => u.id === userId);
  };

  const getLinkedProject = (noteId: string) => {
    const projectLink = noteLinks.find(
      (link) => link.noteId === noteId && link.targetType === "project"
    );
    if (!projectLink) return null;
    return projects.find((p) => p.id === projectLink.targetId);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "bg-gray-100 text-gray-700 border-gray-200",
      active: "bg-green-50 text-green-700 border-green-200",
      archived: "bg-orange-50 text-orange-700 border-orange-200",
    };
    return variants[status as keyof typeof variants] || variants.active;
  };

  const toggleNoteSelection = (noteId: string) => {
    const newSelection = new Set(selectedNotes);
    if (newSelection.has(noteId)) {
      newSelection.delete(noteId);
    } else {
      newSelection.add(noteId);
    }
    setSelectedNotes(newSelection);
  };

  const toggleAllNotes = () => {
    if (selectedNotes.size === filteredNotes.length) {
      setSelectedNotes(new Set());
    } else {
      setSelectedNotes(new Set(filteredNotes.map(n => n.id)));
    }
  };

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, data }: { noteId: string; data: Partial<Note> }) => {
      return apiRequest(`/api/notes/${noteId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/note-links"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour la note",
        variant: "destructive",
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest(`/api/notes/${noteId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({
        title: "Note supprimée",
        description: "La note a été supprimée avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la note",
        variant: "destructive",
      });
    },
  });

  const duplicateNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await apiRequest(`/api/notes/${noteId}/duplicate`, "POST");
      return await response.json();
    },
    onSuccess: (duplicatedNote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({
        title: "Note dupliquée",
        description: "La note a été dupliquée avec succès",
        variant: "success",
      });
      navigate(`/notes/${duplicatedNote.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de dupliquer la note",
        variant: "destructive",
      });
    },
  });

  const bulkPublishMutation = useMutation({
    mutationFn: async (noteIds: string[]) => {
      return Promise.all(noteIds.map(id => 
        apiRequest(`/api/notes/${id}`, "PATCH", { status: "active" })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setSelectedNotes(new Set());
      toast({
        title: "Notes publiées",
        description: `${selectedNotes.size} note(s) ont été publiées`,
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de publier les notes",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (noteIds: string[]) => {
      return Promise.all(noteIds.map(id => 
        apiRequest(`/api/notes/${id}`, "DELETE")
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setSelectedNotes(new Set());
      toast({
        title: "Notes supprimées",
        description: `${selectedNotes.size} note(s) ont été supprimées`,
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer les notes",
        variant: "destructive",
      });
    },
  });

  const handleDeleteNote = (noteId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteNoteId(noteId);
    setDeleteDialogOpen(true);
  };

  const handleDuplicateNote = (noteId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    duplicateNoteMutation.mutate(noteId);
  };

  const confirmDeleteNote = () => {
    if (deleteNoteId) {
      deleteNoteMutation.mutate(deleteNoteId);
      setDeleteDialogOpen(false);
      setDeleteNoteId(null);
    }
  };

  const handleBulkPublish = () => {
    if (selectedNotes.size === 0) return;
    setBulkPublishDialogOpen(true);
  };

  const confirmBulkPublish = () => {
    bulkPublishMutation.mutate(Array.from(selectedNotes));
    setBulkPublishDialogOpen(false);
  };

  const handleBulkDelete = () => {
    if (selectedNotes.size === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedNotes));
    setBulkDeleteDialogOpen(false);
  };

  const linkProjectMutation = useMutation({
    mutationFn: async ({ noteId, projectId }: { noteId: string; projectId: string | null }) => {
      if (projectId === null) {
        // Remove existing link
        const existingLink = noteLinks.find(
          (link) => link.noteId === noteId && link.targetType === "project"
        );
        if (existingLink) {
          return apiRequest(`/api/notes/${noteId}/links/${existingLink.targetType}/${existingLink.targetId}`, "DELETE");
        }
      } else {
        // Create or update link
        return apiRequest(`/api/notes/${noteId}/links`, "POST", {
          targetType: "project",
          targetId: projectId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/note-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de lier le projet",
        variant: "destructive",
      });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("/api/notes", "POST", {
        title,
        content: { type: 'doc', content: [] },
        plainText: "",
        status: "draft",
        visibility: "private",
      });
      return await response.json();
    },
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setQuickAddNoteTitle("");
      setIsQuickAddingNote(false);
      toast({
        title: "Note créée",
        description: "La note a été créée avec succès",
        variant: "success",
      });
      navigate(`/notes/${newNote.id}`);
    },
    onError: (error: any) => {
      setIsQuickAddingNote(false);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la note",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Filters & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans les notes..."
                className="pl-9 w-64"
                data-testid="input-rechercher"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="border border-border rounded-md px-3 h-9 text-sm bg-background"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              data-testid="select-status-filter"
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">Brouillons</option>
              <option value="active">Publiées</option>
              <option value="archived">Archivées</option>
            </select>
            <Link href="/notes/new">
              <Button className="gap-2" data-testid="button-nouvelle-note">
                <Plus className="w-4 h-4" />
                Nouvelle note
              </Button>
            </Link>
          </div>
          
          <div className="flex items-center gap-2">
            {selectedNotes.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-actions">
                    <MoreVertical className="w-4 h-4 mr-2" />
                    Actions ({selectedNotes.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleBulkPublish}
                    disabled={bulkPublishMutation.isPending}
                    data-testid="dropdown-bulk-publish"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Publier
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                    className="text-destructive"
                    data-testid="dropdown-bulk-delete"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Notes List */}
        {isLoading ? (
          <div className="border border-border rounded-md">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-b border-border last:border-b-0 p-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            {/* Table Header */}
            <div className="bg-muted/50 border-b border-border px-4 py-2.5">
              <div className="grid grid-cols-12 gap-4 text-[11px] font-medium text-muted-foreground items-center">
                <div className="col-span-1 flex items-center">
                  <Checkbox
                    checked={filteredNotes.length > 0 && selectedNotes.size === filteredNotes.length}
                    onCheckedChange={toggleAllNotes}
                    data-testid="checkbox-select-all"
                  />
                </div>
                <div className="col-span-3">Titre</div>
                <div className="col-span-1">Statut</div>
                <div className="col-span-1">Visibilité</div>
                <div className="col-span-2">Date de création</div>
                <div className="col-span-2">Dernière modification</div>
                <div className="col-span-1">Projet rattaché</div>
                <div className="col-span-1"></div>
              </div>
            </div>

            {/* Table Body */}
            {filteredNotes.length === 0 ? (
              <div className="py-12 px-4">
                <div className="text-center text-muted-foreground">
                  {notes.length === 0 
                    ? "Aucune note disponible. Cliquez sur \"Nouvelle note\" pour commencer."
                    : "Aucune note ne correspond à votre recherche."}
                </div>
              </div>
            ) : (
              paginatedNotes.map((note) => {
                const linkedProject = getLinkedProject(note.id);
                const isSelected = selectedNotes.has(note.id);
                
                return (
                  <div
                    key={note.id}
                    className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-border last:border-b-0 hover-elevate items-center"
                    data-testid={`row-note-${note.id}`}
                  >
                    {/* Checkbox */}
                    <div className="col-span-1 flex items-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleNoteSelection(note.id)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`checkbox-note-${note.id}`}
                      />
                    </div>

                    {/* Title */}
                    <div 
                      className="col-span-3 flex flex-col gap-1 cursor-pointer"
                      onClick={() => navigate(`/notes/${note.id}`)}
                    >
                      <div className="font-medium text-[11px] text-foreground truncate">
                        {note.title || "Sans titre"}
                      </div>
                      {note.summary && (
                        <div className="text-[10px] text-muted-foreground italic truncate flex items-center gap-1">
                          <Sparkles className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{note.summary}</span>
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <div className="col-span-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Badge
                            variant="outline"
                            className={`text-[10px] cursor-pointer hover-elevate ${
                              note.status === "draft"
                                ? "bg-gray-50 text-gray-700 border-gray-200"
                                : note.status === "active"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-orange-50 text-orange-700 border-orange-200"
                            }`}
                            data-testid={`badge-status-${note.id}`}
                          >
                            {note.status === "draft" ? "Brouillon" : note.status === "active" ? "Publiée" : "Archivée"}
                          </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-white dark:bg-background">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ 
                                noteId: note.id, 
                                data: { status: "draft" }
                              });
                            }}
                          >
                            Brouillon
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ 
                                noteId: note.id, 
                                data: { status: "active" }
                              });
                            }}
                          >
                            Publiée
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ 
                                noteId: note.id, 
                                data: { status: "archived" }
                              });
                            }}
                          >
                            Archivée
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Visibility */}
                    <div className="col-span-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Badge
                            variant="outline"
                            className={`text-[10px] cursor-pointer hover-elevate ${
                              note.visibility === "private"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : note.visibility === "account"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-cyan-50 text-cyan-700 border-cyan-200"
                            }`}
                            data-testid={`badge-visibility-${note.id}`}
                          >
                            {note.visibility === "private" ? "Privée" : note.visibility === "account" ? "Équipe" : "Client"}
                          </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-white dark:bg-background">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ 
                                noteId: note.id, 
                                data: { visibility: "private" }
                              });
                            }}
                          >
                            Privée
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ 
                                noteId: note.id, 
                                data: { visibility: "account" }
                              });
                            }}
                          >
                            Équipe
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ 
                                noteId: note.id, 
                                data: { visibility: "client_ro" }
                              });
                            }}
                          >
                            Client
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Created Date */}
                    <div className="col-span-2 flex items-center text-[11px] text-muted-foreground">
                      {format(new Date(note.createdAt), "d MMM yyyy", { locale: fr })}
                    </div>

                    {/* Last Modified */}
                    <div className="col-span-2 flex items-center text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(note.updatedAt), { 
                        addSuffix: true, 
                        locale: fr 
                      })}
                    </div>

                    {/* Linked Project */}
                    <div className="col-span-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          {linkedProject ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-violet-50 text-violet-700 border-violet-200 cursor-pointer hover-elevate"
                              data-testid={`badge-project-${note.id}`}
                            >
                              {linkedProject.name}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-gray-50 text-gray-600 border-gray-200 cursor-pointer hover-elevate"
                              data-testid={`badge-project-${note.id}`}
                            >
                              Aucun
                            </Badge>
                          )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-white dark:bg-background max-h-[300px] overflow-y-auto">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              linkProjectMutation.mutate({ 
                                noteId: note.id, 
                                projectId: null
                              });
                            }}
                          >
                            Aucun
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {projects.map((project) => (
                            <DropdownMenuItem
                              key={project.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                linkProjectMutation.mutate({ 
                                  noteId: note.id, 
                                  projectId: project.id
                                });
                              }}
                            >
                              {project.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Actions Menu */}
                    <div className="col-span-1 flex items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            data-testid={`button-actions-note-${note.id}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white dark:bg-background">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ noteId: note.id, data: { status: "active" } });
                            }}
                            data-testid={`dropdown-publish-note-${note.id}`}
                          >
                            <Globe className="w-4 h-4 mr-2" />
                            Publier
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateNote(note.id);
                            }}
                            data-testid={`dropdown-duplicate-note-${note.id}`}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(note.id);
                            }}
                            className="text-destructive"
                            data-testid={`dropdown-delete-note-${note.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}

            {/* Quick add note row */}
            {filteredNotes.length > 0 && (
              <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border items-center bg-muted/20">
                <div className="col-span-1"></div>
                <div className="col-span-11 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Créer une nouvelle note..."
                    value={quickAddNoteTitle}
                    onChange={(e) => setQuickAddNoteTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && quickAddNoteTitle.trim()) {
                        setIsQuickAddingNote(true);
                        createNoteMutation.mutate(quickAddNoteTitle.trim());
                      } else if (e.key === "Escape") {
                        setQuickAddNoteTitle("");
                      }
                    }}
                    disabled={isQuickAddingNote}
                    className="border-0 focus-visible:ring-0 text-sm h-8"
                    data-testid="input-quick-add-note"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {filteredNotes.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filteredNotes.length} note{filteredNotes.length > 1 ? 's' : ''}
              </span>
              <select
                className="border border-border rounded-md px-2 h-8 text-sm bg-background"
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value))}
                data-testid="select-page-size"
              >
                <option value="10">10 par page</option>
                <option value="20">20 par page</option>
                <option value="50">50 par page</option>
                <option value="100">100 par page</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                data-testid="button-previous-page"
              >
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} sur {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Single Note Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-note">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette note ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteNote}
              disabled={deleteNoteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Publish Dialog */}
      <Dialog open={bulkPublishDialogOpen} onOpenChange={setBulkPublishDialogOpen}>
        <DialogContent data-testid="dialog-bulk-publish">
          <DialogHeader>
            <DialogTitle>Publier les notes</DialogTitle>
            <DialogDescription>
              Voulez-vous publier {selectedNotes.size} note(s) sélectionnée(s) ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkPublishDialogOpen(false)}
              data-testid="button-cancel-publish"
            >
              Annuler
            </Button>
            <Button
              onClick={confirmBulkPublish}
              disabled={bulkPublishMutation.isPending}
              data-testid="button-confirm-publish"
            >
              Publier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent data-testid="dialog-bulk-delete">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedNotes.size} note(s) sélectionnée(s) ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
              data-testid="button-cancel-bulk-delete"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-confirm-bulk-delete"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
