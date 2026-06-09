-- Schema verification for CatchUp Platform
-- Run this in Supabase SQL Editor to confirm the expected tables, policies, and functions.

-- 1) Expected table existence
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'clients', 'specialists', 'tasks', 'bids', 'messages',
    'workspace_rooms', 'workspace_messages', 'reviews', 'notifications',
    'notification_preferences', 'notification_delivery', 'specialist_metrics',
    'specialist_reputation', 'contact_access_log', 'agreements',
    'completion_receipts', 'disputes', 'dispute_responses', 'dispute_resolutions',
    'agreement_milestones', 'appointments', 'completion_log', 'client_reputation',
    'specialist_client_ratings'
  )
ORDER BY table_name;

-- 2) Critical schema checks
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('phone_number', 'email_address');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications'
  AND column_name IN ('message', 'action_url');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'reviews'
  AND column_name = 'rating_score';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tasks'
  AND column_name IN ('work_delivered_by', 'work_delivered_at', 'confirmed_by_client', 'confirmed_by_client_at', 'agreement_id');

SELECT policyname, permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('notifications', 'agreements', 'completion_receipts', 'disputes', 'completion_log', 'specialist_reputation');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'completion_receipts'
  AND column_name IN ('agreement_id', 'task_id', 'receipt_type');

SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN (
    'tasks', 'bids', 'workspace_messages', 'agreements', 'agreement_milestones',
    'appointments', 'dispute_responses', 'dispute_resolutions', 'completion_log',
    'notifications'
  );

SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'accept_bid';

-- 3) accept_bid smoke test note
-- To validate this function manually, run as the authenticated task owner:
-- SELECT public.accept_bid('<task_uuid>'::uuid, '<bid_uuid>'::uuid);
-- Confirm the returned JSON includes agreement_id, room_id, task_id, bid_id, and amount.
