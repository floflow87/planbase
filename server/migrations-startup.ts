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
        created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    // Create index on account_id for client_custom_tabs if it doesn't exist
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS client_custom_tabs_account_id_idx 
      ON client_custom_tabs(account_id);
    `);
    
    console.log("✅ Startup migrations completed successfully");
  } catch (error) {
    console.error("❌ Error running startup migrations:", error);
    throw error;
  }
}
