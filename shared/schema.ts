import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, integer, jsonb, numeric, date, check, index, uniqueIndex, primaryKey, boolean, real } from "drizzle-orm/pg-core";
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
  siret: text("siret"), // SIRET number for French companies
  settings: jsonb("settings").notNull().default({}), // Contains googleClientId and googleClientSecret due to pooler cache issue
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
  phone: text("phone"), // Telephone number
  company: text("company"), // Company/organization name
  role: text("role").notNull(), // 'owner', 'collaborator', 'client_viewer'
  avatarUrl: text("avatar_url"),
  profile: jsonb("profile").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdIdx: index().on(table.accountId),
}));

export const userOnboarding = pgTable("user_onboarding", {
  userId: uuid("user_id").primaryKey().references(() => appUsers.id, { onDelete: "cascade" }),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastStep: text("last_step"),
  skipped: boolean("skipped").notNull().default(false),
  version: text("version").notNull().default("v1"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserOnboardingSchema = createInsertSchema(userOnboarding).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUserOnboarding = z.infer<typeof insertUserOnboardingSchema>;
export type UserOnboarding = typeof userOnboarding.$inferSelect;

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
// RBAC (Role-Based Access Control)
// ============================================

export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // 'admin', 'member', 'guest'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgUserIdx: uniqueIndex().on(table.organizationId, table.userId),
}));

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => organizationMembers.id, { onDelete: "cascade" }),
  module: text("module").notNull(), // 'crm', 'projects', 'product', 'roadmap', 'tasks', 'notes', 'documents', 'profitability'
  action: text("action").notNull(), // 'read', 'create', 'update', 'delete'
  allowed: boolean("allowed").notNull().default(false),
  scope: text("scope").notNull().default("module"), // 'module', 'subview'
  subviewKey: text("subview_key"), // e.g., 'crm.clients', 'crm.opportunities', 'crm.kpis'
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  memberModuleActionIdx: index().on(table.memberId, table.module, table.action),
  orgMemberIdx: index().on(table.organizationId, table.memberId),
}));

export const moduleViews = pgTable("module_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => organizationMembers.id, { onDelete: "cascade" }),
  module: text("module").notNull(), // 'crm', 'projects', 'product', 'roadmap', 'tasks', 'notes', 'documents', 'profitability'
  layout: jsonb("layout"), // Custom layout configuration
  subviewsEnabled: jsonb("subviews_enabled"), // { 'crm.clients': true, 'crm.opportunities': false }
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  memberModuleIdx: uniqueIndex().on(table.memberId, table.module),
}));

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers).omit({
  id: true,
  createdAt: true,
});
export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;
export type OrganizationMember = typeof organizationMembers.$inferSelect;

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  updatedAt: true,
});
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;

export const insertModuleViewSchema = createInsertSchema(moduleViews).omit({
  id: true,
  updatedAt: true,
});
export type InsertModuleView = z.infer<typeof insertModuleViewSchema>;
export type ModuleView = typeof moduleViews.$inferSelect;

// RBAC constants
export const RBAC_ROLES = ['admin', 'member', 'guest'] as const;
export type RbacRole = typeof RBAC_ROLES[number];

export const RBAC_MODULES = ['crm', 'projects', 'product', 'roadmap', 'tasks', 'notes', 'documents', 'profitability'] as const;
export type RbacModule = typeof RBAC_MODULES[number];

export const RBAC_ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export type RbacAction = typeof RBAC_ACTIONS[number];

export const CRM_SUBVIEWS = ['crm.clients', 'crm.opportunities', 'crm.kpis'] as const;
export type CrmSubview = typeof CRM_SUBVIEWS[number];

export const PRODUCT_SUBVIEWS = ['product.backlog', 'product.epics', 'product.stats', 'product.retrospective', 'product.recipe'] as const;
export type ProductSubview = typeof PRODUCT_SUBVIEWS[number];

export const PROFITABILITY_SUBVIEWS = ['profitability.overview', 'profitability.byProject', 'profitability.simulations', 'profitability.resources'] as const;
export type ProfitabilitySubview = typeof PROFITABILITY_SUBVIEWS[number];

export const DOCUMENTS_SUBVIEWS = ['documents.list', 'documents.upload', 'documents.integrations'] as const;
export type DocumentsSubview = typeof DOCUMENTS_SUBVIEWS[number];

export const ROADMAP_SUBVIEWS = ['roadmap.gantt', 'roadmap.output', 'roadmap.okr', 'roadmap.tree'] as const;
export type RoadmapSubview = typeof ROADMAP_SUBVIEWS[number];

export const PROJECTS_SUBVIEWS = ['projects.list', 'projects.details', 'projects.scope', 'projects.billing'] as const;
export type ProjectsSubview = typeof PROJECTS_SUBVIEWS[number];

export const ALL_SUBVIEWS = [...CRM_SUBVIEWS, ...PRODUCT_SUBVIEWS, ...PROFITABILITY_SUBVIEWS, ...DOCUMENTS_SUBVIEWS, ...ROADMAP_SUBVIEWS, ...PROJECTS_SUBVIEWS] as const;
export type Subview = typeof ALL_SUBVIEWS[number];

export const MODULE_SUBVIEWS: Record<RbacModule, readonly string[]> = {
  crm: CRM_SUBVIEWS,
  product: PRODUCT_SUBVIEWS,
  profitability: PROFITABILITY_SUBVIEWS,
  documents: DOCUMENTS_SUBVIEWS,
  roadmap: ROADMAP_SUBVIEWS,
  projects: PROJECTS_SUBVIEWS,
  tasks: [], // No subviews for tasks
  notes: [], // No subviews for notes
};

// ============================================
// CRM & PIPELINE
// ============================================

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("company"), // 'company', 'person' - MUST match Supabase CHECK constraint
  name: text("name").notNull(),
  contacts: jsonb("contacts").notNull().default([]), // Legacy field - [{name,email,phone,role}]
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  status: text("status").notNull().default("prospecting"),
  budget: numeric("budget", { precision: 14, scale: 2 }),
  notes: text("notes"),
  // Personal/company details
  civility: text("civility"), // M, Mme, Mlle, Dr, etc.
  firstName: text("first_name"), // For person type
  company: text("company"), // Company name for person type, or full company name for company type
  address: text("address"),
  postalCode: text("postal_code"),
  city: text("city"),
  country: text("country"),
  nationality: text("nationality"),
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountNameIdx: index().on(table.accountId, table.name),
}));

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  civility: text("civility"), // 'M', 'Mme', 'Mlle', 'Dr', etc.
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name").notNull(), // For display
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  position: text("position"), // Job title/role
  isPrimary: integer("is_primary").notNull().default(0), // 0 = false, 1 = true (main contact)
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountClientIdx: index().on(table.accountId, table.clientId),
  clientPrimaryIdx: index().on(table.clientId, table.isPrimary),
}));

// Custom tabs for client pages
export const clientCustomTabs = pgTable("client_custom_tabs", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon"), // Lucide icon name
  order: integer("order").notNull().default(0),
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdIdx: index().on(table.accountId),
}));

// Custom fields within tabs
export const clientCustomFields = pgTable("client_custom_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  tabId: uuid("tab_id").notNull().references(() => clientCustomTabs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  fieldType: text("field_type").notNull(), // 'text', 'date', 'number', 'link', 'boolean', 'checkbox', 'multiselect'
  options: jsonb("options").notNull().default([]), // For multiselect: [{value, label, color?}]
  required: integer("required").notNull().default(0), // 0 = false, 1 = true
  order: integer("order").notNull().default(0),
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountTabIdx: index().on(table.accountId, table.tabId),
}));

// Values for custom fields per client
export const clientCustomFieldValues = pgTable("client_custom_field_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  fieldId: uuid("field_id").notNull().references(() => clientCustomFields.id, { onDelete: "cascade" }),
  value: jsonb("value").notNull().default(null), // Stored as JSON to support all types
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountClientFieldIdx: index().on(table.accountId, table.clientId, table.fieldId),
  uniqueClientField: uniqueIndex().on(table.clientId, table.fieldId), // One value per field per client
}));

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  stage: text("stage").default("prospection"), // 'prospection', 'en_cours', 'termine'
  priority: text("priority").default("normal"), // 'low', 'normal', 'high', 'strategic' - Priorité/importance du projet
  businessType: text("business_type").default("client"), // 'client' (projet client facturable) or 'internal' (projet interne non facturable)
  category: text("category"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  budget: numeric("budget", { precision: 14, scale: 2 }),
  signatureDate: date("signature_date"), // Date de signature pour calcul CA mensuel
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  meta: jsonb("meta").notNull().default({}),
  // Billing/Time tracking fields
  billingType: text("billing_type"), // 'fixed_price' (forfait) or 'time_based' (temps passé)
  billingUnit: text("billing_unit"), // 'hour' or 'day' (if billingType is 'time_based')
  billingRate: numeric("billing_rate", { precision: 14, scale: 2 }), // Hourly/daily rate
  totalBilled: numeric("total_billed", { precision: 14, scale: 2 }), // Total amount billed to client
  numberOfDays: numeric("number_of_days", { precision: 10, scale: 2 }), // Number of days for TJM calculation
  internalDailyCost: numeric("internal_daily_cost", { precision: 14, scale: 2 }), // Internal daily cost for profitability calculation
  targetMarginPercent: numeric("target_margin_percent", { precision: 5, scale: 2 }), // Target margin percentage (default 30%)
  // Billing status fields
  billingStatus: text("billing_status"), // 'devis_envoye', 'devis_accepte', 'bon_commande', 'facture', 'paye', 'partiel', 'annule', 'retard'
  billingDueDate: date("billing_due_date"), // Used when billingStatus is 'retard' to show late payment date
  // Intelligent onboarding fields (auto-enriched at creation)
  projectTypeInferred: text("project_type_inferred"), // 'dev_saas', 'design', 'conseil', 'formation', 'integration', 'autre'
  billingModeSuggested: text("billing_mode_suggested"), // 'forfait', 'regie', 'mixte'
  pilotingStrategy: text("piloting_strategy").default("equilibre"), // 'temps_critique', 'marge_critique', 'equilibre'
  expectedPhases: jsonb("expected_phases").$type<string[]>(), // Standard phases for this project type
  expectedScopeTypes: jsonb("expected_scope_types").$type<string[]>(), // Expected CDC line types
  onboardingSuggestionsShown: integer("onboarding_suggestions_shown").default(0), // 0 = not shown, 1 = shown
  onboardingSuggestionsDismissed: integer("onboarding_suggestions_dismissed").default(0), // 0 = not dismissed, 1 = dismissed
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountClientIdx: index().on(table.accountId, table.clientId),
}));

// Project Categories (for autocomplete suggestions)
export const projectCategories = pgTable("project_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  projectType: text("project_type"), // Links to resource templates: 'dev_saas', 'design', 'conseil', 'ecommerce', 'site_vitrine', 'integration', 'formation', 'cpo', 'autre'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountNameIdx: uniqueIndex().on(table.accountId, table.name), // Ensure unique category names per account
}));

// Project Payments (for tracking partial and total payments)
export const projectPayments = pgTable("project_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  description: text("description"), // Optional note about the payment
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProjectIdx: index().on(table.accountId, table.projectId),
}));

// CDC Sessions (Cahier des Charges structured sessions)
export const cdcSessions = pgTable("cdc_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("draft"), // 'draft', 'in_progress', 'completed'
  currentStep: integer("current_step").notNull().default(1), // 1-4 steps
  completedAt: timestamp("completed_at", { withTimezone: true }),
  generatedBacklogId: uuid("generated_backlog_id"), // Reference to generated backlog
  generatedRoadmapId: uuid("generated_roadmap_id"), // Reference to generated roadmap
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProjectIdx: index().on(table.accountId, table.projectId),
}));

// Project Baselines (frozen reference point after CDC validation)
export const projectBaselines = pgTable("project_baselines", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  cdcSessionId: uuid("cdc_session_id").references(() => cdcSessions.id, { onDelete: "set null" }),
  // Total estimates
  totalEstimatedDays: numeric("total_estimated_days", { precision: 10, scale: 2 }).notNull(),
  billableEstimatedDays: numeric("billable_estimated_days", { precision: 10, scale: 2 }).notNull(),
  nonBillableEstimatedDays: numeric("non_billable_estimated_days", { precision: 10, scale: 2 }).notNull(),
  // Breakdown by type (stored as JSONB for flexibility)
  byType: jsonb("by_type").notNull().default({}), // { functional: 5, technical: 3, design: 2, gestion: 1, autre: 0 }
  // Breakdown by phase
  byPhase: jsonb("by_phase").notNull().default({}), // { T1: 3, T2: 4, T3: 2, T4: 1, LT: 1 }
  // Snapshot of scope items at creation time
  scopeItemsSnapshot: jsonb("scope_items_snapshot").notNull().default([]),
  // Metadata
  version: integer("version").notNull().default(1), // For future versioning
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProjectIdx: index().on(table.accountId, table.projectId),
  projectIdx: index().on(table.projectId),
}));

// Project Scope Items (CDC - Cahier des Charges / Statement of Work items for quoting)
export const projectScopeItems = pgTable("project_scope_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  cdcSessionId: uuid("cdc_session_id").references(() => cdcSessions.id, { onDelete: "set null" }), // Link to CDC session
  label: text("label").notNull(),
  description: text("description"), // Description optionnelle de la rubrique
  scopeType: text("scope_type").notNull().default("functional"), // 'functional', 'technical', 'design', 'gestion', 'autre'
  isBillable: integer("is_billable").notNull().default(1), // 0 = non facturable, 1 = facturable
  estimatedDays: numeric("estimated_days", { precision: 10, scale: 2 }), // Temps estimé en jours (nullable now)
  phase: text("phase"), // 'T1', 'T2', 'T3', 'T4', 'LT' - temporal phase
  isOptional: integer("is_optional").notNull().default(0), // 0 = obligatoire, 1 = optionnel
  order: integer("order").notNull().default(0), // Pour le tri
  // Generated entity tracking
  generatedEpicId: uuid("generated_epic_id"), // If generated as an Epic
  generatedUserStoryId: uuid("generated_user_story_id"), // If generated as a User Story
  generatedRoadmapItemId: uuid("generated_roadmap_item_id"), // If generated as a Roadmap item
  // Completion tracking - when set, the scope item is "closed" and projections stop
  completedAt: timestamp("completed_at", { withTimezone: true }), // null = open, timestamp = completed
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProjectIdx: index().on(table.accountId, table.projectId),
  cdcSessionIdx: index().on(table.cdcSessionId),
}));

// Recommendation Actions (for tracking "treated" or "ignored" recommendations)
export const recommendationActions = pgTable("recommendation_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  recommendationKey: text("recommendation_key").notNull(), // Recommendation ID (e.g. "rec-1", "rec-2")
  action: text("action").notNull(), // 'treated' or 'ignored'
  note: text("note"), // Optional note explaining the action
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }), // Nullable to allow ON DELETE SET NULL
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProjectKeyIdx: uniqueIndex().on(table.accountId, table.projectId, table.recommendationKey),
}));

// Task Columns (for Kanban board customization)
export const taskColumns = pgTable("task_columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }), // Now nullable - allows global columns for tasks without a project
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
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }), // Direct link to client (optional)
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }), // Now nullable - tasks can exist without a project
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
  dueDate: date("due_date"), // Date-only field (YYYY-MM-DD) to avoid timezone issues
  effort: integer("effort"), // 1-5 stars rating for task effort/complexity
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProjectColumnIdx: index().on(table.accountId, table.projectId, table.columnId),
  accountClientIdx: index().on(table.accountId, table.clientId),
}));

// Time Tracking Entries
export const timeEntries = pgTable("time_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  scopeItemId: uuid("scope_item_id").references(() => projectScopeItems.id, { onDelete: "set null" }), // Optional: link to CDC/scope item
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }), // Optional: link to task/ticket
  sprintId: uuid("sprint_id"), // Optional: link to sprint (FK added after sprints table creation)
  description: text("description"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  pausedAt: timestamp("paused_at", { withTimezone: true }), // Timestamp when the timer was paused
  duration: integer("duration"), // Duration in seconds
  isBillable: integer("is_billable").notNull().default(1), // 0 = false, 1 = true
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProjectIdx: index().on(table.accountId, table.projectId),
  accountUserIdx: index().on(table.accountId, table.userId),
  sprintIdx: index().on(table.sprintId),
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
  subjectType: text("subject_type", { enum: ['client', 'deal', 'project', 'note', 'task', 'document', 'backlog', 'epic', 'user_story', 'backlog_task'] }).notNull(),
  subjectId: uuid("subject_id").notNull(),
  kind: text("kind", { enum: ['created', 'updated', 'deleted', 'email', 'call', 'meeting', 'note', 'task', 'file', 'time_tracked', 'custom'] }).notNull(),
  description: text("description"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }),
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
  isFavorite: boolean("is_favorite").notNull().default(false), // favorites appear at top
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountVisibilityIdx: index().on(table.accountId, table.visibility),
}));

export const noteLinks = pgTable("note_links", {
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
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
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
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
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  subjectType: text("subject_type").notNull(), // 'user', 'client', 'role'
  subjectId: uuid("subject_id").notNull(),
  permission: text("permission").notNull(), // 'read', 'comment', 'edit'
}, (table) => ({
  pk: primaryKey({ columns: [table.noteId, table.subjectType, table.subjectId] }),
}));

export const noteFiles = pgTable("note_files", {
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
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
// DOCUMENTS (Templates & Formal Documents)
// ============================================

export const documentTemplates = pgTable("document_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }), // null = system template
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("legal"), // 'legal', 'contract', 'creative', 'business'
  icon: text("icon").default("FileText"), // lucide-react icon name
  isSystem: text("is_system").notNull().default("false"), // 'false' = user template, 'true' = system template (stored as boolean in DB)
  formSchema: jsonb("form_schema").notNull().default([]), // Array of form field definitions
  contentTemplate: text("content_template").notNull(), // Template with {{placeholders}}
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountCategoryIdx: index().on(table.accountId, table.category),
}));

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  templateId: uuid("template_id").references(() => documentTemplates.id, { onDelete: "set null" }), // null if created manually
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  formData: jsonb("form_data"),
  plainText: text("plain_text"), // for FTS
  status: text("status").notNull().default("draft"), // 'draft', 'published', 'archived'
  version: integer("version").notNull().default(1),
  sourceType: text("source_type").notNull().default("template"), // 'template', 'freeform', 'pdf_import'
  pdfStoragePath: text("pdf_storage_path"), // path in Supabase Storage bucket for generated/imported PDF
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountStatusIdx: index().on(table.accountId, table.status),
  templateIdx: index().on(table.templateId),
}));

export const documentLinks = pgTable("document_links", {
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // 'project', 'client', 'deal'
  targetId: uuid("target_id").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.documentId, table.targetType, table.targetId] }),
  targetIdx: index().on(table.targetType, table.targetId),
}));

export const documentShares = pgTable("document_shares", {
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  subjectType: text("subject_type").notNull(), // 'user', 'client', 'role'
  subjectId: uuid("subject_id").notNull(),
  permission: text("permission").notNull(), // 'read', 'comment', 'edit'
}, (table) => ({
  pk: primaryKey({ columns: [table.documentId, table.subjectType, table.subjectId] }),
}));

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
  fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  subjectType: text("subject_type").notNull(), // 'user', 'client', 'role'
  subjectId: uuid("subject_id").notNull(),
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
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  horizon: text("horizon"), // e.g., '2025-Q1'
  strategy: jsonb("strategy").notNull().default({}),
  viewDefaults: jsonb("view_defaults").notNull().default({}), // {activeView, ganttZoom, filters}
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountHorizonIdx: index().on(table.accountId, table.horizon),
  projectIdx: index().on(table.projectId),
}));

export const roadmapItems = pgTable("roadmap_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  roadmapId: uuid("roadmap_id").notNull().references(() => roadmaps.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  featureId: uuid("feature_id").references(() => features.id, { onDelete: "set null" }),
  parentId: uuid("parent_id"), // Reference to parent item for Epic/Feature hierarchy (self-reference added via FK in migration)
  epicId: uuid("epic_id").references(() => epics.id, { onDelete: "set null" }), // Link to backlog Epic
  title: text("title").notNull(),
  type: text("type").notNull().default("deliverable"), // 'deliverable', 'milestone', 'initiative', 'epic_group', 'free_block'
  isGroup: boolean("is_group").notNull().default(false), // True for Epic/rubrique groups
  releaseTag: text("release_tag"), // 'MVP', 'V1', 'V2', 'Hotfix', 'Soon', etc.
  phase: text("phase"), // 'T1', 'T2', 'T3', 'LT' - Calculated from dates relative to project startDate
  startDate: date("start_date"),
  endDate: date("end_date"),
  targetDate: date("target_date"), // For milestones - target completion date
  status: text("status").notNull().default("planned"), // 'planned', 'in_progress', 'done', 'blocked'
  priority: text("priority").notNull().default("normal"), // 'low', 'normal', 'high', 'strategic'
  description: text("description"),
  progressMode: text("progress_mode").notNull().default("manual"), // 'manual', 'linked_auto', 'children_auto'
  progress: integer("progress").notNull().default(0), // 0-100
  orderIndex: integer("order_index").notNull().default(0),
  color: text("color"), // Custom color for the item bar
  rice: jsonb("rice").notNull().default({}), // {reach,impact,confidence,effort}
  sourceType: text("source_type"), // 'manual', 'cdc' - Source of the item
  sourceId: uuid("source_id"), // Reference to CDC section if sourceType='cdc'
  ownerUserId: uuid("owner_user_id").references(() => appUsers.id, { onDelete: "set null" }), // Owner/responsible user
  
  // ========== Milestone-specific fields (when type = 'milestone') ==========
  // Type of milestone: 'DELIVERY', 'VALIDATION', 'DECISION', 'GO_NO_GO', 'DEMO', 'RELEASE', 'PHASE_END'
  milestoneType: text("milestone_type"),
  // Is this a critical milestone that blocks project progression?
  isCritical: boolean("is_critical").default(false),
  // Rule for automatic completion: 'MANUAL', 'ALL_LINKED_EPICS_DONE', 'PERCENT_THRESHOLD'
  completionRule: text("completion_rule").default("MANUAL"),
  // Threshold percentage for PERCENT_THRESHOLD completion rule (e.g., 80)
  completionThreshold: integer("completion_threshold"),
  // Validation requirement: 'NONE', 'CLIENT', 'INTERNAL', 'EXTERNAL'
  validationRequired: text("validation_required").default("NONE"),
  // Validated status for milestones (replaces 'done' for validation milestones)
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  validatedBy: uuid("validated_by").references(() => appUsers.id, { onDelete: "set null" }),
  // Impact estimate for milestone slip: { timeImpactDays, marginImpactPercent, riskLevel }
  impactEstimate: jsonb("impact_estimate").default({}),
  // Calculated milestone status: 'upcoming', 'achievable', 'at_risk', 'overdue', 'validated'
  milestoneStatus: text("milestone_status"),
  
  // ========== Future OKR integration (prepared, not active) ==========
  objectiveId: uuid("objective_id"), // Link to future Objective
  keyResultId: uuid("key_result_id"), // Link to future Key Result
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  roadmapStatusIdx: index().on(table.roadmapId, table.status),
  projectIdx: index().on(table.projectId),
  parentIdx: index().on(table.parentId),
  releaseTagIdx: index().on(table.roadmapId, table.releaseTag),
  phaseIdx: index().on(table.roadmapId, table.phase),
  milestoneTypeIdx: index().on(table.roadmapId, table.milestoneType),
  isCriticalIdx: index().on(table.roadmapId, table.isCritical),
}));

export const roadmapItemLinks = pgTable("roadmap_item_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  roadmapItemId: uuid("roadmap_item_id").notNull().references(() => roadmapItems.id, { onDelete: "cascade" }),
  linkedType: text("linked_type").notNull(), // 'task', 'ticket', 'epic', 'cdc_section', 'free_reference'
  linkedId: uuid("linked_id"), // Reference to the linked entity
  linkedTitle: text("linked_title"), // For free_reference type or display purposes
  weight: integer("weight").notNull().default(1), // Weight for progress calculation
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  roadmapItemIdx: index().on(table.roadmapItemId),
  linkedIdx: index().on(table.linkedType, table.linkedId),
}));

export const roadmapDependencies = pgTable("roadmap_dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  roadmapItemId: uuid("roadmap_item_id").notNull().references(() => roadmapItems.id, { onDelete: "cascade" }),
  dependsOnRoadmapItemId: uuid("depends_on_roadmap_item_id").notNull().references(() => roadmapItems.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("finish_to_start"), // 'finish_to_start' (MVP)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  roadmapItemIdx: index().on(table.roadmapItemId),
  dependsOnIdx: index().on(table.dependsOnRoadmapItemId),
}));

// ============================================
// OKR (Objectives & Key Results)
// ============================================

export const okrObjectives = pgTable("okr_objectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("business"), // 'business', 'product', 'marketing'
  targetPhase: text("target_phase"), // 'T1', 'T2', 'T3', 'LT' (Long Term)
  status: text("status").notNull().default("on_track"), // Calculated: 'at_risk', 'on_track', 'achieved', 'critical'
  progress: real("progress").default(0), // 0-100 calculated from KRs
  estimatedMarginImpact: real("estimated_margin_impact"), // Financial impact in percentage
  position: integer("position").notNull().default(0),
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountProjectIdx: index().on(table.accountId, table.projectId),
  projectIdx: index().on(table.projectId),
}));

export const okrKeyResults = pgTable("okr_key_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  objectiveId: uuid("objective_id").notNull().references(() => okrObjectives.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  metricType: text("metric_type").notNull().default("delivery"), // 'delivery', 'time', 'margin', 'adoption', 'volume'
  targetValue: real("target_value").notNull(),
  currentValue: real("current_value").default(0),
  unit: text("unit"), // e.g., '%', 'features', 'days', '€'
  status: text("status").notNull().default("on_track"), // 'ok', 'critical', 'late', 'achieved'
  weight: real("weight").default(1), // Weight for objective progress calculation
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  objectiveIdx: index().on(table.objectiveId),
  accountIdx: index().on(table.accountId),
}));

// Links KRs to existing entities (epics, roadmap items, sprints, tasks)
export const okrLinks = pgTable("okr_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  keyResultId: uuid("key_result_id").notNull().references(() => okrKeyResults.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // 'epic', 'roadmap_item', 'sprint', 'task'
  entityId: uuid("entity_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  keyResultIdx: index().on(table.keyResultId),
  entityIdx: index().on(table.entityType, table.entityId),
}));

// ============================================
// CLIENT COMMENTS
// ============================================

export const clientComments = pgTable("client_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountClientIdx: index().on(table.accountId, table.clientId),
}));

// ============================================
// CALENDAR & APPOINTMENTS
// ============================================

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  title: text("title").notNull(), // Motif du rendez-vous
  startDateTime: timestamp("start_date_time", { withTimezone: true }).notNull(),
  endDateTime: timestamp("end_date_time", { withTimezone: true }),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  notes: text("notes"), // Remarques
  googleEventId: text("google_event_id"), // ID de l'événement Google Calendar (pour sync bidirectionnel)
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }), // Nullable for FK compatibility
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountStartIdx: index().on(table.accountId, table.startDateTime),
  uniqueGoogleEventIdx: uniqueIndex().on(table.accountId, table.googleEventId), // Prevent duplicate Google events per account
}));

export const googleCalendarTokens = pgTable("google_calendar_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull(), // Google account email
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenType: text("token_type").notNull().default("Bearer"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scope: text("scope").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueAccountUserIdx: uniqueIndex().on(table.accountId, table.userId), // One Google Calendar per user per account
}));

// ============================================
// MINDMAPS
// ============================================

export const mindmaps = pgTable("mindmaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  kind: text("kind").notNull().default("generic"), // 'generic', 'storyboard', 'user_flow', 'architecture', 'sitemap', 'ideas'
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  layoutConfig: jsonb("layout_config").notNull().default({}), // UI config for showing/hiding fields based on view
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  clientIdx: index().on(table.accountId, table.clientId),
  projectIdx: index().on(table.accountId, table.projectId),
}));

export const mindmapNodes = pgTable("mindmap_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  mindmapId: uuid("mindmap_id").notNull().references(() => mindmaps.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("idea"), // 'idea', 'note', 'project', 'document', 'task', 'client', 'generic'
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  linkedEntityType: text("linked_entity_type"), // 'note', 'project', 'document', 'task', 'client'
  linkedEntityId: uuid("linked_entity_id"),
  x: numeric("x", { precision: 10, scale: 2 }).notNull().default("0"),
  y: numeric("y", { precision: 10, scale: 2 }).notNull().default("0"),
  style: jsonb("style").notNull().default({}), // Custom styling per node
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  mindmapIdx: index().on(table.mindmapId),
  accountIdx: index().on(table.accountId),
  linkedEntityIdx: index().on(table.linkedEntityType, table.linkedEntityId),
}));

export const mindmapEdges = pgTable("mindmap_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  mindmapId: uuid("mindmap_id").notNull().references(() => mindmaps.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  sourceNodeId: uuid("source_node_id").notNull().references(() => mindmapNodes.id, { onDelete: "cascade" }),
  targetNodeId: uuid("target_node_id").notNull().references(() => mindmapNodes.id, { onDelete: "cascade" }),
  isDraft: boolean("is_draft").notNull().default(true), // Draft links are visual only, not connected to business logic
  linkedEntityLinkId: uuid("linked_entity_link_id"), // Reference to entity_links table when not draft
  label: text("label"),
  style: jsonb("style").notNull().default({}), // Custom styling per edge
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  mindmapIdx: index().on(table.mindmapId),
  accountIdx: index().on(table.accountId),
  sourceIdx: index().on(table.sourceNodeId),
  targetIdx: index().on(table.targetNodeId),
}));

export const entityLinks = pgTable("entity_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(), // 'note', 'project', 'document', 'task', 'client'
  sourceId: uuid("source_id").notNull(),
  targetType: text("target_type").notNull(), // 'note', 'project', 'document', 'task', 'client'
  targetId: uuid("target_id").notNull(),
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  sourceIdx: index().on(table.sourceType, table.sourceId),
  targetIdx: index().on(table.targetType, table.targetId),
}));

// ============================================
// BACKLOG MODULE (Jira-like)
// ============================================

// Backlog modes
export const backlogModeOptions = [
  { value: "kanban", label: "Kanban", description: "Workflow + colonnes personnalisables" },
  { value: "scrum", label: "Scrum", description: "Backlog + Sprints + Rétrospectives" },
] as const;

export type BacklogMode = typeof backlogModeOptions[number]["value"];

// Backlog item states
export const backlogItemStateOptions = [
  { value: "a_faire", label: "À faire", color: "#E5E7EB" },
  { value: "en_cours", label: "En cours", color: "#93C5FD" },
  { value: "testing", label: "Testing", color: "#22D3EE" },
  { value: "to_fix", label: "To fix", color: "#FB923C" },
  { value: "review", label: "Review", color: "#C4B5FD" },
  { value: "termine", label: "Terminé", color: "#86EFAC" },
] as const;

export type BacklogItemState = typeof backlogItemStateOptions[number]["value"];

// Complexity (T-shirt size)
export const complexityOptions = [
  { value: "XS", label: "XS", points: 1 },
  { value: "S", label: "S", points: 2 },
  { value: "M", label: "M", points: 3 },
  { value: "L", label: "L", points: 5 },
  { value: "XL", label: "XL", points: 8 },
  { value: "XXL", label: "XXL", points: 13 },
] as const;

export type Complexity = typeof complexityOptions[number]["value"];

// Priority options
export const backlogPriorityOptions = [
  { value: "low", label: "Basse", color: "#E5E7EB" },
  { value: "medium", label: "Moyenne", color: "#FDE047" },
  { value: "high", label: "Haute", color: "#FDBA74" },
  { value: "critical", label: "Critique", color: "#FCA5A5" },
] as const;

export type BacklogPriority = typeof backlogPriorityOptions[number]["value"];

// Sprint status
export const sprintStatusOptions = [
  { value: "preparation", label: "En préparation", color: "#E5E7EB" },
  { value: "en_cours", label: "En cours", color: "#93C5FD" },
  { value: "termine", label: "Terminé", color: "#86EFAC" },
] as const;

export type SprintStatus = typeof sprintStatusOptions[number]["value"];

// Backlogs table
export const backlogs = pgTable("backlogs", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }), // Optional link to project
  name: text("name").notNull(),
  description: text("description"),
  mode: text("mode").notNull().default("scrum"), // 'kanban' or 'scrum'
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  projectIdx: index().on(table.accountId, table.projectId),
}));

// Epics table
export const epics = pgTable("epics", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  backlogId: uuid("backlog_id").notNull().references(() => backlogs.id, { onDelete: "cascade" }),
  sprintId: uuid("sprint_id"), // FK to sprints for Jira-style sprint assignment
  roadmapItemId: uuid("roadmap_item_id"), // FK to roadmap_items for bidirectional sync
  cdcSessionId: uuid("cdc_session_id").references(() => cdcSessions.id, { onDelete: "set null" }), // Link to CDC session
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").default("medium"), // 'low', 'medium', 'high', 'critical'
  state: text("state").default("a_faire"), // 'a_faire', 'en_cours', 'review', 'termine'
  color: text("color").default("#C4B5FD"), // Visual color for the epic
  order: integer("order").notNull().default(0),
  dueDate: date("due_date"),
  ownerId: uuid("owner_id").references(() => appUsers.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  backlogIdx: index().on(table.backlogId),
  sprintIdx: index().on(table.sprintId),
  roadmapItemIdx: index().on(table.roadmapItemId),
  cdcSessionIdx: index().on(table.cdcSessionId),
}));

// User Stories table
export const userStories = pgTable("user_stories", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  backlogId: uuid("backlog_id").notNull().references(() => backlogs.id, { onDelete: "cascade" }),
  epicId: uuid("epic_id").references(() => epics.id, { onDelete: "set null" }), // Optional epic
  sprintId: uuid("sprint_id"), // FK to sprints, added after sprints table
  columnId: uuid("column_id"), // FK to backlog_columns for Kanban mode
  title: text("title").notNull(),
  description: text("description"),
  complexity: text("complexity"), // XS, S, M, L, XL, XXL
  priority: text("priority").default("medium"),
  estimatePoints: real("estimate_points"),
  state: text("state").default("a_faire"),
  order: integer("order").notNull().default(0),
  dueDate: date("due_date"),
  version: text("version"), // Version de produit (nullable)
  ownerId: uuid("owner_id").references(() => appUsers.id, { onDelete: "set null" }),
  assigneeId: uuid("assignee_id").references(() => appUsers.id, { onDelete: "set null" }),
  reporterId: uuid("reporter_id").references(() => appUsers.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  backlogIdx: index().on(table.backlogId),
  epicIdx: index().on(table.epicId),
  sprintIdx: index().on(table.sprintId),
  columnIdx: index().on(table.columnId),
}));

// Backlog Tasks (sub-items of User Stories)
export const backlogTasks = pgTable("backlog_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  backlogId: uuid("backlog_id").notNull().references(() => backlogs.id, { onDelete: "cascade" }),
  userStoryId: uuid("user_story_id").references(() => userStories.id, { onDelete: "cascade" }), // Optional: can be standalone
  epicId: uuid("epic_id").references(() => epics.id, { onDelete: "set null" }), // Optional epic for standalone tasks/bugs
  sprintId: uuid("sprint_id"), // FK to sprints for Jira-style sprint assignment
  taskType: text("task_type").default("task"), // 'task' or 'bug'
  title: text("title").notNull(),
  description: text("description"),
  state: text("state").default("a_faire"),
  priority: text("priority").default("medium"),
  estimatePoints: real("estimate_points"),
  order: integer("order").notNull().default(0),
  dueDate: date("due_date"),
  version: text("version"), // Version de produit (nullable)
  assigneeId: uuid("assignee_id").references(() => appUsers.id, { onDelete: "set null" }),
  reporterId: uuid("reporter_id").references(() => appUsers.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  backlogIdx: index().on(table.backlogId),
  userStoryIdx: index().on(table.userStoryId),
  epicIdx: index().on(table.epicId),
  sprintIdx: index().on(table.sprintId),
}));

// Checklist Items (Acceptance Criteria for User Stories)
export const checklistItems = pgTable("checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  userStoryId: uuid("user_story_id").notNull().references(() => userStories.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  done: boolean("done").notNull().default(false),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userStoryIdx: index().on(table.userStoryId),
}));

// Sprints table (Scrum mode)
export const sprints = pgTable("sprints", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  backlogId: uuid("backlog_id").notNull().references(() => backlogs.id, { onDelete: "cascade" }),
  roadmapItemId: uuid("roadmap_item_id").references(() => roadmapItems.id, { onDelete: "set null" }), // Link to roadmap element
  name: text("name").notNull(),
  goal: text("goal"), // Sprint goal
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }), // Actual completion date
  daysSaved: real("days_saved"), // Days saved when completing early
  status: text("status").notNull().default("preparation"), // 'preparation', 'en_cours', 'termine'
  position: integer("position").default(0), // Position for ordering sprints
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  backlogIdx: index().on(table.backlogId),
  roadmapItemIdx: index().on(table.roadmapItemId),
}));

// Backlog Columns (Kanban mode)
export const backlogColumns = pgTable("backlog_columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  backlogId: uuid("backlog_id").notNull().references(() => backlogs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#E5E7EB"),
  order: integer("order").notNull().default(0),
  isLocked: boolean("is_locked").notNull().default(false), // For default columns
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  backlogIdx: index().on(table.backlogId),
}));

// Retrospectives table
export const retros = pgTable("retros", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  backlogId: uuid("backlog_id").notNull().references(() => backlogs.id, { onDelete: "cascade" }),
  sprintId: uuid("sprint_id").references(() => sprints.id, { onDelete: "cascade" }),
  number: integer("number").notNull().default(1),
  status: text("status").notNull().default("en_cours"), // 'en_cours', 'termine'
  createdBy: uuid("created_by").notNull().references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  backlogIdx: index().on(table.backlogId),
  sprintIdx: index().on(table.sprintId),
}));

// Retro Cards table
export const retroCards = pgTable("retro_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  retroId: uuid("retro_id").notNull().references(() => retros.id, { onDelete: "cascade" }),
  column: text("column").notNull(), // 'went_well', 'went_bad', 'to_improve'
  content: text("content").notNull(),
  authorId: uuid("author_id").references(() => appUsers.id, { onDelete: "set null" }),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  retroIdx: index().on(table.retroId),
}));

// Retro column options
export const retroColumnOptions = [
  { value: "worked", label: "Ça a fonctionné", color: "#86EFAC", icon: "ThumbsUp" },
  { value: "not_worked", label: "Ça n'a pas fonctionné", color: "#FCA5A5", icon: "ThumbsDown" },
  { value: "to_improve", label: "À améliorer", color: "#FDE047", icon: "Lightbulb" },
] as const;

export type RetroColumn = typeof retroColumnOptions[number]["value"];

// Ticket Comments table
export const ticketComments = pgTable("ticket_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id").notNull(), // Generic reference to epic, user_story, or backlog_task
  ticketType: text("ticket_type").notNull(), // 'epic', 'user_story', 'task'
  content: text("content").notNull(),
  authorId: uuid("author_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  ticketIdx: index().on(table.ticketId, table.ticketType),
}));

// Ticket Acceptance Criteria table (Critères d'acceptation)
export const ticketAcceptanceCriteria = pgTable("ticket_acceptance_criteria", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id").notNull(), // Generic reference to user_story or backlog_task
  ticketType: text("ticket_type").notNull(), // 'user_story', 'task', 'bug'
  content: text("content").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  ticketIdx: index().on(table.ticketId, table.ticketType),
  positionIdx: index().on(table.ticketId, table.position),
}));

// Ticket Recipes table (Cahier de recette / QA Testing)
export const ticketRecipes = pgTable("ticket_recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  backlogId: uuid("backlog_id").notNull().references(() => backlogs.id, { onDelete: "cascade" }),
  sprintId: uuid("sprint_id").notNull().references(() => sprints.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id").notNull(), // Generic reference to user_story or backlog_task
  ticketType: text("ticket_type").notNull(), // 'user_story', 'task'
  status: text("status").notNull().default("a_tester"), // 'a_tester', 'en_test', 'teste'
  observedResults: text("observed_results"), // Multi-line text for observed results
  conclusion: text("conclusion"), // 'a_ameliorer', 'a_fix', 'a_ajouter'
  suggestions: text("suggestions"), // Multi-line text for suggestions
  remarks: text("remarks"), // Multi-line text for free-form remarks (Remarques)
  isFixedDone: boolean("is_fixed_done").notNull().default(false),
  updatedBy: uuid("updated_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index().on(table.accountId),
  backlogIdx: index().on(table.backlogId),
  sprintIdx: index().on(table.sprintId),
  ticketIdx: index().on(table.ticketId, table.ticketType),
  uniqueTicketSprint: index().on(table.ticketId, table.sprintId),
}));

// Recipe status options
export const recipeStatusOptions = [
  { value: "a_tester", label: "À tester", color: "#9CA3AF" },
  { value: "en_test", label: "En test", color: "#60A5FA" },
  { value: "teste", label: "Testé", color: "#34D399" },
] as const;

// Recipe conclusion options
export const recipeConclusionOptions = [
  { value: "termine", label: "Terminé", color: "#22C55E" },
  { value: "a_ameliorer", label: "À améliorer", color: "#FBBF24" },
  { value: "a_fix", label: "À fix", color: "#F87171" },
  { value: "a_ajouter", label: "À ajouter", color: "#A78BFA" },
] as const;

export type RecipeStatus = typeof recipeStatusOptions[number]["value"];
export type RecipeConclusion = typeof recipeConclusionOptions[number]["value"];

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
  phone: z.string().optional(),
  company: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  budget: z.union([z.string(), z.number(), z.null()]).transform((val) => val?.toString()).optional().nullable(),
});
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientCustomTabSchema = createInsertSchema(clientCustomTabs).omit({ id: true, createdAt: true, updatedAt: true });
export const updateClientCustomTabSchema = insertClientCustomTabSchema.omit({ accountId: true, createdBy: true });
export const insertClientCustomFieldSchema = createInsertSchema(clientCustomFields).omit({ id: true, createdAt: true, updatedAt: true });
export const updateClientCustomFieldSchema = insertClientCustomFieldSchema.omit({ accountId: true, tabId: true, createdBy: true });
export const insertClientCustomFieldValueSchema = createInsertSchema(clientCustomFieldValues).omit({ id: true, createdAt: true, updatedAt: true });
export const updateClientCustomFieldValueSchema = insertClientCustomFieldValueSchema.omit({ accountId: true, clientId: true, fieldId: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  budget: z.union([z.string(), z.number(), z.null()]).transform((val) => val?.toString()).optional().nullable(),
  billingRate: z.union([z.string(), z.number(), z.null()]).transform((val) => val?.toString()).optional().nullable(),
  totalBilled: z.union([z.string(), z.number(), z.null()]).transform((val) => val?.toString()).optional().nullable(),
  numberOfDays: z.union([z.string(), z.number(), z.null()]).transform((val) => val?.toString()).optional().nullable(),
  businessType: z.enum(['client', 'internal']).default('client').optional(),
  expectedPhases: z.array(z.string()).optional().nullable(),
  expectedScopeTypes: z.array(z.string()).optional().nullable(),
});
// Update schema for PATCH operations - all fields optional
export const updateProjectSchema = insertProjectSchema.omit({ accountId: true, createdBy: true }).partial().extend({
  onboardingSuggestionsShown: z.union([z.number(), z.boolean()]).transform((val) => typeof val === 'boolean' ? (val ? 1 : 0) : val).optional(),
  onboardingSuggestionsDismissed: z.union([z.number(), z.boolean()]).transform((val) => typeof val === 'boolean' ? (val ? 1 : 0) : val).optional(),
});
export const insertProjectCategorySchema = createInsertSchema(projectCategories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectPaymentSchema = createInsertSchema(projectPayments).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  amount: z.union([z.string(), z.number()]).transform((val) => val.toString()),
});
// CDC Session schemas
export const insertCdcSessionSchema = createInsertSchema(cdcSessions).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export const updateCdcSessionSchema = insertCdcSessionSchema.omit({ accountId: true, projectId: true, createdBy: true }).partial();

// Project Baseline schemas
export const insertProjectBaselineSchema = createInsertSchema(projectBaselines).omit({ id: true, createdAt: true }).extend({
  totalEstimatedDays: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  billableEstimatedDays: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  nonBillableEstimatedDays: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  byType: z.record(z.number()).default({}),
  byPhase: z.record(z.number()).default({}),
  scopeItemsSnapshot: z.array(z.any()).default([]),
});

export const insertProjectScopeItemSchema = createInsertSchema(projectScopeItems).omit({ id: true, createdAt: true, updatedAt: true, generatedEpicId: true, generatedUserStoryId: true, generatedRoadmapItemId: true }).extend({
  estimatedDays: z.union([z.string(), z.number(), z.null()]).transform((val) => val?.toString() ?? null).optional().nullable(),
  isOptional: z.union([z.boolean(), z.number()]).transform((val) => typeof val === 'boolean' ? (val ? 1 : 0) : val).optional(),
  isBillable: z.union([z.boolean(), z.number()]).transform((val) => typeof val === 'boolean' ? (val ? 1 : 0) : val).optional(),
  scopeType: z.enum(['functional', 'technical', 'design', 'gestion', 'strategy', 'autre']).default('functional').optional(),
  phase: z.enum(['T1', 'T2', 'T3', 'T4', 'LT']).optional().nullable(),
});
export const updateProjectScopeItemSchema = insertProjectScopeItemSchema.omit({ accountId: true, projectId: true }).partial();
export const insertRecommendationActionSchema = createInsertSchema(recommendationActions).omit({ id: true, createdAt: true }).extend({
  action: z.enum(['treated', 'ignored']),
});
export const insertTaskColumnSchema = createInsertSchema(taskColumns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true, createdAt: true, updatedAt: true });
export const updateTimeEntrySchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  duration: z.number().int().min(0).optional(),
  description: z.string().optional().nullable(),
  scopeItemId: z.string().uuid().optional().nullable(),
  taskId: z.string().uuid().optional().nullable(),
  sprintId: z.string().uuid().optional().nullable(),
});
export const insertDealSchema = createInsertSchema(deals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  accountId: z.string().nullable().optional(), // System templates have null accountId
});
export const updateDocumentTemplateSchema = insertDocumentTemplateSchema.omit({ accountId: true, createdBy: true }).partial();

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  templateId: z.string().nullable().optional(), // Free-form documents don't need templateId
});
export const updateDocumentSchema = insertDocumentSchema.omit({ accountId: true, createdBy: true }).partial();
export type UpdateDocument = z.infer<typeof updateDocumentSchema>;
export const insertFolderSchema = createInsertSchema(folders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMailAccountSchema = createInsertSchema(mailAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailSchema = createInsertSchema(emails).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFeatureSchema = createInsertSchema(features).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRoadmapSchema = createInsertSchema(roadmaps).omit({ id: true, createdAt: true, updatedAt: true });
export const updateRoadmapSchema = insertRoadmapSchema.omit({ accountId: true, createdBy: true }).partial();
export const insertRoadmapItemSchema = createInsertSchema(roadmapItems).omit({ id: true, createdAt: true, updatedAt: true });
export const updateRoadmapItemSchema = insertRoadmapItemSchema.omit({ roadmapId: true }).partial();
export const insertRoadmapItemLinkSchema = createInsertSchema(roadmapItemLinks).omit({ id: true, createdAt: true });
export const insertRoadmapDependencySchema = createInsertSchema(roadmapDependencies).omit({ id: true, createdAt: true });
export const insertClientCommentSchema = createInsertSchema(clientComments).omit({ id: true, createdAt: true });
export const insertNoteLinkSchema = createInsertSchema(noteLinks).omit({ noteId: true });
export const insertDocumentLinkSchema = createInsertSchema(documentLinks).omit({ documentId: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true, updatedAt: true });
export const updateAppointmentSchema = insertAppointmentSchema.omit({ accountId: true, createdBy: true, googleEventId: true }).partial();
export const insertGoogleCalendarTokenSchema = createInsertSchema(googleCalendarTokens).omit({ id: true, createdAt: true, updatedAt: true });

// Mindmap schemas
export const insertMindmapSchema = createInsertSchema(mindmaps).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  layoutConfig: z.record(z.any()).optional().default({}),
});
export const updateMindmapSchema = insertMindmapSchema.omit({ accountId: true, createdBy: true }).partial();

export const insertMindmapNodeSchema = createInsertSchema(mindmapNodes).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  type: z.string().optional().default("idea"),
  x: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional().default("0"),
  y: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional().default("0"),
  style: z.record(z.any()).optional().default({}),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  linkedEntityType: z.string().nullable().optional(),
  linkedEntityId: z.string().nullable().optional(),
});
export const updateMindmapNodeSchema = insertMindmapNodeSchema.omit({ accountId: true, mindmapId: true }).partial();

export const insertMindmapEdgeSchema = createInsertSchema(mindmapEdges).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  style: z.record(z.any()).optional().default({}),
});
export const updateMindmapEdgeSchema = insertMindmapEdgeSchema.omit({ accountId: true, mindmapId: true }).partial();

export const insertEntityLinkSchema = createInsertSchema(entityLinks).omit({ id: true, createdAt: true });

// Backlog schemas
export const insertBacklogSchema = createInsertSchema(backlogs).omit({ id: true, createdAt: true, updatedAt: true });
export const updateBacklogSchema = insertBacklogSchema.omit({ accountId: true, createdBy: true }).partial();

export const insertEpicSchema = createInsertSchema(epics).omit({ id: true, createdAt: true, updatedAt: true });
export const updateEpicSchema = insertEpicSchema.omit({ accountId: true, backlogId: true, createdBy: true }).extend({
  state: z.string().optional(),
}).partial();

export const insertUserStorySchema = createInsertSchema(userStories).omit({ id: true, createdAt: true, updatedAt: true });
export const updateUserStorySchema = insertUserStorySchema.omit({ accountId: true, backlogId: true, createdBy: true }).extend({
  state: z.string().optional(),
}).partial();

export const insertBacklogTaskSchema = createInsertSchema(backlogTasks).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  taskType: z.enum(["task", "bug"]).optional().default("task"),
});
export const updateBacklogTaskSchema = insertBacklogTaskSchema.omit({ accountId: true, backlogId: true, createdBy: true }).extend({
  state: z.string().optional(),
  taskType: z.enum(["task", "bug"]).optional(),
}).partial();

export const insertChecklistItemSchema = createInsertSchema(checklistItems).omit({ id: true, createdAt: true, updatedAt: true });
export const updateChecklistItemSchema = insertChecklistItemSchema.omit({ accountId: true, userStoryId: true }).partial();

export const insertSprintSchema = createInsertSchema(sprints).omit({ id: true, createdAt: true, updatedAt: true });
export const updateSprintSchema = insertSprintSchema.omit({ accountId: true, backlogId: true, createdBy: true }).partial();

export const insertBacklogColumnSchema = createInsertSchema(backlogColumns).omit({ id: true, createdAt: true, updatedAt: true });
export const updateBacklogColumnSchema = insertBacklogColumnSchema.omit({ accountId: true, backlogId: true }).partial();

export const insertRetroSchema = createInsertSchema(retros).omit({ id: true, createdAt: true, updatedAt: true });
export const updateRetroSchema = insertRetroSchema.omit({ accountId: true, sprintId: true, createdBy: true }).partial();

export const insertRetroCardSchema = createInsertSchema(retroCards).omit({ id: true, createdAt: true, updatedAt: true });
export const updateRetroCardSchema = insertRetroCardSchema.omit({ accountId: true, retroId: true }).partial();

export const insertTicketCommentSchema = createInsertSchema(ticketComments).omit({ id: true, createdAt: true, updatedAt: true });
export const updateTicketCommentSchema = insertTicketCommentSchema.omit({ accountId: true, ticketId: true, ticketType: true, authorId: true }).partial();

export const insertTicketAcceptanceCriteriaSchema = createInsertSchema(ticketAcceptanceCriteria).omit({ id: true, createdAt: true, updatedAt: true });
export const updateTicketAcceptanceCriteriaSchema = insertTicketAcceptanceCriteriaSchema.omit({ accountId: true, ticketId: true, ticketType: true }).partial();

export const insertTicketRecipeSchema = createInsertSchema(ticketRecipes).omit({ id: true, createdAt: true, updatedAt: true });
export const updateTicketRecipeSchema = insertTicketRecipeSchema.omit({ accountId: true, backlogId: true, sprintId: true, ticketId: true, ticketType: true }).partial();
export const upsertTicketRecipeSchema = z.object({
  sprintId: z.string().uuid(),
  ticketId: z.string().uuid(),
  ticketType: z.enum(["user_story", "task", "bug"]),
  status: z.enum(["a_tester", "en_test", "teste"]).optional(),
  observedResults: z.string().optional().nullable(),
  conclusion: z.enum(["termine", "a_ameliorer", "a_fix", "a_ajouter"]).optional().nullable(),
  suggestions: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(), // Free-form remarks (Remarques)
  isFixedDone: z.boolean().optional(),
  pushToTicket: z.boolean().optional(), // Flag to push comment to ticket
});

// OKR Schemas
export const insertOkrObjectiveSchema = createInsertSchema(okrObjectives).omit({ id: true, createdAt: true, updatedAt: true, progress: true, status: true });
export const updateOkrObjectiveSchema = insertOkrObjectiveSchema.omit({ accountId: true, projectId: true, createdBy: true }).partial();

export const insertOkrKeyResultSchema = createInsertSchema(okrKeyResults).omit({ id: true, createdAt: true, updatedAt: true });
export const updateOkrKeyResultSchema = insertOkrKeyResultSchema.omit({ accountId: true, objectiveId: true }).partial();

export const insertOkrLinkSchema = createInsertSchema(okrLinks).omit({ id: true, createdAt: true });

// Insert types
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type InsertClientCustomTab = z.infer<typeof insertClientCustomTabSchema>;
export type InsertClientCustomField = z.infer<typeof insertClientCustomFieldSchema>;
export type InsertClientCustomFieldValue = z.infer<typeof insertClientCustomFieldValueSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertProjectCategory = z.infer<typeof insertProjectCategorySchema>;
export type InsertProjectPayment = z.infer<typeof insertProjectPaymentSchema>;
export type InsertProjectScopeItem = z.infer<typeof insertProjectScopeItemSchema>;
export type UpdateProjectScopeItem = z.infer<typeof updateProjectScopeItemSchema>;
export type InsertTaskColumn = z.infer<typeof insertTaskColumnSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type InsertMailAccount = z.infer<typeof insertMailAccountSchema>;
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertFeature = z.infer<typeof insertFeatureSchema>;
export type InsertRoadmap = z.infer<typeof insertRoadmapSchema>;
export type UpdateRoadmap = z.infer<typeof updateRoadmapSchema>;
export type InsertRoadmapItem = z.infer<typeof insertRoadmapItemSchema>;
export type UpdateRoadmapItem = z.infer<typeof updateRoadmapItemSchema>;
export type InsertRoadmapItemLink = z.infer<typeof insertRoadmapItemLinkSchema>;
export type InsertRoadmapDependency = z.infer<typeof insertRoadmapDependencySchema>;
export type InsertClientComment = z.infer<typeof insertClientCommentSchema>;
export type InsertNoteLink = z.infer<typeof insertNoteLinkSchema>;
export type InsertDocumentLink = z.infer<typeof insertDocumentLinkSchema>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type InsertGoogleCalendarToken = z.infer<typeof insertGoogleCalendarTokenSchema>;
export type InsertMindmap = z.infer<typeof insertMindmapSchema>;
export type InsertMindmapNode = z.infer<typeof insertMindmapNodeSchema>;
export type InsertMindmapEdge = z.infer<typeof insertMindmapEdgeSchema>;
export type InsertEntityLink = z.infer<typeof insertEntityLinkSchema>;
export type UpdateMindmap = z.infer<typeof updateMindmapSchema>;
export type UpdateMindmapNode = z.infer<typeof updateMindmapNodeSchema>;
export type UpdateMindmapEdge = z.infer<typeof updateMindmapEdgeSchema>;
export type InsertBacklog = z.infer<typeof insertBacklogSchema>;
export type UpdateBacklog = z.infer<typeof updateBacklogSchema>;
export type InsertEpic = z.infer<typeof insertEpicSchema>;
export type UpdateEpic = z.infer<typeof updateEpicSchema>;
export type InsertUserStory = z.infer<typeof insertUserStorySchema>;
export type UpdateUserStory = z.infer<typeof updateUserStorySchema>;
export type InsertBacklogTask = z.infer<typeof insertBacklogTaskSchema>;
export type UpdateBacklogTask = z.infer<typeof updateBacklogTaskSchema>;
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type UpdateChecklistItem = z.infer<typeof updateChecklistItemSchema>;
export type InsertSprint = z.infer<typeof insertSprintSchema>;
export type UpdateSprint = z.infer<typeof updateSprintSchema>;
export type InsertBacklogColumn = z.infer<typeof insertBacklogColumnSchema>;
export type UpdateBacklogColumn = z.infer<typeof updateBacklogColumnSchema>;
export type InsertRetro = z.infer<typeof insertRetroSchema>;
export type UpdateRetro = z.infer<typeof updateRetroSchema>;
export type InsertRetroCard = z.infer<typeof insertRetroCardSchema>;
export type UpdateRetroCard = z.infer<typeof updateRetroCardSchema>;

// Select types
export type Account = typeof accounts.$inferSelect;
export type AppUser = typeof appUsers.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type ClientCustomTab = typeof clientCustomTabs.$inferSelect;
export type ClientCustomField = typeof clientCustomFields.$inferSelect;
export type ClientCustomFieldValue = typeof clientCustomFieldValues.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectCategory = typeof projectCategories.$inferSelect;
export type ProjectPayment = typeof projectPayments.$inferSelect;
export type CdcSession = typeof cdcSessions.$inferSelect;
export type InsertCdcSession = z.infer<typeof insertCdcSessionSchema>;
export type UpdateCdcSession = z.infer<typeof updateCdcSessionSchema>;
export type ProjectBaseline = typeof projectBaselines.$inferSelect;
export type InsertProjectBaseline = z.infer<typeof insertProjectBaselineSchema>;
export type ProjectScopeItem = typeof projectScopeItems.$inferSelect;
export type RecommendationAction = typeof recommendationActions.$inferSelect;
export type InsertRecommendationAction = z.infer<typeof insertRecommendationActionSchema>;
export type TaskColumn = typeof taskColumns.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type File = typeof files.$inferSelect;
export type MailAccount = typeof mailAccounts.$inferSelect;
export type Email = typeof emails.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Feature = typeof features.$inferSelect;
export type Roadmap = typeof roadmaps.$inferSelect;
export type RoadmapItem = typeof roadmapItems.$inferSelect;
export type RoadmapItemLink = typeof roadmapItemLinks.$inferSelect;
export type RoadmapDependency = typeof roadmapDependencies.$inferSelect;
export type ClientComment = typeof clientComments.$inferSelect;
export type NoteLink = typeof noteLinks.$inferSelect;
export type DocumentLink = typeof documentLinks.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type GoogleCalendarToken = typeof googleCalendarTokens.$inferSelect;
export type Mindmap = typeof mindmaps.$inferSelect;
export type MindmapNode = typeof mindmapNodes.$inferSelect;
export type MindmapEdge = typeof mindmapEdges.$inferSelect;
export type EntityLink = typeof entityLinks.$inferSelect;
export type Backlog = typeof backlogs.$inferSelect;
export type Epic = typeof epics.$inferSelect;
export type UserStory = typeof userStories.$inferSelect;
export type BacklogTask = typeof backlogTasks.$inferSelect;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type Sprint = typeof sprints.$inferSelect;
export type BacklogColumn = typeof backlogColumns.$inferSelect;
export type Retro = typeof retros.$inferSelect;
export type RetroCard = typeof retroCards.$inferSelect;
export type TicketComment = typeof ticketComments.$inferSelect;
export type TicketAcceptanceCriteria = typeof ticketAcceptanceCriteria.$inferSelect;
export type InsertTicketAcceptanceCriteria = z.infer<typeof insertTicketAcceptanceCriteriaSchema>;
export type TicketRecipe = typeof ticketRecipes.$inferSelect;
export type InsertTicketRecipe = z.infer<typeof insertTicketRecipeSchema>;
export type UpsertTicketRecipe = z.infer<typeof upsertTicketRecipeSchema>;

// OKR Types
export type OkrObjective = typeof okrObjectives.$inferSelect;
export type InsertOkrObjective = z.infer<typeof insertOkrObjectiveSchema>;
export type UpdateOkrObjective = z.infer<typeof updateOkrObjectiveSchema>;
export type OkrKeyResult = typeof okrKeyResults.$inferSelect;
export type InsertOkrKeyResult = z.infer<typeof insertOkrKeyResultSchema>;
export type UpdateOkrKeyResult = z.infer<typeof updateOkrKeyResultSchema>;
export type OkrLink = typeof okrLinks.$inferSelect;
export type InsertOkrLink = z.infer<typeof insertOkrLinkSchema>;

// ============================================
// PROJECT RESOURCES
// ============================================

// Resource templates (reusable across projects)
export const resourceTemplates = pgTable("resource_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'human' | 'non_human'
  // Human resource fields
  profileType: text("profile_type"), // Développeur, Designer, PM, etc.
  mode: text("mode"), // 'internal' | 'freelance' | 'contractor'
  dailyCostInternal: numeric("daily_cost_internal", { precision: 10, scale: 2 }),
  dailyRateBilled: numeric("daily_rate_billed", { precision: 10, scale: 2 }),
  defaultCapacity: real("default_capacity"), // jours/semaine ou % allocation
  // Non-human resource fields
  category: text("category"), // 'hosting' | 'saas' | 'api' | 'license' | 'infrastructure' | 'outsourcing' | 'other'
  costType: text("cost_type"), // 'monthly' | 'annual' | 'one_time'
  defaultAmount: numeric("default_amount", { precision: 10, scale: 2 }),
  // Common fields
  isBillable: integer("is_billable").notNull().default(1), // 0 = false, 1 = true
  projectType: text("project_type"), // For template matching: 'dev_saas', 'ecommerce', 'design', etc.
  isSystemTemplate: integer("is_system_template").notNull().default(0), // 0 = user-created, 1 = system template
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountTypeIdx: index("resource_templates_account_type_idx").on(table.accountId, table.type),
  projectTypeIdx: index("resource_templates_project_type_idx").on(table.projectType),
}));

export const insertResourceTemplateSchema = createInsertSchema(resourceTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertResourceTemplate = z.infer<typeof insertResourceTemplateSchema>;
export type ResourceTemplate = typeof resourceTemplates.$inferSelect;

// Project resources (actual resources assigned to a project)
export const projectResources = pgTable("project_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  templateId: uuid("template_id").references(() => resourceTemplates.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'human' | 'non_human'
  // Human resource fields
  profileType: text("profile_type"), // Développeur, Designer, PM, etc.
  mode: text("mode"), // 'internal' | 'freelance' | 'contractor'
  dailyCostInternal: numeric("daily_cost_internal", { precision: 10, scale: 2 }),
  dailyRateBilled: numeric("daily_rate_billed", { precision: 10, scale: 2 }),
  capacity: real("capacity"), // jours/semaine ou % allocation
  // Non-human resource fields
  category: text("category"), // 'hosting' | 'saas' | 'api' | 'license' | 'infrastructure' | 'outsourcing' | 'other'
  costType: text("cost_type"), // 'monthly' | 'annual' | 'one_time'
  amount: numeric("amount", { precision: 10, scale: 2 }),
  // Period fields
  startDate: date("start_date"),
  endDate: date("end_date"),
  roadmapPhase: text("roadmap_phase"), // T1, T2, T3, LT, etc.
  // Common fields
  isBillable: integer("is_billable").notNull().default(1), // 0 = false, 1 = true
  status: text("status").notNull().default("active"), // 'active' | 'disabled'
  isSimulation: integer("is_simulation").notNull().default(0), // 0 = real, 1 = simulation only
  notes: text("notes"),
  metadata: jsonb("metadata").default({}),
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("project_resources_project_idx").on(table.projectId),
  accountProjectIdx: index("project_resources_account_project_idx").on(table.accountId, table.projectId),
  typeStatusIdx: index("project_resources_type_status_idx").on(table.projectId, table.type, table.status),
}));

export const insertProjectResourceSchema = createInsertSchema(projectResources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProjectResource = z.infer<typeof insertProjectResourceSchema>;
export type ProjectResource = typeof projectResources.$inferSelect;

// Resource type options for UI
export const resourceTypeOptions = [
  { value: "human", label: "Ressource humaine" },
  { value: "non_human", label: "Ressource non humaine" },
] as const;

export const humanProfileTypeOptions = [
  { value: "developer", label: "Développeur" },
  { value: "designer", label: "Designer" },
  { value: "product_manager", label: "Product Manager" },
  { value: "marketing", label: "Marketing" },
  { value: "qa", label: "QA / Testeur" },
  { value: "devops", label: "DevOps" },
  { value: "project_manager", label: "Chef de projet" },
  { value: "consultant", label: "Consultant" },
  { value: "other", label: "Autre" },
] as const;

export const humanModeOptions = [
  { value: "internal", label: "Interne" },
  { value: "freelance", label: "Freelance" },
  { value: "contractor", label: "Sous-traitant" },
] as const;

export const nonHumanCategoryOptions = [
  { value: "hosting", label: "Hébergement" },
  { value: "saas", label: "Outils SaaS" },
  { value: "api", label: "API / IA" },
  { value: "license", label: "Licences" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "outsourcing", label: "Sous-traitance" },
  { value: "other", label: "Autre" },
] as const;

export const costTypeOptions = [
  { value: "monthly", label: "Mensuel" },
  { value: "annual", label: "Annuel" },
  { value: "one_time", label: "Ponctuel" },
] as const;

export const resourceStatusOptions = [
  { value: "active", label: "Actif" },
  { value: "disabled", label: "Désactivé" },
] as const;

// ============================================
// CONFIG REGISTRY (DB-first settings)
// ============================================

/**
 * Settings table for DB-first configurable parameters
 * Scope hierarchy: SYSTEM -> ACCOUNT -> USER -> PROJECT
 * Lower scopes override higher scopes
 */
export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: text("scope").notNull(), // SYSTEM | ACCOUNT | USER | PROJECT
  scopeId: uuid("scope_id"), // null for SYSTEM, account_id/user_id/project_id for others
  key: text("key").notNull(), // e.g., "project.stages", "reports.thresholds"
  value: jsonb("value").notNull(), // The configuration value as JSONB
  version: integer("version").notNull().default(1),
  source: text("source").notNull().default("default"), // "default" | "customized"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"), // Reference to user who last updated
}, (table) => ({
  scopeKeyIdx: index("settings_scope_key_idx").on(table.scope, table.scopeId, table.key),
  keyIdx: index("settings_key_idx").on(table.key),
}));

export const insertSettingsSchema = createInsertSchema(settings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  version: true 
});
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// ============================================
// CONFIGURATION OPTIONS (exported for UI)
// ============================================

// Mindmap Kind Options
export const mindmapKindOptions = [
  { value: "generic", label: "Mindmap libre", icon: "Brain" },
  { value: "storyboard", label: "Storyboard", icon: "Film" },
  { value: "user_flow", label: "Parcours utilisateur", icon: "Route" },
  { value: "architecture", label: "Architecture", icon: "Network" },
  { value: "sitemap", label: "Sitemap", icon: "Map" },
  { value: "ideas", label: "Idées", icon: "Lightbulb" },
] as const;

export type MindmapKind = typeof mindmapKindOptions[number]["value"];

// Mindmap Node Type Options
export const mindmapNodeTypeOptions = [
  { value: "idea", label: "Idée", icon: "Lightbulb", color: "#FDE047" },
  { value: "note", label: "Note", icon: "StickyNote", color: "#93C5FD" },
  { value: "project", label: "Projet", icon: "Folder", color: "#86EFAC" },
  { value: "document", label: "Document", icon: "FileText", color: "#C4B5FD" },
  { value: "task", label: "Tâche", icon: "CheckSquare", color: "#5EEAD4" },
  { value: "client", label: "Client", icon: "User", color: "#FCA5A5" },
  { value: "generic", label: "Générique", icon: "Square", color: "#D1D5DB" },
  { value: "text", label: "Texte libre", icon: "Type", color: "#A3A3A3" },
] as const;

export type MindmapNodeType = typeof mindmapNodeTypeOptions[number]["value"];

// OKR Type Options
export const okrObjectiveTypeOptions = [
  { value: "business", label: "Business", icon: "TrendingUp", color: "#10B981" },
  { value: "product", label: "Produit", icon: "Package", color: "#7C3AED" },
  { value: "marketing", label: "Marketing", icon: "Megaphone", color: "#06B6D4" },
] as const;

export type OkrObjectiveType = typeof okrObjectiveTypeOptions[number]["value"];

// OKR Target Phase Options
export const okrTargetPhaseOptions = [
  { value: "T1", label: "T1 (Court terme)" },
  { value: "T2", label: "T2 (Moyen terme)" },
  { value: "T3", label: "T3 (Long terme)" },
  { value: "LT", label: "Long terme" },
] as const;

export type OkrTargetPhase = typeof okrTargetPhaseOptions[number]["value"];

// OKR Status Options
export const okrStatusOptions = [
  { value: "on_track", label: "En bonne voie", color: "#10B981" },
  { value: "at_risk", label: "À risque", color: "#F59E0B" },
  { value: "critical", label: "Critique", color: "#EF4444" },
  { value: "achieved", label: "Atteint", color: "#3B82F6" },
] as const;

export type OkrStatus = typeof okrStatusOptions[number]["value"];

// Key Result Metric Type Options
export const okrMetricTypeOptions = [
  { value: "delivery", label: "Livraison (features/epics)", icon: "Package" },
  { value: "time", label: "Temps", icon: "Clock" },
  { value: "margin", label: "Marge", icon: "DollarSign" },
  { value: "adoption", label: "Adoption", icon: "Users" },
  { value: "volume", label: "Volume", icon: "BarChart" },
] as const;

export type OkrMetricType = typeof okrMetricTypeOptions[number]["value"];

// Billing Status Options - Re-exported from centralized config for backwards compatibility
export { 
  billingStatusOptions,
  BILLING_STATUSES,
  type BillingStatusKey as BillingStatus,
  getBillingStatusLabel,
  getBillingStatusColorClass,
  getBillingStatusColor,
  getBillingStatusOrder,
  isTerminalBillingStatus
} from "./config/billingStatuses";
