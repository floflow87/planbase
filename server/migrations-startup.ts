// Auto-run migrations at server startup to ensure schema is up-to-date
import { db } from "./db";
import { sql } from "drizzle-orm";
import { addDocumentTables, seedDocumentTemplates } from "./migrations/add-document-tables";

export async function runStartupMigrations() {
  console.log("🔄 Running startup migrations...");
  
  try {
    // Create document tables and seed templates
    await addDocumentTables();
    await seedDocumentTemplates();
    
    // Add effort column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS effort integer;
    `);
    
    // Add siret column to accounts if it doesn't exist
    await db.execute(sql`
      ALTER TABLE accounts 
      ADD COLUMN IF NOT EXISTS siret text;
    `);
    
    // Add billing status columns to projects if they don't exist
    await db.execute(sql`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS billing_status text,
      ADD COLUMN IF NOT EXISTS billing_due_date date;
    `);
    console.log("✅ Billing status columns added to projects");
    
    // Add new client columns if they don't exist
    await db.execute(sql`
      ALTER TABLE clients 
      ADD COLUMN IF NOT EXISTS civility text,
      ADD COLUMN IF NOT EXISTS first_name text,
      ADD COLUMN IF NOT EXISTS company text,
      ADD COLUMN IF NOT EXISTS address text,
      ADD COLUMN IF NOT EXISTS postal_code text,
      ADD COLUMN IF NOT EXISTS city text,
      ADD COLUMN IF NOT EXISTS country text,
      ADD COLUMN IF NOT EXISTS nationality text;
    `);
    
    // Create client_custom_tabs table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS client_custom_tabs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name text NOT NULL,
        icon text,
        "order" integer NOT NULL DEFAULT 0,
        created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    // Create index on account_id for client_custom_tabs if it doesn't exist
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS client_custom_tabs_account_id_idx 
      ON client_custom_tabs(account_id);
    `);
    
    // Create client_custom_fields table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS client_custom_fields (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        tab_id uuid NOT NULL REFERENCES client_custom_tabs(id) ON DELETE CASCADE,
        name text NOT NULL,
        field_type text NOT NULL,
        options jsonb NOT NULL DEFAULT '[]'::jsonb,
        required integer NOT NULL DEFAULT 0,
        "order" integer NOT NULL DEFAULT 0,
        created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    // Create index on account_id for client_custom_fields if it doesn't exist
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS client_custom_fields_account_id_idx 
      ON client_custom_fields(account_id, tab_id);
    `);
    
    // Create client_custom_field_values table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS client_custom_field_values (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        field_id uuid NOT NULL REFERENCES client_custom_fields(id) ON DELETE CASCADE,
        value jsonb NOT NULL DEFAULT 'null'::jsonb,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    // Create indexes for client_custom_field_values if they don't exist
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS client_custom_field_values_account_client_field_idx 
      ON client_custom_field_values(account_id, client_id, field_id);
    `);
    
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS client_custom_field_values_client_field_unique 
      ON client_custom_field_values(client_id, field_id);
    `);
    
    // Ensure created_by columns are nullable (for existing tables)
    await db.execute(sql`
      ALTER TABLE client_custom_tabs 
      ALTER COLUMN created_by DROP NOT NULL;
    `);
    
    await db.execute(sql`
      ALTER TABLE client_custom_fields 
      ALTER COLUMN created_by DROP NOT NULL;
    `);
    
    // Update activities constraints to support note, task, document, backlog types
    await db.execute(sql`
      DO $$ 
      BEGIN
        -- Drop old constraint if it exists
        ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_subject_type_check;
        
        -- Add new constraint with extended values including mindmap, backlog and roadmap types
        ALTER TABLE activities 
        ADD CONSTRAINT activities_subject_type_check 
        CHECK (subject_type IN ('client','deal','project','note','task','document','mindmap','backlog','epic','user_story','backlog_task','roadmap'));
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END $$;
    `);
    
    // Add billing/time tracking fields to projects table
    await db.execute(sql`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS billing_type text,
      ADD COLUMN IF NOT EXISTS billing_unit text,
      ADD COLUMN IF NOT EXISTS billing_rate numeric(14, 2),
      ADD COLUMN IF NOT EXISTS total_billed numeric(14, 2);
    `);
    
    // Create time_entries table for time tracking
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS time_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        description text,
        start_time timestamp with time zone,
        end_time timestamp with time zone,
        duration integer,
        is_billable integer NOT NULL DEFAULT 1,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );
    `);
    
    // Create indexes for time_entries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS time_entries_account_project_idx 
      ON time_entries(account_id, project_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS time_entries_account_user_idx 
      ON time_entries(account_id, user_id);
    `);
    
    // Add paused_at column to time_entries for pause/resume functionality
    await db.execute(sql`
      ALTER TABLE time_entries 
      ADD COLUMN IF NOT EXISTS paused_at timestamp with time zone;
    `);
    
    // Create project_categories table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name text NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    // Create unique index on account_id and name for project_categories
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS project_categories_account_name_idx 
      ON project_categories(account_id, name);
    `);
    
    // Fix old activities with incorrect kind='note' when they should be 'created' or 'updated'
    console.log("🔄 Fixing activity kinds...");
    
    // First, update the constraint to allow 'created', 'updated', 'deleted'
    await db.execute(sql`
      DO $$ 
      BEGIN
        ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_kind_check;
        ALTER TABLE activities 
        ADD CONSTRAINT activities_kind_check 
        CHECK (kind IN ('created','updated','deleted','email','call','meeting','note','task','file','custom'));
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END $$;
    `);
    
    // Now update the data
    await db.execute(sql`
      UPDATE activities 
      SET kind = 'created'
      WHERE kind = 'note' 
        AND (
          payload::jsonb->>'description' LIKE '%created:%'
          OR payload::jsonb->>'description' LIKE '%créé%'
          OR payload::jsonb->>'description' LIKE '%onboarded:%'
        );
    `);
    
    await db.execute(sql`
      UPDATE activities 
      SET kind = 'updated'
      WHERE kind = 'note' 
        AND (
          payload::jsonb->>'description' LIKE '%updated:%'
          OR payload::jsonb->>'description' LIKE '%mis à jour%'
        );
    `);
    console.log("✅ Activity kinds fixed");
    
    // Create project_payments table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        amount numeric(14, 2) NOT NULL,
        payment_date date NOT NULL,
        description text,
        created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    // Create index on account_id and project_id for project_payments
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS project_payments_account_project_idx 
      ON project_payments(account_id, project_id);
    `);
    console.log("✅ Project payments table created");
    
    // Add is_favorite column to notes if it doesn't exist
    await db.execute(sql`
      ALTER TABLE notes 
      ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
    `);
    console.log("✅ Notes is_favorite column added");
    
    // Create mindmaps table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mindmaps (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text,
        kind text NOT NULL DEFAULT 'brainstorm' CHECK (kind IN ('generic', 'user_journey', 'storyboard', 'sitemap', 'architecture', 'brainstorm')),
        client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
        project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
        layout_config jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    // Migrate title to name if table was created with old schema
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mindmaps' AND column_name = 'title') THEN
          ALTER TABLE mindmaps RENAME COLUMN title TO name;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mindmaps' AND column_name = 'description') THEN
          ALTER TABLE mindmaps ADD COLUMN description text;
        END IF;
      END $$;
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS mindmaps_account_idx ON mindmaps(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS mindmaps_client_idx ON mindmaps(account_id, client_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS mindmaps_project_idx ON mindmaps(account_id, project_id);
    `);
    console.log("✅ Mindmaps table created");
    
    // Create mindmap_nodes table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mindmap_nodes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        mindmap_id uuid NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        type text NOT NULL DEFAULT 'idea' CHECK (type IN ('idea', 'note', 'project', 'document', 'task', 'client', 'generic')),
        title text NOT NULL,
        description text,
        image_url text,
        linked_entity_type text CHECK (linked_entity_type IS NULL OR linked_entity_type IN ('note', 'project', 'document', 'task', 'client')),
        linked_entity_id uuid,
        x numeric(10, 2) NOT NULL DEFAULT 0,
        y numeric(10, 2) NOT NULL DEFAULT 0,
        style jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS mindmap_nodes_mindmap_idx ON mindmap_nodes(mindmap_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS mindmap_nodes_account_idx ON mindmap_nodes(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS mindmap_nodes_linked_entity_idx ON mindmap_nodes(linked_entity_type, linked_entity_id);
    `);
    console.log("✅ Mindmap nodes table created");
    
    // Create mindmap_edges table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mindmap_edges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        mindmap_id uuid NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        source_node_id uuid NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
        target_node_id uuid NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
        is_draft boolean NOT NULL DEFAULT true,
        linked_entity_link_id uuid,
        label text,
        style jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS mindmap_edges_mindmap_idx ON mindmap_edges(mindmap_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS mindmap_edges_account_idx ON mindmap_edges(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS mindmap_edges_source_idx ON mindmap_edges(source_node_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS mindmap_edges_target_idx ON mindmap_edges(target_node_id);
    `);
    console.log("✅ Mindmap edges table created");
    
    // Create entity_links table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS entity_links (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        source_type text NOT NULL CHECK (source_type IN ('note', 'project', 'document', 'task', 'client')),
        source_id uuid NOT NULL,
        target_type text NOT NULL CHECK (target_type IN ('note', 'project', 'document', 'task', 'client')),
        target_id uuid NOT NULL,
        created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS entity_links_account_idx ON entity_links(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS entity_links_source_idx ON entity_links(source_type, source_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS entity_links_target_idx ON entity_links(target_type, target_id);
    `);
    console.log("✅ Entity links table created");
    
    // ============================================
    // BACKLOG MODULE TABLES
    // ============================================
    
    // Create backlogs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS backlogs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
        name text NOT NULL,
        description text,
        mode text NOT NULL DEFAULT 'scrum' CHECK (mode IN ('kanban', 'scrum')),
        created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS backlogs_account_idx ON backlogs(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS backlogs_project_idx ON backlogs(account_id, project_id);
    `);
    console.log("✅ Backlogs table created");
    
    // Create epics table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS epics (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        backlog_id uuid NOT NULL REFERENCES backlogs(id) ON DELETE CASCADE,
        title text NOT NULL,
        description text,
        priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        state text DEFAULT 'a_faire' CHECK (state IN ('a_faire', 'en_cours', 'testing', 'to_fix', 'review', 'termine')),
        color text DEFAULT '#C4B5FD',
        "order" integer NOT NULL DEFAULT 0,
        due_date date,
        owner_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS epics_account_idx ON epics(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS epics_backlog_idx ON epics(backlog_id);
    `);
    console.log("✅ Epics table created");
    
    // Create user_stories table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_stories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        backlog_id uuid NOT NULL REFERENCES backlogs(id) ON DELETE CASCADE,
        epic_id uuid REFERENCES epics(id) ON DELETE SET NULL,
        sprint_id uuid,
        column_id uuid,
        title text NOT NULL,
        description text,
        complexity text CHECK (complexity IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
        priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        estimate_points integer,
        state text DEFAULT 'a_faire' CHECK (state IN ('a_faire', 'en_cours', 'testing', 'to_fix', 'review', 'termine')),
        "order" integer NOT NULL DEFAULT 0,
        due_date date,
        owner_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
        assignee_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
        reporter_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS user_stories_account_idx ON user_stories(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS user_stories_backlog_idx ON user_stories(backlog_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS user_stories_epic_idx ON user_stories(epic_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS user_stories_sprint_idx ON user_stories(sprint_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS user_stories_column_idx ON user_stories(column_id);
    `);
    console.log("✅ User stories table created");
    
    // Create backlog_tasks table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS backlog_tasks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        backlog_id uuid NOT NULL REFERENCES backlogs(id) ON DELETE CASCADE,
        user_story_id uuid REFERENCES user_stories(id) ON DELETE CASCADE,
        title text NOT NULL,
        description text,
        state text DEFAULT 'a_faire' CHECK (state IN ('a_faire', 'en_cours', 'testing', 'to_fix', 'review', 'termine')),
        estimate_points integer,
        "order" integer NOT NULL DEFAULT 0,
        due_date date,
        assignee_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
        reporter_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS backlog_tasks_account_idx ON backlog_tasks(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS backlog_tasks_backlog_idx ON backlog_tasks(backlog_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS backlog_tasks_user_story_idx ON backlog_tasks(user_story_id);
    `);
    console.log("✅ Backlog tasks table created");
    
    // Create checklist_items table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS checklist_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_story_id uuid NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,
        label text NOT NULL,
        done boolean NOT NULL DEFAULT false,
        "order" integer NOT NULL DEFAULT 0,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS checklist_items_user_story_idx ON checklist_items(user_story_id);
    `);
    console.log("✅ Checklist items table created");
    
    // Create sprints table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sprints (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        backlog_id uuid NOT NULL REFERENCES backlogs(id) ON DELETE CASCADE,
        name text NOT NULL,
        goal text,
        start_date timestamp with time zone,
        end_date timestamp with time zone,
        status text NOT NULL DEFAULT 'preparation' CHECK (status IN ('preparation', 'en_cours', 'termine')),
        created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sprints_account_idx ON sprints(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sprints_backlog_idx ON sprints(backlog_id);
    `);
    console.log("✅ Sprints table created");
    
    // Create backlog_columns table (for Kanban mode)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS backlog_columns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        backlog_id uuid NOT NULL REFERENCES backlogs(id) ON DELETE CASCADE,
        name text NOT NULL,
        color text NOT NULL DEFAULT '#E5E7EB',
        "order" integer NOT NULL DEFAULT 0,
        is_locked boolean NOT NULL DEFAULT false,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS backlog_columns_account_idx ON backlog_columns(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS backlog_columns_backlog_idx ON backlog_columns(backlog_id);
    `);
    console.log("✅ Backlog columns table created");
    
    // Create retros table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS retros (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        sprint_id uuid NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
        created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS retros_account_idx ON retros(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS retros_sprint_idx ON retros(sprint_id);
    `);
    console.log("✅ Retros table created");
    
    // Create retro_cards table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS retro_cards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        retro_id uuid NOT NULL REFERENCES retros(id) ON DELETE CASCADE,
        "column" text NOT NULL CHECK ("column" IN ('went_well', 'went_bad', 'to_improve')),
        content text NOT NULL,
        author_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
        "order" integer NOT NULL DEFAULT 0,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS retro_cards_account_idx ON retro_cards(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS retro_cards_retro_idx ON retro_cards(retro_id);
    `);
    console.log("✅ Retro cards table created");
    
    // Add sprint_id column to epics for Jira-style sprint assignment
    await db.execute(sql`
      ALTER TABLE epics ADD COLUMN IF NOT EXISTS sprint_id uuid;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS epics_sprint_idx ON epics(sprint_id);
    `);
    console.log("✅ Epics sprint_id column added");
    
    // Add sprint_id and priority columns to backlog_tasks
    await db.execute(sql`
      ALTER TABLE backlog_tasks ADD COLUMN IF NOT EXISTS sprint_id uuid;
    `);
    await db.execute(sql`
      ALTER TABLE backlog_tasks ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS backlog_tasks_sprint_idx ON backlog_tasks(sprint_id);
    `);
    console.log("✅ Backlog tasks sprint_id and priority columns added");
    
    // Create ticket_comments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ticket_comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        ticket_id uuid NOT NULL,
        ticket_type text NOT NULL CHECK (ticket_type IN ('epic', 'user_story', 'task')),
        content text NOT NULL,
        author_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ticket_comments_account_idx ON ticket_comments(account_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ticket_comments_ticket_idx ON ticket_comments(ticket_id, ticket_type);
    `);
    console.log("✅ Ticket comments table created");
    
    // Create ticket_recipes table (Cahier de recette / QA Testing)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ticket_recipes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        backlog_id uuid NOT NULL REFERENCES backlogs(id) ON DELETE CASCADE,
        sprint_id uuid NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
        ticket_id uuid NOT NULL,
        ticket_type text NOT NULL CHECK (ticket_type IN ('user_story', 'task')),
        status text NOT NULL DEFAULT 'a_tester' CHECK (status IN ('a_tester', 'en_test', 'teste')),
        observed_results text,
        conclusion text CHECK (conclusion IS NULL OR conclusion IN ('a_ameliorer', 'a_fix', 'a_ajouter')),
        suggestions text,
        is_fixed_done boolean NOT NULL DEFAULT false,
        updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ticket_recipes_account_idx ON ticket_recipes(account_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ticket_recipes_backlog_idx ON ticket_recipes(backlog_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ticket_recipes_sprint_idx ON ticket_recipes(sprint_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ticket_recipes_ticket_idx ON ticket_recipes(ticket_id, ticket_type);
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS ticket_recipes_unique_ticket_sprint ON ticket_recipes(ticket_id, sprint_id);
    `);
    console.log("✅ Ticket recipes table created");
    
    // Update ticket_recipes conclusion check constraint to include 'termine'
    await db.execute(sql`
      ALTER TABLE ticket_recipes DROP CONSTRAINT IF EXISTS ticket_recipes_conclusion_check;
    `);
    await db.execute(sql`
      ALTER TABLE ticket_recipes ADD CONSTRAINT ticket_recipes_conclusion_check 
        CHECK (conclusion IS NULL OR conclusion IN ('termine', 'a_ameliorer', 'a_fix', 'a_ajouter'));
    `);
    console.log("✅ Ticket recipes conclusion constraint updated");
    
    // Add remarks column to ticket_recipes table
    await db.execute(sql`
      ALTER TABLE ticket_recipes ADD COLUMN IF NOT EXISTS remarks text;
    `);
    console.log("✅ Ticket recipes remarks column added");
    
    // Create ticket_acceptance_criteria table (Critères d'acceptation)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ticket_acceptance_criteria (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        ticket_id uuid NOT NULL,
        ticket_type text NOT NULL CHECK (ticket_type IN ('user_story', 'task', 'bug')),
        content text NOT NULL,
        position integer NOT NULL DEFAULT 0,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ticket_acceptance_criteria_account_idx ON ticket_acceptance_criteria(account_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ticket_acceptance_criteria_ticket_idx ON ticket_acceptance_criteria(ticket_id, ticket_type);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ticket_acceptance_criteria_position_idx ON ticket_acceptance_criteria(ticket_id, position);
    `);
    console.log("✅ Ticket acceptance criteria table created");
    
    // Add backlog_id column to retros table and make sprint_id nullable
    await db.execute(sql`
      ALTER TABLE retros ADD COLUMN IF NOT EXISTS backlog_id uuid REFERENCES backlogs(id) ON DELETE CASCADE;
    `);
    await db.execute(sql`
      ALTER TABLE retros ALTER COLUMN sprint_id DROP NOT NULL;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS retros_backlog_idx ON retros(backlog_id);
    `);
    console.log("✅ Retros backlog_id column added");
    
    // Add number and status columns to retros table
    await db.execute(sql`
      ALTER TABLE retros ADD COLUMN IF NOT EXISTS number integer NOT NULL DEFAULT 1;
    `);
    await db.execute(sql`
      ALTER TABLE retros ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'en_cours';
    `);
    console.log("✅ Retros number and status columns added");
    
    // Update retro_cards column check constraint to use new values
    await db.execute(sql`
      ALTER TABLE retro_cards DROP CONSTRAINT IF EXISTS retro_cards_column_check;
    `);
    await db.execute(sql`
      ALTER TABLE retro_cards ADD CONSTRAINT retro_cards_column_check 
        CHECK ("column" IN ('worked', 'not_worked', 'to_improve'));
    `);
    console.log("✅ Retro cards column constraint updated");
    
    // Add description and occurred_at columns to activities table
    await db.execute(sql`
      ALTER TABLE activities ADD COLUMN IF NOT EXISTS description text;
    `);
    await db.execute(sql`
      ALTER TABLE activities ADD COLUMN IF NOT EXISTS occurred_at timestamp with time zone;
    `);
    console.log("✅ Activities description and occurred_at columns added");
    
    // Create settings table for Config Registry
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        scope text NOT NULL,
        scope_id uuid,
        key text NOT NULL,
        value jsonb NOT NULL,
        version integer NOT NULL DEFAULT 1,
        source text NOT NULL DEFAULT 'default',
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_by uuid
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS settings_scope_key_idx ON settings(scope, scope_id, key);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS settings_key_idx ON settings(key);
    `);
    console.log("✅ Settings table created for Config Registry");
    
    // Add completed_at and days_saved columns to sprints table
    await db.execute(sql`
      ALTER TABLE sprints ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
    `);
    await db.execute(sql`
      ALTER TABLE sprints ADD COLUMN IF NOT EXISTS days_saved real;
    `);
    console.log("✅ Sprints completed_at and days_saved columns added");
    
    // Add profitability columns to projects table
    await db.execute(sql`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS internal_daily_cost numeric(14,2);
    `);
    await db.execute(sql`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_margin_percent numeric(5,2);
    `);
    console.log("✅ Projects profitability columns added");
    
    // Add priority column to projects table for decision engine
    await db.execute(sql`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal';
    `);
    console.log("✅ Projects priority column added");
    
    // Add business_type column to projects table for internal/client distinction
    await db.execute(sql`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'client';
    `);
    console.log("✅ Projects business_type column added");
    
    // Create project_scope_items table for CDC/Statement of Work
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_scope_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        label text NOT NULL,
        estimated_days numeric(10,2) NOT NULL,
        is_optional integer NOT NULL DEFAULT 0,
        "order" integer NOT NULL DEFAULT 0,
        description text,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS project_scope_items_account_project_idx 
      ON project_scope_items(account_id, project_id);
    `);
    console.log("✅ Project scope items table created");
    
    // Create recommendation_actions table for tracking treated/ignored recommendations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS recommendation_actions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        recommendation_key text NOT NULL,
        action text NOT NULL,
        note text,
        created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS recommendation_actions_account_project_key_idx 
      ON recommendation_actions(account_id, project_id, recommendation_key);
    `);
    console.log("✅ Recommendation actions table created");
    
    // Add position column to sprints for ordering
    await db.execute(sql`
      ALTER TABLE sprints ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;
    `);
    console.log("✅ Sprints position column added");
    
    // Add scope_item_id and task_id columns to time_entries for Module Temps V2
    await db.execute(sql`
      ALTER TABLE time_entries 
      ADD COLUMN IF NOT EXISTS scope_item_id uuid REFERENCES project_scope_items(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS time_entries_scope_item_idx ON time_entries(scope_item_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS time_entries_task_idx ON time_entries(task_id);
    `);
    console.log("✅ Time entries scope_item_id and task_id columns added");
    
    // Add sprint_id column to time_entries for sprint linking
    await db.execute(sql`
      ALTER TABLE time_entries 
      ADD COLUMN IF NOT EXISTS sprint_id uuid;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS time_entries_sprint_idx ON time_entries(sprint_id);
    `);
    console.log("✅ Time entries sprint_id column added");
    
    // ============================================
    // ROADMAP MODULE - NEW TABLES
    // ============================================
    
    // Add new columns to roadmaps table
    await db.execute(sql`
      ALTER TABLE roadmaps 
      ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS view_defaults jsonb NOT NULL DEFAULT '{}'::jsonb;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS roadmaps_project_idx ON roadmaps(project_id);
    `);
    console.log("✅ Roadmaps table updated with project_id and view_defaults");
    
    // Add new columns to roadmap_items table
    await db.execute(sql`
      ALTER TABLE roadmap_items 
      ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'deliverable',
      ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
      ADD COLUMN IF NOT EXISTS description text,
      ADD COLUMN IF NOT EXISTS progress_mode text NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS parent_id uuid,
      ADD COLUMN IF NOT EXISTS epic_id uuid,
      ADD COLUMN IF NOT EXISTS feature_id uuid,
      ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS release_tag text,
      ADD COLUMN IF NOT EXISTS color text,
      ADD COLUMN IF NOT EXISTS rice jsonb NOT NULL DEFAULT '{}'::jsonb;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS roadmap_items_project_idx ON roadmap_items(project_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS roadmap_items_parent_idx ON roadmap_items(parent_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS roadmap_items_release_tag_idx ON roadmap_items(roadmap_id, release_tag);
    `);
    console.log("✅ Roadmap items table updated with new columns");
    
    // Create roadmap_item_links table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS roadmap_item_links (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        roadmap_item_id uuid NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
        linked_type text NOT NULL,
        linked_id uuid,
        linked_title text,
        weight integer NOT NULL DEFAULT 1,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS roadmap_item_links_roadmap_item_idx ON roadmap_item_links(roadmap_item_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS roadmap_item_links_linked_idx ON roadmap_item_links(linked_type, linked_id);
    `);
    console.log("✅ Roadmap item links table created");
    
    // Create roadmap_dependencies table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS roadmap_dependencies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        roadmap_item_id uuid NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
        depends_on_roadmap_item_id uuid NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
        type text NOT NULL DEFAULT 'finish_to_start',
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS roadmap_dependencies_roadmap_item_idx ON roadmap_dependencies(roadmap_item_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS roadmap_dependencies_depends_on_idx ON roadmap_dependencies(depends_on_roadmap_item_id);
    `);
    console.log("✅ Roadmap dependencies table created");
    
    // Create user_onboarding table for guided tour state
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_onboarding (
        user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
        completed boolean NOT NULL DEFAULT false,
        completed_at timestamp with time zone,
        last_step text,
        skipped boolean NOT NULL DEFAULT false,
        version text NOT NULL DEFAULT 'v1',
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    console.log("✅ User onboarding table created");

    // Update backlog state check constraints to include 'testing' and 'to_fix'
    await db.execute(sql`
      ALTER TABLE epics DROP CONSTRAINT IF EXISTS epics_state_check;
    `);
    await db.execute(sql`
      ALTER TABLE epics ADD CONSTRAINT epics_state_check 
        CHECK (state IN ('a_faire', 'en_cours', 'testing', 'to_fix', 'review', 'termine'));
    `);
    await db.execute(sql`
      ALTER TABLE user_stories DROP CONSTRAINT IF EXISTS user_stories_state_check;
    `);
    await db.execute(sql`
      ALTER TABLE user_stories ADD CONSTRAINT user_stories_state_check 
        CHECK (state IN ('a_faire', 'en_cours', 'testing', 'to_fix', 'review', 'termine'));
    `);
    await db.execute(sql`
      ALTER TABLE backlog_tasks DROP CONSTRAINT IF EXISTS backlog_tasks_state_check;
    `);
    await db.execute(sql`
      ALTER TABLE backlog_tasks ADD CONSTRAINT backlog_tasks_state_check 
        CHECK (state IN ('a_faire', 'en_cours', 'testing', 'to_fix', 'review', 'termine'));
    `);
    console.log("✅ Backlog state check constraints updated to include testing and to_fix");

    // Create CDC sessions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cdc_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'draft',
        current_step integer NOT NULL DEFAULT 1,
        completed_at timestamp with time zone,
        generated_backlog_id uuid,
        generated_roadmap_id uuid,
        created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cdc_sessions_account_project_idx 
      ON cdc_sessions(account_id, project_id);
    `);
    console.log("✅ CDC sessions table created");

    // Add new columns to project_scope_items
    await db.execute(sql`
      ALTER TABLE project_scope_items 
      ADD COLUMN IF NOT EXISTS cdc_session_id uuid REFERENCES cdc_sessions(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'functional',
      ADD COLUMN IF NOT EXISTS is_billable integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS phase text,
      ADD COLUMN IF NOT EXISTS generated_epic_id uuid,
      ADD COLUMN IF NOT EXISTS generated_user_story_id uuid,
      ADD COLUMN IF NOT EXISTS generated_roadmap_item_id uuid;
    `);
    // Make estimated_days nullable for CDC workflow
    await db.execute(sql`
      ALTER TABLE project_scope_items 
      ALTER COLUMN estimated_days DROP NOT NULL;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS project_scope_items_cdc_session_idx 
      ON project_scope_items(cdc_session_id);
    `);
    console.log("✅ Project scope items updated with CDC fields");

    // Create project baselines table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_baselines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        cdc_session_id uuid REFERENCES cdc_sessions(id) ON DELETE SET NULL,
        total_estimated_days numeric(10, 2) NOT NULL,
        billable_estimated_days numeric(10, 2) NOT NULL,
        non_billable_estimated_days numeric(10, 2) NOT NULL,
        by_type jsonb NOT NULL DEFAULT '{}',
        by_phase jsonb NOT NULL DEFAULT '{}',
        scope_items_snapshot jsonb NOT NULL DEFAULT '[]',
        version integer NOT NULL DEFAULT 1,
        created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS project_baselines_account_project_idx 
      ON project_baselines(account_id, project_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS project_baselines_project_idx 
      ON project_baselines(project_id);
    `);
    console.log("✅ Project baselines table created");

    // Add intelligent onboarding fields to projects
    await db.execute(sql`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS project_type_inferred text,
      ADD COLUMN IF NOT EXISTS billing_mode_suggested text,
      ADD COLUMN IF NOT EXISTS piloting_strategy text DEFAULT 'equilibre',
      ADD COLUMN IF NOT EXISTS expected_phases jsonb DEFAULT '["T1", "T2", "T3", "T4", "LT"]',
      ADD COLUMN IF NOT EXISTS expected_scope_types jsonb DEFAULT '["functional", "technical", "design", "gestion"]',
      ADD COLUMN IF NOT EXISTS onboarding_suggestions_shown integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS onboarding_suggestions_dismissed integer DEFAULT 0;
    `);
    console.log("✅ Project intelligent onboarding fields added");

    // Fix estimate_points column type from integer to real (for decimal values like 0.25, 0.5)
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'user_stories' 
          AND column_name = 'estimate_points' 
          AND data_type = 'integer'
        ) THEN
          ALTER TABLE user_stories ALTER COLUMN estimate_points TYPE real;
        END IF;
      END $$;
    `);
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'backlog_tasks' 
          AND column_name = 'estimate_points' 
          AND data_type = 'integer'
        ) THEN
          ALTER TABLE backlog_tasks ALTER COLUMN estimate_points TYPE real;
        END IF;
      END $$;
    `);
    console.log("✅ Estimate points columns migrated to real type");

    // Add completed_at column to project_scope_items for marking CDC rubriques as completed
    await db.execute(sql`
      ALTER TABLE project_scope_items 
      ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
    `);
    console.log("✅ Scope items completed_at column added");

    // Add version column to user_stories for product versioning
    await db.execute(sql`
      ALTER TABLE user_stories 
      ADD COLUMN IF NOT EXISTS version text;
    `);
    console.log("✅ User stories version column added");

    // Add version column to backlog_tasks for product versioning
    await db.execute(sql`
      ALTER TABLE backlog_tasks 
      ADD COLUMN IF NOT EXISTS version text;
    `);
    console.log("✅ Backlog tasks version column added");

    // Add task_type column to backlog_tasks to distinguish between task and bug
    await db.execute(sql`
      ALTER TABLE backlog_tasks 
      ADD COLUMN IF NOT EXISTS task_type text DEFAULT 'task';
    `);
    console.log("✅ Backlog tasks task_type column added");

    console.log("✅ Startup migrations completed successfully");
  } catch (error) {
    console.error("❌ Error running startup migrations:", error);
    throw error;
  }
}
