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

// Supabase Connection via IPv4 Pooler (required because direct connection is IPv6-only)
// CRITICAL: Username format MUST be "postgres.{PROJECT_REF}" for pooler
const connectionString = process.env.SUPABASE_DB_PASSWORD
  ? `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
  : `postgresql://postgres:postgres@localhost:5432/postgres`;

console.log(`🔗 Connecting to Supabase project: ${projectRef}`);
console.log(`📡 Using pooler (IPv4): aws-0-eu-central-1.pooler.supabase.com:6543`);

// Create postgres connection
const client = postgres(connectionString, {
  prepare: false, // Required for Supabase pooler
  max: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
