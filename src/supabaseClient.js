import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '⚠️  Supabase credentials missing.\n' +
    'Create a .env file in the project root with:\n' +
    '  REACT_APP_SUPABASE_URL=https://xxxx.supabase.co\n' +
    '  REACT_APP_SUPABASE_ANON_KEY=your-anon-key\n'
  );
}

export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
