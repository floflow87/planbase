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

// Try Transaction pooler (port 6543) which was in the original config
// This pooler is IPv4 compatible and doesn't require prepared statements
const regions = ['eu-central-1', 'eu-west-1', 'us-east-1', 'ap-southeast-1'];
const region = process.env.SUPABASE_REGION || regions[0];

const connectionString = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-${region}.pooler.supabase.com:6543/postgres`;

console.log(`🔗 Connecting to Supabase (project: ${projectRef}, region: ${region}, port: 6543)`);

// Create postgres connection
// Transaction pooler requires prepare: false
const client = postgres(connectionString, {
  prepare: false,
  max: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
