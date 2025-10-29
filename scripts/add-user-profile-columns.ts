import { sql } from 'drizzle-orm';
import { db } from '../server/db';

async function addUserProfileColumns() {
  console.log('Adding profile columns to app_users table...');
  
  try {
    // Add first_name column
    await db.execute(sql`
      ALTER TABLE app_users 
      ADD COLUMN IF NOT EXISTS first_name text;
    `);
    console.log('✓ Added first_name column');
    
    // Add last_name column
    await db.execute(sql`
      ALTER TABLE app_users 
      ADD COLUMN IF NOT EXISTS last_name text;
    `);
    console.log('✓ Added last_name column');
    
    // Add gender column
    await db.execute(sql`
      ALTER TABLE app_users 
      ADD COLUMN IF NOT EXISTS gender text;
    `);
    console.log('✓ Added gender column');
    
    // Add position column
    await db.execute(sql`
      ALTER TABLE app_users 
      ADD COLUMN IF NOT EXISTS position text;
    `);
    console.log('✓ Added position column');
    
    // Add avatar_url column
    await db.execute(sql`
      ALTER TABLE app_users 
      ADD COLUMN IF NOT EXISTS avatar_url text;
    `);
    console.log('✓ Added avatar_url column');
    
    console.log('✅ All profile columns added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding profile columns:', error);
    process.exit(1);
  }
}

addUserProfileColumns();
