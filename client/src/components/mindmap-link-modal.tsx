import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Brain, Plus, Map, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Mindmap, Client, Project } from "@shared/schema";

interface MindmapLinkModalProps {
  entityType: "note" | "project" | "task" | "document" | "client";
  entityId: string;
  entityName: string;
  trigger?: React.ReactNode;
}

export function MindmapLinkModal({
  entityType,
  entityId,
  entityName,
  trigger,
}: MindmapLinkModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [newMindmapName, setNewMindmapName] = useState("");
  const [selectedMindmapId, setSelectedMindmapId] = useState<string | null>(null);
  const [filterClientId, setFilterClientId] = useState<string | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: mindmaps } = useQuery<Mindmap[]>({
    queryKey: ["/api/mindmaps"],
    enabled: open,
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: open,
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: open,
  });

  const filteredMindmaps = useMemo(() => {
    if (!mindmaps) return [];
    return mindmaps.filter((m) => {
      if (filterClientId && m.clientId !== filterClientId) return false;
      if (filterProjectId && m.projectId !== filterProjectId) return false;
      if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [mindmaps, filterClientId, filterProjectId, searchQuery]);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (!filterClientId) return projects;
    return projects.filter((p) => p.clientId === filterClientId);
  }, [projects, filterClientId]);

  const createAndNavigateMutation = useMutation({
    mutationFn: async (mindmapId: string) => {
      const nodeType = entityType;
      const res = await apiRequest(`/api/mindmaps/${mindmapId}/nodes`, "POST", {
        title: entityName,
        type: nodeType,
        linkedEntityType: entityType,
        linkedEntityId: entityId,
        x: 400,
        y: 300,
      });
      return { mindmapId, node: await res.json() };
    },
    onSuccess: ({ mindmapId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps"] });
      setOpen(false);
      setLocation(`/mindmaps/${mindmapId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createMindmapMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/mindmaps", "POST", {
        name: newMindmapName || `Mindmap - ${entityName}`,
        kind: "generic",
      });
      return await res.json();
    },
    onSuccess: (newMindmap: Mindmap) => {
      createAndNavigateMutation.mutate(newMindmap.id);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConfirm = () => {
    if (mode === "new") {
      createMindmapMutation.mutate();
    } else if (selectedMindmapId) {
      createAndNavigateMutation.mutate(selectedMindmapId);
    }
  };

  const isPending = createMindmapMutation.isPending || createAndNavigateMutation.isPending;

  const getEntityIcon = () => {
    switch (entityType) {
      case "note": return "Note";
      case "project": return "Projet";
      case "task": return "Tâche";
      case "document": return "Document";
      case "client": return "Client";
      default: return "Élément";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" data-testid="button-view-on-mindmap">
            <Brain className="w-4 h-4 mr-2" />
            Voir sur une mindmap
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Ajouter à une mindmap
          </DialogTitle>
          <DialogDescription>
            Ajoutez {getEntityIcon().toLowerCase()} "{entityName}" à une mindmap existante ou créez-en une nouvelle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "new" | "existing")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new" />
              <Label htmlFor="new" className="flex items-center gap-2 cursor-pointer">
                <Plus className="w-4 h-4" />
                Créer une nouvelle mindmap
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing" id="existing" />
              <Label htmlFor="existing" className="flex items-center gap-2 cursor-pointer">
                <Map className="w-4 h-4" />
                Ajouter à une mindmap existante
              </Label>
            </div>
          </RadioGroup>

          <Separator />

          {mode === "new" ? (
            <div className="space-y-2">
              <Label htmlFor="mindmap-name">Nom de la mindmap (optionnel)</Label>
              <Input
                id="mindmap-name"
                value={newMindmapName}
                onChange={(e) => setNewMindmapName(e.target.value)}
                placeholder={`Mindmap - ${entityName}`}
                data-testid="input-new-mindmap-name"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Filtrer par client</Label>
                  <Select
                    value={filterClientId || "all"}
                    onValueChange={(v) => {
                      setFilterClientId(v === "all" ? null : v);
                      setFilterProjectId(null);
                    }}
                  >
                    <SelectTrigger className="h-8" data-testid="select-filter-client">
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les clients</SelectItem>
                      {(clients || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Filtrer par projet</Label>
                  <Select
                    value={filterProjectId || "all"}
                    onValueChange={(v) => setFilterProjectId(v === "all" ? null : v)}
                  >
                    <SelectTrigger className="h-8" data-testid="select-filter-project">
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les projets</SelectItem>
                      {filteredProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                  data-testid="input-search-mindmap"
                />
              </div>

              <ScrollArea className="h-48 border rounded-lg">
                <div className="p-2 space-y-1">
                  {filteredMindmaps.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 text-sm">
                      Aucune mindmap trouvée
                    </div>
                  ) : (
                    filteredMindmaps.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMindmapId(m.id)}
                        className={`w-full text-left p-2 rounded-lg transition-colors ${
                          selectedMindmapId === m.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                        data-testid={`mindmap-option-${m.id}`}
                      >
                        <div className="font-medium text-sm">{m.name}</div>
                        {(m.clientId || m.projectId) && (
                          <div className="flex gap-1 mt-1">
                            {m.clientId && clients && (
                              <Badge variant="outline" className="text-xs">
                                {clients.find((c) => c.id === m.clientId)?.name}
                              </Badge>
                            )}
                            {m.projectId && projects && (
                              <Badge variant="outline" className="text-xs">
                                {projects.find((p) => p.id === m.projectId)?.name}
                              </Badge>
                            )}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || (mode === "existing" && !selectedMindmapId)}
            data-testid="button-confirm-mindmap-link"
          >
            {isPending ? "Chargement..." : mode === "new" ? "Créer et ouvrir" : "Ajouter et ouvrir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
