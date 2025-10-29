/**
 * Update the demo user in Supabase Auth
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function updateDemoUser() {
  try {
    // Find the user with old email
    const { data: users } = await supabase.auth.admin.listUsers();
    const oldUser = users?.users.find(u => u.email === 'owner@demo.com');

    if (!oldUser) {
      console.log('❌ User owner@demo.com not found');
      return;
    }

    console.log(`✅ Found user: ${oldUser.id}`);

    // Update the user
    const { data, error } = await supabase.auth.admin.updateUserById(oldUser.id, {
      email: 'floflow87@planbase.com',
      email_confirm: true,
      user_metadata: {
        ...oldUser.user_metadata,
        firstName: 'Florent',
        lastName: 'Martin',
        displayName: 'Florent Martin',
        jobTitle: 'Admin',
        gender: 'male',
      },
    });

    if (error) {
      console.error('❌ Error updating user:', error.message);
    } else {
      console.log('✅ User updated successfully!');
      console.log(`   Email: ${data.user?.email}`);
      console.log(`   Metadata:`, data.user?.user_metadata);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateDemoUser();
