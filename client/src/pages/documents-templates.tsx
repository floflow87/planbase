import { FileText, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DocumentTemplate } from "@shared/schema";

export default function DocumentTemplates() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
        <p className="text-muted-foreground">
          Sélectionnez un modèle de document pour commencer
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Chargement...</div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-6xl">
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
            {templates.map((template) => (
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
        )}
      </div>
    </div>
  );
}
