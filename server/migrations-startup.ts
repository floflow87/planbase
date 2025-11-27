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
    
    // Update activities constraints to support note, task, document
    await db.execute(sql`
      DO $$ 
      BEGIN
        -- Drop old constraint if it exists
        ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_subject_type_check;
        
        -- Add new constraint with extended values including mindmap
        ALTER TABLE activities 
        ADD CONSTRAINT activities_subject_type_check 
        CHECK (subject_type IN ('client','deal','project','note','task','document','mindmap'));
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
        CHECK (kind IN ('created','updated','deleted','email','call','meeting','note','task','file'));
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
    
    console.log("✅ Startup migrations completed successfully");
  } catch (error) {
    console.error("❌ Error running startup migrations:", error);
    throw error;
  }
}
