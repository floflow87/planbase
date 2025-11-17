import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function check() {
  try {
    console.log("🔍 Checking Supabase data...\n");
    
    const projects = await db.execute(sql`SELECT id, account_id, name FROM projects LIMIT 10`);
    console.log(`✅ Projects:`, projects);
    
    const accounts = await db.execute(sql`SELECT id, name, owner_user_id FROM accounts ORDER BY created_at DESC LIMIT 10`);
    console.log(`\n✅ Accounts:`, accounts);
    
    const clients = await db.execute(sql`SELECT id, account_id, name FROM clients LIMIT 10`);
    console.log(`\n✅ Clients:`, clients);
    
    process.exit(0);
  } catch (e: any) {
    console.error('❌ Error:', e);
    console.error('Stack:', e.stack);
    process.exit(1);
  }
}

check();
