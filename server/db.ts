// Supabase PostgreSQL connection with Drizzle ORM
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL must be set");
}

// Extract project reference from Supabase URL
// Format: https://gfftezyrhsxtaeceuszd.supabase.co -> gfftezyrhsxtaeceuszd
const projectRef = process.env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Supabase Connection Pooler (Transaction Mode)
// Format: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
const connectionString = process.env.SUPABASE_DB_PASSWORD
  ? `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
  : `postgresql://postgres:postgres@db.${projectRef}.supabase.co:5432/postgres`;

// Create postgres connection
const client = postgres(connectionString, {
  prepare: false, // Required for Supabase connection pooler
  max: 10, // Connection pool size
});

export const db = drizzle(client, { schema });
