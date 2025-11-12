// Push missing tables to Supabase database
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

// Build Supabase connection string
const supabaseUrl = process.env.SUPABASE_URL!;
const supabasePassword = process.env.SUPABASE_DB_PASSWORD!;
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
const connectionString = `postgresql://postgres.${projectRef}:${supabasePassword}@aws-1-eu-north-1.pooler.supabase.com:5432/postgres`;

console.log(`📡 Connecting to Supabase: ${projectRef}`);

const client = postgres(connectionString, { prepare: false, max: 1 });

async function pushMissingTables() {
  try {
    // Read SQL file with missing tables
    const schemaPath = join(process.cwd(), 'supabase-missing-tables.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');
    
    console.log('📋 Creating missing tables in Supabase...');
    
    // Execute the SQL file
    await client.unsafe(schemaSql);
    
    console.log('✅ Missing tables created successfully!');
    
    // Verify tables
    const tables = await client`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('tasks', 'task_columns', 'appointments', 'google_calendar_tokens')
      ORDER BY tablename
    `;
    
    console.log(`\n✅ ${tables.length} tables verified:`);
    tables.forEach(t => console.log(`   - ${t.tablename}`));
    
    await client.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating tables:', error.message);
    await client.end();
    process.exit(1);
  }
}

pushMissingTables();
