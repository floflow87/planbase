import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertAccountSchema,
  insertUserSchema,
  insertClientSchema,
  insertProjectSchema,
  insertTaskSchema,
  insertNoteSchema,
  insertFolderSchema,
  insertDocumentSchema,
  insertActivitySchema,
} from "@shared/schema";
import { summarizeText, extractActions, classifyDocument, suggestNextActions } from "./lib/openai";

export async function registerRoutes(app: Express): Promise<Server> {
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

  app.post("/api/users", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
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
  // CLIENTS (CRM)
  // ============================================

  app.get("/api/accounts/:accountId/clients", async (req, res) => {
    try {
      const clients = await storage.getClientsByAccountId(req.params.accountId);
      res.json(clients);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const data = insertClientSchema.parse(req.body);
      const client = await storage.createClient(data);
      
      // Create activity
      await storage.createActivity({
        accountId: data.accountId,
        type: "client_onboarded",
        description: `New client onboarded: ${data.name}`,
        userId: data.createdBy || undefined,
        metadata: { clientId: client.id },
      });

      res.json(client);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.updateClient(req.params.id, req.body);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const success = await storage.deleteClient(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Client not found" });
      }
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
      
      const history = `Client: ${client.name}, Status: ${client.status}, Budget: ${client.budget}, Sector: ${client.sector}`;
      const suggestions = await suggestNextActions(history);
      
      res.json({ suggestions });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // PROJECTS
  // ============================================

  app.get("/api/accounts/:accountId/projects", async (req, res) => {
    try {
      const projects = await storage.getProjectsByAccountId(req.params.accountId);
      res.json(projects);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(data);
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Create activity
      await storage.createActivity({
        accountId: project.accountId,
        type: "business_plan_updated",
        description: `Project updated: ${project.name}`,
        userId: req.body.userId,
        metadata: { projectId: project.id },
      });

      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const success = await storage.deleteProject(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // TASKS
  // ============================================

  app.get("/api/projects/:projectId/tasks", async (req, res) => {
    try {
      const tasks = await storage.getTasksByProjectId(req.params.projectId);
      res.json(tasks);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const data = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(data);
      res.json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.updateTask(req.params.id, req.body);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const success = await storage.deleteTask(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // NOTES
  // ============================================

  app.get("/api/accounts/:accountId/notes", async (req, res) => {
    try {
      const notes = await storage.getNotesByAccountId(req.params.accountId);
      res.json(notes);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      const data = insertNoteSchema.parse(req.body);
      const note = await storage.createNote(data);
      res.json(note);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/notes/:id", async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/notes/:id", async (req, res) => {
    try {
      const note = await storage.updateNote(req.params.id, req.body);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
    try {
      const success = await storage.deleteNote(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // AI operations on notes
  app.post("/api/notes/:id/summarize", async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }

      const text = typeof note.content === 'string' ? note.content : JSON.stringify(note.content);
      const summary = await summarizeText(text);

      res.json({ summary });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/notes/:id/extract-actions", async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }

      const text = typeof note.content === 'string' ? note.content : JSON.stringify(note.content);
      const actions = await extractActions(text);

      res.json({ actions });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // FOLDERS & DOCUMENTS
  // ============================================

  app.get("/api/accounts/:accountId/folders", async (req, res) => {
    try {
      const folders = await storage.getFoldersByAccountId(req.params.accountId);
      res.json(folders);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/folders", async (req, res) => {
    try {
      const data = insertFolderSchema.parse(req.body);
      const folder = await storage.createFolder(data);
      res.json(folder);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/accounts/:accountId/documents", async (req, res) => {
    try {
      const documents = await storage.getDocumentsByAccountId(req.params.accountId);
      res.json(documents);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/folders/:folderId/documents", async (req, res) => {
    try {
      const documents = await storage.getDocumentsByFolderId(req.params.folderId);
      res.json(documents);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/documents", async (req, res) => {
    try {
      const data = insertDocumentSchema.parse(req.body);
      const document = await storage.createDocument(data);

      // Create activity
      await storage.createActivity({
        accountId: data.accountId,
        type: "document_signed",
        description: `Document uploaded: ${data.name}`,
        userId: data.createdBy || undefined,
        metadata: { documentId: document.id },
      });

      res.json(document);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/documents/:id", async (req, res) => {
    try {
      const document = await storage.updateDocument(req.params.id, req.body);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(document);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const success = await storage.deleteDocument(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // ACTIVITIES
  // ============================================

  app.get("/api/accounts/:accountId/activities", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const activities = await storage.getActivitiesByAccountId(req.params.accountId, limit);
      res.json(activities);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // SEARCH
  // ============================================

  app.get("/api/accounts/:accountId/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      const results = await storage.searchAll(req.params.accountId, query);
      res.json(results);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================
  // DASHBOARD STATS
  // ============================================

  app.get("/api/accounts/:accountId/stats", async (req, res) => {
    try {
      const [clients, projects, activities] = await Promise.all([
        storage.getClientsByAccountId(req.params.accountId),
        storage.getProjectsByAccountId(req.params.accountId),
        storage.getActivitiesByAccountId(req.params.accountId, 10),
      ]);

      const activeProjects = projects.filter(p => p.status === 'active');
      const totalRevenue = clients.reduce((sum, c) => sum + (c.budget || 0), 0);

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
