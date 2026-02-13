import dotenv from "dotenv";
dotenv.config({ path: "F:\\Projets\\planbase\\server\\.env" });

import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });


import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
