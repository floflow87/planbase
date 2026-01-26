import { db } from "../db";
import { eq, and } from "drizzle-orm";
import {
  organizationMembers,
  permissions,
  moduleViews,
  roleViewTemplates,
  OrganizationMember,
  Permission,
  ModuleView,
  InsertOrganizationMember,
  InsertPermission,
  InsertModuleView,
  RBAC_ROLES,
  RBAC_MODULES,
  RBAC_ACTIONS,
  RbacRole,
  RbacModule,
  RbacAction,
} from "@shared/schema";

type PermissionCacheKey = `${string}:${string}:${string}`;

interface CacheEntry {
  permissions: Permission[];
  expiresAt: number;
}

const permissionCache = new Map<PermissionCacheKey, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(organizationId: string, memberId: string, module: string): PermissionCacheKey {
  return `${organizationId}:${memberId}:${module}`;
}

function clearMemberCache(organizationId: string, memberId: string) {
  for (const key of permissionCache.keys()) {
    if (key.startsWith(`${organizationId}:${memberId}:`)) {
      permissionCache.delete(key);
    }
  }
}

function clearOrganizationCache(organizationId: string) {
  for (const key of permissionCache.keys()) {
    if (key.startsWith(`${organizationId}:`)) {
      permissionCache.delete(key);
    }
  }
}

// Default permissions by role
// IMPORTANT: Owner has FULL access to everything - this is non-negotiable
const DEFAULT_PERMISSIONS: Record<RbacRole, Record<RbacModule, RbacAction[]>> = {
  owner: {
    crm: ['read', 'create', 'update', 'delete'],
    projects: ['read', 'create', 'update', 'delete'],
    product: ['read', 'create', 'update', 'delete'],
    roadmap: ['read', 'create', 'update', 'delete'],
    tasks: ['read', 'create', 'update', 'delete'],
    notes: ['read', 'create', 'update', 'delete'],
    documents: ['read', 'create', 'update', 'delete'],
    profitability: ['read', 'create', 'update', 'delete'],
  },
  admin: {
    crm: ['read', 'create', 'update', 'delete'],
    projects: ['read', 'create', 'update', 'delete'],
    product: ['read', 'create', 'update', 'delete'],
    roadmap: ['read', 'create', 'update', 'delete'],
    tasks: ['read', 'create', 'update', 'delete'],
    notes: ['read', 'create', 'update', 'delete'],
    documents: ['read', 'create', 'update', 'delete'],
    profitability: ['read', 'create', 'update', 'delete'],
  },
  member: {
    crm: ['read', 'create', 'update'],
    projects: ['read', 'create', 'update'],
    product: ['read', 'create', 'update'],
    roadmap: ['read', 'create', 'update'],
    tasks: ['read', 'create', 'update', 'delete'],
    notes: ['read', 'create', 'update', 'delete'],
    documents: ['read', 'create', 'update'],
    profitability: ['read'],
  },
  guest: {
    crm: ['read'],
    projects: ['read'],
    product: ['read'],
    roadmap: ['read'],
    tasks: ['read'],
    notes: ['read'],
    documents: ['read'],
    profitability: [],
  },
};

export const permissionService = {
  // ============================================
  // Organization Members
  // ============================================

  async getMemberByUserAndOrg(userId: string, organizationId: string): Promise<OrganizationMember | null> {
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId)
        )
      );
    return member || null;
  },

  async getMembersByOrganization(organizationId: string): Promise<OrganizationMember[]> {
    return db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));
  },

  async createMember(data: InsertOrganizationMember): Promise<OrganizationMember> {
    const [member] = await db
      .insert(organizationMembers)
      .values(data)
      .returning();
    
    // Create default permissions based on role
    await this.initializeDefaultPermissions(data.organizationId, member.id, data.role as RbacRole);
    
    return member;
  },

  async updateMemberRole(memberId: string, role: RbacRole, organizationId: string): Promise<OrganizationMember | null> {
    // SECURITY: Scope update by both memberId AND organizationId to prevent cross-tenant attacks
    const [member] = await db
      .update(organizationMembers)
      .set({ role })
      .where(
        and(
          eq(organizationMembers.id, memberId),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
      .returning();
    
    if (member) {
      // Reset permissions to new role defaults
      await this.resetPermissionsToRoleDefaults(organizationId, memberId, role);
      clearMemberCache(organizationId, memberId);
    }
    
    return member || null;
  },

  async deleteMember(memberId: string, organizationId: string): Promise<boolean> {
    // SECURITY: Scope delete by both memberId AND organizationId to prevent cross-tenant attacks
    const result = await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.id, memberId),
          eq(organizationMembers.organizationId, organizationId)
        )
      );
    
    clearMemberCache(organizationId, memberId);
    return true;
  },

  // ============================================
  // Permissions
  // ============================================

  async getPermissionsForMember(memberId: string, organizationId: string, module?: RbacModule): Promise<Permission[]> {
    const cacheKey = getCacheKey(organizationId, memberId, module || 'all');
    const cached = permissionCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    let query = db
      .select()
      .from(permissions)
      .where(eq(permissions.memberId, memberId));

    if (module) {
      query = db
        .select()
        .from(permissions)
        .where(
          and(
            eq(permissions.memberId, memberId),
            eq(permissions.module, module)
          )
        );
    }

    const perms = await query;
    
    permissionCache.set(cacheKey, {
      permissions: perms,
      expiresAt: Date.now() + CACHE_TTL,
    });
    
    return perms;
  },

  async hasPermission(
    memberId: string,
    organizationId: string,
    module: RbacModule,
    action: RbacAction,
    subviewKey?: string
  ): Promise<boolean> {
    const perms = await this.getPermissionsForMember(memberId, organizationId, module);
    
    if (subviewKey) {
      // Check subview-specific permission first
      const subviewPerm = perms.find(
        (p) => p.module === module && p.action === action && p.subviewKey === subviewKey
      );
      if (subviewPerm) return subviewPerm.allowed;
    }
    
    // Fall back to module-level permission
    const modulePerm = perms.find(
      (p) => p.module === module && p.action === action && p.scope === 'module'
    );
    return modulePerm?.allowed ?? false;
  },

  async setPermission(data: InsertPermission): Promise<Permission> {
    // Check if permission already exists
    const existing = await db
      .select()
      .from(permissions)
      .where(
        and(
          eq(permissions.memberId, data.memberId),
          eq(permissions.module, data.module),
          eq(permissions.action, data.action),
          data.subviewKey 
            ? eq(permissions.subviewKey, data.subviewKey) 
            : eq(permissions.scope, 'module')
        )
      );

    let result: Permission;
    if (existing.length > 0) {
      const [updated] = await db
        .update(permissions)
        .set({
          allowed: data.allowed,
          version: existing[0].version + 1,
          updatedAt: new Date(),
        })
        .where(eq(permissions.id, existing[0].id))
        .returning();
      result = updated;
    } else {
      const [created] = await db
        .insert(permissions)
        .values(data)
        .returning();
      result = created;
    }

    clearMemberCache(data.organizationId, data.memberId);
    return result;
  },

  async initializeDefaultPermissions(organizationId: string, memberId: string, role: RbacRole): Promise<void> {
    const defaultPerms = DEFAULT_PERMISSIONS[role];
    
    const permissionRecords: InsertPermission[] = [];
    
    for (const module of RBAC_MODULES) {
      const allowedActions = defaultPerms[module];
      for (const action of RBAC_ACTIONS) {
        permissionRecords.push({
          organizationId,
          memberId,
          module,
          action,
          allowed: allowedActions.includes(action),
          scope: 'module',
        });
      }
    }

    if (permissionRecords.length > 0) {
      await db.insert(permissions).values(permissionRecords);
    }
  },

  async resetPermissionsToRoleDefaults(organizationId: string, memberId: string, role: RbacRole): Promise<void> {
    // Delete existing permissions
    await db
      .delete(permissions)
      .where(eq(permissions.memberId, memberId));
    
    // Create new default permissions
    await this.initializeDefaultPermissions(organizationId, memberId, role);
    clearMemberCache(organizationId, memberId);
  },

  // ============================================
  // Module Views
  // ============================================

  async getModuleView(memberId: string, module: RbacModule): Promise<ModuleView | null> {
    const [view] = await db
      .select()
      .from(moduleViews)
      .where(
        and(
          eq(moduleViews.memberId, memberId),
          eq(moduleViews.module, module)
        )
      );
    return view || null;
  },

  async setModuleView(data: InsertModuleView): Promise<ModuleView> {
    const existing = await this.getModuleView(data.memberId, data.module as RbacModule);
    
    if (existing) {
      const [updated] = await db
        .update(moduleViews)
        .set({
          layout: data.layout,
          subviewsEnabled: data.subviewsEnabled,
          updatedAt: new Date(),
        })
        .where(eq(moduleViews.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(moduleViews)
      .values(data)
      .returning();
    return created;
  },

  // ============================================
  // Bulk Operations
  // ============================================

  async getFullPermissionMatrix(organizationId: string, memberId: string): Promise<Record<RbacModule, Record<RbacAction, boolean>>> {
    const perms = await this.getPermissionsForMember(memberId, organizationId);
    
    const matrix: Record<RbacModule, Record<RbacAction, boolean>> = {} as any;
    
    for (const module of RBAC_MODULES) {
      matrix[module] = {} as Record<RbacAction, boolean>;
      for (const action of RBAC_ACTIONS) {
        const perm = perms.find(
          (p) => p.module === module && p.action === action && p.scope === 'module'
        );
        matrix[module][action] = perm?.allowed ?? false;
      }
    }
    
    return matrix;
  },

  async bulkUpdatePermissions(
    organizationId: string,
    memberId: string,
    updates: Array<{ module: RbacModule; action: RbacAction; allowed: boolean }>
  ): Promise<void> {
    for (const update of updates) {
      await this.setPermission({
        organizationId,
        memberId,
        module: update.module,
        action: update.action,
        allowed: update.allowed,
        scope: 'module',
      });
    }
    clearMemberCache(organizationId, memberId);
  },

  // Cache management
  clearCache: clearOrganizationCache,
  clearMemberCache,

  // ============================================
  // Module Views (Guest View Configurations)
  // ============================================

  async getModuleViewWithOrg(organizationId: string, memberId: string, module: string): Promise<ModuleView | null> {
    const [view] = await db
      .select()
      .from(moduleViews)
      .where(
        and(
          eq(moduleViews.organizationId, organizationId),
          eq(moduleViews.memberId, memberId),
          eq(moduleViews.module, module)
        )
      );
    return view || null;
  },

  async setModuleViewWithOrg(organizationId: string, memberId: string, module: string, config: any): Promise<ModuleView> {
    const existing = await this.getModuleViewWithOrg(organizationId, memberId, module);
    
    if (existing) {
      const [updated] = await db
        .update(moduleViews)
        .set({ config, updatedAt: new Date() })
        .where(eq(moduleViews.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(moduleViews)
        .values({
          organizationId,
          memberId,
          module,
          config,
        })
        .returning();
      return created;
    }
  },

  async getGuestViewTemplate(organizationId: string, module: string): Promise<any | null> {
    const [template] = await db
      .select()
      .from(roleViewTemplates)
      .where(
        and(
          eq(roleViewTemplates.organizationId, organizationId),
          eq(roleViewTemplates.role, "guest"),
          eq(roleViewTemplates.module, module)
        )
      );
    return template?.config || null;
  },

  async setGuestViewTemplate(organizationId: string, module: string, config: any): Promise<void> {
    const existing = await db
      .select()
      .from(roleViewTemplates)
      .where(
        and(
          eq(roleViewTemplates.organizationId, organizationId),
          eq(roleViewTemplates.role, "guest"),
          eq(roleViewTemplates.module, module)
        )
      );

    if (existing.length > 0) {
      await db
        .update(roleViewTemplates)
        .set({ config, updatedAt: new Date() })
        .where(eq(roleViewTemplates.id, existing[0].id));
    } else {
      await db
        .insert(roleViewTemplates)
        .values({
          organizationId,
          role: "guest",
          module,
          config,
        });
    }
  },

  async applyGuestViewTemplateToAll(organizationId: string, module: string, config: any): Promise<void> {
    // Get all guest members
    const guestMembers = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.role, "guest")
        )
      );

    // Apply the template to each guest
    for (const guest of guestMembers) {
      await this.setModuleViewWithOrg(organizationId, guest.id, module, config);
    }
  },

  async getMemberViewTemplate(organizationId: string, module: string): Promise<any | null> {
    const [template] = await db
      .select()
      .from(roleViewTemplates)
      .where(
        and(
          eq(roleViewTemplates.organizationId, organizationId),
          eq(roleViewTemplates.role, "member"),
          eq(roleViewTemplates.module, module)
        )
      );
    return template?.config || null;
  },

  async setMemberViewTemplate(organizationId: string, module: string, config: any): Promise<void> {
    const existing = await db
      .select()
      .from(roleViewTemplates)
      .where(
        and(
          eq(roleViewTemplates.organizationId, organizationId),
          eq(roleViewTemplates.role, "member"),
          eq(roleViewTemplates.module, module)
        )
      );

    if (existing.length > 0) {
      await db
        .update(roleViewTemplates)
        .set({ config, updatedAt: new Date() })
        .where(eq(roleViewTemplates.id, existing[0].id));
    } else {
      await db.insert(roleViewTemplates).values({
        organizationId,
        role: "member",
        module,
        config,
      });
    }
  },

  async applyMemberViewTemplateToAll(organizationId: string, module: string, config: any): Promise<void> {
    const memberMembers = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.role, "member")
        )
      );

    for (const member of memberMembers) {
      await this.setModuleViewWithOrg(organizationId, member.id, module, config);
    }
  },
};
