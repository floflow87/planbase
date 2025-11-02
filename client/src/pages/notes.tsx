import { Search, Filter, Settings as SettingsIcon, Download, LayoutGrid, List, Table2, Plus, Sparkles, File } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Notes() {
  const notes: any[] = [];

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-end">
          <Button className="gap-2" data-testid="button-nouvelle-note">
            <Plus className="w-4 h-4" />
            Nouvelle note
          </Button>
        </div>

        {/* AI Suggestion Banner */}
        <Alert className="bg-violet-50 border-violet-200" data-testid="alert-suggestion-ia">
          <Sparkles className="w-5 h-5 text-violet-600" />
          <AlertDescription className="text-violet-900">
            <span className="font-semibold">Suggestion IA</span>
            <p className="mt-1 text-xs">
              Tu sembles chercher les dernières notes liées à ton projet de SaaS Fintech.{" "}
              <button className="underline font-medium hover:text-violet-700">
                Filtrer par tag 'Finance' et client 'TechCorp' ?
              </button>
            </p>
          </AlertDescription>
        </Alert>

        {/* Filters & View Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                className="pl-9 w-64"
                data-testid="input-rechercher"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-filtres">
              <Filter className="w-4 h-4" />
              Filtres
            </Button>
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-exporter">
              <Download className="w-4 h-4" />
              Exporter
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-border rounded-md p-1">
              <Button variant="secondary" size="sm" data-testid="button-view-kanban">
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" data-testid="button-view-liste">
                <List className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" data-testid="button-view-tableau">
                <Table2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Notes Grid */}
        <div className="space-y-3">
          {notes.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  Aucune note disponible. Cliquez sur "Nouvelle note" pour commencer.
                </div>
              </CardContent>
            </Card>
          ) : (
            notes.map((note) => (
            <Card key={note.id} className="hover-elevate cursor-pointer transition-shadow" data-testid={`card-note-${note.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className={`border ${note.categoryColor}`} variant="outline">
                        {note.category}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-heading font-semibold text-base text-foreground mb-2">
                        {note.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {note.preview}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      {note.tags.length > 0 && (
                        <div className="flex items-center gap-2">
                          {note.tags.map((tag: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-[10px] font-normal">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {note.attachments > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <File className="w-4 h-4" />
                          <span>{note.attachments} fichiers</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{note.updatedAt}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={note.author.avatar} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                            {note.author.name.split(' ').map((n: string) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{note.author.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
