-- CatchUp Platform: Full Supabase schema + RLS policies + realtime publications
-- Paste this entire script into Supabase Dashboard → SQL Editor.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Core Tables
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL DEFAULT 'client',
  email text,
  full_name text,
  bio text,
  district_tag text,
  category text,
  professional_title text,
  job_title text,
  phone_number text,
  email_address text,
  portfolio_images text[],
  avatar_url text,
  is_verified boolean NOT NULL DEFAULT false,
  hourly_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY,
  full_name text,
  city_district text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS specialists (
  id uuid PRIMARY KEY,
  business_name text,
  profession_category text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_name text,
  title text,
  description text,
  budget numeric,
  category text,
  district_tag text,
  specialist_id uuid,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (specialist_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  specialist_id uuid NOT NULL,
  amount numeric,
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (specialist_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (task_id, specialist_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  receiver_id uuid,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workspace_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  client_id uuid NOT NULL,
  specialist_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  dispute_initiated_by uuid,
  dispute_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (specialist_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (dispute_initiated_by) REFERENCES profiles(id) ON DELETE SET NULL
);

-- Ensure only one room per task+participants
CREATE UNIQUE INDEX IF NOT EXISTS workspace_rooms_unique_participants
  ON workspace_rooms (task_id, client_id, specialist_id);

CREATE TABLE IF NOT EXISTS workspace_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  message_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (room_id) REFERENCES workspace_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  task_id uuid NOT NULL,
  client_id uuid NOT NULL,
  specialist_id uuid NOT NULL,
  rating_score int,
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (room_id) REFERENCES workspace_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (specialist_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- 2) Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 3) Policies
-- Profiles: public specialists and owner access
DROP POLICY IF EXISTS "Public read registered specialists" ON profiles;
CREATE POLICY "Public read registered specialists" ON profiles
  FOR SELECT USING (role = 'specialist');

DROP POLICY IF EXISTS "Authenticated read own profile" ON profiles;
CREATE POLICY "Authenticated read own profile" ON profiles
  FOR SELECT USING (auth.uid()::uuid = id);

DROP POLICY IF EXISTS "Authenticated insert own profile" ON profiles;
CREATE POLICY "Authenticated insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid()::uuid = id);

DROP POLICY IF EXISTS "Authenticated update own profile" ON profiles;
CREATE POLICY "Authenticated update own profile" ON profiles
  FOR UPDATE USING (auth.uid()::uuid = id) WITH CHECK (auth.uid()::uuid = id);

-- Clients and specialists: owner updates only
DROP POLICY IF EXISTS "Authenticated manage own client row" ON clients;
CREATE POLICY "Authenticated manage own client row" ON clients
  FOR ALL USING (auth.uid()::uuid = id) WITH CHECK (auth.uid()::uuid = id);

DROP POLICY IF EXISTS "Authenticated manage own specialist row" ON specialists;
CREATE POLICY "Authenticated manage own specialist row" ON specialists
  FOR ALL USING (auth.uid()::uuid = id) WITH CHECK (auth.uid()::uuid = id);

-- Tasks: anyone can read, authenticated user can create / manage own tasks
DROP POLICY IF EXISTS "Public read tasks" ON tasks;
CREATE POLICY "Public read tasks" ON tasks
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated insert own task" ON tasks;
CREATE POLICY "Authenticated insert own task" ON tasks
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Authenticated update own task" ON tasks;
CREATE POLICY "Authenticated update own task" ON tasks
  FOR UPDATE USING (auth.uid()::uuid = user_id) WITH CHECK (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Authenticated delete own task" ON tasks;
CREATE POLICY "Authenticated delete own task" ON tasks
  FOR DELETE USING (auth.uid()::uuid = user_id);

-- Bids: public read, specialists can write their own bids
DROP POLICY IF EXISTS "Public read bids" ON bids;
CREATE POLICY "Public read bids" ON bids
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated insert own bid" ON bids;
CREATE POLICY "Authenticated insert own bid" ON bids
  FOR INSERT WITH CHECK (auth.uid()::uuid = specialist_id);

DROP POLICY IF EXISTS "Authenticated update own bid" ON bids;
CREATE POLICY "Authenticated update own bid" ON bids
  FOR UPDATE USING (
    auth.uid()::uuid = specialist_id
    OR EXISTS (
      SELECT 1
      FROM tasks
      WHERE tasks.id = bids.task_id
        AND tasks.user_id = auth.uid()::uuid
    )
  ) WITH CHECK (
    auth.uid()::uuid = specialist_id
    OR EXISTS (
      SELECT 1
      FROM tasks
      WHERE tasks.id = bids.task_id
        AND tasks.user_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Authenticated delete own bid" ON bids;
CREATE POLICY "Authenticated delete own bid" ON bids
  FOR DELETE USING (auth.uid()::uuid = specialist_id);

-- Messages: public read and authenticated writes
DROP POLICY IF EXISTS "Public read messages" ON messages;
CREATE POLICY "Public read messages" ON messages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated insert task messages" ON messages;
CREATE POLICY "Authenticated insert task messages" ON messages
  FOR INSERT WITH CHECK (auth.uid()::uuid = sender_id);

-- Workspace rooms: room participants only
DROP POLICY IF EXISTS "Workspace participants can read rooms" ON workspace_rooms;
CREATE POLICY "Workspace participants can read rooms" ON workspace_rooms
  FOR SELECT USING (
    auth.uid()::uuid = client_id OR auth.uid()::uuid = specialist_id
  );

DROP POLICY IF EXISTS "Workspace participants can insert rooms" ON workspace_rooms;
CREATE POLICY "Workspace participants can insert rooms" ON workspace_rooms
  FOR INSERT WITH CHECK (auth.uid()::uuid = client_id OR auth.uid()::uuid = specialist_id);

DROP POLICY IF EXISTS "Workspace participants can update rooms" ON workspace_rooms;
CREATE POLICY "Workspace participants can update rooms" ON workspace_rooms
  FOR UPDATE USING (
    auth.uid()::uuid = client_id OR auth.uid()::uuid = specialist_id
  ) WITH CHECK (
    auth.uid()::uuid = client_id OR auth.uid()::uuid = specialist_id
  );

DROP POLICY IF EXISTS "Workspace participants can delete rooms" ON workspace_rooms;
CREATE POLICY "Workspace participants can delete rooms" ON workspace_rooms
  FOR DELETE USING (
    auth.uid()::uuid = client_id OR auth.uid()::uuid = specialist_id
  );

-- Workspace messages: only room participants can read/insert
DROP POLICY IF EXISTS "Workspace message participants can read" ON workspace_messages;
CREATE POLICY "Workspace message participants can read" ON workspace_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_rooms
      WHERE id = room_id AND (client_id = auth.uid()::uuid OR specialist_id = auth.uid()::uuid)
    )
  );

DROP POLICY IF EXISTS "Workspace participants can insert messages" ON workspace_messages;
CREATE POLICY "Workspace participants can insert messages" ON workspace_messages
  FOR INSERT WITH CHECK (
    auth.uid()::uuid = sender_id
    AND EXISTS (
      SELECT 1 FROM workspace_rooms
      WHERE id = room_id AND (client_id = auth.uid()::uuid OR specialist_id = auth.uid()::uuid)
    )
  );

-- Reviews: client may submit reviews for completed rooms
DROP POLICY IF EXISTS "Authenticated insert reviews" ON reviews;
CREATE POLICY "Authenticated insert reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid()::uuid = client_id);

DROP POLICY IF EXISTS "Authenticated select reviews" ON reviews;
CREATE POLICY "Authenticated select reviews" ON reviews
  FOR SELECT USING (auth.uid()::uuid = client_id OR auth.uid()::uuid = specialist_id);

-- 3.1) RPC: Atomic bid acceptance (task owner only)
CREATE OR REPLACE FUNCTION public.accept_bid(p_task_id uuid, p_bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id text;
  v_specialist_id text;
  v_amount numeric;
  v_room_id uuid;
BEGIN
  -- Ensure caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure caller owns the task
  SELECT user_id::text INTO v_client_id
  FROM tasks
  WHERE id = p_task_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_client_id <> auth.uid()::text THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Lock bid row and validate it belongs to the task
  SELECT specialist_id, amount
    INTO v_specialist_id, v_amount
  FROM bids
  WHERE id = p_bid_id AND task_id = p_task_id
  FOR UPDATE;

  IF v_specialist_id IS NULL THEN
    RAISE EXCEPTION 'Bid not found for task';
  END IF;

  -- Accept selected bid
  UPDATE bids
  SET status = 'accepted',
      updated_at = now()
  WHERE id = p_bid_id;

  -- Mark other bids as rejected (optional but prevents multiple accepts)
  UPDATE bids
  SET status = 'rejected',
      updated_at = now()
  WHERE task_id = p_task_id AND id <> p_bid_id AND status <> 'accepted';

  -- Activate task + assign specialist
  UPDATE tasks
  SET status = 'active',
      specialist_id = v_specialist_id::uuid,
      updated_at = now()
  WHERE id = p_task_id;

  -- Create (or return existing) workspace room
  INSERT INTO workspace_rooms (task_id, client_id, specialist_id, status)
  VALUES (p_task_id, v_client_id::uuid, v_specialist_id::uuid, 'active')
  ON CONFLICT (task_id, client_id, specialist_id) DO NOTHING
  RETURNING id INTO v_room_id;

  IF v_room_id IS NULL THEN
    SELECT id INTO v_room_id
    FROM workspace_rooms
    WHERE task_id = p_task_id AND client_id::text = v_client_id AND specialist_id::text = v_specialist_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'task_id', p_task_id,
    'bid_id', p_bid_id,
    'client_id', v_client_id,
    'specialist_id', v_specialist_id,
    'room_id', v_room_id,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_bid(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_bid(uuid, uuid) TO authenticated;

-- 4) Realtime publications
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bids;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workspace_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_rooms;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workspace_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_messages;
  END IF;
END $$;
