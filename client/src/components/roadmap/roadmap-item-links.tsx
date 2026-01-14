import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Link2, 
  Plus, 
  X, 
  FileText, 
  Target, 
  Layers, 
  CheckSquare,
  ExternalLink,
  Search
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RoadmapItemLink, Epic, UserStory, BacklogTask } from "@shared/schema";

interface RoadmapItemLinksProps {
  roadmapItemId: string;
  projectId: string;
}

interface LinkableItem {
  id: string;
  title: string;
  type: string;
  extra?: string;
}

const LINK_TYPE_LABELS: { [key: string]: string } = {
  epic: "Epic",
  user_story: "User Story",
  task: "Tâche",
  cdc_section: "Section CDC",
  free_reference: "Référence libre",
};

const LINK_TYPE_ICONS: { [key: string]: typeof Target } = {
  epic: Layers,
  user_story: Target,
  task: CheckSquare,
  cdc_section: FileText,
  free_reference: ExternalLink,
};

export function RoadmapItemLinks({ roadmapItemId, projectId }: RoadmapItemLinksProps) {
  const { toast } = useToast();
  const [showAddLink, setShowAddLink] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [freeReferenceTitle, setFreeReferenceTitle] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: links = [], isLoading } = useQuery<RoadmapItemLink[]>({
    queryKey: [`/api/roadmap-items/${roadmapItemId}/links`],
    enabled: !!roadmapItemId,
  });

  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: [`/api/projects/${projectId}/epics`],
    enabled: !!projectId && (selectedType === "epic" || selectedType === "user_story" || selectedType === "task"),
  });

  const { data: userStories = [] } = useQuery<UserStory[]>({
    queryKey: [`/api/projects/${projectId}/user-stories`],
    enabled: !!projectId && (selectedType === "user_story" || selectedType === "task"),
  });

  const { data: tasks = [] } = useQuery<BacklogTask[]>({
    queryKey: [`/api/projects/${projectId}/tasks`],
    enabled: !!projectId && selectedType === "task",
  });

  const createLinkMutation = useMutation({
    mutationFn: async (data: { linkedType: string; linkedId?: string; linkedTitle?: string }) => {
      return apiRequest(`/api/roadmap-items/${roadmapItemId}/links`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmap-items/${roadmapItemId}/links`] });
      setShowAddLink(false);
      resetForm();
      toast({
        title: "Lien ajouté",
        description: "L'élément a été lié avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le lien.",
        variant: "destructive",
      });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return apiRequest(`/api/roadmap-item-links/${linkId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmap-items/${roadmapItemId}/links`] });
      toast({
        title: "Lien supprimé",
        description: "Le lien a été retiré.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le lien.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedType("");
    setSelectedItemId("");
    setFreeReferenceTitle("");
    setSearchQuery("");
  };

  const handleAddLink = () => {
    if (selectedType === "free_reference") {
      if (!freeReferenceTitle.trim()) return;
      createLinkMutation.mutate({
        linkedType: selectedType,
        linkedTitle: freeReferenceTitle.trim(),
      });
    } else {
      if (!selectedItemId) return;
      const item = getItemsForType().find(i => i.id === selectedItemId);
      createLinkMutation.mutate({
        linkedType: selectedType,
        linkedId: selectedItemId,
        linkedTitle: item?.title,
      });
    }
  };

  const getItemsForType = (): LinkableItem[] => {
    switch (selectedType) {
      case "epic":
        return epics.map(e => ({ id: e.id, title: e.title, type: "epic", extra: e.state }));
      case "user_story":
        return userStories.map(s => ({ id: s.id, title: s.title, type: "user_story", extra: s.state }));
      case "task":
        return tasks.map(t => ({ id: t.id, title: t.title, type: "task", extra: t.state }));
      default:
        return [];
    }
  };

  const filteredItems = getItemsForType().filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLinkIcon = (type: string) => {
    const Icon = LINK_TYPE_ICONS[type] || Link2;
    return Icon;
  };

  const getLinkBadgeVariant = (type: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (type) {
      case "epic": return "default";
      case "user_story": return "secondary";
      case "task": return "outline";
      default: return "outline";
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="h-4 w-4" />
          Liens ({links.length})
        </Label>
        {!showAddLink && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddLink(true)}
            className="h-7 text-xs"
            data-testid="button-add-link"
          >
            <Plus className="h-3 w-3 mr-1" />
            Ajouter
          </Button>
        )}
      </div>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {links.map((link) => {
            const Icon = getLinkIcon(link.linkedType);
            return (
              <Badge
                key={link.id}
                variant={getLinkBadgeVariant(link.linkedType)}
                className="flex items-center gap-1 pr-1"
                data-testid={`link-badge-${link.id}`}
              >
                <Icon className="h-3 w-3" />
                <span className="max-w-[150px] truncate">
                  {link.linkedTitle || LINK_TYPE_LABELS[link.linkedType]}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                  onClick={() => deleteLinkMutation.mutate(link.id)}
                  data-testid={`button-delete-link-${link.id}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}

      {showAddLink && (
        <div className="p-3 border rounded-md bg-muted/30 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Type de lien</Label>
            <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setSelectedItemId(""); setSearchQuery(""); }}>
              <SelectTrigger className="h-8" data-testid="select-link-type">
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="epic">Epic</SelectItem>
                <SelectItem value="user_story">User Story</SelectItem>
                <SelectItem value="task">Tâche</SelectItem>
                <SelectItem value="cdc_section">Section CDC</SelectItem>
                <SelectItem value="free_reference">Référence libre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedType && selectedType !== "free_reference" && (
            <div className="space-y-2">
              <Label className="text-xs">Rechercher</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-7 text-xs"
                  data-testid="input-link-search"
                />
              </div>
              {filteredItems.length > 0 ? (
                <div className="max-h-32 overflow-y-auto border rounded-md divide-y">
                  {filteredItems.slice(0, 10).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedItemId(item.id)}
                      className={`w-full text-left px-2 py-1.5 text-xs hover-elevate flex items-center justify-between
                        ${selectedItemId === item.id ? "bg-primary/10" : ""}
                      `}
                      data-testid={`linkable-item-${item.id}`}
                    >
                      <span className="truncate">{item.title}</span>
                      {item.extra && (
                        <Badge variant="outline" className="text-[10px] ml-2 shrink-0">
                          {item.extra}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  Aucun élément trouvé
                </p>
              )}
            </div>
          )}

          {selectedType === "free_reference" && (
            <div className="space-y-2">
              <Label className="text-xs">Titre de la référence</Label>
              <Input
                placeholder="Ex: Document externe, lien JIRA..."
                value={freeReferenceTitle}
                onChange={(e) => setFreeReferenceTitle(e.target.value)}
                className="h-8 text-xs"
                data-testid="input-free-reference"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowAddLink(false); resetForm(); }}
              className="h-7 text-xs"
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleAddLink}
              disabled={
                createLinkMutation.isPending ||
                (selectedType === "free_reference" && !freeReferenceTitle.trim()) ||
                (selectedType !== "free_reference" && !selectedItemId)
              }
              className="h-7 text-xs"
              data-testid="button-confirm-add-link"
            >
              {createLinkMutation.isPending ? "Ajout..." : "Ajouter"}
            </Button>
          </div>
        </div>
      )}

      {links.length === 0 && !showAddLink && (
        <p className="text-xs text-muted-foreground">
          Aucun lien. Liez cet élément à des epics, tâches ou sections CDC.
        </p>
      )}
    </div>
  );
}
