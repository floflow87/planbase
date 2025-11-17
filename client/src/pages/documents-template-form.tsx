import { ArrowLeft, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DocumentTemplate } from "@shared/schema";

// Utility function to replace {{placeholders}} with values
function replacePlaceholders(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    return values[key.trim()] || match;
  });
}

export default function DocumentTemplateForm() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [documentTitle, setDocumentTitle] = useState("");

  const { data: template, isLoading } = useQuery<DocumentTemplate>({
    queryKey: ["/api/document-templates", id],
  });

  const createDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("Template not found");
      if (!documentTitle.trim()) throw new Error("Le titre est requis");

      const content = replacePlaceholders(template.contentTemplate, formValues);
      
      const document = {
        name: documentTitle,
        templateId: template.id,
        formData: formValues,
        content,
        plainText: content.replace(/<[^>]*>/g, ''),
        status: "draft",
      };

      const response = await apiRequest("/api/documents", "POST", document);
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document créé",
        description: "Le document a été créé avec succès",
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Modèle non trouvé</p>
        <Button onClick={() => navigate("/documents/templates")}>
          Retour aux modèles
        </Button>
      </div>
    );
  }

  const formSchema = ((template.formSchema as any)?.fields || []) as Array<{
    name: string;
    label: string;
    type: string;
    required?: boolean;
    placeholder?: string;
  }>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDocumentMutation.mutate();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/documents/templates")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-template-name">{template.name}</h1>
            <p className="text-sm text-muted-foreground">{template.description}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Informations du document</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="document-title">Titre du document *</Label>
                <Input
                  id="document-title"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="Ex: NDA - Projet Alpha"
                  required
                  data-testid="input-document-title"
                />
              </div>

              {formSchema && formSchema.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && " *"}
                  </Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={field.name}
                      value={formValues[field.name] || ""}
                      onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                      placeholder={field.placeholder}
                      required={field.required}
                      rows={4}
                      data-testid={`input-${field.name}`}
                    />
                  ) : (
                    <Input
                      id={field.name}
                      type={field.type || "text"}
                      value={formValues[field.name] || ""}
                      onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                      placeholder={field.placeholder}
                      required={field.required}
                      data-testid={`input-${field.name}`}
                    />
                  )}
                </div>
              ))}

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/documents/templates")}
                  data-testid="button-cancel"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createDocumentMutation.isPending}
                  data-testid="button-create-document"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createDocumentMutation.isPending ? "Création..." : "Créer le document"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
