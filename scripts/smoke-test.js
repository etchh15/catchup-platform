#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables.');
  console.error('Set SUPABASE_URL and SUPABASE_KEY, or REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Supabase smoke test starting...');

  const { data: sessionData, error: authError } = await supabase.auth.getSession();
  if (authError) {
    console.error('Warning: auth session check failed:', authError.message);
  } else {
    console.log('Auth session check OK:', sessionData?.data?.session ? 'session active' : 'no session');
  }

  const tables = ['tasks', 'profiles', 'bids', 'messages'];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.error(`✗ ${table} query failed:`, error.message);
    } else {
      console.log(`✓ ${table} query OK (${Array.isArray(data) ? data.length : 0} rows returned)`);
    }
  }

  console.log('Smoke test complete.');
}

run().catch((err) => {
  console.error('Unexpected error during smoke test:', err.message || err);
  process.exit(1);
});
