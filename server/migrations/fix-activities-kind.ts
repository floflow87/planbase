import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixActivitiesKind() {
  console.log('🔄 Adding time_tracked to activities kind check constraint...');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE activities 
      DROP CONSTRAINT IF EXISTS activities_kind_check;
      
      ALTER TABLE activities 
      ADD CONSTRAINT activities_kind_check 
      CHECK (kind IN ('email','call','meeting','note','task','file','time_tracked','created','updated','deleted'));
    `
  });

  if (error) {
    console.error('❌ Error:', error);
    throw error;
  }

  console.log('✅ Successfully updated activities kind constraint');
}

fixActivitiesKind().catch(console.error);
