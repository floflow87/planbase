import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Link2, Trash2, Clock, Eye, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ShareLink {
  id: string;
  resourceType: string;
  resourceId: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
  createdAt: string;
}

interface ShareDrawerProps {
  resourceType: "project" | "roadmap" | "backlog" | "note" | "document" | "profitability_project";
  resourceId: string;
  resourceName?: string;
  trigger?: React.ReactNode;
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  project: "Projet",
  roadmap: "Roadmap",
  backlog: "Backlog",
  note: "Note",
  document: "Document",
  profitability_project: "Rentabilité projet",
};

const EXPIRATION_OPTIONS = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "never", label: "Sans expiration" },
];

export function ShareDrawer({ resourceType, resourceId, resourceName, trigger }: ShareDrawerProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("30");

  const { data: shareLinks = [], isLoading } = useQuery<ShareLink[]>({
    queryKey: ["/api/share-links", resourceType, resourceId],
    queryFn: async () => {
      const res = await fetch(`/api/share-links?resourceType=${resourceType}&resourceId=${resourceId}`);
      if (!res.ok) throw new Error("Erreur lors du chargement");
      return res.json();
    },
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/share-links", {
        resourceType,
        resourceId,
        expiresInDays: expiresInDays === "never" ? null : parseInt(expiresInDays),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/share-links"] });
      navigator.clipboard.writeText(data.shareUrl);
      toast({
        title: "Lien créé",
        description: "Le lien a été copié dans le presse-papiers",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le lien de partage",
        variant: "destructive",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (shareLinkId: string) => {
      const res = await apiRequest("POST", `/api/share-links/${shareLinkId}/revoke`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/share-links"] });
      toast({
        title: "Lien révoqué",
        description: "Le lien de partage a été désactivé",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de révoquer le lien",
        variant: "destructive",
      });
    },
  });

  const copyLink = (shareUrl: string) => {
    const fullUrl = `${window.location.origin}/share/${shareUrl}`;
    navigator.clipboard.writeText(fullUrl);
    toast({
      title: "Copié",
      description: "Le lien a été copié dans le presse-papiers",
    });
  };

  const activeLinks = shareLinks.filter(link => !link.revokedAt);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date() > new Date(expiresAt);
  };

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" data-testid="button-share">
            <Share2 className="h-4 w-4 mr-2" />
            Partager
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Partager {RESOURCE_TYPE_LABELS[resourceType]}
            </DrawerTitle>
            <DrawerDescription>
              {resourceName && <span className="font-medium">{resourceName}</span>}
              <span className="block mt-1 text-sm">
                Créez un lien de partage en lecture seule. Les personnes ayant le lien pourront voir le contenu sans compte.
              </span>
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 space-y-6">
            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <Label>Créer un nouveau lien</Label>
              <div className="flex gap-2">
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger className="w-40" data-testid="select-expiration">
                    <SelectValue placeholder="Expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  data-testid="button-create-link"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {createMutation.isPending ? "Création..." : "Créer le lien"}
                </Button>
              </div>
            </div>

            {activeLinks.length > 0 && (
              <div className="space-y-3">
                <Label>Liens actifs ({activeLinks.length})</Label>
                <div className="space-y-2">
                  {activeLinks.map(link => (
                    <div
                      key={link.id}
                      className="p-3 rounded-lg border bg-background flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          {link.expiresAt && (
                            <Badge
                              variant={isExpired(link.expiresAt) ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              {isExpired(link.expiresAt) ? "Expiré" : `Expire ${formatDate(link.expiresAt)}`}
                            </Badge>
                          )}
                          {!link.expiresAt && (
                            <Badge variant="outline" className="text-xs">
                              Sans expiration
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {link.accessCount} vue{link.accessCount !== 1 ? "s" : ""}
                          </span>
                          {link.lastAccessedAt && (
                            <span>Dernier accès: {formatDate(link.lastAccessedAt)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyLink(link.id)}
                          title="Copier le lien"
                          data-testid={`button-copy-link-${link.id}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => revokeMutation.mutate(link.id)}
                          disabled={revokeMutation.isPending}
                          title="Révoquer le lien"
                          data-testid={`button-revoke-link-${link.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="text-center py-4 text-muted-foreground">
                Chargement...
              </div>
            )}
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" data-testid="button-close-drawer">Fermer</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
