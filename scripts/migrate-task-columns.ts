import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD!;

if (!SUPABASE_URL || !SUPABASE_DB_PASSWORD) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_DB_PASSWORD environment variables");
  process.exit(1);
}

// Extract project reference from URL
const projectRef = SUPABASE_URL.replace("https://", "").split(".")[0];
const connectionString = `postgresql://postgres.${projectRef}:${SUPABASE_DB_PASSWORD}@aws-1-eu-north-1.pooler.supabase.com:5432/postgres`;

console.log("🔗 Connecting to Supabase project:", projectRef);
console.log("📡 Using Supabase Session pooler (IPv4): aws-1-eu-north-1.pooler.supabase.com:5432");

const sql = postgres(connectionString);

async function runMigration() {
  try {
    console.log("📝 Reading migration SQL file...");
    const sqlContent = fs.readFileSync(
      path.join(process.cwd(), "scripts", "add-task-columns.sql"),
      "utf-8"
    );

    console.log("🚀 Executing migration...");
    await sql.unsafe(sqlContent);

    console.log("✅ Migration completed successfully!");

    // Verify the changes
    console.log("\n🔍 Verifying migration...");
    
    const columnsResult = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' 
      AND column_name IN ('column_id', 'assigned_to_id', 'position_in_column', 'due_date')
    `;
    
    console.log("✅ Tasks table columns added:");
    columnsResult.forEach((col: any) => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    const taskColumnsCount = await sql`SELECT COUNT(*) as count FROM task_columns`;
    console.log(`\n✅ Task columns created: ${taskColumnsCount[0].count} columns`);

    const taskColumnsData = await sql`
      SELECT id, account_id, project_id, name, color, "order", is_locked 
      FROM task_columns 
      ORDER BY project_id, "order"
      LIMIT 10
    `;
    
    console.log("\n📋 Sample task columns:");
    taskColumnsData.forEach((col: any) => {
      console.log(`  - ${col.name} (${col.color}) - Order: ${col.order}, Locked: ${col.is_locked}`);
    });

  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
