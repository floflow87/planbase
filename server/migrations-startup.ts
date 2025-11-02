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
    
    console.log("✅ Startup migrations completed successfully");
  } catch (error) {
    console.error("❌ Error running startup migrations:", error);
    throw error;
  }
}
