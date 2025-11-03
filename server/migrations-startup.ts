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
    
    console.log("✅ Startup migrations completed successfully");
  } catch (error) {
    console.error("❌ Error running startup migrations:", error);
    throw error;
  }
}
