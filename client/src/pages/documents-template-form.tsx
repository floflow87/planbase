import { ArrowLeft, Save, ChevronsUpDown, Check, Plus, X, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DocumentTemplate, Project } from "@shared/schema";
import { marked } from "marked";
import { format as formatDate } from "date-fns";
import { fr } from "date-fns/locale";

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
  const [isNewProjectSheetOpen, setIsNewProjectSheetOpen] = useState(false);
  const [transmetteurRaisonSocialeOpen, setTransmetteurRaisonSocialeOpen] = useState(false);
  const [projectFormData, setProjectFormData] = useState({
    name: "",
    description: "",
    stage: "prospection" as const,
    category: "",
    clientId: "",
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    budget: "",
  });

  const { data: template, isLoading } = useQuery<DocumentTemplate>({
    queryKey: ["/api/document-templates", id],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch all users to get unique company names for autocomplete
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Get unique companies from users for autocomplete
  const uniqueCompanies = Array.from(
    new Set(
      users
        .map((user: any) => user.company)
        .filter((company: any) => company && company.trim())
    )
  );

  // Fetch user profile for autocomplete (company from app_users)
  const { data: userProfile } = useQuery<{ company?: string | null; accountId: string }>({
    queryKey: ["/api/me"],
  });

  // Fetch account info for SIRET autocomplete
  const { data: account } = useQuery<{ id: string; name: string; siret?: string | null }>({
    queryKey: ["/api/accounts", userProfile?.accountId],
    enabled: !!userProfile?.accountId,
  });

  const createProjectMutation = useMutation({
    mutationFn: async (projectData: any) => {
      const response = await apiRequest("/api/projects", "POST", {
        name: projectData.name.trim(),
        description: projectData.description?.trim() || null,
        clientId: projectData.clientId || null,
        stage: projectData.stage,
        category: projectData.category?.trim() || null,
        startDate: projectData.startDate ? projectData.startDate.toISOString().split('T')[0] : null,
        endDate: projectData.endDate ? projectData.endDate.toISOString().split('T')[0] : null,
        budget: projectData.budget?.trim() || null,
      });
      return await response.json();
    },
    onSuccess: (data: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setSelectedProjectId(data.id);
      setIsNewProjectSheetOpen(false);
      setProjectFormData({
        name: "",
        description: "",
        stage: "prospection",
        category: "",
        clientId: "",
        startDate: undefined,
        endDate: undefined,
        budget: "",
      });
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

  // Auto-fill transmetteur fields with user/account data when template loads
  useEffect(() => {
    if ((userProfile || account) && template && !formValues.transmetteur_raison_sociale) {
      // Pre-fill transmetteur fields with user company and account SIRET
      setFormValues(prev => ({
        ...prev,
        transmetteur_raison_sociale: userProfile?.company || '',
        transmetteur_identifiant: account?.siret || '',
      }));
    }
  }, [userProfile, account, template]);

  // Auto-fill project name when project is selected
  useEffect(() => {
    if (selectedProjectId && projects.length > 0) {
      const selectedProject = projects.find(p => p.id === selectedProjectId);
      if (selectedProject && formValues.projet_nom !== selectedProject.name) {
        setFormValues(prev => ({
          ...prev,
          projet_nom: selectedProject.name,
        }));
      }
    }
  }, [selectedProjectId, projects]);

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
        await apiRequest(`/api/documents/${createdDocument.id}/links`, "POST", {
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
                <Label htmlFor="project-selector">Projet</Label>
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
                    onClick={() => setIsNewProjectSheetOpen(true)}
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
                  {field.name === "transmetteur_raison_sociale" && uniqueCompanies.length > 0 ? (
                    <div className="flex gap-2">
                      <Input
                        id={field.name}
                        type={field.type || "text"}
                        value={formValues[field.name] || ""}
                        onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                        placeholder={field.placeholder}
                        required={field.required}
                        className="flex-1"
                        data-testid={`input-${field.name}`}
                      />
                      <Popover open={transmetteurRaisonSocialeOpen} onOpenChange={setTransmetteurRaisonSocialeOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-expanded={transmetteurRaisonSocialeOpen}
                            data-testid="button-suggest-company"
                          >
                            <ChevronsUpDown className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0 bg-white dark:bg-background">
                          <Command>
                            <CommandInput placeholder="Rechercher une entreprise..." />
                            <CommandEmpty>Aucune entreprise trouvée.</CommandEmpty>
                            <CommandGroup className="max-h-[300px] overflow-y-auto">
                              {uniqueCompanies.map((company: any) => (
                                <CommandItem
                                  key={company}
                                  onSelect={() => {
                                    setFormValues({ ...formValues, [field.name]: company });
                                    setTransmetteurRaisonSocialeOpen(false);
                                  }}
                                  data-testid={`option-company-${company}`}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      formValues[field.name] === company ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  {company}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : field.type === "textarea" ? (
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

      {/* New Project Sheet */}
      <Sheet open={isNewProjectSheetOpen} onOpenChange={setIsNewProjectSheetOpen}>
        <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col" data-testid="sheet-new-project">
          <SheetHeader>
            <SheetTitle>Créer un nouveau projet</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 flex-1 py-4">
            <div>
              <Label className="text-[12px]" htmlFor="new-project-name">Nom du projet *</Label>
              <Input
                id="new-project-name"
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                placeholder="Ex: Projet Alpha"
                data-testid="input-new-project-name"
              />
            </div>
            <div>
              <Label className="text-[12px]" htmlFor="new-project-description">Description</Label>
              <Textarea
                id="new-project-description"
                value={projectFormData.description}
                onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                rows={3}
                data-testid="input-new-project-description"
              />
            </div>
            <div>
              <Label className="text-[12px]" htmlFor="new-project-client">Client</Label>
              <Select
                value={projectFormData.clientId || undefined}
                onValueChange={(value) => setProjectFormData({ ...projectFormData, clientId: value })}
              >
                <SelectTrigger id="new-project-client" data-testid="select-new-project-client">
                  <SelectValue placeholder="Aucun client" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-950">
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company || client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[12px]" htmlFor="new-project-stage">Statut</Label>
                <Select
                  value={projectFormData.stage}
                  onValueChange={(value: any) => setProjectFormData({ ...projectFormData, stage: value })}
                >
                  <SelectTrigger id="new-project-stage" data-testid="select-new-project-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-950">
                    <SelectItem value="prospection">Prospection</SelectItem>
                    <SelectItem value="signe">Signé</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="termine">Terminé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[12px]" htmlFor="new-project-category">Catégorie</Label>
                <Input
                  id="new-project-category"
                  value={projectFormData.category}
                  onChange={(e) => setProjectFormData({ ...projectFormData, category: e.target.value })}
                  data-testid="input-new-project-category"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[12px]">Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-new-project-start-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {projectFormData.startDate ? (
                        formatDate(projectFormData.startDate, "PPP", { locale: fr })
                      ) : (
                        <span>Choisir une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={projectFormData.startDate}
                      onSelect={(date) => setProjectFormData({ ...projectFormData, startDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-[12px]">Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-new-project-end-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {projectFormData.endDate ? (
                        formatDate(projectFormData.endDate, "PPP", { locale: fr })
                      ) : (
                        <span>Choisir une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={projectFormData.endDate}
                      onSelect={(date) => setProjectFormData({ ...projectFormData, endDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label className="text-[12px]" htmlFor="new-project-budget">Budget (€)</Label>
              <Input
                id="new-project-budget"
                type="number"
                value={projectFormData.budget}
                onChange={(e) => setProjectFormData({ ...projectFormData, budget: e.target.value })}
                data-testid="input-new-project-budget"
              />
            </div>
          </div>
          <div className="border-t pt-4">
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsNewProjectSheetOpen(false);
                  setProjectFormData({
                    name: "",
                    description: "",
                    stage: "prospection",
                    category: "",
                    clientId: "",
                    startDate: undefined,
                    endDate: undefined,
                    budget: "",
                  });
                }}
                data-testid="button-cancel-new-project"
              >
                Annuler
              </Button>
              <Button
                onClick={() => createProjectMutation.mutate(projectFormData)}
                disabled={!projectFormData.name.trim() || createProjectMutation.isPending}
                data-testid="button-create-new-project"
              >
                {createProjectMutation.isPending ? "Création..." : "Créer le projet"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
