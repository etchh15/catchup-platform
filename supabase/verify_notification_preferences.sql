-- Verification: notification_preferences quick health check
-- 1) Table existence
SELECT to_regclass('public.notification_preferences') AS table_exists;

-- 2) Columns and defaults
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notification_preferences'
ORDER BY ordinal_position;

-- 3) RLS enabled and forced rowsecurity
SELECT c.relname,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'notification_preferences';

-- 4) Policies defined on notification_preferences
SELECT policyname, permissive, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notification_preferences';

-- 5) Indexes for table
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'notification_preferences';

-- 6) Profiles missing a notification_preferences row (first 100)
SELECT p.id AS profile_id, p.full_name, p.email_address
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_preferences np WHERE np.user_id = p.id
)
ORDER BY p.updated_at DESC
LIMIT 100;

-- 7) Sample notification_preferences rows (latest 100)
SELECT * FROM public.notification_preferences
ORDER BY created_at DESC
LIMIT 100;

-- 8) OPTIONAL: Create missing default preference rows for all profiles without one
-- This is idempotent: it only inserts rows where none exist.
-- Uncomment and run if you want the DB to auto-create defaults for missing users.

-- INSERT INTO public.notification_preferences (user_id)
-- SELECT p.id
-- FROM public.profiles p
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.notification_preferences np WHERE np.user_id = p.id
-- )
-- RETURNING *;

-- 9) OPTIONAL per-user read/write test (replace <USER_UUID> and run)
-- Read:
-- SELECT * FROM public.notification_preferences WHERE user_id = '<USER_UUID>';
-- Flip one boolean for test (this mutates data; run only if you want to test update/rollback):
-- UPDATE public.notification_preferences
-- SET bid_received_email = NOT COALESCE(bid_received_email, false), updated_at = now()
-- WHERE user_id = '<USER_UUID>' RETURNING *;
