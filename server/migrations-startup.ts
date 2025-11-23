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
        
        -- Add new constraint with extended values
        ALTER TABLE activities 
        ADD CONSTRAINT activities_subject_type_check 
        CHECK (subject_type IN ('client','deal','project','note','task','document'));
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
    
    console.log("✅ Startup migrations completed successfully");
  } catch (error) {
    console.error("❌ Error running startup migrations:", error);
    throw error;
  }
}
