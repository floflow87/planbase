import { usePermissions } from "@/hooks/usePermissions";
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
