// Supabase PostgreSQL connection with Drizzle ORM
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Build Supabase connection string from environment variables
// Extract project ref from SUPABASE_URL (e.g., https://gfftezyrhsxtaeceuszd.supabase.co)
const supabaseUrl = process.env.SUPABASE_URL;
const supabasePassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !supabasePassword) {
  throw new Error("SUPABASE_URL and SUPABASE_DB_PASSWORD must be set. Found in Secrets.");
}

const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

// Use Supabase Direct connection (port 6543) to bypass pooler cache
const connectionString = `postgresql://postgres.${projectRef}:${supabasePassword}@aws-1-eu-north-1.pooler.supabase.com:6543/postgres`;

console.log(`🔗 Connecting to Supabase project: ${projectRef}`);
console.log(`📡 Using Supabase Direct connection (port 6543) to bypass cache`);

// Create postgres connection
const client = postgres(connectionString, {
  prepare: false,
  max: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
