import { sql } from 'drizzle-orm';
import { db } from '../server/db';

async function fixTasksTable() {
  console.log('Adding missing columns to tasks table...');
  
  try {
    // Add assignees column (text array)
    await db.execute(sql`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS assignees text[] NOT NULL DEFAULT ARRAY[]::text[];
    `);
    console.log('✓ Added assignees column');
    
    // Add order column
    await db.execute(sql`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS "order" integer NOT NULL DEFAULT 0;
    `);
    console.log('✓ Added order column');
    
    // Add due_date column
    await db.execute(sql`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS due_date timestamp with time zone;
    `);
    console.log('✓ Added due_date column');
    
    console.log('✅ Tasks table fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing tasks table:', error);
    process.exit(1);
  }
}

fixTasksTable();
