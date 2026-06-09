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

-- 2.x) Notification and reputation schema
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM (
      'bid_received',
      'bid_accepted',
      'bid_rejected',
      'message_received',
      'task_started',
      'work_delivered',
      'task_completed',
      'dispute_filed',
      'dispute_response',
      'dispute_resolved',
      'review_received',
      'verification_status'
    );
  END IF;
END$$;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dispute_resolved';

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type notification_type NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  related_id UUID,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE notifications IS 'In-app notifications with recipient-specific action URLs.';
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(recipient_id, type);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  bid_received_in_app BOOLEAN DEFAULT true,
  bid_accepted_in_app BOOLEAN DEFAULT true,
  message_received_in_app BOOLEAN DEFAULT true,
  task_completed_in_app BOOLEAN DEFAULT true,
  dispute_filed_in_app BOOLEAN DEFAULT true,
  bid_received_email BOOLEAN DEFAULT true,
  bid_accepted_email BOOLEAN DEFAULT true,
  message_received_email BOOLEAN DEFAULT false,
  task_completed_email BOOLEAN DEFAULT true,
  dispute_filed_email BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE notification_preferences IS 'User-specific notification channel preferences for in-app and email.';

CREATE TABLE IF NOT EXISTS notification_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('email', 'sms', 'whatsapp')),
  recipient_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE notification_delivery IS 'Delivery tracking records for outbound notification channels.';
CREATE INDEX IF NOT EXISTS idx_notification_delivery_status ON notification_delivery(notification_id, status);

CREATE TABLE IF NOT EXISTS specialist_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  posted_at TIMESTAMPTZ,
  first_bid_at TIMESTAMPTZ,
  response_time_hours INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(specialist_id, task_id)
);
COMMENT ON TABLE specialist_metrics IS 'Specialist response time tracking per task for reputation calculations.';

CREATE TABLE IF NOT EXISTS specialist_reputation (
  specialist_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_completed_jobs INT DEFAULT 0,
  total_reviews INT DEFAULT 0,
  average_rating DECIMAL(2,1) DEFAULT 0,
  response_time_hours INT DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  service_categories TEXT[],
  service_areas TEXT[],
  profile_completeness INT DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE specialist_reputation IS 'Aggregated specialist reputation metrics including ratings and response speed.';

CREATE TABLE IF NOT EXISTS contact_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_id UUID REFERENCES workspace_rooms(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE contact_access_log IS 'Audit log recording when contact details are revealed after acceptance.';
CREATE INDEX IF NOT EXISTS idx_contact_access_viewer_target ON contact_access_log(viewer_id, target_id);
CREATE INDEX IF NOT EXISTS idx_contact_access_target ON contact_access_log(target_id);

CREATE TABLE IF NOT EXISTS agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agreed_amount DECIMAL(10,2) NOT NULL,
  proposal_note TEXT,
  expected_delivery_date DATE,
  accepted_at TIMESTAMPTZ DEFAULT now(),
  contract_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE agreements IS 'Accepted task agreements linking client and specialist with agreed payment and milestone plan.';
CREATE INDEX IF NOT EXISTS idx_agreements_task_id ON agreements(task_id);
CREATE INDEX IF NOT EXISTS idx_agreements_specialist_id ON agreements(specialist_id);
CREATE INDEX IF NOT EXISTS idx_agreements_client_id ON agreements(client_id);
CREATE INDEX IF NOT EXISTS idx_agreements_created ON agreements(created_at DESC);

CREATE TABLE IF NOT EXISTS completion_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agreement_id UUID REFERENCES agreements(id) ON DELETE SET NULL,
  receipt_type TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE completion_receipts IS 'Receipts and notes related to completed work and agreement milestones.';
CREATE INDEX IF NOT EXISTS idx_completion_receipts_agreement ON completion_receipts(agreement_id);

DROP POLICY IF EXISTS "Completion receipts readable by participants" ON completion_receipts;
CREATE POLICY "Completion receipts readable by participants" ON completion_receipts
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks WHERE user_id = auth.uid()::uuid OR specialist_id = auth.uid()::uuid
    ) OR agreement_id IN (
      SELECT id FROM agreements WHERE client_id = auth.uid()::uuid OR specialist_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Completion receipts insertable by service role" ON completion_receipts;
CREATE POLICY "Completion receipts insertable by service role" ON completion_receipts
  FOR INSERT WITH CHECK (true);

CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  reason_category TEXT,
  referenced_message_id UUID REFERENCES workspace_messages(id) ON DELETE SET NULL,
  evidence JSONB,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE disputes IS 'Dispute records filed by clients or specialists against a task agreement.';

CREATE TABLE IF NOT EXISTS dispute_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  evidence JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE dispute_responses IS 'Responses by dispute participants attached to a dispute record.';
CREATE INDEX IF NOT EXISTS idx_dispute_responses_dispute ON dispute_responses(dispute_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispute_responses_responder ON dispute_responses(responder_id);

CREATE TABLE IF NOT EXISTS dispute_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  resolved_by_admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution TEXT,
  amount DECIMAL(10,2),
  notes TEXT,
  resolved_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE dispute_resolutions IS 'Administrative resolutions for disputes, including settlement amounts and notes.';
CREATE INDEX IF NOT EXISTS idx_dispute_resolutions_dispute ON dispute_resolutions(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_resolutions_resolved ON dispute_resolutions(resolved_at DESC);

CREATE TABLE IF NOT EXISTS agreement_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  milestone_number INT NOT NULL CHECK (milestone_number BETWEEN 1 AND 5),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (agreement_id, milestone_number)
);
COMMENT ON TABLE agreement_milestones IS 'Agreement milestones that segment work into ordered deliverables.';
CREATE INDEX IF NOT EXISTS idx_milestones_agreement ON agreement_milestones(agreement_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON agreement_milestones(status);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agreement_id UUID REFERENCES agreements(id) ON DELETE CASCADE,
  proposed_date TIMESTAMPTZ NOT NULL,
  proposed_by TEXT NOT NULL CHECK (proposed_by IN ('specialist', 'client')),
  confirmed_date TIMESTAMPTZ,
  confirmed_by TEXT,
  service_address TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rescheduled', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE appointments IS 'Scheduled appointment proposals and confirmations tied to task agreements.';
CREATE INDEX IF NOT EXISTS idx_appointments_task ON appointments(task_id);
CREATE INDEX IF NOT EXISTS idx_appointments_agreement ON appointments(agreement_id);
CREATE INDEX IF NOT EXISTS idx_appointments_proposed ON appointments(proposed_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

CREATE TABLE IF NOT EXISTS completion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE completion_log IS 'Completion audit log storing task actions and who performed them.';
CREATE INDEX IF NOT EXISTS idx_completion_log_task ON completion_log(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_completion_log_actor ON completion_log(actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS client_reputation (
  client_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_jobs_posted INT DEFAULT 0,
  total_jobs_completed INT DEFAULT 0,
  completion_rate DECIMAL(3,1) DEFAULT 0,
  average_acceptance_rate DECIMAL(3,1) DEFAULT 0,
  phone_verified BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,
  average_rating_from_specialists DECIMAL(2,1) DEFAULT 0,
  total_ratings_given INT DEFAULT 0,
  average_response_time_hours INT DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE client_reputation IS 'Aggregated reputation signals for clients based on completed jobs and ratings.';
CREATE INDEX IF NOT EXISTS idx_client_reputation_rating ON client_reputation(average_rating_from_specialists DESC);
CREATE INDEX IF NOT EXISTS idx_client_reputation_completion ON client_reputation(completion_rate DESC);

CREATE TABLE IF NOT EXISTS specialist_client_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (specialist_id, task_id)
);
COMMENT ON TABLE specialist_client_ratings IS 'Ratings submitted by specialists about clients after task completion.';
CREATE INDEX IF NOT EXISTS idx_specialist_client_ratings_client ON specialist_client_ratings(client_id);
CREATE INDEX IF NOT EXISTS idx_specialist_client_ratings_specialist ON specialist_client_ratings(specialist_id);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS agreement_id UUID REFERENCES agreements(id) ON DELETE SET NULL;

ALTER TABLE completion_receipts
  ADD COLUMN IF NOT EXISTS agreement_id UUID REFERENCES agreements(id) ON DELETE SET NULL;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS work_delivered_by TEXT,
  ADD COLUMN IF NOT EXISTS work_delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by_client TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_by_client_at TIMESTAMPTZ;

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
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialist_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialist_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE completion_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE completion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialist_client_ratings ENABLE ROW LEVEL SECURITY;

-- Helper functions for reputation and notifications
CREATE OR REPLACE FUNCTION public.calculate_specialist_reputation(p_specialist_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed_jobs INT;
  v_avg_rating DECIMAL;
  v_avg_response_time INT;
  v_profile_completeness INT;
BEGIN
  SELECT COUNT(*) INTO v_completed_jobs
  FROM tasks
  WHERE specialist_id = p_specialist_id AND status = 'completed';

  SELECT ROUND(AVG(rating_score)::numeric, 1) INTO v_avg_rating
  FROM reviews
  WHERE specialist_id = p_specialist_id AND rating_score IS NOT NULL;

  SELECT AVG(response_time_hours) INTO v_avg_response_time
  FROM specialist_metrics
  WHERE specialist_id = p_specialist_id;

  v_profile_completeness := CASE
    WHEN (SELECT COUNT(*) FROM profiles
          WHERE id = p_specialist_id
          AND full_name IS NOT NULL
          AND phone_number IS NOT NULL) > 0 THEN 50
    ELSE 20
  END;

  IF EXISTS (SELECT 1 FROM specialist_reputation WHERE specialist_id = p_specialist_id) THEN
    UPDATE specialist_reputation
    SET total_completed_jobs = v_completed_jobs,
        total_reviews = (SELECT COUNT(*) FROM reviews WHERE specialist_id = p_specialist_id AND rating_score IS NOT NULL),
        average_rating = COALESCE(v_avg_rating, 0),
        response_time_hours = COALESCE(v_avg_response_time, 0),
        updated_at = now()
    WHERE specialist_id = p_specialist_id;
  ELSE
    INSERT INTO specialist_reputation (specialist_id, total_completed_jobs, total_reviews, average_rating, response_time_hours, updated_at)
    VALUES (p_specialist_id, v_completed_jobs, COALESCE((SELECT COUNT(*) FROM reviews WHERE specialist_id = p_specialist_id AND rating_score IS NOT NULL), 0), COALESCE(v_avg_rating, 0), COALESCE(v_avg_response_time, 0), now());
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id UUID,
  p_sender_id UUID,
  p_type notification_type,
  p_task_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_action_url TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    recipient_id, sender_id, type, task_id, title, message, action_url
  ) VALUES (
    p_recipient_id, p_sender_id, p_type, p_task_id, p_title, p_message, p_action_url
  ) RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

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
  FOR UPDATE USING (
    auth.uid()::uuid = user_id
    AND status = 'open'
    AND specialist_id IS NULL
  ) WITH CHECK (
    auth.uid()::uuid = user_id
    AND specialist_id IS NULL
    AND status IN ('open', 'archived')
  );

DROP POLICY IF EXISTS "Authenticated delete own task" ON tasks;
CREATE POLICY "Authenticated delete own task" ON tasks
  FOR DELETE USING (
    auth.uid()::uuid = user_id
    AND status = 'open'
    AND specialist_id IS NULL
  );

-- Bids: public read, specialists can write their own bids
DROP POLICY IF EXISTS "Public read bids" ON bids;
CREATE POLICY "Public read bids" ON bids
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated insert own bid" ON bids;
CREATE POLICY "Authenticated insert own bid" ON bids
  FOR INSERT WITH CHECK (
    auth.uid()::uuid = specialist_id
    AND NOT EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = bids.task_id
        AND tasks.user_id = auth.uid()::uuid
    )
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = bids.task_id
        AND tasks.status = 'open'
    )
  );

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
  FOR INSERT WITH CHECK (
    auth.uid()::uuid = client_id
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = reviews.task_id
        AND tasks.user_id = auth.uid()::uuid
        AND tasks.work_delivered_at IS NOT NULL
        AND tasks.confirmed_by_client_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Authenticated select reviews" ON reviews;
CREATE POLICY "Authenticated select reviews" ON reviews
  FOR SELECT USING (auth.uid()::uuid = client_id OR auth.uid()::uuid = specialist_id);

-- Notifications: recipients see own notifications only
DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (auth.uid()::uuid = recipient_id);

DROP POLICY IF EXISTS "Service role inserts notifications" ON notifications;
CREATE POLICY "Service role inserts notifications" ON notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (auth.uid()::uuid = recipient_id)
  WITH CHECK (auth.uid()::uuid = recipient_id);

-- Notification preferences: owner only
DROP POLICY IF EXISTS "Users read own notification preferences" ON notification_preferences;
CREATE POLICY "Users read own notification preferences" ON notification_preferences
  FOR SELECT USING (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users update own notification preferences" ON notification_preferences;
CREATE POLICY "Users update own notification preferences" ON notification_preferences
  FOR UPDATE USING (auth.uid()::uuid = user_id)
  WITH CHECK (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users insert own notification preferences" ON notification_preferences;
CREATE POLICY "Users insert own notification preferences" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

-- Notification delivery: service-managed insert/update only
DROP POLICY IF EXISTS "Service role manages notification delivery" ON notification_delivery;
CREATE POLICY "Service role manages notification delivery" ON notification_delivery
  FOR ALL USING (true)
  WITH CHECK (true);

-- Specialist metrics: public read, service-managed insert
DROP POLICY IF EXISTS "Public read specialist metrics" ON specialist_metrics;
CREATE POLICY "Public read specialist metrics" ON specialist_metrics
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role inserts metrics" ON specialist_metrics;
CREATE POLICY "Service role inserts metrics" ON specialist_metrics
  FOR INSERT WITH CHECK (true);

-- Specialist reputation: public read, service-managed writes
DROP POLICY IF EXISTS "Public read specialist reputation" ON specialist_reputation;
CREATE POLICY "Public read specialist reputation" ON specialist_reputation
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages reputation" ON specialist_reputation;
CREATE POLICY "Service role manages reputation" ON specialist_reputation
  FOR ALL USING (true)
  WITH CHECK (true);

-- Contact access log: owners only, service-managed insert
DROP POLICY IF EXISTS "Users read own contact access" ON contact_access_log;
CREATE POLICY "Users read own contact access" ON contact_access_log
  FOR SELECT USING (auth.uid()::uuid = viewer_id OR auth.uid()::uuid = target_id);

DROP POLICY IF EXISTS "Service role inserts access logs" ON contact_access_log;
CREATE POLICY "Service role inserts access logs" ON contact_access_log
  FOR INSERT WITH CHECK (true);

-- Agreements: participants only
DROP POLICY IF EXISTS "Agreements readable by participants" ON agreements;
CREATE POLICY "Agreements readable by participants" ON agreements
  FOR SELECT USING (
    specialist_id = auth.uid()::uuid OR client_id = auth.uid()::uuid
  );

DROP POLICY IF EXISTS "Agreements insertable by service role" ON agreements;
CREATE POLICY "Agreements insertable by service role" ON agreements
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Agreements updateable by participants" ON agreements;
CREATE POLICY "Agreements updateable by participants" ON agreements
  FOR UPDATE USING (
    specialist_id = auth.uid()::uuid OR client_id = auth.uid()::uuid
  ) WITH CHECK (
    specialist_id = auth.uid()::uuid OR client_id = auth.uid()::uuid
  );

-- Disputes: participants only
DROP POLICY IF EXISTS "Disputes readable by participants" ON disputes;
CREATE POLICY "Disputes readable by participants" ON disputes
  FOR SELECT USING (
    filed_by = auth.uid()::uuid OR
    task_id IN (
      SELECT id FROM tasks
      WHERE user_id = auth.uid()::uuid OR specialist_id = auth.uid()::uuid
    ) OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()::uuid AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Disputes insertable by service role" ON disputes;
CREATE POLICY "Disputes insertable by service role" ON disputes
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Disputes updateable by service role" ON disputes;
CREATE POLICY "Disputes updateable by service role" ON disputes
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Disputes updateable by admin" ON disputes;
CREATE POLICY "Disputes updateable by admin" ON disputes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()::uuid AND role = 'admin'
    )
  );

-- Dispute responses: participants can read, service-managed insert
DROP POLICY IF EXISTS "Dispute responses readable by participants" ON dispute_responses;
CREATE POLICY "Dispute responses readable by participants" ON dispute_responses
  FOR SELECT USING (
    responder_id = auth.uid()::uuid OR
    dispute_id IN (SELECT id FROM disputes WHERE filed_by = auth.uid()::uuid) OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()::uuid AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Dispute responses insertable by service role" ON dispute_responses;
CREATE POLICY "Dispute responses insertable by service role" ON dispute_responses
  FOR INSERT WITH CHECK (true);

-- Dispute resolutions: service role only
DROP POLICY IF EXISTS "Dispute resolutions readable by service role" ON dispute_resolutions;
CREATE POLICY "Dispute resolutions readable by service role" ON dispute_resolutions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()::uuid AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Dispute resolutions insertable by admin" ON dispute_resolutions;
CREATE POLICY "Dispute resolutions insertable by admin" ON dispute_resolutions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()::uuid AND role = 'admin'
    )
  );

-- Milestones: participants only
DROP POLICY IF EXISTS "Milestones readable by participants" ON agreement_milestones;
CREATE POLICY "Milestones readable by participants" ON agreement_milestones
  FOR SELECT USING (
    agreement_id IN (
      SELECT id FROM agreements
      WHERE specialist_id = auth.uid()::uuid OR client_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Milestones updateable by service role" ON agreement_milestones;
CREATE POLICY "Milestones updateable by service role" ON agreement_milestones
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Milestones insertable by service role" ON agreement_milestones;
CREATE POLICY "Milestones insertable by service role" ON agreement_milestones
  FOR INSERT WITH CHECK (true);

-- Appointments: participants only
DROP POLICY IF EXISTS "Appointments readable by participants" ON appointments;
CREATE POLICY "Appointments readable by participants" ON appointments
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE user_id = auth.uid()::uuid OR specialist_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Appointments updateable by service role" ON appointments;
CREATE POLICY "Appointments updateable by service role" ON appointments
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Appointments insertable by service role" ON appointments;
CREATE POLICY "Appointments insertable by service role" ON appointments
  FOR INSERT WITH CHECK (true);

-- Completion log: participants only
DROP POLICY IF EXISTS "Completion log readable by participants" ON completion_log;
CREATE POLICY "Completion log readable by participants" ON completion_log
  FOR SELECT USING (
    actor_id = auth.uid()::uuid OR
    task_id IN (
      SELECT id FROM tasks
      WHERE user_id = auth.uid()::uuid OR specialist_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Completion log insertable by service role" ON completion_log;
CREATE POLICY "Completion log insertable by service role" ON completion_log
  FOR INSERT WITH CHECK (true);

-- Client reputation: public read, service-managed writes
DROP POLICY IF EXISTS "Client reputation is public" ON client_reputation;
CREATE POLICY "Client reputation is public" ON client_reputation
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Client reputation updateable by service role" ON client_reputation;
CREATE POLICY "Client reputation updateable by service role" ON client_reputation
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Client reputation insertable by service role" ON client_reputation;
CREATE POLICY "Client reputation insertable by service role" ON client_reputation
  FOR INSERT WITH CHECK (true);

-- Specialist client ratings: relevant parties can read
DROP POLICY IF EXISTS "Specialist client ratings readable" ON specialist_client_ratings;
CREATE POLICY "Specialist client ratings readable" ON specialist_client_ratings
  FOR SELECT USING (
    specialist_id = auth.uid()::uuid OR
    client_id = auth.uid()::uuid OR
    specialist_id IN (SELECT id FROM profiles WHERE is_verified = true)
  );

DROP POLICY IF EXISTS "Specialist client ratings insertable by service role" ON specialist_client_ratings;
CREATE POLICY "Specialist client ratings insertable by service role" ON specialist_client_ratings
  FOR INSERT WITH CHECK (true);

-- 3.1) RPC: Atomic bid acceptance (task owner only)
CREATE OR REPLACE FUNCTION public.accept_bid(p_task_id uuid, p_bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_specialist_id uuid;
  v_amount numeric;
  v_proposal_note text;
  v_room_id uuid;
  v_agreement_id uuid;
BEGIN
  -- Ensure caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure caller owns the task, with defensive UUID casting
  SELECT (user_id::text)::uuid INTO v_client_id
  FROM tasks
  WHERE id = p_task_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_client_id <> auth.uid()::uuid THEN
    RAISE EXCEPTION 'Forbidden: Only task creator can accept bids';
  END IF;

  -- Lock bid row and validate it belongs to the task, with defensive UUID casting
  SELECT (specialist_id::text)::uuid, amount, note
    INTO v_specialist_id, v_amount, v_proposal_note
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

  -- Mark other bids as rejected
  UPDATE bids
  SET status = 'rejected',
      updated_at = now()
  WHERE task_id = p_task_id AND id <> p_bid_id AND status <> 'accepted';

  -- Create agreement for accepted bid with defensive UUID casting
  INSERT INTO agreements (
    task_id, client_id, specialist_id, agreed_amount, proposal_note, accepted_at, created_at, updated_at
  ) VALUES (
    p_task_id, (v_client_id::text)::uuid, (v_specialist_id::text)::uuid, v_amount, v_proposal_note, now(), now(), now()
  ) RETURNING id INTO v_agreement_id;

  -- Update task with assignment and agreement linkage
  UPDATE tasks
  SET status = 'active',
      specialist_id = (v_specialist_id::text)::uuid,
      agreement_id = v_agreement_id,
      updated_at = now()
  WHERE id = p_task_id;

  -- Create (or return existing) workspace room with defensive UUID casting
  INSERT INTO workspace_rooms (task_id, client_id, specialist_id, status)
  VALUES (p_task_id, (v_client_id::text)::uuid, (v_specialist_id::text)::uuid, 'active')
  ON CONFLICT (task_id, client_id, specialist_id) DO NOTHING
  RETURNING id INTO v_room_id;

  IF v_room_id IS NULL THEN
    SELECT id INTO v_room_id
    FROM workspace_rooms
    WHERE task_id = p_task_id AND client_id = (v_client_id::text)::uuid AND specialist_id = (v_specialist_id::text)::uuid
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Create default milestone plan and auto-complete milestone 1
  INSERT INTO agreement_milestones (
    agreement_id, milestone_number, name, description, status, completed_by, completed_at, created_at, updated_at
  )
  SELECT v_agreement_id, n,
    CASE n
      WHEN 1 THEN 'Request Confirmed'
      WHEN 2 THEN 'Work Scheduled'
      WHEN 3 THEN 'Work Started'
      WHEN 4 THEN 'Client Inspection'
      WHEN 5 THEN 'Completed'
    END,
    CASE n
      WHEN 1 THEN 'Task posted and agreement created'
      WHEN 2 THEN 'Appointment confirmed'
      WHEN 3 THEN 'Specialist began work'
      WHEN 4 THEN 'Client reviews quality'
      WHEN 5 THEN 'Work has been confirmed complete'
    END,
    CASE WHEN n = 1 THEN 'completed' ELSE 'pending' END,
    CASE WHEN n = 1 THEN v_client_id::text ELSE NULL END,
    CASE WHEN n = 1 THEN now() ELSE NULL END,
    now(), now()
  FROM generate_series(1, 5) AS g(n)
  ON CONFLICT (agreement_id, milestone_number) DO NOTHING;

  RETURN jsonb_build_object(
    'task_id', p_task_id,
    'bid_id', p_bid_id,
    'client_id', v_client_id,
    'specialist_id', v_specialist_id,
    'room_id', v_room_id,
    'agreement_id', v_agreement_id,
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
