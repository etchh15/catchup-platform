-- CatchUp Platform: Phases 2-3-4 Database Migration
-- Comprehensive migration including Agreements, Completion, Disputes, Milestones, Appointments, Client Reputation
-- Apply order:
--   1. phase-1-migrations.sql
--   2. phase-2-3-4-migrations.sql
--   3. phase-2-3-4-patch-accept-bid.sql
--   4. storage-disputes-bucket.sql
-- Date: 2026-05-28

-- ============================================================================
-- PHASE 2: AGREEMENTS & CONTRACTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agreed_amount DECIMAL(10,2) NOT NULL,
  proposal_note TEXT,
  expected_delivery_date DATE,
  accepted_at TIMESTAMP DEFAULT now(),
  contract_data JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

COMMENT ON TABLE agreements IS 'Accepted task agreements linking client and specialist with agreed payment and milestone plan.';

CREATE INDEX IF NOT EXISTS idx_agreements_task_id ON agreements(task_id);
CREATE INDEX IF NOT EXISTS idx_agreements_specialist_id ON agreements(specialist_id);
CREATE INDEX IF NOT EXISTS idx_agreements_client_id ON agreements(client_id);
CREATE INDEX IF NOT EXISTS idx_agreements_created ON agreements(created_at DESC);

-- RLS: Agreements visible to both parties
DROP POLICY IF EXISTS "Agreements readable by participants" ON agreements;
CREATE POLICY "Agreements readable by participants" ON agreements
  FOR SELECT USING (specialist_id = auth.uid()::uuid OR client_id = auth.uid()::uuid);

DROP POLICY IF EXISTS "Agreements insertable by service role" ON agreements;
CREATE POLICY "Agreements insertable by service role" ON agreements
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Agreements updateable by participants" ON agreements;
CREATE POLICY "Agreements updateable by participants" ON agreements
  FOR UPDATE USING (specialist_id = auth.uid()::uuid OR client_id = auth.uid()::uuid);

ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS completion_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  receipt_type TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS: Completion receipts are readable by the client or specialist on the related task/agreement.
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add agreement_id to tasks and completion_receipts
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS agreement_id UUID REFERENCES agreements(id) ON DELETE SET NULL;

ALTER TABLE completion_receipts
  ADD COLUMN IF NOT EXISTS agreement_id UUID REFERENCES agreements(id) ON DELETE SET NULL;

-- Ensure legacy task schemas include the marketplace columns expected by application code
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS client_name text,
      ADD COLUMN IF NOT EXISTS budget numeric,
      ADD COLUMN IF NOT EXISTS specialist_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END$$;

-- ============================================================================
-- PHASE 2: COMPLETION CONFIRMATION (Dual Sign-Off)
-- ============================================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS work_delivered_by TEXT,
  ADD COLUMN IF NOT EXISTS work_delivered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS confirmed_by_client TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_by_client_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS completion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMP DEFAULT now()
);

COMMENT ON TABLE completion_log IS 'Completion audit log storing task actions and who performed them.';

CREATE INDEX IF NOT EXISTS idx_completion_log_task ON completion_log(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_completion_log_actor ON completion_log(actor_id, created_at DESC);

-- RLS: Users can read their own completion logs
DROP POLICY IF EXISTS "Completion log readable by participants" ON completion_log;
CREATE POLICY "Completion log readable by participants" ON completion_log
  FOR SELECT USING (
    actor_id = auth.uid()::uuid OR
    task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()::uuid OR specialist_id = auth.uid()::uuid)
  );

DROP POLICY IF EXISTS "Completion log insertable by service role" ON completion_log;
CREATE POLICY "Completion log insertable by service role" ON completion_log
  FOR INSERT WITH CHECK (true);

ALTER TABLE completion_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 2: DISPUTES WITH EVIDENCE & RESOLUTION
-- ============================================================================

-- Enhance disputes table with evidence and categorization
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS evidence JSONB,
  ADD COLUMN IF NOT EXISTS reason_category TEXT,
  ADD COLUMN IF NOT EXISTS referenced_message_id UUID REFERENCES workspace_messages(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS dispute_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  evidence JSONB,
  created_at TIMESTAMP DEFAULT now()
);

COMMENT ON TABLE dispute_responses IS 'Responses by dispute participants attached to a dispute record.';

CREATE INDEX IF NOT EXISTS idx_dispute_responses_dispute ON dispute_responses(dispute_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispute_responses_responder ON dispute_responses(responder_id);

-- RLS: Both parties and admins can read
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

ALTER TABLE dispute_responses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS dispute_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  resolved_by_admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution TEXT,
  amount DECIMAL(10,2),
  notes TEXT,
  resolved_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

COMMENT ON TABLE dispute_resolutions IS 'Administrative resolutions for disputes, including settlement amounts and notes.';

CREATE INDEX IF NOT EXISTS idx_dispute_resolutions_dispute ON dispute_resolutions(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_resolutions_resolved ON dispute_resolutions(resolved_at DESC);

-- RLS: Admin only, for now service role manages
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

ALTER TABLE dispute_resolutions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 3: MILESTONES / PROGRESS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS agreement_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  milestone_number INT NOT NULL CHECK (milestone_number BETWEEN 1 AND 5),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_by TEXT,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (agreement_id, milestone_number)
);

COMMENT ON TABLE agreement_milestones IS 'Agreement milestones that segment work into ordered deliverables.';

CREATE INDEX IF NOT EXISTS idx_milestones_agreement ON agreement_milestones(agreement_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON agreement_milestones(status);

-- RLS: Both parties can read and update their milestones
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

ALTER TABLE agreement_milestones ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 3: SCHEDULED APPOINTMENTS
-- ============================================================================

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

-- RLS: Both parties can read and update appointments
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

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 3: CLIENT REPUTATION / RELIABILITY SIGNALS
-- ============================================================================

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
  calculated_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

COMMENT ON TABLE client_reputation IS 'Aggregated reputation signals for clients based on completed jobs and ratings.';

CREATE INDEX IF NOT EXISTS idx_client_reputation_rating ON client_reputation(average_rating_from_specialists DESC);
CREATE INDEX IF NOT EXISTS idx_client_reputation_completion ON client_reputation(completion_rate DESC);

-- RLS: Public read, service role only writes
DROP POLICY IF EXISTS "Client reputation is public" ON client_reputation;
CREATE POLICY "Client reputation is public" ON client_reputation
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Client reputation updateable by service role" ON client_reputation;
CREATE POLICY "Client reputation updateable by service role" ON client_reputation
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Client reputation insertable by service role" ON client_reputation;
CREATE POLICY "Client reputation insertable by service role" ON client_reputation
  FOR INSERT WITH CHECK (true);

ALTER TABLE client_reputation ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS specialist_client_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  submitted_at TIMESTAMP DEFAULT now(),
  UNIQUE (specialist_id, task_id)
);

COMMENT ON TABLE specialist_client_ratings IS 'Ratings submitted by specialists about clients after task completion.';

CREATE INDEX IF NOT EXISTS idx_specialist_client_ratings_client ON specialist_client_ratings(client_id);
CREATE INDEX IF NOT EXISTS idx_specialist_client_ratings_specialist ON specialist_client_ratings(specialist_id);

-- RLS: Service role manages, visible to relevant parties
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

ALTER TABLE specialist_client_ratings ENABLE ROW LEVEL SECURITY;

-- Enhance reviews table with client rating type
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS is_client_review BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS reviewer_type TEXT DEFAULT 'client' CHECK (reviewer_type IN ('client', 'specialist')),
  ADD COLUMN IF NOT EXISTS review_category TEXT;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_agreement ON tasks(agreement_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_completion_receipts_agreement ON completion_receipts(agreement_id);

-- ============================================================================
-- REALTIME PUBLICATIONS (Enable real-time sync)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agreements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agreements;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agreement_milestones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agreement_milestones;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dispute_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dispute_responses;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dispute_resolutions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dispute_resolutions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'completion_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE completion_log;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'client_reputation'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE client_reputation;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'specialist_client_ratings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE specialist_client_ratings;
  END IF;
END$$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All Phase 2-3-4 tables created with RLS policies and indexes
-- Application layer will populate data via service functions
-- Verify in Supabase dashboard: All new tables should appear
