import { useAppContext } from "@/hooks/useAppContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Lock, ArrowLeft } from "lucide-react";
import { LoadingState } from "@/design-system/patterns/LoadingState";
import type { RbacModule } from "@shared/schema";

interface PermissionGuardProps {
  module: RbacModule;
  subviewKey?: string;
  children: React.ReactNode;
  fallbackPath?: string;
  showAccessDenied?: boolean;
}

function AccessDenied({ 
  module, 
  fallbackPath = "/" 
}: { 
  module: RbacModule; 
  fallbackPath?: string;
}) {
  const [, navigate] = useLocation();

  return (
    <div className="flex items-center justify-center min-h-[60vh]" data-testid="access-denied">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-destructive" />
          </div>
          <CardTitle className="text-lg">Accès non autorisé</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground text-sm">
            Vous n'avez pas les permissions nécessaires pour accéder à ce module.
          </p>
          <Button onClick={() => navigate(fallbackPath)} data-testid="button-go-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SubviewDenied({ 
  subviewKey, 
  fallbackPath = "/" 
}: { 
  subviewKey: string; 
  fallbackPath?: string;
}) {
  const [, navigate] = useLocation();

  return (
    <div className="flex items-center justify-center min-h-[60vh]" data-testid="subview-denied">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg">Section non disponible</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground text-sm">
            Cette section n'est pas activée pour votre compte.
          </p>
          <Button variant="outline" onClick={() => navigate(fallbackPath)} data-testid="button-go-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function PermissionGuard({
  module,
  subviewKey,
  children,
  fallbackPath = "/",
  showAccessDenied = true,
}: PermissionGuardProps) {
  const { can, isSubviewEnabled, isLoading, hasModuleAccess } = useAppContext();
  const [, navigate] = useLocation();

  if (isLoading) {
    return <LoadingState size="md" />;
  }

  if (!hasModuleAccess(module)) {
    if (showAccessDenied) {
      return <AccessDenied module={module} fallbackPath={fallbackPath} />;
    }
    return null;
  }

  if (subviewKey && !isSubviewEnabled(module, subviewKey)) {
    if (showAccessDenied) {
      return <SubviewDenied subviewKey={subviewKey} fallbackPath={fallbackPath} />;
    }
    return null;
  }

  return <>{children}</>;
}

export function useReadOnlyMode(module: RbacModule) {
  const { isReadOnly, can, isAdmin, isMember, isGuest } = useAppContext();
  
  const readOnly = isReadOnly(module);
  const canCreate = can(module, "create");
  const canUpdate = can(module, "update");
  const canDelete = can(module, "delete");

  return {
    readOnly,
    canCreate,
    canUpdate,
    canDelete,
    isAdmin,
    isMember,
    isGuest,
  };
}

export function ReadOnlyBanner({ module }: { module: RbacModule }) {
  const { readOnly } = useReadOnlyMode(module);

  if (!readOnly) return null;

  return (
    <div 
      className="bg-muted/50 border rounded-md px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground mb-4"
      data-testid="banner-read-only"
    >
      <Shield className="w-4 h-4" />
      <span>Mode lecture seule - Vous pouvez consulter mais pas modifier</span>
    </div>
  );
}
