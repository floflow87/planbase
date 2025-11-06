/**
 * Script to update floflow87 user email and password
 * 
 * This script:
 * 1. Updates email in Supabase Auth
 * 2. Updates password in Supabase Auth
 * 3. Updates email in app_users table
 */

import { createClient } from '@supabase/supabase-js';
import { db } from '../server/db';
import { appUsers } from '../shared/schema';
import { eq } from 'drizzle-orm';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function updateUser() {
  try {
    const userId = '9fe4ddc0-6d3f-4d69-9c77-fc9cb2e79c8d';
    const newEmail = 'floflow87@planbase.io';
    const newPassword = 'Test25';

    console.log('🔄 Updating user floflow87...\n');

    // Step 1: Update email in Supabase Auth
    console.log('1️⃣ Updating email in Supabase Auth...');
    const { data: authUser, error: emailError } = await supabase.auth.admin.updateUserById(
      userId,
      { 
        email: newEmail,
        email_confirm: true, // Auto-confirm the email
      }
    );

    if (emailError) {
      console.error('❌ Error updating email in Supabase Auth:', emailError);
      throw emailError;
    }

    console.log(`✅ Email updated in Supabase Auth to: ${newEmail}`);

    // Step 2: Update password in Supabase Auth
    console.log('\n2️⃣ Updating password in Supabase Auth...');
    const { error: passwordError } = await supabase.auth.admin.updateUserById(
      userId,
      { 
        password: newPassword,
      }
    );

    if (passwordError) {
      console.error('❌ Error updating password in Supabase Auth:', passwordError);
      throw passwordError;
    }

    console.log('✅ Password updated in Supabase Auth');

    // Step 3: Update email in app_users table
    console.log('\n3️⃣ Updating email in app_users table...');
    await db
      .update(appUsers)
      .set({ email: newEmail })
      .where(eq(appUsers.id, userId));

    console.log(`✅ Email updated in app_users table to: ${newEmail}`);

    console.log('\n✨ User updated successfully!');
    console.log('\n📋 Login credentials:');
    console.log(`   Email: ${newEmail}`);
    console.log(`   Password: ${newPassword}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateUser();
