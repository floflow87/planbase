import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// ACCOUNTS & USERS
// ============================================

export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("member"), // owner, member, guest
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// CRM
// ============================================

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // company, individual
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  position: text("position"),
  sector: text("sector"),
  status: text("status").notNull().default("prospect"), // prospect, in_progress, signed, inactive
  budget: integer("budget"),
  tags: jsonb("tags").default([]),
  customFields: jsonb("custom_fields").default({}),
  lastContactedAt: timestamp("last_contacted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
});

// ============================================
// PROJECTS & TASKS
// ============================================

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"), // active, completed, archived
  progress: integer("progress").default(0), // 0-100
  color: text("color").default("#7C3AED"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // todo, in_progress, review, done
  priority: text("priority").notNull().default("medium"), // low, medium, high
  assignees: jsonb("assignees").default([]), // array of user IDs
  dueDate: timestamp("due_date"),
  progress: integer("progress").default(0), // 0-100
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
});

// ============================================
// NOTES
// ============================================

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: jsonb("content").default({}), // Rich text editor content (blocks)
  category: text("category"), // marketing, product, finance, legal
  tags: jsonb("tags").default([]),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  isShared: boolean("is_shared").default(false),
  attachments: jsonb("attachments").default([]), // array of file references
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
});

// ============================================
// DOCUMENTS
// ============================================

export const folders = pgTable("folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentId: varchar("parent_id").references((): any => folders.id, { onDelete: "cascade" }),
  path: text("path").notNull(), // Full path for easy navigation
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  folderId: varchar("folder_id").references(() => folders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // pdf, image, excel, word, link, note, audio, zip
  url: text("url"), // Supabase Storage URL or external link
  size: integer("size"), // File size in bytes
  category: text("category"), // legal, product, finance, technique
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  version: integer("version").default(1),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
});

// ============================================
// ACTIVITY FEED
// ============================================

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // client_onboarded, document_signed, business_plan_updated, campaign_launched
  description: text("description").notNull(),
  userId: varchar("user_id").references(() => users.id),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// ZOD SCHEMAS & TYPES
// ============================================

// Accounts
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

// Users
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Clients
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Projects
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Tasks
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Notes
export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;

// Folders
export const insertFolderSchema = createInsertSchema(folders).omit({ id: true, createdAt: true });
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof folders.$inferSelect;

// Documents
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Activities
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
