// PostgreSQL connection with Drizzle ORM
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Use DATABASE_URL from environment (can be Neon, Supabase, or any PostgreSQL)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

console.log(`🔗 Connecting to PostgreSQL database via DATABASE_URL`);

// Create postgres connection
const client = postgres(connectionString, {
  prepare: false,
  max: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
