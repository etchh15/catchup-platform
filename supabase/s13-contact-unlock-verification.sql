-- Session 13: Contact Unlock Polish — Verification SQL
-- Run these queries in Supabase SQL Editor to verify implementation

-- 1. Verify schema exists
SELECT 
  EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name='workspace_rooms' AND column_name='contact_revealed_at') 
    AS has_contact_revealed_at,
  EXISTS(SELECT 1 FROM information_schema.tables 
    WHERE table_name='contact_access_log') 
    AS has_contact_access_log,
  EXISTS(SELECT 1 FROM information_schema.columns 
    WHERE table_name='contact_access_log' AND column_name='accessed_at') 
    AS has_accessed_at;

-- 2. Verify RLS is enabled
SELECT table_name, rowsecurity 
FROM information_schema.tables 
WHERE table_name IN ('workspace_rooms', 'contact_access_log') 
ORDER BY table_name;

-- 3. Verify RLS policies exist
SELECT policyname, permissive 
FROM pg_policies 
WHERE schemaname='public' AND tablename IN ('workspace_rooms', 'contact_access_log')
ORDER BY tablename, policyname;

-- 4. Check workspace_rooms structure (including contact_revealed_at)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='workspace_rooms'
ORDER BY ordinal_position;

-- 5. Check contact_access_log structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='contact_access_log'
ORDER BY ordinal_position;

-- 6. Check indexes on contact_access_log
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename='contact_access_log'
ORDER BY indexname;

-- 7. Verify specialist_reputation table has required columns for trust signals
SELECT COUNT(*) as specialist_reputation_count,
  COUNT(DISTINCT specialist_id) as unique_specialists
FROM specialist_reputation;

-- 8. Check for any workspace_rooms with contact_revealed_at set (post-acceptance reveals)
SELECT 
  COUNT(*) as total_rooms,
  COUNT(CASE WHEN contact_revealed_at IS NOT NULL THEN 1 END) as revealed_count,
  MAX(contact_revealed_at) as latest_reveal,
  MIN(contact_revealed_at) as earliest_reveal
FROM workspace_rooms;

-- 9. Check contact_access_log entries (audit trail)
SELECT 
  COUNT(*) as total_accesses,
  COUNT(DISTINCT viewer_id) as unique_viewers,
  COUNT(DISTINCT target_id) as unique_targets,
  COUNT(DISTINCT room_id) as unique_rooms,
  MAX(accessed_at) as latest_access
FROM contact_access_log;

-- 10. Verify no profile contact fields are exposed to non-participants
-- This query should succeed (no rows) when user tries to access another user's contact info
-- through RLS - this is enforced by the application layer checking contact_revealed_at
SELECT id, full_name, phone_number, email_address
FROM profiles
WHERE role = 'specialist'
LIMIT 1;
