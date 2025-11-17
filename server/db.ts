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
// Format: https://xxxxx.supabase.co -> xxxxx
const projectRef = process.env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Supabase PostgreSQL Session pooler (IPv4 compatible, port 5432)
// Format: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
const connectionString = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

console.log(`🔗 Connecting to Supabase PostgreSQL (project: ${projectRef}, region: eu-west-1)`);

// Create postgres connection
const client = postgres(connectionString, {
  prepare: false,
  max: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
