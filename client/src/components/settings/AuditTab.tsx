import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { 
  Clock, 
  User, 
  Shield, 
  Link2, 
  FileText, 
  FolderKanban, 
  Trash2, 
  UserPlus, 
  UserMinus,
  PackagePlus,
  KeyRound,
  RefreshCw
} from "lucide-react";

interface AuditEvent {
  id: string;
  organizationId: string;
  actorMemberId: string | null;
  actionType: string;
  resourceType: string | null;
  resourceId: string | null;
  meta: Record<string, any>;
  createdAt: string;
}

const ACTION_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  "permission.updated": { label: "Permissions modifiées", icon: <Shield className="h-3 w-3" />, variant: "secondary" },
  "member.invited": { label: "Membre invité", icon: <UserPlus className="h-3 w-3" />, variant: "default" },
  "member.role_changed": { label: "Rôle modifié", icon: <KeyRound className="h-3 w-3" />, variant: "secondary" },
  "member.removed": { label: "Membre supprimé", icon: <UserMinus className="h-3 w-3" />, variant: "destructive" },
  "share.created": { label: "Lien de partage créé", icon: <Link2 className="h-3 w-3" />, variant: "default" },
  "share.revoked": { label: "Lien de partage révoqué", icon: <Link2 className="h-3 w-3" />, variant: "destructive" },
  "share.accessed": { label: "Lien de partage consulté", icon: <Link2 className="h-3 w-3" />, variant: "outline" },
  "document.deleted": { label: "Document supprimé", icon: <FileText className="h-3 w-3" />, variant: "destructive" },
  "project.deleted": { label: "Projet supprimé", icon: <FolderKanban className="h-3 w-3" />, variant: "destructive" },
  "project.created": { label: "Projet créé", icon: <FolderKanban className="h-3 w-3" />, variant: "default" },
  "billing.updated": { label: "Facturation modifiée", icon: <FileText className="h-3 w-3" />, variant: "secondary" },
  "pack.applied": { label: "Pack appliqué", icon: <PackagePlus className="h-3 w-3" />, variant: "default" },
  "project_access.granted": { label: "Accès projet accordé", icon: <FolderKanban className="h-3 w-3" />, variant: "default" },
  "project_access.revoked": { label: "Accès projet révoqué", icon: <FolderKanban className="h-3 w-3" />, variant: "destructive" },
};

const ACTION_TYPES = [
  "all",
  "permission.updated",
  "member.invited",
  "member.role_changed",
  "member.removed",
  "share.created",
  "share.revoked",
  "share.accessed",
  "pack.applied",
  "project_access.granted",
  "project_access.revoked",
];

export function AuditTab() {
  const [actionTypeFilter, setActionTypeFilter] = useState("all");
  const [limit, setLimit] = useState("50");

  const { data: events = [], isLoading, refetch } = useQuery<AuditEvent[]>({
    queryKey: ["/api/audit", actionTypeFilter, limit],
    queryFn: async () => {
      const params = new URLSearchParams({ limit });
      if (actionTypeFilter !== "all") {
        params.append("actionType", actionTypeFilter);
      }
      const res = await fetch(`/api/audit?${params}`);
      if (!res.ok) throw new Error("Erreur lors du chargement");
      return res.json();
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionInfo = (actionType: string) => {
    return ACTION_TYPE_LABELS[actionType] || {
      label: actionType,
      icon: <Clock className="h-3 w-3" />,
      variant: "outline" as const,
    };
  };

  const renderMeta = (event: AuditEvent) => {
    const meta = event.meta;
    if (!meta || Object.keys(meta).length === 0) return null;

    const items: string[] = [];
    
    if (meta.packId) items.push(`Pack: ${meta.packId}`);
    if (meta.oldRole && meta.newRole) items.push(`${meta.oldRole} → ${meta.newRole}`);
    if (meta.accessLevel) items.push(`Niveau: ${meta.accessLevel}`);
    if (meta.email) items.push(meta.email);
    
    if (items.length === 0) return null;
    
    return (
      <span className="text-xs text-muted-foreground ml-2">
        ({items.join(", ")})
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Journal d'audit
            </CardTitle>
            <CardDescription>
              Historique des actions sensibles sur votre organisation
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-audit"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 mb-4">
          <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
            <SelectTrigger className="w-56" data-testid="select-action-type">
              <SelectValue placeholder="Type d'action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les actions</SelectItem>
              {ACTION_TYPES.filter(t => t !== "all").map(type => (
                <SelectItem key={type} value={type}>
                  {ACTION_TYPE_LABELS[type]?.label || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger className="w-32" data-testid="select-limit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 derniers</SelectItem>
              <SelectItem value="50">50 derniers</SelectItem>
              <SelectItem value="100">100 derniers</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Chargement...
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucun événement d'audit
          </div>
        ) : (
          <div className="space-y-2">
            {events.map(event => {
              const actionInfo = getActionInfo(event.actionType);
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-background hover-elevate"
                >
                  <div className="flex-shrink-0">
                    {event.actorMemberId ? (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                        <Link2 className="h-4 w-4 text-violet-600" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={actionInfo.variant} className="gap-1">
                        {actionInfo.icon}
                        {actionInfo.label}
                      </Badge>
                      {renderMeta(event)}
                    </div>
                    {event.resourceType && event.resourceId && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {event.resourceType}: {event.resourceId.slice(0, 8)}...
                      </p>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0 text-xs text-muted-foreground">
                    {formatDate(event.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
