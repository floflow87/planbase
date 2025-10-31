import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertAccountSchema,
  insertAppUserSchema,
  updateProfileSchema,
  insertClientSchema,
  insertProjectSchema,
  insertNoteSchema,
  insertFolderSchema,
  insertFileSchema,
  insertActivitySchema,
  insertDealSchema,
  insertProductSchema,
  insertFeatureSchema,
  insertRoadmapSchema,
  insertRoadmapItemSchema,
} from "@shared/schema";
import { summarizeText, extractActions, classifyDocument, suggestNextActions } from "./lib/openai";
import { requireAuth, requireRole, optionalAuth } from "./middleware/auth";
import { getDemoCredentials } from "./middleware/demo-helper";

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

  app.get("/api/accounts/:id", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.json(account);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
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
      res.json(user);
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
      
      res.json(updatedUser);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid profile data", details: error.errors });
      }
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
      const data = insertClientSchema.parse({
        ...req.body,
        accountId: req.accountId!, // Force accountId from auth context
        createdBy: req.userId || req.body.createdBy,
      });
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
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      // Verify client belongs to user's account
      if (client.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(client);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/clients/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      // First verify client belongs to user's account
      const existing = await storage.getClient(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Client not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const client = await storage.updateClient(req.params.id, req.body);
      res.json(client);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/clients/:id", requireAuth, requireRole("owner", "collaborator"), async (req, res) => {
    try {
      // First verify client belongs to user's account
      const existing = await storage.getClient(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Client not found" });
      }
      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteClient(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // AI suggestion for client next actions
  app.post("/api/clients/:id/suggest-actions", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
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
      const data = insertProjectSchema.parse({
        ...req.body,
        accountId: req.accountId!,
        createdBy: req.userId || req.body.createdBy,
      });
      const project = await storage.createProject(data);
      
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
        project.clientId ? storage.getClient(project.clientId) : null,
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

  // ============================================
  // TASKS - Protected Routes
  // ============================================

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
      
      // Verify project exists and belongs to account
      const project = await storage.getProject(req.body.projectId);
      if (!project) {
        console.error('Project not found:', req.body.projectId);
        return res.status(404).json({ error: "Project not found" });
      }
      if (project.accountId !== req.accountId) {
        console.error('Project access denied. Project accountId:', project.accountId, 'User accountId:', req.accountId);
        return res.status(403).json({ error: "Access denied to this project" });
      }

      // Convert dueDate string to Date if present
      const bodyWithDate = { ...req.body };
      if (bodyWithDate.dueDate && typeof bodyWithDate.dueDate === 'string') {
        bodyWithDate.dueDate = new Date(bodyWithDate.dueDate);
      }

      const { insertTaskSchema } = await import("@shared/schema");
      const data = insertTaskSchema.parse({
        ...bodyWithDate,
        accountId: req.accountId!,
        createdBy: req.userId!,
      });
      const task = await storage.createTask(data);
      console.log('Task created successfully:', task.id);
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

      // Convert dueDate string to Date if present
      const bodyWithDate = { ...req.body };
      if (bodyWithDate.dueDate && typeof bodyWithDate.dueDate === 'string') {
        bodyWithDate.dueDate = new Date(bodyWithDate.dueDate);
      }

      const task = await storage.updateTask(req.params.id, bodyWithDate);
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
