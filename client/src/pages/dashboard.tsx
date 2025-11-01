import { ArrowUp, ArrowDown, FolderKanban, Users, Euro, CheckSquare, Plus, FileText, TrendingUp, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, Client, Activity, AppUser, InsertClient, InsertProject } from "@shared/schema";
import { insertClientSchema, insertProjectSchema } from "@shared/schema";
import { useState, useEffect } from "react";

// Fonction pour obtenir les couleurs du badge selon le stage (même logique que dans project-detail.tsx)
const getStageColor = (stage: string) => {
  const colors: Record<string, string> = {
    prospection: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    en_cours: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    termine: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    signe: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };
  return colors[stage] || "";
};

// Fonction pour obtenir le label du stage
const getStageLabel = (stage: string) => {
  const labels: Record<string, string> = {
    prospection: "Prospection",
    en_cours: "En cours",
    termine: "Terminé",
    signe: "Signé",
  };
  return labels[stage] || stage;
};

// Fonction pour traduire les types d'activités
const translateActivityKind = (kind: string) => {
  const translations: Record<string, string> = {
    created: "créé",
    updated: "mis à jour",
    deleted: "supprimé",
    email: "email envoyé",
    call: "appel",
    meeting: "réunion",
    note: "note",
  };
  return translations[kind] || kind;
};

// Fonction pour traduire les types de sujets
const translateSubjectType = (subjectType: string) => {
  const translations: Record<string, string> = {
    project: "projet",
    client: "client",
    deal: "affaire",
    task: "tâche",
    note: "note",
    contact: "contact",
  };
  return translations[subjectType] || subjectType;
};

// Fonction pour traduire les descriptions d'activités
const translateActivityDescription = (description: string) => {
  const translations: Record<string, string> = {
    "Project created:": "Projet créé :",
    "Project updated:": "Projet mis à jour :",
    "Project deleted:": "Projet supprimé :",
    "New client onboarded:": "Nouveau client enregistré :",
    "Client updated:": "Client mis à jour :",
    "Client deleted:": "Client supprimé :",
    "Task created:": "Tâche créée :",
    "Task updated:": "Tâche mise à jour :",
    "Task deleted:": "Tâche supprimée :",
    "Contact created:": "Contact créé :",
    "Contact updated:": "Contact mis à jour :",
    "Contact deleted:": "Contact supprimé :",
  };
  
  // Try to translate known patterns
  for (const [key, value] of Object.entries(translations)) {
    if (description.includes(key)) {
      return description.replace(key, value);
    }
  }
  
  return description;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isCreateClientDialogOpen, setIsCreateClientDialogOpen] = useState(false);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);

  // Fetch current user to get accountId
  const { data: currentUser } = useQuery<AppUser>({
    queryKey: ["/api/me"],
  });

  const accountId = currentUser?.accountId;

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!accountId,
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: !!accountId,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    enabled: !!accountId,
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      return await apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsCreateClientDialogOpen(false);
      clientForm.reset();
      toast({ title: "Client créé avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      return await apiRequest("POST", "/api/projects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsCreateProjectDialogOpen(false);
      projectForm.reset();
      toast({ title: "Projet créé avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  // Form for client creation
  const clientForm = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      accountId: accountId || "",
      name: "",
      type: "company",
      status: "prospecting",
      budget: "0",
      tags: [],
      contacts: [],
      notes: "",
      createdBy: currentUser?.id || "",
    },
  });

  // Form for project creation
  const projectForm = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      accountId: accountId || "",
      name: "",
      description: "",
      stage: "prospection",
      category: "",
      budget: "0",
      tags: [],
      meta: {},
      createdBy: currentUser?.id || "",
    },
  });

  // Update form default values when accountId and currentUser become available
  useEffect(() => {
    if (accountId && currentUser) {
      clientForm.reset({
        accountId: accountId,
        name: "",
        type: "company",
        status: "prospecting",
        budget: "0",
        tags: [],
        contacts: [],
        notes: "",
        createdBy: currentUser.id,
      });
      projectForm.reset({
        accountId: accountId,
        name: "",
        description: "",
        stage: "prospection",
        category: "",
        budget: "0",
        tags: [],
        meta: {},
        createdBy: currentUser.id,
      });
    }
  }, [accountId, currentUser, clientForm, projectForm]);

  const onClientSubmit = (data: InsertClient) => {
    createClientMutation.mutate(data);
  };

  const onProjectSubmit = (data: InsertProject) => {
    createProjectMutation.mutate(data);
  };

  if (!accountId || projectsLoading || clientsLoading || activitiesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  // Calculate real KPIs
  // Par définition, tous les projets sont "en cours" sauf ceux qui sont terminés
  const activeProjectsCount = projects.filter(p => p.stage !== "termine").length;
  const totalProjectsCount = projects.length;
  const clientsCount = clients.length;
  const totalRevenue = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);

  // KPI data from real data
  const kpis: Array<{
    title: string;
    value: string;
    change: string;
    changeType: "positive" | "negative" | "neutral";
    icon: any;
    iconBg: string;
    iconColor: string;
  }> = [
    {
      title: "Projets en cours",
      value: activeProjectsCount.toString(),
      change: totalProjectsCount > 0 ? `${totalProjectsCount} au total` : "0 au total",
      changeType: "neutral",
      icon: FolderKanban,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      title: "Clients",
      value: clientsCount.toString(),
      change: "+12.5%",
      changeType: "positive",
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      title: "Budget Total",
      value: `€${totalRevenue.toLocaleString()}`,
      change: "+8.2%",
      changeType: "positive",
      icon: Euro,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      title: "Projets Total",
      value: totalProjectsCount.toString(),
      change: `${activeProjectsCount} actifs`,
      changeType: "neutral",
      icon: CheckSquare,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
    },
  ];

  // Recent 5 projects from API, sorted by creation date
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Activity feed from API
  const activityFeed = activities.slice(0, 5);

  // Revenue data for chart (mock for now)
  const revenueData = [
    { month: "Jan", revenue: 12000 },
    { month: "Fév", revenue: 15000 },
    { month: "Mar", revenue: 18500 },
    { month: "Avr", revenue: 20000 },
    { month: "Mai", revenue: 22500 },
    { month: "Juin", revenue: 24500 },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Create Client Dialog */}
        <Dialog open={isCreateClientDialogOpen} onOpenChange={setIsCreateClientDialogOpen}>
          <DialogContent data-testid="dialog-create-client">
            <DialogHeader>
              <DialogTitle>Créer un nouveau client</DialogTitle>
            </DialogHeader>
            <Form {...clientForm}>
              <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4">
                <FormField
                  control={clientForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du client</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-client-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={clientForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-client-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="company">Entreprise</SelectItem>
                            <SelectItem value="person">Personne</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={clientForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-client-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="prospecting">Prospection</SelectItem>
                            <SelectItem value="qualified">Qualifié</SelectItem>
                            <SelectItem value="negotiation">Négociation</SelectItem>
                            <SelectItem value="won">Gagné</SelectItem>
                            <SelectItem value="lost">Perdu</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={clientForm.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value || 0}
                          onChange={(e) => field.onChange(e.target.value)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          disabled={field.disabled}
                          data-testid="input-client-budget"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateClientDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createClientMutation.isPending} data-testid="button-submit-client">
                    Créer
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Create Project Dialog */}
        <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
          <DialogContent data-testid="dialog-create-project">
            <DialogHeader>
              <DialogTitle>Créer un nouveau projet</DialogTitle>
            </DialogHeader>
            <Form {...projectForm}>
              <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-4">
                <FormField
                  control={projectForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du projet</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-project-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={projectForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-project-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={projectForm.control}
                    name="stage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Étape</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "prospection"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-project-stage">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="prospection">Prospection</SelectItem>
                            <SelectItem value="en_cours">En cours</SelectItem>
                            <SelectItem value="termine">Terminé</SelectItem>
                            <SelectItem value="signe">Signé</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={projectForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catégorie</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-project-category" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={projectForm.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value || 0}
                          onChange={(e) => field.onChange(e.target.value)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          disabled={field.disabled}
                          data-testid="input-project-budget"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateProjectDialogOpen(false)}
                    data-testid="button-cancel-project"
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createProjectMutation.isPending} data-testid="button-submit-project">
                    Créer
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Bienvenue sur Planbase
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsCreateClientDialogOpen(true)}
              data-testid="button-new-client"
              className="flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Nouveau Client</span>
              <span className="sm:hidden">Client</span>
            </Button>
            <Button 
              size="sm" 
              onClick={() => setIsCreateProjectDialogOpen(true)}
              data-testid="button-new-project"
              className="flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Nouveau Projet</span>
              <span className="sm:hidden">Projet</span>
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <Card key={index} data-testid={`card-kpi-${index}`}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground font-medium">
                        {kpi.title}
                      </p>
                      <h3 className="text-2xl font-heading font-bold mt-2 text-foreground">
                        {kpi.value}
                      </h3>
                      <p className={`text-xs mt-2 flex items-center gap-1 ${
                        kpi.changeType === "positive" 
                          ? "text-green-600" 
                          : kpi.changeType === "negative" 
                            ? "text-red-600"
                            : "text-muted-foreground"
                      }`}>
                        {kpi.changeType === "positive" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : kpi.changeType === "negative" ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : null}
                        {kpi.change}
                      </p>
                    </div>
                    <div className={`${kpi.iconBg} p-3 rounded-md shrink-0`}>
                      <Icon className={`w-6 h-6 ${kpi.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Revenue Chart - Col Span 2 */}
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 space-y-0 pb-2">
              <CardTitle className="text-base font-heading font-semibold">
                Revenus Mensuels
              </CardTitle>
              <Button variant="ghost" size="sm" data-testid="button-view-all-revenue">
                <span className="hidden sm:inline">Voir tout</span>
                <span className="sm:hidden">Tout</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="min-w-0">
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-heading font-semibold">
                Activités Récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityFeed.map((activity) => {
                  const payload = activity.payload as { description?: string };
                  const translatedKind = translateActivityKind(activity.kind);
                  const translatedSubject = translateSubjectType(activity.subjectType);
                  const description = payload.description 
                    ? translateActivityDescription(payload.description)
                    : `${translatedSubject} ${translatedKind}`;
                  return (
                    <div key={activity.id} className="flex items-start gap-3" data-testid={`activity-${activity.id}`}>
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground capitalize">
                          {description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 space-y-0 pb-2">
            <CardTitle className="text-base font-heading font-semibold">
              Projets Récents
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation("/projects")}
              data-testid="button-view-all-projects"
            >
              <span className="hidden sm:inline">Voir tout</span>
              <span className="sm:hidden">Tout</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun projet récent</p>
              ) : (
                recentProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 rounded-md hover-elevate active-elevate-2 border border-border cursor-pointer"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                    data-testid={`project-${project.id}`}
                  >
                    <div className="w-1 h-12 rounded bg-primary shrink-0 hidden sm:block" />
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <h4 className="text-sm font-medium text-foreground truncate">{project.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.description || "Aucune description"}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto flex-wrap">
                      <Badge className={`${getStageColor(project.stage || "prospection")} shrink-0`}>
                        {getStageLabel(project.stage || "prospection")}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
