// Auto-detect Supabase region and create connection
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const REGION_CACHE_FILE = path.join(process.cwd(), '.supabase-region');

export async function detectSupabaseRegion(): Promise<string> {
  // Check cache first
  if (fs.existsSync(REGION_CACHE_FILE)) {
    const cachedRegion = fs.readFileSync(REGION_CACHE_FILE, 'utf-8').trim();
    console.log(`📍 Using cached Supabase region: ${cachedRegion}`);
    return cachedRegion;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_DB_PASSWORD) {
    throw new Error("SUPABASE_URL and SUPABASE_DB_PASSWORD must be set");
  }

  const projectRef = process.env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
  
  const regions = [
    'eu-west-1',      // Europe West (Ireland)
    'eu-central-1',   // Europe Central (Frankfurt) 
    'us-east-1',      // US East (Virginia)
    'us-west-1',      // US West (California)
    'ap-southeast-1', // Asia Pacific (Singapore)
    'ap-northeast-1', // Asia Pacific (Tokyo)
  ];

  console.log('🔍 Auto-detecting Supabase region...');

  for (const region of regions) {
    const connectionString = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
    
    try {
      const testClient = postgres(connectionString, {
        prepare: false,
        max: 1,
        idle_timeout: 3,
        connect_timeout: 5,
        onnotice: () => {},
      });
      
      await testClient`SELECT 1`;
      await testClient.end();
      
      console.log(`✅ Found Supabase region: ${region}`);
      
      // Cache the region for future use
      fs.writeFileSync(REGION_CACHE_FILE, region);
      
      return region;
    } catch (error: any) {
      console.log(`  ❌ ${region}: ${error.message.split('\n')[0]}`);
    }
  }
  
  throw new Error('Failed to connect to Supabase in any region. Please check SUPABASE_DB_PASSWORD.');
}
