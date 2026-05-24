-- Run in Supabase Dashboard → SQL Editor
-- Enables realtime chat + trusted specialist profiles for the client dashboard

-- 1) Realtime for messages (required for live chat)
-- Safe to re-run: skips if messages is already in the publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;

-- 2) Allow reading ALL registered specialists on the client dashboard
DROP POLICY IF EXISTS "Public read verified specialists" ON profiles;
DROP POLICY IF EXISTS "Public read registered specialists" ON profiles;
CREATE POLICY "Public read registered specialists"
  ON profiles FOR SELECT
  USING (role = 'specialist');

-- 3) Allow specialists to register / update their profile (anon key from the app)
DROP POLICY IF EXISTS "Specialists can upsert own profile" ON profiles;
CREATE POLICY "Specialists can upsert own profile"
  ON profiles FOR INSERT
  WITH CHECK (role = 'specialist');

DROP POLICY IF EXISTS "Specialists can update own profile" ON profiles;
CREATE POLICY "Specialists can update own profile"
  ON profiles FOR UPDATE
  USING (role = 'specialist');

-- 4) Messages: allow read/write for the marketplace chat room
DROP POLICY IF EXISTS "Anyone can read messages" ON messages;
CREATE POLICY "Anyone can read messages"
  ON messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can send messages" ON messages;
CREATE POLICY "Anyone can send messages"
  ON messages FOR INSERT
  WITH CHECK (true);

-- 5) Optional: enable live updates when new specialists register
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
END $$;

-- Specialists appear automatically from real sign-ups in `profiles` (role = 'specialist').
-- No demo seed rows required.

-- 6) Enable realtime for workspace_messages (live chat)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workspace_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_messages;
  END IF;
END $$;

-- 7) Enable realtime for tasks and bids (live marketplace feed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bids;
  END IF;
END $$;
