import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  User, 
  Eye, 
  Building, 
  Users, 
  PackagePlus,
  Check,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

interface PermissionPack {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  permissions: {
    module: string;
    actions: string[];
    subviews?: string[];
  }[];
  defaultSubviews: Record<string, string[]>;
}

interface PermissionPacksUIProps {
  memberId: string;
  memberName: string;
  currentRole: string;
  onPackApplied?: () => void;
}

const PACK_ICONS: Record<string, React.ReactNode> = {
  shield: <Shield className="h-5 w-5" />,
  user: <User className="h-5 w-5" />,
  eye: <Eye className="h-5 w-5" />,
  building: <Building className="h-5 w-5" />,
  users: <Users className="h-5 w-5" />,
};

const MODULE_LABELS: Record<string, string> = {
  crm: "CRM",
  projects: "Projets",
  product: "Produit",
  roadmap: "Roadmap",
  tasks: "Tâches",
  notes: "Notes",
  documents: "Documents",
  profitability: "Rentabilité",
};

const ACTION_LABELS: Record<string, string> = {
  read: "Lire",
  create: "Créer",
  update: "Modifier",
  delete: "Supprimer",
};

export function PermissionPacksUI({ memberId, memberName, currentRole, onPackApplied }: PermissionPacksUIProps) {
  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{ pack: PermissionPack } | null>(null);

  const { data: packs = [], isLoading } = useQuery<PermissionPack[]>({
    queryKey: ["/api/permission-packs"],
  });

  const applyMutation = useMutation({
    mutationFn: async (packId: string) => {
      const res = await apiRequest("POST", `/api/permission-packs/${packId}/apply/${memberId}`, {});
      return res.json();
    },
    onSuccess: (_, packId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
      toast({
        title: "Pack appliqué",
        description: `Les permissions ont été mises à jour avec succès`,
      });
      setConfirmDialog(null);
      onPackApplied?.();
    },
    onError: (error: any) => {
      console.error("❌ Permission pack apply error:", error);
      toast({
        title: "Erreur",
        description: error?.message || "Impossible d'appliquer le pack de permissions",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Chargement des packs...
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground mb-4">
          Appliquer un pack de permissions prédéfini à <strong>{memberName}</strong>. 
          Cette action remplacera toutes les permissions actuelles.
        </p>
        
        <div className="grid gap-3">
          {packs.map(pack => (
            <Card key={pack.id} className="hover-elevate">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-violet-600">
                      {PACK_ICONS[pack.icon] || <PackagePlus className="h-5 w-5" />}
                    </div>
                    <div>
                      <h4 className="font-medium">{pack.name}</h4>
                      <p className="text-sm text-muted-foreground">{pack.description}</p>
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        {pack.permissions.map(perm => (
                          <Badge
                            key={perm.module}
                            variant="outline"
                            className="text-xs"
                          >
                            {MODULE_LABELS[perm.module] || perm.module}
                            <span className="ml-1 opacity-60">
                              ({perm.actions.map(a => ACTION_LABELS[a]?.[0] || a[0]).join("")})
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    onClick={() => setConfirmDialog({ pack })}
                    data-testid={`button-apply-pack-${pack.id}`}
                  >
                    Appliquer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'application du pack</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point d'appliquer le pack "{confirmDialog?.pack.name}" 
              à {memberName}. Cette action remplacera toutes les permissions actuelles.
            </DialogDescription>
          </DialogHeader>
          
          {confirmDialog && (
            <div className="py-4">
              <h4 className="text-sm font-medium mb-2">Permissions qui seront appliquées :</h4>
              <div className="space-y-2">
                {confirmDialog.pack.permissions.map(perm => (
                  <div key={perm.module} className="flex items-center gap-2 text-sm">
                    <span className="font-medium w-24">
                      {MODULE_LABELS[perm.module] || perm.module}
                    </span>
                    <div className="flex gap-1">
                      {["read", "create", "update", "delete"].map(action => (
                        <Badge
                          key={action}
                          variant={perm.actions.includes(action) ? "default" : "outline"}
                          className="text-xs"
                        >
                          {perm.actions.includes(action) ? (
                            <Check className="h-3 w-3 mr-0.5" />
                          ) : (
                            <X className="h-3 w-3 mr-0.5 opacity-50" />
                          )}
                          {ACTION_LABELS[action]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => confirmDialog && applyMutation.mutate(confirmDialog.pack.id)}
              disabled={applyMutation.isPending}
              data-testid="button-confirm-apply-pack"
            >
              {applyMutation.isPending ? "Application..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
