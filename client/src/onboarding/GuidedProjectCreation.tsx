import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { getProfileById, type UserProfileType } from "@shared/userProfiles";
import type { Client } from "@shared/schema";

interface GuidedProjectCreationProps {
  profileType: UserProfileType | null;
  onComplete: (projectId: string) => void;
  onBack: () => void;
}

interface ProjectData {
  name: string;
  clientId: string | null;
  isInternal: boolean;
  projectType: string;
  estimatedDuration: string;
  profileFields: Record<string, string>;
}

const PROJECT_TYPES_BY_PROFILE: Record<UserProfileType, string[]> = {
  designer: ['Identité visuelle', 'UI/UX Design', 'Webdesign', 'Illustration', 'Motion design', 'Autre'],
  project_manager: ['Projet client', 'Projet interne', 'Migration', 'Intégration', 'Autre'],
  pm: ['Nouvelle feature', 'MVP', 'Refonte produit', 'Expérimentation', 'Autre'],
  cto: ['Architecture', 'Migration technique', 'Nouveau produit', 'Refactoring', 'Autre'],
  developer: ['Feature', 'Bug fix', 'Refactoring', 'Side project', 'Autre'],
  freelance: ['Mission client', 'Projet forfait', 'Régie', 'Projet personnel', 'Autre'],
};

export function GuidedProjectCreation({ profileType, onComplete, onBack }: GuidedProjectCreationProps) {
  const [step, setStep] = useState(1);
  const [projectData, setProjectData] = useState<ProjectData>({
    name: '',
    clientId: null,
    isInternal: false,
    projectType: '',
    estimatedDuration: '',
    profileFields: {},
  });

  const profile = profileType ? getProfileById(profileType) : null;
  const projectTypes = profileType ? PROJECT_TYPES_BY_PROFILE[profileType] : PROJECT_TYPES_BY_PROFILE.freelance;

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/projects", "POST", {
        name: projectData.name,
        clientId: projectData.isInternal ? null : projectData.clientId,
        projectType: projectData.projectType,
        status: 'active',
        notes: formatProfileNotes(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onComplete(data.id);
    },
  });

  const formatProfileNotes = (): string => {
    if (!profile || Object.keys(projectData.profileFields).length === 0) return '';
    
    const notes = profile.projectFields
      .filter(field => projectData.profileFields[field.id])
      .map(field => `**${field.label}:**\n${projectData.profileFields[field.id]}`)
      .join('\n\n');
    
    return notes;
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    setProjectData(prev => ({
      ...prev,
      profileFields: { ...prev.profileFields, [fieldId]: value },
    }));
  };

  const canProceedStep1 = projectData.name.trim().length > 0;
  const canProceedStep2 = true;

  const handleNext = () => {
    if (step === 1 && canProceedStep1) {
      setStep(2);
    } else if (step === 2) {
      createProjectMutation.mutate();
    }
  };

  const totalSteps = 2;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-card rounded-xl shadow-2xl p-6 max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={step === 1 ? onBack : () => setStep(1)}
            data-testid="button-back-project"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
          <div className="text-sm text-muted-foreground">
            Étape {step} / {totalSteps}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold mb-1">Informations du projet</h2>
              <p className="text-sm text-muted-foreground">
                Les bases pour commencer à travailler
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">Nom du projet *</Label>
                <Input
                  id="projectName"
                  placeholder="Ex: Refonte site client, MVP App mobile..."
                  value={projectData.name}
                  onChange={(e) => setProjectData(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-project-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Type de projet</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={projectData.isInternal ? "outline" : "default"}
                    size="sm"
                    onClick={() => setProjectData(prev => ({ ...prev, isInternal: false }))}
                    className="flex-1"
                    data-testid="button-client-project"
                  >
                    Client
                  </Button>
                  <Button
                    type="button"
                    variant={projectData.isInternal ? "default" : "outline"}
                    size="sm"
                    onClick={() => setProjectData(prev => ({ ...prev, isInternal: true, clientId: null }))}
                    className="flex-1"
                    data-testid="button-internal-project"
                  >
                    Interne
                  </Button>
                </div>
              </div>

              {!projectData.isInternal && clients.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="client">Client</Label>
                  <Select
                    value={projectData.clientId || ""}
                    onValueChange={(value) => setProjectData(prev => ({ ...prev, clientId: value || null }))}
                  >
                    <SelectTrigger data-testid="select-client">
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="projectType">Catégorie</Label>
                <Select
                  value={projectData.projectType}
                  onValueChange={(value) => setProjectData(prev => ({ ...prev, projectType: value }))}
                >
                  <SelectTrigger data-testid="select-project-type">
                    <SelectValue placeholder="Type de projet" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Durée estimée</Label>
                <Select
                  value={projectData.estimatedDuration}
                  onValueChange={(value) => setProjectData(prev => ({ ...prev, estimatedDuration: value }))}
                >
                  <SelectTrigger data-testid="select-duration">
                    <SelectValue placeholder="Durée approximative" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1w">1 semaine</SelectItem>
                    <SelectItem value="2w">2 semaines</SelectItem>
                    <SelectItem value="1m">1 mois</SelectItem>
                    <SelectItem value="2m">2-3 mois</SelectItem>
                    <SelectItem value="6m">6 mois ou plus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && profile && (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold mb-1">Détails spécifiques</h2>
              <p className="text-sm text-muted-foreground">
                Optionnel - tu pourras compléter plus tard
              </p>
            </div>

            <div className="space-y-4">
              {profile.projectFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>{field.label}</Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={field.id}
                      placeholder={field.placeholder}
                      value={projectData.profileFields[field.id] || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      rows={3}
                      data-testid={`input-${field.id}`}
                    />
                  ) : field.type === 'number' ? (
                    <Input
                      id={field.id}
                      type="number"
                      placeholder={field.placeholder}
                      value={projectData.profileFields[field.id] || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      data-testid={`input-${field.id}`}
                    />
                  ) : (
                    <Input
                      id={field.id}
                      placeholder={field.placeholder}
                      value={projectData.profileFields[field.id] || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      data-testid={`input-${field.id}`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="bg-muted/50 rounded-lg p-4 mt-4">
              <p className="text-xs text-muted-foreground">
                Voici une base de travail. Tu pourras affiner, chiffrer et structurer plus finement ensuite.
              </p>
            </div>
          </div>
        )}

        {step === 2 && !profile && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Prêt à créer ton projet !</p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleNext}
            disabled={
              (step === 1 && !canProceedStep1) || 
              createProjectMutation.isPending
            }
            className="flex-1"
            data-testid="button-next-project"
          >
            {createProjectMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Création...
              </>
            ) : step === totalSteps ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Créer le projet
              </>
            ) : (
              <>
                Suivant
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
