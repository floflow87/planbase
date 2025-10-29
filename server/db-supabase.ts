// Supabase connection configuration
// Reference: Supabase PostgreSQL connection with Drizzle ORM
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL must be set");
}

// Extract project reference from Supabase URL
// Format: https://xxxxx.supabase.co -> xxxxx
const projectRef = process.env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Supabase PostgreSQL connection string
// You'll need to add SUPABASE_DB_PASSWORD as a secret
const connectionString = process.env.SUPABASE_DB_PASSWORD 
  ? `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
  : process.env.DATABASE_URL; // Fallback to existing DATABASE_URL if no password provided

if (!connectionString) {
  throw new Error("Either SUPABASE_DB_PASSWORD or DATABASE_URL must be set");
}

// Create postgres connection
const client = postgres(connectionString, {
  prepare: false,
});

export const db = drizzle(client, { schema });
