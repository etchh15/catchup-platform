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
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
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
CREATE POLICY IF NOT EXISTS "Public read registered specialists" ON profiles
  FOR SELECT USING (role = 'specialist');

CREATE POLICY IF NOT EXISTS "Authenticated read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Authenticated insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Authenticated update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Clients and specialists: owner updates only
CREATE POLICY IF NOT EXISTS "Authenticated manage own client row" ON clients
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Authenticated manage own specialist row" ON specialists
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Tasks: anyone can read, authenticated user can create / manage own tasks
CREATE POLICY IF NOT EXISTS "Public read tasks" ON tasks
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Authenticated insert own task" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Authenticated update own task" ON tasks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Authenticated delete own task" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Bids: public read, specialists can write their own bids
CREATE POLICY IF NOT EXISTS "Public read bids" ON bids
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Authenticated insert own bid" ON bids
  FOR INSERT WITH CHECK (auth.uid() = specialist_id);

CREATE POLICY IF NOT EXISTS "Authenticated update own bid" ON bids
  FOR UPDATE USING (auth.uid() = specialist_id) WITH CHECK (auth.uid() = specialist_id);

CREATE POLICY IF NOT EXISTS "Authenticated delete own bid" ON bids
  FOR DELETE USING (auth.uid() = specialist_id);

-- Messages: public read and authenticated writes
CREATE POLICY IF NOT EXISTS "Public read messages" ON messages
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Authenticated insert task messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Workspace rooms: room participants only
CREATE POLICY IF NOT EXISTS "Workspace participants can read rooms" ON workspace_rooms
  FOR SELECT USING (
    auth.uid() = client_id OR auth.uid() = specialist_id
  );

CREATE POLICY IF NOT EXISTS "Workspace participants can insert rooms" ON workspace_rooms
  FOR INSERT WITH CHECK (auth.uid() = client_id OR auth.uid() = specialist_id);

CREATE POLICY IF NOT EXISTS "Workspace participants can update rooms" ON workspace_rooms
  FOR UPDATE USING (
    auth.uid() = client_id OR auth.uid() = specialist_id
  ) WITH CHECK (
    auth.uid() = client_id OR auth.uid() = specialist_id
  );

CREATE POLICY IF NOT EXISTS "Workspace participants can delete rooms" ON workspace_rooms
  FOR DELETE USING (
    auth.uid() = client_id OR auth.uid() = specialist_id
  );

-- Workspace messages: only room participants can read/insert
CREATE POLICY IF NOT EXISTS "Workspace message participants can read" ON workspace_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_rooms
      WHERE id = room_id AND (client_id = auth.uid() OR specialist_id = auth.uid())
    )
  );

CREATE POLICY IF NOT EXISTS "Workspace participants can insert messages" ON workspace_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM workspace_rooms
      WHERE id = room_id AND (client_id = auth.uid() OR specialist_id = auth.uid())
    )
  );

-- Reviews: client may submit reviews for completed rooms
CREATE POLICY IF NOT EXISTS "Authenticated insert reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY IF NOT EXISTS "Authenticated select reviews" ON reviews
  FOR SELECT USING (auth.uid() = client_id OR auth.uid() = specialist_id);

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
