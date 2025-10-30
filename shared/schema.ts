import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, integer, jsonb, numeric, date, check, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// ACCOUNTS & USERS (Multi-tenant)
// ============================================

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id"), // auth.users.id from Supabase Auth
  plan: text("plan").default("starter"),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey(), // = auth.users.id
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  gender: text("gender"), // 'male', 'female', 'other'
  position: text("position"), // Job title/position
  role: text("role").notNull(), // 'owner', 'collaborator', 'client_viewer'
  avatarUrl: text("avatar_url"),
  profile: jsonb("profile").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdIdx: index().on(table.accountId),
}));

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(), // 'collaborator', 'client_viewer'
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'revoked', 'expired'
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountStatusIdx: index().on(table.accountId, table.status),
}));

// ============================================
// CRM & PIPELINE
// ============================================

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("company"), // 'company', 'person'
  name: text("name").notNull(),
  contacts: jsonb("contacts").notNull().default([]), // [{name,email,phone,role}]
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  status: text("status").notNull().default("prospecting"),
  budget: numeric("budget", { precision: 14, scale: 2 }),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountNameIdx: index().on(table.accountId, table.name),
}));

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  stage: text("stage").default("discovery"),
  budget: numeric("budget", { precision: 14, scale: 2 }),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  meta: jsonb("meta").notNull().default({}),
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountClientIdx: index().on(table.accountId, table.clientId),
}));

// Task Columns (for Kanban board customization)
export const taskColumns = pgTable("task_columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#e5e7eb"), // Pastel color hex code
  order: integer("order").notNull().default(0), // For ordering columns
  isLocked: integer("is_locked").notNull().default(0), // 0 = false, 1 = true (for "À faire" and "Terminé")
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProjectIdx: index().on(table.accountId, table.projectId),
}));

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  columnId: uuid("column_id").references(() => taskColumns.id, { onDelete: "set null" }), // Link to task column
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // 'todo', 'in_progress', 'review', 'done'
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high'
  assignedToId: uuid("assigned_to_id").references(() => appUsers.id, { onDelete: "set null" }), // Single assignee
  assignees: text("assignees").array().notNull().default(sql`ARRAY[]::text[]`), // Array of user IDs (legacy support)
  progress: integer("progress").notNull().default(0), // 0-100
  positionInColumn: integer("position_in_column").notNull().default(0), // For ordering within columns
  order: integer("order").notNull().default(0), // For ordering within columns (legacy)
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProjectColumnIdx: index().on(table.accountId, table.projectId, table.columnId),
}));

export const deals = pgTable("deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  value: numeric("value", { precision: 14, scale: 2 }),
  stage: text("stage").notNull().default("lead"), // 'lead', 'qualified', 'proposal', 'won', 'lost'
  probability: integer("probability"),
  closeDate: date("close_date"),
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountStageIdx: index().on(table.accountId, table.stage),
}));

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  subjectType: text("subject_type").notNull(), // 'client', 'deal', 'project'
  subjectId: uuid("subject_id").notNull(),
  kind: text("kind").notNull(), // 'email', 'call', 'meeting', 'note', 'task', 'file'
  payload: jsonb("payload").notNull().default({}),
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountSubjectIdx: index().on(table.accountId, table.subjectType, table.subjectId),
}));

// ============================================
// NOTES (Notion-like editor) + AI
// ============================================

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  title: text("title").notNull().default(""),
  content: jsonb("content").notNull().default([]), // blocks
  plainText: text("plain_text"), // for FTS
  summary: text("summary"),
  status: text("status").notNull().default("active"), // 'draft', 'active', 'archived'
  visibility: text("visibility").notNull().default("private"), // 'private', 'account', 'client_ro'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountVisibilityIdx: index().on(table.accountId, table.visibility),
}));

export const noteLinks = pgTable("note_links", {
  noteId: uuid("note_id").references(() => notes.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // 'project', 'task', 'meeting', 'file', 'client'
  targetId: uuid("target_id").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.noteId, table.targetType, table.targetId] }),
  targetIdx: index().on(table.targetType, table.targetId),
}));

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountLabelIdx: index().on(table.accountId, table.label),
}));

export const noteTags = pgTable("note_tags", {
  noteId: uuid("note_id").references(() => notes.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").references(() => tags.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.noteId, table.tagId] }),
}));

export const noteVersions = pgTable("note_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  noteId: uuid("note_id").references(() => notes.id, { onDelete: "cascade" }),
  versionNo: integer("version_no").notNull(),
  title: text("title"),
  content: jsonb("content"),
  summary: text("summary"),
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  noteVersionIdx: index().on(table.noteId, table.versionNo),
}));

export const noteShares = pgTable("note_shares", {
  noteId: uuid("note_id").references(() => notes.id, { onDelete: "cascade" }),
  subjectType: text("subject_type").notNull(), // 'user', 'client', 'role'
  subjectId: uuid("subject_id"),
  permission: text("permission").notNull(), // 'read', 'comment', 'edit'
}, (table) => ({
  pk: primaryKey({ columns: [table.noteId, table.subjectType, table.subjectId] }),
}));

export const noteFiles = pgTable("note_files", {
  noteId: uuid("note_id").references(() => notes.id, { onDelete: "cascade" }),
  fileId: uuid("file_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.noteId, table.fileId] }),
}));

// Note: pgvector embeddings will be created manually via SQL
// export const noteEmbeddings = pgTable("note_embeddings", {
//   noteId: uuid("note_id").primaryKey().references(() => notes.id, { onDelete: "cascade" }),
//   embedding: vector("embedding", { dimensions: 1536 }),
// });

// ============================================
// FOLDERS / DOCUMENTATION (File Explorer)
// ============================================

export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references((): any => folders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  scope: text("scope").notNull().default("generic"), // 'client', 'project', 'generic', 'fundraising', 'product', 'tech', 'team'
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountParentIdx: index().on(table.accountId, table.parentId),
}));

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
  kind: text("kind").notNull(), // 'upload', 'link', 'doc_internal', 'note_ref'
  name: text("name").notNull(),
  ext: text("ext"),
  size: integer("size"),
  mime: text("mime"),
  storagePath: text("storage_path"), // Supabase Storage key or URL
  externalUrl: text("external_url"), // for kind='link'
  meta: jsonb("meta").notNull().default({}),
  currentVersionId: uuid("current_version_id"),
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountFolderKindIdx: index().on(table.accountId, table.folderId, table.kind),
}));

export const fileVersions = pgTable("file_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  versionNo: integer("version_no").notNull(),
  storagePath: text("storage_path"),
  externalUrl: text("external_url"),
  checksum: text("checksum"),
  authorId: uuid("author_id").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  fileVersionIdx: index().on(table.fileId, table.versionNo),
}));

export const fileShares = pgTable("file_shares", {
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }),
  subjectType: text("subject_type").notNull(), // 'user', 'client', 'role'
  subjectId: uuid("subject_id"),
  permission: text("permission").notNull(), // 'read', 'comment', 'edit', 'download'
}, (table) => ({
  pk: primaryKey({ columns: [table.fileId, table.subjectType, table.subjectId] }),
}));

// ============================================
// EMAILS (Gmail Integration)
// ============================================

export const mailAccounts = pgTable("mail_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("gmail"), // 'gmail'
  emailAddress: text("email_address").notNull(),
  oauthTokens: jsonb("oauth_tokens").notNull().default({}), // access/refresh + expiry
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProviderEmailIdx: index().on(table.accountId, table.provider, table.emailAddress),
}));

export const emails = pgTable("emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  mailAccountId: uuid("mail_account_id").notNull().references(() => mailAccounts.id, { onDelete: "cascade" }),
  threadId: text("thread_id"),
  messageId: text("message_id"),
  direction: text("direction").notNull(), // 'in', 'out'
  subject: text("subject"),
  snippet: text("snippet"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  headers: jsonb("headers").notNull().default({}),
  from: text("from"),
  to: text("to").array(),
  cc: text("cc").array(),
  bcc: text("bcc").array(),
  date: timestamp("date", { withTimezone: true }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountMailDateIdx: index().on(table.accountId, table.mailAccountId, table.date),
}));

export const emailAttachments = pgTable("email_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  emailId: uuid("email_id").notNull().references(() => emails.id, { onDelete: "cascade" }),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
  filename: text("filename"),
  size: integer("size"),
  mime: text("mime"),
});

// ============================================
// PRODUCT & ROADMAP
// ============================================

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'physical', 'digital'
  name: text("name").notNull(),
  sku: text("sku"),
  cost: numeric("cost", { precision: 14, scale: 2 }),
  meta: jsonb("meta").notNull().default({}),
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountTypeNameIdx: index().on(table.accountId, table.type, table.name),
}));

export const productIntegrations = pgTable("product_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // 'shopify', 'woocommerce'
  creds: jsonb("creds").notNull().default({}), // encrypted on app side
  status: text("status").notNull().default("inactive"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProviderIdx: index().on(table.accountId, table.provider),
}));

export const features = pgTable("features", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("backlog"), // 'backlog', 'planned', 'in_progress', 'done', 'cancelled'
  priority: integer("priority"),
  effort: integer("effort"),
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProjectStatusIdx: index().on(table.accountId, table.projectId, table.status),
}));

export const roadmaps = pgTable("roadmaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  horizon: text("horizon"), // e.g., '2025-Q1'
  strategy: jsonb("strategy").notNull().default({}),
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountHorizonIdx: index().on(table.accountId, table.horizon),
}));

export const roadmapItems = pgTable("roadmap_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  roadmapId: uuid("roadmap_id").notNull().references(() => roadmaps.id, { onDelete: "cascade" }),
  featureId: uuid("feature_id").references(() => features.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: text("status").notNull().default("planned"), // 'planned', 'in_progress', 'done', 'blocked'
  rice: jsonb("rice").notNull().default({}), // {reach,impact,confidence,effort}
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  roadmapStatusIdx: index().on(table.roadmapId, table.status),
}));

// ============================================
// TYPE EXPORTS & ZOD SCHEMAS
// ============================================

// Insert schemas
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAppUserSchema = createInsertSchema(appUsers).omit({ createdAt: true, updatedAt: true });

// Schema for updating user profile (only safe fields that users can modify themselves)
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  position: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskColumnSchema = createInsertSchema(taskColumns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDealSchema = createInsertSchema(deals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFolderSchema = createInsertSchema(folders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMailAccountSchema = createInsertSchema(mailAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailSchema = createInsertSchema(emails).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFeatureSchema = createInsertSchema(features).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRoadmapSchema = createInsertSchema(roadmaps).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRoadmapItemSchema = createInsertSchema(roadmapItems).omit({ id: true, createdAt: true, updatedAt: true });

// Insert types
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertTaskColumn = z.infer<typeof insertTaskColumnSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type InsertMailAccount = z.infer<typeof insertMailAccountSchema>;
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertFeature = z.infer<typeof insertFeatureSchema>;
export type InsertRoadmap = z.infer<typeof insertRoadmapSchema>;
export type InsertRoadmapItem = z.infer<typeof insertRoadmapItemSchema>;

// Select types
export type Account = typeof accounts.$inferSelect;
export type AppUser = typeof appUsers.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type TaskColumn = typeof taskColumns.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type File = typeof files.$inferSelect;
export type MailAccount = typeof mailAccounts.$inferSelect;
export type Email = typeof emails.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Feature = typeof features.$inferSelect;
export type Roadmap = typeof roadmaps.$inferSelect;
export type RoadmapItem = typeof roadmapItems.$inferSelect;
