/**
 * Seed database with demo data
 */

import { db } from '../server/db';
import { accounts, appUsers, clients, projects } from '../shared/schema';

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    // Get Supabase Auth user ID
    const authUserId = '9fe4ddc0-6d3f-4d69-9c77-fc9cb2e79c8d'; // floflow87@planbase.com from Supabase Auth
    const accountId = '67a3cb31-7755-43f2-81e0-4436d5d0684f';

    // Create account
    console.log('Creating account...');
    await db.insert(accounts).values({
      id: accountId,
      name: 'Demo Startup',
      ownerUserId: authUserId,
      plan: 'pro',
      settings: {},
    }).onConflictDoNothing();

    // Create app_user linked to Supabase Auth
    console.log('Creating app user...');
    await db.insert(appUsers).values({
      id: authUserId, // Same as Supabase Auth user ID
      accountId: accountId,
      email: 'floflow87@planbase.com',
      role: 'owner',
      profile: {
        firstName: 'Florent',
        lastName: 'Martin',
        displayName: 'Florent Martin',
        jobTitle: 'Admin',
        gender: 'male',
      },
    }).onConflictDoNothing();

    // Create a client
    console.log('Creating client...');
    const [client] = await db.insert(clients).values({
      accountId: accountId,
      type: 'company',
      name: 'TechCorp Inc.',
      contacts: [
        { name: 'John Doe', email: 'john@techcorp.com', phone: '+1234567890', role: 'CEO' }
      ],
      tags: ['tech', 'startup'],
      status: 'active',
      budget: 50000,
      createdBy: authUserId,
    }).returning();

    // Create a project
    console.log('Creating project...');
    await db.insert(projects).values({
      accountId: accountId,
      clientId: client.id,
      name: 'Website Redesign',
      stage: 'in_progress',
      budget: 25000,
      tags: ['web', 'design'],
      meta: { priority: 'high' },
      createdBy: authUserId,
    });

    console.log('✅ Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
