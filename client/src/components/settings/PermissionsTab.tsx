import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Users, RotateCcw, Loader2 } from "lucide-react";
import { useState } from "react";
import { RBAC_MODULES, RBAC_ACTIONS, type RbacModule, type RbacAction, type RbacRole } from "@shared/schema";
import { usePermissions } from "@/hooks/usePermissions";
import { LoadingState } from "@/design-system/patterns/LoadingState";
import { GuestViewConfig } from "./GuestViewConfig";

interface MemberUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

interface Member {
  id: string;
  organizationId: string;
  userId: string;
  role: RbacRole;
  createdAt: string;
  user: MemberUser | null;
}

type PermissionMatrix = Record<RbacModule, Record<RbacAction, boolean>>;

const MODULE_LABELS: Record<RbacModule, string> = {
  crm: "CRM",
  projects: "Projets",
  product: "Produit",
  roadmap: "Roadmap",
  tasks: "Tâches",
  notes: "Notes",
  documents: "Documents",
  profitability: "Rentabilité",
};

const ACTION_LABELS: Record<RbacAction, string> = {
  read: "Lire",
  create: "Créer",
  update: "Modifier",
  delete: "Supprimer",
};

const ROLE_LABELS: Record<RbacRole, string> = {
  admin: "Administrateur",
  member: "Membre",
  guest: "Invité",
};

const ROLE_COLORS: Record<RbacRole, string> = {
  admin: "bg-violet-600 text-white",
  member: "bg-blue-600 text-white",
  guest: "bg-gray-500 text-white",
};

export function PermissionsTab() {
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const { data: members, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/rbac/members"],
    enabled: isAdmin,
  });

  const { data: memberPermissions, isLoading: permissionsLoading } = useQuery<PermissionMatrix>({
    queryKey: ["/api/rbac/members", selectedMemberId, "permissions"],
    queryFn: async () => {
      const response = await fetch(`/api/rbac/members/${selectedMemberId}/permissions`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("supabase_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch permissions");
      return response.json();
    },
    enabled: !!selectedMemberId && isAdmin,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: RbacRole }) => {
      return apiRequest("PATCH", `/api/rbac/members/${memberId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/members"] });
      toast({ title: "Rôle mis à jour", description: "Le rôle a été modifié avec succès." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le rôle.", variant: "destructive" });
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async (params: { memberId: string; module: RbacModule; action: RbacAction; allowed: boolean }) => {
      return apiRequest("PATCH", `/api/rbac/members/${params.memberId}/permissions`, {
        module: params.module,
        action: params.action,
        allowed: params.allowed,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/members", selectedMemberId, "permissions"] });
      toast({ title: "Permission mise à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier la permission.", variant: "destructive" });
    },
  });

  const resetPermissionsMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest("POST", `/api/rbac/members/${memberId}/permissions/reset`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/members", selectedMemberId, "permissions"] });
      toast({ title: "Permissions réinitialisées", description: "Les permissions par défaut ont été restaurées." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de réinitialiser les permissions.", variant: "destructive" });
    },
  });

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="w-4 h-4" />
            <p className="text-sm">Seuls les administrateurs peuvent gérer les permissions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (membersLoading) {
    return <LoadingState size="lg" />;
  }

  const selectedMember = members?.find((m) => m.id === selectedMemberId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <CardTitle className="text-sm">Membres de l'organisation</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Gérez les rôles et permissions des membres de votre équipe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members?.map((member) => (
              <div
                key={member.id}
                className={`flex items-center justify-between p-3 rounded-md border cursor-pointer hover-elevate transition-colors ${
                  selectedMemberId === member.id ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => setSelectedMemberId(member.id)}
                data-testid={`member-row-${member.id}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={member.user?.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {member.user?.firstName?.[0]}{member.user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {member.user?.firstName} {member.user?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={ROLE_COLORS[member.role]} data-testid={`badge-role-${member.id}`}>
                    {ROLE_LABELS[member.role]}
                  </Badge>
                  <Select
                    value={member.role}
                    onValueChange={(value) => {
                      updateRoleMutation.mutate({ memberId: member.id, role: value as RbacRole });
                    }}
                    disabled={updateRoleMutation.isPending}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrateur</SelectItem>
                      <SelectItem value="member">Membre</SelectItem>
                      <SelectItem value="guest">Invité</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedMember && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <CardTitle className="text-sm">
                  Permissions de {selectedMember.user?.firstName} {selectedMember.user?.lastName}
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetPermissionsMutation.mutate(selectedMember.id)}
                disabled={resetPermissionsMutation.isPending}
                data-testid="button-reset-permissions"
              >
                {resetPermissionsMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3 mr-1" />
                )}
                Réinitialiser
              </Button>
            </div>
            <CardDescription className="text-xs">
              Personnalisez les permissions pour chaque module
            </CardDescription>
          </CardHeader>
          <CardContent>
            {permissionsLoading ? (
              <LoadingState size="sm" />
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 font-medium text-xs">Module</th>
                      {RBAC_ACTIONS.map((action) => (
                        <th key={action} className="text-center p-2 font-medium text-xs">
                          {ACTION_LABELS[action]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RBAC_MODULES.map((module) => (
                      <tr key={module} className="border-t">
                        <td className="p-2 font-medium text-xs">{MODULE_LABELS[module]}</td>
                        {RBAC_ACTIONS.map((action) => (
                          <td key={action} className="text-center p-2">
                            <Checkbox
                              checked={memberPermissions?.[module]?.[action] ?? false}
                              onCheckedChange={(checked) => {
                                updatePermissionMutation.mutate({
                                  memberId: selectedMember.id,
                                  module,
                                  action,
                                  allowed: !!checked,
                                });
                              }}
                              disabled={selectedMember.role === "admin" || updatePermissionMutation.isPending}
                              data-testid={`permission-${module}-${action}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedMember.role === "admin" && (
                  <div className="p-3 bg-muted/50 text-xs text-muted-foreground flex items-center gap-2">
                    <Shield className="w-3 h-3" />
                    Les administrateurs ont toutes les permissions par défaut
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <GuestViewConfig />
    </div>
  );
}
