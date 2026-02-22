// Supabase Storage Layer - Updated for new schema
import {
  type Account, type InsertAccount,
  type AppUser, type InsertAppUser,
  type Client, type InsertClient,
  type Contact, type InsertContact,
  type ClientComment, type InsertClientComment,
  type ClientCustomTab, type InsertClientCustomTab,
  type ClientCustomField, type InsertClientCustomField,
  type ClientCustomFieldValue, type InsertClientCustomFieldValue,
  type Project, type InsertProject,
  type ProjectCategory, type InsertProjectCategory,
  type ProjectPayment, type InsertProjectPayment,
  type CdcSession, type InsertCdcSession, type UpdateCdcSession,
  type ProjectBaseline, type InsertProjectBaseline,
  type ProjectScopeItem, type InsertProjectScopeItem,
  type RecommendationAction, type InsertRecommendationAction,
  type TaskColumn, type InsertTaskColumn,
  type Task, type InsertTask,
  type Note, type InsertNote,
  type NoteCategory, type InsertNoteCategory,
  type NoteLink, type InsertNoteLink,
  type DocumentTemplate, type InsertDocumentTemplate,
  type Document, type InsertDocument,
  type DocumentLink, type InsertDocumentLink,
  type Folder, type InsertFolder,
  type File, type InsertFile,
  type Activity, type InsertActivity,
  type Deal, type InsertDeal,
  type Product, type InsertProduct,
  type Feature, type InsertFeature,
  type Roadmap, type InsertRoadmap,
  type RoadmapItem, type InsertRoadmapItem,
  type RoadmapItemLink, type InsertRoadmapItemLink,
  type RoadmapDependency, type InsertRoadmapDependency,
  type Appointment, type InsertAppointment,
  type GoogleCalendarToken, type InsertGoogleCalendarToken,
  type TimeEntry, type InsertTimeEntry,
  type Mindmap, type InsertMindmap,
  type MindmapNode, type InsertMindmapNode,
  type MindmapEdge, type InsertMindmapEdge,
  type EntityLink, type InsertEntityLink,
  type Settings, type InsertSettings,
  accounts, appUsers, clients, contacts, clientComments, clientCustomTabs, clientCustomFields, clientCustomFieldValues,
  projects, projectCategories, projectPayments, cdcSessions, projectBaselines, projectScopeItems, recommendationActions, taskColumns, tasks, notes, noteCategories, noteLinks, documentTemplates, documents, documentLinks, folders, files, activities,
  deals, products, features, roadmaps, roadmapItems, roadmapItemLinks, roadmapDependencies,
  appointments, googleCalendarTokens, timeEntries,
  mindmaps, mindmapNodes, mindmapEdges, entityLinks, settings,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, desc, sql, isNull, inArray, gte, lte, asc } from "drizzle-orm";

// Helper functions to access Google OAuth credentials from environment variables
// Global credentials shared across all accounts for multi-tenant SaaS
export function getGoogleClientId(): string | undefined {
  return process.env.GOOGLE_CLIENT_ID;
}

export function getGoogleClientSecret(): string | undefined {
  return process.env.GOOGLE_CLIENT_SECRET;
}

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
  getClient(accountId: string, id: string): Promise<Client | undefined>;
  getClientsByAccountId(accountId: string): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(accountId: string, id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(accountId: string, id: string): Promise<boolean>;

  // Contacts
  getContact(accountId: string, id: string): Promise<Contact | undefined>;
  getContactsByClientId(accountId: string, clientId: string): Promise<Contact[]>;
  getContactsByAccountId(accountId: string): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(accountId: string, id: string, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(accountId: string, id: string): Promise<boolean>;

  // Client Comments
  getClientComments(accountId: string, clientId: string): Promise<ClientComment[]>;
  createClientComment(comment: InsertClientComment): Promise<ClientComment>;
  deleteClientComment(accountId: string, commentId: string): Promise<boolean>;

  // Client Custom Tabs
  getClientCustomTabsByAccountId(accountId: string): Promise<ClientCustomTab[]>;
  createClientCustomTab(tab: InsertClientCustomTab): Promise<ClientCustomTab>;
  updateClientCustomTab(accountId: string, id: string, tab: Partial<InsertClientCustomTab>): Promise<ClientCustomTab | undefined>;
  deleteClientCustomTab(accountId: string, id: string): Promise<boolean>;

  // Client Custom Fields
  getClientCustomFieldsByTabId(accountId: string, tabId: string): Promise<ClientCustomField[]>;
  getClientCustomFieldsByAccountId(accountId: string): Promise<ClientCustomField[]>;
  createClientCustomField(field: InsertClientCustomField): Promise<ClientCustomField>;
  updateClientCustomField(accountId: string, id: string, field: Partial<InsertClientCustomField>): Promise<ClientCustomField | undefined>;
  deleteClientCustomField(accountId: string, id: string): Promise<boolean>;

  // Client Custom Field Values
  getClientCustomFieldValues(accountId: string, clientId: string): Promise<ClientCustomFieldValue[]>;
  upsertClientCustomFieldValue(value: InsertClientCustomFieldValue): Promise<ClientCustomFieldValue>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getProjectsByAccountId(accountId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Project Categories
  getProjectCategoriesByAccountId(accountId: string): Promise<ProjectCategory[]>;
  getProjectCategoryByNormalizedName(accountId: string, name: string): Promise<ProjectCategory | undefined>;
  createProjectCategory(category: InsertProjectCategory): Promise<ProjectCategory>;
  updateProjectCategory(id: string, accountId: string, updates: { projectType?: string | null }): Promise<ProjectCategory | undefined>;

  // Project Payments
  getPaymentsByProjectId(projectId: string): Promise<ProjectPayment[]>;
  getPaymentsByAccountId(accountId: string): Promise<ProjectPayment[]>;
  getPayment(id: string): Promise<ProjectPayment | undefined>;
  createPayment(payment: InsertProjectPayment): Promise<ProjectPayment>;
  updatePayment(id: string, payment: Partial<InsertProjectPayment>): Promise<ProjectPayment | undefined>;
  deletePayment(id: string): Promise<boolean>;

  // CDC Sessions
  getCdcSessionsByProjectId(projectId: string): Promise<CdcSession[]>;
  getCdcSession(id: string): Promise<CdcSession | undefined>;
  getActiveCdcSessionByProjectId(projectId: string): Promise<CdcSession | undefined>;
  createCdcSession(session: InsertCdcSession): Promise<CdcSession>;
  updateCdcSession(id: string, session: UpdateCdcSession): Promise<CdcSession | undefined>;
  deleteCdcSession(id: string): Promise<boolean>;
  completeCdcSession(id: string, generatedBacklogId?: string, generatedRoadmapId?: string): Promise<CdcSession | undefined>;

  // Project Baselines
  getBaselinesByProjectId(projectId: string): Promise<ProjectBaseline[]>;
  getLatestBaselineByProjectId(projectId: string): Promise<ProjectBaseline | undefined>;
  createBaseline(baseline: InsertProjectBaseline): Promise<ProjectBaseline>;

  // Project Scope Items (CDC/Statement of Work)
  getScopeItemsByProjectId(projectId: string): Promise<ProjectScopeItem[]>;
  getScopeItemsByCdcSessionId(cdcSessionId: string): Promise<ProjectScopeItem[]>;
  getScopeItem(id: string): Promise<ProjectScopeItem | undefined>;
  createScopeItem(scopeItem: InsertProjectScopeItem): Promise<ProjectScopeItem>;
  updateScopeItem(id: string, scopeItem: Partial<InsertProjectScopeItem>): Promise<ProjectScopeItem | undefined>;
  deleteScopeItem(id: string): Promise<boolean>;
  reorderScopeItems(projectId: string, orders: { id: string; order: number }[]): Promise<void>;

  // Recommendation Actions
  getRecommendationActionsByAccountId(accountId: string): Promise<RecommendationAction[]>;
  getRecommendationActionsByProjectId(projectId: string): Promise<RecommendationAction[]>;
  getRecommendationAction(accountId: string, projectId: string, recommendationKey: string): Promise<RecommendationAction | undefined>;
  upsertRecommendationAction(action: InsertRecommendationAction): Promise<RecommendationAction>;
  deleteRecommendationAction(id: string): Promise<boolean>;

  // Task Columns
  getTaskColumn(id: string): Promise<TaskColumn | undefined>;
  getTaskColumnsByProjectId(projectId: string): Promise<TaskColumn[]>;
  getGlobalTaskColumnsByAccountId(accountId: string): Promise<TaskColumn[]>;
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
  bulkUpdateTasksProject(taskIds: string[], projectId: string | null, newColumnId: string): Promise<void>;

  // Notes
  getNote(id: string): Promise<Note | undefined>;
  getNotesByAccountId(accountId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, note: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: string): Promise<boolean>;

  // Note Categories
  getNoteCategoriesByAccountId(accountId: string): Promise<NoteCategory[]>;
  getNoteCategoryByNormalizedName(accountId: string, name: string): Promise<NoteCategory | undefined>;
  createNoteCategory(category: InsertNoteCategory): Promise<NoteCategory>;
  updateNoteCategory(id: string, accountId: string, updates: { name?: string; color?: string | null }): Promise<NoteCategory | undefined>;
  deleteNoteCategory(id: string): Promise<boolean>;

  // Note Links
  getNoteLinksByNoteId(noteId: string): Promise<NoteLink[]>;
  getNotesByProjectId(projectId: string): Promise<Note[]>;
  getNoteLinksByAccountId(accountId: string): Promise<NoteLink[]>;
  createNoteLink(noteLink: InsertNoteLink): Promise<NoteLink>;
  deleteNoteLink(noteId: string, targetType: string, targetId: string): Promise<boolean>;

  // Document Templates
  getDocumentTemplate(id: string): Promise<DocumentTemplate | undefined>;
  getDocumentTemplates(accountId: string): Promise<DocumentTemplate[]>; // System templates + account templates
  getDocumentTemplatesByAccountId(accountId: string): Promise<DocumentTemplate[]>;
  createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate>;
  updateDocumentTemplate(id: string, accountId: string, template: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate | undefined>;
  deleteDocumentTemplate(id: string): Promise<boolean>;

  // Documents
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByAccountId(accountId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, accountId: string, document: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;
  duplicateDocument(id: string): Promise<Document | undefined>;

  // Document Links
  getDocumentLinksByDocumentId(documentId: string): Promise<DocumentLink[]>;
  getDocumentLinksByAccountId(accountId: string): Promise<DocumentLink[]>;
  createDocumentLink(documentLink: InsertDocumentLink & { documentId: string }): Promise<DocumentLink>;
  deleteDocumentLink(documentId: string, targetType: string, targetId: string): Promise<boolean>;

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
  getActivity(id: string): Promise<Activity | undefined>;
  getActivitiesByAccountId(accountId: string, limit?: number): Promise<Activity[]>;
  getActivitiesBySubject(accountId: string, subjectType: string, subjectId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: string, data: Partial<InsertActivity>): Promise<Activity | undefined>;
  deleteActivity(id: string): Promise<boolean>;

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
  getRoadmapsByProjectId(accountId: string, projectId: string): Promise<Roadmap[]>;
  createRoadmap(roadmap: InsertRoadmap): Promise<Roadmap>;
  updateRoadmap(id: string, roadmap: Partial<InsertRoadmap>): Promise<Roadmap | undefined>;
  deleteRoadmap(id: string): Promise<boolean>;

  // Roadmap Items
  getRoadmapItem(id: string): Promise<RoadmapItem | undefined>;
  getRoadmapItemsByRoadmapId(roadmapId: string): Promise<RoadmapItem[]>;
  createRoadmapItem(item: InsertRoadmapItem): Promise<RoadmapItem>;
  updateRoadmapItem(id: string, item: Partial<InsertRoadmapItem>): Promise<RoadmapItem | undefined>;
  deleteRoadmapItem(id: string): Promise<boolean>;

  // Roadmap Item Links
  getRoadmapItemLinksByItemId(roadmapItemId: string): Promise<RoadmapItemLink[]>;
  createRoadmapItemLink(link: InsertRoadmapItemLink): Promise<RoadmapItemLink>;
  deleteRoadmapItemLink(id: string): Promise<boolean>;

  // Roadmap Dependencies
  getRoadmapDependenciesByItemId(roadmapItemId: string): Promise<RoadmapDependency[]>;
  getRoadmapDependenciesByRoadmapId(roadmapId: string): Promise<RoadmapDependency[]>;
  createRoadmapDependency(dependency: InsertRoadmapDependency): Promise<RoadmapDependency>;
  deleteRoadmapDependency(id: string): Promise<boolean>;

  // Search
  searchAll(accountId: string, query: string): Promise<{
    clients: Client[];
    projects: Project[];
    notes: Note[];
    files: File[];
  }>;

  // Appointments
  getAppointment(accountId: string, id: string): Promise<Appointment | undefined>;
  getAppointmentsByAccountId(accountId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(accountId: string, id: string, appointment: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(accountId: string, id: string): Promise<boolean>;
  getAppointmentByGoogleEventId(accountId: string, googleEventId: string): Promise<Appointment | undefined>;

  // Google Calendar Tokens (TODO: Implement encryption at rest using pgcrypto or KMS)
  getGoogleTokenByUserId(accountId: string, userId: string): Promise<GoogleCalendarToken | undefined>;
  upsertGoogleToken(token: InsertGoogleCalendarToken): Promise<GoogleCalendarToken>;
  deleteGoogleToken(accountId: string, userId: string): Promise<boolean>;
  updateGoogleTokenExpiry(accountId: string, userId: string, accessToken: string, expiresAt: Date): Promise<void>;

  // Time Entries
  getTimeEntry(accountId: string, id: string): Promise<TimeEntry | undefined>;
  getTimeEntriesByProjectId(accountId: string, projectId: string): Promise<TimeEntry[]>;
  getTimeEntriesByAccountId(accountId: string): Promise<TimeEntry[]>;
  getActiveTimeEntry(accountId: string, userId: string): Promise<TimeEntry | undefined>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(accountId: string, id: string, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(accountId: string, id: string): Promise<boolean>;

  // Mindmaps
  getMindmap(accountId: string, id: string): Promise<Mindmap | undefined>;
  getMindmapWithDetails(accountId: string, id: string): Promise<{ mindmap: Mindmap; nodes: MindmapNode[]; edges: MindmapEdge[] } | undefined>;
  getMindmapsByAccountId(accountId: string): Promise<Mindmap[]>;
  getMindmapsByClientId(accountId: string, clientId: string): Promise<Mindmap[]>;
  getMindmapsByProjectId(accountId: string, projectId: string): Promise<Mindmap[]>;
  createMindmap(mindmap: InsertMindmap): Promise<Mindmap>;
  updateMindmap(accountId: string, id: string, mindmap: Partial<InsertMindmap>): Promise<Mindmap | undefined>;
  deleteMindmap(accountId: string, id: string): Promise<boolean>;

  // Mindmap Nodes
  getMindmapNode(accountId: string, id: string): Promise<MindmapNode | undefined>;
  getMindmapNodesByMindmapId(accountId: string, mindmapId: string): Promise<MindmapNode[]>;
  createMindmapNode(node: InsertMindmapNode): Promise<MindmapNode>;
  updateMindmapNode(accountId: string, id: string, node: Partial<InsertMindmapNode>): Promise<MindmapNode | undefined>;
  deleteMindmapNode(accountId: string, id: string): Promise<boolean>;

  // Mindmap Edges
  getMindmapEdge(accountId: string, id: string): Promise<MindmapEdge | undefined>;
  getMindmapEdgesByMindmapId(accountId: string, mindmapId: string): Promise<MindmapEdge[]>;
  createMindmapEdge(edge: InsertMindmapEdge): Promise<MindmapEdge>;
  updateMindmapEdge(accountId: string, id: string, edge: Partial<InsertMindmapEdge>): Promise<MindmapEdge | undefined>;
  deleteMindmapEdge(accountId: string, id: string): Promise<boolean>;

  // Entity Links
  getEntityLink(accountId: string, id: string): Promise<EntityLink | undefined>;
  getEntityLinksByAccountId(accountId: string): Promise<EntityLink[]>;
  createEntityLink(link: InsertEntityLink): Promise<EntityLink>;
  deleteEntityLink(accountId: string, id: string): Promise<boolean>;

  // Settings
  getSetting(scope: string, scopeId: string | null, key: string): Promise<Settings | undefined>;
  getSettingsByScope(scope: string, scopeId: string | null): Promise<Settings[]>;
  upsertSetting(setting: InsertSettings): Promise<Settings>;
  deleteSetting(scope: string, scopeId: string | null, key: string): Promise<boolean>;
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
    const { id: _id, accountId: _accountId, role: _role, ...safeUpdates } = updates;
    
    const [user] = await db
      .update(appUsers)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(appUsers.id, id))
      .returning();
    return user;
  }

  // Clients
  async getClient(accountId: string, id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(
      and(eq(clients.id, id), eq(clients.accountId, accountId))
    );
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

  async updateClient(accountId: string, id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set(updateData)
      .where(and(eq(clients.id, id), eq(clients.accountId, accountId)))
      .returning();
    return client || undefined;
  }

  async deleteClient(accountId: string, id: string): Promise<boolean> {
    const result = await db.delete(clients).where(and(eq(clients.id, id), eq(clients.accountId, accountId))).returning();
    return result.length > 0;
  }

  // Contacts
  async getContact(accountId: string, id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(
      and(eq(contacts.id, id), eq(contacts.accountId, accountId))
    );
    return contact || undefined;
  }

  async getContactsByClientId(accountId: string, clientId: string): Promise<Contact[]> {
    return await db.select().from(contacts).where(
      and(
        eq(contacts.accountId, accountId),
        eq(contacts.clientId, clientId)
      )
    );
  }

  async getContactsByAccountId(accountId: string): Promise<Contact[]> {
    return await db.select().from(contacts).where(eq(contacts.accountId, accountId));
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db
      .insert(contacts)
      .values(insertContact)
      .returning();
    return contact;
  }

  async updateContact(accountId: string, id: string, updateData: Partial<InsertContact>): Promise<Contact | undefined> {
    const [contact] = await db
      .update(contacts)
      .set(updateData)
      .where(and(eq(contacts.id, id), eq(contacts.accountId, accountId)))
      .returning();
    return contact || undefined;
  }

  async deleteContact(accountId: string, id: string): Promise<boolean> {
    const result = await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.accountId, accountId))).returning();
    return result.length > 0;
  }

  // Client Comments
  async getClientComments(accountId: string, clientId: string): Promise<ClientComment[]> {
    return await db
      .select()
      .from(clientComments)
      .where(
        and(
          eq(clientComments.accountId, accountId),
          eq(clientComments.clientId, clientId)
        )
      )
      .orderBy(desc(clientComments.createdAt));
  }

  async createClientComment(insertComment: InsertClientComment): Promise<ClientComment> {
    const [comment] = await db
      .insert(clientComments)
      .values(insertComment)
      .returning();
    return comment;
  }

  async deleteClientComment(accountId: string, commentId: string): Promise<boolean> {
    const result = await db
      .delete(clientComments)
      .where(and(eq(clientComments.id, commentId), eq(clientComments.accountId, accountId)))
      .returning();
    return result.length > 0;
  }

  // Client Custom Tabs
  async getClientCustomTabsByAccountId(accountId: string): Promise<ClientCustomTab[]> {
    return await db
      .select()
      .from(clientCustomTabs)
      .where(eq(clientCustomTabs.accountId, accountId))
      .orderBy(clientCustomTabs.order);
  }

  async createClientCustomTab(insertTab: InsertClientCustomTab): Promise<ClientCustomTab> {
    const [tab] = await db
      .insert(clientCustomTabs)
      .values(insertTab)
      .returning();
    return tab;
  }

  async updateClientCustomTab(accountId: string, id: string, updateData: Partial<InsertClientCustomTab>): Promise<ClientCustomTab | undefined> {
    const [tab] = await db
      .update(clientCustomTabs)
      .set(updateData)
      .where(and(eq(clientCustomTabs.id, id), eq(clientCustomTabs.accountId, accountId)))
      .returning();
    return tab || undefined;
  }

  async deleteClientCustomTab(accountId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(clientCustomTabs)
      .where(and(eq(clientCustomTabs.id, id), eq(clientCustomTabs.accountId, accountId)))
      .returning();
    return result.length > 0;
  }

  // Client Custom Fields
  async getClientCustomFieldsByTabId(accountId: string, tabId: string): Promise<ClientCustomField[]> {
    return await db
      .select()
      .from(clientCustomFields)
      .where(and(eq(clientCustomFields.accountId, accountId), eq(clientCustomFields.tabId, tabId)))
      .orderBy(clientCustomFields.order);
  }

  async getClientCustomFieldsByAccountId(accountId: string): Promise<ClientCustomField[]> {
    return await db
      .select()
      .from(clientCustomFields)
      .where(eq(clientCustomFields.accountId, accountId))
      .orderBy(clientCustomFields.order);
  }

  async createClientCustomField(insertField: InsertClientCustomField): Promise<ClientCustomField> {
    const [field] = await db
      .insert(clientCustomFields)
      .values(insertField)
      .returning();
    return field;
  }

  async updateClientCustomField(accountId: string, id: string, updateData: Partial<InsertClientCustomField>): Promise<ClientCustomField | undefined> {
    const [field] = await db
      .update(clientCustomFields)
      .set(updateData)
      .where(and(eq(clientCustomFields.id, id), eq(clientCustomFields.accountId, accountId)))
      .returning();
    return field || undefined;
  }

  async deleteClientCustomField(accountId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(clientCustomFields)
      .where(and(eq(clientCustomFields.id, id), eq(clientCustomFields.accountId, accountId)))
      .returning();
    return result.length > 0;
  }

  // Client Custom Field Values
  async getClientCustomFieldValues(accountId: string, clientId: string): Promise<ClientCustomFieldValue[]> {
    return await db
      .select()
      .from(clientCustomFieldValues)
      .where(and(eq(clientCustomFieldValues.accountId, accountId), eq(clientCustomFieldValues.clientId, clientId)));
  }

  async upsertClientCustomFieldValue(insertValue: InsertClientCustomFieldValue): Promise<ClientCustomFieldValue> {
    const [value] = await db
      .insert(clientCustomFieldValues)
      .values(insertValue)
      .onConflictDoUpdate({
        target: [clientCustomFieldValues.clientId, clientCustomFieldValues.fieldId],
        set: { value: insertValue.value, updatedAt: sql`now()` },
      })
      .returning();
    return value;
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
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  // Project Categories
  async getProjectCategoriesByAccountId(accountId: string): Promise<ProjectCategory[]> {
    return await db.select().from(projectCategories).where(eq(projectCategories.accountId, accountId));
  }

  async getProjectCategoryByNormalizedName(accountId: string, name: string): Promise<ProjectCategory | undefined> {
    const [category] = await db
      .select()
      .from(projectCategories)
      .where(
        and(
          eq(projectCategories.accountId, accountId),
          sql`LOWER(${projectCategories.name}) = LOWER(${name})`
        )
      )
      .limit(1);
    return category || undefined;
  }

  async createProjectCategory(insertCategory: InsertProjectCategory): Promise<ProjectCategory> {
    const [category] = await db
      .insert(projectCategories)
      .values(insertCategory)
      .returning();
    return category;
  }

  async updateProjectCategory(id: string, accountId: string, updates: { projectType?: string | null }): Promise<ProjectCategory | undefined> {
    const [category] = await db
      .update(projectCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(projectCategories.id, id),
        eq(projectCategories.accountId, accountId)
      ))
      .returning();
    return category || undefined;
  }

  // Project Payments
  async getPaymentsByProjectId(projectId: string): Promise<ProjectPayment[]> {
    return await db
      .select()
      .from(projectPayments)
      .where(eq(projectPayments.projectId, projectId))
      .orderBy(desc(projectPayments.paymentDate));
  }

  async getPaymentsByAccountId(accountId: string): Promise<ProjectPayment[]> {
    return await db
      .select()
      .from(projectPayments)
      .where(eq(projectPayments.accountId, accountId))
      .orderBy(desc(projectPayments.paymentDate));
  }

  async getPayment(id: string): Promise<ProjectPayment | undefined> {
    const [payment] = await db
      .select()
      .from(projectPayments)
      .where(eq(projectPayments.id, id));
    return payment || undefined;
  }

  async createPayment(paymentData: InsertProjectPayment): Promise<ProjectPayment> {
    const [payment] = await db
      .insert(projectPayments)
      .values(paymentData)
      .returning();
    return payment;
  }

  async updatePayment(id: string, updateData: Partial<InsertProjectPayment>): Promise<ProjectPayment | undefined> {
    const [payment] = await db
      .update(projectPayments)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(projectPayments.id, id))
      .returning();
    return payment || undefined;
  }

  async deletePayment(id: string): Promise<boolean> {
    const result = await db.delete(projectPayments).where(eq(projectPayments.id, id)).returning();
    return result.length > 0;
  }

  // CDC Sessions
  async getCdcSessionsByProjectId(projectId: string): Promise<CdcSession[]> {
    return await db
      .select()
      .from(cdcSessions)
      .where(eq(cdcSessions.projectId, projectId))
      .orderBy(desc(cdcSessions.createdAt));
  }

  async getCdcSession(id: string): Promise<CdcSession | undefined> {
    const [session] = await db
      .select()
      .from(cdcSessions)
      .where(eq(cdcSessions.id, id));
    return session || undefined;
  }

  async getActiveCdcSessionByProjectId(projectId: string): Promise<CdcSession | undefined> {
    const [session] = await db
      .select()
      .from(cdcSessions)
      .where(and(eq(cdcSessions.projectId, projectId), sql`${cdcSessions.status} != 'completed'`))
      .orderBy(desc(cdcSessions.createdAt));
    return session || undefined;
  }

  async createCdcSession(sessionData: InsertCdcSession): Promise<CdcSession> {
    const [session] = await db
      .insert(cdcSessions)
      .values(sessionData)
      .returning();
    return session;
  }

  async updateCdcSession(id: string, updateData: UpdateCdcSession): Promise<CdcSession | undefined> {
    const [session] = await db
      .update(cdcSessions)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(cdcSessions.id, id))
      .returning();
    return session || undefined;
  }

  async deleteCdcSession(id: string): Promise<boolean> {
    const result = await db.delete(cdcSessions).where(eq(cdcSessions.id, id)).returning();
    return result.length > 0;
  }

  async completeCdcSession(id: string, generatedBacklogId?: string, generatedRoadmapId?: string): Promise<CdcSession | undefined> {
    const [session] = await db
      .update(cdcSessions)
      .set({ 
        status: 'completed', 
        completedAt: new Date(),
        generatedBacklogId,
        generatedRoadmapId,
        updatedAt: new Date() 
      })
      .where(eq(cdcSessions.id, id))
      .returning();
    return session || undefined;
  }

  // Project Baselines
  async getBaselinesByProjectId(projectId: string): Promise<ProjectBaseline[]> {
    return await db
      .select()
      .from(projectBaselines)
      .where(eq(projectBaselines.projectId, projectId))
      .orderBy(desc(projectBaselines.createdAt));
  }

  async getLatestBaselineByProjectId(projectId: string): Promise<ProjectBaseline | undefined> {
    const [baseline] = await db
      .select()
      .from(projectBaselines)
      .where(eq(projectBaselines.projectId, projectId))
      .orderBy(desc(projectBaselines.createdAt))
      .limit(1);
    return baseline || undefined;
  }

  async createBaseline(baselineData: InsertProjectBaseline): Promise<ProjectBaseline> {
    const [baseline] = await db
      .insert(projectBaselines)
      .values(baselineData)
      .returning();
    return baseline;
  }

  // Project Scope Items (CDC/Statement of Work)
  async getScopeItemsByProjectId(projectId: string): Promise<ProjectScopeItem[]> {
    return await db
      .select()
      .from(projectScopeItems)
      .where(eq(projectScopeItems.projectId, projectId))
      .orderBy(projectScopeItems.order);
  }

  async getScopeItemsByCdcSessionId(cdcSessionId: string): Promise<ProjectScopeItem[]> {
    return await db
      .select()
      .from(projectScopeItems)
      .where(eq(projectScopeItems.cdcSessionId, cdcSessionId))
      .orderBy(projectScopeItems.order);
  }

  async getScopeItem(id: string): Promise<ProjectScopeItem | undefined> {
    const [item] = await db
      .select()
      .from(projectScopeItems)
      .where(eq(projectScopeItems.id, id));
    return item || undefined;
  }

  async createScopeItem(scopeItemData: InsertProjectScopeItem): Promise<ProjectScopeItem> {
    const [item] = await db
      .insert(projectScopeItems)
      .values(scopeItemData)
      .returning();
    return item;
  }

  async updateScopeItem(id: string, updateData: Partial<InsertProjectScopeItem>): Promise<ProjectScopeItem | undefined> {
    const [item] = await db
      .update(projectScopeItems)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(projectScopeItems.id, id))
      .returning();
    return item || undefined;
  }

  async deleteScopeItem(id: string): Promise<boolean> {
    const result = await db.delete(projectScopeItems).where(eq(projectScopeItems.id, id)).returning();
    return result.length > 0;
  }

  async reorderScopeItems(projectId: string, orders: { id: string; order: number }[]): Promise<void> {
    for (const { id, order } of orders) {
      await db
        .update(projectScopeItems)
        .set({ order, updatedAt: new Date() })
        .where(and(eq(projectScopeItems.id, id), eq(projectScopeItems.projectId, projectId)));
    }
  }

  // Recommendation Actions
  async getRecommendationActionsByAccountId(accountId: string): Promise<RecommendationAction[]> {
    return await db
      .select()
      .from(recommendationActions)
      .where(eq(recommendationActions.accountId, accountId))
      .orderBy(desc(recommendationActions.createdAt));
  }

  async getRecommendationActionsByProjectId(projectId: string): Promise<RecommendationAction[]> {
    return await db
      .select()
      .from(recommendationActions)
      .where(eq(recommendationActions.projectId, projectId))
      .orderBy(desc(recommendationActions.createdAt));
  }

  async getRecommendationAction(accountId: string, projectId: string, recommendationKey: string): Promise<RecommendationAction | undefined> {
    const [action] = await db
      .select()
      .from(recommendationActions)
      .where(and(
        eq(recommendationActions.accountId, accountId),
        eq(recommendationActions.projectId, projectId),
        eq(recommendationActions.recommendationKey, recommendationKey)
      ));
    return action || undefined;
  }

  async upsertRecommendationAction(actionData: InsertRecommendationAction): Promise<RecommendationAction> {
    const [result] = await db
      .insert(recommendationActions)
      .values(actionData)
      .onConflictDoUpdate({
        target: [recommendationActions.accountId, recommendationActions.projectId, recommendationActions.recommendationKey],
        set: {
          action: actionData.action,
          note: actionData.note,
          createdBy: actionData.createdBy,
          createdAt: new Date(),
        }
      })
      .returning();
    return result;
  }

  async deleteRecommendationAction(id: string): Promise<boolean> {
    const result = await db.delete(recommendationActions).where(eq(recommendationActions.id, id)).returning();
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

  async getGlobalTaskColumnsByAccountId(accountId: string): Promise<TaskColumn[]> {
    return await db
      .select()
      .from(taskColumns)
      .where(and(
        eq(taskColumns.accountId, accountId),
        isNull(taskColumns.projectId)
      ))
      .orderBy(taskColumns.order);
  }

  async getTaskColumnsByAccountId(accountId: string): Promise<TaskColumn[]> {
    return await db
      .select()
      .from(taskColumns)
      .where(eq(taskColumns.accountId, accountId))
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
    const result = await db.delete(taskColumns).where(eq(taskColumns.id, id)).returning();
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
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
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
        .where(eq(tasks.id, update.id))
        .execute();
    }
  }

  async bulkUpdateTasksProject(taskIds: string[], projectId: string | null, newColumnId: string): Promise<void> {
    for (const taskId of taskIds) {
      await db
        .update(tasks)
        .set({ 
          projectId,
          columnId: newColumnId,
          updatedAt: new Date() 
        })
        .where(eq(tasks.id, taskId))
        .execute();
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
    const result = await db.delete(notes).where(eq(notes.id, id)).returning();
    return result.length > 0;
  }

  // Note Categories
  async getNoteCategoriesByAccountId(accountId: string): Promise<NoteCategory[]> {
    return await db.select().from(noteCategories).where(eq(noteCategories.accountId, accountId));
  }

  async getNoteCategoryByNormalizedName(accountId: string, name: string): Promise<NoteCategory | undefined> {
    const [category] = await db
      .select()
      .from(noteCategories)
      .where(
        and(
          eq(noteCategories.accountId, accountId),
          sql`LOWER(${noteCategories.name}) = LOWER(${name})`
        )
      )
      .limit(1);
    return category || undefined;
  }

  async createNoteCategory(insertCategory: InsertNoteCategory): Promise<NoteCategory> {
    const [category] = await db
      .insert(noteCategories)
      .values(insertCategory)
      .returning();
    return category;
  }

  async updateNoteCategory(id: string, accountId: string, updates: { name?: string; color?: string | null }): Promise<NoteCategory | undefined> {
    const [category] = await db
      .update(noteCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(noteCategories.id, id),
        eq(noteCategories.accountId, accountId)
      ))
      .returning();
    return category || undefined;
  }

  async deleteNoteCategory(id: string): Promise<boolean> {
    const result = await db.delete(noteCategories).where(eq(noteCategories.id, id)).returning();
    return result.length > 0;
  }

  // Note Links
  async getNoteLinksByNoteId(noteId: string): Promise<NoteLink[]> {
    return await db.select().from(noteLinks).where(eq(noteLinks.noteId, noteId));
  }

  async getNotesByProjectId(projectId: string): Promise<Note[]> {
    const links = await db
      .select()
      .from(noteLinks)
      .where(
        and(
          eq(noteLinks.targetType, "project"),
          eq(noteLinks.targetId, projectId)
        )
      );
    
    if (links.length === 0) return [];
    
    const noteIds = links.map(link => link.noteId);
    return await db
      .select()
      .from(notes)
      .where(inArray(notes.id, noteIds));
  }

  async getNoteLinksByAccountId(accountId: string): Promise<NoteLink[]> {
    const accountNotes = await db
      .select()
      .from(notes)
      .where(eq(notes.accountId, accountId));
    
    if (accountNotes.length === 0) return [];
    
    const noteIds = accountNotes.map(note => note.id);
    return await db
      .select()
      .from(noteLinks)
      .where(inArray(noteLinks.noteId, noteIds));
  }

  async createNoteLink(insertNoteLink: InsertNoteLink): Promise<NoteLink> {
    const [noteLink] = await db.insert(noteLinks).values(insertNoteLink).returning();
    return noteLink;
  }

  async deleteNoteLink(noteId: string, targetType: string, targetId: string): Promise<boolean> {
    const result = await db.delete(noteLinks).where(
      and(
        eq(noteLinks.noteId, noteId),
        eq(noteLinks.targetType, targetType),
        eq(noteLinks.targetId, targetId)
      )
    ).returning();
    return result.length > 0;
  }

  // Document Templates
  async getDocumentTemplate(id: string): Promise<DocumentTemplate | undefined> {
    const [template] = await db.select().from(documentTemplates).where(eq(documentTemplates.id, id));
    return template || undefined;
  }

  async getDocumentTemplates(accountId: string): Promise<DocumentTemplate[]> {
    // Return system templates (isSystem = true) + account-specific templates
    return await db
      .select()
      .from(documentTemplates)
      .where(
        or(
          eq(documentTemplates.isSystem, true),
          eq(documentTemplates.accountId, accountId)
        )
      )
      .orderBy(desc(documentTemplates.isSystem), asc(documentTemplates.name));
  }

  async getDocumentTemplatesByAccountId(accountId: string): Promise<DocumentTemplate[]> {
    // Return only account-specific templates
    return await db
      .select()
      .from(documentTemplates)
      .where(eq(documentTemplates.accountId, accountId));
  }

  async createDocumentTemplate(insertTemplate: InsertDocumentTemplate): Promise<DocumentTemplate> {
    const [template] = await db
      .insert(documentTemplates)
      .values(insertTemplate)
      .returning();
    return template;
  }

  async updateDocumentTemplate(id: string, accountId: string, updateData: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate | undefined> {
    // Defense-in-depth: strip immutable fields to prevent privilege escalation
    const { accountId: _, createdBy: __, id: ___, createdAt: ____, updatedAt: _____, ...safeData } = updateData;
    
    const [template] = await db
      .update(documentTemplates)
      .set(safeData)
      .where(
        and(
          eq(documentTemplates.id, id),
          eq(documentTemplates.accountId, accountId)
        )
      )
      .returning();
    return template || undefined;
  }

  async deleteDocumentTemplate(id: string): Promise<boolean> {
    const result = await db.delete(documentTemplates).where(eq(documentTemplates.id, id)).returning();
    return result.length > 0;
  }

  // Documents
  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async getDocumentsByAccountId(accountId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.accountId, accountId))
      .orderBy(desc(documents.updatedAt));
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument)
      .returning();
    return document;
  }

  async updateDocument(id: string, accountId: string, updateData: Partial<InsertDocument>): Promise<Document | undefined> {
    // Defense-in-depth: strip immutable fields to prevent privilege escalation
    const { accountId: _, createdBy: __, id: ___, createdAt: ____, updatedAt: _____, signedAt: ______, ...safeData } = updateData;
    
    const [document] = await db
      .update(documents)
      .set(safeData)
      .where(
        and(
          eq(documents.id, id),
          eq(documents.accountId, accountId)
        )
      )
      .returning();
    return document || undefined;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id)).returning();
    return result.length > 0;
  }

  async duplicateDocument(id: string): Promise<Document | undefined> {
    const original = await this.getDocument(id);
    if (!original) return undefined;

    // Find the highest copy number
    const existingDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.accountId, original.accountId));
    
    const copyPattern = new RegExp(`^${original.name.replace(/\s*\(copie\d*\)$/, '')}\\s*\\(copie(\\d*)\\)$`);
    let maxCopyNumber = 0;
    
    for (const doc of existingDocs) {
      const match = doc.name.match(copyPattern);
      if (match) {
        const num = match[1] ? parseInt(match[1]) : 1;
        if (num > maxCopyNumber) maxCopyNumber = num;
      }
    }

    const newName = `${original.name.replace(/\s*\(copie\d*\)$/, '')} (copie${maxCopyNumber > 0 ? maxCopyNumber + 1 : ''})`;

    const [duplicate] = await db
      .insert(documents)
      .values({
        accountId: original.accountId,
        templateId: original.templateId,
        createdBy: original.createdBy,
        name: newName,
        content: original.content,
        formData: original.formData,
        plainText: original.plainText,
        status: 'draft',
        version: 1,
      })
      .returning();

    return duplicate;
  }

  // Document Links
  async getDocumentLinksByDocumentId(documentId: string): Promise<DocumentLink[]> {
    return await db.select().from(documentLinks).where(eq(documentLinks.documentId, documentId));
  }

  async getDocumentLinksByAccountId(accountId: string): Promise<DocumentLink[]> {
    // Join with documents to filter by accountId, select all columns from documentLinks
    const links = await db
      .select({
        documentId: documentLinks.documentId,
        targetType: documentLinks.targetType,
        targetId: documentLinks.targetId,
      })
      .from(documentLinks)
      .innerJoin(documents, eq(documentLinks.documentId, documents.id))
      .where(eq(documents.accountId, accountId));
    
    return links;
  }

  async getDocumentsByProjectId(projectId: string): Promise<Document[]> {
    const links = await db
      .select()
      .from(documentLinks)
      .where(
        and(
          eq(documentLinks.targetType, "project"),
          eq(documentLinks.targetId, projectId)
        )
      );
    
    if (links.length === 0) return [];
    
    const documentIds = links.map(link => link.documentId);
    return await db
      .select()
      .from(documents)
      .where(inArray(documents.id, documentIds));
  }

  async createDocumentLink(insertDocumentLink: InsertDocumentLink & { documentId: string }): Promise<DocumentLink> {
    const [documentLink] = await db.insert(documentLinks).values(insertDocumentLink).returning();
    return documentLink;
  }

  async deleteDocumentLink(documentId: string, targetType: string, targetId: string): Promise<boolean> {
    const result = await db.delete(documentLinks).where(
      and(
        eq(documentLinks.documentId, documentId),
        eq(documentLinks.targetType, targetType),
        eq(documentLinks.targetId, targetId)
      )
    ).returning();
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
    const result = await db.delete(folders).where(eq(folders.id, id)).returning();
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
    const result = await db.delete(files).where(eq(files.id, id)).returning();
    return result.length > 0;
  }

  // Activities
  async getActivity(id: string): Promise<Activity | undefined> {
    const [activity] = await db.select().from(activities).where(eq(activities.id, id));
    return activity || undefined;
  }

  async getActivitiesByAccountId(accountId: string, limit: number = 20): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.accountId, accountId))
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  async getActivitiesBySubject(accountId: string, subjectType: string, subjectId: string): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.accountId, accountId),
          eq(activities.subjectType, subjectType),
          eq(activities.subjectId, subjectId)
        )
      )
      .orderBy(desc(activities.occurredAt), desc(activities.createdAt));
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const [activity] = await db
      .insert(activities)
      .values(insertActivity)
      .returning();
    return activity;
  }

  async updateActivity(id: string, updateData: Partial<InsertActivity>): Promise<Activity | undefined> {
    const [activity] = await db
      .update(activities)
      .set(updateData)
      .where(eq(activities.id, id))
      .returning();
    return activity || undefined;
  }

  async deleteActivity(id: string): Promise<boolean> {
    const result = await db.delete(activities).where(eq(activities.id, id)).returning();
    return result.length > 0;
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
    const result = await db.delete(deals).where(eq(deals.id, id)).returning();
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
    const result = await db.delete(products).where(eq(products.id, id)).returning();
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
    const result = await db.delete(features).where(eq(features.id, id)).returning();
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

  async getRoadmapsByProjectId(accountId: string, projectId: string): Promise<Roadmap[]> {
    return await db.select().from(roadmaps).where(
      and(eq(roadmaps.accountId, accountId), eq(roadmaps.projectId, projectId))
    ).orderBy(desc(roadmaps.createdAt));
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
    const result = await db.delete(roadmaps).where(eq(roadmaps.id, id)).returning();
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
    const result = await db.delete(roadmapItems).where(eq(roadmapItems.id, id)).returning();
    return result.length > 0;
  }

  // Roadmap Item Links
  async getRoadmapItemLinksByItemId(roadmapItemId: string): Promise<RoadmapItemLink[]> {
    return await db.select().from(roadmapItemLinks)
      .where(eq(roadmapItemLinks.roadmapItemId, roadmapItemId))
      .orderBy(desc(roadmapItemLinks.createdAt));
  }

  async createRoadmapItemLink(link: InsertRoadmapItemLink): Promise<RoadmapItemLink> {
    const [created] = await db.insert(roadmapItemLinks).values(link).returning();
    return created;
  }

  async deleteRoadmapItemLink(id: string): Promise<boolean> {
    const result = await db.delete(roadmapItemLinks).where(eq(roadmapItemLinks.id, id)).returning();
    return result.length > 0;
  }

  // Roadmap Dependencies
  async getRoadmapDependenciesByItemId(roadmapItemId: string): Promise<RoadmapDependency[]> {
    return await db.select().from(roadmapDependencies)
      .where(eq(roadmapDependencies.roadmapItemId, roadmapItemId))
      .orderBy(desc(roadmapDependencies.createdAt));
  }

  async getRoadmapDependenciesByRoadmapId(roadmapId: string): Promise<RoadmapDependency[]> {
    const items = await db.select().from(roadmapItems).where(eq(roadmapItems.roadmapId, roadmapId));
    if (items.length === 0) return [];
    const itemIds = items.map(i => i.id);
    return await db.select().from(roadmapDependencies)
      .where(inArray(roadmapDependencies.roadmapItemId, itemIds))
      .orderBy(desc(roadmapDependencies.createdAt));
  }

  async createRoadmapDependency(dependency: InsertRoadmapDependency): Promise<RoadmapDependency> {
    const [created] = await db.insert(roadmapDependencies).values(dependency).returning();
    return created;
  }

  async deleteRoadmapDependency(id: string): Promise<boolean> {
    const result = await db.delete(roadmapDependencies).where(eq(roadmapDependencies.id, id)).returning();
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

  // Appointments
  async getAppointment(accountId: string, id: string): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.accountId, accountId)));
    return appointment || undefined;
  }

  async getAppointmentsByAccountId(accountId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]> {
    const conditions = [eq(appointments.accountId, accountId)];
    
    if (startDate) {
      conditions.push(gte(appointments.startDateTime, startDate));
    }
    if (endDate) {
      conditions.push(lte(appointments.startDateTime, endDate));
    }

    return await db.select().from(appointments)
      .where(and(...conditions))
      .orderBy(asc(appointments.startDateTime));
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const [appointment] = await db.insert(appointments).values(insertAppointment).returning();
    return appointment;
  }

  async updateAppointment(accountId: string, id: string, updateData: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const [appointment] = await db.update(appointments)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(appointments.id, id), eq(appointments.accountId, accountId)))
      .returning();
    return appointment || undefined;
  }

  async deleteAppointment(accountId: string, id: string): Promise<boolean> {
    const result = await db.delete(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.accountId, accountId)))
      .returning();
    return result.length > 0;
  }

  async getAppointmentByGoogleEventId(accountId: string, googleEventId: string): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments)
      .where(and(
        eq(appointments.googleEventId, googleEventId),
        eq(appointments.accountId, accountId)
      ));
    return appointment || undefined;
  }

  // Google Calendar Tokens
  async getGoogleTokenByUserId(accountId: string, userId: string): Promise<GoogleCalendarToken | undefined> {
    const [token] = await db.select().from(googleCalendarTokens)
      .where(and(eq(googleCalendarTokens.userId, userId), eq(googleCalendarTokens.accountId, accountId)));
    return token || undefined;
  }

  async upsertGoogleToken(token: InsertGoogleCalendarToken): Promise<GoogleCalendarToken> {
    const [upserted] = await db.insert(googleCalendarTokens)
      .values(token)
      .onConflictDoUpdate({
        target: [googleCalendarTokens.accountId, googleCalendarTokens.userId],
        set: {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          email: token.email,
          expiresAt: token.expiresAt,
          scope: token.scope,
          tokenType: token.tokenType,
          updatedAt: new Date(),
        }
      })
      .returning();
    return upserted;
  }

  async deleteGoogleToken(accountId: string, userId: string): Promise<boolean> {
    const result = await db.delete(googleCalendarTokens)
      .where(and(eq(googleCalendarTokens.userId, userId), eq(googleCalendarTokens.accountId, accountId)))
      .returning();
    return result.length > 0;
  }

  async updateGoogleTokenExpiry(accountId: string, userId: string, accessToken: string, expiresAt: Date): Promise<void> {
    const result = await db.update(googleCalendarTokens)
      .set({ accessToken, expiresAt, updatedAt: new Date() })
      .where(and(eq(googleCalendarTokens.userId, userId), eq(googleCalendarTokens.accountId, accountId)))
      .returning();
    
    if (result.length === 0) {
      throw new Error(`Google token not found for user ${userId} in account ${accountId}`);
    }
  }

  // Time Entries
  async getTimeEntry(accountId: string, id: string): Promise<TimeEntry | undefined> {
    const [entry] = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.accountId, accountId)));
    return entry || undefined;
  }

  async getTimeEntriesByProjectId(accountId: string, projectId: string): Promise<TimeEntry[]> {
    return await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.projectId, projectId), eq(timeEntries.accountId, accountId)))
      .orderBy(desc(timeEntries.startTime));
  }

  async getTimeEntriesByAccountId(accountId: string): Promise<TimeEntry[]> {
    return await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.accountId, accountId))
      .orderBy(desc(timeEntries.startTime));
  }

  async getActiveTimeEntry(accountId: string, userId: string): Promise<TimeEntry | undefined> {
    const [entry] = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.accountId, accountId),
          eq(timeEntries.userId, userId),
          isNull(timeEntries.endTime)
        )
      );
    return entry || undefined;
  }

  async createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
    const [newEntry] = await db
      .insert(timeEntries)
      .values(entry)
      .returning();
    return newEntry;
  }

  async updateTimeEntry(accountId: string, id: string, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const [updated] = await db
      .update(timeEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(and(eq(timeEntries.id, id), eq(timeEntries.accountId, accountId)))
      .returning();
    return updated || undefined;
  }

  async deleteTimeEntry(accountId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.accountId, accountId)))
      .returning();
    return result.length > 0;
  }

  // Mindmaps
  async getMindmap(accountId: string, id: string): Promise<Mindmap | undefined> {
    const [mindmap] = await db
      .select()
      .from(mindmaps)
      .where(and(eq(mindmaps.id, id), eq(mindmaps.accountId, accountId)));
    return mindmap || undefined;
  }

  async getMindmapWithDetails(accountId: string, id: string): Promise<{ mindmap: Mindmap; nodes: MindmapNode[]; edges: MindmapEdge[] } | undefined> {
    const mindmap = await this.getMindmap(accountId, id);
    if (!mindmap) return undefined;

    const nodes = await this.getMindmapNodesByMindmapId(accountId, id);
    const edges = await this.getMindmapEdgesByMindmapId(accountId, id);

    return { mindmap, nodes, edges };
  }

  async getMindmapsByAccountId(accountId: string): Promise<Mindmap[]> {
    return await db
      .select()
      .from(mindmaps)
      .where(eq(mindmaps.accountId, accountId))
      .orderBy(desc(mindmaps.createdAt));
  }

  async getMindmapsByClientId(accountId: string, clientId: string): Promise<Mindmap[]> {
    return await db
      .select()
      .from(mindmaps)
      .where(and(eq(mindmaps.accountId, accountId), eq(mindmaps.clientId, clientId)))
      .orderBy(desc(mindmaps.createdAt));
  }

  async getMindmapsByProjectId(accountId: string, projectId: string): Promise<Mindmap[]> {
    return await db
      .select()
      .from(mindmaps)
      .where(and(eq(mindmaps.accountId, accountId), eq(mindmaps.projectId, projectId)))
      .orderBy(desc(mindmaps.createdAt));
  }

  async createMindmap(mindmap: InsertMindmap): Promise<Mindmap> {
    const [newMindmap] = await db
      .insert(mindmaps)
      .values(mindmap)
      .returning();
    return newMindmap;
  }

  async updateMindmap(accountId: string, id: string, updates: Partial<InsertMindmap>): Promise<Mindmap | undefined> {
    const [updated] = await db
      .update(mindmaps)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(mindmaps.id, id), eq(mindmaps.accountId, accountId)))
      .returning();
    return updated || undefined;
  }

  async deleteMindmap(accountId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(mindmaps)
      .where(and(eq(mindmaps.id, id), eq(mindmaps.accountId, accountId)))
      .returning();
    return result.length > 0;
  }

  // Mindmap Nodes
  async getMindmapNode(accountId: string, id: string): Promise<MindmapNode | undefined> {
    const [node] = await db
      .select()
      .from(mindmapNodes)
      .where(and(eq(mindmapNodes.id, id), eq(mindmapNodes.accountId, accountId)));
    return node || undefined;
  }

  async getMindmapNodesByMindmapId(accountId: string, mindmapId: string): Promise<MindmapNode[]> {
    return await db
      .select()
      .from(mindmapNodes)
      .where(and(eq(mindmapNodes.mindmapId, mindmapId), eq(mindmapNodes.accountId, accountId)))
      .orderBy(asc(mindmapNodes.createdAt));
  }

  async createMindmapNode(node: InsertMindmapNode): Promise<MindmapNode> {
    const [newNode] = await db
      .insert(mindmapNodes)
      .values(node)
      .returning();
    return newNode;
  }

  async updateMindmapNode(accountId: string, id: string, updates: Partial<InsertMindmapNode>): Promise<MindmapNode | undefined> {
    const [updated] = await db
      .update(mindmapNodes)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(mindmapNodes.id, id), eq(mindmapNodes.accountId, accountId)))
      .returning();
    return updated || undefined;
  }

  async deleteMindmapNode(accountId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(mindmapNodes)
      .where(and(eq(mindmapNodes.id, id), eq(mindmapNodes.accountId, accountId)))
      .returning();
    return result.length > 0;
  }

  // Mindmap Edges
  async getMindmapEdge(accountId: string, id: string): Promise<MindmapEdge | undefined> {
    const [edge] = await db
      .select()
      .from(mindmapEdges)
      .where(and(eq(mindmapEdges.id, id), eq(mindmapEdges.accountId, accountId)));
    return edge || undefined;
  }

  async getMindmapEdgesByMindmapId(accountId: string, mindmapId: string): Promise<MindmapEdge[]> {
    return await db
      .select()
      .from(mindmapEdges)
      .where(and(eq(mindmapEdges.mindmapId, mindmapId), eq(mindmapEdges.accountId, accountId)))
      .orderBy(asc(mindmapEdges.createdAt));
  }

  async createMindmapEdge(edge: InsertMindmapEdge): Promise<MindmapEdge> {
    const [newEdge] = await db
      .insert(mindmapEdges)
      .values(edge)
      .returning();
    return newEdge;
  }

  async updateMindmapEdge(accountId: string, id: string, updates: Partial<InsertMindmapEdge>): Promise<MindmapEdge | undefined> {
    const [updated] = await db
      .update(mindmapEdges)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(mindmapEdges.id, id), eq(mindmapEdges.accountId, accountId)))
      .returning();
    return updated || undefined;
  }

  async deleteMindmapEdge(accountId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(mindmapEdges)
      .where(and(eq(mindmapEdges.id, id), eq(mindmapEdges.accountId, accountId)))
      .returning();
    return result.length > 0;
  }

  // Entity Links
  async getEntityLink(accountId: string, id: string): Promise<EntityLink | undefined> {
    const [link] = await db
      .select()
      .from(entityLinks)
      .where(and(eq(entityLinks.id, id), eq(entityLinks.accountId, accountId)));
    return link || undefined;
  }

  async getEntityLinksByAccountId(accountId: string): Promise<EntityLink[]> {
    return await db
      .select()
      .from(entityLinks)
      .where(eq(entityLinks.accountId, accountId))
      .orderBy(desc(entityLinks.createdAt));
  }

  async createEntityLink(link: InsertEntityLink): Promise<EntityLink> {
    const [newLink] = await db
      .insert(entityLinks)
      .values(link)
      .returning();
    return newLink;
  }

  async deleteEntityLink(accountId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(entityLinks)
      .where(and(eq(entityLinks.id, id), eq(entityLinks.accountId, accountId)))
      .returning();
    return result.length > 0;
  }

  // Settings
  async getSetting(scope: string, scopeId: string | null, key: string): Promise<Settings | undefined> {
    const conditions = scopeId 
      ? and(eq(settings.scope, scope), eq(settings.scopeId, scopeId), eq(settings.key, key))
      : and(eq(settings.scope, scope), isNull(settings.scopeId), eq(settings.key, key));
    
    const [setting] = await db.select().from(settings).where(conditions);
    return setting || undefined;
  }

  async getSettingsByScope(scope: string, scopeId: string | null): Promise<Settings[]> {
    const conditions = scopeId 
      ? and(eq(settings.scope, scope), eq(settings.scopeId, scopeId))
      : and(eq(settings.scope, scope), isNull(settings.scopeId));
    
    return await db.select().from(settings).where(conditions);
  }

  async upsertSetting(setting: InsertSettings): Promise<Settings> {
    const existing = await this.getSetting(setting.scope, setting.scopeId || null, setting.key);
    
    if (existing) {
      const [updated] = await db
        .update(settings)
        .set({ 
          value: setting.value, 
          version: existing.version + 1,
          source: setting.source || 'customized',
          updatedAt: new Date(),
          updatedBy: setting.updatedBy
        })
        .where(eq(settings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(settings)
        .values({
          ...setting,
          source: setting.source || 'customized'
        })
        .returning();
      return created;
    }
  }

  async deleteSetting(scope: string, scopeId: string | null, key: string): Promise<boolean> {
    const conditions = scopeId 
      ? and(eq(settings.scope, scope), eq(settings.scopeId, scopeId), eq(settings.key, key))
      : and(eq(settings.scope, scope), isNull(settings.scopeId), eq(settings.key, key));
    
    const result = await db.delete(settings).where(conditions).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
