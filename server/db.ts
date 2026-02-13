import dotenv from "dotenv";

dotenv.config({ path: "F:\\Projets\\planbase\\server\\.env" });

console.log("db.ts sees SUPABASE_URL?", !!process.env.SUPABASE_URL);

console.log("db.ts sees SUPABASE_URL?", !!process.env.SUPABASE_URL);


// Supabase PostgreSQL connection with Drizzle ORM
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL must be set");
}

if (!process.env.SUPABASE_DB_PASSWORD) {
  throw new Error("SUPABASE_DB_PASSWORD must be set");
}

// Extract project reference from Supabase URL
const projectRef = process.env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Supabase region: eu-north-1 (Stockholm)
// Using Transaction pooler (port 6543) - IPv4 compatible, no prepared statements
const connectionString = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD}@aws-1-eu-north-1.pooler.supabase.com:6543/postgres`;

console.log(`🔗 Connecting to Supabase (project: ${projectRef}, region: eu-north-1, pooler: Transaction)`);

// Create postgres connection
// Transaction pooler requires prepare: false
const client = postgres(connectionString, {
  prepare: false,
  max: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
