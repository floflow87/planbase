// Supabase PostgreSQL connection with Drizzle ORM
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Build Supabase connection string from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabasePassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !supabasePassword) {
  throw new Error("SUPABASE_URL and SUPABASE_DB_PASSWORD must be set. Found in Secrets.");
}

// Extract project ref from SUPABASE_URL (e.g., https://gfftezyrhsxtaeceuszd.supabase.co)
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

// Supabase Pooler connection (port 6543) - bypasses connection pooling for direct access
const connectionString = `postgresql://postgres.${projectRef}:${supabasePassword}@aws-0-eu-north-1.pooler.supabase.com:6543/postgres`;

console.log(`🔗 Connecting to Supabase PostgreSQL: ${projectRef}`);
console.log(`📡 Using Supabase Pooler (port 6543)`);

// Create postgres connection for Supabase
const client = postgres(connectionString, {
  prepare: false,
  max: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
