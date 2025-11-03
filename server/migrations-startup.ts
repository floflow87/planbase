// Auto-run migrations at server startup to ensure schema is up-to-date
import { db } from "./db";
import { sql } from "drizzle-orm";

export async function runStartupMigrations() {
  console.log("🔄 Running startup migrations...");
  
  try {
    // Add effort column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS effort integer;
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
    
    console.log("✅ Startup migrations completed successfully");
  } catch (error) {
    console.error("❌ Error running startup migrations:", error);
    throw error;
  }
}
