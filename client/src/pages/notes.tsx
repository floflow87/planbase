import { Search, Filter, Settings as SettingsIcon, Download, LayoutGrid, List, Table2, Plus, Sparkles, File, Mic } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Notes() {
  // Mock data
  const notes = [
    {
      id: "1",
      category: "Marketing",
      categoryColor: "bg-orange-100 text-orange-700 border-orange-200",
      title: "Stratégie de lancement produit Q1 2024",
      preview: "Analyse des tendances marché et définition de la stratégie de positionnement pour le lancement du nouveau produit SaaS. Focus sur l'acquisition client B2B...",
      tags: ["TechCorp", "SaaS Launch"],
      attachments: 3,
      updatedAt: "Modifié il y a 2h",
      author: { name: "Sarah M.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" },
    },
    {
      id: "2",
      category: "Produit",
      categoryColor: "bg-blue-100 text-blue-700 border-blue-200",
      title: "Feedback utilisateurs - Dashboard V2",
      preview: "Compilation des retours utilisateurs sur la nouvelle interface dashboard. Points d'amélioration identifiés : navigation, filtres avancés, performance mobile...",
      tags: [],
      attachments: 0,
      updatedAt: "Modifié il y a 1j",
      author: { name: "Alex J.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" },
    },
    {
      id: "3",
      category: "Finance",
      categoryColor: "bg-green-100 text-green-700 border-green-200",
      title: "Prévisions budget 2024 - Startup",
      preview: "Projection financière détaillée pour 2024 incluant les coûts d'acquisition client, salaires équipe, infrastructure cloud et marketing digital...",
      tags: ["StartupCo", "Budget 2024"],
      attachments: 2,
      updatedAt: "Modifié il y a 3j",
      author: { name: "Alex J.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" },
    },
    {
      id: "4",
      category: "Legal",
      categoryColor: "bg-purple-100 text-purple-700 border-purple-200",
      title: "Contrat partenariat - TechVenture",
      preview: "Points clés du contrat de partenariat stratégique avec TechVenture. Clauses de propriété intellectuelle, revenus partagés et exclusivité territoriale...",
      tags: ["TechVenture"],
      attachments: 2,
      updatedAt: "Modifié il y a 1 sem",
      author: { name: "Marie L.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marie" },
    },
  ];

  return (
    <div className="flex-1 overflow-auto bg-background relative" data-testid="page-notes">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-heading font-semibold text-foreground" data-testid="text-page-title">Notes</h1>
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
            <p className="mt-1 text-sm">
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
          {notes.map((note) => (
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
                      <h3 className="font-heading font-semibold text-lg text-foreground mb-2">
                        {note.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {note.preview}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      {note.tags.length > 0 && (
                        <div className="flex items-center gap-2">
                          {note.tags.map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs font-normal">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {note.attachments > 0 && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <File className="w-4 h-4" />
                          <span>{note.attachments} fichiers</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <span>{note.updatedAt}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={note.author.avatar} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {note.author.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground">{note.author.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Floating Audio Button */}
      <Button
        size="lg"
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full shadow-lg bg-violet-600 hover:bg-violet-700"
        data-testid="button-record-audio"
      >
        <Mic className="w-6 h-6" />
      </Button>
    </div>
  );
}
