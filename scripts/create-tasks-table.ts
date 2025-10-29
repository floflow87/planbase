import { sql } from 'drizzle-orm';
import { db } from '../server/db';

async function createTasksTable() {
  console.log('Creating tasks table in Supabase...');
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title text NOT NULL,
        description text,
        status text NOT NULL DEFAULT 'todo',
        priority text NOT NULL DEFAULT 'medium',
        progress integer NOT NULL DEFAULT 0,
        created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_account_id ON tasks(account_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`);
    
    console.log('✅ Tasks table created successfully in Supabase!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating tasks table:', error);
    process.exit(1);
  }
}

createTasksTable();
