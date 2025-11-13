// Check Google OAuth settings in Supabase
import postgres from 'postgres';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabasePassword = process.env.SUPABASE_DB_PASSWORD!;
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
const connectionString = `postgresql://postgres.${projectRef}:${supabasePassword}@aws-1-eu-north-1.pooler.supabase.com:5432/postgres`;

console.log(`📡 Connecting to Supabase: ${projectRef}`);

const client = postgres(connectionString, { prepare: false, max: 1 });

async function checkSettings() {
  try {
    // Get all accounts
    const accounts = await client`
      SELECT id, name, settings
      FROM accounts
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    console.log('\n📊 Accounts in Supabase:');
    accounts.forEach((acc: any) => {
      console.log(`\n  Account: ${acc.name} (${acc.id})`);
      console.log(`  Settings:`, acc.settings);
      
      if (acc.settings?.googleClientId) {
        console.log(`  ✅ Google Client ID: ${acc.settings.googleClientId.substring(0, 20)}...`);
      } else {
        console.log(`  ❌ No Google Client ID`);
      }
      
      if (acc.settings?.googleClientSecret) {
        console.log(`  ✅ Google Client Secret: ${acc.settings.googleClientSecret.substring(0, 10)}...`);
      } else {
        console.log(`  ❌ No Google Client Secret`);
      }
    });
    
    await client.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

checkSettings();
