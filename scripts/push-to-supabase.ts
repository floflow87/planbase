// Push complete schema to Supabase database
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

// Build Supabase connection string (same as server/db.ts)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabasePassword = process.env.SUPABASE_DB_PASSWORD!;
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
const connectionString = `postgresql://postgres.${projectRef}:${supabasePassword}@aws-1-eu-north-1.pooler.supabase.com:5432/postgres`;

console.log(`📡 Connecting to Supabase: ${projectRef}`);

const client = postgres(connectionString, { prepare: false, max: 1 });

async function pushSchema() {
  try {
    // Read SQL schema file
    const schemaPath = join(process.cwd(), 'supabase-schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');
    
    console.log('📋 Executing Supabase schema SQL...');
    
    // Execute the complete SQL file
    await client.unsafe(schemaSql);
    
    console.log('✅ Schema pushed successfully to Supabase!');
    
    // Verify tables created
    const tables = await client`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;
    
    console.log(`\n✅ ${tables.length} tables created:`);
    tables.forEach(t => console.log(`   - ${t.tablename}`));
    
    await client.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error pushing schema:', error.message);
    await client.end();
    process.exit(1);
  }
}

pushSchema();
