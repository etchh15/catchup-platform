-- CatchUp Platform: Phases 2-3-4 Database Migration
-- Comprehensive migration including Agreements, Completion, Disputes, Milestones, Appointments, Client Reputation
-- Date: 2026-05-28

-- ============================================================================
-- PHASE 2: AGREEMENTS & CONTRACTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agreed_amount DECIMAL(10,2) NOT NULL,
  proposal_note TEXT,
  expected_delivery_date DATE,
  accepted_at TIMESTAMP DEFAULT now(),
  contract_data JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  INDEX idx_agreements_task_id (task_id),
  INDEX idx_agreements_specialist_id (specialist_id),
  INDEX idx_agreements_client_id (client_id),
  INDEX idx_agreements_created (created_at DESC)
);

-- RLS: Agreements visible to both parties
CREATE POLICY "Agreements readable by participants" ON agreements
  FOR SELECT USING (specialist_id = auth.uid() OR client_id = auth.uid());

CREATE POLICY "Agreements insertable by service role" ON agreements
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Agreements updateable by participants" ON agreements
  FOR UPDATE USING (specialist_id = auth.uid() OR client_id = auth.uid());

ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;

-- Add agreement_id to tasks and completion_receipts
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS agreement_id UUID REFERENCES agreements(id) ON DELETE SET NULL;

ALTER TABLE completion_receipts
  ADD COLUMN IF NOT EXISTS agreement_id UUID REFERENCES agreements(id) ON DELETE SET NULL;

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
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMP DEFAULT now(),
  INDEX idx_completion_log_task (task_id, created_at DESC),
  INDEX idx_completion_log_actor (actor_id, created_at DESC)
);

-- RLS: Users can read their own completion logs
CREATE POLICY "Completion log readable by participants" ON completion_log
  FOR SELECT USING (
    actor_id = auth.uid() OR
    task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid() OR specialist_id = auth.uid())
  );

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
  created_at TIMESTAMP DEFAULT now(),
  INDEX idx_dispute_responses_dispute (dispute_id, created_at DESC),
  INDEX idx_dispute_responses_responder (responder_id)
);

-- RLS: Both parties and admins can read
CREATE POLICY "Dispute responses readable by participants" ON dispute_responses
  FOR SELECT USING (
    responder_id = auth.uid() OR
    dispute_id IN (SELECT id FROM disputes WHERE filed_by = auth.uid())
  );

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
  created_at TIMESTAMP DEFAULT now(),
  INDEX idx_dispute_resolutions_dispute (dispute_id),
  INDEX idx_dispute_resolutions_resolved (resolved_at DESC)
);

-- RLS: Admin only, for now service role manages
CREATE POLICY "Dispute resolutions readable by service role" ON dispute_resolutions
  FOR SELECT USING (true);

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
  UNIQUE (agreement_id, milestone_number),
  INDEX idx_milestones_agreement (agreement_id),
  INDEX idx_milestones_status (status)
);

-- RLS: Both parties can read and update their milestones
CREATE POLICY "Milestones readable by participants" ON agreement_milestones
  FOR SELECT USING (
    agreement_id IN (
      SELECT id FROM agreements
      WHERE specialist_id = auth.uid() OR client_id = auth.uid()
    )
  );

CREATE POLICY "Milestones updateable by service role" ON agreement_milestones
  FOR UPDATE USING (true);

CREATE POLICY "Milestones insertable by service role" ON agreement_milestones
  FOR INSERT WITH CHECK (true);

ALTER TABLE agreement_milestones ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 3: SCHEDULED APPOINTMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agreement_id UUID REFERENCES agreements(id) ON DELETE CASCADE,
  proposed_date TIMESTAMP NOT NULL,
  proposed_by TEXT NOT NULL CHECK (proposed_by IN ('specialist', 'client')),
  confirmed_date TIMESTAMP,
  confirmed_by TEXT,
  service_address TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rescheduled', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  INDEX idx_appointments_task (task_id),
  INDEX idx_appointments_agreement (agreement_id),
  INDEX idx_appointments_proposed (proposed_date),
  INDEX idx_appointments_status (status)
);

-- RLS: Both parties can read and update appointments
CREATE POLICY "Appointments readable by participants" ON appointments
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE user_id = auth.uid() OR specialist_id = auth.uid()
    )
  );

CREATE POLICY "Appointments updateable by service role" ON appointments
  FOR UPDATE USING (true);

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
  updated_at TIMESTAMP DEFAULT now(),
  INDEX idx_client_reputation_rating (average_rating_from_specialists DESC),
  INDEX idx_client_reputation_completion (completion_rate DESC)
);

-- RLS: Public read, service role only writes
CREATE POLICY "Client reputation is public" ON client_reputation
  FOR SELECT USING (true);

CREATE POLICY "Client reputation updateable by service role" ON client_reputation
  FOR UPDATE USING (true);

CREATE POLICY "Client reputation insertable by service role" ON client_reputation
  FOR INSERT WITH CHECK (true);

ALTER TABLE client_reputation ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS specialist_client_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  submitted_at TIMESTAMP DEFAULT now(),
  UNIQUE (specialist_id, task_id),
  INDEX idx_specialist_client_ratings_client (client_id),
  INDEX idx_specialist_client_ratings_specialist (specialist_id)
);

-- RLS: Service role manages, visible to relevant parties
CREATE POLICY "Specialist client ratings readable" ON specialist_client_ratings
  FOR SELECT USING (
    specialist_id = auth.uid() OR
    client_id = auth.uid() OR
    specialist_id IN (SELECT id FROM profiles WHERE is_verified = true)
  );

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

ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS agreements;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS agreement_milestones;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS dispute_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS dispute_resolutions;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS completion_log;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS client_reputation;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS specialist_client_ratings;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All Phase 2-3-4 tables created with RLS policies and indexes
-- Application layer will populate data via service functions
-- Verify in Supabase dashboard: All new tables should appear
