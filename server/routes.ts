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
  insertClientCommentSchema,
  insertAppointmentSchema,
  updateAppointmentSchema,
  type ClientCustomField,
} from "@shared/schema";
import { summarizeText, extractActions, classifyDocument, suggestNextActions } from "./lib/openai";
import { requireAuth, requireRole, optionalAuth } from "./middleware/auth";
import { getDemoCredentials } from "./middleware/demo-helper";
import { supabaseAdmin } from "./lib/supabase";
import { google } from "googleapis";

export async function registerRoutes(app: Express): Promise<Server> {
  
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
        kind: "note",
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
        kind: "note",
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
        kind: "note",
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
        kind: "created",
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
        kind: "created",
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
        kind: "created",
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
      res.json(activities);
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
      const data = insertRoadmapItemSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      const item = await storage.createRoadmapItem(data);
      res.json(item);
    } catch (error: any) {
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
