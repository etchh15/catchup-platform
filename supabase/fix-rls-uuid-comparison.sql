-- ============================================================================
-- CRITICAL FIX: Remove problematic text casting from RLS policies
-- ============================================================================
-- ERROR: "operator does not exist: text = uuid"
-- CAUSE: RLS policies were using ::text casts when comparing UUIDs
-- SOLUTION: Remove casts and compare UUIDs directly
--
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
-- ============================================================================

-- Fix profiles RLS policies
DROP POLICY IF EXISTS "Authenticated read own profile" ON profiles;
CREATE POLICY "Authenticated read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated insert own profile" ON profiles;
CREATE POLICY "Authenticated insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated update own profile" ON profiles;
CREATE POLICY "Authenticated update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Fix clients RLS policies
DROP POLICY IF EXISTS "Authenticated manage own client row" ON clients;
CREATE POLICY "Authenticated manage own client row" ON clients
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Fix specialists RLS policies
DROP POLICY IF EXISTS "Authenticated manage own specialist row" ON specialists;
CREATE POLICY "Authenticated manage own specialist row" ON specialists
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Fix tasks RLS policies (CRITICAL for task creation)
DROP POLICY IF EXISTS "Authenticated insert own task" ON tasks;
CREATE POLICY "Authenticated insert own task" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated update own task" ON tasks;
CREATE POLICY "Authenticated update own task" ON tasks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated delete own task" ON tasks;
CREATE POLICY "Authenticated delete own task" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Fix bids RLS policies
DROP POLICY IF EXISTS "Authenticated insert own bid" ON bids;
CREATE POLICY "Authenticated insert own bid" ON bids
  FOR INSERT WITH CHECK (auth.uid() = specialist_id);

DROP POLICY IF EXISTS "Authenticated update own bid" ON bids;
CREATE POLICY "Authenticated update own bid" ON bids
  FOR UPDATE USING (
    auth.uid() = specialist_id
    OR EXISTS (
      SELECT 1
      FROM tasks
      WHERE tasks.id = bids.task_id
        AND tasks.user_id = auth.uid()
    )
  ) WITH CHECK (
    auth.uid() = specialist_id
    OR EXISTS (
      SELECT 1
      FROM tasks
      WHERE tasks.id = bids.task_id
        AND tasks.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated delete own bid" ON bids;
CREATE POLICY "Authenticated delete own bid" ON bids
  FOR DELETE USING (auth.uid() = specialist_id);

-- Fix messages RLS policies
DROP POLICY IF EXISTS "Authenticated insert task messages" ON messages;
CREATE POLICY "Authenticated insert task messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Fix workspace_rooms RLS policies
DROP POLICY IF EXISTS "Workspace participants can read rooms" ON workspace_rooms;
CREATE POLICY "Workspace participants can read rooms" ON workspace_rooms
  FOR SELECT USING (
    auth.uid() = client_id OR auth.uid() = specialist_id
  );

DROP POLICY IF EXISTS "Workspace participants can insert rooms" ON workspace_rooms;
CREATE POLICY "Workspace participants can insert rooms" ON workspace_rooms
  FOR INSERT WITH CHECK (auth.uid() = client_id OR auth.uid() = specialist_id);

DROP POLICY IF EXISTS "Workspace participants can update rooms" ON workspace_rooms;
CREATE POLICY "Workspace participants can update rooms" ON workspace_rooms
  FOR UPDATE USING (
    auth.uid() = client_id OR auth.uid() = specialist_id
  ) WITH CHECK (
    auth.uid() = client_id OR auth.uid() = specialist_id
  );

DROP POLICY IF EXISTS "Workspace participants can delete rooms" ON workspace_rooms;
CREATE POLICY "Workspace participants can delete rooms" ON workspace_rooms
  FOR DELETE USING (
    auth.uid() = client_id OR auth.uid() = specialist_id
  );

-- Fix workspace_messages RLS policies
DROP POLICY IF EXISTS "Workspace message participants can read" ON workspace_messages;
CREATE POLICY "Workspace message participants can read" ON workspace_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_rooms
      WHERE id = room_id AND (client_id = auth.uid() OR specialist_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Workspace participants can insert messages" ON workspace_messages;
CREATE POLICY "Workspace participants can insert messages" ON workspace_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM workspace_rooms
      WHERE id = room_id AND (client_id = auth.uid() OR specialist_id = auth.uid())
    )
  );

-- Fix reviews RLS policies
DROP POLICY IF EXISTS "Authenticated insert reviews" ON reviews;
CREATE POLICY "Authenticated insert reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Authenticated select reviews" ON reviews;
CREATE POLICY "Authenticated select reviews" ON reviews
  FOR SELECT USING (auth.uid() = client_id OR auth.uid() = specialist_id);

-- Confirmation
SELECT 'RLS UUID comparison fix applied successfully!' AS status;
