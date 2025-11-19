import { ArrowLeft, Save, ChevronsUpDown, Check, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DocumentTemplate, Project } from "@shared/schema";
import { marked } from "marked";

// Utility function to replace {{placeholders}} with values and handle conditional blocks
function replacePlaceholders(template: string, values: Record<string, string>): string {
  // First, handle conditional blocks {{#if field}}...{{/if}}
  let result = template.replace(/\{\{#if\s+([^}]+)\}\}(.*?)\{\{\/if\}\}/gs, (match, key, content) => {
    const value = values[key.trim()];
    // If value exists and is not empty, include the content
    return value && value.trim() ? content : '';
  });
  
  // Then replace simple placeholders
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    return values[key.trim()] || match;
  });
  
  return result;
}

// Configure marked for better formatting
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // Enable GitHub Flavored Markdown
});

export default function DocumentTemplateForm() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [documentTitle, setDocumentTitle] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  const { data: template, isLoading } = useQuery<DocumentTemplate>({
    queryKey: ["/api/document-templates", id],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch user profile to get accountId
  const { data: userProfile } = useQuery<any>({
    queryKey: ["/api/me"],
  });

  // Fetch account info for autocomplete
  const { data: account } = useQuery<{ id: string; name: string; siret?: string | null }>({
    queryKey: ["/api/accounts", userProfile?.accountId],
    enabled: !!userProfile?.accountId,
  });

  const createProjectMutation = useMutation({
    mutationFn: async (projectData: { name: string; description: string }) => {
      const response = await apiRequest("/api/projects", "POST", {
        name: projectData.name,
        description: projectData.description,
        stage: "ideation",
      });
      return await response.json();
    },
    onSuccess: (data: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setSelectedProjectId(data.id);
      setIsNewProjectDialogOpen(false);
      setNewProjectName("");
      setNewProjectDescription("");
      toast({
        title: "Projet créé",
        description: "Le projet a été créé avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le projet",
        variant: "destructive",
      });
    },
  });

  // Auto-fill transmetteur fields with account data when template loads
  useEffect(() => {
    if (account && template && !formValues.transmetteur_raison_sociale) {
      // Pre-fill transmetteur fields with account data
      setFormValues(prev => ({
        ...prev,
        transmetteur_raison_sociale: account.name || '',
        transmetteur_identifiant: account.siret || '',
      }));
    }
  }, [account, template]);

  const createDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("Template not found");
      if (!documentTitle.trim()) throw new Error("Le titre est requis");

      // Replace placeholders in the Markdown template
      const markdownContent = replacePlaceholders(template.contentTemplate, formValues);
      
      // Convert Markdown to HTML
      const htmlContent = await marked.parse(markdownContent);
      
      const document = {
        name: documentTitle,
        templateId: template.id,
        formData: formValues,
        content: htmlContent,
        plainText: markdownContent.replace(/[#*_~`>\[\]]/g, ''), // Remove Markdown syntax for plain text
        status: "draft",
      };

      const response = await apiRequest("/api/documents", "POST", document);
      const createdDocument = await response.json();

      // Create document link if project is selected
      if (selectedProjectId) {
        await apiRequest("/api/document-links", "POST", {
          documentId: createdDocument.id,
          targetType: "project",
          targetId: selectedProjectId,
        });
      }

      return createdDocument;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-links"] });
      toast({
        title: "Document créé",
        description: "Le document a été créé avec succès",
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

              <div className="space-y-2">
                <Label htmlFor="project-selector">Projet (optionnel)</Label>
                <div className="flex gap-2">
                  <Popover open={projectSelectorOpen} onOpenChange={setProjectSelectorOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={projectSelectorOpen}
                        className="flex-1 justify-between text-[12px]"
                        data-testid="select-project"
                      >
                        {selectedProjectId 
                          ? projects.find((p) => p.id === selectedProjectId)?.name || "Sélectionner un projet"
                          : "Sélectionner un projet"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 bg-white dark:bg-background">
                      <Command>
                        <CommandInput placeholder="Rechercher un projet..." />
                        <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-y-auto bg-[#ffffff]">
                          <CommandItem
                            onSelect={() => {
                              setSelectedProjectId("");
                              setProjectSelectorOpen(false);
                            }}
                            data-testid="option-project-none"
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                !selectedProjectId ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            Aucun projet
                          </CommandItem>
                          {projects.map((project) => (
                            <CommandItem
                              key={project.id}
                              onSelect={() => {
                                setSelectedProjectId(project.id);
                                setProjectSelectorOpen(false);
                              }}
                              data-testid={`option-project-${project.id}`}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  selectedProjectId === project.id ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{project.name}</div>
                                {project.description && (
                                  <div className="text-xs text-muted-foreground truncate">{project.description}</div>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsNewProjectDialogOpen(true)}
                    data-testid="button-new-project"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {selectedProjectId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedProjectId("")}
                      data-testid="button-clear-project"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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

      {/* New Project Dialog */}
      <Dialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouveau projet</DialogTitle>
            <DialogDescription>
              Créez un nouveau projet pour l'associer à ce document
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-project-name">Nom du projet *</Label>
              <Input
                id="new-project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Ex: Projet Alpha"
                data-testid="input-new-project-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-project-description">Description</Label>
              <Textarea
                id="new-project-description"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Description du projet..."
                rows={3}
                data-testid="input-new-project-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsNewProjectDialogOpen(false);
                setNewProjectName("");
                setNewProjectDescription("");
              }}
              data-testid="button-cancel-new-project"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (newProjectName.trim()) {
                  createProjectMutation.mutate({
                    name: newProjectName,
                    description: newProjectDescription,
                  });
                }
              }}
              disabled={!newProjectName.trim() || createProjectMutation.isPending}
              data-testid="button-create-new-project"
            >
              {createProjectMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
