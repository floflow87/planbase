import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, getGoogleClientId, getGoogleClientSecret } from "./storage";
import {
  insertAccountSchema,
  insertAppUserSchema,
  updateProfileSchema,
  insertClientSchema,
  insertContactSchema,
  insertClientCustomTabSchema,
  updateClientCustomTabSchema,
  insertClientCustomFieldSchema,
  updateClientCustomFieldSchema,
  insertClientCustomFieldValueSchema,
  updateClientCustomFieldValueSchema,
  insertProjectSchema,
  updateProjectSchema,
  insertNoteSchema,
  insertNoteLinkSchema,
  insertDocumentTemplateSchema,
  updateDocumentTemplateSchema,
  insertDocumentSchema,
  updateDocumentSchema,
  insertFolderSchema,
  insertFileSchema,
  insertActivitySchema,
  insertDealSchema,
  insertProductSchema,
  insertFeatureSchema,
  insertRoadmapSchema,
  insertRoadmapItemSchema,
  insertRoadmapItemLinkSchema,
  insertRoadmapDependencySchema,
  insertCdcSessionSchema,
  updateCdcSessionSchema,
  insertProjectScopeItemSchema,
  updateProjectScopeItemSchema,
  insertClientCommentSchema,
  insertAppointmentSchema,
  updateAppointmentSchema,
  insertMindmapSchema,
  insertMindmapNodeSchema,
  insertMindmapEdgeSchema,
  insertEntityLinkSchema,
  type ClientCustomField,
  accounts,
  insertBacklogSchema,
  updateBacklogSchema,
  insertEpicSchema,
  updateEpicSchema,
  insertUserStorySchema,
  updateUserStorySchema,
  insertBacklogTaskSchema,
  updateBacklogTaskSchema,
  insertChecklistItemSchema,
  updateChecklistItemSchema,
  insertSprintSchema,
  updateSprintSchema,
  insertBacklogColumnSchema,
  updateBacklogColumnSchema,
  insertTicketCommentSchema,
  updateTicketCommentSchema,
  insertTicketAcceptanceCriteriaSchema,
  updateTicketAcceptanceCriteriaSchema,
  ticketAcceptanceCriteria,
  upsertTicketRecipeSchema,
  recipeStatusOptions,
  recipeConclusionOptions,
  backlogs,
  epics,
  userStories,
  backlogTasks,
  checklistItems,
  sprints,
  backlogColumns,
  tasks,
  ticketComments,
  ticketRecipes,
  projects,
  appUsers,
  retros,
  retroCards,
  userOnboarding,
  activities,
  insertResourceTemplateSchema,
  insertProjectResourceSchema,
  resourceTemplates,
  projectResources,
  projectCategories,
  okrObjectives,
  okrKeyResults,
  okrLinks,
  roadmaps,
  roadmapItems,
  insertOkrObjectiveSchema,
  updateOkrObjectiveSchema,
  insertOkrKeyResultSchema,
  updateOkrKeyResultSchema,
  insertOkrLinkSchema,
  auditEvents,
  invitations,
  organizationMembers,
} from "@shared/schema";
import { summarizeText, extractActions, classifyDocument, suggestNextActions } from "./lib/openai";
import { requireAuth, requireRole, optionalAuth, requireOrgMember, requireOrgAdmin, requirePermission } from "./middleware/auth";
import { permissionService } from "./services/permissionService";
import { getDemoCredentials } from "./middleware/demo-helper";
import { configService } from "./services/configService";
import { supabaseAdmin } from "./lib/supabase";
import { google } from "googleapis";
import { db } from "./db";
import { eq, and, asc, desc, not, sql, inArray } from "drizzle-orm";

// Default view configurations for all modules
function getDefaultViewConfig(module: string): any {
  switch (module) {
    case 'crm':
      return {
        subviewsEnabled: {
          'crm.clients': true,
          'crm.opportunities': false,
          'crm.kpis': false,
        },
        layout: {
          clientsTable: {
            visibleColumns: ['name', 'stage', 'lastContactAt', 'owner'],
          },
        },
      };
    case 'projects':
      return {
        subviewsEnabled: {
          'projects.list': true,
          'projects.details': true,
          'projects.scope': false,
          'projects.billing': false,
        },
      };
    case 'product':
      return {
        subviewsEnabled: {
          'product.backlog': false,
          'product.epics': false,
          'product.stats': false,
          'product.retrospective': false,
          'product.recipe': false,
        },
      };
    case 'roadmap':
      return {
        subviewsEnabled: {
          'roadmap.gantt': false,
          'roadmap.output': false,
          'roadmap.okr': false,
          'roadmap.tree': false,
        },
      };
    case 'profitability':
      return {
        subviewsEnabled: {
          'profitability.overview': false,
          'profitability.byProject': false,
          'profitability.simulations': false,
          'profitability.resources': false,
        },
      };
    case 'documents':
      return {
        subviewsEnabled: {
          'documents.list': false,
          'documents.upload': false,
          'documents.integrations': false,
        },
      };
    case 'notes':
      return {
        layout: {
          notesList: {
            mode: 'list',
            visibleFields: ['title', 'project', 'updatedAt'],
          },
        },
      };
    case 'tasks':
      return {};
    default:
      return {};
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ============================================
  // HEALTH CHECK - Keep app awake
  // ============================================
  
  /**
   * Health check endpoint for uptime monitoring
   * Returns 200 OK with basic app status
   * Use with UptimeRobot or similar services to prevent auto-sleep
   */
  app.get("/healthz", async (req, res) => {
    res.status(200).json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      service: "planbase",
      uptime: process.uptime(),
    });
  });

  app.get("/ping", async (req, res) => {
    res.status(200).json({ status: "ok" });
  });
  
  // ============================================
  // DEMO & AUTH HELPERS (Development Only)
  // ============================================
  
  /**
   * ⚠️ SECURITY: This endpoint exposes real account and user IDs
   * Only enable in development/staging environments
   */
  app.get("/api/demo/credentials", async (req, res) => {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Not found" });
    }

    try {
      const credentials = await getDemoCredentials();
      if (!credentials) {
        return res.status(404).json({ error: "Demo account not found. Run /api/seed first." });
      }
      res.json({
        warning: "⚠️ Development Only - Do not use in production",
        message: "Use these credentials to test the API",
        usage: "Include 'x-account-id' and 'x-user-id' headers in your requests",
        credentials,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  // ============================================
  // CONFIG REGISTRY
  // ============================================

  /**
   * Get resolved configuration for the current user/account
   * Merges defaults with DB-stored overrides following scope hierarchy
   */
  app.get("/api/config", requireAuth, async (req, res) => {
    try {
      const accountId = req.accountId;
      const userId = req.userId;
      const projectId = req.query.projectId as string | undefined;

      const config = await configService.resolveConfig(accountId, userId, projectId);
      
      res.json({
        effective: config.effective,
        meta: config.meta,
      });
    } catch (error: any) {
      console.error("Error fetching config:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Update a specific configuration setting (admin only)
   */
  app.put("/api/config/:key", requireAuth, requireRole("owner"), async (req, res) => {
    try {
      const { key } = req.params;
      const { value, scope = "ACCOUNT", scopeId } = req.body;
      const accountId = req.accountId;
      const userId = req.userId;

      if (!value) {
        return res.status(400).json({ error: "Value is required" });
      }

      const resolvedScopeId = scopeId || (scope === "ACCOUNT" ? accountId : scope === "USER" ? userId : null);

      await configService.updateSetting(
        key as any,
        value,
        scope,
        resolvedScopeId,
        userId
      );

      const updatedConfig = await configService.resolveConfig(accountId, userId);
      
      res.json({
        success: true,
        effective: updatedConfig.effective,
      });
    } catch (error: any) {
      console.error("Error updating config:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // ACCOUNTS
  // ============================================

  app.post("/api/accounts", async (req, res) => {
    try {
      const data = insertAccountSchema.parse(req.body);
      const account = await storage.createAccount(data);
      res.json(account);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // REMOVED: Unauthenticated route that exposed sensitive OAuth credentials
  // Use the authenticated route at line ~1987 instead: GET /api/accounts/:accountId with requireAuth

  // ============================================
  // AUTH - SIGNUP
  // ============================================
  
  /**
   * Create a new account and user via Supabase Auth
   * This endpoint handles the complete signup flow:
   * 1. Create Supabase Auth user
   * 2. Create Account in database
   * 3. Create app_user in database
   * 4. Store account_id in Supabase user_metadata for JWT
   */
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName, accountName } = req.body;

      // Validate required fields
      if (!email || !password || !accountName) {
        return res.status(400).json({ 
          error: "Email, password, and account name are required" 
        });
      }

      if (password.length < 6) {
        return res.status(400).json({ 
          error: "Password must be at least 6 characters long" 
        });
      }

      // Step 1: Create Account in database first (to get account_id)
      const account = await storage.createAccount({
        name: accountName.trim(),
        plan: "starter",
        settings: {},
      });

      // Step 2: Create Supabase Auth user with account_id in metadata
      let authData: any = null;
      
      try {
        const authResult = await supabaseAdmin.auth.admin.createUser({
          email: email.trim().toLowerCase(),
          password,
          email_confirm: true, // Auto-confirm email for better UX
          user_metadata: {
            account_id: account.id,
            firstName: firstName?.trim() || "",
            lastName: lastName?.trim() || "",
            role: "owner", // First user is always the account owner
          },
        });

        if (authResult.error || !authResult.data.user) {
          console.error("Supabase Auth error:", authResult.error);
          throw new Error(authResult.error?.message || "Failed to create authentication user");
        }
        
        authData = authResult.data;
      } catch (authCreateError: any) {
        // Rollback: Delete the orphaned account from database
        try {
          await db.delete(accounts).where(eq(accounts.id, account.id));
          console.log("✅ Rollback: Deleted orphaned account", account.id);
        } catch (deleteError) {
          console.error("❌ Failed to rollback account deletion:", deleteError);
        }
        throw authCreateError;
      }

      // Step 3: Create app_user in database
      let appUser: any = null;
      
      try {
        appUser = await storage.createUser({
          id: authData.user.id, // Use Supabase auth user ID
          accountId: account.id,
          email: email.trim().toLowerCase(),
          firstName: firstName?.trim() || "",
          lastName: lastName?.trim() || "",
          role: "owner",
          profile: {},
        });
      } catch (userCreateError: any) {
        // Rollback: Delete Supabase Auth user and Account
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          await db.delete(accounts).where(eq(accounts.id, account.id));
          console.log("✅ Rollback: Deleted auth user and account");
        } catch (deleteError) {
          console.error("❌ Failed to rollback after user creation error:", deleteError);
        }
        throw userCreateError;
      }

      // Step 4: Update account with owner reference
      try {
        await storage.updateAccount(account.id, {
          ownerUserId: authData.user.id,
        });
      } catch (updateError: any) {
        console.error("⚠️  Failed to update account owner reference (non-critical):", updateError);
        // Don't rollback for this - user account is still valid
      }

      // Step 5: Create onboarding record for new user
      try {
        await db.insert(userOnboarding).values({
          userId: appUser.id,
          version: "v1",
        });
        console.log("✅ Created onboarding record for user:", appUser.id);
      } catch (onboardingError: any) {
        console.error("⚠️  Failed to create onboarding record (non-critical):", onboardingError);
        // Don't rollback - user can still use the app
      }

      res.status(201).json({
        message: "Account created successfully",
        accountId: account.id,
        userId: appUser.id,
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(500).json({ 
        error: error.message || "Failed to create account" 
      });
    }
  });

  // ============================================
  // USERS
  // ============================================

  // Get current user info from JWT
  app.get("/api/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      // Also fetch account information including plan
      const account = await storage.getAccount(user.accountId);
      res.json({
        ...user,
        account: account || null,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update current user profile
  app.patch("/api/me", requireAuth, async (req, res) => {
    try {
      // Validate request body with strict schema (only safe fields)
      const validatedData = updateProfileSchema.parse(req.body);
      
      // Update user profile (only validated fields)
      const updatedUser = await storage.updateUser(req.userId!, validatedData);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Also fetch account information to keep consistency with GET /api/me
      const account = await storage.getAccount(updatedUser.accountId);
      
      res.json({
        ...updatedUser,
        account: account || null,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid profile data", details: error.errors });
      }
      res.status(400).json({ error: error.message });
    }
  });

  // Update user password
  app.patch("/api/me/password", requireAuth, async (req, res) => {
    try {
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" });
      }

      // Update password using Supabase Auth
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        req.userId!,
        { password: newPassword }
      );

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.json({ success: true, message: "Mot de passe mis à jour avec succès" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Helper function to delete user from Supabase Auth by email
  async function deleteSupabaseAuthUserByEmail(email: string): Promise<void> {
    // List users and find by email since we don't have the Supabase Auth ID
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error(`❌ Error listing Supabase Auth users:`, listError);
      return;
    }
    
    const supabaseUser = listData.users.find(u => u.email === email);
    if (supabaseUser) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(supabaseUser.id);
      if (deleteError) {
        console.error(`❌ Error deleting ${email} from Supabase Auth:`, deleteError);
      } else {
        console.log(`🗑️ Deleted ${email} from Supabase Auth (ID: ${supabaseUser.id})`);
      }
    } else {
      console.log(`⚠️ User ${email} not found in Supabase Auth`);
    }
  }

  // Delete user account
  app.delete("/api/me/delete", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      
      // Get current user to determine their role
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isOwner = user.role === "owner";
      const accountId = user.accountId;
      const userEmail = user.email;

      console.log(`🗑️ Delete account request for user ${userId} (${userEmail}), role: ${user.role}, isOwner: ${isOwner}`);

      if (isOwner && accountId) {
        // Owner: Delete all organization data, members, and the account
        console.log(`🗑️ Owner deletion: Deleting organization ${accountId} and all data`);
        
        // Get all members of this organization first
        const members = await db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, accountId));
        console.log(`🗑️ Found ${members.length} organization members`);
        
        // Delete all invited users (role='user') from this organization
        for (const member of members) {
          if (member.userId !== userId) {
            const memberUser = await storage.getUser(member.userId);
            if (memberUser && memberUser.role === "user") {
              try {
                // Delete from Supabase Auth FIRST (most important)
                await deleteSupabaseAuthUserByEmail(memberUser.email);
                
                // Delete from organization_members
                await db.delete(organizationMembers).where(
                  and(
                    eq(organizationMembers.userId, member.userId),
                    eq(organizationMembers.organizationId, accountId)
                  )
                );
                console.log(`🗑️ Deleted member ${member.userId} from organization_members`);
                
                // Delete from app_users
                await db.delete(appUsers).where(eq(appUsers.id, member.userId));
                console.log(`🗑️ Deleted member ${member.userId} from app_users`);
              } catch (memberError: any) {
                console.error(`❌ Error deleting member ${member.userId}:`, memberError.message);
              }
            }
          }
        }
        
        // Delete from Supabase Auth FIRST for owner
        await deleteSupabaseAuthUserByEmail(userEmail);
        
        try {
          // Delete organization members for the owner
          await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, accountId));
          console.log(`🗑️ Deleted all organization_members for org ${accountId}`);
        } catch (e: any) {
          console.error(`❌ Error deleting organization_members:`, e.message);
        }
        
        try {
          // Delete the owner user from app_users BEFORE deleting account
          await db.delete(appUsers).where(eq(appUsers.id, userId));
          console.log(`🗑️ Deleted owner from app_users`);
        } catch (e: any) {
          console.error(`❌ Error deleting owner from app_users:`, e.message);
        }
        
        try {
          // Delete the account/organization itself
          await db.delete(accounts).where(eq(accounts.id, accountId));
          console.log(`🗑️ Deleted organization ${accountId}`);
        } catch (e: any) {
          console.error(`❌ Error deleting account:`, e.message);
        }
        
        console.log(`✅ Owner ${userId} and organization ${accountId} deleted successfully`);
      } else {
        // Invited user: Only delete the user, NOT the organization data
        console.log(`🗑️ Invited user deletion: Only removing user ${userId} from organization ${accountId}`);
        
        // Delete from Supabase Auth FIRST (prevents reconnection)
        await deleteSupabaseAuthUserByEmail(userEmail);
        
        // Delete from organization_members
        if (accountId) {
          try {
            const deleteResult = await db.delete(organizationMembers).where(
              and(
                eq(organizationMembers.userId, userId),
                eq(organizationMembers.organizationId, accountId)
              )
            );
            console.log(`🗑️ Removed user from organization_members, result:`, deleteResult);
          } catch (e: any) {
            console.error(`❌ Error deleting from organization_members:`, e.message);
          }
        }
        
        // Delete from app_users
        try {
          const deleteResult = await db.delete(appUsers).where(eq(appUsers.id, userId));
          console.log(`🗑️ Deleted user from app_users, result:`, deleteResult);
        } catch (e: any) {
          console.error(`❌ Error deleting from app_users:`, e.message);
        }
        
        console.log(`✅ Invited user ${userId} deleted successfully (organization data preserved)`);
      }

      res.json({ success: true, message: "Compte supprimé avec succès" });
    } catch (error: any) {
      console.error(`❌ Error deleting account:`, error);
      res.status(400).json({ error: error.message || "Impossible de supprimer le compte" });
    }
  });

  // Admin endpoint to clean up orphaned user data by email (temporary)
  app.delete("/api/admin/cleanup-orphaned-user", async (req, res) => {
    try {
      const { email, adminSecret } = req.body;
      
      // Simple protection - require admin secret
      if (adminSecret !== process.env.SESSION_SECRET) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }
      
      console.log(`🧹 Cleaning up ALL data for email: ${email}`);
      
      // Delete ALL invitations for this email
      try {
        const invResult = await db.delete(invitations).where(eq(invitations.email, email.toLowerCase().trim()));
        console.log(`🧹 Deleted from invitations`);
      } catch (e: any) {
        console.error(`❌ Error deleting from invitations:`, e.message);
      }
      
      // Find ALL users in app_users by email (there could be multiple)
      const users = await db.select().from(appUsers).where(eq(appUsers.email, email));
      console.log(`🧹 Found ${users.length} user(s) with email: ${email}`);
      
      for (const user of users) {
        console.log(`🧹 Processing user: ${user.id}, role: ${user.role}, accountId: ${user.accountId}`);
        
        // Delete from organization_members first
        try {
          await db.delete(organizationMembers).where(eq(organizationMembers.userId, user.id));
          console.log(`🧹 Deleted user ${user.id} from organization_members`);
        } catch (e: any) {
          console.error(`❌ Error deleting from organization_members:`, e.message);
        }
        
        // Delete from app_users
        try {
          await db.delete(appUsers).where(eq(appUsers.id, user.id));
          console.log(`🧹 Deleted user ${user.id} from app_users`);
        } catch (e: any) {
          console.error(`❌ Error deleting from app_users:`, e.message);
        }
      }
      
      // Also try to delete from Supabase Auth if still exists
      await deleteSupabaseAuthUserByEmail(email);
      
      console.log(`✅ Full cleanup complete for ${email}`);
      res.json({ success: true, message: `Toutes les données supprimées pour ${email}` });
    } catch (error: any) {
      console.error(`❌ Cleanup error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update user profile type (for onboarding)
  app.patch("/api/me/profile-type", requireAuth, async (req, res) => {
    try {
      console.log("📝 Profile type update request:", { userId: req.userId, body: req.body });
      const { profileType } = req.body;
      const validTypes = ['freelance', 'designer', 'pm', 'project_manager', 'cto', 'developer'];
      
      if (!profileType || !validTypes.includes(profileType)) {
        console.log("❌ Invalid profile type:", profileType);
        return res.status(400).json({ error: "Type de profil invalide" });
      }

      // Get current user to merge with existing profile
      const user = await storage.getUser(req.userId!);
      if (!user) {
        console.log("❌ User not found:", req.userId);
        return res.status(404).json({ error: "User not found" });
      }

      // Merge new profileType with existing profile data
      const updatedProfile = {
        ...(typeof user.profile === 'object' && user.profile !== null ? user.profile : {}),
        type: profileType,
      };

      console.log("📝 Updating profile for user:", req.userId, "->", updatedProfile);
      
      // Update user with new profile
      await db.update(appUsers)
        .set({ profile: updatedProfile, updatedAt: new Date() })
        .where(eq(appUsers.id, req.userId!));

      console.log("✅ Profile updated successfully for user:", req.userId);
      res.json({ success: true, profileType });
    } catch (error: any) {
      console.error("❌ Profile update error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Get comprehensive user context (org + membership + permissions + views)
  app.get("/api/me/context", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const userId = req.userId!;
      const accountId = req.accountId!;
      
      // Get user and account info
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const account = await storage.getAccount(accountId);
      
      // Get organization membership
      const member = await permissionService.getMemberByUserAndOrg(userId, accountId);
      
      // Get permissions matrix
      let permissionsMatrix: Record<string, Record<string, boolean>> = {};
      let moduleViews: Record<string, any> = {};
      
      if (member) {
        // Get full permissions matrix
        permissionsMatrix = await permissionService.getFullPermissionMatrix(accountId, member.id);
        
        // Get module views for all modules
        const { RBAC_MODULES } = await import("@shared/schema");
        for (const mod of RBAC_MODULES) {
          const view = await permissionService.getModuleView(member.id, mod);
          if (view) {
            moduleViews[mod] = {
              layout: view.layout,
              subviewsEnabled: view.subviewsEnabled,
            };
          }
        }
      }
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
        },
        organization: account ? {
          id: account.id,
          name: account.name,
          plan: account.plan,
        } : null,
        membership: member ? {
          id: member.id,
          role: member.role,
          status: member.status,
        } : null,
        permissions: permissionsMatrix,
        moduleViews,
      });
    } catch (error: any) {
      console.error("Error fetching user context:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // USER ONBOARDING
  // ============================================

  // Get current user's onboarding state
  app.get("/api/onboarding", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const result = await db.select().from(userOnboarding).where(eq(userOnboarding.userId, userId)).limit(1);
      
      if (result.length === 0) {
        // Create new onboarding record for this user
        const newRecord = await db.insert(userOnboarding).values({ 
          userId, 
          version: "v1" 
        }).returning();
        return res.json(newRecord[0]);
      }
      
      res.json(result[0]);
    } catch (error: any) {
      console.error("Error fetching onboarding state:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update onboarding progress (last step)
  app.post("/api/onboarding/progress", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { lastStep } = req.body;
      
      await db.update(userOnboarding)
        .set({ lastStep, updatedAt: new Date() })
        .where(eq(userOnboarding.userId, userId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating onboarding progress:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark onboarding as completed
  app.post("/api/onboarding/complete", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      
      await db.update(userOnboarding)
        .set({ 
          completed: true, 
          completedAt: new Date(), 
          updatedAt: new Date() 
        })
        .where(eq(userOnboarding.userId, userId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reset onboarding (for testing or restart)
  app.post("/api/onboarding/reset", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      
      await db.update(userOnboarding)
        .set({ 
          completed: false, 
          completedAt: null, 
          lastStep: null, 
          skipped: false, 
          version: "v1", // Ensure version is set for overlay to activate
          updatedAt: new Date() 
        })
        .where(eq(userOnboarding.userId, userId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error resetting onboarding:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Skip onboarding
  app.post("/api/onboarding/skip", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      
      await db.update(userOnboarding)
        .set({ 
          skipped: true, 
          updatedAt: new Date() 
        })
        .where(eq(userOnboarding.userId, userId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error skipping onboarding:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const data = insertAppUserSchema.parse(req.body);
      const user = await storage.createUser(data);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/accounts/:accountId/users", async (req, res) => {
    try {
      const users = await storage.getUsersByAccountId(req.params.accountId);
      res.json(users);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Admin endpoint to reset user password (for debugging purposes)
  app.patch("/api/admin/reset-password", requireAuth, requireRole('owner'), async (req, res) => {
    try {
      const { userId, newPassword } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "L'ID de l'utilisateur est requis" });
      }
      
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" });
      }

      // Security: Verify the target user belongs to the same account
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      
      if (targetUser.accountId !== req.accountId) {
        return res.status(403).json({ error: "Vous n'avez pas les permissions pour réinitialiser ce mot de passe" });
      }

      // Update password using Supabase Auth Admin API
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.json({ success: true, message: "Mot de passe réinitialisé avec succès" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // CLIENTS (CRM) - Protected Routes
  // ============================================

  app.get("/api/clients", requireAuth, requireOrgMember, requirePermission("crm", "read", "crm.clients"), async (req, res) => {
    try {
      const clients = await storage.getClientsByAccountId(req.accountId!);
      res.json(clients);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/clients", requireAuth, requireOrgMember, requirePermission("crm", "create", "crm.clients"), async (req, res) => {
    try {
      console.log("[DEBUG] Creating client - req.userId:", req.userId, "req.accountId:", req.accountId);
      console.log("[DEBUG] Request body:", JSON.stringify(req.body, null, 2));
      
      const data = insertClientSchema.parse({
        ...req.body,
        accountId: req.accountId!, // Force accountId from auth context
        createdBy: req.userId || req.body.createdBy,
      });
      console.log("[DEBUG] Parsed data:", JSON.stringify(data, null, 2));
      const client = await storage.createClient(data);
      
      // Create activity
      await storage.createActivity({
        accountId: req.accountId!,
        subjectType: "client",
        subjectId: client.id,
        kind: "created",
        payload: { description: `New client onboarded: ${data.name}` },
        createdBy: req.userId || null,
      });

      res.json(client);
    } catch (error: any) {
      console.error("[ERROR] Failed to create client:", error);
      console.error("[ERROR] Error message:", error.message);
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/clients/:id", requireAuth, requireOrgMember, requirePermission("crm", "read", "crm.clients"), async (req, res) => {
    try {
      const client = await storage.getClient(req.accountId!, req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/clients/:id", requireAuth, requireOrgMember, requirePermission("crm", "update", "crm.clients"), async (req, res) => {
    try {
      const client = await storage.updateClient(req.accountId!, req.params.id, req.body);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/clients/:id", requireAuth, requireOrgMember, requirePermission("crm", "delete", "crm.clients"), async (req, res) => {
    try {
      const success = await storage.deleteClient(req.accountId!, req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get clients by account ID (for frontend queries)
  app.get("/api/accounts/:accountId/clients", requireAuth, requireOrgMember, requirePermission("crm", "read", "crm.clients"), async (req, res) => {
    try {
      // Verify user has access to this account
      if (req.params.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied to this account" });
      }
      const clients = await storage.getClientsByAccountId(req.params.accountId);
      res.json(clients);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // AI suggestion for client next actions
  app.post("/api/clients/:id/suggest-actions", requireAuth, requireOrgMember, requirePermission("crm", "read", "crm.clients"), async (req, res) => {
    try {
      const client = await storage.getClient(req.accountId!, req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      const history = `Client: ${client.name}, Type: ${client.type}, Status: ${client.status}, Budget: ${client.budget}`;
      const suggestions = await suggestNextActions(history);
      
      res.json({ suggestions });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // CONTACTS - Protected Routes
  // ============================================

  app.get("/api/contacts", requireAuth, requireOrgMember, requirePermission("crm", "read", "crm.clients"), async (req, res) => {
    try {
      const contacts = await storage.getContactsByAccountId(req.accountId!);
      res.json(contacts);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/clients/:clientId/contacts", requireAuth, requireOrgMember, requirePermission("crm", "read", "crm.clients"), async (req, res) => {
    try {
      // First verify the client belongs to this account (security check)
      const client = await storage.getClient(req.accountId!, req.params.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      const contacts = await storage.getContactsByClientId(req.accountId!, req.params.clientId);
      res.json(contacts);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/contacts", requireAuth, requireOrgMember, requirePermission("crm", "create", "crm.clients"), async (req, res) => {
    try {
      const data = insertContactSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      const contact = await storage.createContact(data);
      res.json(contact);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/contacts/:id", requireAuth, requireOrgMember, requirePermission("crm", "read", "crm.clients"), async (req, res) => {
    try {
      const contact = await storage.getContact(req.accountId!, req.params.id);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/contacts/:id", requireAuth, requireOrgMember, requirePermission("crm", "update", "crm.clients"), async (req, res) => {
    try {
      const contact = await storage.updateContact(req.accountId!, req.params.id, req.body);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/contacts/:id", requireAuth, requireOrgMember, requirePermission("crm", "delete", "crm.clients"), async (req, res) => {
    try {
      const success = await storage.deleteContact(req.accountId!, req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get contacts by account ID (for frontend queries)
  app.get("/api/accounts/:accountId/contacts", requireAuth, requireOrgMember, requirePermission("crm", "read", "crm.clients"), async (req, res) => {
    try {
      // Verify user has access to this account
      if (req.params.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied to this account" });
      }
      const contacts = await storage.getContactsByAccountId(req.params.accountId);
      res.json(contacts);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // CLIENT COMMENTS - Protected Routes
  // ============================================

  app.get("/api/clients/:clientId/comments", requireAuth, requireOrgMember, requirePermission("crm", "read"), async (req, res) => {
    try {
      // First verify the client belongs to this account (security check)
      const client = await storage.getClient(req.accountId!, req.params.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      const comments = await storage.getClientComments(req.accountId!, req.params.clientId);
      res.json(comments);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/clients/:clientId/comments", requireAuth, requireOrgMember, requirePermission("crm", "create"), async (req, res) => {
    try {
      // First verify the client belongs to this account (security check)
      const client = await storage.getClient(req.accountId!, req.params.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const data = insertClientCommentSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        clientId: req.params.clientId,
        createdBy: req.userId!,
      });
      const comment = await storage.createClientComment(data);
      
      // Create activity for comment
      await storage.createActivity({
        accountId: req.accountId!,
        subjectType: "client",
        subjectId: req.params.clientId,
        kind: "note",
        payload: { description: "Commentaire ajouté", commentId: comment.id },
        createdBy: req.userId || null,
      });
      
      res.json(comment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/clients/:clientId/comments/:commentId", requireAuth, requireOrgMember, requirePermission("crm", "delete"), async (req, res) => {
    try {
      // First verify the client belongs to this account (security check)
      const client = await storage.getClient(req.accountId!, req.params.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      await storage.deleteClientComment(req.accountId!, req.params.commentId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // CLIENT CUSTOM TABS & FIELDS - Protected Routes
  // ============================================

  app.get("/api/client-custom-tabs", requireAuth, async (req, res) => {
    try {
      const tabs = await storage.getClientCustomTabsByAccountId(req.accountId!);
      res.json(tabs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/client-custom-tabs", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const data = insertClientCustomTabSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId!,
      });
      const tab = await storage.createClientCustomTab(data);
      res.json(tab);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/client-custom-tabs/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const data = updateClientCustomTabSchema.parse(req.body);
      const tab = await storage.updateClientCustomTab(req.accountId!, req.params.id, data);
      if (!tab) {
        return res.status(404).json({ error: "Tab not found" });
      }
      res.json(tab);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/client-custom-tabs/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const success = await storage.deleteClientCustomTab(req.accountId!, req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Tab not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/client-custom-fields", requireAuth, async (req, res) => {
    try {
      const fields = await storage.getClientCustomFieldsByAccountId(req.accountId!);
      res.json(fields);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/client-custom-fields", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const tabFields = await storage.getClientCustomFieldsByTabId(req.accountId!, req.body.tabId);
      const maxOrder = tabFields.length > 0 ? Math.max(...tabFields.map((f: ClientCustomField) => f.order)) : -1;
      
      const data = insertClientCustomFieldSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId!,
        order: maxOrder + 1,
      });
      const field = await storage.createClientCustomField(data);
      res.json(field);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/client-custom-tabs/:tabId/fields", requireAuth, async (req, res) => {
    try {
      const fields = await storage.getClientCustomFieldsByTabId(req.accountId!, req.params.tabId);
      res.json(fields);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/client-custom-tabs/:tabId/fields", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const data = insertClientCustomFieldSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        tabId: req.params.tabId,
        createdBy: req.userId!,
      });
      const field = await storage.createClientCustomField(data);
      res.json(field);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/client-custom-fields/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const data = updateClientCustomFieldSchema.parse(req.body);
      const field = await storage.updateClientCustomField(req.accountId!, req.params.id, data);
      if (!field) {
        return res.status(404).json({ error: "Field not found" });
      }
      res.json(field);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/client-custom-fields/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const success = await storage.deleteClientCustomField(req.accountId!, req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Field not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/clients/:clientId/field-values", requireAuth, requireOrgMember, requirePermission("crm", "read"), async (req, res) => {
    try {
      const client = await storage.getClient(req.accountId!, req.params.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      const values = await storage.getClientCustomFieldValues(req.accountId!, req.params.clientId);
      res.json(values);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/clients/:clientId/field-values", requireAuth, requireOrgMember, requirePermission("crm", "create"), async (req, res) => {
    try {
      const client = await storage.getClient(req.accountId!, req.params.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      const data = insertClientCustomFieldValueSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        clientId: req.params.clientId,
      });
      const value = await storage.upsertClientCustomFieldValue(data);
      res.json(value);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // PROJECTS - Protected Routes
  // ============================================

  app.get("/api/projects", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const projects = await storage.getProjectsByAccountId(req.accountId!);
      res.json(projects);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/projects", requireAuth, requireOrgMember, requirePermission("projects", "create"), async (req, res) => {
    try {
      console.log("[DEBUG] Creating project - req.userId:", req.userId, "req.accountId:", req.accountId);
      console.log("[DEBUG] Request body:", JSON.stringify(req.body, null, 2));
      
      // Intelligent enrichment based on project name and category
      const { inferProjectConfiguration } = await import("./services/projectEnrichmentService");
      const enrichment = inferProjectConfiguration(req.body.name || '', req.body.category);
      console.log("[DEBUG] Project enrichment:", JSON.stringify(enrichment, null, 2));
      
      const data = insertProjectSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
        // Auto-enriched fields
        projectTypeInferred: enrichment.projectTypeInferred,
        billingModeSuggested: enrichment.billingModeSuggested,
        pilotingStrategy: enrichment.pilotingStrategy,
        expectedPhases: enrichment.expectedPhases,
        expectedScopeTypes: enrichment.expectedScopeTypes,
      });
      console.log("[DEBUG] Parsed data:", JSON.stringify(data, null, 2));
      const project = await storage.createProject(data);
      
      // Create default task columns for new project
      const defaultColumns = [
        { name: "À faire", color: "rgba(240, 240, 242, 0.9)", order: 0, isLocked: 1 },  // Gris clair
        { name: "En cours", color: "rgba(240, 248, 255, 0.9)", order: 1, isLocked: 0 }, // Bleu pastel très doux
        { name: "Terminé", color: "rgba(240, 255, 245, 0.9)", order: 2, isLocked: 1 },  // Vert pastel très doux
      ];
      
      for (const column of defaultColumns) {
        await storage.createTaskColumn({
          accountId: req.accountId!,
          projectId: project.id,
          name: column.name,
          color: column.color,
          order: column.order,
          isLocked: column.isLocked,
        });
      }
      
      // Create activity
      await storage.createActivity({
        accountId: req.accountId!,
        subjectType: "project",
        subjectId: project.id,
        kind: "created",
        payload: { description: `Project created: ${project.name}` },
        createdBy: req.userId || null,
      });

      res.json(project);
    } catch (error: any) {
      console.error("[ERROR] Failed to create project:", error);
      console.error("[ERROR] Error message:", error.message);
      if (error.issues) {
        console.error("[ERROR] Zod validation issues:", JSON.stringify(error.issues, null, 2));
      }
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get related data
      const [client, tasks] = await Promise.all([
        project.clientId ? storage.getClient(req.accountId!, project.clientId) : null,
        storage.getTasksByProjectId(project.id),
      ]);

      res.json({
        ...project,
        client,
        tasks,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id/notes", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const notes = await storage.getNotesByProjectId(req.params.id);
      res.json(notes);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id/documents", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const documents = await storage.getDocumentsByProjectId(req.params.id);
      res.json(documents);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:id", requireAuth, requireOrgMember, requirePermission("projects", "update"), async (req, res) => {
    try {
      const existing = await storage.getProject(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Validate update data (allow any subset of fields)
      const validatedData = updateProjectSchema.parse(req.body);
      const project = await storage.updateProject(req.params.id, validatedData);

      // Create activity
      await storage.createActivity({
        accountId: req.accountId!,
        subjectType: "project",
        subjectId: project!.id,
        kind: "updated",
        payload: { description: `Project updated: ${project!.name}` },
        createdBy: req.userId || null,
      });

      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id", requireAuth, requireOrgMember, requirePermission("projects", "delete"), async (req, res) => {
    try {
      const existing = await storage.getProject(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get projects by account ID (for frontend queries)
  app.get("/api/accounts/:accountId/projects", requireAuth, async (req, res) => {
    try {
      // Verify user has access to this account
      if (req.params.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied to this account" });
      }
      const projects = await storage.getProjectsByAccountId(req.params.accountId);
      res.json(projects);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // PROJECT CATEGORIES - Protected Routes
  // ============================================

  // Get all project categories for the authenticated account
  app.get("/api/project-categories", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const categories = await storage.getProjectCategoriesByAccountId(req.accountId!);
      res.json(categories);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new project category (or return existing one if name already exists)
  app.post("/api/project-categories", requireAuth, requireOrgMember, requirePermission("projects", "create"), async (req, res) => {
    try {
      const { name, projectType } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Category name is required" });
      }

      const trimmedName = name.trim();

      // Try to create new category, let database handle uniqueness
      try {
        const category = await storage.createProjectCategory({
          accountId: req.accountId!,
          name: trimmedName,
          projectType: projectType || null,
        });
        res.json(category);
      } catch (dbError: any) {
        // If unique constraint violation, fetch the existing category by normalized name
        if (dbError.code === '23505' || dbError.message?.includes('duplicate')) {
          const existing = await storage.getProjectCategoryByNormalizedName(req.accountId!, trimmedName);
          if (existing) {
            return res.json(existing);
          }
        }
        throw dbError;
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update a project category (to set/update projectType)
  app.patch("/api/project-categories/:categoryId", requireAuth, requireOrgMember, requirePermission("projects", "update"), async (req, res) => {
    try {
      const { categoryId } = req.params;
      const accountId = req.accountId!;
      
      // Validate input with Zod
      const updateSchema = z.object({
        projectType: z.string().nullable().optional(),
      });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      const updated = await storage.updateProjectCategory(categoryId, accountId, {
        projectType: parsed.data.projectType ?? null,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // PROJECT PAYMENTS - Protected Routes
  // ============================================

  // Get all payments for the account
  app.get("/api/payments", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const payments = await storage.getPaymentsByAccountId(req.accountId!);
      res.json(payments);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all payments for a project
  app.get("/api/projects/:projectId/payments", requireAuth, requireOrgMember, requirePermission("projects", "read", "projects.billing"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const payments = await storage.getPaymentsByProjectId(req.params.projectId);
      
      // Calculate totals for convenience
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
      const budget = parseFloat(project.budget || "0");
      const remainingAmount = Math.max(0, budget - totalPaid);
      
      res.json({
        payments,
        totalPaid,
        remainingAmount,
        budget,
        billingStatus: project.billingStatus,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new payment
  app.post("/api/projects/:projectId/payments", requireAuth, requireOrgMember, requirePermission("projects", "create", "projects.billing"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const payment = await storage.createPayment({
        ...req.body,
        accountId: req.accountId!,
        projectId: req.params.projectId,
        createdBy: req.userId!,
      });

      // Get all payments for this project to calculate total paid
      const payments = await storage.getPaymentsByProjectId(req.params.projectId);
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
      const budget = parseFloat(project.budget || "0");

      // Auto-update billing status based on payment progress
      let newBillingStatus = project.billingStatus;
      if (budget > 0) {
        if (totalPaid >= budget) {
          newBillingStatus = "paye";
        } else if (totalPaid > 0) {
          newBillingStatus = "partiel";
        }
      }

      // Update project billing status if it changed
      if (newBillingStatus !== project.billingStatus) {
        await storage.updateProject(project.id, { billingStatus: newBillingStatus });
      }

      res.json({ payment, totalPaid, billingStatus: newBillingStatus });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update a payment
  app.patch("/api/payments/:paymentId", requireAuth, requireOrgMember, requirePermission("projects", "update"), async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.paymentId);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      if (payment.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updatedPayment = await storage.updatePayment(req.params.paymentId, req.body);

      // Recalculate billing status
      const payments = await storage.getPaymentsByProjectId(payment.projectId);
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
      const project = await storage.getProject(payment.projectId);
      const budget = parseFloat(project?.budget || "0");

      let newBillingStatus = project?.billingStatus;
      if (budget > 0) {
        if (totalPaid >= budget) {
          newBillingStatus = "paye";
        } else if (totalPaid > 0) {
          newBillingStatus = "partiel";
        }
      }

      if (project && newBillingStatus !== project.billingStatus) {
        await storage.updateProject(project.id, { billingStatus: newBillingStatus });
      }

      res.json({ payment: updatedPayment, totalPaid, billingStatus: newBillingStatus });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a payment
  app.delete("/api/payments/:paymentId", requireAuth, requireOrgMember, requirePermission("projects", "delete"), async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.paymentId);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      if (payment.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deletePayment(req.params.paymentId);

      // Recalculate billing status after deletion
      const payments = await storage.getPaymentsByProjectId(payment.projectId);
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
      const project = await storage.getProject(payment.projectId);
      const budget = parseFloat(project?.budget || "0");

      let newBillingStatus = project?.billingStatus;
      if (budget > 0) {
        if (totalPaid >= budget) {
          newBillingStatus = "paye";
        } else if (totalPaid > 0) {
          newBillingStatus = "partiel";
        } else {
          // Reset to previous status if no payments (keep current if set)
          if (project?.billingStatus === "paye" || project?.billingStatus === "partiel") {
            newBillingStatus = "facture"; // Reset to "facture" if we had payments before
          }
        }
      }

      if (project && newBillingStatus !== project.billingStatus) {
        await storage.updateProject(project.id, { billingStatus: newBillingStatus });
      }

      res.json({ success: true, totalPaid, billingStatus: newBillingStatus });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // PROJECT SCOPE ITEMS (CDC) - Protected Routes
  // ============================================

  // Get all scope items for a project
  app.get("/api/projects/:projectId/scope-items", requireAuth, requireOrgMember, requirePermission("projects", "read", "projects.scope"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const scopeItems = await storage.getScopeItemsByProjectId(req.params.projectId);
      
      // Calculate totals
      const mandatoryItems = scopeItems.filter(item => item.isOptional === 0);
      const optionalItems = scopeItems.filter(item => item.isOptional === 1);
      
      const totalMandatoryDays = mandatoryItems.reduce((sum, item) => sum + parseFloat(item.estimatedDays || "0"), 0);
      const totalOptionalDays = optionalItems.reduce((sum, item) => sum + parseFloat(item.estimatedDays || "0"), 0);
      const totalDays = totalMandatoryDays + totalOptionalDays;
      
      // Calculate costs using project's internal cost and TJM
      const internalDailyCost = parseFloat(project.internalDailyCost?.toString() || "0");
      const dailyRate = parseFloat(project.dailyRate?.toString() || "0");
      
      const estimatedCost = totalMandatoryDays * internalDailyCost;
      const recommendedPrice = totalMandatoryDays * dailyRate;
      const estimatedMargin = recommendedPrice - estimatedCost;
      const marginPercent = recommendedPrice > 0 ? (estimatedMargin / recommendedPrice) * 100 : 0;
      
      res.json({
        scopeItems,
        totals: {
          mandatoryDays: totalMandatoryDays,
          optionalDays: totalOptionalDays,
          totalDays,
          estimatedCost,
          recommendedPrice,
          estimatedMargin,
          marginPercent,
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new scope item
  app.post("/api/projects/:projectId/scope-items", requireAuth, requireOrgMember, requirePermission("projects", "create", "projects.scope"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get current items to determine next order
      const existingItems = await storage.getScopeItemsByProjectId(req.params.projectId);
      const maxOrder = existingItems.length > 0 ? Math.max(...existingItems.map(i => i.order || 0)) : -1;

      const scopeItem = await storage.createScopeItem({
        ...req.body,
        accountId: req.accountId!,
        projectId: req.params.projectId,
        order: maxOrder + 1,
      });

      res.json(scopeItem);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update a scope item
  app.patch("/api/scope-items/:itemId", requireAuth, requireOrgMember, requirePermission("projects", "update"), async (req, res) => {
    try {
      const scopeItem = await storage.getScopeItem(req.params.itemId);
      if (!scopeItem) {
        return res.status(404).json({ error: "Scope item not found" });
      }
      if (scopeItem.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updatedItem = await storage.updateScopeItem(req.params.itemId, req.body);
      res.json(updatedItem);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a scope item
  app.delete("/api/scope-items/:itemId", requireAuth, requireOrgMember, requirePermission("projects", "delete"), async (req, res) => {
    try {
      const scopeItem = await storage.getScopeItem(req.params.itemId);
      if (!scopeItem) {
        return res.status(404).json({ error: "Scope item not found" });
      }
      if (scopeItem.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteScopeItem(req.params.itemId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Reorder scope items
  app.post("/api/projects/:projectId/scope-items/reorder", requireAuth, requireOrgMember, requirePermission("projects", "update", "projects.scope"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { orders } = req.body;
      if (!orders || !Array.isArray(orders)) {
        return res.status(400).json({ error: "Orders array required" });
      }

      await storage.reorderScopeItems(req.params.projectId, orders);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Complete a scope item (mark as terminated)
  app.post("/api/scope-items/:itemId/complete", requireAuth, requireOrgMember, requirePermission("projects", "update"), async (req, res) => {
    try {
      const scopeItem = await storage.getScopeItem(req.params.itemId);
      if (!scopeItem) {
        return res.status(404).json({ error: "Scope item not found" });
      }
      if (scopeItem.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updatedItem = await storage.updateScopeItem(req.params.itemId, {
        completedAt: new Date(),
      });
      res.json(updatedItem);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Reopen a scope item (remove completion)
  app.post("/api/scope-items/:itemId/reopen", requireAuth, requireOrgMember, requirePermission("projects", "update"), async (req, res) => {
    try {
      const scopeItem = await storage.getScopeItem(req.params.itemId);
      if (!scopeItem) {
        return res.status(404).json({ error: "Scope item not found" });
      }
      if (scopeItem.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updatedItem = await storage.updateScopeItem(req.params.itemId, {
        completedAt: null,
      });
      res.json(updatedItem);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // CDC SESSIONS - Cahier des Charges (Project Scoping)
  // ============================================

  // Get all CDC sessions for a project
  app.get("/api/projects/:projectId/cdc-sessions", requireAuth, requireOrgMember, requirePermission("projects", "read", "projects.scope"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const sessions = await storage.getCdcSessionsByProjectId(req.params.projectId);
      res.json(sessions);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get active/current CDC session for a project (most recent non-completed)
  app.get("/api/projects/:projectId/cdc-sessions/active", requireAuth, requireOrgMember, requirePermission("projects", "read", "projects.scope"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const session = await storage.getActiveCdcSessionByProjectId(req.params.projectId);
      if (!session) {
        return res.status(404).json({ error: "No active CDC session" });
      }
      
      // Also get the scope items for this session
      const scopeItems = await storage.getScopeItemsByCdcSessionId(session.id);
      res.json({ ...session, scopeItems });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get a specific CDC session
  app.get("/api/cdc-sessions/:sessionId", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const session = await storage.getCdcSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "CDC session not found" });
      }
      
      // Check access via project
      const project = await storage.getProject(session.projectId);
      if (!project || project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Also get the scope items for this session
      const scopeItems = await storage.getScopeItemsByCdcSessionId(session.id);
      res.json({ ...session, scopeItems });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new CDC session (or return existing active session)
  app.post("/api/projects/:projectId/cdc-sessions", requireAuth, requireOrgMember, requirePermission("projects", "create", "projects.scope"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check for existing active session first
      const existingSession = await storage.getActiveCdcSessionByProjectId(req.params.projectId);
      if (existingSession) {
        const scopeItems = await storage.getScopeItemsByCdcSessionId(existingSession.id);
        return res.json({ ...existingSession, scopeItems });
      }

      // Create new session
      const validatedData = insertCdcSessionSchema.parse({
        accountId: req.accountId!,
        projectId: req.params.projectId,
        createdBy: req.userId!,
        status: 'draft',
        currentStep: 1,
      });

      const session = await storage.createCdcSession(validatedData);
      
      // Load existing project scope items (without cdcSessionId) and link them to this session
      const existingItems = await storage.getScopeItemsByProjectId(req.params.projectId);
      const orphanItems = existingItems.filter(item => !item.cdcSessionId);
      
      for (const item of orphanItems) {
        await storage.updateScopeItem(item.id, { cdcSessionId: session.id });
      }
      
      // Fetch and return the session with its items
      const scopeItems = await storage.getScopeItemsByCdcSessionId(session.id);
      res.json({ ...session, scopeItems });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update a CDC session (step progression, status)
  app.patch("/api/cdc-sessions/:sessionId", requireAuth, requireOrgMember, requirePermission("projects", "update"), async (req, res) => {
    try {
      const session = await storage.getCdcSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "CDC session not found" });
      }
      
      const project = await storage.getProject(session.projectId);
      if (!project || project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const validatedData = updateCdcSessionSchema.parse(req.body);
      const updatedSession = await storage.updateCdcSession(req.params.sessionId, validatedData);
      res.json(updatedSession);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a CDC session
  app.delete("/api/cdc-sessions/:sessionId", requireAuth, requireOrgMember, requirePermission("projects", "delete"), async (req, res) => {
    try {
      const session = await storage.getCdcSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "CDC session not found" });
      }
      
      const project = await storage.getProject(session.projectId);
      if (!project || project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteCdcSession(req.params.sessionId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create scope item within a CDC session
  app.post("/api/cdc-sessions/:sessionId/scope-items", requireAuth, requireOrgMember, requirePermission("projects", "create"), async (req, res) => {
    try {
      const session = await storage.getCdcSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "CDC session not found" });
      }
      
      const project = await storage.getProject(session.projectId);
      if (!project || project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get current items to determine next order
      const existingItems = await storage.getScopeItemsByCdcSessionId(req.params.sessionId);
      const maxOrder = existingItems.length > 0 ? Math.max(...existingItems.map(i => i.order || 0)) : -1;

      const validatedData = insertProjectScopeItemSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        projectId: session.projectId,
        cdcSessionId: session.id,
        order: maxOrder + 1,
      });

      const scopeItem = await storage.createScopeItem(validatedData);
      res.json(scopeItem);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get scope items for a CDC session
  app.get("/api/cdc-sessions/:sessionId/scope-items", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const session = await storage.getCdcSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "CDC session not found" });
      }
      
      const project = await storage.getProject(session.projectId);
      if (!project || project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const scopeItems = await storage.getScopeItemsByCdcSessionId(req.params.sessionId);
      res.json(scopeItems);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Complete CDC session and trigger generation
  app.post("/api/cdc-sessions/:sessionId/complete", requireAuth, requireOrgMember, requirePermission("projects", "update"), async (req, res) => {
    try {
      const session = await storage.getCdcSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "CDC session not found" });
      }
      
      const project = await storage.getProject(session.projectId);
      if (!project || project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get all scope items for this session
      const scopeItems = await storage.getScopeItemsByCdcSessionId(req.params.sessionId);
      if (scopeItems.length === 0) {
        return res.status(400).json({ error: "Cannot complete session with no scope items" });
      }

      // Generate backlog, roadmap, OKRs, and resources from scope items
      const { generateBacklogFromCdc, generateRoadmapFromCdc, generateOkrFromCdc } = await import("./services/cdcGenerationService");
      
      const { generateBacklog = true, generateRoadmap = true, generateOkr = false, generateResources = true } = req.body;
      
      let generatedBacklogId: string | undefined;
      let generatedRoadmapId: string | undefined;
      let generatedOkrObjectivesCount: number = 0;
      let generatedResourcesCount: number = 0;

      if (generateBacklog) {
        generatedBacklogId = await generateBacklogFromCdc(
          req.accountId!,
          session.projectId,
          scopeItems,
          req.userId!,
          session.id // Pass CDC session ID to link EPICs to CDC
        );
      }

      if (generateRoadmap) {
        generatedRoadmapId = await generateRoadmapFromCdc(
          req.accountId!,
          session.projectId,
          scopeItems,
          req.userId!
        );
      }

      if (generateOkr) {
        generatedOkrObjectivesCount = await generateOkrFromCdc(
          req.accountId!,
          session.projectId,
          project.projectType || 'autre',
          req.userId!
        );
      }

      // Generate project resources from templates based on project type
      if (generateResources) {
        try {
          // Resolve the project type: first from project field, then from category lookup
          let resolvedProjectType: string | null = project.projectTypeInferred || null;
          console.log(`[CDC Resources] Project ${project.name}: projectTypeInferred=${project.projectTypeInferred}, category=${project.category}`);
          
          // If no projectTypeInferred, try to get it from the project's category
          if (!resolvedProjectType && project.category) {
            const categoryRecord = await storage.getProjectCategoryByNormalizedName(req.accountId!, project.category);
            console.log(`[CDC Resources] Category lookup for "${project.category}":`, categoryRecord ? `found with projectType=${categoryRecord.projectType}` : 'not found');
            if (categoryRecord?.projectType) {
              resolvedProjectType = categoryRecord.projectType;
            }
          }
          
          console.log(`[CDC Resources] Resolved project type: ${resolvedProjectType}`);
          
          // Check if resources already exist for this project (idempotency check)
          const existingResources = await db.select({ id: projectResources.id })
            .from(projectResources)
            .where(and(
              eq(projectResources.accountId, req.accountId!),
              eq(projectResources.projectId, session.projectId)
            ))
            .limit(1);
          
          // Skip resource generation if resources already exist
          if (existingResources.length === 0) {
            // Fetch resource templates: specific projectType OR global (null)
            let templates;
            if (resolvedProjectType) {
              templates = await db.select().from(resourceTemplates)
                .where(and(
                  eq(resourceTemplates.accountId, req.accountId!),
                  sql`(${resourceTemplates.projectType} = ${resolvedProjectType} OR ${resourceTemplates.projectType} IS NULL)`
                ));
            } else {
              // No project type - use only global templates (projectType IS NULL)
              templates = await db.select().from(resourceTemplates)
                .where(and(
                  eq(resourceTemplates.accountId, req.accountId!),
                  sql`${resourceTemplates.projectType} IS NULL`
                ));
            }
            
            console.log(`[CDC Resources] Found ${templates.length} templates for projectType="${resolvedProjectType}" or global`);
            
            // Create project resources from templates
            for (const template of templates) {
              await db.insert(projectResources).values({
                accountId: req.accountId!,
                projectId: session.projectId,
                templateId: template.id,
                name: template.name,
                description: template.description,
                type: template.type,
                profileType: template.profileType,
                mode: template.mode,
                dailyCostInternal: template.dailyCostInternal,
                dailyRateBilled: template.dailyRateBilled,
                capacity: template.defaultCapacity,
                category: template.category,
                costType: template.costType,
                amount: template.defaultAmount,
                isBillable: template.isBillable,
                status: 'active',
              });
              generatedResourcesCount++;
            }
          }
        } catch (resourceError) {
          console.error("Error generating resources:", resourceError);
          // Don't fail the whole operation if resource generation fails
        }
      }

      // Complete the session with generated references
      const completedSession = await storage.completeCdcSession(
        req.params.sessionId,
        generatedBacklogId,
        generatedRoadmapId
      );

      // Create project baseline from scope items
      const byType: Record<string, number> = {};
      const byPhase: Record<string, number> = {};
      let totalEstimated = 0;
      let billableEstimated = 0;
      let nonBillableEstimated = 0;

      scopeItems.forEach(item => {
        const days = parseFloat(item.estimatedDays?.toString() || '0');
        totalEstimated += days;
        
        if (item.isBillable === 1) {
          billableEstimated += days;
        } else {
          nonBillableEstimated += days;
        }

        // Group by type
        const type = item.scopeType || 'autre';
        byType[type] = (byType[type] || 0) + days;

        // Group by phase
        const phase = item.phase || 'LT';
        byPhase[phase] = (byPhase[phase] || 0) + days;
      });

      // Create baseline
      const baseline = await storage.createBaseline({
        accountId: req.accountId!,
        projectId: session.projectId,
        cdcSessionId: req.params.sessionId,
        totalEstimatedDays: totalEstimated.toString(),
        billableEstimatedDays: billableEstimated.toString(),
        nonBillableEstimatedDays: nonBillableEstimated.toString(),
        byType,
        byPhase,
        scopeItemsSnapshot: scopeItems,
        createdBy: req.userId!,
      });

      res.json({
        session: completedSession,
        generatedBacklogId,
        generatedRoadmapId,
        generatedOkrObjectivesCount,
        generatedResourcesCount,
        baseline,
      });
    } catch (error: any) {
      console.error("Error completing CDC session:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // PROJECT BASELINES - Protected Routes
  // ============================================

  // Get all baselines for a project
  app.get("/api/projects/:projectId/baselines", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const baselines = await storage.getBaselinesByProjectId(req.params.projectId);
      res.json(baselines);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get latest baseline for a project
  app.get("/api/projects/:projectId/baselines/latest", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const baseline = await storage.getLatestBaselineByProjectId(req.params.projectId);
      if (!baseline) {
        return res.status(404).json({ error: "No baseline found" });
      }
      res.json(baseline);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get project KPIs (estimated vs actual)
  app.get("/api/projects/:projectId/kpis", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get baseline
      const baseline = await storage.getLatestBaselineByProjectId(req.params.projectId);
      
      // Get time entries
      const timeEntries = await storage.getTimeEntriesByProjectId(req.accountId!, req.params.projectId);
      
      // Get scope items for breakdown
      const scopeItems = await storage.getScopeItemsByProjectId(req.params.projectId);

      // Calculate actual time spent
      let actualTotalSeconds = 0;
      let actualBillableSeconds = 0;
      let actualNonBillableSeconds = 0;
      const actualByType: Record<string, number> = {};
      const actualByPhase: Record<string, number> = {};

      timeEntries.forEach(entry => {
        const seconds = entry.duration || 0;
        actualTotalSeconds += seconds;
        
        if (entry.isBillable === 1) {
          actualBillableSeconds += seconds;
        } else {
          actualNonBillableSeconds += seconds;
        }

        // If linked to a scope item, group by its type and phase
        if (entry.scopeItemId) {
          const scopeItem = scopeItems.find(s => s.id === entry.scopeItemId);
          if (scopeItem) {
            const type = scopeItem.scopeType || 'autre';
            actualByType[type] = (actualByType[type] || 0) + seconds;
            
            const phase = scopeItem.phase || 'LT';
            actualByPhase[phase] = (actualByPhase[phase] || 0) + seconds;
          }
        }
      });

      // Convert seconds to days (8 hours = 1 day)
      const secondsToDays = (s: number) => s / (8 * 3600);

      const kpis = {
        hasBaseline: !!baseline,
        estimated: baseline ? {
          totalDays: parseFloat(baseline.totalEstimatedDays?.toString() || '0'),
          billableDays: parseFloat(baseline.billableEstimatedDays?.toString() || '0'),
          nonBillableDays: parseFloat(baseline.nonBillableEstimatedDays?.toString() || '0'),
          byType: baseline.byType as Record<string, number>,
          byPhase: baseline.byPhase as Record<string, number>,
        } : null,
        actual: {
          totalDays: secondsToDays(actualTotalSeconds),
          billableDays: secondsToDays(actualBillableSeconds),
          nonBillableDays: secondsToDays(actualNonBillableSeconds),
          byType: Object.fromEntries(
            Object.entries(actualByType).map(([k, v]) => [k, secondsToDays(v)])
          ),
          byPhase: Object.fromEntries(
            Object.entries(actualByPhase).map(([k, v]) => [k, secondsToDays(v)])
          ),
        },
        comparison: baseline ? {
          progressPercent: (secondsToDays(actualTotalSeconds) / parseFloat(baseline.totalEstimatedDays?.toString() || '1')) * 100,
          remainingDays: parseFloat(baseline.totalEstimatedDays?.toString() || '0') - secondsToDays(actualTotalSeconds),
          variance: secondsToDays(actualTotalSeconds) - parseFloat(baseline.totalEstimatedDays?.toString() || '0'),
        } : null,
      };

      res.json(kpis);
    } catch (error: any) {
      console.error("Error calculating KPIs:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // PROJECT PROFITABILITY - Protected Routes
  // ============================================

  // Get profitability analysis for a project
  app.get("/api/projects/:projectId/profitability", requireAuth, requireOrgMember, requirePermission("profitability", "read", "profitability.byProject"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get time entries for the project
      const timeEntries = await storage.getTimeEntriesByProjectId(req.accountId!, req.params.projectId);
      
      // Get payments for the project
      const payments = await storage.getPaymentsByProjectId(req.params.projectId);

      // Get global TJM from account settings
      const globalTJMSetting = await storage.getSetting('ACCOUNT', req.accountId!, 'billing.defaultTJM');
      const globalTJM = globalTJMSetting?.value ? parseFloat(String(globalTJMSetting.value)) : undefined;

      // Get resource costs for the project (non-simulation resources only, scoped by account)
      // Note: Supabase stores integer fields which Drizzle returns as numbers
      const resources = await db.select().from(projectResources)
        .where(and(
          eq(projectResources.projectId, req.params.projectId),
          eq(projectResources.accountId, req.accountId!),
          eq(projectResources.isSimulation, 0)
        ));
      
      // Calculate non-billable and billable resource costs
      // Note: Uses same calculation logic as resources summary endpoint for consistency
      let totalNonBillable = 0;
      let totalBillable = 0;
      
      // Safe parseFloat that handles null, undefined, empty strings and NaN
      const safeParseFloat = (value: string | number | null | undefined): number => {
        if (value === null || value === undefined || value === '') return 0;
        const parsed = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      };
      
      // Calculate project duration in months for monthly costs
      const calculateProjectMonths = (): number => {
        const startDate = project.startDate ? new Date(project.startDate) : null;
        const endDate = project.endDate ? new Date(project.endDate) : new Date(); // Default to today if no end date
        
        if (!startDate) return 1; // Default to 1 month if no start date
        
        // Calculate months between start and end dates
        const msPerMonth = 30.44 * 24 * 60 * 60 * 1000; // Average days per month
        const monthsDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / msPerMonth));
        return monthsDiff;
      };
      
      const projectMonths = calculateProjectMonths();
      
      for (const resource of resources) {
        if (resource.type === 'human') {
          // Human resources: dailyCost * capacity (capacity = days allocated to project)
          const dailyCost = safeParseFloat(resource.dailyCostInternal);
          const capacity = safeParseFloat(resource.capacity);
          const cost = dailyCost * capacity;
          if (resource.isBillable === 1) {
            totalBillable += cost;
          } else {
            totalNonBillable += cost;
          }
        } else {
          // Non-human resources: amount is unit price, multiply by duration
          const amount = safeParseFloat(resource.amount);
          const costType = resource.costType; // 'monthly' | 'annual' | 'one_time'
          
          let totalAmount = amount;
          if (costType === 'monthly') {
            // Multiply by number of months in project
            totalAmount = amount * projectMonths;
          } else if (costType === 'annual') {
            // Multiply by years (projectMonths / 12), minimum 1
            const projectYears = Math.max(1, projectMonths / 12);
            totalAmount = amount * projectYears;
          }
          // 'one_time' keeps the original amount
          
          if (resource.isBillable === 1) {
            totalBillable += totalAmount;
          } else {
            totalNonBillable += totalAmount;
          }
        }
      }
      const resourceCosts = { totalNonBillable, totalBillable };

      // Import and use profitability service
      const { generateProfitabilityAnalysis } = await import("./services/profitabilityService");
      const analysis = generateProfitabilityAnalysis(project, timeEntries, payments, globalTJM, resourceCosts);

      res.json(analysis);
    } catch (error: any) {
      console.error("Error generating profitability analysis:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Get profitability summary for all projects in account
  app.get("/api/profitability/summary", requireAuth, requireOrgMember, requirePermission("profitability", "read", "profitability.overview"), async (req, res) => {
    try {
      const projects = await storage.getProjectsByAccountId(req.accountId!);
      const { generateProfitabilityAnalysis } = await import("./services/profitabilityService");
      
      // Get global TJM from account settings
      const globalTJMSetting = await storage.getSetting('ACCOUNT', req.accountId!, 'billing.defaultTJM');
      const globalTJM = globalTJMSetting?.value ? parseFloat(String(globalTJMSetting.value)) : undefined;
      
      // Exclure les projets abandonnés des analyses (on les garde uniquement dans "Par projet")
      const nonAbandonedProjects = projects.filter(p => p.stage !== 'abandonne');
      
      // Séparer les projets par type: client (facturable) vs interne (non facturable)
      const clientProjects = nonAbandonedProjects.filter(p => p.businessType !== 'internal');
      const internalProjects = nonAbandonedProjects.filter(p => p.businessType === 'internal');
      
      // Séparer les projets clients en prospection (CA potentiel) des autres (CA réel)
      const prospectionProjects = clientProjects.filter(p => p.stage === 'prospection');
      const activeProjects = clientProjects.filter(p => p.stage !== 'prospection');
      
      // Calculer le CA potentiel (projets en prospection)
      const potentialRevenue = prospectionProjects.reduce((sum, p) => {
        return sum + parseFloat(p.budget?.toString() || '0');
      }, 0);
      
      // Générer les analyses uniquement pour les projets clients actifs (hors prospection et internes)
      const summaries = await Promise.all(
        activeProjects.map(async (project) => {
          const timeEntries = await storage.getTimeEntriesByProjectId(req.accountId!, project.id);
          const payments = await storage.getPaymentsByProjectId(project.id);
          return generateProfitabilityAnalysis(project, timeEntries, payments, globalTJM);
        })
      );

      // Calculate aggregate metrics (uniquement sur projets clients actifs)
      const totalBilled = summaries.reduce((sum, s) => sum + s.metrics.totalBilled, 0);
      const totalPaid = summaries.reduce((sum, s) => sum + s.metrics.totalPaid, 0);
      const totalMargin = summaries.reduce((sum, s) => sum + s.metrics.margin, 0);
      const totalCost = summaries.reduce((sum, s) => sum + s.metrics.totalCost, 0);
      
      const profitableCount = summaries.filter(s => s.metrics.status === 'profitable').length;
      const atRiskCount = summaries.filter(s => s.metrics.status === 'at_risk').length;
      const deficitCount = summaries.filter(s => s.metrics.status === 'deficit').length;

      res.json({
        projects: summaries,
        aggregate: {
          totalBilled,
          totalPaid,
          totalMargin,
          totalCost,
          potentialRevenue, // CA potentiel (projets en prospection)
          potentialProjectCount: prospectionProjects.length,
          averageMarginPercent: totalBilled > 0 ? (totalMargin / totalBilled) * 100 : 0,
          profitableCount,
          atRiskCount,
          deficitCount,
          projectCount: summaries.length,
          internalProjectCount: internalProjects.length, // Nombre de projets internes exclus
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error generating profitability summary:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Get project comparison and projections for decision-making
  app.get("/api/projects/:projectId/comparison", requireAuth, requireOrgMember, requirePermission("profitability", "read", "profitability.byProject"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get all projects for comparison
      const allProjects = await storage.getProjectsByAccountId(req.accountId!);
      const { generateProfitabilityAnalysis } = await import("./services/profitabilityService");
      
      // Get global TJM from account settings
      const globalTJMSetting = await storage.getSetting('ACCOUNT', req.accountId!, 'billing.defaultTJM');
      const globalTJM = globalTJMSetting?.value ? parseFloat(String(globalTJMSetting.value)) : undefined;

      // Generate analysis for current project
      const currentTimeEntries = await storage.getTimeEntriesByProjectId(req.accountId!, req.params.projectId);
      const currentPayments = await storage.getPaymentsByProjectId(req.params.projectId);
      const currentAnalysis = generateProfitabilityAnalysis(project, currentTimeEntries, currentPayments, globalTJM);

      // Filter similar projects (same category or business type)
      const similarProjects = allProjects.filter(p => 
        p.id !== project.id && 
        p.businessType !== 'internal' && 
        p.stage !== 'prospection' &&
        (p.category === project.category || p.businessType === project.businessType)
      );

      // Generate analyses for similar projects
      const similarAnalyses = await Promise.all(
        similarProjects.map(async (p) => {
          const timeEntries = await storage.getTimeEntriesByProjectId(req.accountId!, p.id);
          const payments = await storage.getPaymentsByProjectId(p.id);
          return generateProfitabilityAnalysis(p, timeEntries, payments, globalTJM);
        })
      );

      // Calculate averages for similar projects
      const validSimilar = similarAnalyses.filter(a => a.metrics.actualDaysWorked > 0);
      const avgMetrics = validSimilar.length > 0 ? {
        avgMarginPercent: validSimilar.reduce((sum, a) => sum + a.metrics.marginPercent, 0) / validSimilar.length,
        avgActualTJM: validSimilar.reduce((sum, a) => sum + a.metrics.actualTJM, 0) / validSimilar.length,
        avgTimeOverrunPercent: validSimilar.reduce((sum, a) => sum + a.metrics.timeOverrunPercent, 0) / validSimilar.length,
        avgPaymentProgress: validSimilar.reduce((sum, a) => sum + a.metrics.paymentProgress, 0) / validSimilar.length,
        projectCount: validSimilar.length,
      } : null;

      // Find best performing projects
      const allActiveProjects = allProjects.filter(p => 
        p.id !== project.id && 
        p.businessType !== 'internal' && 
        p.stage !== 'prospection'
      );
      const allAnalyses = await Promise.all(
        allActiveProjects.map(async (p) => {
          const timeEntries = await storage.getTimeEntriesByProjectId(req.accountId!, p.id);
          const payments = await storage.getPaymentsByProjectId(p.id);
          return { project: p, analysis: generateProfitabilityAnalysis(p, timeEntries, payments, globalTJM) };
        })
      );
      
      // Top 3 by margin
      const topByMargin = allAnalyses
        .filter(a => a.analysis.metrics.actualDaysWorked > 0)
        .sort((a, b) => b.analysis.metrics.marginPercent - a.analysis.metrics.marginPercent)
        .slice(0, 3);

      const bestMetrics = topByMargin.length > 0 ? {
        avgMarginPercent: topByMargin.reduce((sum, a) => sum + a.analysis.metrics.marginPercent, 0) / topByMargin.length,
        avgActualTJM: topByMargin.reduce((sum, a) => sum + a.analysis.metrics.actualTJM, 0) / topByMargin.length,
        avgTimeOverrunPercent: topByMargin.reduce((sum, a) => sum + a.analysis.metrics.timeOverrunPercent, 0) / topByMargin.length,
        projectCount: topByMargin.length,
        topProjects: topByMargin.map(a => ({ 
          id: a.project.id,
          name: a.project.name, 
          category: a.project.category,
          marginPercent: a.analysis.metrics.marginPercent,
          actualTJM: a.analysis.metrics.actualTJM,
          actualDaysWorked: a.analysis.metrics.actualDaysWorked,
          theoreticalDays: a.analysis.metrics.theoreticalDays,
          timeOverrunPercent: a.analysis.metrics.timeOverrunPercent,
          status: a.analysis.metrics.status,
        })),
      } : null;

      // Calculate projections based on current pace
      const daysSinceStart = project.startDate 
        ? Math.max(1, Math.ceil((Date.now() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24)))
        : 30; // Default to 30 days if no start date
      
      const pacePerDay = currentAnalysis.metrics.actualDaysWorked / daysSinceStart;
      const remainingDays = Math.max(0, currentAnalysis.metrics.theoreticalDays - currentAnalysis.metrics.actualDaysWorked);
      
      // Project total time at current pace (assuming project runs for another X days)
      const estimatedTotalDays = project.endDate
        ? currentAnalysis.metrics.actualDaysWorked + pacePerDay * Math.max(0, Math.ceil((new Date(project.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : currentAnalysis.metrics.actualDaysWorked + remainingDays;

      // Project margin at current TJM
      const projectedTotalCost = estimatedTotalDays * currentAnalysis.metrics.internalDailyCost;
      const projectedMargin = currentAnalysis.metrics.totalBilled - projectedTotalCost;
      const projectedMarginPercent = currentAnalysis.metrics.totalBilled > 0 
        ? (projectedMargin / currentAnalysis.metrics.totalBilled) * 100 
        : 0;

      // Determine deviation from budget
      const timeDeviation = currentAnalysis.metrics.theoreticalDays > 0
        ? ((estimatedTotalDays / currentAnalysis.metrics.theoreticalDays) - 1) * 100
        : 0;

      const projections = {
        pacePerDay: pacePerDay,
        estimatedTotalDays: estimatedTotalDays,
        projectedMargin: projectedMargin,
        projectedMarginPercent: projectedMarginPercent,
        timeDeviation: timeDeviation,
        atRiskOfOverrun: timeDeviation > 10,
        projectedEndDate: project.endDate ? new Date(project.endDate).toISOString() : null,
      };

      // Compare current project to averages
      const comparison = {
        vsSimilar: avgMetrics ? {
          marginGap: currentAnalysis.metrics.marginPercent - avgMetrics.avgMarginPercent,
          tjmGap: currentAnalysis.metrics.actualTJM - avgMetrics.avgActualTJM,
          timeGap: currentAnalysis.metrics.timeOverrunPercent - avgMetrics.avgTimeOverrunPercent,
          paymentGap: currentAnalysis.metrics.paymentProgress - avgMetrics.avgPaymentProgress,
          verdict: currentAnalysis.metrics.marginPercent >= avgMetrics.avgMarginPercent ? 'above_average' : 'below_average',
        } : null,
        vsBest: bestMetrics ? {
          marginGap: currentAnalysis.metrics.marginPercent - bestMetrics.avgMarginPercent,
          tjmGap: currentAnalysis.metrics.actualTJM - bestMetrics.avgActualTJM,
          timeGap: currentAnalysis.metrics.timeOverrunPercent - bestMetrics.avgTimeOverrunPercent,
          verdict: currentAnalysis.metrics.marginPercent >= bestMetrics.avgMarginPercent ? 'top_performer' : 'improvement_possible',
        } : null,
      };

      res.json({
        currentProject: {
          id: project.id,
          name: project.name,
          category: project.category,
          metrics: currentAnalysis.metrics,
          healthScore: currentAnalysis.healthScore,
        },
        similarProjects: avgMetrics,
        bestProjects: bestMetrics,
        projections,
        comparison,
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error generating project comparison:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // RECOMMENDATION ACTIONS - Protected Routes
  // ============================================

  // Get all recommendation actions for the authenticated account
  app.get("/api/recommendation-actions", requireAuth, async (req, res) => {
    try {
      const actions = await storage.getRecommendationActionsByAccountId(req.accountId!);
      res.json(actions);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get recommendation actions for a specific project
  app.get("/api/projects/:projectId/recommendation-actions", requireAuth, requireOrgMember, requirePermission("profitability", "read", "profitability.byProject"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const actions = await storage.getRecommendationActionsByProjectId(req.params.projectId);
      res.json(actions);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create or update a recommendation action (mark as treated or ignored)
  app.post("/api/recommendation-actions", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const { insertRecommendationActionSchema } = await import("@shared/schema");
      const data = insertRecommendationActionSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId!,
      });
      
      // Verify project access
      const project = await storage.getProject(data.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const action = await storage.upsertRecommendationAction(data);
      res.json(action);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a recommendation action (undo treated/ignored status)
  app.delete("/api/recommendation-actions/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      await storage.deleteRecommendationAction(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // TASKS - Protected Routes
  // ============================================

  // Get all tasks for the authenticated account
  app.get("/api/tasks", requireAuth, requireOrgMember, requirePermission("tasks", "read"), async (req, res) => {
    try {
      const tasks = await storage.getTasksByAccountId(req.accountId!);
      res.json(tasks);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all tasks by project
  app.get("/api/projects/:projectId/tasks", requireAuth, requireOrgMember, requirePermission("tasks", "read"), async (req, res) => {
    try {
      // First verify the project exists and user has access
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const tasks = await storage.getTasksByProjectId(req.params.projectId);
      res.json(tasks);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all sprints for a project (via backlogs linked to the project)
  app.get("/api/projects/:projectId/sprints", requireAuth, requireOrgMember, requirePermission("product", "read", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const projectId = req.params.projectId;
      
      // First verify the project exists and user has access
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get all backlogs linked to this project
      const projectBacklogs = await db.select().from(backlogs)
        .where(and(eq(backlogs.projectId, projectId), eq(backlogs.accountId, accountId)));
      
      // Get all sprints from those backlogs
      const backlogIds = projectBacklogs.map(b => b.id);
      if (backlogIds.length === 0) {
        return res.json([]);
      }
      
      const projectSprints = await db.select().from(sprints)
        .where(and(
          inArray(sprints.backlogId, backlogIds),
          eq(sprints.accountId, accountId)
        ))
        .orderBy(asc(sprints.startDate));
      
      res.json(projectSprints);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all epics for a project (via backlogs linked to the project)
  app.get("/api/projects/:projectId/epics", requireAuth, requireOrgMember, requirePermission("product", "read", "product.epics"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const projectId = req.params.projectId;
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const projectBacklogs = await db.select().from(backlogs)
        .where(and(eq(backlogs.projectId, projectId), eq(backlogs.accountId, accountId)));
      
      const backlogIds = projectBacklogs.map(b => b.id);
      if (backlogIds.length === 0) {
        return res.json([]);
      }
      
      const projectEpics = await db.select().from(epics)
        .where(and(
          inArray(epics.backlogId, backlogIds),
          eq(epics.accountId, accountId)
        ))
        .orderBy(asc(epics.order));
      
      res.json(projectEpics);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all user stories for a project (via backlogs linked to the project)
  app.get("/api/projects/:projectId/user-stories", requireAuth, requireOrgMember, requirePermission("product", "read", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const projectId = req.params.projectId;
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const projectBacklogs = await db.select().from(backlogs)
        .where(and(eq(backlogs.projectId, projectId), eq(backlogs.accountId, accountId)));
      
      const backlogIds = projectBacklogs.map(b => b.id);
      if (backlogIds.length === 0) {
        return res.json([]);
      }
      
      const projectStories = await db.select().from(userStories)
        .where(and(
          inArray(userStories.backlogId, backlogIds),
          eq(userStories.accountId, accountId)
        ))
        .orderBy(asc(userStories.order));
      
      res.json(projectStories);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new task
  app.post("/api/tasks", requireAuth, requireOrgMember, requirePermission("tasks", "create"), async (req, res) => {
    try {
      console.log('POST /api/tasks - body:', JSON.stringify(req.body));
      console.log('POST /api/tasks - accountId:', req.accountId);
      console.log('POST /api/tasks - userId:', req.userId);
      
      // Verify project exists and belongs to account (only if projectId is provided)
      if (req.body.projectId) {
        const project = await storage.getProject(req.body.projectId);
        if (!project) {
          console.error('Project not found:', req.body.projectId);
          return res.status(404).json({ error: "Project not found" });
        }
        if (project.accountId !== req.accountId) {
          console.error('Project access denied. Project accountId:', project.accountId, 'User accountId:', req.accountId);
          return res.status(403).json({ error: "Access denied to this project" });
        }
      }

      // Keep dueDate as string if it's in YYYY-MM-DD format (no timezone conversion needed)
      // PostgreSQL will handle the date string directly as a timestamp at midnight local time
      const { insertTaskSchema } = await import("@shared/schema");
      const data = insertTaskSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId!,
      });
      const task = await storage.createTask(data);
      console.log('Task created successfully:', task.id);
      
      // Create activity
      await storage.createActivity({
        accountId: req.accountId!,
        subjectType: "task",
        subjectId: task.id,
        kind: "task",
        payload: { description: `Task created: ${task.title}` },
        createdBy: req.userId || null,
      });
      
      res.json(task);
    } catch (error: any) {
      console.error('Error creating task:', error.message);
      res.status(400).json({ error: error.message });
    }
  });

  // Bulk update task positions (for drag & drop) - MUST be before /:id routes
  app.patch("/api/tasks/bulk-update-positions", requireAuth, requireOrgMember, requirePermission("tasks", "update"), async (req, res) => {
    try {
      const { z } = await import("zod");
      
      // Validation schema for bulk updates
      const bulkUpdateSchema = z.object({
        updates: z.array(z.object({
          id: z.string().uuid(),
          columnId: z.string().uuid(),
          positionInColumn: z.number().int().min(0)
        }))
      });
      
      const validatedData = bulkUpdateSchema.parse(req.body);
      const { updates } = validatedData;
      
      console.log("[BULK UPDATE] Received request:", { 
        updateCount: updates.length,
        updates: JSON.stringify(updates, null, 2)
      });
      
      // Verify all tasks belong to user's account
      for (const update of updates) {
        const task = await storage.getTask(update.id);
        if (!task || task.accountId !== req.accountId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      await storage.bulkUpdateTaskPositions(updates);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Bulk update positions error:", error);
      res.status(400).json({ error: error.message || "Invalid input data" });
    }
  });

  // Bulk update tasks project - MUST be before /:id routes
  app.patch("/api/tasks/bulk-update-project", requireAuth, requireOrgMember, requirePermission("tasks", "update"), async (req, res) => {
    try {
      const { z } = await import("zod");
      
      const bulkUpdateProjectSchema = z.object({
        taskIds: z.array(z.string().uuid()),
        projectId: z.string().uuid().nullable(),
        newColumnId: z.string().uuid()
      });
      
      const { taskIds, projectId, newColumnId } = bulkUpdateProjectSchema.parse(req.body);
      
      // Verify all tasks belong to user's account
      for (const taskId of taskIds) {
        const task = await storage.getTask(taskId);
        if (!task || task.accountId !== req.accountId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Verify project belongs to user's account if projectId is not null
      if (projectId) {
        const project = await storage.getProject(projectId);
        if (!project || project.accountId !== req.accountId) {
          return res.status(403).json({ error: "Access denied to project" });
        }
      }

      // Verify the destination column exists, belongs to user's account, and matches the project
      const column = await storage.getTaskColumn(newColumnId);
      if (!column) {
        return res.status(404).json({ error: "Column not found" });
      }
      
      // CRITICAL SECURITY: Verify column belongs to user's account
      if (column.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied to column" });
      }
      
      // For global columns (projectId is null), verify column is global
      if (projectId === null) {
        if (column.projectId !== null) {
          return res.status(403).json({ error: "Column must be a global column" });
        }
      } else {
        // For project columns, verify column belongs to the specified project
        if (column.projectId !== projectId) {
          return res.status(403).json({ error: "Column does not belong to the specified project" });
        }
      }

      await storage.bulkUpdateTasksProject(taskIds, projectId, newColumnId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Bulk update project error:", error);
      res.status(400).json({ error: error.message || "Invalid input data" });
    }
  });

  // Get a specific task
  app.get("/api/tasks/:id", requireAuth, requireOrgMember, requirePermission("tasks", "read"), async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (task.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update a task
  app.patch("/api/tasks/:id", requireAuth, requireOrgMember, requirePermission("tasks", "update"), async (req, res) => {
    try {
      const existing = await storage.getTask(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Keep dueDate as string if it's in YYYY-MM-DD format (no timezone conversion needed)
      // PostgreSQL will handle the date string directly
      const task = await storage.updateTask(req.params.id, req.body);
      res.json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a task
  app.delete("/api/tasks/:id", requireAuth, requireOrgMember, requirePermission("tasks", "delete"), async (req, res) => {
    try {
      const existing = await storage.getTask(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteTask(req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Duplicate a task
  app.post("/api/tasks/:id/duplicate", requireAuth, requireOrgMember, requirePermission("tasks", "create"), async (req, res) => {
    try {
      const existing = await storage.getTask(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const duplicated = await storage.duplicateTask(req.params.id);
      res.json(duplicated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Move task to a different column
  app.patch("/api/tasks/:id/move", requireAuth, requireOrgMember, requirePermission("tasks", "update"), async (req, res) => {
    try {
      const existing = await storage.getTask(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { columnId, position } = req.body;
      const task = await storage.moveTaskToColumn(req.params.id, columnId, position);
      res.json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // TASK COLUMNS - Protected Routes
  // ============================================

  // Get all task columns for a project
  // Get all task columns for the authenticated account
  app.get("/api/task-columns", requireAuth, requireOrgMember, requirePermission("tasks", "read"), async (req, res) => {
    try {
      const columns = await storage.getTaskColumnsByAccountId(req.accountId!);
      res.json(columns);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get global task columns (not tied to any project)
  app.get("/api/task-columns/global", requireAuth, requireOrgMember, requirePermission("tasks", "read"), async (req, res) => {
    try {
      const columns = await storage.getGlobalTaskColumnsByAccountId(req.accountId!);
      res.json(columns);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/projects/:projectId/task-columns", requireAuth, requireOrgMember, requirePermission("tasks", "read"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const columns = await storage.getTaskColumnsByProjectId(req.params.projectId);
      res.json(columns);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new task column
  app.post("/api/task-columns", requireAuth, requireOrgMember, requirePermission("tasks", "create"), async (req, res) => {
    try {
      const { insertTaskColumnSchema } = await import("@shared/schema");
      
      // Verify project exists and belongs to account
      const project = await storage.getProject(req.body.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertTaskColumnSchema.parse({
        ...req.body,
        accountId: req.accountId!,
      });
      const column = await storage.createTaskColumn(data);
      res.json(column);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update a task column
  app.patch("/api/task-columns/:id", requireAuth, requireOrgMember, requirePermission("tasks", "update"), async (req, res) => {
    try {
      const existing = await storage.getTaskColumn(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Task column not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Prevent modification of locked columns
      if (existing.isLocked && (req.body.name || req.body.isLocked !== undefined)) {
        return res.status(400).json({ error: "Cannot rename or unlock a locked column" });
      }

      const column = await storage.updateTaskColumn(req.params.id, req.body);
      res.json(column);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a task column
  app.delete("/api/task-columns/:id", requireAuth, requireOrgMember, requirePermission("tasks", "delete"), async (req, res) => {
    try {
      const existing = await storage.getTaskColumn(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Task column not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Prevent deletion of locked columns
      if (existing.isLocked) {
        return res.status(400).json({ error: "Cannot delete a locked column" });
      }

      const success = await storage.deleteTaskColumn(req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Reorder task columns
  app.patch("/api/projects/:projectId/task-columns/reorder", requireAuth, requireOrgMember, requirePermission("tasks", "update"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { columnOrders } = req.body;
      await storage.reorderTaskColumns(req.params.projectId, columnOrders);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // TIME ENTRIES - Protected Routes
  // ============================================

  // Get all time entries for the authenticated account
  app.get("/api/time-entries", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const entries = await storage.getTimeEntriesByAccountId(req.accountId!);
      res.json(entries);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get time entries for a specific project
  app.get("/api/projects/:projectId/time-entries", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      // Verify project exists and user has access
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const entries = await storage.getTimeEntriesByProjectId(req.accountId!, req.params.projectId);
      res.json(entries);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get active time entry for the current user
  app.get("/api/time-entries/active", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const entry = await storage.getActiveTimeEntry(req.accountId!, req.userId!);
      res.json(entry || null);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new time entry (start timer)
  app.post("/api/time-entries", requireAuth, requireOrgMember, requirePermission("projects", "create"), async (req, res) => {
    try {
      const { insertTimeEntrySchema } = await import("@shared/schema");
      
      // If projectId is provided, verify it belongs to the user's account
      if (req.body.projectId) {
        const project = await storage.getProject(req.body.projectId);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }
        if (project.accountId !== req.accountId) {
          return res.status(403).json({ error: "Access denied to this project" });
        }
      }
      
      const data = insertTimeEntrySchema.parse({
        ...req.body,
        accountId: req.accountId!,
        userId: req.userId!,
        startTime: new Date(), // Always start now
        duration: 0, // Initialize duration to 0
      });
      
      // Check if user already has an active timer
      const activeEntry = await storage.getActiveTimeEntry(req.accountId!, req.userId!);
      if (activeEntry) {
        return res.status(400).json({ error: "You already have an active timer running" });
      }

      const entry = await storage.createTimeEntry(data);
      res.json(entry);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a manual time entry (completed entry with specific duration)
  app.post("/api/time-entries/manual", requireAuth, requireOrgMember, requirePermission("projects", "create"), async (req, res) => {
    try {
      const { insertTimeEntrySchema } = await import("@shared/schema");
      
      const { startTime, endTime, duration, projectId, description, scopeItemId, taskId, sprintId } = req.body;
      
      // Validate required fields
      if (!startTime || !duration || duration <= 0) {
        return res.status(400).json({ error: "startTime and duration (> 0) are required" });
      }
      
      // If projectId is provided, verify it belongs to the user's account
      if (projectId) {
        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }
        if (project.accountId !== req.accountId) {
          return res.status(403).json({ error: "Access denied to this project" });
        }
      }
      
      const parsedStartTime = new Date(startTime);
      const parsedEndTime = endTime ? new Date(endTime) : new Date(parsedStartTime.getTime() + duration * 1000);
      
      const data = insertTimeEntrySchema.parse({
        accountId: req.accountId!,
        userId: req.userId!,
        projectId: projectId || null,
        description: description || null,
        scopeItemId: scopeItemId || null,
        taskId: taskId || null,
        sprintId: sprintId || null,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        duration: duration,
      });

      const entry = await storage.createTimeEntry(data);
      
      // Create activity if project is assigned
      if (projectId) {
        try {
          const project = await storage.getProject(projectId);
          if (project) {
            const durationMinutes = Math.floor(duration / 60);
            const hours = Math.floor(durationMinutes / 60);
            const minutes = durationMinutes % 60;
            const durationText = hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}` : `${minutes}min`;
            
            await storage.createActivity({
              accountId: req.accountId!,
              subjectType: "project",
              subjectId: projectId,
              kind: "task",
              description: `Temps enregistré : ${durationText} sur ${project.name}`,
            });
          }
        } catch (activityError) {
          console.error("Failed to create activity for manual time entry:", activityError);
        }
      }
      
      res.json(entry);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update a time entry (stop timer, update duration, assign project)
  app.patch("/api/time-entries/:id", requireAuth, requireOrgMember, requirePermission("projects", "update"), async (req, res) => {
    try {
      const existing = await storage.getTimeEntry(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Time entry not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Validate update payload
      const { updateTimeEntrySchema } = await import("@shared/schema");
      const validatedUpdate = updateTimeEntrySchema.parse(req.body);
      
      // If projectId is provided, verify it belongs to the user's account
      if (validatedUpdate.projectId !== undefined) {
        if (validatedUpdate.projectId !== null) {
          const project = await storage.getProject(validatedUpdate.projectId);
          if (!project) {
            return res.status(404).json({ error: "Project not found" });
          }
          if (project.accountId !== req.accountId) {
            return res.status(403).json({ error: "Access denied to this project" });
          }
        }
      }

      // If stopping the timer, calculate and validate duration
      if (validatedUpdate.endTime) {
        const startTime = validatedUpdate.startTime 
          ? new Date(validatedUpdate.startTime) 
          : (existing.startTime ? new Date(existing.startTime) : new Date());
        const endTime = new Date(validatedUpdate.endTime);
        
        // Ensure endTime is after startTime
        if (endTime <= startTime) {
          return res.status(400).json({ error: "End time must be after start time" });
        }
        
        // If duration is explicitly provided (manual edit), use it directly
        // Otherwise calculate duration for timer stop (accumulated + elapsed)
        if (validatedUpdate.duration === undefined) {
          const elapsedSinceStart = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
          const accumulatedDuration = existing.duration || 0;
          validatedUpdate.duration = accumulatedDuration + elapsedSinceStart;
        }
        // If duration is provided, use it as-is (this is a manual edit, not a timer stop)
      }

      const entry = await storage.updateTimeEntry(req.accountId!, req.params.id, validatedUpdate);
      
      // Create activity if timer is stopped and has a project
      const finalProjectId = validatedUpdate.projectId !== undefined ? validatedUpdate.projectId : existing.projectId;
      if (validatedUpdate.endTime && finalProjectId) {
        try {
          const project = await storage.getProject(finalProjectId);
          if (project) {
            const durationMinutes = Math.floor((validatedUpdate.duration || 0) / 60);
            const hours = Math.floor(durationMinutes / 60);
            const minutes = durationMinutes % 60;
            const durationText = hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}` : `${minutes}min`;
            
            await storage.createActivity({
              accountId: req.accountId!,
              subjectType: "project",
              subjectId: finalProjectId,
              kind: "task",
              description: `Temps enregistré : ${durationText} sur ${project.name}`,
            });
          }
        } catch (activityError) {
          console.error("Failed to create time tracking activity:", activityError);
        }
      }
      
      res.json(entry);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a time entry
  app.delete("/api/time-entries/:id", requireAuth, requireOrgMember, requirePermission("projects", "delete"), async (req, res) => {
    try {
      const existing = await storage.getTimeEntry(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Time entry not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteTimeEntry(req.accountId!, req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Pause a running time entry
  app.patch("/api/time-entries/:id/pause", requireAuth, requireOrgMember, requirePermission("projects", "update"), async (req, res) => {
    try {
      const existing = await storage.getTimeEntry(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Time entry not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Verify timer is running (no endTime and no pausedAt)
      if (existing.endTime) {
        return res.status(400).json({ error: "Timer already stopped" });
      }
      if (existing.pausedAt) {
        return res.status(400).json({ error: "Timer already paused" });
      }

      // Accumulate duration: duration += (now - startTime)
      const now = Date.now();
      const startTime = new Date(existing.startTime!).getTime();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const newDuration = (existing.duration || 0) + elapsedSeconds;

      const updated = await storage.updateTimeEntry(req.accountId!, req.params.id, {
        duration: newDuration,
        pausedAt: new Date(),
      });
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Resume a paused time entry
  app.patch("/api/time-entries/:id/resume", requireAuth, requireOrgMember, requirePermission("projects", "update"), async (req, res) => {
    try {
      const existing = await storage.getTimeEntry(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Time entry not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Verify timer is paused
      if (!existing.pausedAt) {
        return res.status(400).json({ error: "Timer not paused" });
      }
      if (existing.endTime) {
        return res.status(400).json({ error: "Timer already stopped" });
      }
      
      // Reset startTime to now and clear pausedAt
      // Duration already contains accumulated time before pause
      const updated = await storage.updateTimeEntry(req.accountId!, req.params.id, {
        startTime: new Date(),
        pausedAt: null,
      });
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // NOTES - Protected Routes
  // ============================================

  app.get("/api/notes", requireAuth, requireOrgMember, requirePermission("notes", "read"), async (req, res) => {
    try {
      const notes = await storage.getNotesByAccountId(req.accountId!);
      res.json(notes);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/notes", requireAuth, requireOrgMember, requirePermission("notes", "create"), async (req, res) => {
    try {
      const data = insertNoteSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      const note = await storage.createNote(data);

      // Create activity
      await storage.createActivity({
        accountId: req.accountId!,
        subjectType: "note",
        subjectId: note.id,
        kind: "note",
        payload: { description: `Note created: ${note.title}` },
        createdBy: req.userId || null,
      });

      res.json(note);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/notes/:id", requireAuth, requireOrgMember, requirePermission("notes", "read"), async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (note.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(note);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/notes/:id", requireAuth, requireOrgMember, requirePermission("notes", "update"), async (req, res) => {
    try {
      const existing = await storage.getNote(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const note = await storage.updateNote(req.params.id, req.body);
      
      // Log activity for significant note updates (title or content changes)
      if (req.body.title !== undefined || req.body.content !== undefined) {
        await storage.createActivity({
          accountId: req.accountId!,
          subjectType: "note",
          subjectId: note.id,
          kind: "updated",
          payload: { description: `Note updated: ${note.title}` },
          createdBy: req.userId || null,
        });
      }
      
      res.json(note);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/notes/:id/duplicate", requireAuth, requireOrgMember, requirePermission("notes", "create"), async (req, res) => {
    try {
      const existing = await storage.getNote(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Create a duplicate with "(copie 1)" suffix
      const data = insertNoteSchema.parse({
        title: `${existing.title} (copie 1)`,
        content: existing.content,
        plainText: existing.plainText,
        status: "draft", // Always create as draft
        visibility: existing.visibility,
        accountId: req.accountId!,
        createdBy: req.userId!,
      });

      const duplicatedNote = await storage.createNote(data);
      res.json(duplicatedNote);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/notes/:id", requireAuth, requireOrgMember, requirePermission("notes", "delete"), async (req, res) => {
    try {
      const existing = await storage.getNote(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteNote(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Note Links
  app.get("/api/note-links", requireAuth, requireOrgMember, requirePermission("notes", "read"), async (req, res) => {
    try {
      const links = await storage.getNoteLinksByAccountId(req.accountId!);
      res.json(links);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/notes/:id/links", requireAuth, requireOrgMember, requirePermission("notes", "read"), async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (note.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const links = await storage.getNoteLinksByNoteId(req.params.id);
      res.json(links);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/notes/:id/links", requireAuth, requireOrgMember, requirePermission("notes", "update"), async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (note.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { targetType, targetId } = insertNoteLinkSchema.parse(req.body);
      
      // Verify the target entity exists and belongs to the same account
      if (targetType === "project") {
        const project = await storage.getProject(targetId);
        if (!project || project.accountId !== req.accountId) {
          return res.status(404).json({ error: "Project not found or access denied" });
        }
      } else if (targetType === "task") {
        const task = await storage.getTask(targetId);
        if (!task || task.accountId !== req.accountId) {
          return res.status(404).json({ error: "Task not found or access denied" });
        }
      } else if (targetType === "client") {
        const client = await storage.getClient(req.accountId!, targetId);
        if (!client) {
          return res.status(404).json({ error: "Client not found or access denied" });
        }
      }

      const link = await storage.createNoteLink({
        noteId: req.params.id,
        targetType,
        targetId,
      });
      res.json(link);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/notes/:id/links/:targetType/:targetId", requireAuth, requireOrgMember, requirePermission("notes", "delete"), async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (note.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteNoteLink(
        req.params.id,
        req.params.targetType,
        req.params.targetId
      );
      
      if (!success) {
        return res.status(404).json({ error: "Link not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // AI operations on notes (Protected)
  app.post("/api/notes/:id/summarize", requireAuth, requireOrgMember, requirePermission("notes", "read"), async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (note.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const text = typeof note.content === 'string' ? note.content : JSON.stringify(note.content);
      const summary = await summarizeText(text);

      res.json({ summary });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/notes/:id/extract-actions", requireAuth, requireOrgMember, requirePermission("notes", "read"), async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (note.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const text = typeof note.content === 'string' ? note.content : JSON.stringify(note.content);
      const actions = await extractActions(text);

      res.json({ actions });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // DOCUMENT TEMPLATES - Protected Routes
  // ============================================

  app.get("/api/document-templates", requireAuth, requireOrgMember, requirePermission("documents", "read"), async (req, res) => {
    try {
      const templates = await storage.getDocumentTemplates(req.accountId!);
      res.json(templates);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/document-templates/:id", requireAuth, requireOrgMember, requirePermission("documents", "read"), async (req, res) => {
    try {
      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      // Check access: system templates (isSystem = true) or account templates
      const isSystemTemplate = template.isSystem === true || template.isSystem === 'true' || template.isSystem === 1;
      if (!isSystemTemplate && template.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/document-templates", requireAuth, requireOrgMember, requirePermission("documents", "create"), async (req, res) => {
    try {
      const data = insertDocumentTemplateSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
        isSystem: 'false', // User templates are never system templates
      });
      const template = await storage.createDocumentTemplate(data);
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/document-templates/:id", requireAuth, requireOrgMember, requirePermission("documents", "update"), async (req, res) => {
    try {
      const existing = await storage.getDocumentTemplate(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Template not found" });
      }
      // Only allow editing account templates, not system templates
      const isSystemTemplate = existing.isSystem === true || existing.isSystem === 'true' || existing.isSystem === 1;
      if (isSystemTemplate) {
        return res.status(403).json({ error: "Cannot edit system templates" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = updateDocumentTemplateSchema.parse(req.body);
      const template = await storage.updateDocumentTemplate(req.params.id, req.accountId!, data);
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/document-templates/:id", requireAuth, requireOrgMember, requirePermission("documents", "delete"), async (req, res) => {
    try {
      const existing = await storage.getDocumentTemplate(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Template not found" });
      }
      // Only allow deleting account templates, not system templates
      const isSystemTemplate = existing.isSystem === true || existing.isSystem === 'true' || existing.isSystem === 1;
      if (isSystemTemplate) {
        return res.status(403).json({ error: "Cannot delete system templates" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteDocumentTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // DOCUMENTS - Protected Routes
  // ============================================

  app.get("/api/documents", requireAuth, requireOrgMember, requirePermission("documents", "read"), async (req, res) => {
    try {
      const documents = await storage.getDocumentsByAccountId(req.accountId!);
      res.json(documents);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/documents", requireAuth, requireOrgMember, requirePermission("documents", "create"), async (req, res) => {
    try {
      const data = insertDocumentSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      const document = await storage.createDocument(data);
      
      // Create activity
      await storage.createActivity({
        accountId: req.accountId!,
        subjectType: "document",
        subjectId: document.id,
        kind: "file",
        payload: { description: `Document created: ${document.name}` },
        createdBy: req.userId || null,
      });
      
      res.json(document);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/documents/:id", requireAuth, requireOrgMember, requirePermission("documents", "read"), async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (document.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(document);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/documents/:id", requireAuth, requireOrgMember, requirePermission("documents", "update"), async (req, res) => {
    try {
      const existing = await storage.getDocument(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = updateDocumentSchema.parse(req.body);
      const document = await storage.updateDocument(req.params.id, req.accountId!, data);
      res.json(document);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/documents/:id", requireAuth, requireOrgMember, requirePermission("documents", "delete"), async (req, res) => {
    try {
      const existing = await storage.getDocument(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteDocument(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/documents/:id/duplicate", requireAuth, requireOrgMember, requirePermission("documents", "create"), async (req, res) => {
    try {
      const existing = await storage.getDocument(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const duplicate = await storage.duplicateDocument(req.params.id);
      res.json(duplicate);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/documents/:id/export-pdf", requireAuth, requireOrgMember, requirePermission("documents", "read"), async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (document.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      console.log('📄 Starting PDF export for document:', document.id, document.name);

      // Import PDF generator
      const { generatePDF } = await import("./utils/pdf-generator");

      // Generate PDF
      const pdfBuffer = await generatePDF(document);

      // Create sanitized filename for download
      const sanitizedName = document.name.replace(/[^a-zA-Z0-9-_]/g, '_');
      const fileName = `${sanitizedName}.pdf`;

      console.log('✅ PDF export successful, sending to client');

      // Stream PDF directly to client (secure - no public storage)
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer, 'binary');
    } catch (error: any) {
      console.error('❌ Export PDF error:', error);
      console.error('Error stack:', error.stack);
      
      // Provide more detailed error message for debugging
      const errorMessage = error.message || 'Failed to export PDF';
      const detailedError = process.env.NODE_ENV === 'development' 
        ? { error: errorMessage, stack: error.stack, details: error.toString() }
        : { error: errorMessage };
      
      res.status(500).json(detailedError);
    }
  });

  // Document Links
  app.get("/api/document-links", requireAuth, requireOrgMember, requirePermission("documents", "read"), async (req, res) => {
    try {
      const links = await storage.getDocumentLinksByAccountId(req.accountId!);
      res.json(links);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/documents/:id/links", requireAuth, requireOrgMember, requirePermission("documents", "read"), async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (document.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const links = await storage.getDocumentLinksByDocumentId(req.params.id);
      res.json(links);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/documents/:id/links", requireAuth, requireOrgMember, requirePermission("documents", "create"), async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (document.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { insertDocumentLinkSchema } = await import("@shared/schema");
      const { targetType, targetId } = insertDocumentLinkSchema.parse(req.body);
      
      // Verify the target entity exists and belongs to the same account
      if (targetType === "project") {
        const project = await storage.getProject(targetId);
        if (!project || project.accountId !== req.accountId) {
          return res.status(404).json({ error: "Project not found or access denied" });
        }
      } else if (targetType === "client") {
        const client = await storage.getClient(req.accountId!, targetId);
        if (!client) {
          return res.status(404).json({ error: "Client not found or access denied" });
        }
      } else if (targetType === "deal") {
        const deal = await storage.getDeal(targetId);
        if (!deal || deal.accountId !== req.accountId) {
          return res.status(404).json({ error: "Deal not found or access denied" });
        }
      }

      const link = await storage.createDocumentLink({
        documentId: req.params.id,
        targetType,
        targetId,
      });
      
      res.json(link);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/documents/:id/links/:targetType/:targetId", requireAuth, requireOrgMember, requirePermission("documents", "delete"), async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (document.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteDocumentLink(
        req.params.id,
        req.params.targetType,
        req.params.targetId
      );
      
      if (!success) {
        return res.status(404).json({ error: "Link not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // FOLDERS & FILES - Protected Routes
  // ============================================

  app.get("/api/folders", requireAuth, requireOrgMember, requirePermission("documents", "read", "documents.files"), async (req, res) => {
    try {
      const folders = await storage.getFoldersByAccountId(req.accountId!);
      res.json(folders);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/folders", requireAuth, requireOrgMember, requirePermission("documents", "create", "documents.files"), async (req, res) => {
    try {
      const data = insertFolderSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      const folder = await storage.createFolder(data);
      res.json(folder);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/files", requireAuth, requireOrgMember, requirePermission("documents", "read", "documents.files"), async (req, res) => {
    try {
      const files = await storage.getFilesByAccountId(req.accountId!);
      res.json(files);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/folders/:folderId/files", requireAuth, requireOrgMember, requirePermission("documents", "read", "documents.files"), async (req, res) => {
    try {
      const files = await storage.getFilesByFolderId(req.params.folderId);
      res.json(files);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/files", requireAuth, requireOrgMember, requirePermission("documents", "create", "documents.files"), async (req, res) => {
    try {
      const data = insertFileSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      const file = await storage.createFile(data);

      // Create activity
      await storage.createActivity({
        accountId: req.accountId!,
        subjectType: "project",
        subjectId: req.accountId!,
        kind: "file",
        payload: { fileName: data.name, fileId: file.id },
        createdBy: req.userId || undefined,
      });

      res.json(file);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/files/:id", requireAuth, requireOrgMember, requirePermission("documents", "update", "documents.files"), async (req, res) => {
    try {
      const existing = await storage.getFile(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "File not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const file = await storage.updateFile(req.params.id, req.body);
      res.json(file);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/files/:id", requireAuth, requireOrgMember, requirePermission("documents", "delete", "documents.files"), async (req, res) => {
    try {
      const existing = await storage.getFile(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "File not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteFile(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // ACTIVITIES - Protected Routes
  // ============================================

  app.get("/api/activities", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const activities = await storage.getActivitiesByAccountId(req.accountId!, limit);
      console.log(`📊 Fetched ${activities.length} activities:`, activities.map(a => ({
        id: a.id,
        kind: a.kind,
        subjectType: a.subjectType,
        description: a.description || (a.payload as any)?.description,
        createdAt: a.createdAt
      })));
      res.json(activities);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get activities for a specific client
  app.get("/api/clients/:clientId/activities", requireAuth, requireOrgMember, requirePermission("crm", "read"), async (req, res) => {
    try {
      const { clientId } = req.params;
      const activities = await storage.getActivitiesBySubject(req.accountId!, 'client', clientId);
      res.json(activities);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get activities for a specific project
  app.get("/api/projects/:projectId/activities", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const { projectId } = req.params;
      const activities = await storage.getActivitiesBySubject(req.accountId!, 'project', projectId);
      res.json(activities);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new activity
  app.post("/api/activities", requireAuth, requireOrgMember, requirePermission("projects", "create"), async (req, res) => {
    try {
      const { subjectType, subjectId, kind, description, occurredAt, payload } = req.body;
      
      if (!subjectType || !subjectId || !kind) {
        return res.status(400).json({ error: "subjectType, subjectId, and kind are required" });
      }
      
      const activity = await storage.createActivity({
        accountId: req.accountId!,
        subjectType,
        subjectId,
        kind,
        description: description || null,
        occurredAt: occurredAt ? new Date(occurredAt) : null,
        payload: payload || {},
        createdBy: req.userId!,
      });
      
      res.status(201).json(activity);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update an activity
  app.patch("/api/activities/:id", requireAuth, requireOrgMember, requirePermission("projects", "update"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getActivity(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Activity not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { kind, description, occurredAt, payload } = req.body;
      const activity = await storage.updateActivity(id, {
        kind,
        description,
        occurredAt: occurredAt ? new Date(occurredAt) : null,
        payload,
      });
      
      res.json(activity);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete an activity
  app.delete("/api/activities/:id", requireAuth, requireOrgMember, requirePermission("projects", "delete"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getActivity(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Activity not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteActivity(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete all activities for a specific project (cleanup endpoint)
  app.delete("/api/projects/:projectId/activities", requireAuth, requireOrgMember, requirePermission("projects", "delete"), async (req, res) => {
    try {
      const { projectId } = req.params;
      const activities = await storage.getActivitiesBySubject("project", projectId);
      
      // Filter by account
      const accountActivities = activities.filter(a => a.accountId === req.accountId);
      
      // Delete each activity
      for (const activity of accountActivities) {
        await storage.deleteActivity(activity.id);
      }
      
      res.json({ success: true, deleted: accountActivities.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Cleanup all project activities (admin cleanup endpoint)
  app.delete("/api/admin/cleanup-project-activities", requireAuth, async (req, res) => {
    try {
      // Get all activities for the account
      const allActivities = await storage.getActivitiesByAccountId(req.accountId!, 10000);
      
      // Filter only project activities
      const projectActivities = allActivities.filter(a => a.subjectType === "project");
      
      // Delete each project activity
      for (const activity of projectActivities) {
        await storage.deleteActivity(activity.id);
      }
      
      res.json({ success: true, deleted: projectActivities.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // SEARCH - Protected Routes
  // ============================================

  app.get("/api/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      const results = await storage.searchAll(req.accountId!, query);
      res.json(results);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // DASHBOARD STATS - Protected Routes
  // ============================================

  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const [clients, projects, activities] = await Promise.all([
        storage.getClientsByAccountId(req.accountId!),
        storage.getProjectsByAccountId(req.accountId!),
        storage.getActivitiesByAccountId(req.accountId!, 10),
      ]);

      const activeProjects = projects.filter(p => p.stage !== 'done' && p.stage !== 'cancelled');
      const totalRevenue = clients.reduce((sum, c) => sum + (parseFloat(c.budget || '0')), 0);

      res.json({
        clientsCount: clients.length,
        activeProjectsCount: activeProjects.length,
        totalRevenue,
        recentActivities: activities,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // DEALS (Sales Pipeline) - Protected Routes
  // ============================================

  app.get("/api/deals", requireAuth, requireOrgMember, requirePermission("crm", "read", "crm.opportunities"), async (req, res) => {
    try {
      const deals = await storage.getDealsByAccountId(req.accountId!);
      res.json(deals);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/deals", requireAuth, requireOrgMember, requirePermission("crm", "create", "crm.opportunities"), async (req, res) => {
    try {
      const data = insertDealSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      const deal = await storage.createDeal(data);
      res.json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/deals/:id", requireAuth, requireOrgMember, requirePermission("crm", "read", "crm.opportunities"), async (req, res) => {
    try {
      const deal = await storage.getDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      if (deal.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/deals/:id", requireAuth, requireOrgMember, requirePermission("crm", "update", "crm.opportunities"), async (req, res) => {
    try {
      const existing = await storage.getDeal(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Deal not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const deal = await storage.updateDeal(req.params.id, req.body);
      res.json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/deals/:id", requireAuth, requireOrgMember, requirePermission("crm", "delete", "crm.opportunities"), async (req, res) => {
    try {
      const existing = await storage.getDeal(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Deal not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteDeal(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // PRODUCTS - Protected Routes
  // ============================================

  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProductsByAccountId(req.accountId!);
      res.json(products);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/products", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const data = insertProductSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      const product = await storage.createProduct(data);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      if (product.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/products/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const existing = await storage.getProduct(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const product = await storage.updateProduct(req.params.id, req.body);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/products/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const existing = await storage.getProduct(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // FEATURES - Protected Routes
  // ============================================

  app.get("/api/features", requireAuth, async (req, res) => {
    try {
      const features = await storage.getFeaturesByAccountId(req.accountId!);
      res.json(features);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/features", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const data = insertFeatureSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      const feature = await storage.createFeature(data);
      res.json(feature);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/features/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const existing = await storage.getFeature(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Feature not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const feature = await storage.updateFeature(req.params.id, req.body);
      res.json(feature);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/features/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const existing = await storage.getFeature(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Feature not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteFeature(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // ROADMAPS - Protected Routes
  // ============================================

  app.get("/api/roadmaps", requireAuth, requireOrgMember, requirePermission("roadmap", "read"), async (req, res) => {
    try {
      const roadmaps = await storage.getRoadmapsByAccountId(req.accountId!);
      res.json(roadmaps);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/roadmaps", requireAuth, requireOrgMember, requirePermission("roadmap", "create"), async (req, res) => {
    try {
      const data = insertRoadmapSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      const roadmap = await storage.createRoadmap(data);
      
      // Log activity
      if (req.userId) {
        await storage.createActivity({
          accountId: req.accountId!,
          subjectType: "roadmap",
          subjectId: roadmap.id,
          kind: "created",
          description: `Roadmap créée : ${roadmap.name}`,
          occurredAt: new Date(),
          payload: { description: `Roadmap créée : ${roadmap.name}` },
          createdBy: req.userId,
        });
      }
      
      res.json(roadmap);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/roadmaps/:id", requireAuth, requireOrgMember, requirePermission("roadmap", "read"), async (req, res) => {
    try {
      const roadmap = await storage.getRoadmap(req.params.id);
      if (!roadmap) {
        return res.status(404).json({ error: "Roadmap not found" });
      }
      if (roadmap.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(roadmap);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/roadmaps/:id", requireAuth, requireOrgMember, requirePermission("roadmap", "update"), async (req, res) => {
    try {
      const existing = await storage.getRoadmap(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Roadmap not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const roadmap = await storage.updateRoadmap(req.params.id, req.body);
      
      // Log activity
      if (req.userId) {
        await storage.createActivity({
          accountId: req.accountId!,
          subjectType: "roadmap",
          subjectId: roadmap!.id,
          kind: "updated",
          description: `Roadmap mise à jour : ${roadmap!.name}`,
          occurredAt: new Date(),
          payload: { description: `Roadmap mise à jour : ${roadmap!.name}` },
          createdBy: req.userId,
        });
      }
      
      res.json(roadmap);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/roadmaps/:id", requireAuth, requireOrgMember, requirePermission("roadmap", "delete"), async (req, res) => {
    try {
      const existing = await storage.getRoadmap(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Roadmap not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const roadmapName = existing.name;
      const success = await storage.deleteRoadmap(req.params.id);
      
      // Log activity
      if (req.userId) {
        await storage.createActivity({
          accountId: req.accountId!,
          subjectType: "roadmap",
          subjectId: req.params.id,
          kind: "deleted",
          description: `Roadmap supprimée : ${roadmapName}`,
          occurredAt: new Date(),
          payload: { description: `Roadmap supprimée : ${roadmapName}` },
          createdBy: req.userId,
        });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // ROADMAP ITEMS - Protected Routes
  // ============================================

  app.get("/api/roadmaps/:roadmapId/items", requireAuth, requireOrgMember, requirePermission("roadmap", "read"), async (req, res) => {
    try {
      // Verify the roadmap exists and belongs to user's account
      const roadmap = await storage.getRoadmap(req.params.roadmapId);
      if (!roadmap) {
        return res.status(404).json({ error: "Roadmap not found" });
      }
      if (roadmap.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const items = await storage.getRoadmapItemsByRoadmapId(req.params.roadmapId);
      
      // Calculate milestone status for milestone items
      const enrichedItems = items.map(item => {
        if (item.type === 'milestone') {
          return {
            ...item,
            milestoneStatus: calculateMilestoneStatus(item),
          };
        }
        return item;
      });
      
      res.json(enrichedItems);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/roadmap-items", requireAuth, requireOrgMember, requirePermission("roadmap", "create"), async (req, res) => {
    try {
      console.log("📌 Creating roadmap item, body:", JSON.stringify(req.body));
      const data = insertRoadmapItemSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      console.log("📌 Parsed data:", JSON.stringify(data));
      const item = await storage.createRoadmapItem(data);
      console.log("📌 Created item:", JSON.stringify(item));
      
      // Log activity - determine subject type based on item type
      const subjectType = item.type === "milestone" ? "milestone" : (item.type === "epic_group" || item.isGroup) ? "rubrique" : "roadmap_item";
      const typeLabel = item.type === "milestone" ? "Jalon" : (item.type === "epic_group" || item.isGroup) ? "Rubrique" : "Élément roadmap";
      if (req.userId) {
        await storage.createActivity({
          accountId: req.accountId!,
          subjectType,
          subjectId: item.id,
          kind: "created",
          description: `${typeLabel} créé : ${item.title}`,
          occurredAt: new Date(),
          payload: { description: `${typeLabel} créé : ${item.title}`, roadmapId: item.roadmapId },
          createdBy: req.userId,
        });
      }
      
      res.json(item);
    } catch (error: any) {
      console.error("❌ Error creating roadmap item:", error.message, error);
      res.status(400).json({ error: error.message });
    }
  });

  // Bulk update roadmap items with schema validation
  // IMPORTANT: This route MUST be defined BEFORE /api/roadmap-items/:id to avoid Express matching "bulk" as an :id
  app.patch("/api/roadmap-items/bulk", requireAuth, requireOrgMember, requirePermission("roadmap", "update"), async (req, res) => {
    try {
      const { itemIds, data } = req.body;
      
      console.log("📦 Bulk update request - itemIds:", JSON.stringify(itemIds), "data:", JSON.stringify(data));
      
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ error: "itemIds must be a non-empty array" });
      }

      // Validate UUID format for all itemIds
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const invalidIds = itemIds.filter((id: any) => typeof id !== 'string' || !uuidRegex.test(id));
      if (invalidIds.length > 0) {
        console.log("📦 Bulk update - Invalid UUIDs detected:", invalidIds);
        return res.status(400).json({ error: `Invalid UUID format for ids: ${invalidIds.join(', ')}` });
      }

      // Whitelist allowed fields for bulk update
      const allowedFields = ['type', 'priority', 'status', 'releaseTag', 'startDate', 'endDate', 'phase'];
      const sanitizedData: Record<string, any> = {};
      
      for (const key of Object.keys(data || {})) {
        if (allowedFields.includes(key)) {
          sanitizedData[key] = data[key];
        }
      }

      if (Object.keys(sanitizedData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      // Validate field values
      const validTypes = ['deliverable', 'milestone', 'initiative', 'free_block'];
      const validPriorities = ['low', 'normal', 'high', 'strategic'];
      const validStatuses = ['planned', 'in_progress', 'done', 'blocked'];
      const validReleaseTags = ['MVP', 'V1', 'V2', 'V3', 'Hotfix', 'Soon', null, ''];
      const validPhases = ['T1', 'T2', 'T3', 'T4', 'LT', null, ''];

      if (sanitizedData.type && !validTypes.includes(sanitizedData.type)) {
        return res.status(400).json({ error: "Invalid type value" });
      }
      if (sanitizedData.priority && !validPriorities.includes(sanitizedData.priority)) {
        return res.status(400).json({ error: "Invalid priority value" });
      }
      if (sanitizedData.status && !validStatuses.includes(sanitizedData.status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      if (sanitizedData.releaseTag !== undefined && !validReleaseTags.includes(sanitizedData.releaseTag)) {
        return res.status(400).json({ error: "Invalid releaseTag value" });
      }
      if (sanitizedData.phase !== undefined && !validPhases.includes(sanitizedData.phase)) {
        return res.status(400).json({ error: "Invalid phase value" });
      }
      
      // Normalize empty strings to null for nullable fields
      if (sanitizedData.releaseTag === '') {
        sanitizedData.releaseTag = null;
      }
      if (sanitizedData.phase === '') {
        sanitizedData.phase = null;
      }
      
      // Validate date formats
      if (sanitizedData.startDate) {
        const parsed = new Date(sanitizedData.startDate);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ error: "Invalid startDate format" });
        }
      }
      if (sanitizedData.endDate) {
        const parsed = new Date(sanitizedData.endDate);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ error: "Invalid endDate format" });
        }
      }

      const results = [];
      const errors: { id: string; reason: string }[] = [];
      
      for (const id of itemIds) {
        const existing = await storage.getRoadmapItem(id);
        if (!existing) {
          errors.push({ id, reason: "not_found" });
          continue;
        }
        
        const roadmap = await storage.getRoadmap(existing.roadmapId);
        if (!roadmap || roadmap.accountId !== req.accountId) {
          errors.push({ id, reason: "access_denied" });
          continue;
        }

        const updated = await storage.updateRoadmapItem(id, sanitizedData);
        results.push(updated);
      }

      res.json({ updated: results.length, items: results, errors });
    } catch (error: any) {
      console.error("🔴 BULK UPDATE ERROR:", error.message, error.stack);
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/roadmap-items/:id", requireAuth, requireOrgMember, requirePermission("roadmap", "update"), async (req, res) => {
    try {
      console.log("📅 Roadmap item PATCH request:", req.params.id, "body:", JSON.stringify(req.body));
      
      const existing = await storage.getRoadmapItem(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Roadmap item not found" });
      }
      
      // Verify access through roadmap
      const roadmap = await storage.getRoadmap(existing.roadmapId);
      if (!roadmap || roadmap.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Convert ISO dates to YYYY-MM-DD format for date columns
      const updateData = { ...req.body };
      if (updateData.startDate && typeof updateData.startDate === 'string') {
        updateData.startDate = updateData.startDate.split('T')[0];
      }
      if (updateData.endDate && typeof updateData.endDate === 'string') {
        updateData.endDate = updateData.endDate.split('T')[0];
      }

      const item = await storage.updateRoadmapItem(req.params.id, updateData);
      
      // Log activity - determine subject type based on item type
      const subjectType = item!.type === "milestone" ? "milestone" : (item!.type === "epic_group" || item!.isGroup) ? "rubrique" : "roadmap_item";
      const typeLabel = item!.type === "milestone" ? "Jalon" : (item!.type === "epic_group" || item!.isGroup) ? "Rubrique" : "Élément roadmap";
      if (req.userId) {
        await storage.createActivity({
          accountId: req.accountId!,
          subjectType,
          subjectId: item!.id,
          kind: "updated",
          description: `${typeLabel} mis à jour : ${item!.title}`,
          occurredAt: new Date(),
          payload: { description: `${typeLabel} mis à jour : ${item!.title}`, roadmapId: item!.roadmapId },
          createdBy: req.userId,
        });
      }
      
      res.json(item);
    } catch (error: any) {
      console.error("📅 Roadmap item PATCH error:", error.message, error.stack);
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/roadmap-items/:id", requireAuth, requireOrgMember, requirePermission("roadmap", "delete"), async (req, res) => {
    try {
      const existing = await storage.getRoadmapItem(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Roadmap item not found" });
      }
      
      // Verify access through roadmap
      const roadmap = await storage.getRoadmap(existing.roadmapId);
      if (!roadmap || roadmap.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Store info before deletion for activity logging
      const subjectType = existing.type === "milestone" ? "milestone" : (existing.type === "epic_group" || existing.isGroup) ? "rubrique" : "roadmap_item";
      const typeLabel = existing.type === "milestone" ? "Jalon" : (existing.type === "epic_group" || existing.isGroup) ? "Rubrique" : "Élément roadmap";
      const itemTitle = existing.title;
      const roadmapId = existing.roadmapId;
      
      const success = await storage.deleteRoadmapItem(req.params.id);
      
      // Log activity
      if (req.userId) {
        await storage.createActivity({
          accountId: req.accountId!,
          subjectType,
          subjectId: req.params.id,
          kind: "deleted",
          description: `${typeLabel} supprimé : ${itemTitle}`,
          occurredAt: new Date(),
          payload: { description: `${typeLabel} supprimé : ${itemTitle}`, roadmapId },
          createdBy: req.userId,
        });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Bulk delete roadmap items - using POST instead of DELETE for reliable body parsing
  app.post("/api/roadmap-items/bulk-delete", requireAuth, requireOrgMember, requirePermission("roadmap", "delete"), async (req, res) => {
    try {
      const { itemIds } = req.body;
      
      console.log("🗑️ Bulk delete request - itemIds:", JSON.stringify(itemIds));
      
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ error: "itemIds must be a non-empty array" });
      }
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const invalidIds = itemIds.filter(id => !uuidRegex.test(id));
      if (invalidIds.length > 0) {
        console.log("🗑️ Invalid UUIDs detected:", invalidIds);
        return res.status(400).json({ error: `Invalid UUID format for ids: ${invalidIds.join(', ')}` });
      }

      let deleted = 0;
      const errors: { id: string; reason: string }[] = [];
      
      for (const id of itemIds) {
        const existing = await storage.getRoadmapItem(id);
        if (!existing) {
          errors.push({ id, reason: "not_found" });
          continue;
        }
        
        const roadmap = await storage.getRoadmap(existing.roadmapId);
        if (!roadmap || roadmap.accountId !== req.accountId) {
          errors.push({ id, reason: "access_denied" });
          continue;
        }

        await storage.deleteRoadmapItem(id);
        deleted++;
      }

      res.json({ deleted, success: true, errors });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get roadmaps by project ID
  app.get("/api/projects/:projectId/roadmaps", requireAuth, requireOrgMember, requirePermission("roadmap", "read"), async (req, res) => {
    try {
      const roadmaps = await storage.getRoadmapsByProjectId(req.accountId!, req.params.projectId);
      res.json(roadmaps);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get roadmap phases for a project (T1/T2/T3/LT based on project startDate)
  app.get("/api/projects/:projectId/roadmap/phases", requireAuth, requireOrgMember, requirePermission("roadmap", "read"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Calculate phase boundaries based on project startDate
      const startDate = project.startDate ? new Date(project.startDate) : new Date();
      const now = new Date();

      // Phase boundaries (T1: 0-3 months, T2: 3-6 months, T3: 6-9 months, LT: beyond)
      const t1End = new Date(startDate);
      t1End.setMonth(t1End.getMonth() + 3);
      
      const t2End = new Date(startDate);
      t2End.setMonth(t2End.getMonth() + 6);
      
      const t3End = new Date(startDate);
      t3End.setMonth(t3End.getMonth() + 9);

      // Determine current phase
      let currentPhase = 'LT';
      if (now < t1End) currentPhase = 'T1';
      else if (now < t2End) currentPhase = 'T2';
      else if (now < t3End) currentPhase = 'T3';

      // Calculate days until next phase change
      let nextPhaseDate: Date | null = null;
      let nextPhase: string | null = null;
      if (currentPhase === 'T1') {
        nextPhaseDate = t1End;
        nextPhase = 'T2';
      } else if (currentPhase === 'T2') {
        nextPhaseDate = t2End;
        nextPhase = 'T3';
      } else if (currentPhase === 'T3') {
        nextPhaseDate = t3End;
        nextPhase = 'LT';
      }

      const daysUntilNextPhase = nextPhaseDate 
        ? Math.ceil((nextPhaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Get roadmap items for this project and count by phase
      const roadmaps = await storage.getRoadmapsByProjectId(req.accountId!, req.params.projectId);
      let items: any[] = [];
      for (const roadmap of roadmaps) {
        const roadmapItems = await storage.getRoadmapItemsByRoadmapId(roadmap.id);
        items = items.concat(roadmapItems);
      }

      // Helper function to calculate phase from a date
      const getPhaseFromDate = (date: Date): string => {
        if (date < t1End) return 'T1';
        if (date < t2End) return 'T2';
        if (date < t3End) return 'T3';
        return 'LT';
      };

      // Count items by phase (using stored phase or calculated from dates)
      const phasesCounts = { T1: 0, T2: 0, T3: 0, LT: 0, unassigned: 0 };
      const lateItems: any[] = [];
      const itemsWithoutDates: any[] = [];

      for (const item of items) {
        let itemPhase = item.phase;
        
        // If no phase stored, calculate from dates
        if (!itemPhase) {
          if (item.startDate) {
            itemPhase = getPhaseFromDate(new Date(item.startDate));
          } else if (item.targetDate) {
            itemPhase = getPhaseFromDate(new Date(item.targetDate));
          } else if (item.endDate) {
            itemPhase = getPhaseFromDate(new Date(item.endDate));
          }
        }

        if (itemPhase && phasesCounts[itemPhase as keyof typeof phasesCounts] !== undefined) {
          phasesCounts[itemPhase as keyof typeof phasesCounts]++;
        } else {
          phasesCounts.unassigned++;
          itemsWithoutDates.push(item);
        }

        // Check for late items (endDate < now and status != done)
        if (item.endDate && new Date(item.endDate) < now && item.status !== 'done') {
          lateItems.push(item);
        }
      }

      res.json({
        projectStartDate: project.startDate,
        projectEndDate: project.endDate,
        currentPhase,
        phases: {
          T1: {
            start: startDate.toISOString().split('T')[0],
            end: t1End.toISOString().split('T')[0],
            isCurrent: currentPhase === 'T1',
            itemCount: phasesCounts.T1,
          },
          T2: {
            start: t1End.toISOString().split('T')[0],
            end: t2End.toISOString().split('T')[0],
            isCurrent: currentPhase === 'T2',
            itemCount: phasesCounts.T2,
          },
          T3: {
            start: t2End.toISOString().split('T')[0],
            end: t3End.toISOString().split('T')[0],
            isCurrent: currentPhase === 'T3',
            itemCount: phasesCounts.T3,
          },
          LT: {
            start: t3End.toISOString().split('T')[0],
            end: null,
            isCurrent: currentPhase === 'LT',
            itemCount: phasesCounts.LT,
          },
        },
        nextPhaseTransition: nextPhaseDate ? {
          date: nextPhaseDate.toISOString().split('T')[0],
          phase: nextPhase,
          daysUntil: daysUntilNextPhase,
        } : null,
        indicators: {
          totalItems: items.length,
          lateItemsCount: lateItems.length,
          itemsWithoutDatesCount: itemsWithoutDates.length,
          unassignedPhaseCount: phasesCounts.unassigned,
        },
        lateItems: lateItems.slice(0, 5).map(i => ({ id: i.id, title: i.title, endDate: i.endDate })),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Helper function to calculate milestone status
  function calculateMilestoneStatus(milestone: any, linkedProgress?: number): string {
    const now = new Date();
    const targetDate = milestone.targetDate || milestone.endDate;
    
    // If already validated
    if (milestone.validatedAt) {
      return 'validated';
    }
    
    // If marked as done
    if (milestone.status === 'done') {
      return 'validated';
    }
    
    // If no target date, status unknown
    if (!targetDate) {
      return 'upcoming';
    }
    
    const target = new Date(targetDate);
    const daysUntilTarget = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // If target date is past
    if (daysUntilTarget < 0) {
      return 'overdue';
    }
    
    // Calculate expected progress based on time
    const startDate = milestone.startDate ? new Date(milestone.startDate) : null;
    let expectedProgress = 0;
    
    if (startDate && startDate < target) {
      const totalDays = (target.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const elapsedDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      expectedProgress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
    }
    
    const actualProgress = linkedProgress !== undefined ? linkedProgress : (milestone.progress || 0);
    
    // At risk: less than 14 days remaining OR behind schedule
    if (daysUntilTarget <= 14 && actualProgress < expectedProgress * 0.8) {
      return 'at_risk';
    }
    
    // Achievable: on track with progress
    if (actualProgress >= expectedProgress * 0.8) {
      return 'achievable';
    }
    
    // Upcoming: far in the future
    if (daysUntilTarget > 30) {
      return 'upcoming';
    }
    
    // Default to at_risk if close but not on track
    return actualProgress >= 50 ? 'achievable' : 'at_risk';
  }

  // Get milestones for a project (roadmap items with type='milestone')
  app.get("/api/projects/:projectId/roadmap/milestones", requireAuth, requireOrgMember, requirePermission("roadmap", "read"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get all roadmaps for the project
      const roadmaps = await storage.getRoadmapsByProjectId(req.accountId!, req.params.projectId);
      let milestones: any[] = [];
      
      for (const roadmap of roadmaps) {
        const items = await storage.getRoadmapItemsByRoadmapId(roadmap.id);
        const roadmapMilestones = items.filter(item => item.type === 'milestone');
        milestones = milestones.concat(roadmapMilestones);
      }

      // Auto-mark milestones as done when target date has passed
      const now = new Date();
      for (const milestone of milestones) {
        const targetDate = milestone.targetDate || milestone.endDate;
        if (targetDate && milestone.status !== 'done' && !milestone.validatedAt) {
          const target = new Date(targetDate);
          if (target < now) {
            // Auto-mark as done in database
            await storage.updateRoadmapItem(milestone.id, { status: 'done' });
            milestone.status = 'done';
          }
        }
      }

      // Calculate status for each milestone
      const milestonesWithStatus = milestones.map(m => ({
        ...m,
        milestoneStatus: calculateMilestoneStatus(m),
      }));

      // Sort by targetDate (soonest first)
      milestonesWithStatus.sort((a, b) => {
        const dateA = a.targetDate || a.endDate || '9999-12-31';
        const dateB = b.targetDate || b.endDate || '9999-12-31';
        return dateA.localeCompare(dateB);
      });

      // Find next upcoming milestone
      const upcomingMilestones = milestonesWithStatus.filter(m => {
        const targetDate = m.targetDate || m.endDate;
        return targetDate && new Date(targetDate) >= now && m.milestoneStatus !== 'validated';
      });

      // Count by status
      const atRiskMilestones = milestonesWithStatus.filter(m => m.milestoneStatus === 'at_risk');
      const overdueMilestones = milestonesWithStatus.filter(m => m.milestoneStatus === 'overdue');
      const criticalAtRisk = milestonesWithStatus.filter(m => m.isCritical && (m.milestoneStatus === 'at_risk' || m.milestoneStatus === 'overdue'));

      res.json({
        milestones: milestonesWithStatus,
        totalCount: milestonesWithStatus.length,
        upcomingCount: upcomingMilestones.length,
        completedCount: milestonesWithStatus.filter(m => m.milestoneStatus === 'validated').length,
        atRiskCount: atRiskMilestones.length,
        overdueCount: overdueMilestones.length,
        criticalAtRiskCount: criticalAtRisk.length,
        nextMilestone: upcomingMilestones[0] || null,
        nextCriticalMilestone: upcomingMilestones.find(m => m.isCritical) || null,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get roadmap recommendations based on milestone status
  app.get("/api/projects/:projectId/roadmap/recommendations", requireAuth, requireOrgMember, requirePermission("roadmap", "read"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const roadmaps = await storage.getRoadmapsByProjectId(req.accountId!, req.params.projectId);
      let milestones: any[] = [];
      let allItems: any[] = [];
      
      for (const roadmap of roadmaps) {
        const items = await storage.getRoadmapItemsByRoadmapId(roadmap.id);
        allItems = allItems.concat(items);
        const roadmapMilestones = items.filter(item => item.type === 'milestone');
        milestones = milestones.concat(roadmapMilestones);
      }

      const recommendations: Array<{
        id: string;
        type: 'warning' | 'critical' | 'info' | 'suggestion';
        title: string;
        description: string;
        action?: string;
        relatedItemId?: string;
        relatedItemTitle?: string;
        priority: number;
      }> = [];

      const now = new Date();

      // Analyze milestones and generate recommendations
      for (const milestone of milestones) {
        const status = calculateMilestoneStatus(milestone);
        const targetDate = milestone.targetDate || milestone.endDate;
        const daysUntilTarget = targetDate 
          ? Math.ceil((new Date(targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        // Critical: Overdue critical milestones
        if (status === 'overdue' && milestone.isCritical) {
          recommendations.push({
            id: `crit-overdue-${milestone.id}`,
            type: 'critical',
            title: 'Jalon critique en retard',
            description: `Le jalon "${milestone.title}" est critique et en retard. Une action immédiate est requise.`,
            action: 'Réviser les dépendances et établir un plan de rattrapage',
            relatedItemId: milestone.id,
            relatedItemTitle: milestone.title,
            priority: 100,
          });
        }
        // Warning: Overdue non-critical milestones  
        else if (status === 'overdue') {
          recommendations.push({
            id: `warn-overdue-${milestone.id}`,
            type: 'warning',
            title: 'Jalon en retard',
            description: `Le jalon "${milestone.title}" a dépassé sa date cible.`,
            action: 'Mettre à jour la date ou marquer comme terminé',
            relatedItemId: milestone.id,
            relatedItemTitle: milestone.title,
            priority: 70,
          });
        }
        // Critical: At-risk critical milestones
        else if (status === 'at_risk' && milestone.isCritical) {
          recommendations.push({
            id: `crit-risk-${milestone.id}`,
            type: 'critical',
            title: 'Jalon critique à risque',
            description: `Le jalon critique "${milestone.title}" est à risque (${daysUntilTarget !== null ? `${daysUntilTarget}j restants` : ''}).`,
            action: 'Intensifier le suivi et débloquer les obstacles',
            relatedItemId: milestone.id,
            relatedItemTitle: milestone.title,
            priority: 90,
          });
        }
        // Warning: At-risk non-critical milestones
        else if (status === 'at_risk') {
          recommendations.push({
            id: `warn-risk-${milestone.id}`,
            type: 'warning',
            title: 'Jalon à risque',
            description: `Le jalon "${milestone.title}" pourrait ne pas être atteint à temps (${daysUntilTarget !== null ? `${daysUntilTarget}j restants` : ''}).`,
            action: 'Vérifier les blocages et ajuster si nécessaire',
            relatedItemId: milestone.id,
            relatedItemTitle: milestone.title,
            priority: 50,
          });
        }
        // Info: Upcoming validation required
        else if (milestone.validationRequired && milestone.validationRequired !== 'none' && status === 'achievable' && daysUntilTarget !== null && daysUntilTarget <= 14) {
          const validationLabels: { [key: string]: string } = {
            client: 'du client',
            internal: 'interne',
            external: 'externe',
          };
          recommendations.push({
            id: `info-validation-${milestone.id}`,
            type: 'info',
            title: 'Validation à planifier',
            description: `Le jalon "${milestone.title}" nécessite une validation ${validationLabels[milestone.validationRequired] || ''} dans ${daysUntilTarget}j.`,
            action: 'Préparer la session de validation',
            relatedItemId: milestone.id,
            relatedItemTitle: milestone.title,
            priority: 30,
          });
        }
      }

      // General recommendations
      const milestonesWithoutDates = milestones.filter(m => !m.targetDate && !m.endDate);
      if (milestonesWithoutDates.length > 0) {
        recommendations.push({
          id: 'suggestion-no-dates',
          type: 'suggestion',
          title: 'Jalons sans dates',
          description: `${milestonesWithoutDates.length} jalon(s) n'ont pas de date cible définie.`,
          action: 'Définir des dates pour améliorer le suivi',
          priority: 20,
        });
      }

      // Check for items without phase
      const itemsWithoutPhase = allItems.filter(i => !i.phase);
      if (itemsWithoutPhase.length > 0) {
        recommendations.push({
          id: 'suggestion-no-phase',
          type: 'suggestion',
          title: 'Éléments sans phase',
          description: `${itemsWithoutPhase.length} élément(s) n'ont pas de phase assignée.`,
          action: 'Assigner les éléments à une phase pour structurer la roadmap',
          priority: 15,
          relatedItems: itemsWithoutPhase.slice(0, 10).map(i => ({ id: i.id, title: i.title })),
        });
      }

      // Sort recommendations by priority (highest first)
      recommendations.sort((a, b) => b.priority - a.priority);

      res.json({
        recommendations,
        summary: {
          criticalCount: recommendations.filter(r => r.type === 'critical').length,
          warningCount: recommendations.filter(r => r.type === 'warning').length,
          infoCount: recommendations.filter(r => r.type === 'info').length,
          suggestionCount: recommendations.filter(r => r.type === 'suggestion').length,
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Import CDC (Cahier des Charges) items into roadmap
  app.post("/api/projects/:projectId/roadmap/import-cdc", requireAuth, requireOrgMember, requirePermission("roadmap", "create"), async (req, res) => {
    try {
      console.log("📥 Import CDC started for project:", req.params.projectId);
      
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        console.log("❌ Project not found");
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        console.log("❌ Access denied - accountId mismatch");
        return res.status(403).json({ error: "Access denied" });
      }

      // Get scope items for this project
      const scopeItems = await storage.getScopeItemsByProjectId(req.params.projectId);
      console.log("📋 Found scope items:", scopeItems?.length || 0);
      
      if (!scopeItems || scopeItems.length === 0) {
        console.log("❌ No scope items found for project");
        return res.status(400).json({ error: "Aucun élément CDC trouvé pour ce projet" });
      }

      // Get or create roadmap for this project
      let roadmaps = await storage.getRoadmapsByProjectId(req.accountId!, req.params.projectId);
      console.log("📋 Found roadmaps:", roadmaps.length, roadmaps.map(r => ({ id: r.id, name: r.name })));
      let roadmap = roadmaps[0];
      
      if (!roadmap) {
        roadmap = await storage.createRoadmap({
          accountId: req.accountId!,
          projectId: req.params.projectId,
          name: project.name + " - Roadmap",
          description: "Roadmap générée depuis le CDC",
        });
      }

      // Calculate phase dates based on project start date
      // All items in the same phase start at the same date:
      // T1: project start date (J+0)
      // T2: J+90 days
      // T3: J+180 days
      // T4/LT: J+270 days
      const projectStartDate = project.startDate ? new Date(project.startDate) : new Date();
      const DAY_MS = 24 * 60 * 60 * 1000;
      
      const getPhaseStartDate = (phase: string | null): Date => {
        const baseTime = projectStartDate.getTime();
        switch (phase) {
          case 'T1': return new Date(baseTime);
          case 'T2': return new Date(baseTime + 90 * DAY_MS);
          case 'T3': return new Date(baseTime + 180 * DAY_MS);
          case 'T4': 
          case 'LT': return new Date(baseTime + 270 * DAY_MS);
          default: return new Date(baseTime); // Default to project start
        }
      };

      const getPhaseEndDate = (phase: string | null, estimatedDays: number | null): Date => {
        const start = getPhaseStartDate(phase);
        // Use the estimated days from CDC, default to 7 days if not specified
        const days = estimatedDays && estimatedDays > 0 ? Math.ceil(estimatedDays) : 7;
        return new Date(start.getTime() + days * DAY_MS);
      };

      // Filter out items that already have a roadmap item generated
      const itemsToImport = scopeItems.filter(item => !item.generatedRoadmapItemId);
      console.log("📋 Items to import (without generatedRoadmapItemId):", itemsToImport.length);
      console.log("📋 Items already imported:", scopeItems.length - itemsToImport.length);
      
      if (itemsToImport.length === 0) {
        console.log("⚠️ All items already imported, nothing to do");
        return res.json({ 
          message: "Tous les éléments CDC ont déjà été importés", 
          importedCount: 0,
          skippedCount: scopeItems.length
        });
      }

      // Create roadmap items for each scope item
      console.log("🔨 Creating roadmap items for roadmap:", roadmap.id);
      const createdItems: any[] = [];
      for (const scopeItem of itemsToImport) {
        const startDate = getPhaseStartDate(scopeItem.phase);
        const endDate = getPhaseEndDate(scopeItem.phase, scopeItem.estimatedDays ? parseFloat(String(scopeItem.estimatedDays)) : null);
        
        const roadmapItem = await storage.createRoadmapItem({
          roadmapId: roadmap.id,
          title: scopeItem.label,
          description: scopeItem.description || undefined,
          type: 'deliverable',
          status: 'planned',
          phase: scopeItem.phase || undefined,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          progress: 0,
          sourceType: 'cdc',
          sourceId: scopeItem.id,
        });
        
        // Update scope item with generated roadmap item ID
        await storage.updateScopeItem(scopeItem.id, {
          generatedRoadmapItemId: roadmapItem.id,
        });
        
        createdItems.push(roadmapItem);
      }

      res.json({
        message: `${createdItems.length} élément(s) importé(s) avec succès`,
        importedCount: createdItems.length,
        skippedCount: scopeItems.length - itemsToImport.length,
        items: createdItems,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Diagnostic endpoint for CDC import issues - reset orphaned scope items
  app.post("/api/projects/:projectId/roadmap/reset-cdc", requireAuth, requireOrgMember, requirePermission("roadmap", "update"), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get scope items for this project
      const scopeItems = await storage.getScopeItemsByProjectId(req.params.projectId);
      
      // Get roadmaps for this project
      const roadmaps = await storage.getRoadmapsByProjectId(req.accountId!, req.params.projectId);
      const roadmap = roadmaps[0];
      
      // Get all roadmap items
      const roadmapItems = roadmap ? await storage.getRoadmapItemsByRoadmapId(roadmap.id) : [];
      const roadmapItemIds = new Set(roadmapItems.map(ri => ri.id));
      
      // Find orphaned scope items (have generatedRoadmapItemId but the item doesn't exist)
      const orphanedItems = scopeItems.filter(si => 
        si.generatedRoadmapItemId && !roadmapItemIds.has(si.generatedRoadmapItemId)
      );
      
      console.log("🔍 Diagnostic:", {
        totalScopeItems: scopeItems.length,
        scopeItemsWithRoadmapId: scopeItems.filter(si => si.generatedRoadmapItemId).length,
        actualRoadmapItems: roadmapItems.length,
        orphanedItems: orphanedItems.length,
      });
      
      // Reset orphaned scope items
      for (const item of orphanedItems) {
        await storage.updateScopeItem(item.id, {
          generatedRoadmapItemId: null,
        });
      }
      
      res.json({
        message: `${orphanedItems.length} élément(s) CDC réinitialisé(s)`,
        resetCount: orphanedItems.length,
        diagnostic: {
          totalScopeItems: scopeItems.length,
          scopeItemsWithRoadmapId: scopeItems.filter(si => si.generatedRoadmapItemId).length,
          actualRoadmapItems: roadmapItems.length,
          orphanedItems: orphanedItems.length,
        }
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get backlogs by project ID
  app.get("/api/projects/:projectId/backlogs", requireAuth, requireOrgMember, requirePermission("product", "read", "product.backlog"), async (req, res) => {
    try {
      const projectBacklogs = await db.select().from(backlogs)
        .where(and(
          eq(backlogs.accountId, req.accountId!),
          eq(backlogs.projectId, req.params.projectId)
        ))
        .orderBy(desc(backlogs.createdAt));
      res.json(projectBacklogs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // ROADMAP ITEM LINKS
  // ============================================

  // Get links for a roadmap item
  app.get("/api/roadmap-items/:id/links", requireAuth, requireOrgMember, requirePermission("roadmap", "read"), async (req, res) => {
    try {
      const item = await storage.getRoadmapItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Roadmap item not found" });
      }
      const roadmap = await storage.getRoadmap(item.roadmapId);
      if (!roadmap || roadmap.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const links = await storage.getRoadmapItemLinksByItemId(req.params.id);
      res.json(links);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a link for a roadmap item
  app.post("/api/roadmap-items/:id/links", requireAuth, requireOrgMember, requirePermission("roadmap", "create"), async (req, res) => {
    try {
      const item = await storage.getRoadmapItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Roadmap item not found" });
      }
      const roadmap = await storage.getRoadmap(item.roadmapId);
      if (!roadmap || roadmap.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const data = insertRoadmapItemLinkSchema.parse({
        ...req.body,
        roadmapItemId: req.params.id,
      });
      const link = await storage.createRoadmapItemLink(data);
      res.json(link);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a link
  app.delete("/api/roadmap-item-links/:id", requireAuth, requireOrgMember, requirePermission("roadmap", "delete"), async (req, res) => {
    try {
      const success = await storage.deleteRoadmapItemLink(req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // ROADMAP DEPENDENCIES
  // ============================================

  // Get dependencies for a roadmap item
  app.get("/api/roadmap-items/:id/dependencies", requireAuth, requireOrgMember, requirePermission("roadmap", "read"), async (req, res) => {
    try {
      const item = await storage.getRoadmapItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Roadmap item not found" });
      }
      const roadmap = await storage.getRoadmap(item.roadmapId);
      if (!roadmap || roadmap.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const dependencies = await storage.getRoadmapDependenciesByItemId(req.params.id);
      res.json(dependencies);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all dependencies for a roadmap
  app.get("/api/roadmaps/:roadmapId/dependencies", requireAuth, requireOrgMember, requirePermission("roadmap", "read"), async (req, res) => {
    try {
      const roadmap = await storage.getRoadmap(req.params.roadmapId);
      if (!roadmap) {
        return res.status(404).json({ error: "Roadmap not found" });
      }
      if (roadmap.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const dependencies = await storage.getRoadmapDependenciesByRoadmapId(req.params.roadmapId);
      res.json(dependencies);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a dependency
  app.post("/api/roadmap-items/:id/dependencies", requireAuth, requireOrgMember, requirePermission("roadmap", "create"), async (req, res) => {
    try {
      const item = await storage.getRoadmapItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Roadmap item not found" });
      }
      const roadmap = await storage.getRoadmap(item.roadmapId);
      if (!roadmap || roadmap.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const data = insertRoadmapDependencySchema.parse({
        ...req.body,
        roadmapItemId: req.params.id,
      });
      const dependency = await storage.createRoadmapDependency(data);
      res.json(dependency);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a dependency
  app.delete("/api/roadmap-dependencies/:id", requireAuth, requireOrgMember, requirePermission("roadmap", "delete"), async (req, res) => {
    try {
      const success = await storage.deleteRoadmapDependency(req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // ROADMAP PROGRESS CALCULATION
  // ============================================

  // Calculate and update progress for a roadmap item based on linked entities
  app.post("/api/roadmap-items/:id/calculate-progress", requireAuth, requireOrgMember, requirePermission("roadmap", "read"), async (req, res) => {
    try {
      const item = await storage.getRoadmapItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Roadmap item not found" });
      }
      const roadmap = await storage.getRoadmap(item.roadmapId);
      if (!roadmap || roadmap.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if item is set to automatic progress calculation
      // Allow forced calculation via query param for switching to auto mode
      const forceAuto = req.query.force === "true";
      if (item.progressMode !== "linked_auto" && !forceAuto) {
        return res.status(400).json({ 
          error: "Item is in manual progress mode. Use ?force=true to switch to automatic mode." 
        });
      }

      // Get all links for this item
      const links = await storage.getRoadmapItemLinksByItemId(req.params.id);
      
      if (links.length === 0) {
        // No links - set progress based on status
        let progress = item.progress;
        if (item.status === "done") {
          progress = 100;
        } else if (item.status === "blocked") {
          progress = item.progress; // Keep current
        } else if (item.status === "planned" && item.progress === 0) {
          progress = 0;
        }
        
        const updateData: any = { progress };
        if (forceAuto) {
          updateData.progressMode = "linked_auto";
        }
        const updatedItem = await storage.updateRoadmapItem(req.params.id, updateData);
        return res.json({ item: updatedItem, calculatedProgress: progress, linkCount: 0 });
      }

      // Calculate weighted progress from linked entities
      let totalWeight = 0;
      let weightedProgress = 0;

      for (const link of links) {
        const weight = link.weight || 1;
        let linkedProgress = 0;

        if (link.linkedId) {
          switch (link.linkedType) {
            case "task":
            case "ticket": {
              const task = await storage.getTask(link.linkedId);
              if (task) {
                // Use task progress or derive from status
                if (task.progress !== undefined && task.progress > 0) {
                  linkedProgress = task.progress;
                } else {
                  linkedProgress = task.status === "done" ? 100 :
                                   task.status === "review" ? 75 :
                                   task.status === "in_progress" ? 50 : 0;
                }
              }
              break;
            }
            case "epic":
            case "cdc_section": {
              // Epics and CDC sections - use default progress based on type
              linkedProgress = 50; // Assume 50% for linked entities without direct progress
              break;
            }
            case "free_reference":
            default:
              // For free references without linked ID, skip
              continue;
          }
        } else {
          // No linked ID (free reference) - skip from calculation
          continue;
        }

        totalWeight += weight;
        weightedProgress += linkedProgress * weight;
      }

      const calculatedProgress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;

      // Update the item with calculated progress
      const updateData: any = { progress: calculatedProgress };
      if (forceAuto) {
        updateData.progressMode = "linked_auto";
      }
      const updatedItem = await storage.updateRoadmapItem(req.params.id, updateData);

      res.json({ 
        item: updatedItem, 
        calculatedProgress, 
        linkCount: links.length,
        totalWeight 
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Recalculate progress for all items in a roadmap
  app.post("/api/roadmaps/:roadmapId/calculate-progress", requireAuth, requireOrgMember, requirePermission("roadmap", "read"), async (req, res) => {
    try {
      const roadmap = await storage.getRoadmap(req.params.roadmapId);
      if (!roadmap) {
        return res.status(404).json({ error: "Roadmap not found" });
      }
      if (roadmap.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const items = await storage.getRoadmapItemsByRoadmapId(req.params.roadmapId);
      const autoItems = items.filter(i => i.progressMode === "linked_auto");
      
      const results = [];
      for (const item of autoItems) {
        const links = await storage.getRoadmapItemLinksByItemId(item.id);
        
        if (links.length === 0) {
          results.push({ id: item.id, progress: item.progress, linkCount: 0 });
          continue;
        }

        let totalWeight = 0;
        let weightedProgress = 0;

        for (const link of links) {
          const weight = link.weight || 1;
          let linkedProgress = 0;

          if (link.linkedId) {
            switch (link.linkedType) {
              case "task":
              case "ticket": {
                const task = await storage.getTask(link.linkedId);
                if (task) {
                  if (task.progress !== undefined && task.progress > 0) {
                    linkedProgress = task.progress;
                  } else {
                    linkedProgress = task.status === "done" ? 100 :
                                     task.status === "review" ? 75 :
                                     task.status === "in_progress" ? 50 : 0;
                  }
                }
                break;
              }
              case "epic":
              case "cdc_section":
                linkedProgress = 50;
                break;
              default:
                continue;
            }
          } else {
            continue;
          }

          totalWeight += weight;
          weightedProgress += linkedProgress * weight;
        }

        const calculatedProgress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
        await storage.updateRoadmapItem(item.id, { progress: calculatedProgress });
        results.push({ id: item.id, progress: calculatedProgress, linkCount: links.length });
      }

      res.json({ 
        roadmapId: req.params.roadmapId,
        itemsUpdated: results.length,
        results 
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // OKR ROUTES
  // ============================================

  // Get OKR objectives for a project
  app.get("/api/projects/:projectId/okr/objectives", requireAuth, requireOrgMember, requirePermission("roadmap", "read", "roadmap.okr"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const projectId = req.params.projectId;
      
      const objectives = await db.select().from(okrObjectives)
        .where(and(eq(okrObjectives.accountId, accountId), eq(okrObjectives.projectId, projectId)))
        .orderBy(okrObjectives.position);
      
      res.json(objectives);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get full OKR tree for a project (objectives + key results + links)
  app.get("/api/projects/:projectId/okr", requireAuth, requireOrgMember, requirePermission("roadmap", "read", "roadmap.okr"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const projectId = req.params.projectId;
      
      const objectives = await db.select().from(okrObjectives)
        .where(and(eq(okrObjectives.accountId, accountId), eq(okrObjectives.projectId, projectId)))
        .orderBy(okrObjectives.position);
      
      const objectiveIds = objectives.map(o => o.id);
      
      let keyResults: any[] = [];
      let links: any[] = [];
      
      if (objectiveIds.length > 0) {
        keyResults = await db.select().from(okrKeyResults)
          .where(and(
            eq(okrKeyResults.accountId, accountId),
            inArray(okrKeyResults.objectiveId, objectiveIds)
          ))
          .orderBy(okrKeyResults.position);
        
        const krIds = keyResults.map(kr => kr.id);
        if (krIds.length > 0) {
          links = await db.select().from(okrLinks)
            .where(and(
              eq(okrLinks.accountId, accountId),
              inArray(okrLinks.keyResultId, krIds)
            ));
        }
      }
      
      // Fetch linked entity details
      const taskIds = links.filter(l => l.entityType === "task").map(l => l.entityId);
      const epicIds = links.filter(l => l.entityType === "epic").map(l => l.entityId);
      const sprintIds = links.filter(l => l.entityType === "sprint").map(l => l.entityId);
      const roadmapItemIds = links.filter(l => l.entityType === "roadmap_item").map(l => l.entityId);
      
      let linkedTasks: any[] = [];
      let linkedEpics: any[] = [];
      let linkedSprints: any[] = [];
      let linkedRoadmapItems: any[] = [];
      
      if (taskIds.length > 0) {
        linkedTasks = await db.select().from(tasks)
          .where(and(eq(tasks.accountId, accountId), inArray(tasks.id, taskIds)));
      }
      if (epicIds.length > 0) {
        linkedEpics = await db.select().from(epics)
          .where(and(eq(epics.accountId, accountId), inArray(epics.id, epicIds)));
      }
      if (sprintIds.length > 0) {
        linkedSprints = await db.select().from(sprints)
          .where(and(eq(sprints.accountId, accountId), inArray(sprints.id, sprintIds)));
      }
      if (roadmapItemIds.length > 0) {
        linkedRoadmapItems = await db.select().from(roadmapItems)
          .where(and(eq(roadmapItems.projectId, projectId), inArray(roadmapItems.id, roadmapItemIds)));
      }
      
      // Create lookup maps for entity details
      const taskMap = new Map(linkedTasks.map(t => [t.id, t]));
      const epicMap = new Map(linkedEpics.map(e => [e.id, e]));
      const sprintMap = new Map(linkedSprints.map(s => [s.id, s]));
      const roadmapItemMap = new Map(linkedRoadmapItems.map(r => [r.id, r]));
      
      // Enrich links with entity details
      const enrichedLinks = links.map(link => {
        let entity = null;
        switch (link.entityType) {
          case "task":
            entity = taskMap.get(link.entityId);
            break;
          case "epic":
            entity = epicMap.get(link.entityId);
            break;
          case "sprint":
            entity = sprintMap.get(link.entityId);
            break;
          case "roadmap_item":
            entity = roadmapItemMap.get(link.entityId);
            break;
        }
        return { ...link, entity };
      });
      
      // Build tree structure with dynamic progress/status calculation
      const tree = objectives.map(obj => {
        const objKeyResults = keyResults.filter(kr => kr.objectiveId === obj.id);
        
        // Calculate dynamic progress from Key Results
        let dynamicProgress = 0;
        if (objKeyResults.length > 0) {
          const totalProgress = objKeyResults.reduce((sum, kr) => {
            const krProgress = kr.targetValue > 0 ? ((kr.currentValue || 0) / kr.targetValue) * 100 : 0;
            return sum + Math.min(krProgress, 100);
          }, 0);
          dynamicProgress = Math.round(totalProgress / objKeyResults.length);
        }
        
        // Determine dynamic status based on progress
        let dynamicStatus: string;
        if (dynamicProgress >= 100) dynamicStatus = "achieved";
        else if (dynamicProgress >= 70) dynamicStatus = "on_track";
        else if (dynamicProgress >= 40) dynamicStatus = "at_risk";
        else dynamicStatus = "critical";
        
        return {
          ...obj,
          progress: dynamicProgress,
          status: dynamicStatus,
          keyResults: objKeyResults.map(kr => ({
            ...kr,
            links: enrichedLinks.filter(l => l.keyResultId === kr.id)
          }))
        };
      });
      
      res.json(tree);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Regenerate OKR from project type
  app.post("/api/projects/:projectId/okr/regenerate", requireAuth, requireOrgMember, requirePermission("roadmap", "create", "roadmap.okr"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const projectId = req.params.projectId;
      
      // Get project info
      const project = await storage.getProject(projectId);
      if (!project || project.accountId !== accountId) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Delete existing OKRs for this project
      const existingObjectives = await db.select().from(okrObjectives)
        .where(and(eq(okrObjectives.projectId, projectId), eq(okrObjectives.accountId, accountId)));
      
      for (const obj of existingObjectives) {
        // Get key results for this objective
        const keyResultsList = await db.select().from(okrKeyResults)
          .where(eq(okrKeyResults.objectiveId, obj.id));
        
        // Delete links for each key result first (in case cascade doesn't work)
        for (const kr of keyResultsList) {
          await db.delete(okrLinks).where(eq(okrLinks.keyResultId, kr.id));
        }
        
        // Delete key results (they reference objectives)
        await db.delete(okrKeyResults).where(eq(okrKeyResults.objectiveId, obj.id));
      }
      // Then delete objectives
      await db.delete(okrObjectives)
        .where(and(eq(okrObjectives.projectId, projectId), eq(okrObjectives.accountId, accountId)));
      
      // Generate new OKRs from project type
      const { generateOkrFromCdc } = await import("./services/cdcGenerationService");
      const objectivesCount = await generateOkrFromCdc(
        accountId,
        projectId,
        project.projectType || 'autre',
        userId
      );
      
      res.json({ objectivesCount });
    } catch (error: any) {
      console.error("Error regenerating OKR:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Create OKR objective
  app.post("/api/projects/:projectId/okr/objectives", requireAuth, requireOrgMember, requirePermission("roadmap", "create", "roadmap.okr"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const projectId = req.params.projectId;
      
      const data = insertOkrObjectiveSchema.parse({
        ...req.body,
        accountId,
        projectId,
        createdBy: userId,
      });
      
      const [objective] = await db.insert(okrObjectives).values(data).returning();
      res.status(201).json(objective);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update OKR objective
  app.patch("/api/okr/objectives/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      
      const data = updateOkrObjectiveSchema.parse(req.body);
      
      const [updated] = await db.update(okrObjectives)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(okrObjectives.id, id), eq(okrObjectives.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Objective not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete OKR objective
  app.delete("/api/okr/objectives/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      
      const [deleted] = await db.delete(okrObjectives)
        .where(and(eq(okrObjectives.id, id), eq(okrObjectives.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "Objective not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create Key Result for an objective
  app.post("/api/okr/objectives/:objectiveId/key-results", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const objectiveId = req.params.objectiveId;
      
      // Verify objective belongs to account
      const [objective] = await db.select().from(okrObjectives)
        .where(and(eq(okrObjectives.id, objectiveId), eq(okrObjectives.accountId, accountId)));
      
      if (!objective) {
        return res.status(404).json({ error: "Objective not found" });
      }
      
      const data = insertOkrKeyResultSchema.parse({
        ...req.body,
        accountId,
        objectiveId,
      });
      
      const [keyResult] = await db.insert(okrKeyResults).values(data).returning();
      res.status(201).json(keyResult);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update Key Result
  app.patch("/api/okr/key-results/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      
      const data = updateOkrKeyResultSchema.parse(req.body);
      
      const [updated] = await db.update(okrKeyResults)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(okrKeyResults.id, id), eq(okrKeyResults.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Key Result not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete Key Result
  app.delete("/api/okr/key-results/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      
      const [deleted] = await db.delete(okrKeyResults)
        .where(and(eq(okrKeyResults.id, id), eq(okrKeyResults.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "Key Result not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Add link from Key Result to entity
  app.post("/api/okr/key-results/:keyResultId/links", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const keyResultId = req.params.keyResultId;
      
      // Verify key result belongs to account
      const [kr] = await db.select().from(okrKeyResults)
        .where(and(eq(okrKeyResults.id, keyResultId), eq(okrKeyResults.accountId, accountId)));
      
      if (!kr) {
        return res.status(404).json({ error: "Key Result not found" });
      }
      
      const data = insertOkrLinkSchema.parse({
        ...req.body,
        accountId,
        keyResultId,
      });
      
      const [link] = await db.insert(okrLinks).values(data).returning();
      res.status(201).json(link);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Remove link
  app.delete("/api/okr/links/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      
      const [deleted] = await db.delete(okrLinks)
        .where(and(eq(okrLinks.id, id), eq(okrLinks.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "Link not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create task from Key Result (special action allowed per user requirement)
  app.post("/api/okr/key-results/:keyResultId/create-task", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const keyResultId = req.params.keyResultId;
      
      // Verify key result exists and get objective project
      const [kr] = await db.select().from(okrKeyResults)
        .where(and(eq(okrKeyResults.id, keyResultId), eq(okrKeyResults.accountId, accountId)));
      
      if (!kr) {
        return res.status(404).json({ error: "Key Result not found" });
      }
      
      const [objective] = await db.select().from(okrObjectives)
        .where(eq(okrObjectives.id, kr.objectiveId));
      
      if (!objective) {
        return res.status(404).json({ error: "Objective not found" });
      }
      
      // Create task in generic tasks table (for /tasks page)
      const { title, description } = req.body;
      
      const [task] = await db.insert(tasks).values({
        accountId,
        projectId: objective.projectId,
        title: title || `Tâche pour: ${kr.title}`,
        description: description || `Créé depuis le Key Result: ${kr.title}`,
        status: "todo",
        priority: "medium",
        createdBy: userId,
      }).returning();
      
      // Create link from KR to this task
      await db.insert(okrLinks).values({
        accountId,
        keyResultId,
        entityType: "task",
        entityId: task.id,
      });
      
      // Return task with projectId for cache invalidation
      res.status(201).json({ ...task, projectId: objective.projectId });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // ACCOUNT SETTINGS ROUTES
  // ============================================

  // Get account details (for all organization members)
  app.get("/api/accounts/:accountId", requireAuth, requireOrgMember, async (req, res) => {
    try {
      if (req.params.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied to this account" });
      }
      
      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      // Get user to check if they're the owner
      const user = await storage.getUser(req.userId!);
      const isOwner = user?.role === 'owner' && user?.accountId === req.accountId;

      // Return full details for owners, limited details for members
      if (isOwner) {
        res.json({
          id: account.id,
          name: account.name,
          siret: account.siret,
          plan: account.plan,
        });
      } else {
        // Invited members can only see organization name and ID
        res.json({
          id: account.id,
          name: account.name,
          plan: account.plan,
        });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update account details (OWNER ONLY)
  app.patch("/api/accounts/:accountId", requireAuth, requireRole("owner"), async (req, res) => {
    try {
      if (req.params.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied to this account" });
      }

      const { name, siret } = req.body;
      
      const updatedAccount = await storage.updateAccount(req.params.accountId, {
        name,
        siret,
      });

      if (!updatedAccount) {
        return res.status(404).json({ error: "Account not found" });
      }

      res.json({
        id: updatedAccount.id,
        name: updatedAccount.name,
        siret: updatedAccount.siret,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // GOOGLE CALENDAR OAUTH
  // ============================================

  // Start OAuth flow
  // Helper function to get the correct domain for Google OAuth redirect
  const getGoogleRedirectDomain = () => {
    // Priority: GOOGLE_REDIRECT_DOMAIN > REPLIT_DEV_DOMAIN > fallback
    // Use GOOGLE_REDIRECT_DOMAIN for stable OAuth redirects (separate from APP_URL used by Render)
    if (process.env.GOOGLE_REDIRECT_DOMAIN) {
      return process.env.GOOGLE_REDIRECT_DOMAIN.replace(/\/$/, ''); // Remove trailing slash
    }
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  };

  // Diagnostic endpoint for Google OAuth configuration (no auth required for debugging)
  app.get("/api/google/debug", async (req, res) => {
    const clientId = getGoogleClientId();
    const clientSecret = getGoogleClientSecret();
    const domain = getGoogleRedirectDomain();
    const redirectUri = `${domain}/api/google/auth/callback`;
    
    res.json({
      configured: !!(clientId && clientSecret),
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      domain,
      redirectUri,
      envVars: {
        GOOGLE_REDIRECT_DOMAIN: process.env.GOOGLE_REDIRECT_DOMAIN || 'not set',
        REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN ? 'set' : 'not set',
        REPL_SLUG: process.env.REPL_SLUG || 'not set',
      },
      instructions: `Add this redirect URI to your Google Cloud Console: ${redirectUri}`
    });
  });

  app.get("/api/google/auth/start", requireAuth, async (req, res) => {
    try {
      const clientId = getGoogleClientId();
      const clientSecret = getGoogleClientSecret();
      
      if (!clientId || !clientSecret) {
        return res.status(400).json({ 
          error: "Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables" 
        });
      }

      const { createOAuth2Client, getAuthUrl } = await import("./lib/google-calendar");
      
      const domain = getGoogleRedirectDomain();
      const redirectUri = `${domain}/api/google/auth/callback`;
      
      console.log("📅 Google OAuth Start - Using redirect URI:", redirectUri);
      
      const oauth2Client = createOAuth2Client({
        clientId,
        clientSecret,
        redirectUri,
      });

      const state = JSON.stringify({
        accountId: req.accountId,
        userId: req.userId,
      });

      const authUrl = getAuthUrl(oauth2Client, state);
      res.json({ authUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // OAuth callback
  app.get("/api/google/auth/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).send("Missing code or state");
      }

      const { accountId, userId } = JSON.parse(state as string);
      const clientId = getGoogleClientId();
      const clientSecret = getGoogleClientSecret();

      if (!clientId || !clientSecret) {
        return res.status(400).send("Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
      }

      const { createOAuth2Client, exchangeCodeForTokens } = await import("./lib/google-calendar");
      
      const domain = getGoogleRedirectDomain();
      const redirectUri = `${domain}/api/google/auth/callback`;
      
      console.log("📅 Google OAuth Callback - Using redirect URI:", redirectUri);
      
      const oauth2Client = createOAuth2Client({
        clientId,
        clientSecret,
        redirectUri,
      });

      const tokens = await exchangeCodeForTokens(oauth2Client, code as string);

      // Get user info to store email
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      await storage.upsertGoogleToken({
        accountId,
        userId,
        email: userInfo.data.email || "",
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        tokenType: tokens.token_type || "Bearer",
        expiresAt: new Date(tokens.expiry_date!),
        scope: tokens.scope!,
      });

      res.send(`
        <html>
          <body>
            <h1>✅ Google Calendar connecté avec succès !</h1>
            <p>Vous pouvez fermer cette fenêtre et retourner à Planbase.</p>
            <script>
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      res.status(500).send(`Error: ${error.message}`);
    }
  });

  // Disconnect Google Calendar
  app.delete("/api/google/disconnect", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteGoogleToken(req.accountId!, req.userId!);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Google Calendar connection status
  app.get("/api/google/status", requireAuth, async (req, res) => {
    try {
      const token = await storage.getGoogleTokenByUserId(req.accountId!, req.userId!);
      const clientId = getGoogleClientId();
      const clientSecret = getGoogleClientSecret();
      
      console.log("🔍 Google Calendar Status Check:", {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        configured: !!(clientId && clientSecret),
        connected: !!token
      });
      
      res.json({
        connected: !!token,
        email: token?.email || null,
        configured: !!(clientId && clientSecret),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Google Calendar events
  app.get("/api/google/events", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const { getCalendarEvents } = await import("./lib/google-calendar");
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const events = await getCalendarEvents(req.accountId!, req.userId!, start, end);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create Google Calendar event
  app.post("/api/google/events", requireAuth, async (req, res) => {
    try {
      const { title, startDateTime, endDateTime, description } = req.body;
      
      if (!title || !startDateTime) {
        return res.status(400).json({ error: "Title and startDateTime are required" });
      }
      
      const { createCalendarEvent } = await import("./lib/google-calendar");
      
      const event = await createCalendarEvent(req.accountId!, req.userId!, {
        title,
        startDateTime,
        endDateTime,
        description,
      });
      
      res.json(event);
    } catch (error: any) {
      console.error("Failed to create Google Calendar event:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // CALENDAR & APPOINTMENTS
  // ============================================

  // Get all appointments for the current account with optional date filters
  app.get("/api/appointments", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      let start: Date | undefined;
      let end: Date | undefined;
      
      if (startDate) {
        start = new Date(startDate as string);
        if (isNaN(start.getTime())) {
          return res.status(400).json({ error: "Invalid startDate format" });
        }
      }
      
      if (endDate) {
        end = new Date(endDate as string);
        if (isNaN(end.getTime())) {
          return res.status(400).json({ error: "Invalid endDate format" });
        }
      }
      
      const appointments = await storage.getAppointmentsByAccountId(req.accountId!, start, end);
      res.json(appointments);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get a specific appointment
  app.get("/api/appointments/:id", requireAuth, async (req, res) => {
    try {
      const appointment = await storage.getAppointment(req.accountId!, req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json(appointment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new appointment
  app.post("/api/appointments", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const data = insertAppointmentSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || null,
      });
      const appointment = await storage.createAppointment(data);
      
      // Try to sync to Google Calendar if user is connected
      try {
        const googleToken = await storage.getGoogleTokenByUserId(req.accountId!, req.userId!);
        if (googleToken) {
          const { createCalendarEvent } = await import("./lib/google-calendar");
          const googleEvent = await createCalendarEvent(req.accountId!, req.userId!, {
            title: data.title,
            startDateTime: data.startDateTime,
            endDateTime: data.endDateTime || undefined,
            description: data.notes || undefined,
          });
          
          // Update appointment with Google Event ID for future sync
          if (googleEvent?.id) {
            await storage.updateAppointment(req.accountId!, appointment.id, {
              googleEventId: googleEvent.id,
            });
          }
          console.log("📅 Synced appointment to Google Calendar:", googleEvent?.id);
        }
      } catch (syncError: any) {
        // Don't fail the appointment creation if Google sync fails
        console.error("⚠️ Failed to sync to Google Calendar:", syncError.message);
      }
      
      res.json(appointment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update an appointment
  app.patch("/api/appointments/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const existing = await storage.getAppointment(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      // Validate update data (prevents modifying accountId, createdBy, googleEventId)
      const validatedData = updateAppointmentSchema.parse(req.body);
      
      const appointment = await storage.updateAppointment(req.accountId!, req.params.id, validatedData);
      res.json(appointment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete an appointment
  app.delete("/api/appointments/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const existing = await storage.getAppointment(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      const success = await storage.deleteAppointment(req.accountId!, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // MINDMAPS
  // ============================================

  // Get all mindmaps for the current account
  app.get("/api/mindmaps", requireAuth, requireOrgMember, requirePermission("notes", "read"), async (req, res) => {
    try {
      const mindmaps = await storage.getMindmapsByAccountId(req.accountId!);
      res.json(mindmaps);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get mindmaps by client
  app.get("/api/clients/:clientId/mindmaps", requireAuth, requireOrgMember, requirePermission("crm", "read"), async (req, res) => {
    try {
      const mindmaps = await storage.getMindmapsByClientId(req.accountId!, req.params.clientId);
      res.json(mindmaps);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get mindmaps by project
  app.get("/api/projects/:projectId/mindmaps", requireAuth, requireOrgMember, requirePermission("notes", "read"), async (req, res) => {
    try {
      const mindmaps = await storage.getMindmapsByProjectId(req.accountId!, req.params.projectId);
      res.json(mindmaps);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get a single mindmap with all nodes and edges
  app.get("/api/mindmaps/:id", requireAuth, requireOrgMember, requirePermission("notes", "read"), async (req, res) => {
    try {
      const result = await storage.getMindmapWithDetails(req.accountId!, req.params.id);
      if (!result) {
        return res.status(404).json({ error: "Mindmap not found" });
      }
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Template nodes for different mindmap types
  const MINDMAP_TEMPLATES: Record<string, Array<{ title: string; type: string; x: number; y: number; description?: string }>> = {
    generic: [
      { title: "Idée principale", type: "idea", x: 400, y: 300 },
    ],
    storyboard: [
      { title: "Scène 1 - Introduction", type: "idea", x: 100, y: 200, description: "Présentation du contexte" },
      { title: "Scène 2 - Développement", type: "idea", x: 350, y: 200, description: "Action principale" },
      { title: "Scène 3 - Climax", type: "idea", x: 600, y: 200, description: "Point culminant" },
      { title: "Scène 4 - Conclusion", type: "idea", x: 850, y: 200, description: "Résolution" },
    ],
    user_flow: [
      { title: "Point d'entrée", type: "idea", x: 100, y: 250, description: "Début du parcours" },
      { title: "Étape 1", type: "task", x: 300, y: 150 },
      { title: "Étape 2", type: "task", x: 500, y: 150 },
      { title: "Décision", type: "idea", x: 500, y: 350, description: "Point de décision" },
      { title: "Objectif atteint", type: "idea", x: 750, y: 250, description: "Succès du parcours" },
    ],
    architecture: [
      { title: "Frontend", type: "project", x: 200, y: 100, description: "Interface utilisateur" },
      { title: "API Gateway", type: "project", x: 400, y: 250, description: "Point d'entrée des requêtes" },
      { title: "Backend", type: "project", x: 600, y: 100, description: "Logique métier" },
      { title: "Base de données", type: "document", x: 600, y: 400, description: "Stockage des données" },
      { title: "Services externes", type: "client", x: 200, y: 400, description: "API tierces" },
    ],
    sitemap: [
      { title: "Accueil", type: "idea", x: 400, y: 50 },
      { title: "À propos", type: "document", x: 150, y: 200 },
      { title: "Services", type: "document", x: 350, y: 200 },
      { title: "Portfolio", type: "document", x: 550, y: 200 },
      { title: "Contact", type: "document", x: 750, y: 200 },
      { title: "Blog", type: "note", x: 400, y: 350 },
    ],
    ideas: [
      { title: "Idée centrale", type: "idea", x: 400, y: 250 },
      { title: "Branche 1", type: "idea", x: 200, y: 100 },
      { title: "Branche 2", type: "idea", x: 600, y: 100 },
      { title: "Branche 3", type: "idea", x: 200, y: 400 },
      { title: "Branche 4", type: "idea", x: 600, y: 400 },
    ],
  };

  // Create a new mindmap
  app.post("/api/mindmaps", requireAuth, requireOrgMember, requirePermission("notes", "create"), async (req, res) => {
    try {
      const data = insertMindmapSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || null,
      });
      const mindmap = await storage.createMindmap(data);
      
      // Create template nodes based on mindmap kind
      const templateNodes = MINDMAP_TEMPLATES[mindmap.kind] || MINDMAP_TEMPLATES.generic;
      const createdNodes: any[] = [];
      
      for (const template of templateNodes) {
        const node = await storage.createMindmapNode({
          accountId: req.accountId!,
          mindmapId: mindmap.id,
          title: template.title,
          description: template.description || null,
          type: template.type,
          x: template.x.toString(),
          y: template.y.toString(),
        });
        createdNodes.push(node);
      }
      
      // Create edges for connecting nodes based on template type
      if (mindmap.kind === "storyboard" && createdNodes.length >= 4) {
        // Connect scenes sequentially
        for (let i = 0; i < createdNodes.length - 1; i++) {
          await storage.createMindmapEdge({
            accountId: req.accountId!,
            mindmapId: mindmap.id,
            sourceNodeId: createdNodes[i].id,
            targetNodeId: createdNodes[i + 1].id,
            isDraft: true,
          });
        }
      } else if (mindmap.kind === "user_flow" && createdNodes.length >= 5) {
        // Connect flow: entry -> step1 -> step2 -> goal, entry -> decision
        await storage.createMindmapEdge({ accountId: req.accountId!, mindmapId: mindmap.id, sourceNodeId: createdNodes[0].id, targetNodeId: createdNodes[1].id, isDraft: true });
        await storage.createMindmapEdge({ accountId: req.accountId!, mindmapId: mindmap.id, sourceNodeId: createdNodes[1].id, targetNodeId: createdNodes[2].id, isDraft: true });
        await storage.createMindmapEdge({ accountId: req.accountId!, mindmapId: mindmap.id, sourceNodeId: createdNodes[2].id, targetNodeId: createdNodes[4].id, isDraft: true });
        await storage.createMindmapEdge({ accountId: req.accountId!, mindmapId: mindmap.id, sourceNodeId: createdNodes[0].id, targetNodeId: createdNodes[3].id, isDraft: true });
        await storage.createMindmapEdge({ accountId: req.accountId!, mindmapId: mindmap.id, sourceNodeId: createdNodes[3].id, targetNodeId: createdNodes[4].id, isDraft: true });
      } else if (mindmap.kind === "architecture" && createdNodes.length >= 5) {
        // Connect architecture: frontend <-> api, backend <-> api, backend <-> db, api <-> external
        await storage.createMindmapEdge({ accountId: req.accountId!, mindmapId: mindmap.id, sourceNodeId: createdNodes[0].id, targetNodeId: createdNodes[1].id, isDraft: true });
        await storage.createMindmapEdge({ accountId: req.accountId!, mindmapId: mindmap.id, sourceNodeId: createdNodes[1].id, targetNodeId: createdNodes[2].id, isDraft: true });
        await storage.createMindmapEdge({ accountId: req.accountId!, mindmapId: mindmap.id, sourceNodeId: createdNodes[2].id, targetNodeId: createdNodes[3].id, isDraft: true });
        await storage.createMindmapEdge({ accountId: req.accountId!, mindmapId: mindmap.id, sourceNodeId: createdNodes[1].id, targetNodeId: createdNodes[4].id, isDraft: true });
      } else if (mindmap.kind === "sitemap" && createdNodes.length >= 6) {
        // Connect sitemap: home -> all pages
        for (let i = 1; i < createdNodes.length; i++) {
          await storage.createMindmapEdge({ accountId: req.accountId!, mindmapId: mindmap.id, sourceNodeId: createdNodes[0].id, targetNodeId: createdNodes[i].id, isDraft: true });
        }
      } else if (mindmap.kind === "ideas" && createdNodes.length >= 5) {
        // Connect ideas: center -> all branches
        for (let i = 1; i < createdNodes.length; i++) {
          await storage.createMindmapEdge({ accountId: req.accountId!, mindmapId: mindmap.id, sourceNodeId: createdNodes[0].id, targetNodeId: createdNodes[i].id, isDraft: true });
        }
      }
      
      // Log activity
      await storage.createActivity({
        accountId: req.accountId!,
        subjectType: "mindmap",
        subjectId: mindmap.id,
        kind: "created",
        payload: { name: mindmap.name },
        createdBy: req.userId || null,
      });
      
      res.json(mindmap);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update a mindmap
  app.patch("/api/mindmaps/:id", requireAuth, requireOrgMember, requirePermission("notes", "update"), async (req, res) => {
    try {
      const existing = await storage.getMindmap(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Mindmap not found" });
      }
      
      const mindmap = await storage.updateMindmap(req.accountId!, req.params.id, req.body);
      res.json(mindmap);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a mindmap (cascades to nodes and edges)
  app.delete("/api/mindmaps/:id", requireAuth, requireOrgMember, requirePermission("notes", "delete"), async (req, res) => {
    try {
      const existing = await storage.getMindmap(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Mindmap not found" });
      }
      
      const success = await storage.deleteMindmap(req.accountId!, req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // MINDMAP NODES
  // ============================================

  // Get nodes for a mindmap
  app.get("/api/mindmaps/:mindmapId/nodes", requireAuth, requireOrgMember, requirePermission("notes", "read"), async (req, res) => {
    try {
      // Verify mindmap exists and belongs to account
      const mindmap = await storage.getMindmap(req.accountId!, req.params.mindmapId);
      if (!mindmap) {
        return res.status(404).json({ error: "Mindmap not found" });
      }
      
      const nodes = await storage.getMindmapNodesByMindmapId(req.accountId!, req.params.mindmapId);
      res.json(nodes);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new node
  app.post("/api/mindmaps/:mindmapId/nodes", requireAuth, requireOrgMember, requirePermission("notes", "create"), async (req, res) => {
    try {
      // Verify mindmap exists and belongs to account
      const mindmap = await storage.getMindmap(req.accountId!, req.params.mindmapId);
      if (!mindmap) {
        return res.status(404).json({ error: "Mindmap not found" });
      }
      
      console.log("📝 Creating node with body:", JSON.stringify(req.body, null, 2));
      
      const data = insertMindmapNodeSchema.parse({
        ...req.body,
        mindmapId: req.params.mindmapId,
        accountId: req.accountId!,
      });
      const node = await storage.createMindmapNode(data);
      res.json(node);
    } catch (error: any) {
      console.error("❌ Node creation error:", error.message);
      res.status(400).json({ error: error.message });
    }
  });

  // Update a node
  app.patch("/api/mindmap-nodes/:id", requireAuth, requireOrgMember, requirePermission("notes", "update"), async (req, res) => {
    try {
      const existing = await storage.getMindmapNode(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Node not found" });
      }
      
      const node = await storage.updateMindmapNode(req.accountId!, req.params.id, req.body);
      res.json(node);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Batch update nodes (for drag & drop position updates)
  app.patch("/api/mindmaps/:mindmapId/nodes/batch", requireAuth, requireOrgMember, requirePermission("notes", "update"), async (req, res) => {
    try {
      // Verify mindmap exists
      const mindmap = await storage.getMindmap(req.accountId!, req.params.mindmapId);
      if (!mindmap) {
        return res.status(404).json({ error: "Mindmap not found" });
      }
      
      const { updates } = req.body;
      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: "Updates must be an array" });
      }
      
      const results = await Promise.all(
        updates.map((update: { id: string; positionX?: number; positionY?: number }) =>
          storage.updateMindmapNode(req.accountId!, update.id, {
            positionX: update.positionX,
            positionY: update.positionY,
          })
        )
      );
      
      res.json({ success: true, updated: results.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a node
  app.delete("/api/mindmap-nodes/:id", requireAuth, requireOrgMember, requirePermission("notes", "delete"), async (req, res) => {
    try {
      const existing = await storage.getMindmapNode(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Node not found" });
      }
      
      const success = await storage.deleteMindmapNode(req.accountId!, req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // MINDMAP EDGES
  // ============================================

  // Get edges for a mindmap
  app.get("/api/mindmaps/:mindmapId/edges", requireAuth, requireOrgMember, requirePermission("notes", "read"), async (req, res) => {
    try {
      // Verify mindmap exists and belongs to account
      const mindmap = await storage.getMindmap(req.accountId!, req.params.mindmapId);
      if (!mindmap) {
        return res.status(404).json({ error: "Mindmap not found" });
      }
      
      const edges = await storage.getMindmapEdgesByMindmapId(req.accountId!, req.params.mindmapId);
      res.json(edges);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new edge
  app.post("/api/mindmaps/:mindmapId/edges", requireAuth, requireOrgMember, requirePermission("notes", "create"), async (req, res) => {
    try {
      // Verify mindmap exists and belongs to account
      const mindmap = await storage.getMindmap(req.accountId!, req.params.mindmapId);
      if (!mindmap) {
        return res.status(404).json({ error: "Mindmap not found" });
      }
      
      const data = insertMindmapEdgeSchema.parse({
        ...req.body,
        mindmapId: req.params.mindmapId,
        accountId: req.accountId!,
      });
      const edge = await storage.createMindmapEdge(data);
      res.json(edge);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update an edge
  app.patch("/api/mindmap-edges/:id", requireAuth, requireOrgMember, requirePermission("notes", "update"), async (req, res) => {
    try {
      const existing = await storage.getMindmapEdge(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Edge not found" });
      }
      
      const edge = await storage.updateMindmapEdge(req.accountId!, req.params.id, req.body);
      res.json(edge);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete an edge
  app.delete("/api/mindmap-edges/:id", requireAuth, requireOrgMember, requirePermission("notes", "delete"), async (req, res) => {
    try {
      const existing = await storage.getMindmapEdge(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Edge not found" });
      }
      
      const success = await storage.deleteMindmapEdge(req.accountId!, req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // ENTITY LINKS (for mindmap draft mode)
  // ============================================

  // Get entity links for account
  app.get("/api/entity-links", requireAuth, async (req, res) => {
    try {
      const links = await storage.getEntityLinksByAccountId(req.accountId!);
      res.json(links);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create entity link (when connecting mindmap nodes to existing entities)
  app.post("/api/entity-links", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const data = insertEntityLinkSchema.parse({
        ...req.body,
        accountId: req.accountId!,
      });
      const link = await storage.createEntityLink(data);
      res.json(link);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete entity link
  app.delete("/api/entity-links/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const existing = await storage.getEntityLink(req.accountId!, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Entity link not found" });
      }
      
      const success = await storage.deleteEntityLink(req.accountId!, req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // CONNECT MINDMAP NODES (Draft to Business Links)
  // ============================================

  // Connect all draft edges to business entity links
  app.post("/api/mindmaps/:mindmapId/connect-nodes", requireAuth, requireOrgMember, requirePermission("notes", "create"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const mindmapId = req.params.mindmapId;
      
      // Verify mindmap exists
      const mindmap = await storage.getMindmap(accountId, mindmapId);
      if (!mindmap) {
        return res.status(404).json({ error: "Mindmap not found" });
      }
      
      // Get all edges and nodes for this mindmap
      const edges = await storage.getMindmapEdgesByMindmapId(accountId, mindmapId);
      const nodes = await storage.getMindmapNodesByMindmapId(accountId, mindmapId);
      
      // Create a map of nodes by ID for quick lookup
      const nodesMap = new Map(nodes.map(n => [n.id, n]));
      
      // Filter draft edges only
      const draftEdges = edges.filter(e => e.isDraft);
      
      const results = {
        connected: 0,
        skipped: 0,
        errors: [] as string[],
      };
      
      for (const edge of draftEdges) {
        const sourceNode = nodesMap.get(edge.sourceNodeId);
        const targetNode = nodesMap.get(edge.targetNodeId);
        
        // Both nodes must have linked entities
        if (
          sourceNode?.linkedEntityType && sourceNode?.linkedEntityId &&
          targetNode?.linkedEntityType && targetNode?.linkedEntityId
        ) {
          try {
            // Create entity link
            const entityLink = await storage.createEntityLink({
              accountId,
              sourceType: sourceNode.linkedEntityType,
              sourceId: sourceNode.linkedEntityId,
              targetType: targetNode.linkedEntityType,
              targetId: targetNode.linkedEntityId,
              createdBy: req.userId!,
            });
            
            // Update edge with entity link ID and set isDraft = false
            await storage.updateMindmapEdge(accountId, edge.id, {
              isDraft: false,
              linkedEntityLinkId: entityLink.id,
            });
            
            results.connected++;
          } catch (err: any) {
            results.errors.push(`Edge ${edge.id}: ${err.message}`);
          }
        } else {
          // Skip edges where nodes don't have linked entities
          results.skipped++;
        }
      }
      
      res.json({
        success: true,
        ...results,
        totalDraftEdges: draftEdges.length,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete edge with option to also delete entity link
  // Use query param ?deleteEntityLink=true to also delete the business link
  app.delete("/api/mindmap-edges/:id/with-entity-link", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const edgeId = req.params.id;
      const shouldDeleteEntityLink = req.query.deleteEntityLink === "true";
      
      const edge = await storage.getMindmapEdge(accountId, edgeId);
      if (!edge) {
        return res.status(404).json({ error: "Edge not found" });
      }
      
      // If edge has an entity link and user wants to delete it
      if (shouldDeleteEntityLink && edge.linkedEntityLinkId) {
        await storage.deleteEntityLink(accountId, edge.linkedEntityLinkId);
      }
      
      // Delete the edge
      const success = await storage.deleteMindmapEdge(accountId, edgeId);
      
      res.json({ 
        success, 
        entityLinkDeleted: shouldDeleteEntityLink && edge.linkedEntityLinkId ? true : false 
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // DEBUG: Connection info
  // ============================================
  
  app.get("/api/debug/connection", (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL || "NOT_SET";
    const supabasePassword = process.env.SUPABASE_DB_PASSWORD || "";
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
    const hasPassword = !!supabasePassword;
    const passwordLength = supabasePassword.length;
    const passwordPreview = supabasePassword ? supabasePassword.substring(0, 3) + "***" : "NOT_SET";
    
    res.json({
      supabaseUrl,
      projectRef,
      hasPassword,
      passwordLength,
      passwordPreview,
      connectionFormat: `postgres.${projectRef}:***@aws-0-eu-central-1.pooler.supabase.com:6543`,
      instructions: [
        "1. Allez dans Supabase Dashboard → Settings → Database",
        "2. Section 'Database password' (en haut de page)",
        "3. Cliquez sur 'Reset database password'",
        "4. Copiez le nouveau mot de passe",
        "5. Ajoutez-le dans le secret SUPABASE_DB_PASSWORD sur Replit"
      ]
    });
  });

  // ============================================
  // BACKLOGS MODULE
  // ============================================

  // List all backlogs for the account with summary data
  app.get("/api/backlogs", requireAuth, requireOrgMember, requirePermission("product", "read", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogsList = await db.select().from(backlogs).where(eq(backlogs.accountId, accountId)).orderBy(desc(backlogs.createdAt));
      
      // Enrich with project, ticket counts, active sprint, and creator info
      const enrichedBacklogs = await Promise.all(backlogsList.map(async (backlog) => {
        // Get project if linked
        let project = null;
        if (backlog.projectId) {
          const [proj] = await db.select().from(projects).where(eq(projects.id, backlog.projectId));
          project = proj || null;
        }
        
        // Get creator info
        let creator = null;
        if (backlog.createdBy) {
          const [user] = await db.select().from(appUsers).where(eq(appUsers.id, backlog.createdBy));
          if (user) {
            creator = {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              avatarUrl: user.avatarUrl,
            };
          }
        }
        
        // Get ticket counts by state
        const [epicsList, userStoriesList, backlogTasksList] = await Promise.all([
          db.select().from(epics).where(eq(epics.backlogId, backlog.id)),
          db.select().from(userStories).where(eq(userStories.backlogId, backlog.id)),
          db.select().from(backlogTasks).where(eq(backlogTasks.backlogId, backlog.id)),
        ]);
        
        // Count tickets by state
        const allTickets = [
          ...epicsList.map(e => ({ state: e.state })),
          ...userStoriesList.map(s => ({ state: s.state })),
          ...backlogTasksList.map(t => ({ state: t.state })),
        ];
        
        const ticketCounts = {
          todo: allTickets.filter(t => t.state === "a_faire").length,
          inProgress: allTickets.filter(t => t.state === "en_cours" || t.state === "review").length,
          done: allTickets.filter(t => t.state === "termine").length,
          total: allTickets.length,
        };
        
        // Get all sprints for this backlog
        const sprintsList = await db.select().from(sprints)
          .where(eq(sprints.backlogId, backlog.id))
          .orderBy(sprints.position, sprints.startDate);
        
        // Get active sprint (en_cours status)
        let activeSprint = null;
        const activeSprintRow = sprintsList.find(s => s.status === "en_cours");
        if (activeSprintRow) {
          activeSprint = {
            id: activeSprintRow.id,
            name: activeSprintRow.name,
          };
        }
        
        return {
          ...backlog,
          project,
          creator,
          ticketCounts,
          activeSprint,
          sprints: sprintsList,
        };
      }));
      
      res.json(enrichedBacklogs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all backlogs with their items (for note linking)
  app.get("/api/backlogs-with-items", requireAuth, requireOrgMember, requirePermission("product", "read", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogsList = await db.select().from(backlogs).where(eq(backlogs.accountId, accountId)).orderBy(desc(backlogs.createdAt));
      
      // For each backlog, fetch all items
      const backlogsWithItems = await Promise.all(backlogsList.map(async (backlog) => {
        const [epicsList, userStoriesList, tasksList] = await Promise.all([
          db.select().from(epics).where(eq(epics.backlogId, backlog.id)),
          db.select().from(userStories).where(eq(userStories.backlogId, backlog.id)),
          db.select().from(backlogTasks).where(eq(backlogTasks.backlogId, backlog.id)),
        ]);
        
        return {
          id: backlog.id,
          name: backlog.name,
          epics: epicsList,
          userStories: userStoriesList,
          tasks: tasksList,
        };
      }));
      
      res.json(backlogsWithItems);
    } catch (error) {
      console.error("Error fetching backlogs with items:", error);
      res.status(500).json({ error: "Failed to fetch backlogs with items" });
    }
  });

  // Create a new backlog
  app.post("/api/backlogs", requireAuth, requireOrgMember, requirePermission("product", "create", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const data = insertBacklogSchema.parse({
        ...req.body,
        accountId,
        createdBy: userId,
      });
      
      const [backlog] = await db.insert(backlogs).values(data).returning();
      
      // Create activity for backlog creation
      await storage.createActivity({
        accountId,
        subjectType: "backlog",
        subjectId: backlog.id,
        kind: "created",
        payload: { description: `Backlog créé: ${backlog.name}` },
        createdBy: userId,
      });
      
      // If Kanban mode, create default columns
      if (data.mode === "kanban") {
        const defaultColumns = [
          { name: "À faire", color: "#E5E7EB", order: 0, isLocked: true },
          { name: "En cours", color: "#93C5FD", order: 1, isLocked: false },
          { name: "Review", color: "#FDE047", order: 2, isLocked: false },
          { name: "Terminé", color: "#86EFAC", order: 3, isLocked: true },
        ];
        
        for (const col of defaultColumns) {
          await db.insert(backlogColumns).values({
            accountId,
            backlogId: backlog.id,
            name: col.name,
            color: col.color,
            order: col.order,
            isLocked: col.isLocked,
          });
        }
      }
      
      // Generate EPICs from roadmap items if requested
      const { generateEpics, roadmapId } = req.body;
      if (generateEpics && roadmapId && data.projectId) {
        // Validate roadmap belongs to the project and account
        const [roadmap] = await db.select().from(roadmaps)
          .where(and(
            eq(roadmaps.id, roadmapId),
            eq(roadmaps.accountId, accountId),
            eq(roadmaps.projectId, data.projectId)
          ));
        
        if (!roadmap) {
          return res.status(400).json({ error: "Roadmap not found or does not belong to this project" });
        }
        
        const roadmapItemsList = await db.select().from(roadmapItems)
          .where(eq(roadmapItems.roadmapId, roadmapId))
          .orderBy(asc(roadmapItems.orderIndex));
        
        let epicOrder = 0;
        for (const item of roadmapItemsList) {
          const [epic] = await db.insert(epics).values({
            accountId,
            backlogId: backlog.id,
            roadmapItemId: item.id,
            title: item.title,
            description: item.description || '',
            color: item.color || '#C4B5FD',
            order: epicOrder++,
            createdBy: userId,
          }).returning();
          
          // Update roadmap item to link back to epic
          await db.update(roadmapItems)
            .set({ epicId: epic.id })
            .where(eq(roadmapItems.id, item.id));
        }
        
        // Create activity for EPIC generation
        await storage.createActivity({
          accountId,
          subjectType: "backlog",
          subjectId: backlog.id,
          kind: "updated",
          payload: { description: `${roadmapItemsList.length} EPICs générées depuis la roadmap` },
          createdBy: userId,
        });
      }
      
      res.status(201).json(backlog);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get single backlog with all related data
  app.get("/api/backlogs/:backlogId", requireAuth, requireOrgMember, requirePermission("product", "read", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogId = req.params.backlogId;
      
      const [backlog] = await db.select().from(backlogs).where(and(eq(backlogs.id, backlogId), eq(backlogs.accountId, accountId)));
      if (!backlog) {
        return res.status(404).json({ error: "Backlog not found" });
      }
      
      // Fetch all related data
      const [epicsList, userStoriesList, backlogTasksList, sprintsList, columnsList] = await Promise.all([
        db.select().from(epics).where(eq(epics.backlogId, backlogId)).orderBy(asc(epics.order)),
        db.select().from(userStories).where(eq(userStories.backlogId, backlogId)).orderBy(asc(userStories.order)),
        db.select().from(backlogTasks).where(eq(backlogTasks.backlogId, backlogId)).orderBy(asc(backlogTasks.order)),
        db.select().from(sprints).where(eq(sprints.backlogId, backlogId)).orderBy(asc(sprints.startDate)),
        db.select().from(backlogColumns).where(eq(backlogColumns.backlogId, backlogId)).orderBy(asc(backlogColumns.order)),
      ]);
      
      // Fetch checklist items for all user stories
      const userStoryIds = userStoriesList.map(us => us.id);
      let checklistItemsList: any[] = [];
      if (userStoryIds.length > 0) {
        // Fetch checklists for each user story
        for (const usId of userStoryIds) {
          const items = await db.select().from(checklistItems).where(eq(checklistItems.userStoryId, usId)).orderBy(asc(checklistItems.order));
          checklistItemsList.push(...items);
        }
      }
      
      res.json({
        ...backlog,
        epics: epicsList,
        userStories: userStoriesList,
        backlogTasks: backlogTasksList,
        sprints: sprintsList,
        columns: columnsList,
        checklistItems: checklistItemsList,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update backlog
  app.patch("/api/backlogs/:backlogId", requireAuth, requireOrgMember, requirePermission("product", "update", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogId = req.params.backlogId;
      const data = updateBacklogSchema.parse(req.body);
      
      const [updated] = await db.update(backlogs)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(backlogs.id, backlogId), eq(backlogs.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Backlog not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete backlog
  app.delete("/api/backlogs/:backlogId", requireAuth, requireOrgMember, requirePermission("product", "delete", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogId = req.params.backlogId;
      
      const [deleted] = await db.delete(backlogs)
        .where(and(eq(backlogs.id, backlogId), eq(backlogs.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "Backlog not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // EPICS
  // ============================================

  // List epics for a backlog
  app.get("/api/backlogs/:backlogId/epics", requireAuth, requireOrgMember, requirePermission("product", "read", "product.epics"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogId = req.params.backlogId;
      
      const result = await db.select().from(epics)
        .where(and(eq(epics.backlogId, backlogId), eq(epics.accountId, accountId)))
        .orderBy(asc(epics.order));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create epic
  app.post("/api/backlogs/:backlogId/epics", requireAuth, requireOrgMember, requirePermission("product", "create", "product.epics"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const backlogId = req.params.backlogId;
      
      const data = insertEpicSchema.parse({
        ...req.body,
        accountId,
        backlogId,
        createdBy: userId,
      });
      
      // Get backlog to get projectId for validation
      const [backlog] = await db.select().from(backlogs)
        .where(and(eq(backlogs.id, backlogId), eq(backlogs.accountId, accountId)));
      
      if (!backlog) {
        return res.status(404).json({ error: "Backlog non trouvé" });
      }

      const [epic] = await db.insert(epics).values(data).returning();
      
      // Handle bidirectional roadmap link when roadmapItemId is provided
      if (epic.roadmapItemId && backlog.projectId) {
        // Validate the roadmap item belongs to the same account AND project
        const [roadmapItem] = await db.select().from(roadmapItems)
          .innerJoin(roadmaps, eq(roadmapItems.roadmapId, roadmaps.id))
          .where(and(
            eq(roadmapItems.id, epic.roadmapItemId), 
            eq(roadmapItems.accountId, accountId),
            eq(roadmaps.projectId, backlog.projectId)
          ));
        if (roadmapItem) {
          // Clear epicId from any other epic that might be linked to this roadmap item
          const [existingLinkedEpic] = await db.select().from(epics)
            .where(and(eq(epics.roadmapItemId, epic.roadmapItemId), not(eq(epics.id, epic.id))));
          if (existingLinkedEpic) {
            await db.update(epics)
              .set({ roadmapItemId: null })
              .where(eq(epics.id, existingLinkedEpic.id));
          }
          await db.update(roadmapItems)
            .set({ epicId: epic.id })
            .where(eq(roadmapItems.id, epic.roadmapItemId));
        }
      }
      
      // Create activity for epic creation
      await storage.createActivity({
        accountId,
        subjectType: "backlog",
        subjectId: epic.backlogId,
        kind: "updated",
        payload: { description: `Epic créé: ${epic.title}` },
        createdBy: userId,
      });
      
      res.status(201).json(epic);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Generate EPICs from roadmap rubriques
  app.post("/api/backlogs/:backlogId/epics/generate-from-roadmap", requireAuth, requireOrgMember, requirePermission("product", "create", "product.epics"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const backlogId = req.params.backlogId;
      const { roadmapId } = req.body;

      if (!roadmapId) {
        return res.status(400).json({ error: "roadmapId est requis" });
      }

      // Get the backlog and validate it belongs to the account
      const [backlog] = await db.select().from(backlogs)
        .where(and(eq(backlogs.id, backlogId), eq(backlogs.accountId, accountId)));

      if (!backlog) {
        return res.status(404).json({ error: "Backlog non trouvé" });
      }

      // Validate roadmap belongs to the project and account
      const [roadmap] = await db.select().from(roadmaps)
        .where(and(
          eq(roadmaps.id, roadmapId),
          eq(roadmaps.accountId, accountId),
          eq(roadmaps.projectId, backlog.projectId)
        ));

      if (!roadmap) {
        return res.status(404).json({ error: "Roadmap non trouvée ou n'appartient pas à ce projet" });
      }

      // Get roadmap rubriques (groups) that don't already have linked EPICs
      const roadmapItemsList = await db.select().from(roadmapItems)
        .where(and(
          eq(roadmapItems.roadmapId, roadmapId),
          eq(roadmapItems.accountId, accountId),
          eq(roadmapItems.isGroup, true),
          isNull(roadmapItems.epicId)
        ));

      if (roadmapItemsList.length === 0) {
        return res.status(200).json({ message: "Aucune rubrique à générer", epics: [] });
      }

      const createdEpics: any[] = [];

      for (const item of roadmapItemsList) {
        // Create EPIC from roadmap item
        const [epic] = await db.insert(epics).values({
          accountId,
          backlogId,
          title: item.title,
          description: item.description,
          priority: "medium",
          state: "backlog",
          roadmapItemId: item.id,
          createdBy: userId,
        }).returning();

        createdEpics.push(epic);

        // Update roadmap item to link back to epic
        await db.update(roadmapItems)
          .set({ epicId: epic.id })
          .where(eq(roadmapItems.id, item.id));
      }

      // Create activity
      await storage.createActivity({
        accountId,
        subjectType: "backlog",
        subjectId: backlogId,
        kind: "updated",
        payload: { description: `${createdEpics.length} EPICs générées depuis la roadmap` },
        createdBy: userId,
      });

      res.status(201).json({ message: `${createdEpics.length} EPICs créées`, epics: createdEpics });
    } catch (error: any) {
      console.error("Error generating EPICs from roadmap:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Update epic
  app.patch("/api/epics/:epicId", requireAuth, requireOrgMember, requirePermission("product", "update", "product.epics"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const epicId = req.params.epicId;
      const data = updateEpicSchema.parse(req.body);
      
      // Get the current epic state before update
      const [existingEpic] = await db.select().from(epics)
        .where(and(eq(epics.id, epicId), eq(epics.accountId, accountId)));
      
      if (!existingEpic) {
        return res.status(404).json({ error: "Epic not found" });
      }
      
      const [updated] = await db.update(epics)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(epics.id, epicId), eq(epics.accountId, accountId)))
        .returning();
      
      // Handle bidirectional roadmap link when roadmapItemId changes
      if (data.roadmapItemId !== undefined && data.roadmapItemId !== existingEpic.roadmapItemId) {
        // If old roadmap item existed, clear its epicId
        if (existingEpic.roadmapItemId) {
          await db.update(roadmapItems)
            .set({ epicId: null })
            .where(eq(roadmapItems.id, existingEpic.roadmapItemId));
        }
        // If new roadmap item is set, link it to this epic
        if (data.roadmapItemId) {
          // Get the backlog's projectId
          const [epicBacklog] = await db.select().from(backlogs)
            .where(and(eq(backlogs.id, existingEpic.backlogId), eq(backlogs.accountId, accountId)));
          
          if (epicBacklog?.projectId) {
            // Validate the roadmap item belongs to the same account AND project
            const [roadmapItem] = await db.select().from(roadmapItems)
              .innerJoin(roadmaps, eq(roadmapItems.roadmapId, roadmaps.id))
              .where(and(
                eq(roadmapItems.id, data.roadmapItemId), 
                eq(roadmapItems.accountId, accountId),
                eq(roadmaps.projectId, epicBacklog.projectId)
              ));
            if (roadmapItem) {
              // Clear roadmapItemId from any other epic that might be linked to this roadmap item
              const [existingLinkedEpic] = await db.select().from(epics)
                .where(and(eq(epics.roadmapItemId, data.roadmapItemId), not(eq(epics.id, epicId))));
              if (existingLinkedEpic) {
                await db.update(epics)
                  .set({ roadmapItemId: null })
                  .where(eq(epics.id, existingLinkedEpic.id));
              }
              await db.update(roadmapItems)
                .set({ epicId: epicId })
                .where(eq(roadmapItems.id, data.roadmapItemId));
            }
          }
        }
      }
      
      // Sync roadmap item status if EPIC has a linked roadmap item and state changed
      if (updated.roadmapItemId && data.state && data.state !== existingEpic.state) {
        let newRoadmapStatus: string | undefined;
        
        if (data.state === 'termine') {
          // EPIC completed → mark roadmap item as done
          newRoadmapStatus = 'done';
        } else if (existingEpic.state === 'termine' && data.state !== 'termine') {
          // EPIC was completed but now going back to another state
          newRoadmapStatus = 'in_progress';
        } else if (data.state === 'en_cours' || data.state === 'review') {
          // EPIC in progress or review → mark roadmap item as in_progress
          newRoadmapStatus = 'in_progress';
        }
        
        if (newRoadmapStatus) {
          await db.update(roadmapItems)
            .set({ status: newRoadmapStatus, progress: newRoadmapStatus === 'done' ? 100 : undefined })
            .where(eq(roadmapItems.id, updated.roadmapItemId));
        }
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete epic - orphan tickets instead of deleting them
  app.delete("/api/epics/:epicId", requireAuth, requireOrgMember, requirePermission("product", "delete", "product.epics"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const epicId = req.params.epicId;
      
      // First, orphan all user stories by setting their epicId to null
      await db.update(userStories)
        .set({ epicId: null })
        .where(and(eq(userStories.epicId, epicId), eq(userStories.accountId, accountId)));
      
      // Clear the bidirectional roadmap link if the epic had one
      await db.update(roadmapItems)
        .set({ epicId: null })
        .where(and(eq(roadmapItems.epicId, epicId), eq(roadmapItems.accountId, accountId)));
      
      // Then delete the epic
      const [deleted] = await db.delete(epics)
        .where(and(eq(epics.id, epicId), eq(epics.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "Epic not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // USER STORIES
  // ============================================

  // List user stories for a backlog
  app.get("/api/backlogs/:backlogId/user-stories", requireAuth, requireOrgMember, requirePermission("product", "read", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogId = req.params.backlogId;
      
      const result = await db.select().from(userStories)
        .where(and(eq(userStories.backlogId, backlogId), eq(userStories.accountId, accountId)))
        .orderBy(asc(userStories.order));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create user story
  app.post("/api/backlogs/:backlogId/user-stories", requireAuth, requireOrgMember, requirePermission("product", "create", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const backlogId = req.params.backlogId;
      
      const data = insertUserStorySchema.parse({
        ...req.body,
        accountId,
        backlogId,
        createdBy: userId,
      });
      
      const [userStory] = await db.insert(userStories).values({
        ...data,
        reporterId: req.body.reporterId || userId,
      }).returning();
      
      // If user story is linked to an EPIC that was completed, reset roadmap item status
      if (data.epicId) {
        const [epic] = await db.select().from(epics)
          .where(and(eq(epics.id, data.epicId), eq(epics.accountId, accountId)));
        
        if (epic && epic.roadmapItemId && epic.state === 'termine') {
          // Reset EPIC state and roadmap item status to in_progress
          await db.update(epics)
            .set({ state: 'en_cours', updatedAt: new Date() })
            .where(eq(epics.id, epic.id));
          
          await db.update(roadmapItems)
            .set({ status: 'in_progress' })
            .where(eq(roadmapItems.id, epic.roadmapItemId));
        }
      }
      
      // Create activity for user story creation
      await storage.createActivity({
        accountId,
        subjectType: "backlog",
        subjectId: userStory.backlogId,
        kind: "updated",
        payload: { description: `User Story créée: ${userStory.title}` },
        createdBy: userId,
      });
      
      res.status(201).json(userStory);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update user story
  app.patch("/api/user-stories/:id", requireAuth, requireOrgMember, requirePermission("product", "update", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const id = req.params.id;
      console.log("📝 PATCH user-story request body:", JSON.stringify(req.body));
      const data = updateUserStorySchema.parse(req.body);
      console.log("✅ PATCH user-story parsed data:", JSON.stringify(data));
      
      // Get current state before update for activity tracking
      const [current] = await db.select().from(userStories)
        .where(and(eq(userStories.id, id), eq(userStories.accountId, accountId)));
      
      const [updated] = await db.update(userStories)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(userStories.id, id), eq(userStories.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "User story not found" });
      }
      
      // Track state change activity
      if (current && data.state && current.state !== data.state) {
        await storage.createActivity({
          accountId,
          subjectType: "user_story",
          subjectId: id,
          kind: "updated",
          payload: { 
            type: "state_change",
            previousState: current.state,
            newState: data.state,
            description: `État modifié: ${current.state} → ${data.state}`
          },
          createdBy: userId,
        });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("❌ PATCH user-story error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Delete user story
  app.delete("/api/user-stories/:id", requireAuth, requireOrgMember, requirePermission("product", "delete", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      
      const [deleted] = await db.delete(userStories)
        .where(and(eq(userStories.id, id), eq(userStories.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "User story not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // BACKLOG TASKS
  // ============================================

  // Get all tasks for a backlog
  app.get("/api/backlogs/:backlogId/tasks", requireAuth, requireOrgMember, requirePermission("product", "read", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogId = req.params.backlogId;
      
      // Verify backlog belongs to account
      const [backlog] = await db.select().from(backlogs)
        .where(and(eq(backlogs.id, backlogId), eq(backlogs.accountId, accountId)));
      
      if (!backlog) {
        return res.status(404).json({ error: "Backlog not found" });
      }
      
      const tasks = await db.select().from(backlogTasks)
        .where(eq(backlogTasks.backlogId, backlogId))
        .orderBy(backlogTasks.position);
      
      res.json(tasks);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create standalone task for backlog (without user story)
  app.post("/api/backlogs/:backlogId/tasks", requireAuth, requireOrgMember, requirePermission("product", "create", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const backlogId = req.params.backlogId;
      
      // Verify backlog belongs to account
      const [backlog] = await db.select().from(backlogs)
        .where(and(eq(backlogs.id, backlogId), eq(backlogs.accountId, accountId)));
      
      if (!backlog) {
        return res.status(404).json({ error: "Backlog not found" });
      }
      
      const data = insertBacklogTaskSchema.parse({
        ...req.body,
        accountId,
        backlogId,
        userStoryId: null, // Standalone task
        createdBy: userId,
      });
      
      const [task] = await db.insert(backlogTasks).values({
        ...data,
        reporterId: req.body.reporterId || userId,
      }).returning();
      
      // Create activity for task creation
      await storage.createActivity({
        accountId,
        subjectType: "backlog",
        subjectId: backlogId,
        kind: "updated",
        payload: { description: `Tâche créée: ${task.title}` },
        createdBy: userId,
      });
      
      res.status(201).json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create task under user story
  app.post("/api/user-stories/:userStoryId/tasks", requireAuth, requireOrgMember, requirePermission("product", "create", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const userStoryId = req.params.userStoryId;
      
      // Get the user story to find the backlogId
      const [userStory] = await db.select().from(userStories)
        .where(and(eq(userStories.id, userStoryId), eq(userStories.accountId, accountId)));
      
      if (!userStory) {
        return res.status(404).json({ error: "User story not found" });
      }
      
      const data = insertBacklogTaskSchema.parse({
        ...req.body,
        accountId,
        backlogId: userStory.backlogId,
        userStoryId,
        createdBy: userId,
      });
      
      const [task] = await db.insert(backlogTasks).values({
        ...data,
        reporterId: req.body.reporterId || userId,
      }).returning();
      
      // Create activity for task creation
      await storage.createActivity({
        accountId,
        subjectType: "backlog",
        subjectId: userStory.backlogId,
        kind: "updated",
        payload: { description: `Tâche créée: ${task.title}` },
        createdBy: userId,
      });
      
      res.status(201).json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update backlog task
  app.patch("/api/backlog-tasks/:id", requireAuth, requireOrgMember, requirePermission("product", "update", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const id = req.params.id;
      const data = updateBacklogTaskSchema.parse(req.body);
      
      // Get current state before update for activity tracking
      const [current] = await db.select().from(backlogTasks)
        .where(and(eq(backlogTasks.id, id), eq(backlogTasks.accountId, accountId)));
      
      const [updated] = await db.update(backlogTasks)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(backlogTasks.id, id), eq(backlogTasks.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      // Track state change activity
      if (current && data.state && current.state !== data.state) {
        await storage.createActivity({
          accountId,
          subjectType: "backlog_task",
          subjectId: id,
          kind: "updated",
          payload: { 
            type: "state_change",
            previousState: current.state,
            newState: data.state,
            description: `État modifié: ${current.state} → ${data.state}`
          },
          createdBy: userId,
        });
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete backlog task
  app.delete("/api/backlog-tasks/:id", requireAuth, requireOrgMember, requirePermission("product", "delete", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      
      const [deleted] = await db.delete(backlogTasks)
        .where(and(eq(backlogTasks.id, id), eq(backlogTasks.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // CHECKLIST ITEMS
  // ============================================

  // Get checklist items for a user story
  app.get("/api/user-stories/:userStoryId/checklist", requireAuth, requireOrgMember, requirePermission("product", "read", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userStoryId = req.params.userStoryId;
      
      // Verify user story belongs to account
      const [userStory] = await db.select().from(userStories)
        .where(and(eq(userStories.id, userStoryId), eq(userStories.accountId, accountId)));
      
      if (!userStory) {
        return res.status(404).json({ error: "User story not found" });
      }
      
      const result = await db.select().from(checklistItems)
        .where(eq(checklistItems.userStoryId, userStoryId))
        .orderBy(asc(checklistItems.order));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Add checklist item
  app.post("/api/user-stories/:userStoryId/checklist", requireAuth, requireOrgMember, requirePermission("product", "create", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userStoryId = req.params.userStoryId;
      
      // Verify user story belongs to account
      const [userStory] = await db.select().from(userStories)
        .where(and(eq(userStories.id, userStoryId), eq(userStories.accountId, accountId)));
      
      if (!userStory) {
        return res.status(404).json({ error: "User story not found" });
      }
      
      const data = insertChecklistItemSchema.parse({
        ...req.body,
        accountId,
        userStoryId,
      });
      
      const [item] = await db.insert(checklistItems).values(data).returning();
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update checklist item
  app.patch("/api/checklist-items/:id", requireAuth, requireOrgMember, requirePermission("product", "update", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      const data = updateChecklistItemSchema.parse(req.body);
      
      const [updated] = await db.update(checklistItems)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(checklistItems.id, id), eq(checklistItems.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Checklist item not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete checklist item
  app.delete("/api/checklist-items/:id", requireAuth, requireOrgMember, requirePermission("product", "delete", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      
      const [deleted] = await db.delete(checklistItems)
        .where(and(eq(checklistItems.id, id), eq(checklistItems.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "Checklist item not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // SPRINTS (Scrum mode)
  // ============================================

  // List sprints for a backlog
  app.get("/api/backlogs/:backlogId/sprints", requireAuth, requireOrgMember, requirePermission("product", "read", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogId = req.params.backlogId;
      
      const result = await db.select().from(sprints)
        .where(and(eq(sprints.backlogId, backlogId), eq(sprints.accountId, accountId)))
        .orderBy(asc(sprints.startDate));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create sprint
  app.post("/api/backlogs/:backlogId/sprints", requireAuth, requireOrgMember, requirePermission("product", "create", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const backlogId = req.params.backlogId;
      
      // Convert date strings to Date objects if provided
      const requestBody = { ...req.body };
      if (requestBody.startDate) {
        requestBody.startDate = new Date(requestBody.startDate);
      }
      if (requestBody.endDate) {
        requestBody.endDate = new Date(requestBody.endDate);
      }
      
      const data = insertSprintSchema.parse({
        ...requestBody,
        accountId,
        backlogId,
        createdBy: userId,
      });
      
      const [sprint] = await db.insert(sprints).values(data).returning();
      res.status(201).json(sprint);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update sprint
  app.patch("/api/sprints/:id", requireAuth, requireOrgMember, requirePermission("product", "update", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      
      // Convert date strings to Date objects if provided
      const requestBody = { ...req.body };
      if (requestBody.startDate) {
        requestBody.startDate = new Date(requestBody.startDate);
      }
      if (requestBody.endDate) {
        requestBody.endDate = new Date(requestBody.endDate);
      }
      
      const data = updateSprintSchema.parse(requestBody);
      
      const [updated] = await db.update(sprints)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(sprints.id, id), eq(sprints.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Sprint not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Start sprint
  app.patch("/api/sprints/:id/start", requireAuth, requireOrgMember, requirePermission("product", "update", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      
      const [updated] = await db.update(sprints)
        .set({ status: "en_cours", updatedAt: new Date() })
        .where(and(eq(sprints.id, id), eq(sprints.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Sprint not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Close sprint with ticket reassignment
  app.patch("/api/sprints/:id/close", requireAuth, requireOrgMember, requirePermission("product", "update", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      const { redirectTo } = req.body; // 'backlog' or sprint ID
      
      // Get the sprint first
      const [sprint] = await db.select().from(sprints)
        .where(and(eq(sprints.id, id), eq(sprints.accountId, accountId)));
      
      if (!sprint) {
        return res.status(404).json({ error: "Sprint not found" });
      }
      
      // Get all unfinished tickets in this sprint (epics, user stories, tasks)
      const unfinishedEpics = await db.select().from(epics)
        .where(and(eq(epics.sprintId, id), eq(epics.accountId, accountId), not(eq(epics.state, "termine"))));
      
      const unfinishedStories = await db.select().from(userStories)
        .where(and(eq(userStories.sprintId, id), eq(userStories.accountId, accountId), not(eq(userStories.state, "termine"))));
      
      const unfinishedTasks = await db.select().from(backlogTasks)
        .where(and(eq(backlogTasks.sprintId, id), eq(backlogTasks.accountId, accountId), not(eq(backlogTasks.state, "termine"))));
      
      const totalUnfinished = unfinishedEpics.length + unfinishedStories.length + unfinishedTasks.length;
      
      // If there are unfinished tickets and no redirect target, return error
      if (totalUnfinished > 0 && !redirectTo) {
        return res.status(400).json({ 
          error: "unfinished_tickets",
          message: "Sprint has unfinished tickets that must be redirected",
          unfinishedCount: totalUnfinished
        });
      }
      
      // Determine target sprint ID (null for backlog)
      const targetSprintId = redirectTo === 'backlog' ? null : redirectTo;
      
      // If redirecting to a sprint, validate it exists
      if (targetSprintId) {
        const [targetSprint] = await db.select().from(sprints)
          .where(and(eq(sprints.id, targetSprintId), eq(sprints.accountId, accountId)));
        
        if (!targetSprint) {
          return res.status(400).json({ error: "Target sprint not found" });
        }
        
        if (targetSprint.status === "termine") {
          return res.status(400).json({ error: "Cannot redirect to a closed sprint" });
        }
      }
      
      // Move all unfinished tickets to target
      if (unfinishedEpics.length > 0) {
        await db.update(epics)
          .set({ sprintId: targetSprintId, updatedAt: new Date() })
          .where(and(eq(epics.sprintId, id), eq(epics.accountId, accountId), not(eq(epics.state, "termine"))));
      }
      
      if (unfinishedStories.length > 0) {
        await db.update(userStories)
          .set({ sprintId: targetSprintId, updatedAt: new Date() })
          .where(and(eq(userStories.sprintId, id), eq(userStories.accountId, accountId), not(eq(userStories.state, "termine"))));
      }
      
      if (unfinishedTasks.length > 0) {
        await db.update(backlogTasks)
          .set({ sprintId: targetSprintId, updatedAt: new Date() })
          .where(and(eq(backlogTasks.sprintId, id), eq(backlogTasks.accountId, accountId), not(eq(backlogTasks.state, "termine"))));
      }
      
      // Close the sprint
      const [updated] = await db.update(sprints)
        .set({ status: "termine", updatedAt: new Date() })
        .where(and(eq(sprints.id, id), eq(sprints.accountId, accountId)))
        .returning();
      
      res.json({ 
        sprint: updated, 
        movedTickets: totalUnfinished,
        redirectedTo: redirectTo === 'backlog' ? 'backlog' : targetSprintId
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete sprint with optional ticket reassignment
  app.delete("/api/sprints/:id", requireAuth, requireOrgMember, requirePermission("product", "delete", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      const { redirectTo } = req.body || {}; // 'backlog' or sprint ID
      
      // First get the sprint to check it exists and get backlog ID
      const [sprint] = await db.select().from(sprints)
        .where(and(eq(sprints.id, id), eq(sprints.accountId, accountId)));
      
      if (!sprint) {
        return res.status(404).json({ error: "Sprint not found" });
      }
      
      // Cannot delete a sprint that is "en_cours"
      if (sprint.status === "en_cours") {
        return res.status(400).json({ error: "Impossible de supprimer un sprint en cours. Terminez-le d'abord." });
      }
      
      // Get all tickets in this sprint
      const storiesInSprint = await db.select().from(userStories)
        .where(and(eq(userStories.sprintId, id), eq(userStories.accountId, accountId)));
      const tasksInSprint = await db.select().from(backlogTasks)
        .where(and(eq(backlogTasks.sprintId, id), eq(backlogTasks.accountId, accountId)));
      
      const hasTickets = storiesInSprint.length > 0 || tasksInSprint.length > 0;
      
      // If there are tickets, we need a redirect target
      if (hasTickets && !redirectTo) {
        return res.status(400).json({ 
          error: "Ce sprint contient des tickets. Veuillez spécifier une destination pour les réassigner.",
          ticketCount: storiesInSprint.length + tasksInSprint.length
        });
      }
      
      // Reassign tickets if needed
      if (hasTickets) {
        const targetSprintId = redirectTo === 'backlog' ? null : redirectTo;
        
        if (storiesInSprint.length > 0) {
          await db.update(userStories)
            .set({ sprintId: targetSprintId, updatedAt: new Date() })
            .where(and(eq(userStories.sprintId, id), eq(userStories.accountId, accountId)));
        }
        
        if (tasksInSprint.length > 0) {
          await db.update(backlogTasks)
            .set({ sprintId: targetSprintId, updatedAt: new Date() })
            .where(and(eq(backlogTasks.sprintId, id), eq(backlogTasks.accountId, accountId)));
        }
      }
      
      // Now delete the sprint
      const [deleted] = await db.delete(sprints)
        .where(and(eq(sprints.id, id), eq(sprints.accountId, accountId)))
        .returning();
      
      res.json({ 
        success: true, 
        movedTickets: storiesInSprint.length + tasksInSprint.length,
        redirectedTo: redirectTo === 'backlog' ? 'backlog' : redirectTo || null
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Move sprint position (up or down)
  app.patch("/api/sprints/:id/move", requireAuth, requireOrgMember, requirePermission("product", "update", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      const { direction } = req.body; // 'up' or 'down'
      
      console.log(`🔄 Moving sprint ${id} ${direction}`);
      
      if (direction !== 'up' && direction !== 'down') {
        return res.status(400).json({ error: "Direction must be 'up' or 'down'" });
      }
      
      // Get the sprint
      const [sprint] = await db.select().from(sprints)
        .where(and(eq(sprints.id, id), eq(sprints.accountId, accountId)));
      
      if (!sprint) {
        return res.status(404).json({ error: "Sprint not found" });
      }
      
      // Get all sprints for this backlog ordered by position, then createdAt
      let allSprints = await db.select().from(sprints)
        .where(and(eq(sprints.backlogId, sprint.backlogId), eq(sprints.accountId, accountId)))
        .orderBy(sprints.createdAt);
      
      // Sort by position if available, otherwise by createdAt order
      allSprints = allSprints.sort((a, b) => {
        const posA = a.position ?? 999;
        const posB = b.position ?? 999;
        if (posA !== posB) return posA - posB;
        return new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
      });
      
      // Initialize positions if needed (any sprint has null position)
      const needsInit = allSprints.some(s => s.position === null);
      if (needsInit) {
        console.log('📍 Initializing sprint positions...');
        for (let i = 0; i < allSprints.length; i++) {
          await db.update(sprints)
            .set({ position: i })
            .where(eq(sprints.id, allSprints[i].id));
          allSprints[i].position = i;
        }
      }
      
      // Find current index
      const currentIndex = allSprints.findIndex(s => s.id === id);
      console.log(`📊 Current index: ${currentIndex}, Total sprints: ${allSprints.length}`);
      
      // Calculate new index
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      // Validate bounds
      if (newIndex < 0 || newIndex >= allSprints.length) {
        return res.status(400).json({ error: "Cannot move sprint further in this direction" });
      }
      
      // Swap positions
      const otherSprint = allSprints[newIndex];
      const currentPosition = allSprints[currentIndex].position!;
      const otherPosition = otherSprint.position!;
      
      console.log(`🔀 Swapping positions: ${currentPosition} <-> ${otherPosition}`);
      
      // Update both sprints
      await db.update(sprints)
        .set({ position: otherPosition, updatedAt: new Date() })
        .where(eq(sprints.id, id));
      
      await db.update(sprints)
        .set({ position: currentPosition, updatedAt: new Date() })
        .where(eq(sprints.id, otherSprint.id));
      
      console.log('✅ Sprint moved successfully');
      res.json({ success: true });
    } catch (error: any) {
      console.error('❌ Error moving sprint:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // BACKLOG COLUMNS (Kanban mode)
  // ============================================

  // List columns for a backlog
  app.get("/api/backlogs/:backlogId/columns", requireAuth, requireOrgMember, requirePermission("product", "read", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogId = req.params.backlogId;
      
      const result = await db.select().from(backlogColumns)
        .where(and(eq(backlogColumns.backlogId, backlogId), eq(backlogColumns.accountId, accountId)))
        .orderBy(asc(backlogColumns.order));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create column
  app.post("/api/backlogs/:backlogId/columns", requireAuth, requireOrgMember, requirePermission("product", "create", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogId = req.params.backlogId;
      
      const data = insertBacklogColumnSchema.parse({
        ...req.body,
        accountId,
        backlogId,
      });
      
      const [column] = await db.insert(backlogColumns).values(data).returning();
      res.status(201).json(column);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update column
  app.patch("/api/backlog-columns/:id", requireAuth, requireOrgMember, requirePermission("product", "update", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      const data = updateBacklogColumnSchema.parse(req.body);
      
      const [updated] = await db.update(backlogColumns)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(backlogColumns.id, id), eq(backlogColumns.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Column not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete column
  app.delete("/api/backlog-columns/:id", requireAuth, requireOrgMember, requirePermission("product", "delete", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      
      // Check if column is locked
      const [column] = await db.select().from(backlogColumns)
        .where(and(eq(backlogColumns.id, id), eq(backlogColumns.accountId, accountId)));
      
      if (!column) {
        return res.status(404).json({ error: "Column not found" });
      }
      
      if (column.isLocked) {
        return res.status(400).json({ error: "Cannot delete a locked column" });
      }
      
      await db.delete(backlogColumns).where(eq(backlogColumns.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // IMPORT FROM PROJECT TASKS
  // ============================================

  // Import tasks from a linked project
  app.post("/api/backlogs/:backlogId/import-from-project", requireAuth, requireOrgMember, requirePermission("product", "create", "product.backlog"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const backlogId = req.params.backlogId;
      
      // Get the backlog to find the projectId
      const [backlog] = await db.select().from(backlogs)
        .where(and(eq(backlogs.id, backlogId), eq(backlogs.accountId, accountId)));
      
      if (!backlog) {
        return res.status(404).json({ error: "Backlog not found" });
      }
      
      if (!backlog.projectId) {
        return res.status(400).json({ error: "Backlog has no linked project" });
      }
      
      // Get all tasks from the project
      const projectTasks = await db.select().from(tasks)
        .where(and(eq(tasks.projectId, backlog.projectId), eq(tasks.accountId, accountId)));
      
      // Create backlog_tasks for each project task
      const createdTasks = [];
      for (const task of projectTasks) {
        const [backlogTask] = await db.insert(backlogTasks).values({
          accountId,
          backlogId,
          title: task.title,
          description: task.description,
          state: task.status === "done" ? "termine" : (task.status === "in_progress" ? "en_cours" : "a_faire"),
          dueDate: task.dueDate,
          assigneeId: task.assignedToId,
          createdBy: userId,
        }).returning();
        createdTasks.push(backlogTask);
      }
      
      res.json({
        success: true,
        imported: createdTasks.length,
        tasks: createdTasks,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // TICKET ACTIVITIES (state changes)
  // ============================================

  // Get activities for a ticket (state changes)
  app.get("/api/tickets/:ticketId/:ticketType/activities", requireAuth, requireOrgMember, requirePermission("product", "read"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const ticketId = req.params.ticketId;
      const ticketType = req.params.ticketType;
      
      // Map frontend ticketType to backend subjectType
      // task and bug are stored as backlog_task in activities
      const subjectType = ticketType === "task" || ticketType === "bug" 
        ? "backlog_task" 
        : ticketType;
      
      console.log(`📊 Fetching ticket activities: ticketId=${ticketId}, ticketType=${ticketType}, subjectType=${subjectType}`);
      
      const result = await db.select().from(activities)
        .where(and(
          eq(activities.subjectId, ticketId),
          eq(activities.accountId, accountId),
          eq(activities.subjectType, subjectType)
        ))
        .orderBy(desc(activities.createdAt));
      
      console.log(`📊 Found ${result.length} activities for ticket ${ticketId}:`, result.map(a => ({ id: a.id, payload: a.payload })));
      
      // Enrich activities with user info
      const enrichedActivities = await Promise.all(result.map(async (activity) => {
        let user = undefined;
        if (activity.createdBy) {
          try {
            const [foundUser] = await db.select({
              id: appUsers.id,
              firstName: appUsers.firstName,
              lastName: appUsers.lastName,
              email: appUsers.email,
            }).from(appUsers).where(eq(appUsers.id, activity.createdBy));
            user = foundUser;
          } catch (e) {
            console.log(`📊 Could not find user for activity ${activity.id}, createdBy=${activity.createdBy}`);
          }
        }
        return {
          ...activity,
          user,
        };
      }));
      
      res.json(enrichedActivities);
    } catch (error: any) {
      console.error(`📊 Error fetching ticket activities:`, error);
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // TICKET COMMENTS
  // ============================================

  // Get comments for a ticket
  app.get("/api/tickets/:ticketId/:ticketType/comments", requireAuth, requireOrgMember, requirePermission("product", "read"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const ticketId = req.params.ticketId;
      const ticketType = req.params.ticketType;
      
      const result = await db.select().from(ticketComments)
        .where(and(
          eq(ticketComments.ticketId, ticketId), 
          eq(ticketComments.accountId, accountId),
          eq(ticketComments.ticketType, ticketType)
        ))
        .orderBy(asc(ticketComments.createdAt));
      
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create comment on a ticket
  app.post("/api/tickets/:ticketId/:ticketType/comments", requireAuth, requireOrgMember, requirePermission("product", "create"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const ticketId = req.params.ticketId;
      const ticketType = req.params.ticketType;
      
      const data = insertTicketCommentSchema.parse({
        content: req.body.content,
        accountId,
        ticketId,
        ticketType,
        authorId: userId,
      });
      
      const [comment] = await db.insert(ticketComments).values(data).returning();
      res.status(201).json(comment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update comment
  app.patch("/api/ticket-comments/:commentId", requireAuth, requireOrgMember, requirePermission("product", "update"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const commentId = req.params.commentId;
      const data = updateTicketCommentSchema.parse(req.body);
      
      const [updated] = await db.update(ticketComments)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(ticketComments.id, commentId), eq(ticketComments.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Comment not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete comment
  app.delete("/api/ticket-comments/:commentId", requireAuth, requireOrgMember, requirePermission("product", "delete"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const commentId = req.params.commentId;
      
      const [deleted] = await db.delete(ticketComments)
        .where(and(eq(ticketComments.id, commentId), eq(ticketComments.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "Comment not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // TICKET ACCEPTANCE CRITERIA (Critères d'acceptation)
  // ============================================

  // Get acceptance criteria for a ticket
  app.get("/api/tickets/:ticketId/:ticketType/acceptance-criteria", requireAuth, requireOrgMember, requirePermission("product", "read"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const ticketId = req.params.ticketId;
      const ticketType = req.params.ticketType;
      
      const result = await db.select().from(ticketAcceptanceCriteria)
        .where(and(
          eq(ticketAcceptanceCriteria.ticketId, ticketId), 
          eq(ticketAcceptanceCriteria.accountId, accountId),
          eq(ticketAcceptanceCriteria.ticketType, ticketType)
        ))
        .orderBy(asc(ticketAcceptanceCriteria.position));
      
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create acceptance criterion
  app.post("/api/tickets/:ticketId/:ticketType/acceptance-criteria", requireAuth, requireOrgMember, requirePermission("product", "create"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const ticketId = req.params.ticketId;
      const ticketType = req.params.ticketType;
      
      // Get next position
      const existingCriteria = await db.select({ position: ticketAcceptanceCriteria.position })
        .from(ticketAcceptanceCriteria)
        .where(and(
          eq(ticketAcceptanceCriteria.ticketId, ticketId),
          eq(ticketAcceptanceCriteria.accountId, accountId)
        ))
        .orderBy(desc(ticketAcceptanceCriteria.position))
        .limit(1);
      
      const nextPosition = existingCriteria.length > 0 ? existingCriteria[0].position + 1 : 0;
      
      const data = insertTicketAcceptanceCriteriaSchema.parse({
        content: req.body.content,
        accountId,
        ticketId,
        ticketType,
        position: nextPosition,
      });
      
      const [criterion] = await db.insert(ticketAcceptanceCriteria).values(data).returning();
      res.status(201).json(criterion);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update acceptance criterion
  app.patch("/api/acceptance-criteria/:criterionId", requireAuth, requireOrgMember, requirePermission("product", "update"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const criterionId = req.params.criterionId;
      const data = updateTicketAcceptanceCriteriaSchema.parse(req.body);
      
      const [updated] = await db.update(ticketAcceptanceCriteria)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(ticketAcceptanceCriteria.id, criterionId), eq(ticketAcceptanceCriteria.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Acceptance criterion not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete acceptance criterion
  app.delete("/api/acceptance-criteria/:criterionId", requireAuth, requireOrgMember, requirePermission("product", "delete"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const criterionId = req.params.criterionId;
      
      const [deleted] = await db.delete(ticketAcceptanceCriteria)
        .where(and(eq(ticketAcceptanceCriteria.id, criterionId), eq(ticketAcceptanceCriteria.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "Acceptance criterion not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // TICKET RECIPES (Cahier de recette / QA Testing)
  // ============================================

  // Get recipes for selected sprints with tickets data
  app.get("/api/backlogs/:backlogId/recipes", requireAuth, requireOrgMember, requirePermission("product", "read", "product.recipe"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogId = req.params.backlogId;
      const sprintIds = req.query.sprintIds ? (req.query.sprintIds as string).split(",") : [];
      
      if (sprintIds.length === 0) {
        return res.json({ sprints: [], recipes: [] });
      }
      
      // Get sprints data
      const sprintsData = await db.select().from(sprints)
        .where(and(
          eq(sprints.backlogId, backlogId),
          eq(sprints.accountId, accountId),
          inArray(sprints.id, sprintIds)
        ))
        .orderBy(asc(sprints.position), asc(sprints.createdAt));
      
      // Get user stories in these sprints
      const stories = await db.select().from(userStories)
        .where(and(
          eq(userStories.backlogId, backlogId),
          eq(userStories.accountId, accountId),
          inArray(userStories.sprintId, sprintIds)
        ))
        .orderBy(asc(userStories.order));
      
      // Get tasks in these sprints
      const tasksList = await db.select().from(backlogTasks)
        .where(and(
          eq(backlogTasks.backlogId, backlogId),
          eq(backlogTasks.accountId, accountId),
          inArray(backlogTasks.sprintId, sprintIds)
        ))
        .orderBy(asc(backlogTasks.order));
      
      // Get existing recipes for these sprints
      const recipesList = await db.select().from(ticketRecipes)
        .where(and(
          eq(ticketRecipes.backlogId, backlogId),
          eq(ticketRecipes.accountId, accountId),
          inArray(ticketRecipes.sprintId, sprintIds)
        ));
      
      // Create a map of recipes by ticketId+sprintId
      const recipesMap = new Map<string, typeof recipesList[0]>();
      recipesList.forEach(r => {
        recipesMap.set(`${r.ticketId}-${r.sprintId}`, r);
      });
      
      // Build tickets with recipes for each sprint
      const sprintsWithTickets = sprintsData.map(sprint => {
        const sprintStories = stories.filter(s => s.sprintId === sprint.id);
        const sprintTasks = tasksList.filter(t => t.sprintId === sprint.id);
        
        const tickets = [
          ...sprintStories.map(s => ({
            id: s.id,
            type: "user_story" as const,
            title: s.title,
            description: s.description,
            state: s.state,
            priority: s.priority,
            recipe: recipesMap.get(`${s.id}-${sprint.id}`) || null,
          })),
          ...sprintTasks.map(t => ({
            id: t.id,
            type: "task" as const,
            title: t.title,
            description: t.description,
            state: t.state,
            priority: t.priority,
            recipe: recipesMap.get(`${t.id}-${sprint.id}`) || null,
          })),
        ];
        
        // Count stats
        const stats = {
          total: tickets.length,
          tested: tickets.filter(t => t.recipe?.status === "teste").length,
          fixed: tickets.filter(t => t.recipe?.isFixedDone).length,
        };
        
        return {
          ...sprint,
          tickets,
          stats,
        };
      });
      
      res.json({ sprints: sprintsWithTickets });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get recipe for a specific ticket
  app.get("/api/tickets/:ticketId/recipe", requireAuth, requireOrgMember, requirePermission("product", "read", "product.recipe"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const ticketId = req.params.ticketId;
      
      // Find the recipe for this ticket (most recent by sprint)
      const recipes = await db.select({
        recipe: ticketRecipes,
        sprint: sprints,
      })
        .from(ticketRecipes)
        .leftJoin(sprints, eq(ticketRecipes.sprintId, sprints.id))
        .where(and(
          eq(ticketRecipes.ticketId, ticketId),
          eq(ticketRecipes.accountId, accountId)
        ))
        .orderBy(desc(sprints.createdAt))
        .limit(1);
      
      if (recipes.length === 0) {
        return res.json({ recipe: null });
      }
      
      const { recipe, sprint } = recipes[0];
      res.json({
        recipe: {
          ...recipe,
          sprintId: sprint?.id || recipe.sprintId,
          sprintName: sprint?.name || "Sprint",
        }
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Upsert recipe for a ticket
  app.post("/api/backlogs/:backlogId/recipes/upsert", requireAuth, requireOrgMember, requirePermission("product", "create", "product.recipe"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const backlogId = req.params.backlogId;
      
      const data = upsertTicketRecipeSchema.parse(req.body);
      const { pushToTicket, ...recipeData } = data;
      
      // Auto-apply logic based on conclusion:
      // - "termine": Set isFixedDone to true, status to "teste", ticket state to "testing"
      // - "a_fix": Set ticket state to "to_fix"
      let autoIsFixedDone = recipeData.isFixedDone;
      let autoStatus = recipeData.status;
      let shouldUpdateTicketState = false;
      let newTicketState: string | null = null;
      
      if (recipeData.conclusion === "termine") {
        autoIsFixedDone = true;
        autoStatus = "teste";
        shouldUpdateTicketState = true;
        newTicketState = "testing";
      } else if (recipeData.conclusion === "a_fix") {
        shouldUpdateTicketState = true;
        newTicketState = "to_fix";
      }
      
      // Check if recipe exists
      const existing = await db.select().from(ticketRecipes)
        .where(and(
          eq(ticketRecipes.ticketId, recipeData.ticketId),
          eq(ticketRecipes.sprintId, recipeData.sprintId),
          eq(ticketRecipes.accountId, accountId)
        ))
        .limit(1);
      
      let recipe;
      
      if (existing.length > 0) {
        // Update existing
        const updateData: any = { updatedBy: userId, updatedAt: new Date() };
        if (autoStatus !== undefined) updateData.status = autoStatus;
        if (recipeData.observedResults !== undefined) updateData.observedResults = recipeData.observedResults;
        if (recipeData.conclusion !== undefined) updateData.conclusion = recipeData.conclusion;
        if (recipeData.suggestions !== undefined) updateData.suggestions = recipeData.suggestions;
        if (recipeData.remarks !== undefined) updateData.remarks = recipeData.remarks;
        if (autoIsFixedDone !== undefined) updateData.isFixedDone = autoIsFixedDone;
        
        [recipe] = await db.update(ticketRecipes)
          .set(updateData)
          .where(eq(ticketRecipes.id, existing[0].id))
          .returning();
      } else {
        // Create new recipe
        [recipe] = await db.insert(ticketRecipes).values({
          accountId,
          backlogId,
          sprintId: recipeData.sprintId,
          ticketId: recipeData.ticketId,
          ticketType: recipeData.ticketType,
          status: autoStatus || "a_tester",
          observedResults: recipeData.observedResults || null,
          conclusion: recipeData.conclusion || null,
          suggestions: recipeData.suggestions || null,
          remarks: recipeData.remarks || null,
          isFixedDone: autoIsFixedDone || false,
          updatedBy: userId,
        }).returning();
      }
      
      // Update ticket state based on conclusion
      // - "termine" -> "testing"
      // - "a_fix" -> "to_fix"
      if (shouldUpdateTicketState && newTicketState) {
        if (recipeData.ticketType === "user_story") {
          await db.update(userStories)
            .set({ state: newTicketState, updatedAt: new Date() })
            .where(and(
              eq(userStories.id, recipeData.ticketId),
              eq(userStories.accountId, accountId)
            ));
        } else if (recipeData.ticketType === "task" || recipeData.ticketType === "bug") {
          // Both tasks and bugs are stored in backlog_tasks table
          await db.update(backlogTasks)
            .set({ state: newTicketState, updatedAt: new Date() })
            .where(and(
              eq(backlogTasks.id, recipeData.ticketId),
              eq(backlogTasks.accountId, accountId)
            ));
        }
      }
      
      // If pushToTicket is true, create a comment on the ticket
      // Remarks and suggestions create comments, but NOT observedResults
      if (pushToTicket && (recipeData.suggestions || recipeData.remarks)) {
        // Get sprint name
        const [sprint] = await db.select().from(sprints)
          .where(eq(sprints.id, recipeData.sprintId))
          .limit(1);
        
        const sprintName = sprint?.name || "Sprint";
        const statusLabel = recipeStatusOptions.find(s => s.value === (autoStatus || recipe.status))?.label || "À tester";
        const conclusionLabel = recipeData.conclusion 
          ? recipeConclusionOptions.find(c => c.value === recipeData.conclusion)?.label 
          : null;
        
        // Build formatted comment
        let commentParts = [`[🧪 Recette] Sprint: ${sprintName}`, `Statut: ${statusLabel}`];
        
        if (conclusionLabel) {
          commentParts.push(`Conclusion: ${conclusionLabel}`);
        }
        
        if (recipeData.suggestions) {
          commentParts.push("", "Suggestions:", recipeData.suggestions);
        }
        
        if (recipeData.remarks) {
          commentParts.push("", "Remarques:", recipeData.remarks);
        }
        
        const commentContent = commentParts.join("\n");
        
        // Create the comment
        await db.insert(ticketComments).values({
          accountId,
          ticketId: recipeData.ticketId,
          ticketType: recipeData.ticketType,
          content: commentContent,
          authorId: userId,
        });
      }
      
      res.json(recipe);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // RETROSPECTIVES
  // ============================================

  // List all retros for a backlog
  app.get("/api/backlogs/:backlogId/retros", requireAuth, requireOrgMember, requirePermission("product", "read", "product.retrospective"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const backlogId = req.params.backlogId;
      
      const retroList = await db.select({
        retro: retros,
        sprint: sprints,
      })
        .from(retros)
        .leftJoin(sprints, eq(retros.sprintId, sprints.id))
        .where(and(eq(retros.backlogId, backlogId), eq(retros.accountId, accountId)))
        .orderBy(desc(retros.createdAt));
      
      // Get card counts for all retros
      const retroIds = retroList.map(r => r.retro.id);
      const cardCounts: Record<string, number> = {};
      
      if (retroIds.length > 0) {
        const counts = await db.select({
          retroId: retroCards.retroId,
          count: sql<number>`count(*)::int`,
        })
          .from(retroCards)
          .where(inArray(retroCards.retroId, retroIds))
          .groupBy(retroCards.retroId);
        
        counts.forEach(c => {
          cardCounts[c.retroId] = c.count;
        });
      }
      
      res.json(retroList.map(r => ({
        ...r.retro,
        sprint: r.sprint,
        cardCount: cardCounts[r.retro.id] || 0,
      })));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create new retro for a sprint
  app.post("/api/backlogs/:backlogId/retros", requireAuth, requireOrgMember, requirePermission("product", "create", "product.retrospective"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const backlogId = req.params.backlogId;
      const { sprintId } = req.body;
      
      // Get next number for this backlog
      const existingRetros = await db.select().from(retros)
        .where(and(eq(retros.backlogId, backlogId), eq(retros.accountId, accountId)));
      const nextNumber = existingRetros.length + 1;
      
      const [retro] = await db.insert(retros).values({
        accountId,
        backlogId,
        sprintId: sprintId || null,
        number: nextNumber,
        status: "en_cours",
        createdBy: userId,
      }).returning();
      
      res.status(201).json(retro);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get single retro
  app.get("/api/retros/:retroId", requireAuth, requireOrgMember, requirePermission("product", "read", "product.retrospective"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const retroId = req.params.retroId;
      
      const [result] = await db.select({
        retro: retros,
        sprint: sprints,
      })
        .from(retros)
        .leftJoin(sprints, eq(retros.sprintId, sprints.id))
        .where(and(eq(retros.id, retroId), eq(retros.accountId, accountId)));
      
      if (!result) {
        return res.status(404).json({ error: "Retro not found" });
      }
      
      res.json({
        ...result.retro,
        sprint: result.sprint,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update retro (status, etc.)
  app.patch("/api/retros/:retroId", requireAuth, requireOrgMember, requirePermission("product", "update", "product.retrospective"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const retroId = req.params.retroId;
      const { status } = req.body;
      
      const [updated] = await db.update(retros)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(retros.id, retroId), eq(retros.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Retro not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete retro
  app.delete("/api/retros/:retroId", requireAuth, requireOrgMember, requirePermission("product", "delete", "product.retrospective"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const retroId = req.params.retroId;
      
      const [deleted] = await db.delete(retros)
        .where(and(eq(retros.id, retroId), eq(retros.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "Retro not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get retro cards
  app.get("/api/retros/:retroId/cards", requireAuth, requireOrgMember, requirePermission("product", "read", "product.retrospective"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const retroId = req.params.retroId;
      
      const cards = await db.select().from(retroCards)
        .where(and(eq(retroCards.retroId, retroId), eq(retroCards.accountId, accountId)))
        .orderBy(asc(retroCards.order), asc(retroCards.createdAt));
      
      res.json(cards);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create retro card
  app.post("/api/retros/:retroId/cards", requireAuth, requireOrgMember, requirePermission("product", "create", "product.retrospective"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const retroId = req.params.retroId;
      const { column, content } = req.body;
      
      if (!column || !content) {
        return res.status(400).json({ error: "Column and content are required" });
      }
      
      const [card] = await db.insert(retroCards).values({
        accountId,
        retroId,
        column,
        content,
        authorId: userId,
        order: 0,
      }).returning();
      
      res.status(201).json(card);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update retro card (for drag-drop column change)
  app.patch("/api/retro-cards/:cardId", requireAuth, requireOrgMember, requirePermission("product", "update", "product.retrospective"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const cardId = req.params.cardId;
      const { column, order } = req.body;
      
      const updateData: any = { updatedAt: new Date() };
      if (column) updateData.column = column;
      if (order !== undefined) updateData.order = order;
      
      const [updated] = await db.update(retroCards)
        .set(updateData)
        .where(and(eq(retroCards.id, cardId), eq(retroCards.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Card not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete retro card
  app.delete("/api/retro-cards/:cardId", requireAuth, requireOrgMember, requirePermission("product", "delete", "product.retrospective"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const cardId = req.params.cardId;
      
      const [deleted] = await db.delete(retroCards)
        .where(and(eq(retroCards.id, cardId), eq(retroCards.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "Card not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // SETTINGS (Account-level configuration)
  // ============================================

  // Get a specific setting by key for account
  app.get("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { key } = req.params;
      
      const setting = await storage.getSetting('ACCOUNT', accountId, key);
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json(setting);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all settings for account
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const settingsList = await storage.getSettingsByScope('ACCOUNT', accountId);
      res.json(settingsList);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Upsert a setting (create or update)
  app.put("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const { key } = req.params;
      const { value } = req.body;
      
      if (value === undefined) {
        return res.status(400).json({ error: "Value is required" });
      }
      
      const setting = await storage.upsertSetting({
        scope: 'ACCOUNT',
        scopeId: accountId,
        key,
        value,
        updatedBy: userId,
      });
      
      res.json(setting);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a setting
  app.delete("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { key } = req.params;
      
      const deleted = await storage.deleteSetting('ACCOUNT', accountId, key);
      if (!deleted) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get effective TJM and internal daily cost for a project (project override ?? global)
  app.get("/api/projects/:projectId/effective-tjm", requireAuth, requireOrgMember, requirePermission("profitability", "read"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { projectId } = req.params;
      
      // Get project
      const project = await storage.getProject(projectId);
      if (!project || project.accountId !== accountId) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Project TJM (billingRate) has priority
      const projectTJM = project.billingRate ? parseFloat(project.billingRate.toString()) : null;
      
      // Get global TJM from settings
      const globalTJMSetting = await storage.getSetting('ACCOUNT', accountId, 'billing.defaultTJM');
      const globalTJM = globalTJMSetting?.value ? parseFloat(String(globalTJMSetting.value)) : null;
      
      // Effective TJM: project ?? global
      const effectiveTJM = projectTJM ?? globalTJM;
      
      // Project internal daily cost has priority
      const projectInternalDailyCost = project.internalDailyCost ? parseFloat(project.internalDailyCost.toString()) : null;
      
      // Get global internal daily cost from settings
      const globalInternalCostSetting = await storage.getSetting('ACCOUNT', accountId, 'billing.defaultInternalDailyCost');
      const globalInternalDailyCost = globalInternalCostSetting?.value ? parseFloat(String(globalInternalCostSetting.value)) : null;
      
      // Effective internal daily cost: project ?? global
      const effectiveInternalDailyCost = projectInternalDailyCost ?? globalInternalDailyCost;
      
      res.json({
        effectiveTJM,
        source: projectTJM !== null ? 'project' : (globalTJM !== null ? 'global' : null),
        projectTJM,
        globalTJM,
        hasTJM: effectiveTJM !== null && effectiveTJM > 0,
        // Internal daily cost
        effectiveInternalDailyCost,
        internalDailyCostSource: projectInternalDailyCost !== null ? 'project' : (globalInternalDailyCost !== null ? 'global' : null),
        projectInternalDailyCost,
        globalInternalDailyCost,
        hasInternalDailyCost: effectiveInternalDailyCost !== null && effectiveInternalDailyCost > 0
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // PROJECT RESOURCES - Resource tracking
  // ============================================

  // Get all resources for a project
  app.get("/api/projects/:projectId/resources", requireAuth, requireOrgMember, requirePermission("profitability", "read", "profitability.resources"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { projectId } = req.params;
      const { type, status, isSimulation } = req.query;
      
      let query = db.select().from(projectResources)
        .where(and(
          eq(projectResources.accountId, accountId),
          eq(projectResources.projectId, projectId)
        ));
      
      const resources = await query.orderBy(asc(projectResources.createdAt));
      
      // Filter in memory for optional params
      let filtered = resources;
      if (type) {
        filtered = filtered.filter(r => r.type === type);
      }
      if (status) {
        filtered = filtered.filter(r => r.status === status);
      }
      if (isSimulation !== undefined) {
        const simValue = isSimulation === 'true' ? 1 : 0;
        filtered = filtered.filter(r => r.isSimulation === simValue);
      }
      
      res.json(filtered);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new project resource
  app.post("/api/projects/:projectId/resources", requireAuth, requireOrgMember, requirePermission("profitability", "create", "profitability.resources"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const { projectId } = req.params;
      
      // Verify project exists and belongs to account
      const project = await storage.getProject(projectId);
      if (!project || project.accountId !== accountId) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const validated = insertProjectResourceSchema.parse({
        ...req.body,
        accountId,
        projectId,
        createdBy: userId,
      });
      
      const [resource] = await db.insert(projectResources).values(validated).returning();
      res.status(201).json(resource);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update a project resource
  app.patch("/api/resources/:resourceId", requireAuth, requireOrgMember, requirePermission("profitability", "update", "profitability.resources"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { resourceId } = req.params;
      
      // Verify resource exists and belongs to account
      const [existing] = await db.select().from(projectResources)
        .where(and(
          eq(projectResources.id, resourceId),
          eq(projectResources.accountId, accountId)
        ));
      
      if (!existing) {
        return res.status(404).json({ error: "Resource not found" });
      }
      
      const [updated] = await db.update(projectResources)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(projectResources.id, resourceId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a project resource
  app.delete("/api/resources/:resourceId", requireAuth, requireOrgMember, requirePermission("profitability", "delete", "profitability.resources"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { resourceId } = req.params;
      
      // Verify resource exists and belongs to account
      const [existing] = await db.select().from(projectResources)
        .where(and(
          eq(projectResources.id, resourceId),
          eq(projectResources.accountId, accountId)
        ));
      
      if (!existing) {
        return res.status(404).json({ error: "Resource not found" });
      }
      
      await db.delete(projectResources).where(eq(projectResources.id, resourceId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get resource cost summary for a project
  app.get("/api/projects/:projectId/resources/summary", requireAuth, requireOrgMember, requirePermission("profitability", "read", "profitability.resources"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { projectId } = req.params;
      const { isSimulation } = req.query;
      
      const resources = await db.select().from(projectResources)
        .where(and(
          eq(projectResources.accountId, accountId),
          eq(projectResources.projectId, projectId)
        ));
      
      // Filter simulation resources if specified
      let filtered = resources;
      if (isSimulation !== undefined) {
        const simValue = isSimulation === 'true' ? 1 : 0;
        filtered = filtered.filter(r => r.isSimulation === simValue);
      }
      
      // Calculate totals
      const humanResources = filtered.filter(r => r.type === 'human');
      const nonHumanResources = filtered.filter(r => r.type === 'non_human');
      
      // Safe parseFloat that handles null, undefined, empty strings and NaN
      const safeParseFloat = (value: string | number | null | undefined): number => {
        if (value === null || value === undefined || value === '') return 0;
        const parsed = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      };
      
      // Human resource costs (daily_cost_internal * capacity for each)
      let totalInternalCost = 0;
      let totalBilledAmount = 0;
      
      for (const resource of humanResources) {
        const dailyCost = safeParseFloat(resource.dailyCostInternal);
        const dailyRate = safeParseFloat(resource.dailyRateBilled);
        const capacity = safeParseFloat(resource.capacity);
        
        // Assuming capacity is in days, calculate total cost
        totalInternalCost += dailyCost * capacity;
        if (resource.isBillable === 1) {
          totalBilledAmount += dailyRate * capacity;
        }
      }
      
      // Get project info for duration calculation
      const [project] = await db.select().from(projects)
        .where(and(
          eq(projects.id, projectId),
          eq(projects.accountId, accountId)
        ));
      
      // Calculate project duration in months for monthly costs
      const calculateProjectMonths = (): number => {
        if (!project) return 1;
        const startDate = project.startDate ? new Date(project.startDate) : null;
        const endDate = project.endDate ? new Date(project.endDate) : new Date(); // Default to today if no end date
        
        if (!startDate) return 1; // Default to 1 month if no start date
        
        // Calculate months between start and end dates
        const msPerMonth = 30.44 * 24 * 60 * 60 * 1000; // Average days per month
        const monthsDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / msPerMonth));
        return monthsDiff;
      };
      
      const projectMonths = calculateProjectMonths();
      
      // Non-human resource costs (amount is unit price, multiply by duration)
      let totalNonHumanCost = 0;
      for (const resource of nonHumanResources) {
        const amount = safeParseFloat(resource.amount);
        const costType = resource.costType; // 'monthly' | 'annual' | 'one_time'
        
        let totalAmount = amount;
        if (costType === 'monthly') {
          // Multiply by number of months in project
          totalAmount = amount * projectMonths;
        } else if (costType === 'annual') {
          // Multiply by years (projectMonths / 12), minimum 1
          const projectYears = Math.max(1, projectMonths / 12);
          totalAmount = amount * projectYears;
        }
        // 'one_time' keeps the original amount
        
        totalNonHumanCost += totalAmount;
        totalInternalCost += totalAmount;
        if (resource.isBillable === 1) {
          totalBilledAmount += totalAmount;
        }
      }
      
      const margin = totalBilledAmount - totalInternalCost;
      const marginPercent = totalBilledAmount > 0 ? (margin / totalBilledAmount) * 100 : 0;
      
      res.json({
        humanCount: humanResources.length,
        nonHumanCount: nonHumanResources.length,
        totalCount: filtered.length,
        totalInternalCost,
        totalBilledAmount,
        totalNonHumanCost,
        margin,
        marginPercent,
        byType: {
          human: {
            count: humanResources.length,
            internalCost: totalInternalCost - totalNonHumanCost,
            billedAmount: totalBilledAmount - nonHumanResources.reduce((sum, r) => {
              if (r.isBillable !== 1) return sum;
              const amount = safeParseFloat(r.amount);
              const costType = r.costType;
              let totalAmount = amount;
              if (costType === 'monthly') {
                totalAmount = amount * projectMonths;
              } else if (costType === 'annual') {
                totalAmount = amount * Math.max(1, projectMonths / 12);
              }
              return sum + totalAmount;
            }, 0)
          },
          nonHuman: {
            count: nonHumanResources.length,
            totalCost: totalNonHumanCost
          }
        }
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // RESOURCE TEMPLATES - Reusable resource definitions
  // ============================================

  // Get all resource templates for account
  app.get("/api/resource-templates", requireAuth, requireOrgMember, requirePermission("profitability", "read", "profitability.resources"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { type, projectType } = req.query;
      
      const templates = await db.select().from(resourceTemplates)
        .where(eq(resourceTemplates.accountId, accountId))
        .orderBy(asc(resourceTemplates.name));
      
      // Filter in memory for optional params
      let filtered = templates;
      if (type) {
        filtered = filtered.filter(t => t.type === type);
      }
      if (projectType) {
        filtered = filtered.filter(t => t.projectType === projectType || t.projectType === null);
      }
      
      res.json(filtered);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get distinct project types that have resource templates (for "Core" badge)
  // Note: This endpoint uses projects.read permission because it's called from Projects page
  // to show available project types, not from Profitability module
  app.get("/api/resource-templates/project-types", requireAuth, requireOrgMember, requirePermission("projects", "read"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      
      // Get all unique projectTypes from resource templates for this account
      const templates = await db.select({
        projectType: resourceTemplates.projectType
      }).from(resourceTemplates)
        .where(and(
          eq(resourceTemplates.accountId, accountId),
          not(sql`${resourceTemplates.projectType} IS NULL`)
        ));
      
      // Extract unique project types
      const projectTypes = [...new Set(templates.map(t => t.projectType).filter(Boolean))];
      
      res.json(projectTypes);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a resource template
  app.post("/api/resource-templates", requireAuth, requireOrgMember, requirePermission("profitability", "create", "profitability.resources"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      
      const validated = insertResourceTemplateSchema.parse({
        ...req.body,
        accountId,
      });
      
      const [template] = await db.insert(resourceTemplates).values(validated).returning();
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update a resource template
  app.patch("/api/resource-templates/:templateId", requireAuth, requireOrgMember, requirePermission("profitability", "update", "profitability.resources"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { templateId } = req.params;
      
      // Verify template exists and belongs to account
      const [existing] = await db.select().from(resourceTemplates)
        .where(and(
          eq(resourceTemplates.id, templateId),
          eq(resourceTemplates.accountId, accountId)
        ));
      
      if (!existing) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      const [updated] = await db.update(resourceTemplates)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(resourceTemplates.id, templateId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a resource template
  app.delete("/api/resource-templates/:templateId", requireAuth, requireOrgMember, requirePermission("profitability", "delete", "profitability.resources"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { templateId } = req.params;
      
      // Verify template exists and belongs to account
      const [existing] = await db.select().from(resourceTemplates)
        .where(and(
          eq(resourceTemplates.id, templateId),
          eq(resourceTemplates.accountId, accountId)
        ));
      
      if (!existing) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Check if template is a system template
      if (existing.isSystemTemplate === 1) {
        return res.status(400).json({ error: "Cannot delete system template" });
      }
      
      await db.delete(resourceTemplates).where(eq(resourceTemplates.id, templateId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create resource from template
  app.post("/api/projects/:projectId/resources/from-template", requireAuth, requireOrgMember, requirePermission("profitability", "create", "profitability.resources"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const userId = req.userId!;
      const { projectId } = req.params;
      const { templateId, overrides } = req.body;
      
      // Verify project exists
      const project = await storage.getProject(projectId);
      if (!project || project.accountId !== accountId) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get template
      const [template] = await db.select().from(resourceTemplates)
        .where(and(
          eq(resourceTemplates.id, templateId),
          eq(resourceTemplates.accountId, accountId)
        ));
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Create resource from template
      const resourceData = {
        accountId,
        projectId,
        templateId: template.id,
        name: template.name,
        type: template.type,
        profileType: template.profileType,
        mode: template.mode,
        dailyCostInternal: template.dailyCostInternal,
        dailyRateBilled: template.dailyRateBilled,
        capacity: template.defaultCapacity,
        category: template.category,
        costType: template.costType,
        amount: template.defaultAmount,
        isBillable: template.isBillable,
        createdBy: userId,
        ...overrides,
      };
      
      const validated = insertProjectResourceSchema.parse(resourceData);
      const [resource] = await db.insert(projectResources).values(validated).returning();
      
      res.status(201).json(resource);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Generate all resources from templates for a project
  app.post("/api/projects/:projectId/resources/generate-from-templates", requireAuth, requireOrgMember, requirePermission("profitability", "create", "profitability.resources"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { projectId } = req.params;
      
      // Verify project exists
      const project = await storage.getProject(projectId);
      if (!project || project.accountId !== accountId) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Check if resources already exist
      const existingResources = await db.select({ id: projectResources.id })
        .from(projectResources)
        .where(and(
          eq(projectResources.accountId, accountId),
          eq(projectResources.projectId, projectId)
        ))
        .limit(1);
      
      if (existingResources.length > 0) {
        return res.status(400).json({ error: "Des ressources existent déjà pour ce projet" });
      }
      
      // Resolve project type
      let resolvedProjectType: string | null = project.projectTypeInferred || null;
      if (!resolvedProjectType && project.category) {
        const categoryRecord = await storage.getProjectCategoryByNormalizedName(accountId, project.category);
        if (categoryRecord?.projectType) {
          resolvedProjectType = categoryRecord.projectType;
        }
      }
      
      // Fetch templates
      let templates;
      if (resolvedProjectType) {
        templates = await db.select().from(resourceTemplates)
          .where(and(
            eq(resourceTemplates.accountId, accountId),
            sql`(${resourceTemplates.projectType} = ${resolvedProjectType} OR ${resourceTemplates.projectType} IS NULL)`
          ));
      } else {
        templates = await db.select().from(resourceTemplates)
          .where(and(
            eq(resourceTemplates.accountId, accountId),
            sql`${resourceTemplates.projectType} IS NULL`
          ));
      }
      
      // Create resources
      let generatedCount = 0;
      for (const template of templates) {
        await db.insert(projectResources).values({
          accountId,
          projectId,
          templateId: template.id,
          name: template.name,
          description: template.description,
          type: template.type,
          profileType: template.profileType,
          mode: template.mode,
          dailyCostInternal: template.dailyCostInternal,
          dailyRateBilled: template.dailyRateBilled,
          capacity: template.defaultCapacity,
          category: template.category,
          costType: template.costType,
          amount: template.defaultAmount,
          isBillable: template.isBillable,
          status: 'active',
        });
        generatedCount++;
      }
      
      res.status(201).json({ success: true, generatedCount });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // RBAC (Role-Based Access Control) API
  // ============================================

  // Get current user's permissions and role
  app.get("/api/rbac/me", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const { memberId, orgRole, accountId } = req;
      if (!memberId || !accountId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const matrix = await permissionService.getFullPermissionMatrix(accountId, memberId);
      
      res.json({
        memberId,
        role: orgRole,
        permissions: matrix,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // List all members in the organization (admin only) - includes pending invitations
  app.get("/api/rbac/members", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const members = await permissionService.getMembersByOrganization(accountId);
      
      // Enrich with user info
      const enrichedMembers = await Promise.all(
        members.map(async (member) => {
          const user = await storage.getUser(member.userId);
          // isOwner = true only if this user is the owner of THIS organization
          // i.e., their accountId matches this organization's accountId AND they have role 'owner'
          const isOwnerOfThisOrg = user?.role === 'owner' && user?.accountId === accountId;
          return {
            ...member,
            status: "actif",
            isOwner: isOwnerOfThisOrg,
            user: user ? {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              avatarUrl: user.avatarUrl,
            } : null,
          };
        })
      );

      // Get pending invitations and add them to the list
      const pendingInvitations = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.accountId, accountId),
            eq(invitations.status, "pending")
          )
        );

      // Map legacy roles to RBAC roles
      const mapLegacyRole = (role: string): string => {
        if (role === 'collaborator') return 'member';
        if (role === 'client_viewer') return 'guest';
        return role; // Already RBAC role (admin, member, guest)
      };

      const pendingMembers = pendingInvitations.map((inv) => ({
        id: `invitation-${inv.id}`,
        organizationId: inv.accountId,
        userId: null,
        role: mapLegacyRole(inv.role),
        status: "invitation_en_attente",
        invitationId: inv.id,
        invitationToken: inv.token,
        emailBounced: inv.emailBounced ?? false,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
        user: {
          id: null,
          email: inv.email,
          firstName: null,
          lastName: null,
          avatarUrl: null,
        },
      }));
      
      res.json([...enrichedMembers, ...pendingMembers]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update a member's role (admin only)
  app.patch("/api/rbac/members/:memberId/role", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const actorMemberId = req.membership!.id;
      const { memberId } = req.params;
      const { role } = req.body;

      const VALID_ROLES = ['admin', 'member', 'guest'];
      if (!role || !VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: `Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}` });
      }

      // Get current role before update for audit logging
      const existingMembers = await permissionService.getOrganizationMembers(accountId);
      const existingMember = existingMembers.find(m => m.id === memberId);
      const oldRole = existingMember?.role || 'unknown';

      // PROTECTION: Prevent demoting account owner
      if (existingMember && role !== 'admin') {
        const targetUser = await storage.getUser(existingMember.userId);
        if (targetUser && targetUser.role === 'owner') {
          return res.status(403).json({ 
            error: "Impossible de rétrograder le propriétaire du compte. Le propriétaire doit toujours être administrateur." 
          });
        }
      }

      const member = await permissionService.updateMemberRole(memberId, role, accountId);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      // Log role change
      const { logMemberRoleChanged } = await import("./services/auditService");
      await logMemberRoleChanged(accountId, actorMemberId, memberId, oldRole, role);

      res.json(member);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a member from the organization (admin only)
  app.delete("/api/rbac/members/:memberId", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const actorMemberId = req.memberId;
      const { memberId } = req.params;

      console.log("🗑️ DELETE member request:", { memberId, accountId, actorMemberId });

      // Check if it's a pending invitation
      if (memberId.startsWith('invitation-')) {
        const invitationId = memberId.replace('invitation-', '');
        console.log("🔍 Looking for invitation:", invitationId);
        
        // Check if invitation exists and belongs to this organization
        const [invitation] = await db
          .select()
          .from(invitations)
          .where(and(
            eq(invitations.id, invitationId),
            eq(invitations.accountId, accountId)
          ))
          .limit(1);
        
        console.log("📋 Found invitation:", invitation);
        
        if (!invitation) {
          console.log("❌ Invitation not found");
          return res.status(404).json({ error: "Invitation non trouvée" });
        }
        
        // Delete the invitation
        await db.delete(invitations).where(eq(invitations.id, invitationId));
        console.log("✅ Invitation deleted");
        
        // Log invitation revocation (only if we have a valid actorMemberId)
        if (actorMemberId) {
          try {
            const { logAuditEvent } = await import("./services/auditService");
            await logAuditEvent({
              organizationId: accountId,
              actorMemberId,
              actionType: 'invitation.revoked',
              resourceType: 'invitation',
              resourceId: invitationId,
              meta: { revokedInvitationId: invitationId, email: invitation.email },
            });
          } catch (auditError) {
            console.error("⚠️ Audit log failed (non-blocking):", auditError);
          }
        }
        
        return res.json({ success: true, message: "Invitation révoquée" });
      }

      // Get the member to delete directly from DB
      console.log("🔍 Fetching member to delete:", memberId);
      const [memberToDelete] = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.id, memberId),
          eq(organizationMembers.organizationId, accountId)
        ))
        .limit(1);
      
      console.log("📋 Found member:", memberToDelete);
      
      if (!memberToDelete) {
        return res.status(404).json({ error: "Membre non trouvé dans cette organisation" });
      }

      // PROTECTION: Cannot delete THE owner of THIS organization
      const targetUser = await storage.getUser(memberToDelete.userId);
      console.log("👤 Target user:", targetUser?.email, "role:", targetUser?.role, "accountId:", targetUser?.accountId);
      
      // Only protect if user is owner AND their accountId matches this organization
      const isOwnerOfThisOrg = targetUser && targetUser.role === 'owner' && targetUser.accountId === accountId;
      if (isOwnerOfThisOrg) {
        return res.status(403).json({ 
          error: "Impossible de supprimer le propriétaire du compte" 
        });
      }

      // Cannot delete yourself
      if (memberId === actorMemberId) {
        return res.status(403).json({ error: "Vous ne pouvez pas vous supprimer vous-même" });
      }

      // Delete the member from organization_members
      console.log("🗑️ Deleting member from organization_members...");
      await db.delete(organizationMembers).where(eq(organizationMembers.id, memberId));
      console.log("✅ Member deleted from organization_members");

      // For invited users (non-owners), completely delete their account
      // They should not have a standalone account - they only exist in the inviting organization
      if (targetUser && targetUser.role !== 'owner') {
        console.log("🗑️ Deleting invited user completely...");
        
        // Delete from app_users
        await db.delete(appUsers).where(eq(appUsers.id, targetUser.id));
        console.log("✅ User deleted from app_users");
        
        // Delete from Supabase Auth
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const supabaseAdmin = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
          );
          
          await supabaseAdmin.auth.admin.deleteUser(targetUser.id);
          console.log("✅ User deleted from Supabase Auth");
        } catch (authError) {
          console.error("⚠️ Failed to delete from Supabase Auth (non-blocking):", authError);
        }
      }

      // Log member removal (non-blocking)
      try {
        const { logAuditEvent } = await import("./services/auditService");
        await logAuditEvent({
          organizationId: accountId,
          actorMemberId: actorMemberId!,
          actionType: 'member.removed',
          resourceType: 'member',
          resourceId: memberId,
          meta: { 
            removedUserId: memberToDelete.userId,
            removedUserEmail: targetUser?.email || 'unknown',
            removedRole: memberToDelete.role,
            fullyDeleted: targetUser?.role !== 'owner',
          },
        });
        console.log("📝 Audit log created");
      } catch (auditError) {
        console.error("⚠️ Audit log failed (non-blocking):", auditError);
      }

      res.json({ success: true, message: "Membre supprimé de l'organisation" });
    } catch (error: any) {
      console.error("❌ DELETE member error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Emergency recovery: Restore admin role for account owner
  app.post("/api/rbac/recover-owner", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const accountId = req.accountId!;

      // Verify the user is the account owner
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'owner') {
        return res.status(403).json({ error: "Seul le propriétaire du compte peut utiliser cette fonction de récupération." });
      }

      // Find or create the member entry
      let member = await permissionService.getMemberByUserAndOrg(userId, accountId);
      
      if (member) {
        // Update to admin
        member = await permissionService.updateMemberRole(member.id, 'admin', accountId);
      } else {
        // Create as admin
        member = await permissionService.createMember({
          organizationId: accountId,
          userId: userId,
          role: 'admin',
        });
      }

      // Log recovery
      const { logAuditEvent } = await import("./services/auditService");
      await logAuditEvent({
        organizationId: accountId,
        actorMemberId: member?.id || null,
        actionType: 'owner.recovery',
        resourceType: 'member',
        resourceId: member?.id || userId,
        meta: { reason: 'Owner admin role recovery' },
      });

      res.json({ success: true, message: "Accès administrateur restauré.", member });
    } catch (error: any) {
      console.error("Owner recovery error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a member's full permission matrix (admin only)
  app.get("/api/rbac/members/:memberId/permissions", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { memberId } = req.params;

      const matrix = await permissionService.getFullPermissionMatrix(accountId, memberId);
      res.json(matrix);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update a single permission (admin only)
  app.patch("/api/rbac/members/:memberId/permissions", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { memberId } = req.params;
      const { module, action, allowed, subviewKey } = req.body;

      // Check if this is a pending invitation (can't modify permissions for invitations)
      if (memberId.startsWith('invitation-')) {
        return res.status(400).json({ error: "Impossible de modifier les permissions d'une invitation en attente. Attendez que l'utilisateur accepte l'invitation." });
      }

      if (!module || !action || typeof allowed !== 'boolean') {
        return res.status(400).json({ error: "Missing required fields: module, action, allowed" });
      }

      // Validate module and action enums
      const VALID_MODULES = ['crm', 'projects', 'product', 'roadmap', 'tasks', 'notes', 'documents', 'profitability', 'whiteboards'];
      const VALID_ACTIONS = ['read', 'create', 'update', 'delete'];
      
      if (!VALID_MODULES.includes(module)) {
        return res.status(400).json({ error: `Invalid module: ${module}. Must be one of: ${VALID_MODULES.join(', ')}` });
      }
      if (!VALID_ACTIONS.includes(action)) {
        return res.status(400).json({ error: `Invalid action: ${action}. Must be one of: ${VALID_ACTIONS.join(', ')}` });
      }

      // Verify member exists in this organization
      const members = await permissionService.getMembersByOrganization(accountId);
      console.log("🔍 Permission update - memberId:", memberId, "members found:", members.map(m => ({ id: m.id, email: m.email })));
      const memberExists = members.some(m => m.id === memberId);
      if (!memberExists) {
        return res.status(404).json({ error: "Membre non trouvé dans cette organisation" });
      }

      const permission = await permissionService.setPermission({
        organizationId: accountId,
        memberId,
        module,
        action,
        allowed,
        scope: subviewKey ? 'subview' : 'module',
        subviewKey,
      });

      // Log permission update (non-blocking)
      try {
        const actorMemberId = req.membership!.id;
        const { logPermissionUpdated } = await import("./services/auditService");
        await logPermissionUpdated(accountId, actorMemberId, memberId, { module, action, allowed, subviewKey });
      } catch (auditError) {
        console.error("⚠️ Audit log failed (non-blocking):", auditError);
      }

      res.json(permission);
    } catch (error: any) {
      console.error("❌ Permission update error:", error);
      
      // Check for foreign key violation
      if (error.message?.includes('violates foreign key constraint')) {
        return res.status(400).json({ 
          error: "Le membre n'existe pas dans la table organization_members. Il faut d'abord l'ajouter correctement.",
          details: error.message
        });
      }
      
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  // Bulk update permissions (admin only)
  app.post("/api/rbac/members/:memberId/permissions/bulk", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { memberId } = req.params;
      const { updates } = req.body;

      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: "updates must be an array" });
      }

      await permissionService.bulkUpdatePermissions(accountId, memberId, updates);
      const matrix = await permissionService.getFullPermissionMatrix(accountId, memberId);
      
      // Log bulk permission update (non-blocking)
      try {
        const actorMemberId = req.membership?.id;
        if (actorMemberId) {
          const { logAuditEvent } = await import("./services/auditService");
          await logAuditEvent({
            organizationId: accountId,
            actorMemberId,
            actionType: 'permission.updated',
            resourceType: 'member',
            resourceId: memberId,
            meta: { bulk: true, updateCount: updates.length },
          });
        }
      } catch (auditError: any) {
        console.warn("⚠️ Audit log failed (non-blocking):", auditError.message);
      }
      
      res.json(matrix);
    } catch (error: any) {
      console.error("❌ Bulk permissions update error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Reset member permissions to role defaults (admin only)
  app.post("/api/rbac/members/:memberId/permissions/reset", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const actorMemberId = req.membership!.id;
      const { memberId } = req.params;

      // Get the member to find their role
      const members = await permissionService.getMembersByOrganization(accountId);
      const member = members.find(m => m.id === memberId);
      
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      await permissionService.resetPermissionsToRoleDefaults(accountId, memberId, member.role as any);
      const matrix = await permissionService.getFullPermissionMatrix(accountId, memberId);
      
      // Log permission reset
      const { logAuditEvent } = await import("./services/auditService");
      await logAuditEvent({
        organizationId: accountId,
        actorMemberId,
        actionType: 'permission.reset',
        resourceType: 'member',
        resourceId: memberId,
        meta: { role: member.role },
      });
      
      res.json(matrix);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // MEMBER INVITATION - Invite new members to organization
  // ============================================

  // Invite a new member to the organization (admin only)
  app.post("/api/rbac/invite", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const actorMemberId = req.memberId!;
      const { email, role } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "Email is required" });
      }

      const validRoles = ['admin', 'member', 'guest'];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be 'admin', 'member', or 'guest'" });
      }

      // Check if user already exists in the system
      const existingUser = await storage.getUserByEmail(email.toLowerCase().trim());
      
      if (existingUser) {
        // Check if user is already a member of this organization
        const members = await permissionService.getMembersByOrganization(accountId);
        const existingMember = members.find(m => m.userId === existingUser.id);
        
        if (existingMember) {
          return res.status(400).json({ error: "Cet utilisateur est déjà membre de votre organisation" });
        }

        // Add user as a member of this organization
        const newMember = await permissionService.createMember({
          organizationId: accountId,
          userId: existingUser.id,
          role,
        });

        // Log the invitation
        const { logAuditEvent } = await import("./services/auditService");
        await logAuditEvent({
          organizationId: accountId,
          actorMemberId,
          actionType: 'member.invited',
          resourceType: 'member',
          resourceId: newMember.id,
          meta: { email, role, userId: existingUser.id },
        });

        res.json({ success: true, member: newMember });
      } else {
        // User doesn't exist - create a pending invitation
        const { invitations } = await import("@shared/schema");
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

        // Check if there's already a pending invitation for this email
        const existingInvitation = await db
          .select()
          .from(invitations)
          .where(
            and(
              eq(invitations.accountId, accountId),
              eq(invitations.email, email.toLowerCase().trim()),
              eq(invitations.status, 'pending')
            )
          )
          .limit(1);

        if (existingInvitation.length > 0) {
          return res.status(400).json({ 
            error: "Une invitation est déjà en attente pour cet email." 
          });
        }

        // Create the pending invitation
        const [newInvitation] = await db
          .insert(invitations)
          .values({
            accountId,
            email: email.toLowerCase().trim(),
            role, // Keep the RBAC role (admin, member, guest)
            status: 'pending',
            token,
            expiresAt,
          })
          .returning();

        // Log the invitation
        const { logAuditEvent } = await import("./services/auditService");
        await logAuditEvent({
          organizationId: accountId,
          actorMemberId,
          actionType: 'invitation.created',
          resourceType: 'invitation',
          resourceId: newInvitation.id,
          meta: { email: email.toLowerCase().trim(), role, orgRole: role },
        });

        // Get inviter info and organization name for the email
        const inviter = await storage.getUser(req.userId!);
        const account = await storage.getAccount(accountId);
        const inviterName = inviter?.firstName && inviter?.lastName 
          ? `${inviter.firstName} ${inviter.lastName}` 
          : inviter?.email || 'Un membre';
        const organizationName = account?.name || 'Planbase';

        // Send invitation email via Resend
        let emailSent = false;
        try {
          const { sendInvitationEmail } = await import("./services/emailService");
          const emailResult = await sendInvitationEmail({
            to: email.toLowerCase().trim(),
            inviterName,
            organizationName,
            role,
            token,
            expiresAt,
          });
          emailSent = emailResult.success;
          if (!emailResult.success) {
            console.error('Failed to send invitation email:', emailResult.error);
          }
        } catch (emailError) {
          console.error('Email service error:', emailError);
        }

        res.json({ 
          success: true, 
          pending: true,
          emailSent,
          invitation: newInvitation,
          message: emailSent 
            ? "Invitation envoyée par email. L'utilisateur pourra rejoindre l'organisation après avoir créé son compte."
            : "Invitation créée. L'email n'a pas pu être envoyé, partagez le lien manuellement."
        });
      }
    } catch (error: any) {
      console.error("Invite member error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Resend invitation email (admin only)
  app.post("/api/invitations/:invitationId/resend", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { invitationId } = req.params;

      const { invitations } = await import("@shared/schema");
      
      // Find the invitation
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.id, invitationId),
            eq(invitations.accountId, accountId),
            eq(invitations.status, 'pending')
          )
        )
        .limit(1);

      if (!invitation) {
        return res.status(404).json({ error: "Invitation non trouvée ou déjà acceptée" });
      }

      // Check if invitation is expired
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Cette invitation a expiré. Veuillez en créer une nouvelle." });
      }

      // Get account and inviter info for the email
      const account = await storage.getAccount(accountId);
      const organizationName = account?.name || 'Planbase';

      const inviter = await storage.getUser(req.userId!);
      const inviterName = inviter?.firstName && inviter?.lastName 
        ? `${inviter.firstName} ${inviter.lastName}` 
        : inviter?.email || 'Un membre de votre équipe';

      // Send the invitation email
      const { sendInvitationEmail } = await import("./services/emailService");
      const emailResult = await sendInvitationEmail({
        to: invitation.email,
        inviterName,
        organizationName,
        role: invitation.role as 'admin' | 'member' | 'guest',
        token: invitation.token,
        expiresAt: new Date(invitation.expiresAt!),
      });

      if (!emailResult.success) {
        return res.status(500).json({ error: `Échec de l'envoi de l'email: ${emailResult.error}` });
      }

      // Reset emailBounced flag if it was set
      if (invitation.emailBounced) {
        await db
          .update(invitations)
          .set({ emailBounced: false })
          .where(eq(invitations.id, invitationId));
      }

      res.json({ success: true, message: "Invitation renvoyée avec succès" });
    } catch (error: any) {
      console.error("Resend invitation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Validate invitation token (public - no auth required)
  app.get("/api/invitations/validate", async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Token d'invitation invalide" });
      }

      const { invitations } = await import("@shared/schema");
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.token, token))
        .limit(1);

      if (!invitation) {
        return res.status(404).json({ error: "Invitation non trouvée" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ error: "Cette invitation a déjà été utilisée ou révoquée" });
      }

      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Cette invitation a expiré" });
      }

      // Get account name for display
      const account = await storage.getAccount(invitation.accountId);
      
      // Get inviter name (from first admin of the account)
      const members = await permissionService.getMembersByOrganization(invitation.accountId);
      const adminMember = members.find(m => m.role === 'admin');
      let inviterName = 'Un membre';
      if (adminMember) {
        const inviter = await storage.getUser(adminMember.userId);
        if (inviter) {
          inviterName = inviter.firstName && inviter.lastName 
            ? `${inviter.firstName} ${inviter.lastName}` 
            : inviter.email || 'Un membre';
        }
      }

      res.json({
        email: invitation.email,
        role: invitation.role,
        accountName: account?.name || 'Organisation',
        inviterName,
      });
    } catch (error: any) {
      console.error("Validate invitation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Resend webhook for email bounce notifications (public endpoint)
  // Security: Validates webhook using Svix library if RESEND_WEBHOOK_SECRET is configured
  app.post("/api/webhooks/resend", async (req, res) => {
    try {
      // Validate webhook signature if secret is configured
      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
      if (webhookSecret) {
        const { Webhook } = await import('svix');
        
        const svixId = req.headers['svix-id'] as string;
        const svixTimestamp = req.headers['svix-timestamp'] as string;
        const svixSignature = req.headers['svix-signature'] as string;
        
        if (!svixId || !svixTimestamp || !svixSignature) {
          console.warn("⚠️ Resend webhook: Missing Svix headers");
          return res.status(401).json({ error: "Missing webhook signature headers" });
        }
        
        try {
          const wh = new Webhook(webhookSecret);
          // Use raw body for verification (stored by express.json verify callback)
          const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
          
          wh.verify(rawBody, {
            'svix-id': svixId,
            'svix-timestamp': svixTimestamp,
            'svix-signature': svixSignature,
          });
          console.log("✅ Resend webhook: Signature verified");
        } catch (verifyError) {
          console.warn("⚠️ Resend webhook: Signature verification failed", verifyError);
          return res.status(401).json({ error: "Invalid webhook signature" });
        }
      }
      
      const event = req.body;
      console.log("📬 RESEND WEBHOOK:", event.type, event.data?.to);

      // Handle bounce and delivery_failed events
      if (event.type === 'email.bounced' || event.type === 'email.delivery_failed' || event.type === 'email.complained') {
        const recipientEmail = event.data?.to?.[0];
        
        if (recipientEmail) {
          // Mark all pending invitations for this email as bounced
          const result = await db
            .update(invitations)
            .set({ emailBounced: true, updatedAt: new Date() })
            .where(
              and(
                eq(invitations.email, recipientEmail.toLowerCase()),
                eq(invitations.status, 'pending')
              )
            );
          console.log(`✅ Marked invitations as bounced for ${recipientEmail}`);
        }
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Resend webhook error:", error);
      // Always return 200 to Resend to prevent retries
      res.status(200).json({ received: true, error: error.message });
    }
  });

  // Accept invitation and create account (public - no auth required)
  app.post("/api/invitations/accept", async (req, res) => {
    try {
      const { token, password, firstName, lastName } = req.body;
      
      console.log("📧 INVITATION ACCEPT:", { 
        token: token?.substring(0, 8) + '...', 
        firstName, 
        lastName, 
        hasPassword: !!password 
      });

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Token d'invitation invalide" });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères" });
      }

      const { invitations } = await import("@shared/schema");
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.token, token))
        .limit(1);

      if (!invitation) {
        return res.status(404).json({ error: "Invitation non trouvée" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ error: "Cette invitation a déjà été utilisée ou révoquée" });
      }

      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Cette invitation a expiré" });
      }

      // Check if user already exists with this email
      const existingUser = await storage.getUserByEmail(invitation.email);
      if (existingUser) {
        return res.status(400).json({ error: "Un compte existe déjà avec cet email. Connectez-vous pour rejoindre l'organisation." });
      }

      // Create user in Supabase Auth
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
        user_metadata: {
          account_id: invitation.accountId,
          role: invitation.role === 'admin' ? 'collaborator' : invitation.role === 'guest' ? 'client_viewer' : 'collaborator',
          firstName: firstName || '',
          lastName: lastName || '',
          displayName: `${firstName || ''} ${lastName || ''}`.trim(),
        },
      });

      if (authError || !authData.user) {
        console.error("Supabase auth error:", authError);
        return res.status(400).json({ error: authError?.message || "Erreur lors de la création du compte" });
      }

      console.log("✅ SUPABASE USER CREATED:", { 
        id: authData.user.id, 
        email: authData.user.email,
        metadata: authData.user.user_metadata 
      });

      // Create user in our database (id must match Supabase auth.users.id)
      // Map RBAC role to app_users role: admin→collaborator, member→collaborator, guest→client_viewer
      const appUserRole = invitation.role === 'admin' ? 'collaborator' 
        : invitation.role === 'guest' ? 'client_viewer' 
        : 'collaborator';
      
      const newUser = await storage.createUser({
        id: authData.user.id,
        email: invitation.email,
        firstName: firstName || '',
        lastName: lastName || '',
        accountId: invitation.accountId,
        role: appUserRole,
      });
      
      console.log("✅ USER CREATED:", { 
        id: newUser.id, 
        email: newUser.email, 
        firstName: newUser.firstName, 
        lastName: newUser.lastName,
        accountId: newUser.accountId 
      });

      // Create organization member with the invited role
      const newMember = await permissionService.createMember({
        organizationId: invitation.accountId,
        userId: newUser.id,
        role: invitation.role,
      });

      // Mark invitation as accepted
      await db
        .update(invitations)
        .set({ status: 'accepted' })
        .where(eq(invitations.id, invitation.id));

      // Log the acceptance
      const { logAuditEvent } = await import("./services/auditService");
      await logAuditEvent({
        organizationId: invitation.accountId,
        actorMemberId: newMember.id,
        actionType: 'invitation.accepted',
        resourceType: 'invitation',
        resourceId: invitation.id,
        meta: { email: invitation.email, role: invitation.role },
      });

      // Sign in the user
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: invitation.email,
      });

      res.json({
        success: true,
        user: newUser,
        member: newMember,
        message: "Compte créé avec succès. Vous pouvez maintenant vous connecter.",
      });
    } catch (error: any) {
      console.error("Accept invitation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // MODULE VIEWS - Custom view configurations for guests
  // ============================================

  // Get current user's view configuration for a specific module
  app.get("/api/views/me", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const { module } = req.query;
      
      if (!module || typeof module !== 'string') {
        return res.status(400).json({ error: "Module parameter is required" });
      }

      const view = await permissionService.getModuleView(req.accountId!, req.memberId!, module);
      
      // Return default config if no custom view exists
      if (!view) {
        const defaultConfig = getDefaultViewConfig(module);
        return res.json(defaultConfig);
      }

      res.json(view.config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update view configuration (admin only, for configuring guest views)
  app.patch("/api/views/:memberId", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const { memberId } = req.params;
      const { module, config } = req.body;

      if (!module || !config) {
        return res.status(400).json({ error: "Module and config are required" });
      }

      const view = await permissionService.setModuleViewWithOrg(req.accountId!, memberId, module, config);
      res.json(view);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get guest view template (admin only)
  app.get("/api/views/template/guest", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const { module } = req.query;
      
      if (!module || typeof module !== 'string') {
        return res.status(400).json({ error: "Module parameter is required" });
      }

      // Get the template from settings or return default
      const template = await permissionService.getGuestViewTemplate(req.accountId!, module);
      res.json(template || getDefaultViewConfig(module));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all guest view templates for all modules (admin only)
  app.get("/api/views/template/guest/all", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const { RBAC_MODULES } = await import("@shared/schema");
      const results = [];
      
      for (const mod of RBAC_MODULES) {
        const template = await permissionService.getGuestViewTemplate(req.accountId!, mod);
        results.push({
          module: mod,
          config: template || getDefaultViewConfig(mod),
        });
      }
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save guest view template (admin only) - applies to all guests
  app.post("/api/views/template/guest", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const { module, config, applyToAll } = req.body;

      if (!module || !config) {
        return res.status(400).json({ error: "Module and config are required" });
      }

      // Save the template
      await permissionService.setGuestViewTemplate(req.accountId!, module, config);

      // If applyToAll, propagate to all existing guests
      if (applyToAll) {
        await permissionService.applyGuestViewTemplateToAll(req.accountId!, module, config);
      }

      res.json({ success: true, message: applyToAll ? "Template applied to all guests" : "Template saved" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get member view template (admin only)
  app.get("/api/views/template/member", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const { module } = req.query;
      
      if (!module || typeof module !== 'string') {
        return res.status(400).json({ error: "Module parameter is required" });
      }

      const template = await permissionService.getMemberViewTemplate(req.accountId!, module);
      res.json(template || getDefaultViewConfig(module));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all member view templates for all modules (admin only)
  app.get("/api/views/template/member/all", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const { RBAC_MODULES } = await import("@shared/schema");
      const results = [];
      
      for (const mod of RBAC_MODULES) {
        const template = await permissionService.getMemberViewTemplate(req.accountId!, mod);
        results.push({
          module: mod,
          config: template || getDefaultViewConfig(mod),
        });
      }
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save member view template (admin only) - applies to all members
  app.post("/api/views/template/member", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const { module, config, applyToAll } = req.body;
      console.log("📝 POST /api/views/template/member", { module, config, applyToAll, accountId: req.accountId });

      if (!module || !config) {
        return res.status(400).json({ error: "Module and config are required" });
      }

      await permissionService.setMemberViewTemplate(req.accountId!, module, config);
      console.log("✅ setMemberViewTemplate completed for module:", module);

      if (applyToAll) {
        await permissionService.applyMemberViewTemplateToAll(req.accountId!, module, config);
        console.log("✅ applyMemberViewTemplateToAll completed for module:", module);
      }

      res.json({ success: true, message: applyToAll ? "Template applied to all members" : "Template saved" });
    } catch (error: any) {
      console.error("❌ Error saving member view template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // AUDIT LOGS
  // ============================================

  // Get audit events (admin only)
  app.get("/api/audit", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { actionType, limit: limitParam } = req.query;
      const limitNum = Math.min(parseInt(limitParam as string) || 50, 500);

      let query = db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.organizationId, accountId))
        .orderBy(desc(auditEvents.createdAt))
        .limit(limitNum);

      if (actionType && typeof actionType === 'string') {
        query = db
          .select()
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.organizationId, accountId),
              eq(auditEvents.actionType, actionType)
            )
          )
          .orderBy(desc(auditEvents.createdAt))
          .limit(limitNum);
      }

      const events = await query;
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // SHARE LINKS (Phase 4)
  // ============================================

  // Create a share link
  app.post("/api/share-links", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const memberId = req.membership!.id;
      const { resourceType, resourceId, expiresInDays, permissions: perms } = req.body;

      if (!resourceType || !resourceId) {
        return res.status(400).json({ error: "resourceType and resourceId are required" });
      }

      const { createShareLink } = await import("./services/shareLinkService");
      const result = await createShareLink({
        organizationId: accountId,
        createdByMemberId: memberId,
        resourceType,
        resourceId,
        expiresInDays,
        permissions: perms,
      });

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      res.json({
        id: result.shareLink.id,
        shareUrl: `${baseUrl}${result.shareUrl}`,
        expiresAt: result.shareLink.expiresAt,
        resourceType: result.shareLink.resourceType,
        resourceId: result.shareLink.resourceId,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // List share links for a resource
  app.get("/api/share-links", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { resourceType, resourceId } = req.query;

      const { getShareLinksByResource, getAllShareLinks } = await import("./services/shareLinkService");
      
      let links;
      if (resourceType && resourceId) {
        links = await getShareLinksByResource(accountId, resourceType as string, resourceId as string);
      } else {
        links = await getAllShareLinks(accountId);
      }

      res.json(links.map(link => ({
        id: link.id,
        resourceType: link.resourceType,
        resourceId: link.resourceId,
        expiresAt: link.expiresAt,
        revokedAt: link.revokedAt,
        lastAccessedAt: link.lastAccessedAt,
        accessCount: link.accessCount,
        createdAt: link.createdAt,
      })));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Revoke a share link
  app.post("/api/share-links/:id/revoke", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const memberId = req.membership!.id;
      const shareLinkId = req.params.id;

      const { revokeShareLink } = await import("./services/shareLinkService");
      const revoked = await revokeShareLink(shareLinkId, accountId, memberId);

      if (!revoked) {
        return res.status(404).json({ error: "Share link not found" });
      }

      res.json({ success: true, revokedAt: revoked.revokedAt });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Public share access - validate token and get resource data
  app.get("/api/share/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const { validateShareToken, recordShareAccess } = await import("./services/shareLinkService");
      
      const result = await validateShareToken(token);

      if (!result.valid || !result.shareLink) {
        const statusCode = result.error === "expired" ? 410 : 403;
        return res.status(statusCode).json({ error: result.error || "Invalid share link" });
      }

      const shareLink = result.shareLink;

      // Record access
      await recordShareAccess(shareLink, {
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Fetch resource data based on type
      let resourceData: any = null;
      
      switch (shareLink.resourceType) {
        case "project":
          resourceData = await storage.getProject(shareLink.resourceId);
          break;
        case "note":
          resourceData = await storage.getNote(shareLink.resourceId);
          break;
        case "document":
          resourceData = await storage.getDocument(shareLink.resourceId);
          break;
        case "roadmap":
          resourceData = await storage.getRoadmap(shareLink.resourceId);
          if (resourceData) {
            const items = await storage.getRoadmapItems(shareLink.resourceId);
            resourceData = { ...resourceData, items };
          }
          break;
        case "backlog":
          resourceData = await storage.getBacklog(shareLink.resourceId);
          if (resourceData) {
            const sprints = await storage.getSprintsByBacklog(shareLink.resourceId);
            resourceData = { ...resourceData, sprints };
          }
          break;
        case "profitability_project":
          resourceData = await storage.getProject(shareLink.resourceId);
          break;
      }

      if (!resourceData) {
        return res.status(404).json({ error: "Resource not found" });
      }

      res.json({
        resourceType: shareLink.resourceType,
        resourceId: shareLink.resourceId,
        permissions: shareLink.permissions,
        expiresAt: shareLink.expiresAt,
        data: resourceData,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // MEMBER PROJECT ACCESS (Guest scoping)
  // ============================================

  // Grant project access to a member
  app.post("/api/member-project-access", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const actorMemberId = req.membership!.id;
      const { memberId, projectId, accessLevel = "read" } = req.body;

      if (!memberId || !projectId) {
        return res.status(400).json({ error: "memberId and projectId are required" });
      }

      const { logProjectAccessGranted } = await import("./services/auditService");
      
      await db.execute(sql`
        INSERT INTO member_project_access (organization_id, member_id, project_id, access_level)
        VALUES (${accountId}, ${memberId}, ${projectId}, ${accessLevel})
        ON CONFLICT (member_id, project_id) DO UPDATE SET access_level = ${accessLevel}
      `);

      await logProjectAccessGranted(accountId, actorMemberId, memberId, projectId, accessLevel);

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get project access for a member
  app.get("/api/member-project-access/:memberId", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const memberId = req.params.memberId;

      const result = await db.execute(sql`
        SELECT mpa.*, p.name as project_name
        FROM member_project_access mpa
        JOIN projects p ON p.id = mpa.project_id
        WHERE mpa.organization_id = ${accountId} AND mpa.member_id = ${memberId}
      `);

      res.json(result.rows);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Revoke project access
  app.delete("/api/member-project-access/:memberId/:projectId", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const actorMemberId = req.membership!.id;
      const { memberId, projectId } = req.params;

      const { logProjectAccessRevoked } = await import("./services/auditService");

      await db.execute(sql`
        DELETE FROM member_project_access
        WHERE organization_id = ${accountId} AND member_id = ${memberId} AND project_id = ${projectId}
      `);

      await logProjectAccessRevoked(accountId, actorMemberId, memberId, projectId);

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // AUDIT EVENTS
  // ============================================

  // Get audit events (admin only)
  app.get("/api/audit", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { limit = "50", actionType, resourceType, since } = req.query;

      const { getAuditEvents } = await import("./services/auditService");
      
      const events = await getAuditEvents(accountId, {
        limit: parseInt(limit as string),
        actionType: actionType as string | undefined,
        resourceType: resourceType as string | undefined,
        since: since ? new Date(since as string) : undefined,
      });

      res.json(events);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // PERMISSION PACKS
  // ============================================

  // Get available permission packs
  app.get("/api/permission-packs", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const { PERMISSION_PACKS } = await import("@shared/config/permissionPacks");
      res.json(PERMISSION_PACKS);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Apply a permission pack to a member
  app.post("/api/permission-packs/:packId/apply/:memberId", requireAuth, requireOrgMember, requireOrgAdmin, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const actorMemberId = req.membership!.id;
      const { packId, memberId } = req.params;

      const { getPermissionPack } = await import("@shared/config/permissionPacks");
      const { logPackApplied } = await import("./services/auditService");
      const { RBAC_ACTIONS } = await import("@shared/schema");

      const pack = getPermissionPack(packId);
      if (!pack) {
        return res.status(404).json({ error: "Permission pack not found" });
      }

      // Delete existing permissions for this member
      await db.execute(sql`
        DELETE FROM permissions WHERE organization_id = ${accountId} AND member_id = ${memberId}
      `);

      // Insert new permissions from pack
      for (const entry of pack.permissions) {
        for (const action of RBAC_ACTIONS) {
          const allowed = entry.actions.includes(action);
          await db.execute(sql`
            INSERT INTO permissions (organization_id, member_id, module, action, allowed, scope)
            VALUES (${accountId}, ${memberId}, ${entry.module}, ${action}, ${allowed}, 'module')
          `);
        }
      }

      // Update module views with default subviews from pack
      for (const [module, subviews] of Object.entries(pack.defaultSubviews)) {
        const subviewsEnabled: Record<string, boolean> = {};
        for (const sv of subviews) {
          subviewsEnabled[sv] = true;
        }
        
        await db.execute(sql`
          INSERT INTO module_views (organization_id, member_id, module, subviews_enabled)
          VALUES (${accountId}, ${memberId}, ${module}, ${JSON.stringify(subviewsEnabled)}::jsonb)
          ON CONFLICT (member_id, module) DO UPDATE SET subviews_enabled = ${JSON.stringify(subviewsEnabled)}::jsonb
        `);
      }

      await logPackApplied(accountId, actorMemberId, memberId, packId);

      res.json({ success: true, packId, memberId });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // APPROVALS (Phase 5: Validation & Collaboration)
  // ============================================

  // Request approval for a resource
  app.post("/api/approvals/request", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const actorMemberId = req.membership!.id;
      const { resourceType, resourceId, projectId, comment } = req.body;

      if (!resourceType || !resourceId) {
        return res.status(400).json({ error: "resourceType and resourceId are required" });
      }

      const { requestApproval } = await import("./services/approvalService");
      
      const approval = await requestApproval({
        organizationId: accountId,
        projectId,
        resourceType,
        resourceId,
        requestedByMemberId: actorMemberId,
        comment,
      });

      res.json(approval);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Decide on an approval (approve/reject/request changes)
  app.post("/api/approvals/decide", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const actorMemberId = req.membership!.id;
      const { approvalId, decision, comment } = req.body;

      if (!approvalId || !decision) {
        return res.status(400).json({ error: "approvalId and decision are required" });
      }

      if (!['approved', 'rejected', 'changes_requested'].includes(decision)) {
        return res.status(400).json({ error: "decision must be 'approved', 'rejected', or 'changes_requested'" });
      }

      const { decideApproval } = await import("./services/approvalService");
      
      const approval = await decideApproval({
        approvalId,
        decidedByMemberId: actorMemberId,
        decision,
        comment,
      });

      res.json(approval);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get approvals list (optionally filtered by project/status)
  app.get("/api/approvals", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const accountId = req.accountId!;
      const { projectId, resourceType, status, limit = "50" } = req.query;

      const { getApprovals } = await import("./services/approvalService");
      
      const approvalsList = await getApprovals(accountId, {
        projectId: projectId as string | undefined,
        resourceType: resourceType as string | undefined,
        status: status as any,
        limit: parseInt(limit as string),
      });

      res.json(approvalsList);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get pending approvals for a specific project
  app.get("/api/projects/:projectId/approvals", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const { projectId } = req.params;
      const { status } = req.query;

      const { getApprovals } = await import("./services/approvalService");
      
      const approvalsList = await getApprovals(req.accountId!, {
        projectId,
        status: status as any,
      });

      res.json(approvalsList);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get decision timeline for a project
  app.get("/api/projects/:projectId/decisions", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const { projectId } = req.params;
      const accountId = req.accountId!;
      
      const { getAuditEvents } = await import("./services/auditService");
      
      // Get decision-related audit events
      const decisionEvents = await db.execute(sql`
        SELECT ae.*, om.display_name as actor_name, au.email as actor_email
        FROM audit_events ae
        LEFT JOIN organization_members om ON ae.actor_member_id = om.id
        LEFT JOIN app_users au ON om.user_id = au.id
        WHERE ae.organization_id = ${accountId}
        AND (
          ae.action_type = 'decision.created'
          OR ae.action_type = 'approval.decided'
          OR ae.action_type = 'approval.requested'
        )
        AND (ae.meta->>'projectId' = ${projectId} OR ae.resource_id = ${projectId})
        ORDER BY ae.created_at DESC
        LIMIT 100
      `);

      // Get decision-type comments
      const decisionComments = await db.execute(sql`
        SELECT tc.*, au.email as author_email
        FROM ticket_comments tc
        LEFT JOIN app_users au ON tc.author_id = au.id
        WHERE tc.account_id = ${accountId}
        AND tc.comment_type = 'decision'
        ORDER BY tc.created_at DESC
        LIMIT 50
      `);

      res.json({
        events: decisionEvents.rows,
        comments: decisionComments.rows,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get executive summary for a project (read-only view)
  app.get("/api/projects/:projectId/executive", requireAuth, requireOrgMember, async (req, res) => {
    try {
      const { projectId } = req.params;
      const accountId = req.accountId!;
      
      // Get project data
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get pending approvals
      const { getPendingApprovalsForProject } = await import("./services/approvalService");
      const pendingApprovals = await getPendingApprovalsForProject(projectId);

      // Get next milestone
      const nextMilestone = await db.execute(sql`
        SELECT ri.* FROM roadmap_items ri
        JOIN roadmaps r ON ri.roadmap_id = r.id
        WHERE r.project_id = ${projectId}
        AND ri.type = 'milestone'
        AND ri.status != 'done'
        ORDER BY ri.target_date ASC NULLS LAST, ri.order_index ASC
        LIMIT 1
      `);

      // Get recent decisions
      const recentDecisions = await db.execute(sql`
        SELECT ae.*, om.display_name as actor_name
        FROM audit_events ae
        LEFT JOIN organization_members om ON ae.actor_member_id = om.id
        WHERE ae.organization_id = ${accountId}
        AND ae.action_type IN ('decision.created', 'approval.decided')
        AND (ae.meta->>'projectId' = ${projectId} OR ae.resource_id = ${projectId})
        ORDER BY ae.created_at DESC
        LIMIT 5
      `);

      // Get blocking issues
      const blockingIssues = await db.execute(sql`
        SELECT tc.*, au.email as author_email
        FROM ticket_comments tc
        LEFT JOIN app_users au ON tc.author_id = au.id
        WHERE tc.account_id = ${accountId}
        AND tc.comment_type = 'blocking_issue'
        ORDER BY tc.created_at DESC
        LIMIT 10
      `);

      // Calculate KPIs
      const timeEntries = await storage.getTimeEntriesByProject(projectId);
      const totalHours = timeEntries.reduce((sum, te) => sum + (te.hours || 0), 0);
      
      res.json({
        project,
        kpis: {
          totalHours,
          budget: project.budget,
          progress: project.progress || 0,
          margin: project.projectedMargin || null,
        },
        nextMilestone: nextMilestone.rows[0] || null,
        pendingApprovals,
        recentDecisions: recentDecisions.rows,
        blockingIssues: blockingIssues.rows,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // SEED DATA (Development only)
  // ============================================

  app.post("/api/seed", async (req, res) => {
    try {
      const { seedDatabase } = await import("./lib/seed");
      const result = await seedDatabase();
      res.json({ success: true, accountId: result.account.id, userId: result.owner.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
