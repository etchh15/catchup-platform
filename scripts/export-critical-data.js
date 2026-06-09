#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
const key = serviceKey || anonKey;

if (!supabaseUrl || !key) {
  console.error('Missing Supabase URL/key. Prefer SUPABASE_SERVICE_ROLE_KEY for complete exports.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, key, {
  auth: { persistSession: false },
});

const tables = [
  'profiles',
  'tasks',
  'bids',
  'workspace_rooms',
  'workspace_messages',
  'disputes',
  'dispute_responses',
  'admin_alerts',
  'abuse_events',
  'waitlist_signups',
];

async function run() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(process.cwd(), 'backups', stamp);
  fs.mkdirSync(outputDir, { recursive: true });

  const manifest = {
    exported_at: new Date().toISOString(),
    tables: {},
    note: serviceKey ? 'Service role export.' : 'Anon-key export; RLS may omit rows.',
  };

  for (const table of tables) {
    const rows = await fetchAll(table);
    fs.writeFileSync(path.join(outputDir, `${table}.json`), JSON.stringify(rows, null, 2));
    manifest.tables[table] = rows.length;
    console.log(`Exported ${table}: ${rows.length} rows`);
  }

  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Backup written to ${outputDir}`);
}

async function fetchAll(table) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, to);

    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function loadEnv() {
  for (const envFile of ['.env.local', '.env']) {
    const envPath = path.join(process.cwd(), envFile);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
