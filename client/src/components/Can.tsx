import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Eye, Lock } from "lucide-react";
import type { RbacModule, RbacAction } from "@shared/schema";

interface CanProps {
  module: RbacModule;
  action: RbacAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function Can({ module, action, children, fallback = null }: CanProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading) return null;

  if (!can(module, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface ReadOnlyBadgeProps {
  module: RbacModule;
  className?: string;
}

export function ReadOnlyBadge({ module, className = "" }: ReadOnlyBadgeProps) {
  const { isReadOnly, isLoading } = usePermissions();

  if (isLoading) return null;
  if (!isReadOnly(module)) return null;

  return (
    <Badge variant="secondary" className={`gap-1 ${className}`} data-testid="badge-read-only">
      <Eye className="h-3 w-3" />
      Lecture seule
    </Badge>
  );
}

interface PermissionGuardProps {
  module: RbacModule;
  action?: RbacAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGuard({ module, action = "read", children, fallback }: PermissionGuardProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!can(module, action)) {
    return (
      <>
        {fallback || (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Accès non autorisé</h2>
            <p className="text-muted-foreground max-w-md">
              Vous n'avez pas les permissions nécessaires pour accéder à ce module.
              Contactez votre administrateur pour obtenir l'accès.
            </p>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
}

interface CanAnyProps {
  permissions: Array<{ module: RbacModule; action: RbacAction }>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function CanAny({ permissions, children, fallback = null }: CanAnyProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading) return null;

  const hasAny = permissions.some(({ module, action }) => can(module, action));
  
  if (!hasAny) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface CanAllProps {
  permissions: Array<{ module: RbacModule; action: RbacAction }>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function CanAll({ permissions, children, fallback = null }: CanAllProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading) return null;

  const hasAll = permissions.every(({ module, action }) => can(module, action));
  
  if (!hasAll) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
