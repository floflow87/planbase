// Supabase Storage Layer - Updated for new schema
import {
  type Account, type InsertAccount,
  type AppUser, type InsertAppUser,
  type Client, type InsertClient,
  type Project, type InsertProject,
  type TaskColumn, type InsertTaskColumn,
  type Task, type InsertTask,
  type Note, type InsertNote,
  type Folder, type InsertFolder,
  type File, type InsertFile,
  type Activity, type InsertActivity,
  type Deal, type InsertDeal,
  type Product, type InsertProduct,
  type Feature, type InsertFeature,
  type Roadmap, type InsertRoadmap,
  type RoadmapItem, type InsertRoadmapItem,
  accounts, appUsers, clients, projects, taskColumns, tasks, notes, folders, files, activities,
  deals, products, features, roadmaps, roadmapItems,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, desc, sql } from "drizzle-orm";

// Storage interface for all CRUD operations
export interface IStorage {
  // Accounts
  getAccount(id: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined>;

  // Users (now appUsers)
  getUser(id: string): Promise<AppUser | undefined>;
  getUserByEmail(email: string): Promise<AppUser | undefined>;
  getUsersByAccountId(accountId: string): Promise<AppUser[]>;
  createUser(user: InsertAppUser): Promise<AppUser>;
  updateUser(id: string, user: Partial<InsertAppUser>): Promise<AppUser | undefined>;

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

  // Task Columns
  getTaskColumn(id: string): Promise<TaskColumn | undefined>;
  getTaskColumnsByProjectId(projectId: string): Promise<TaskColumn[]>;
  createTaskColumn(column: InsertTaskColumn): Promise<TaskColumn>;
  updateTaskColumn(id: string, column: Partial<InsertTaskColumn>): Promise<TaskColumn | undefined>;
  deleteTaskColumn(id: string): Promise<boolean>;
  reorderTaskColumns(projectId: string, columnOrders: { id: string; order: number }[]): Promise<void>;

  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  getTasksByProjectId(projectId: string): Promise<Task[]>;
  getTasksByAccountId(accountId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  duplicateTask(id: string): Promise<Task | undefined>;
  moveTaskToColumn(taskId: string, columnId: string, position: number): Promise<Task | undefined>;
  bulkUpdateTaskPositions(updates: { id: string; positionInColumn: number; columnId: string }[]): Promise<void>;

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

  // Deals (Sales Pipeline)
  getDeal(id: string): Promise<Deal | undefined>;
  getDealsByAccountId(accountId: string): Promise<Deal[]>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: string): Promise<boolean>;

  // Products
  getProduct(id: string): Promise<Product | undefined>;
  getProductsByAccountId(accountId: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Features
  getFeature(id: string): Promise<Feature | undefined>;
  getFeaturesByAccountId(accountId: string): Promise<Feature[]>;
  createFeature(feature: InsertFeature): Promise<Feature>;
  updateFeature(id: string, feature: Partial<InsertFeature>): Promise<Feature | undefined>;
  deleteFeature(id: string): Promise<boolean>;

  // Roadmaps
  getRoadmap(id: string): Promise<Roadmap | undefined>;
  getRoadmapsByAccountId(accountId: string): Promise<Roadmap[]>;
  createRoadmap(roadmap: InsertRoadmap): Promise<Roadmap>;
  updateRoadmap(id: string, roadmap: Partial<InsertRoadmap>): Promise<Roadmap | undefined>;
  deleteRoadmap(id: string): Promise<boolean>;

  // Roadmap Items
  getRoadmapItem(id: string): Promise<RoadmapItem | undefined>;
  getRoadmapItemsByRoadmapId(roadmapId: string): Promise<RoadmapItem[]>;
  createRoadmapItem(item: InsertRoadmapItem): Promise<RoadmapItem>;
  updateRoadmapItem(id: string, item: Partial<InsertRoadmapItem>): Promise<RoadmapItem | undefined>;
  deleteRoadmapItem(id: string): Promise<boolean>;

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

  async updateAccount(id: string, updateData: Partial<InsertAccount>): Promise<Account | undefined> {
    const [account] = await db
      .update(accounts)
      .set(updateData)
      .where(eq(accounts.id, id))
      .returning();
    return account || undefined;
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

  async updateUser(id: string, updates: Partial<InsertAppUser>): Promise<AppUser | undefined> {
    // Security: Strip out protected fields that users shouldn't modify themselves
    const { id: _id, accountId: _accountId, role: _role, createdAt: _createdAt, ...safeUpdates } = updates;
    
    const [user] = await db
      .update(appUsers)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(appUsers.id, id))
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

  // Task Columns
  async getTaskColumn(id: string): Promise<TaskColumn | undefined> {
    const [column] = await db.select().from(taskColumns).where(eq(taskColumns.id, id));
    return column || undefined;
  }

  async getTaskColumnsByProjectId(projectId: string): Promise<TaskColumn[]> {
    return await db
      .select()
      .from(taskColumns)
      .where(eq(taskColumns.projectId, projectId))
      .orderBy(taskColumns.order);
  }

  async createTaskColumn(columnData: InsertTaskColumn): Promise<TaskColumn> {
    const [column] = await db.insert(taskColumns).values(columnData).returning();
    return column;
  }

  async updateTaskColumn(id: string, updateData: Partial<InsertTaskColumn>): Promise<TaskColumn | undefined> {
    const [column] = await db
      .update(taskColumns)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(taskColumns.id, id))
      .returning();
    return column || undefined;
  }

  async deleteTaskColumn(id: string): Promise<boolean> {
    const result = await db.delete(taskColumns).where(eq(taskColumns.id, id));
    return result.length > 0;
  }

  async reorderTaskColumns(projectId: string, columnOrders: { id: string; order: number }[]): Promise<void> {
    for (const { id, order } of columnOrders) {
      await db
        .update(taskColumns)
        .set({ order, updatedAt: new Date() })
        .where(and(eq(taskColumns.id, id), eq(taskColumns.projectId, projectId)));
    }
  }

  // Tasks
  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async getTasksByProjectId(projectId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(tasks.positionInColumn);
  }

  async getTasksByAccountId(accountId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.accountId, accountId))
      .orderBy(desc(tasks.createdAt));
  }

  async createTask(taskData: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(taskData).returning();
    return task;
  }

  async updateTask(id: string, updateData: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return task || undefined;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return result.length > 0;
  }

  async duplicateTask(id: string): Promise<Task | undefined> {
    const original = await this.getTask(id);
    if (!original) return undefined;

    const { id: _, createdAt: __, updatedAt: ___, ...taskData } = original;
    
    const [duplicated] = await db.insert(tasks).values({
      ...taskData,
      title: `${taskData.title} (copie)`,
      positionInColumn: (original.positionInColumn || 0) + 1,
    }).returning();
    
    return duplicated;
  }

  async moveTaskToColumn(taskId: string, columnId: string, position: number): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set({ 
        columnId, 
        positionInColumn: position,
        updatedAt: new Date() 
      })
      .where(eq(tasks.id, taskId))
      .returning();
    return task || undefined;
  }

  async bulkUpdateTaskPositions(updates: { id: string; positionInColumn: number; columnId: string }[]): Promise<void> {
    for (const update of updates) {
      await db
        .update(tasks)
        .set({ 
          columnId: update.columnId,
          positionInColumn: update.positionInColumn,
          updatedAt: new Date() 
        })
        .where(eq(tasks.id, update.id));
    }
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

  // Deals (Sales Pipeline)
  async getDeal(id: string): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal || undefined;
  }

  async getDealsByAccountId(accountId: string): Promise<Deal[]> {
    return await db.select().from(deals).where(eq(deals.accountId, accountId))
      .orderBy(desc(deals.createdAt));
  }

  async createDeal(insertDeal: InsertDeal): Promise<Deal> {
    const [deal] = await db.insert(deals).values(insertDeal).returning();
    return deal;
  }

  async updateDeal(id: string, updateData: Partial<InsertDeal>): Promise<Deal | undefined> {
    const [deal] = await db.update(deals).set(updateData).where(eq(deals.id, id)).returning();
    return deal || undefined;
  }

  async deleteDeal(id: string): Promise<boolean> {
    const result = await db.delete(deals).where(eq(deals.id, id));
    return result.length > 0;
  }

  // Products
  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductsByAccountId(accountId: string): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.accountId, accountId))
      .orderBy(desc(products.createdAt));
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: string, updateData: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products).set(updateData).where(eq(products.id, id)).returning();
    return product || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return result.length > 0;
  }

  // Features
  async getFeature(id: string): Promise<Feature | undefined> {
    const [feature] = await db.select().from(features).where(eq(features.id, id));
    return feature || undefined;
  }

  async getFeaturesByAccountId(accountId: string): Promise<Feature[]> {
    return await db.select().from(features).where(eq(features.accountId, accountId))
      .orderBy(desc(features.createdAt));
  }

  async createFeature(insertFeature: InsertFeature): Promise<Feature> {
    const [feature] = await db.insert(features).values(insertFeature).returning();
    return feature;
  }

  async updateFeature(id: string, updateData: Partial<InsertFeature>): Promise<Feature | undefined> {
    const [feature] = await db.update(features).set(updateData).where(eq(features.id, id)).returning();
    return feature || undefined;
  }

  async deleteFeature(id: string): Promise<boolean> {
    const result = await db.delete(features).where(eq(features.id, id));
    return result.length > 0;
  }

  // Roadmaps
  async getRoadmap(id: string): Promise<Roadmap | undefined> {
    const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, id));
    return roadmap || undefined;
  }

  async getRoadmapsByAccountId(accountId: string): Promise<Roadmap[]> {
    return await db.select().from(roadmaps).where(eq(roadmaps.accountId, accountId))
      .orderBy(desc(roadmaps.createdAt));
  }

  async createRoadmap(insertRoadmap: InsertRoadmap): Promise<Roadmap> {
    const [roadmap] = await db.insert(roadmaps).values(insertRoadmap).returning();
    return roadmap;
  }

  async updateRoadmap(id: string, updateData: Partial<InsertRoadmap>): Promise<Roadmap | undefined> {
    const [roadmap] = await db.update(roadmaps).set(updateData).where(eq(roadmaps.id, id)).returning();
    return roadmap || undefined;
  }

  async deleteRoadmap(id: string): Promise<boolean> {
    const result = await db.delete(roadmaps).where(eq(roadmaps.id, id));
    return result.length > 0;
  }

  // Roadmap Items
  async getRoadmapItem(id: string): Promise<RoadmapItem | undefined> {
    const [item] = await db.select().from(roadmapItems).where(eq(roadmapItems.id, id));
    return item || undefined;
  }

  async getRoadmapItemsByRoadmapId(roadmapId: string): Promise<RoadmapItem[]> {
    return await db.select().from(roadmapItems).where(eq(roadmapItems.roadmapId, roadmapId))
      .orderBy(desc(roadmapItems.createdAt));
  }

  async createRoadmapItem(insertItem: InsertRoadmapItem): Promise<RoadmapItem> {
    const [item] = await db.insert(roadmapItems).values(insertItem).returning();
    return item;
  }

  async updateRoadmapItem(id: string, updateData: Partial<InsertRoadmapItem>): Promise<RoadmapItem | undefined> {
    const [item] = await db.update(roadmapItems).set(updateData).where(eq(roadmapItems.id, id)).returning();
    return item || undefined;
  }

  async deleteRoadmapItem(id: string): Promise<boolean> {
    const result = await db.delete(roadmapItems).where(eq(roadmapItems.id, id));
    return result.length > 0;
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
