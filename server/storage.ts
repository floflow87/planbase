// Reference: blueprint:javascript_database
import {
  type Account, type InsertAccount,
  type User, type InsertUser,
  type Client, type InsertClient,
  type Project, type InsertProject,
  type Task, type InsertTask,
  type Note, type InsertNote,
  type Folder, type InsertFolder,
  type Document, type InsertDocument,
  type Activity, type InsertActivity,
  accounts, users, clients, projects, tasks, notes, folders, documents, activities,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, desc, sql } from "drizzle-orm";

// Storage interface for all CRUD operations
export interface IStorage {
  // Accounts
  getAccount(id: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByAccountId(accountId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;

  // Clients
  getClient(id: string): Promise<Client | undefined>;
  getClientsByAccountId(accountId: string): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getProjectsByAccountId(accountId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  getTasksByProjectId(projectId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;

  // Notes
  getNote(id: string): Promise<Note | undefined>;
  getNotesByAccountId(accountId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, note: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: string): Promise<boolean>;

  // Folders
  getFolder(id: string): Promise<Folder | undefined>;
  getFoldersByAccountId(accountId: string): Promise<Folder[]>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(id: string, folder: Partial<InsertFolder>): Promise<Folder | undefined>;
  deleteFolder(id: string): Promise<boolean>;

  // Documents
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByAccountId(accountId: string): Promise<Document[]>;
  getDocumentsByFolderId(folderId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, document: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;

  // Activities
  getActivitiesByAccountId(accountId: string, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Search
  searchAll(accountId: string, query: string): Promise<{
    clients: Client[];
    projects: Project[];
    notes: Note[];
    documents: Document[];
  }>;
}

// PostgreSQL implementation using Drizzle ORM
export class DatabaseStorage implements IStorage {
  // Accounts
  async getAccount(id: string): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account || undefined;
  }

  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    const [account] = await db
      .insert(accounts)
      .values(insertAccount)
      .returning();
    return account;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUsersByAccountId(accountId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.accountId, accountId));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Clients
  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async getClientsByAccountId(accountId: string): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.accountId, accountId));
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values(insertClient)
      .returning();
    return client;
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();
    return client || undefined;
  }

  async deleteClient(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async getProjectsByAccountId(accountId: string): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.accountId, accountId));
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(insertProject)
      .returning();
    return project;
  }

  async updateProject(id: string, updateData: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();
    return project || undefined;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Tasks
  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async getTasksByProjectId(projectId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db
      .insert(tasks)
      .values(insertTask)
      .returning();
    return task;
  }

  async updateTask(id: string, updateData: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
    return task || undefined;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Notes
  async getNote(id: string): Promise<Note | undefined> {
    const [note] = await db.select().from(notes).where(eq(notes.id, id));
    return note || undefined;
  }

  async getNotesByAccountId(accountId: string): Promise<Note[]> {
    return await db.select().from(notes).where(eq(notes.accountId, accountId));
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const [note] = await db
      .insert(notes)
      .values(insertNote)
      .returning();
    return note;
  }

  async updateNote(id: string, updateData: Partial<InsertNote>): Promise<Note | undefined> {
    const [note] = await db
      .update(notes)
      .set(updateData)
      .where(eq(notes.id, id))
      .returning();
    return note || undefined;
  }

  async deleteNote(id: string): Promise<boolean> {
    const result = await db.delete(notes).where(eq(notes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Folders
  async getFolder(id: string): Promise<Folder | undefined> {
    const [folder] = await db.select().from(folders).where(eq(folders.id, id));
    return folder || undefined;
  }

  async getFoldersByAccountId(accountId: string): Promise<Folder[]> {
    return await db.select().from(folders).where(eq(folders.accountId, accountId));
  }

  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    const [folder] = await db
      .insert(folders)
      .values(insertFolder)
      .returning();
    return folder;
  }

  async updateFolder(id: string, updateData: Partial<InsertFolder>): Promise<Folder | undefined> {
    const [folder] = await db
      .update(folders)
      .set(updateData)
      .where(eq(folders.id, id))
      .returning();
    return folder || undefined;
  }

  async deleteFolder(id: string): Promise<boolean> {
    const result = await db.delete(folders).where(eq(folders.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Documents
  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async getDocumentsByAccountId(accountId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.accountId, accountId));
  }

  async getDocumentsByFolderId(folderId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.folderId, folderId));
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument)
      .returning();
    return document;
  }

  async updateDocument(id: string, updateData: Partial<InsertDocument>): Promise<Document | undefined> {
    const [document] = await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, id))
      .returning();
    return document || undefined;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Activities
  async getActivitiesByAccountId(accountId: string, limit: number = 20): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.accountId, accountId))
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const [activity] = await db
      .insert(activities)
      .values(insertActivity)
      .returning();
    return activity;
  }

  // Search
  async searchAll(accountId: string, query: string): Promise<{
    clients: Client[];
    projects: Project[];
    notes: Note[];
    documents: Document[];
  }> {
    const searchPattern = `%${query}%`;

    const [clientResults, projectResults, noteResults, documentResults] = await Promise.all([
      db.select().from(clients).where(
        and(
          eq(clients.accountId, accountId),
          or(
            like(clients.name, searchPattern),
            like(clients.email, searchPattern),
            like(clients.company, searchPattern)
          )
        )
      ),
      db.select().from(projects).where(
        and(
          eq(projects.accountId, accountId),
          or(
            like(projects.name, searchPattern),
            like(projects.description, searchPattern)
          )
        )
      ),
      db.select().from(notes).where(
        and(
          eq(notes.accountId, accountId),
          like(notes.title, searchPattern)
        )
      ),
      db.select().from(documents).where(
        and(
          eq(documents.accountId, accountId),
          like(documents.name, searchPattern)
        )
      ),
    ]);

    return {
      clients: clientResults,
      projects: projectResults,
      notes: noteResults,
      documents: documentResults,
    };
  }
}

export const storage = new DatabaseStorage();
