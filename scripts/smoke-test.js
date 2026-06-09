#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

for (const envFile of ['.env.local', '.env']) {
  const envPath = path.join(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) continue;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables.');
  console.error('Set SUPABASE_URL and SUPABASE_KEY, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.');
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

  const tables = ['tasks', 'profiles', 'bids', 'workspace_rooms', 'workspace_messages', 'reviews', 'specialist_client_ratings'];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.error(`FAIL ${table} query failed:`, error.message);
    } else {
      console.log(`OK ${table} query (${Array.isArray(data) ? data.length : 0} rows returned)`);
    }
  }

  const rpcContracts = [
    {
      name: 'send_workspace_message',
      args: {
        p_room_identifier: '00000000-0000-0000-0000-000000000000',
        p_task_identifier: null,
        p_message_text: 'contract-check',
      },
    },
    {
      name: 'expire_stale_bid_requests',
      args: {},
    },
    {
      name: 'submit_task_review',
      args: {
        p_room_id: null,
        p_task_id: '00000000-0000-0000-0000-000000000000',
        p_specialist_id: '00000000-0000-0000-0000-000000000000',
        p_rating_score: 5,
        p_feedback_text: 'contract-check',
      },
    },
    {
      name: 'fetch_workspace_review',
      args: {
        p_room_id: null,
        p_task_id: '00000000-0000-0000-0000-000000000000',
        p_client_id: null,
        p_specialist_id: null,
      },
    },
    {
      name: 'ensure_completion_receipt',
      args: {
        p_task_id: '00000000-0000-0000-0000-000000000000',
        p_agreement_id: null,
        p_receipt_type: 'service_agreement',
        p_note: 'contract-check',
      },
    },
    {
      name: 'fetch_completion_receipt',
      args: {
        p_task_id: '00000000-0000-0000-0000-000000000000',
        p_receipt_type: 'service_agreement',
      },
    },
    {
      name: 'rate_client_after_completion',
      args: {
        p_task_id: '00000000-0000-0000-0000-000000000000',
        p_rating: 5,
        p_comment: 'contract-check',
      },
    },
    {
      name: 'recalculate_specialist_reputation',
      args: {
        p_specialist_id: '00000000-0000-0000-0000-000000000000',
      },
    },
    {
      name: 'recalculate_client_reputation',
      args: {
        p_client_id: '00000000-0000-0000-0000-000000000000',
      },
    },
    {
      name: 'recalculate_all_marketplace_reputation',
      args: {},
    },
    {
      name: 'confirm_task_work_completed',
      args: {
        p_task_id: '00000000-0000-0000-0000-000000000000',
        p_message: 'contract-check',
      },
    },
    {
      name: 'reserve_appointment_slot',
      args: {
        p_task_id: '00000000-0000-0000-0000-000000000000',
        p_agreement_id: null,
        p_starts_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        p_duration_minutes: 60,
        p_fulfillment_type: 'ONLINE',
        p_service_address: null,
        p_notes: 'contract-check',
        p_destination_latitude: null,
        p_destination_longitude: null,
      },
    },
    {
      name: 'confirm_appointment_slot',
      args: {
        p_appointment_id: '00000000-0000-0000-0000-000000000000',
      },
    },
  ];

  for (const contract of rpcContracts) {
    const { error } = await supabase.rpc(contract.name, contract.args);
    if (!error) {
      console.log(`OK ${contract.name} callable`);
      continue;
    }

    const message = String(error.message || '');
    const missing = error.code === '42883' || message.includes('does not exist') || message.includes('not found');
    if (missing) {
      console.error(`FAIL ${contract.name} missing:`, message);
      process.exitCode = 1;
    } else {
      console.log(`OK ${contract.name} present (${message})`);
    }
  }

  const forbiddenRuntimePatterns = [
    'child_process',
    'dangerouslySetInnerHTML',
    'new Function',
    'eval(',
  ];

  console.log('Runtime shell/code-execution guardrails:');
  for (const pattern of forbiddenRuntimePatterns) {
    console.log(`- Scan source for "${pattern}" before production deploys.`);
  }

  console.log('Smoke test complete.');
}

run().catch((err) => {
  console.error('Unexpected error during smoke test:', err.message || err);
  process.exit(1);
});
