import { Search, Filter, Settings as SettingsIcon, Download, LayoutGrid, List, Table2, Plus, Sparkles, File } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
import type { Note, AppUser } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function Notes() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "archived">("all");

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
  });

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

  const getUserById = (userId: string) => {
    return users.find((u) => u.id === userId);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "bg-gray-100 text-gray-700 border-gray-200",
      active: "bg-green-50 text-green-700 border-green-200",
      archived: "bg-orange-50 text-orange-700 border-orange-200",
    };
    return variants[status as keyof typeof variants] || variants.active;
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-end">
          <Link href="/notes/new">
            <Button className="gap-2" data-testid="button-nouvelle-note">
              <Plus className="w-4 h-4" />
              Nouvelle note
            </Button>
          </Link>
        </div>

        {/* Filters & View Controls */}
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
              <option value="active">Actives</option>
              <option value="archived">Archivées</option>
            </select>
          </div>
        </div>

        {/* Notes Grid */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                    <div className="h-6 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-full"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotes.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    {notes.length === 0 
                      ? "Aucune note disponible. Cliquez sur \"Nouvelle note\" pour commencer."
                      : "Aucune note ne correspond à votre recherche."}
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredNotes.map((note) => {
                const author = getUserById(note.createdBy);
                const preview = note.plainText?.slice(0, 150) || note.summary?.slice(0, 150) || "";
                
                return (
                  <Card 
                    key={note.id} 
                    className="hover-elevate cursor-pointer transition-shadow" 
                    data-testid={`card-note-${note.id}`}
                    onClick={() => navigate(`/notes/${note.id}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusBadge(note.status)} variant="outline">
                              {note.status === "draft" ? "Brouillon" : note.status === "archived" ? "Archivée" : "Active"}
                            </Badge>
                            {note.visibility !== "private" && (
                              <Badge variant="secondary" className="text-[10px]">
                                {note.visibility === "account" ? "Partagée (équipe)" : "Partagée (client)"}
                              </Badge>
                            )}
                          </div>

                          <div>
                            <h3 className="font-heading font-semibold text-base text-foreground mb-2">
                              {note.title || "Sans titre"}
                            </h3>
                            {preview && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {preview}
                              </p>
                            )}
                            {note.summary && (
                              <p className="text-xs text-muted-foreground/80 italic mt-2 line-clamp-1">
                                Résumé IA: {note.summary}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>
                                {formatDistanceToNow(new Date(note.updatedAt), { 
                                  addSuffix: true, 
                                  locale: fr 
                                })}
                              </span>
                            </div>

                            {author && (
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={author.avatarUrl || undefined} />
                                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                                    {author.fullName?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground">{author.fullName || 'Utilisateur'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
