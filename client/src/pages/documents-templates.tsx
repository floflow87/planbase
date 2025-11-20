import { FileText, ArrowLeft, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DocumentTemplate } from "@shared/schema";
import { useState, useMemo } from "react";

// Mapping des catégories vers des titres en français
const CATEGORY_LABELS: Record<string, string> = {
  legal: "Juridique",
  creative: "Créatif",
  contract: "Contrats",
  business: "Affaires",
};

export default function DocumentTemplates() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: templates = [], isLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
  });

  // Mutation pour créer un document vierge
  const createBlankDocumentMutation = useMutation({
    mutationFn: async () => {
      const document = {
        name: "Nouveau document",
        templateId: null,
        formData: {},
        content: "",
        plainText: "",
        status: "draft",
      };

      const response = await apiRequest("/api/documents", "POST", document);
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document créé",
        description: "Un nouveau document vierge a été créé",
        variant: "success",
      });
      navigate(`/documents/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le document",
        variant: "destructive",
      });
    },
  });

  // Filtrer et grouper les templates
  const groupedTemplates = useMemo(() => {
    const query = (searchQuery ?? "").trim().toLowerCase();
    
    // Filtrer les templates
    const filtered = query === "" 
      ? templates 
      : templates.filter((template) => {
          const nameMatch = template.name.toLowerCase().includes(query);
          const descriptionMatch = (template.description ?? "").toLowerCase().includes(query);
          return nameMatch || descriptionMatch;
        });

    // Grouper par catégorie
    const grouped = filtered.reduce((acc, template) => {
      const category = template.category || "business";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(template);
      return acc;
    }, {} as Record<string, DocumentTemplate[]>);

    return { filtered, grouped };
  }, [templates, searchQuery]);

  // Ordre d'affichage des catégories
  const categoryOrder = ["legal", "creative", "contract", "business"];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/documents")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">Choisir un modèle</h1>
          </div>
        </div>
        <p className="text-muted-foreground mb-4">
          Recherchez un modèle de document ou créez une page vierge
        </p>
        
        {/* Barre de recherche */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Rechercher un modèle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-templates"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Chargement...</div>
          </div>
        ) : groupedTemplates.filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg mb-2">
                Aucun modèle trouvé pour "{searchQuery}"
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Essayez une autre recherche ou créez un document vierge
              </p>
              <Button
                variant="outline"
                onClick={() => createBlankDocumentMutation.mutate()}
                data-testid="button-create-blank"
              >
                <FileText className="h-4 w-4 mr-2" />
                Page vierge
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl space-y-8">
            {/* Bouton Page vierge toujours en premier */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Créer</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card
                  className="hover-elevate cursor-pointer"
                  onClick={() => createBlankDocumentMutation.mutate()}
                  data-testid="card-template-blank"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base mb-2" data-testid="text-template-name-blank">
                          Page vierge
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          Créer un document vierge sans modèle prédéfini
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Templates groupés par catégorie */}
            {categoryOrder.map((category) => {
              const categoryTemplates = groupedTemplates.grouped[category];
              if (!categoryTemplates || categoryTemplates.length === 0) return null;

              return (
                <div key={category}>
                  <h2 className="text-lg font-semibold mb-4" data-testid={`heading-category-${category}`}>
                    {CATEGORY_LABELS[category] || category}
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categoryTemplates.map((template) => (
                      <Card
                        key={template.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => navigate(`/documents/templates/${template.id}`)}
                        data-testid={`card-template-${template.id}`}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-base mb-2" data-testid={`text-template-name-${template.id}`}>
                                {template.name}
                              </h3>
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {template.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
