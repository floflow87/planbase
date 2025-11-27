import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Plus, Trash2, Edit, Network, Calendar, User, Brain, Film, Route, Map, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Mindmap, MindmapKind, Client, Project } from "@shared/schema";
import { mindmapKindOptions } from "@shared/schema";

const MINDMAP_KIND_LABELS: Record<MindmapKind, { label: string; color: string; icon: typeof Brain }> = {
  generic: { label: "Mindmap libre", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: Brain },
  storyboard: { label: "Storyboard", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Film },
  user_flow: { label: "Parcours utilisateur", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: Route },
  architecture: { label: "Architecture", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Network },
  sitemap: { label: "Sitemap", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200", icon: Map },
  ideas: { label: "Idées", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: Lightbulb },
};

export default function Mindmaps() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newMindmap, setNewMindmap] = useState({
    name: "",
    description: "",
    kind: "generic" as MindmapKind,
    clientId: "",
    projectId: "",
  });

  const { data: mindmaps, isLoading } = useQuery<Mindmap[]>({
    queryKey: ["/api/mindmaps"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Mindmap>) => {
      const res = await apiRequest("/api/mindmaps", "POST", data);
      return await res.json();
    },
    onSuccess: (mindmap) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps"] });
      setIsSheetOpen(false);
      setNewMindmap({ name: "", description: "", kind: "generic", clientId: "", projectId: "" });
      toast({ title: "Mindmap créée", description: "Votre mindmap a été créée avec succès." });
      setLocation(`/mindmaps/${mindmap.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/mindmaps/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps"] });
      toast({ title: "Mindmap supprimée" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!newMindmap.name.trim()) {
      toast({ title: "Nom requis", description: "Veuillez entrer un nom pour la mindmap.", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: newMindmap.name,
      description: newMindmap.description || null,
      kind: newMindmap.kind,
      clientId: newMindmap.clientId || null,
      projectId: newMindmap.projectId || null,
    });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Êtes-vous sûr de vouloir supprimer cette mindmap ?")) {
      deleteMutation.mutate(id);
    }
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId || !clients) return null;
    const client = clients.find(c => c.id === clientId);
    return client?.name || null;
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId || !projects) return null;
    const project = projects.find(p => p.id === projectId);
    return project?.name || null;
  };

  if (isLoading) {
    return (
      <div className="p-6 h-full overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Mindmaps</h2>
          <p className="text-muted-foreground">Organisez visuellement vos idées, projets et flux</p>
        </div>
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button data-testid="button-new-mindmap">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Mindmap
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Créer une mindmap</SheetTitle>
              <SheetDescription>Créez une nouvelle mindmap pour organiser vos idées visuellement.</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 py-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  data-testid="input-mindmap-name"
                  value={newMindmap.name}
                  onChange={(e) => setNewMindmap({ ...newMindmap, name: e.target.value })}
                  placeholder="Ma mindmap"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  data-testid="input-mindmap-description"
                  value={newMindmap.description}
                  onChange={(e) => setNewMindmap({ ...newMindmap, description: e.target.value })}
                  placeholder="Description de la mindmap..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kind">Type de vue</Label>
                <Select
                  value={newMindmap.kind}
                  onValueChange={(value: MindmapKind) => setNewMindmap({ ...newMindmap, kind: value })}
                >
                  <SelectTrigger data-testid="select-mindmap-kind">
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MINDMAP_KIND_LABELS).map(([key, { label, icon: Icon }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Client (optionnel)</Label>
                <Select
                  value={newMindmap.clientId || "__none__"}
                  onValueChange={(value) => setNewMindmap({ ...newMindmap, clientId: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger data-testid="select-mindmap-client">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project">Projet (optionnel)</Label>
                <Select
                  value={newMindmap.projectId || "__none__"}
                  onValueChange={(value) => setNewMindmap({ ...newMindmap, projectId: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger data-testid="select-mindmap-project">
                    <SelectValue placeholder="Sélectionner un projet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {projects?.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsSheetOpen(false)} className="flex-1">Annuler</Button>
                <Button 
                  onClick={handleCreate} 
                  disabled={createMutation.isPending}
                  data-testid="button-create-mindmap"
                  className="flex-1"
                >
                  {createMutation.isPending ? "Création..." : "Créer"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {!mindmaps || mindmaps.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Network className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Aucune mindmap</h3>
          <p className="text-muted-foreground text-center mb-4">
            Créez votre première mindmap pour organiser vos idées visuellement.
          </p>
          <Button onClick={() => setIsSheetOpen(true)} data-testid="button-empty-new-mindmap">
            <Plus className="w-4 h-4 mr-2" />
            Créer une mindmap
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mindmaps.map((mindmap) => (
            <Card
              key={mindmap.id}
              className="cursor-pointer hover-elevate transition-colors"
              onClick={() => setLocation(`/mindmaps/${mindmap.id}`)}
              data-testid={`card-mindmap-${mindmap.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{mindmap.name}</CardTitle>
                    {mindmap.description && (
                      <CardDescription className="line-clamp-2 mt-1">
                        {mindmap.description}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={(e) => handleDelete(e, mindmap.id)}
                    data-testid={`button-delete-mindmap-${mindmap.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={MINDMAP_KIND_LABELS[mindmap.kind as MindmapKind]?.color || "bg-gray-100 text-gray-800"}>
                    {MINDMAP_KIND_LABELS[mindmap.kind as MindmapKind]?.label || mindmap.kind}
                  </Badge>
                  {mindmap.clientId && getClientName(mindmap.clientId) && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {getClientName(mindmap.clientId)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(mindmap.createdAt), "dd MMM yyyy", { locale: fr })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
