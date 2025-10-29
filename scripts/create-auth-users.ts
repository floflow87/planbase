/**
 * Script to create demo users in Supabase Auth
 * 
 * This creates two demo users with proper metadata:
 * - owner@demo.com (owner role)
 * - collaborator@demo.com (collaborator role)
 * 
 * Both users belong to the Demo Startup account
 */

import { createClient } from '@supabase/supabase-js';
import { db } from '../server/db';
import { accounts, appUsers } from '../shared/schema';
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

async function createAuthUsers() {
  try {
    console.log('🔍 Looking for Demo Startup account...');
    
    // Find the Demo Startup account
    const [demoAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.name, 'Demo Startup'))
      .limit(1);

    if (!demoAccount) {
      console.error('❌ Demo Startup account not found. Please run the seed script first.');
      process.exit(1);
    }

    console.log(`✅ Found account: ${demoAccount.name} (${demoAccount.id})`);

    // Find existing users in the database
    const existingUsers = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.accountId, demoAccount.id));

    console.log(`\n📋 Found ${existingUsers.length} existing users in database`);

    const usersToCreate = [
      {
        email: 'owner@demo.com',
        password: 'demo123',
        role: 'owner' as const,
        name: 'Demo Owner',
      },
      {
        email: 'collaborator@demo.com',
        password: 'demo123',
        role: 'collaborator' as const,
        name: 'Demo Collaborator',
      },
    ];

    for (const userData of usersToCreate) {
      console.log(`\n👤 Processing ${userData.email}...`);

      // Find the corresponding user in the database
      const dbUser = existingUsers.find(u => u.email === userData.email);
      
      if (!dbUser) {
        console.log(`⚠️  User ${userData.email} not found in database, skipping...`);
        continue;
      }

      console.log(`   Database user ID: ${dbUser.id}`);

      // Check if auth user already exists
      const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
      const existingAuthUser = existingAuthUsers?.users.find(u => u.email === userData.email);

      if (existingAuthUser) {
        console.log(`   ⚠️  Auth user already exists (${existingAuthUser.id})`);
        
        // Update metadata to ensure it's correct
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingAuthUser.id,
          {
            user_metadata: {
              account_id: demoAccount.id,
              role: userData.role,
              name: userData.name,
            },
          }
        );

        if (updateError) {
          console.error(`   ❌ Error updating metadata:`, updateError.message);
        } else {
          console.log(`   ✅ Updated metadata successfully`);
        }
        continue;
      }

      // Create new auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          account_id: demoAccount.id,
          role: userData.role,
          name: userData.name,
        },
      });

      if (createError) {
        console.error(`   ❌ Error creating user:`, createError.message);
      } else {
        console.log(`   ✅ Created successfully!`);
        console.log(`   Auth ID: ${newUser.user?.id}`);
        console.log(`   Metadata: account_id=${demoAccount.id}, role=${userData.role}`);
      }
    }

    console.log('\n✨ Auth users setup complete!');
    console.log('\n📝 Demo credentials:');
    console.log('   Email: owner@demo.com or collaborator@demo.com');
    console.log('   Password: demo123');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAuthUsers();
