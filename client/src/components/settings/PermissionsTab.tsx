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
import { Shield, Users, RotateCcw, Loader2, PackagePlus, UserPlus, Clock, Copy, Check, Trash2, AlertCircle, Send } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  emailBounced?: boolean;
  isOwner?: boolean;
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
  whiteboards: "Whiteboards",
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
  const { isAdmin, memberId: currentMemberId } = usePermissions();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RbacRole>("member");
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{ id: string; isPending: boolean } | null>(null);

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest(`/api/invitations/${invitationId}/resend`, "POST");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/members"] });
      toast({ title: "Invitation renvoyée", description: "L'email d'invitation a été renvoyé avec succès.", variant: "success" });
      setResendingInvitationId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message || "Impossible de renvoyer l'invitation.", variant: "destructive" });
      setResendingInvitationId(null);
    },
  });

  const resendInvitation = (member: Member) => {
    // Extract invitation ID from member ID (format: invitation-{uuid})
    const invitationId = member.id.replace('invitation-', '');
    setResendingInvitationId(member.id);
    resendInvitationMutation.mutate(invitationId);
  };

  const copyInvitationLink = async (member: Member) => {
    if (!member.invitationToken) return;
    // Use app.planbase.io for production (same as email), current origin for development
    const baseUrl = import.meta.env.VITE_APP_URL || 'https://app.planbase.io';
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

  const { data: memberPermissions, isLoading: permissionsLoading, refetch: refetchPermissions } = useQuery<PermissionMatrix>({
    queryKey: ["/api/rbac/members", selectedMemberId, "permissions"],
    enabled: !!selectedMemberId && isAdmin,
    staleTime: 0, // Always consider data stale to force refetch
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: RbacRole }) => {
      const response = await apiRequest(`/api/rbac/members/${memberId}/role`, "PATCH", { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/members"] });
      toast({ title: "Rôle mis à jour", description: "Le rôle a été modifié avec succès.", variant: "success" });
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
      toast({ title: "Permission mise à jour", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier la permission.", variant: "destructive" });
    },
  });

  const bulkUpdatePermissionsMutation = useMutation({
    mutationFn: async (params: { memberId: string; updates: Array<{ module: RbacModule; action: RbacAction; allowed: boolean }> }) => {
      const response = await apiRequest(`/api/rbac/members/${params.memberId}/permissions/bulk`, "POST", {
        updates: params.updates,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/members", selectedMemberId, "permissions"] });
      toast({ title: "Permissions mises à jour", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier les permissions.", variant: "destructive" });
    },
  });

  const toggleColumnPermissions = (action: RbacAction, checked: boolean) => {
    if (!selectedMemberId || !memberPermissions) return;
    const updates = RBAC_MODULES.map(module => ({
      module,
      action,
      allowed: checked,
    }));
    bulkUpdatePermissionsMutation.mutate({ memberId: selectedMemberId, updates });
  };

  const isColumnAllChecked = (action: RbacAction): boolean => {
    if (!memberPermissions) return false;
    return RBAC_MODULES.every(module => memberPermissions[module]?.[action] === true);
  };

  const isColumnSomeChecked = (action: RbacAction): boolean => {
    if (!memberPermissions) return false;
    const checkedCount = RBAC_MODULES.filter(module => memberPermissions[module]?.[action] === true).length;
    return checkedCount > 0 && checkedCount < RBAC_MODULES.length;
  };

  const resetPermissionsMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await apiRequest(`/api/rbac/members/${memberId}/permissions/reset`, "POST");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/members", selectedMemberId, "permissions"] });
      toast({ title: "Permissions réinitialisées", description: "Les permissions par défaut ont été restaurées.", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de réinitialiser les permissions.", variant: "destructive" });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await apiRequest(`/api/rbac/members/${memberId}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/members"] });
      setSelectedMemberId(null);
      toast({ title: "Membre supprimé", description: "Le membre a été retiré de l'organisation.", variant: "success" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message || "Impossible de supprimer le membre.", variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: RbacRole }) => {
      const response = await apiRequest("/api/rbac/invite", "POST", { email, role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/members"] });
      toast({ title: "Membre ajouté", description: "Le membre a été ajouté à votre organisation.", variant: "success" });
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
                        {isPending && member.emailBounced && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-600 border-red-300 bg-red-50">
                            Non délivré
                          </Badge>
                        )}
                        {isPending && !member.emailBounced && (
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
                      <>
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
                          <TooltipContent className="bg-white text-foreground border">
                            {copiedInvitationId === member.id 
                              ? "Lien d'inscription copié" 
                              : "Copier le lien d'inscription"
                            }
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                resendInvitation(member);
                              }}
                              disabled={resendingInvitationId === member.id}
                              data-testid={`button-resend-invitation-${member.id}`}
                            >
                              {resendingInvitationId === member.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white text-foreground border">
                            Renvoyer l'invitation par email
                          </TooltipContent>
                        </Tooltip>
                      </>
                    )}
                    {!isPending && (
                      <Select
                        value={member.role}
                        onValueChange={(value) => {
                          updateRoleMutation.mutate({ memberId: member.id, role: value as RbacRole });
                        }}
                        disabled={updateRoleMutation.isPending || member.isOwner}
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
                    {!member.isOwner && member.id !== currentMemberId && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMemberToDelete({ id: member.id, isPending });
                              setDeleteDialogOpen(true);
                            }}
                            disabled={deleteMemberMutation.isPending}
                            data-testid={`button-delete-member-${member.id}`}
                          >
                            {deleteMemberMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white text-foreground border">
                          {isPending ? "Révoquer l'invitation" : "Retirer de l'organisation"}
                        </TooltipContent>
                      </Tooltip>
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
              selectedMember.emailBounced ? (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        Email non délivré
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-300">
                        L'invitation envoyée à <strong>{selectedMember.user?.email}</strong> n'a pas pu être délivrée. Vérifiez que l'adresse email est correcte.
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Vous pouvez copier le lien d'invitation et l'envoyer manuellement, ou révoquer cette invitation et en créer une nouvelle.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
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
              )
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
                          onPackApplied={async () => {
                            // Force refetch to update the checkbox grid
                            await refetchPermissions();
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
                              <div className="flex flex-col items-center gap-1">
                                <span>{ACTION_LABELS[action]}</span>
                                <Checkbox
                                  checked={isColumnAllChecked(action)}
                                  className={isColumnSomeChecked(action) ? "data-[state=checked]:bg-primary/50" : ""}
                                  onCheckedChange={(checked) => toggleColumnPermissions(action, !!checked)}
                                  disabled={selectedMember.role === "admin" || bulkUpdatePermissionsMutation.isPending}
                                  data-testid={`permission-column-${action}`}
                                />
                              </div>
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

      {/* TODO: RoleViewConfig masqué temporairement - fonctionnalité cosmétique non connectée au RBAC */}
      {/* <RoleViewConfig /> */}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {memberToDelete?.isPending ? "Révoquer l'invitation" : "Retirer le membre"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {memberToDelete?.isPending 
                ? "Êtes-vous sûr de vouloir révoquer cette invitation ? Le lien d'invitation ne sera plus valide."
                : "Êtes-vous sûr de vouloir retirer ce membre de l'organisation ? Cette action est irréversible."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (memberToDelete) {
                  deleteMemberMutation.mutate(memberToDelete.id);
                }
                setDeleteDialogOpen(false);
                setMemberToDelete(null);
              }}
            >
              {memberToDelete?.isPending ? "Révoquer" : "Retirer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
