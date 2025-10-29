// Supabase Storage Layer - Updated for new schema
import {
  type Account, type InsertAccount,
  type AppUser, type InsertAppUser,
  type Client, type InsertClient,
  type Project, type InsertProject,
  type Note, type InsertNote,
  type Folder, type InsertFolder,
  type File, type InsertFile,
  type Activity, type InsertActivity,
  accounts, appUsers, clients, projects, notes, folders, files, activities,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, desc, sql } from "drizzle-orm";

// Storage interface for all CRUD operations
export interface IStorage {
  // Accounts
  getAccount(id: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;

  // Users (now appUsers)
  getUser(id: string): Promise<AppUser | undefined>;
  getUserByEmail(email: string): Promise<AppUser | undefined>;
  getUsersByAccountId(accountId: string): Promise<AppUser[]>;
  createUser(user: InsertAppUser): Promise<AppUser>;

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

  // Files (was Documents)
  getFile(id: string): Promise<File | undefined>;
  getFilesByAccountId(accountId: string): Promise<File[]>;
  getFilesByFolderId(folderId: string): Promise<File[]>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(id: string, file: Partial<InsertFile>): Promise<File | undefined>;
  deleteFile(id: string): Promise<boolean>;

  // Activities
  getActivitiesByAccountId(accountId: string, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Search
  searchAll(accountId: string, query: string): Promise<{
    clients: Client[];
    projects: Project[];
    notes: Note[];
    files: File[];
  }>;
}

// Supabase PostgreSQL implementation using Drizzle ORM
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

  // Users (appUsers)
  async getUser(id: string): Promise<AppUser | undefined> {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<AppUser | undefined> {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.email, email));
    return user || undefined;
  }

  async getUsersByAccountId(accountId: string): Promise<AppUser[]> {
    return await db.select().from(appUsers).where(eq(appUsers.accountId, accountId));
  }

  async createUser(insertUser: InsertAppUser): Promise<AppUser> {
    const [user] = await db
      .insert(appUsers)
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
    return result.length > 0;
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
    return result.length > 0;
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
    return result.length > 0;
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
    return result.length > 0;
  }

  // Files (was Documents)
  async getFile(id: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file || undefined;
  }

  async getFilesByAccountId(accountId: string): Promise<File[]> {
    return await db.select().from(files).where(eq(files.accountId, accountId));
  }

  async getFilesByFolderId(folderId: string): Promise<File[]> {
    return await db.select().from(files).where(eq(files.folderId, folderId));
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const [file] = await db
      .insert(files)
      .values(insertFile)
      .returning();
    return file;
  }

  async updateFile(id: string, updateData: Partial<InsertFile>): Promise<File | undefined> {
    const [file] = await db
      .update(files)
      .set(updateData)
      .where(eq(files.id, id))
      .returning();
    return file || undefined;
  }

  async deleteFile(id: string): Promise<boolean> {
    const result = await db.delete(files).where(eq(files.id, id));
    return result.length > 0;
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
    files: File[];
  }> {
    const searchPattern = `%${query}%`;

    const [clientResults, projectResults, noteResults, fileResults] = await Promise.all([
      db.select().from(clients).where(
        and(
          eq(clients.accountId, accountId),
          like(clients.name, searchPattern)
        )
      ),
      db.select().from(projects).where(
        and(
          eq(projects.accountId, accountId),
          like(projects.name, searchPattern)
        )
      ),
      db.select().from(notes).where(
        and(
          eq(notes.accountId, accountId),
          like(notes.title, searchPattern)
        )
      ),
      db.select().from(files).where(
        and(
          eq(files.accountId, accountId),
          like(files.name, searchPattern)
        )
      ),
    ]);

    return {
      clients: clientResults,
      projects: projectResults,
      notes: noteResults,
      files: fileResults,
    };
  }
}

export const storage = new DatabaseStorage();
