// Supabase PostgreSQL connection with Drizzle ORM
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Use DATABASE_URL from Replit/Supabase integration (already configured)
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

console.log(`🔗 Connecting to Supabase database...`);
console.log(`📡 Using connection string from DATABASE_URL`);

// Create postgres connection
const client = postgres(connectionString, {
  max: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
