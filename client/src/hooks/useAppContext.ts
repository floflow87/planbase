import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import type { RbacModule, RbacAction } from "@shared/schema";

interface UserInfo {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

interface OrganizationInfo {
  id: string;
  name: string | null;
  plan: string | null;
}

interface MembershipInfo {
  id: string;
  role: "admin" | "member" | "guest";
  status: string;
}

interface ModuleViewInfo {
  layout?: Record<string, any>;
  subviewsEnabled?: Record<string, boolean>;
}

interface AppContextData {
  user: UserInfo;
  organization: OrganizationInfo | null;
  membership: MembershipInfo | null;
  permissions: Record<string, Record<string, boolean>>;
  moduleViews: Record<string, ModuleViewInfo>;
}

export function useAppContext() {
  const { user: authUser } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<AppContextData>({
    queryKey: ["/api/me/context"],
    enabled: !!authUser,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const can = (module: RbacModule, action: RbacAction): boolean => {
    if (!data?.membership) return false;
    if (data.membership.role === "admin") return true;
    return data.permissions[module]?.[action] ?? false;
  };

  const isReadOnly = (module: RbacModule): boolean => {
    if (!data?.membership) return true;
    if (data.membership.role === "admin") return false;
    
    const modulePerms = data.permissions[module];
    if (!modulePerms) return true;
    
    return modulePerms.read && !modulePerms.create && !modulePerms.update && !modulePerms.delete;
  };

  const isSubviewEnabled = (module: RbacModule, subviewKey: string): boolean => {
    if (!data?.membership) return false;
    if (data.membership.role === "admin") return true;
    
    const moduleView = data.moduleViews[module];
    if (!moduleView?.subviewsEnabled) return true;
    return moduleView.subviewsEnabled[subviewKey] ?? true;
  };

  const getLayoutConfig = (module: RbacModule, key: string): any => {
    return data?.moduleViews[module]?.layout?.[key] ?? null;
  };

  const hasModuleAccess = (module: RbacModule): boolean => {
    return can(module, "read");
  };

  const isAdmin = data?.membership?.role === "admin";
  const isMember = data?.membership?.role === "member";
  const isGuest = data?.membership?.role === "guest";

  return {
    user: data?.user ?? null,
    organization: data?.organization ?? null,
    membership: data?.membership ?? null,
    permissions: data?.permissions ?? {},
    moduleViews: data?.moduleViews ?? {},
    isLoading,
    error,
    refetch,
    can,
    isReadOnly,
    isSubviewEnabled,
    getLayoutConfig,
    hasModuleAccess,
    isAdmin,
    isMember,
    isGuest,
    role: data?.membership?.role ?? null,
  };
}

export function useCanAccess(module: RbacModule, action: RbacAction): boolean {
  const { can } = useAppContext();
  return can(module, action);
}

export function useSubviewAccess(module: RbacModule, subviewKey: string): boolean {
  const { can, isSubviewEnabled } = useAppContext();
  return can(module, "read") && isSubviewEnabled(module, subviewKey);
}
