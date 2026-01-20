import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import type { RbacModule, RbacAction } from "@shared/schema";

interface PermissionMatrix {
  crm: Record<RbacAction, boolean>;
  projects: Record<RbacAction, boolean>;
  product: Record<RbacAction, boolean>;
  roadmap: Record<RbacAction, boolean>;
  tasks: Record<RbacAction, boolean>;
  notes: Record<RbacAction, boolean>;
  documents: Record<RbacAction, boolean>;
  profitability: Record<RbacAction, boolean>;
}

interface RbacData {
  memberId: string;
  role: "admin" | "member" | "guest";
  permissions: PermissionMatrix;
}

export interface ModuleViewConfig {
  subviewsEnabled?: Record<string, boolean>;
  layout?: Record<string, any>;
}

export function usePermissions() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<RbacData>({
    queryKey: ["/api/rbac/me"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const can = (module: RbacModule, action: RbacAction): boolean => {
    if (!data) return false;
    
    // Admin has full access
    if (data.role === "admin") return true;
    
    return data.permissions[module]?.[action] ?? false;
  };

  const isReadOnly = (module: RbacModule): boolean => {
    if (!data) return true;
    if (data.role === "admin") return false;
    
    const modulePerms = data.permissions[module];
    if (!modulePerms) return true;
    
    return modulePerms.read && !modulePerms.create && !modulePerms.update && !modulePerms.delete;
  };

  const isAdmin = data?.role === "admin";
  const isMember = data?.role === "member";
  const isGuest = data?.role === "guest";

  return {
    data,
    isLoading,
    error,
    can,
    isReadOnly,
    isAdmin,
    isMember,
    isGuest,
    role: data?.role,
    memberId: data?.memberId,
  };
}

export function useCanAccess(module: RbacModule, action: RbacAction): boolean {
  const { can } = usePermissions();
  return can(module, action);
}

export function useModuleView(module: string) {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<ModuleViewConfig>({
    queryKey: ["/api/views/me", { module }],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const isSubviewEnabled = (subviewKey: string): boolean => {
    if (!data?.subviewsEnabled) return true;
    return data.subviewsEnabled[subviewKey] ?? true;
  };

  const getLayoutConfig = (key: string): any => {
    return data?.layout?.[key] ?? null;
  };

  return {
    viewConfig: data,
    isLoading,
    error,
    isSubviewEnabled,
    getLayoutConfig,
  };
}
