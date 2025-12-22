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
  backlogs,
  epics,
  userStories,
  backlogTasks,
  checklistItems,
  sprints,
  backlogColumns,
  tasks,
  ticketComments,
  projects,
  appUsers,
  retros,
  retroCards,
  userOnboarding,
} from "@shared/schema";
import { summarizeText, extractActions, classifyDocument, suggestNextActions } from "./lib/openai";
import { requireAuth, requireRole, optionalAuth } from "./middleware/auth";
import { getDemoCredentials } from "./middleware/demo-helper";
import { configService } from "./services/configService";
import { supabaseAdmin } from "./lib/supabase";
import { google } from "googleapis";
import { db } from "./db";
import { eq, and, asc, desc, not, sql, inArray } from "drizzle-orm";

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

  app.get("/api/clients", requireAuth, async (req, res) => {
    try {
      const clients = await storage.getClientsByAccountId(req.accountId!);
      res.json(clients);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/clients", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/clients/:id", requireAuth, async (req, res) => {
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

  app.patch("/api/clients/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.delete("/api/clients/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/accounts/:accountId/clients", requireAuth, async (req, res) => {
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
  app.post("/api/clients/:id/suggest-actions", requireAuth, async (req, res) => {
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

  app.get("/api/contacts", requireAuth, async (req, res) => {
    try {
      const contacts = await storage.getContactsByAccountId(req.accountId!);
      res.json(contacts);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/clients/:clientId/contacts", requireAuth, async (req, res) => {
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

  app.post("/api/contacts", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/contacts/:id", requireAuth, async (req, res) => {
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

  app.patch("/api/contacts/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.delete("/api/contacts/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/accounts/:accountId/contacts", requireAuth, async (req, res) => {
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

  app.get("/api/clients/:clientId/comments", requireAuth, async (req, res) => {
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

  app.post("/api/clients/:clientId/comments", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.delete("/api/clients/:clientId/comments/:commentId", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/clients/:clientId/field-values", requireAuth, async (req, res) => {
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

  app.post("/api/clients/:clientId/field-values", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjectsByAccountId(req.accountId!);
      res.json(projects);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/projects", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      console.log("[DEBUG] Creating project - req.userId:", req.userId, "req.accountId:", req.accountId);
      console.log("[DEBUG] Request body:", JSON.stringify(req.body, null, 2));
      
      const data = insertProjectSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
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

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
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

  app.get("/api/projects/:id/notes", requireAuth, async (req, res) => {
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

  app.get("/api/projects/:id/documents", requireAuth, async (req, res) => {
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

  app.patch("/api/projects/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const existing = await storage.getProject(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const project = await storage.updateProject(req.params.id, req.body);

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

  app.delete("/api/projects/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/project-categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getProjectCategoriesByAccountId(req.accountId!);
      res.json(categories);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new project category (or return existing one if name already exists)
  app.post("/api/project-categories", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Category name is required" });
      }

      const trimmedName = name.trim();

      // Try to create new category, let database handle uniqueness
      try {
        const category = await storage.createProjectCategory({
          accountId: req.accountId!,
          name: trimmedName,
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

  // ============================================
  // PROJECT PAYMENTS - Protected Routes
  // ============================================

  // Get all payments for the account
  app.get("/api/payments", requireAuth, async (req, res) => {
    try {
      const payments = await storage.getPaymentsByAccountId(req.accountId!);
      res.json(payments);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all payments for a project
  app.get("/api/projects/:projectId/payments", requireAuth, async (req, res) => {
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
  app.post("/api/projects/:projectId/payments", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/payments/:paymentId", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/payments/:paymentId", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/projects/:projectId/scope-items", requireAuth, async (req, res) => {
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
  app.post("/api/projects/:projectId/scope-items", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/scope-items/:itemId", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/scope-items/:itemId", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.post("/api/projects/:projectId/scope-items/reorder", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  // ============================================
  // PROJECT PROFITABILITY - Protected Routes
  // ============================================

  // Get profitability analysis for a project
  app.get("/api/projects/:projectId/profitability", requireAuth, async (req, res) => {
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

      // Import and use profitability service
      const { generateProfitabilityAnalysis } = await import("./services/profitabilityService");
      const analysis = generateProfitabilityAnalysis(project, timeEntries, payments, globalTJM);

      res.json(analysis);
    } catch (error: any) {
      console.error("Error generating profitability analysis:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Get profitability summary for all projects in account
  app.get("/api/profitability/summary", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjectsByAccountId(req.accountId!);
      const { generateProfitabilityAnalysis } = await import("./services/profitabilityService");
      
      // Get global TJM from account settings
      const globalTJMSetting = await storage.getSetting('ACCOUNT', req.accountId!, 'billing.defaultTJM');
      const globalTJM = globalTJMSetting?.value ? parseFloat(String(globalTJMSetting.value)) : undefined;
      
      // Séparer les projets par type: client (facturable) vs interne (non facturable)
      const clientProjects = projects.filter(p => p.businessType !== 'internal');
      const internalProjects = projects.filter(p => p.businessType === 'internal');
      
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
  app.get("/api/projects/:projectId/recommendation-actions", requireAuth, async (req, res) => {
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
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getTasksByAccountId(req.accountId!);
      res.json(tasks);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all tasks by project
  app.get("/api/projects/:projectId/tasks", requireAuth, async (req, res) => {
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
  app.get("/api/projects/:projectId/sprints", requireAuth, async (req, res) => {
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

  // Create a new task
  app.post("/api/tasks", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/tasks/bulk-update-positions", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/tasks/bulk-update-project", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/tasks/:id", requireAuth, async (req, res) => {
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
  app.patch("/api/tasks/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/tasks/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.post("/api/tasks/:id/duplicate", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/tasks/:id/move", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/task-columns", requireAuth, async (req, res) => {
    try {
      const columns = await storage.getTaskColumnsByAccountId(req.accountId!);
      res.json(columns);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get global task columns (not tied to any project)
  app.get("/api/task-columns/global", requireAuth, async (req, res) => {
    try {
      const columns = await storage.getGlobalTaskColumnsByAccountId(req.accountId!);
      res.json(columns);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/projects/:projectId/task-columns", requireAuth, async (req, res) => {
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
  app.post("/api/task-columns", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/task-columns/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/task-columns/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/projects/:projectId/task-columns/reorder", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/time-entries", requireAuth, async (req, res) => {
    try {
      const entries = await storage.getTimeEntriesByAccountId(req.accountId!);
      res.json(entries);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get time entries for a specific project
  app.get("/api/projects/:projectId/time-entries", requireAuth, async (req, res) => {
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
  app.get("/api/time-entries/active", requireAuth, async (req, res) => {
    try {
      const entry = await storage.getActiveTimeEntry(req.accountId!, req.userId!);
      res.json(entry || null);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new time entry (start timer)
  app.post("/api/time-entries", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.post("/api/time-entries/manual", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/time-entries/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/time-entries/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/time-entries/:id/pause", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/time-entries/:id/resume", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/notes", requireAuth, async (req, res) => {
    try {
      const notes = await storage.getNotesByAccountId(req.accountId!);
      res.json(notes);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/notes", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/notes/:id", requireAuth, async (req, res) => {
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

  app.patch("/api/notes/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.post("/api/notes/:id/duplicate", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.delete("/api/notes/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/note-links", requireAuth, async (req, res) => {
    try {
      const links = await storage.getNoteLinksByAccountId(req.accountId!);
      res.json(links);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/notes/:id/links", requireAuth, async (req, res) => {
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

  app.post("/api/notes/:id/links", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.delete("/api/notes/:id/links/:targetType/:targetId", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.post("/api/notes/:id/summarize", requireAuth, async (req, res) => {
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

  app.post("/api/notes/:id/extract-actions", requireAuth, async (req, res) => {
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

  app.get("/api/document-templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getDocumentTemplates(req.accountId!);
      res.json(templates);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/document-templates/:id", requireAuth, async (req, res) => {
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

  app.post("/api/document-templates", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.patch("/api/document-templates/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.delete("/api/document-templates/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getDocumentsByAccountId(req.accountId!);
      res.json(documents);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/documents", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/documents/:id", requireAuth, async (req, res) => {
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

  app.patch("/api/documents/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.delete("/api/documents/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.post("/api/documents/:id/duplicate", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.post("/api/documents/:id/export-pdf", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/document-links", requireAuth, async (req, res) => {
    try {
      const links = await storage.getDocumentLinksByAccountId(req.accountId!);
      res.json(links);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/documents/:id/links", requireAuth, async (req, res) => {
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

  app.post("/api/documents/:id/links", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.delete("/api/documents/:id/links/:targetType/:targetId", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/folders", requireAuth, async (req, res) => {
    try {
      const folders = await storage.getFoldersByAccountId(req.accountId!);
      res.json(folders);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/folders", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/files", requireAuth, async (req, res) => {
    try {
      const files = await storage.getFilesByAccountId(req.accountId!);
      res.json(files);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/folders/:folderId/files", requireAuth, async (req, res) => {
    try {
      const files = await storage.getFilesByFolderId(req.params.folderId);
      res.json(files);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/files", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.patch("/api/files/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.delete("/api/files/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/activities", requireAuth, async (req, res) => {
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
  app.get("/api/clients/:clientId/activities", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      const activities = await storage.getActivitiesBySubject(req.accountId!, 'client', clientId);
      res.json(activities);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get activities for a specific project
  app.get("/api/projects/:projectId/activities", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const activities = await storage.getActivitiesBySubject(req.accountId!, 'project', projectId);
      res.json(activities);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new activity
  app.post("/api/activities", requireAuth, async (req, res) => {
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
  app.patch("/api/activities/:id", requireAuth, async (req, res) => {
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
  app.delete("/api/activities/:id", requireAuth, async (req, res) => {
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
  app.delete("/api/projects/:projectId/activities", requireAuth, async (req, res) => {
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

  app.get("/api/deals", requireAuth, async (req, res) => {
    try {
      const deals = await storage.getDealsByAccountId(req.accountId!);
      res.json(deals);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/deals", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/deals/:id", requireAuth, async (req, res) => {
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

  app.patch("/api/deals/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.delete("/api/deals/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  app.get("/api/roadmaps", requireAuth, async (req, res) => {
    try {
      const roadmaps = await storage.getRoadmapsByAccountId(req.accountId!);
      res.json(roadmaps);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/roadmaps", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const data = insertRoadmapSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      const roadmap = await storage.createRoadmap(data);
      res.json(roadmap);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/roadmaps/:id", requireAuth, async (req, res) => {
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

  app.patch("/api/roadmaps/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const existing = await storage.getRoadmap(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Roadmap not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const roadmap = await storage.updateRoadmap(req.params.id, req.body);
      res.json(roadmap);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/roadmaps/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const existing = await storage.getRoadmap(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Roadmap not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteRoadmap(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // ROADMAP ITEMS - Protected Routes
  // ============================================

  app.get("/api/roadmaps/:roadmapId/items", requireAuth, async (req, res) => {
    try {
      const items = await storage.getRoadmapItemsByRoadmapId(req.params.roadmapId);
      res.json(items);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/roadmap-items", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
      res.json(item);
    } catch (error: any) {
      console.error("❌ Error creating roadmap item:", error.message, error);
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/roadmap-items/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

      const item = await storage.updateRoadmapItem(req.params.id, req.body);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/roadmap-items/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

      const success = await storage.deleteRoadmapItem(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get roadmaps by project ID
  app.get("/api/projects/:projectId/roadmaps", requireAuth, async (req, res) => {
    try {
      const roadmaps = await storage.getRoadmapsByProjectId(req.accountId!, req.params.projectId);
      res.json(roadmaps);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // ROADMAP ITEM LINKS
  // ============================================

  // Get links for a roadmap item
  app.get("/api/roadmap-items/:id/links", requireAuth, async (req, res) => {
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
  app.post("/api/roadmap-items/:id/links", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/roadmap-item-links/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/roadmap-items/:id/dependencies", requireAuth, async (req, res) => {
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
  app.get("/api/roadmaps/:roadmapId/dependencies", requireAuth, async (req, res) => {
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
  app.post("/api/roadmap-items/:id/dependencies", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/roadmap-dependencies/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.post("/api/roadmap-items/:id/calculate-progress", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.post("/api/roadmaps/:roadmapId/calculate-progress", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  // ACCOUNT SETTINGS ROUTES
  // ============================================

  // Get account details (OWNER ONLY)
  app.get("/api/accounts/:accountId", requireAuth, requireRole("owner"), async (req, res) => {
    try {
      if (req.params.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied to this account" });
      }
      
      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      res.json({
        id: account.id,
        name: account.name,
        siret: account.siret,
      });
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
      
      const domain = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      const redirectUri = `${domain}/api/google/auth/callback`;
      
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
      
      const domain = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      const redirectUri = `${domain}/api/google/auth/callback`;
      
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
      
      // Create activity log
      await storage.createActivity({
        accountId: req.accountId!,
        subjectType: "appointment",
        subjectId: appointment.id,
        kind: "note",
        payload: { description: `New appointment: ${data.title}` },
        createdBy: req.userId || null,
      });
      
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
  app.get("/api/mindmaps", requireAuth, async (req, res) => {
    try {
      const mindmaps = await storage.getMindmapsByAccountId(req.accountId!);
      res.json(mindmaps);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get mindmaps by client
  app.get("/api/clients/:clientId/mindmaps", requireAuth, async (req, res) => {
    try {
      const mindmaps = await storage.getMindmapsByClientId(req.accountId!, req.params.clientId);
      res.json(mindmaps);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get mindmaps by project
  app.get("/api/projects/:projectId/mindmaps", requireAuth, async (req, res) => {
    try {
      const mindmaps = await storage.getMindmapsByProjectId(req.accountId!, req.params.projectId);
      res.json(mindmaps);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get a single mindmap with all nodes and edges
  app.get("/api/mindmaps/:id", requireAuth, async (req, res) => {
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
  app.post("/api/mindmaps", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/mindmaps/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/mindmaps/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/mindmaps/:mindmapId/nodes", requireAuth, async (req, res) => {
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
  app.post("/api/mindmaps/:mindmapId/nodes", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/mindmap-nodes/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/mindmaps/:mindmapId/nodes/batch", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/mindmap-nodes/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/mindmaps/:mindmapId/edges", requireAuth, async (req, res) => {
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
  app.post("/api/mindmaps/:mindmapId/edges", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/mindmap-edges/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/mindmap-edges/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.post("/api/mindmaps/:mindmapId/connect-nodes", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/backlogs", requireAuth, async (req, res) => {
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
        
        // Get active sprint (en_cours status)
        let activeSprint = null;
        const [activeSprintRow] = await db.select().from(sprints)
          .where(and(eq(sprints.backlogId, backlog.id), eq(sprints.status, "en_cours")));
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
        };
      }));
      
      res.json(enrichedBacklogs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create a new backlog
  app.post("/api/backlogs", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
      
      res.status(201).json(backlog);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get single backlog with all related data
  app.get("/api/backlogs/:backlogId", requireAuth, async (req, res) => {
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
  app.patch("/api/backlogs/:backlogId", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/backlogs/:backlogId", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/backlogs/:backlogId/epics", requireAuth, async (req, res) => {
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
  app.post("/api/backlogs/:backlogId/epics", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
      
      const [epic] = await db.insert(epics).values(data).returning();
      
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

  // Update epic
  app.patch("/api/epics/:epicId", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const epicId = req.params.epicId;
      const data = updateEpicSchema.parse(req.body);
      
      const [updated] = await db.update(epics)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(epics.id, epicId), eq(epics.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Epic not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete epic
  app.delete("/api/epics/:epicId", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const epicId = req.params.epicId;
      
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
  app.get("/api/backlogs/:backlogId/user-stories", requireAuth, async (req, res) => {
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
  app.post("/api/backlogs/:backlogId/user-stories", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/user-stories/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      const data = updateUserStorySchema.parse(req.body);
      
      const [updated] = await db.update(userStories)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(userStories.id, id), eq(userStories.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "User story not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete user story
  app.delete("/api/user-stories/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  // Create standalone task for backlog (without user story)
  app.post("/api/backlogs/:backlogId/tasks", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.post("/api/user-stories/:userStoryId/tasks", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/backlog-tasks/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      const data = updateBacklogTaskSchema.parse(req.body);
      
      const [updated] = await db.update(backlogTasks)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(backlogTasks.id, id), eq(backlogTasks.accountId, accountId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete backlog task
  app.delete("/api/backlog-tasks/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/user-stories/:userStoryId/checklist", requireAuth, async (req, res) => {
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
  app.post("/api/user-stories/:userStoryId/checklist", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/checklist-items/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/checklist-items/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/backlogs/:backlogId/sprints", requireAuth, async (req, res) => {
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
  app.post("/api/backlogs/:backlogId/sprints", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/sprints/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/sprints/:id/start", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/sprints/:id/close", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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

  // Delete sprint
  app.delete("/api/sprints/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      const accountId = req.accountId!;
      const id = req.params.id;
      
      const [deleted] = await db.delete(sprints)
        .where(and(eq(sprints.id, id), eq(sprints.accountId, accountId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "Sprint not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Move sprint position (up or down)
  app.patch("/api/sprints/:id/move", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.get("/api/backlogs/:backlogId/columns", requireAuth, async (req, res) => {
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
  app.post("/api/backlogs/:backlogId/columns", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.patch("/api/backlog-columns/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.delete("/api/backlog-columns/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  app.post("/api/backlogs/:backlogId/import-from-project", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
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
  // TICKET COMMENTS
  // ============================================

  // Get comments for a ticket
  app.get("/api/tickets/:ticketId/:ticketType/comments", requireAuth, async (req, res) => {
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
  app.post("/api/tickets/:ticketId/:ticketType/comments", requireAuth, async (req, res) => {
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
  app.patch("/api/ticket-comments/:commentId", requireAuth, async (req, res) => {
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
  app.delete("/api/ticket-comments/:commentId", requireAuth, async (req, res) => {
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
  // RETROSPECTIVES
  // ============================================

  // List all retros for a backlog
  app.get("/api/backlogs/:backlogId/retros", requireAuth, async (req, res) => {
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
  app.post("/api/backlogs/:backlogId/retros", requireAuth, async (req, res) => {
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
  app.get("/api/retros/:retroId", requireAuth, async (req, res) => {
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
  app.patch("/api/retros/:retroId", requireAuth, async (req, res) => {
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
  app.delete("/api/retros/:retroId", requireAuth, async (req, res) => {
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
  app.get("/api/retros/:retroId/cards", requireAuth, async (req, res) => {
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
  app.post("/api/retros/:retroId/cards", requireAuth, async (req, res) => {
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
  app.patch("/api/retro-cards/:cardId", requireAuth, async (req, res) => {
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
  app.delete("/api/retro-cards/:cardId", requireAuth, async (req, res) => {
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
  app.get("/api/projects/:projectId/effective-tjm", requireAuth, async (req, res) => {
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
