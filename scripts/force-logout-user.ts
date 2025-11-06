/**
 * Script to force logout a user by signing out all their sessions
 * This is useful when changing email/password and the user has stale sessions
 */

import { createClient } from '@supabase/supabase-js';

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

async function forceLogout() {
  try {
    const userId = '9fe4ddc0-6d3f-4d69-9c77-fc9cb2e79c8d';

    console.log('🔄 Forcing logout for user floflow87...\n');

    // Sign out all sessions for this user
    console.log('1️⃣ Signing out all sessions...');
    const { error } = await supabase.auth.admin.signOut(userId, 'global');

    if (error) {
      console.error('❌ Error signing out user:', error);
      throw error;
    }

    console.log('✅ All sessions signed out successfully');

    console.log('\n✨ User has been logged out from all devices!');
    console.log('\n📋 Next steps:');
    console.log('   1. Refresh your browser (or clear browser cache)');
    console.log('   2. Go to the login page');
    console.log('   3. Login with:');
    console.log('      Email: floflow87@planbase.io');
    console.log('      Password: Test25');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

forceLogout();
