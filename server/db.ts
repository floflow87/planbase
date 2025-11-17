// Supabase PostgreSQL connection with Drizzle ORM
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";
import * as fs from 'fs';
import * as path from 'path';

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL must be set");
}

if (!process.env.SUPABASE_DB_PASSWORD) {
  throw new Error("SUPABASE_DB_PASSWORD must be set");
}

// Extract project reference from Supabase URL
const projectRef = process.env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Read the detected region from cache file
const REGION_CACHE_FILE = path.join(process.cwd(), '.supabase-region');
let region = 'eu-west-1'; // Default fallback

if (fs.existsSync(REGION_CACHE_FILE)) {
  region = fs.readFileSync(REGION_CACHE_FILE, 'utf-8').trim();
  console.log(`🔗 Connecting to Supabase PostgreSQL (project: ${projectRef}, region: ${region})`);
} else {
  console.log(`⚠️  No cached region found, using default: ${region}`);
}

// Supabase PostgreSQL Session pooler connection (IPv4 compatible)
const connectionString = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-${region}.pooler.supabase.com:5432/postgres`;

// Create postgres connection
const client = postgres(connectionString, {
  prepare: false,
  max: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
