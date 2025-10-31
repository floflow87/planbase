import { useParams, Link } from "wouter";
import { ArrowLeft, Mic, Edit, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="h-full overflow-auto relative">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/notes">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground">
                Note #{id}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="border-violet-200 text-violet-700">
                  Réunion
                </Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>12 janvier 2025</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" data-testid="button-edit">
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
            <Button variant="destructive" data-testid="button-delete">
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </Button>
          </div>
        </div>

        {/* Note Content */}
        <Card>
          <CardHeader>
            <CardTitle>Contenu de la note</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="text-muted-foreground">
                Le contenu de la note sera affiché ici. Cette page sera complétée avec les données réelles de la note et ses fonctionnalités d'édition.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">Finance</Badge>
              <Badge variant="secondary">Projet</Badge>
              <Badge variant="secondary">Important</Badge>
            </div>
          </CardContent>
        </Card>

        {/* AI Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Résumé IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-12 text-center text-muted-foreground">
              Résumé généré par IA à implémenter
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floating Mic Button - Sticky bottom right */}
      <Button
        size="lg"
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full shadow-lg bg-violet-600 hover:bg-violet-700 z-50"
        data-testid="button-record-audio"
      >
        <Mic className="w-6 h-6" />
      </Button>
    </div>
  );
}
