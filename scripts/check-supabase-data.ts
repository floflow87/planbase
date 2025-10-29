/**
 * Check data in Supabase database
 */

import { db } from '../server/db';
import { appUsers } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function checkData() {
  try {
    console.log('🔍 Checking Supabase database for user data...\n');

    // Get all users
    const users = await db.select().from(appUsers);
    console.log(`📊 Total users: ${users.length}\n`);

    // Get floflow87 specifically
    const [floflowUser] = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.email, 'floflow87@planbase.com'));

    if (floflowUser) {
      console.log('✅ Found user floflow87@planbase.com:');
      console.log('-----------------------------------');
      console.log(`ID: ${floflowUser.id}`);
      console.log(`Email: ${floflowUser.email}`);
      console.log(`First Name: ${floflowUser.firstName || '(empty)'}`);
      console.log(`Last Name: ${floflowUser.lastName || '(empty)'}`);
      console.log(`Gender: ${floflowUser.gender || '(empty)'}`);
      console.log(`Position: ${floflowUser.position || '(empty)'}`);
      console.log(`Role: ${floflowUser.role}`);
      console.log(`Account ID: ${floflowUser.accountId}`);
      console.log('-----------------------------------\n');
    } else {
      console.log('❌ User floflow87@planbase.com NOT FOUND in Supabase\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkData();
