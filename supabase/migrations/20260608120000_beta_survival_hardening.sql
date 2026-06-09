-- CatchUp beta survival hardening: waitlist, payment state, verification state, and abuse audit scaffolding.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_verification_status_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_verification_status_check
  CHECK (verification_status IN ('unverified', 'pending_verification', 'verified', 'rejected'));

UPDATE profiles
SET verification_status = CASE WHEN is_verified THEN 'verified' ELSE verification_status END
WHERE verification_status <> 'verified';

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_note text;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_payment_status_check;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_payment_status_check
  CHECK (payment_status IN ('unpaid', 'paid_off_platform', 'deposit_requested', 'deposit_confirmed', 'refunded', 'disputed'));

ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_note text;

ALTER TABLE agreements
  DROP CONSTRAINT IF EXISTS agreements_payment_status_check;
ALTER TABLE agreements
  ADD CONSTRAINT agreements_payment_status_check
  CHECK (payment_status IN ('unpaid', 'paid_off_platform', 'deposit_requested', 'deposit_confirmed', 'refunded', 'disputed'));

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone_number text,
  city_district text,
  requested_role text NOT NULL DEFAULT 'client',
  source text NOT NULL DEFAULT 'public_landing',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE waitlist_signups
  DROP CONSTRAINT IF EXISTS waitlist_requested_role_check;
ALTER TABLE waitlist_signups
  ADD CONSTRAINT waitlist_requested_role_check CHECK (requested_role IN ('client', 'specialist'));

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created ON waitlist_signups(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_signups_email_role ON waitlist_signups(email, requested_role);

CREATE TABLE IF NOT EXISTS abuse_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  target_id uuid,
  target_type text,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_abuse_events_status_created ON abuse_events(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_events_actor_created ON abuse_events(actor_id, created_at DESC);

ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can join beta waitlist" ON waitlist_signups;
CREATE POLICY "Anyone can join beta waitlist" ON waitlist_signups
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read waitlist signups" ON waitlist_signups;
CREATE POLICY "Admins read waitlist signups" ON waitlist_signups
  FOR SELECT
  USING (public.current_user_is_platform_admin());

DROP POLICY IF EXISTS "Admins manage abuse events" ON abuse_events;
CREATE POLICY "Admins manage abuse events" ON abuse_events
  FOR ALL
  USING (public.current_user_is_platform_admin())
  WITH CHECK (public.current_user_is_platform_admin());
