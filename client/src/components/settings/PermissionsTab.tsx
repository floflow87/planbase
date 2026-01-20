import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Users, RotateCcw, Loader2, PackagePlus, UserPlus, Clock, Copy, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RBAC_MODULES, RBAC_ACTIONS, type RbacModule, type RbacAction, type RbacRole } from "@shared/schema";
import { usePermissions } from "@/hooks/usePermissions";
import { LoadingState } from "@/design-system/patterns/LoadingState";
import { RoleViewConfig } from "./RoleViewConfig";
import { PermissionPacksUI } from "./PermissionPacksUI";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  status?: string;
  invitationToken?: string;
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
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RbacRole>("member");
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);

  const copyInvitationLink = async (member: Member) => {
    if (!member.invitationToken) return;
    const baseUrl = window.location.origin;
    const invitationLink = `${baseUrl}/accept-invitation?token=${member.invitationToken}`;
    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopiedInvitationId(member.id);
      setTimeout(() => setCopiedInvitationId(null), 2000);
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible de copier le lien",
        variant: "destructive",
      });
    }
  };

  const { data: members, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/rbac/members"],
    enabled: isAdmin,
  });

  const { data: memberPermissions, isLoading: permissionsLoading } = useQuery<PermissionMatrix>({
    queryKey: ["/api/rbac/members", selectedMemberId, "permissions"],
    enabled: !!selectedMemberId && isAdmin,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: RbacRole }) => {
      const response = await apiRequest(`/api/rbac/members/${memberId}/role`, "PATCH", { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/members"] });
      toast({ title: "Rôle mis à jour", description: "Le rôle a été modifié avec succès." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message || "Impossible de modifier le rôle.", variant: "destructive" });
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async (params: { memberId: string; module: RbacModule; action: RbacAction; allowed: boolean }) => {
      const response = await apiRequest(`/api/rbac/members/${params.memberId}/permissions`, "PATCH", {
        module: params.module,
        action: params.action,
        allowed: params.allowed,
      });
      return response.json();
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
      const response = await apiRequest(`/api/rbac/members/${memberId}/permissions/reset`, "POST");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/members", selectedMemberId, "permissions"] });
      toast({ title: "Permissions réinitialisées", description: "Les permissions par défaut ont été restaurées." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de réinitialiser les permissions.", variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: RbacRole }) => {
      const response = await apiRequest("/api/rbac/invite", "POST", { email, role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/members"] });
      toast({ title: "Membre ajouté", description: "Le membre a été ajouté à votre organisation." });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("member");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      toast({ title: "Erreur", description: "Veuillez saisir un email.", variant: "destructive" });
      return;
    }
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <CardTitle className="text-sm">Membres de l'organisation</CardTitle>
            </div>
            <Sheet open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <SheetTrigger asChild>
                <Button size="sm" data-testid="button-add-member">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Ajouter
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Ajouter un membre</SheetTitle>
                  <SheetDescription>
                    Ajoutez un utilisateur existant à votre organisation par son email
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 py-6">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="email@exemple.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      data-testid="input-invite-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Rôle</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as RbacRole)}>
                      <SelectTrigger id="invite-role" data-testid="select-invite-role">
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
                <SheetFooter className="flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setInviteDialogOpen(false)}
                    data-testid="button-cancel-invite"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleInvite}
                    disabled={inviteMutation.isPending}
                    data-testid="button-confirm-add-member"
                  >
                    {inviteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Ajouter
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
          <CardDescription className="text-xs">
            Gérez les rôles et permissions des membres de votre équipe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members?.map((member) => {
              const isPending = member.status === "invitation_en_attente";
              const displayName = member.user?.firstName && member.user?.lastName 
                ? `${member.user.firstName} ${member.user.lastName}` 
                : member.user?.email || "Utilisateur";
              
              return (
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
                        {member.user?.firstName?.[0] || member.user?.email?.[0]?.toUpperCase()}
                        {member.user?.lastName?.[0] || ""}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {isPending ? member.user?.email : displayName}
                        </p>
                        {isPending && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300 bg-amber-50">
                            Invitation en attente
                          </Badge>
                        )}
                        {!isPending && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-300 bg-green-50">
                            Actif
                          </Badge>
                        )}
                      </div>
                      {!isPending && <p className="text-xs text-muted-foreground">{member.user?.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={ROLE_COLORS[member.role]} data-testid={`badge-role-${member.id}`}>
                      {ROLE_LABELS[member.role]}
                    </Badge>
                    {isPending && member.invitationToken && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyInvitationLink(member);
                            }}
                            data-testid={`button-copy-invitation-${member.id}`}
                          >
                            {copiedInvitationId === member.id ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {copiedInvitationId === member.id 
                            ? "Lien d'inscription copié" 
                            : "Copier le lien d'inscription"
                          }
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {!isPending && (
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
                    )}
                  </div>
                </div>
              );
            })}
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
                  {selectedMember.status === "invitation_en_attente" 
                    ? `Permissions prévues pour ${selectedMember.user?.email}`
                    : `Permissions de ${selectedMember.user?.firstName} ${selectedMember.user?.lastName}`
                  }
                </CardTitle>
              </div>
              {selectedMember.status !== "invitation_en_attente" && (
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
              )}
            </div>
            <CardDescription className="text-xs">
              {selectedMember.status === "invitation_en_attente"
                ? "Les permissions seront configurables une fois l'invitation acceptée"
                : "Personnalisez les permissions pour chaque module"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedMember.status === "invitation_en_attente" ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Invitation en attente
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Cette personne recevra le rôle <strong>{ROLE_LABELS[selectedMember.role]}</strong> avec les permissions par défaut associées une fois l'invitation acceptée.
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Vous pourrez personnaliser ses permissions après son inscription.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {selectedMember.role !== "admin" && (
                  <Accordion type="single" collapsible>
                    <AccordionItem value="packs" className="border rounded-lg">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-2 text-sm">
                          <PackagePlus className="h-4 w-4" />
                          Appliquer un pack de permissions
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <PermissionPacksUI
                          memberId={selectedMember.id}
                          memberName={`${selectedMember.user?.firstName || ""} ${selectedMember.user?.lastName || ""}`}
                          currentRole={selectedMember.role}
                          onPackApplied={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/rbac/members", selectedMember.id, "permissions"] });
                          }}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
                
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
              </>
            )}
          </CardContent>
        </Card>
      )}

      <RoleViewConfig />
    </div>
  );
}
