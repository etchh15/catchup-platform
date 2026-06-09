#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
const adminEmail = process.env.CATCHUP_ADMIN_EMAIL || 'etchh0@gmail.com';
const adminPassword = process.env.CATCHUP_ADMIN_PASSWORD;
const testAccountsPath = process.env.CATCHUP_TEST_ACCOUNTS || '/tmp/catchup-live-test-accounts.json';

if (!supabaseUrl || !anonKey) fail('Missing Supabase URL/key.');
if (!adminPassword) fail('Set CATCHUP_ADMIN_PASSWORD to run blocking tests.');
if (!fs.existsSync(testAccountsPath)) fail(`Missing test account file: ${testAccountsPath}`);

const testAccounts = JSON.parse(fs.readFileSync(testAccountsPath, 'utf8'));
const admin = createClient(supabaseUrl, anonKey);
const cleanupTaskIds = [];

async function run() {
  await signIn(admin, adminEmail, adminPassword);

  const originalSettings = await fetchOnboarding();
  const pauseReason = `Blocking rule test ${new Date().toISOString()}`;

  try {
    await updateOnboarding(true, pauseReason);
    await expectBlocked('paused onboarding blocks waitlist', async () => {
      const client = createClient(supabaseUrl, anonKey);
      return client.from('waitlist_signups').insert([{
        full_name: 'Blocking Rule Test',
        email: `blocking-${Date.now()}@example.com`,
        requested_role: 'client',
      }]);
    }, /blocking rule test|paused|onboarding/i);

    await updateOnboarding(false, '');

    await expectBlocked('unverified/non-specialist cannot bid', async () => {
      const client = createClient(supabaseUrl, anonKey);
      await signIn(client, testAccounts.client.email, testAccounts.client.password);
      const task = await firstOpenTaskNotOwnedBy(testAccounts.client.id);
      return client.from('bids').insert([{
        task_id: task.id,
        specialist_id: testAccounts.client.id,
        amount: 1,
        note: 'blocking test',
      }]);
    }, /verified|specialist/i);

    await expectAllowed('verified specialist can pass bid gate', async () => {
      const specialist = createClient(supabaseUrl, anonKey);
      await signIn(specialist, testAccounts.specialist.email, testAccounts.specialist.password);
      const task = await firstOpenTaskNotOwnedBy(testAccounts.specialist.id);
      const { data, error } = await specialist
        .from('bids')
        .upsert([{
          task_id: task.id,
          specialist_id: testAccounts.specialist.id,
          amount: 2,
          note: `blocking allow test ${Date.now()}`,
        }], { onConflict: 'task_id,specialist_id' })
        .select('id')
        .single();
      return { data, error };
    });

    await expectBlocked('task post rate limit rejects spam', async () => {
      const client = createClient(supabaseUrl, anonKey);
      await signIn(client, testAccounts.client.email, testAccounts.client.password);
      let lastResult = null;
      for (let i = 0; i < 5; i += 1) {
        lastResult = await client.from('tasks').insert([{
          user_id: testAccounts.client.id,
          client_name: 'Blocking Rule Test',
          title: `Blocking spam test ${Date.now()} ${i}`,
          description: 'Temporary automated blocking test.',
          budget: 1,
          category: 'Cleaning',
          district_tag: 'Cairo',
        }]).select('id');
        if (lastResult.data?.[0]?.id) cleanupTaskIds.push(lastResult.data[0].id);
        if (lastResult.error) return lastResult;
      }
      return lastResult;
    }, /too many|limit/i);

    console.log('Blocking rule tests passed.');
  } finally {
    await cleanupTemporaryTasks();
    await updateOnboarding(Boolean(originalSettings.paused), originalSettings.reason || '');
  }
}

async function signIn(client, email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function fetchOnboarding() {
  const { data, error } = await admin
    .from('platform_settings')
    .select('value')
    .eq('key', 'onboarding')
    .single();
  if (error) throw error;
  return data?.value || { paused: false, reason: '' };
}

async function updateOnboarding(paused, reason) {
  const { error } = await admin
    .from('platform_settings')
    .upsert([{
      key: 'onboarding',
      value: { paused, reason, updated_at: new Date().toISOString(), source: 'blocking_rule_test' },
      updated_at: new Date().toISOString(),
    }], { onConflict: 'key' });
  if (error) throw error;
}

async function firstOpenTaskNotOwnedBy(userId) {
  const { data, error } = await admin
    .from('tasks')
    .select('id, user_id')
    .eq('status', 'open')
    .neq('user_id', userId)
    .limit(1);
  if (error) throw error;
  if (!data?.length) throw new Error(`No open task found not owned by ${userId}`);
  return data[0];
}

async function cleanupTemporaryTasks() {
  const ids = Array.from(new Set(cleanupTaskIds));
  if (ids.length) {
    await admin.from('tasks').update({ status: 'archived' }).in('id', ids);
  }

  await admin
    .from('tasks')
    .update({ status: 'archived' })
    .eq('client_name', 'Blocking Rule Test')
    .ilike('title', 'Blocking spam test%');
}

async function expectBlocked(label, action, pattern) {
  const result = await action();
  const message = result?.error?.message || '';
  if (!result?.error || !pattern.test(message)) {
    throw new Error(`${label} failed: expected block matching ${pattern}, got "${message || 'no error'}"`);
  }
  console.log(`OK ${label}: ${message}`);
}

async function expectAllowed(label, action) {
  const result = await action();
  if (result?.error) throw new Error(`${label} failed: ${result.error.message}`);
  console.log(`OK ${label}`);
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

function fail(message) {
  console.error(message);
  process.exit(1);
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
