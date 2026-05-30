-- ============================================================================
-- PHASE 1 CRITICAL FEATURES - Database Schema Migration
-- Date: May 28, 2026
-- ============================================================================
-- Run this migration in Supabase SQL Editor to set up Phase 1 features:
-- 1. Notifications System (#9)
-- 2. Specialist Reputation Card (#7)
-- 3. Contact Unlock After Acceptance (#4)
-- ============================================================================

-- ============================================================================
-- FEATURE #9: NOTIFICATIONS SYSTEM
-- ============================================================================

-- Create notification type enum
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
      'review_received',
      'verification_status'
    );
  END IF;
END$$;

-- Notifications table - stores all in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type notification_type NOT NULL,
  task_id bigint REFERENCES tasks(id) ON DELETE CASCADE,
  related_id UUID, -- Foreign key to dispute_id, review_id, bid_id, etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT, -- Link where user should go: /task/123/room, etc.
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Index for fast queries on recipient + creation order
  CONSTRAINT fk_sender_profile FOREIGN KEY (sender_id) REFERENCES profiles(id)
);

CREATE INDEX idx_notifications_recipient_created 
  ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread 
  ON notifications(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_type 
  ON notifications(recipient_id, type);

-- User notification preferences - per-user control over notification channels
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- In-app notification preferences
  bid_received_in_app BOOLEAN DEFAULT true,
  bid_accepted_in_app BOOLEAN DEFAULT true,
  message_received_in_app BOOLEAN DEFAULT true,
  task_completed_in_app BOOLEAN DEFAULT true,
  dispute_filed_in_app BOOLEAN DEFAULT true,
  
  -- Email notification preferences
  bid_received_email BOOLEAN DEFAULT true,
  bid_accepted_email BOOLEAN DEFAULT true,
  message_received_email BOOLEAN DEFAULT false,
  task_completed_email BOOLEAN DEFAULT true,
  dispute_filed_email BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Notification delivery log - tracks email/SMS/WhatsApp deliveries (Phase 2+)
CREATE TABLE IF NOT EXISTS notification_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('email', 'sms', 'whatsapp')),
  recipient_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_notification_delivery_status 
  ON notification_delivery(notification_id, status);

-- ============================================================================
-- FEATURE #7: SPECIALIST REPUTATION CARD
-- ============================================================================

-- Specialist metrics - tracks response times for reputation calculation
CREATE TABLE IF NOT EXISTS specialist_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  posted_at TIMESTAMP WITH TIME ZONE,
  first_bid_at TIMESTAMP WITH TIME ZONE,
  response_time_hours INT, -- Hours between post and first bid
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(specialist_id, task_id)
);

CREATE INDEX idx_specialist_metrics_specialist 
  ON specialist_metrics(specialist_id);

-- Specialist reputation - materialized reputation view (refreshed after task completion)
CREATE TABLE IF NOT EXISTS specialist_reputation (
  specialist_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Job completion metrics
  total_completed_jobs INT DEFAULT 0,
  total_reviews INT DEFAULT 0,
  average_rating DECIMAL(2,1) DEFAULT 0, -- 0.0 to 5.0
  
  -- Response speed metric
  response_time_hours INT DEFAULT 0, -- Average hours to first bid
  
  -- Profile verification & categories
  is_verified BOOLEAN DEFAULT false,
  service_categories TEXT[], -- Array of category names
  service_areas TEXT[], -- Array of service areas
  
  -- Profile completeness percentage
  profile_completeness INT DEFAULT 0, -- 0-100
  
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- FEATURE #4: CONTACT UNLOCK AFTER ACCEPTANCE
-- ============================================================================

-- Contact access log - tracks when and who viewed contact details
CREATE TABLE IF NOT EXISTS contact_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_id UUID REFERENCES workspace_rooms(id) ON DELETE CASCADE,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_contact_access_viewer_target 
  ON contact_access_log(viewer_id, target_id);
CREATE INDEX idx_contact_access_target 
  ON contact_access_log(target_id);

-- Add contact_revealed_at column to workspace_rooms to track first contact reveal
ALTER TABLE workspace_rooms ADD COLUMN IF NOT EXISTS contact_revealed_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialist_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialist_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_access_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- NOTIFICATIONS TABLE RLS
-- ============================================================================

-- Users can read their own notifications
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = recipient_id);

-- System can insert notifications (use Supabase Functions/RLS from service role)
CREATE POLICY "Service role inserts notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE RLS
-- ============================================================================

-- Users can read and update their own preferences
CREATE POLICY "Users read own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- NOTIFICATION DELIVERY TABLE RLS
-- ============================================================================

-- Service role only (for async email/SMS sending)
CREATE POLICY "Service role manages delivery"
  ON notification_delivery FOR ALL
  USING (true);

-- ============================================================================
-- SPECIALIST METRICS TABLE RLS
-- ============================================================================

-- Public read (specialists can see each other's metrics)
CREATE POLICY "Public read specialist metrics"
  ON specialist_metrics FOR SELECT
  USING (true);

-- Service role creates metrics
CREATE POLICY "Service role inserts metrics"
  ON specialist_metrics FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- SPECIALIST REPUTATION TABLE RLS
-- ============================================================================

-- Public read (everyone can see reputation)
CREATE POLICY "Public read specialist reputation"
  ON specialist_reputation FOR SELECT
  USING (true);

-- Service role manages reputation
CREATE POLICY "Service role manages reputation"
  ON specialist_reputation FOR ALL
  USING (true);

-- ============================================================================
-- CONTACT ACCESS LOG TABLE RLS
-- ============================================================================

-- Users can read their own access log
CREATE POLICY "Users read own contact access"
  ON contact_access_log FOR SELECT
  USING (auth.uid() = viewer_id OR auth.uid() = target_id);

-- Service role inserts access logs
CREATE POLICY "Service role inserts access logs"
  ON contact_access_log FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate specialist reputation (run after task completion)
CREATE OR REPLACE FUNCTION calculate_specialist_reputation(p_specialist_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_completed_jobs INT;
  v_avg_rating DECIMAL;
  v_avg_response_time INT;
  v_profile_completeness INT;
BEGIN
  -- Count completed jobs
  SELECT COUNT(*) INTO v_completed_jobs
  FROM tasks
  WHERE specialist_id = p_specialist_id AND status = 'completed';

  -- Calculate average rating from reviews
  SELECT ROUND(AVG(rating)::numeric, 1) INTO v_avg_rating
  FROM reviews
  WHERE specialist_id = p_specialist_id AND rating IS NOT NULL;

  -- Calculate average response time
  SELECT AVG(response_time_hours) INTO v_avg_response_time
  FROM specialist_metrics
  WHERE specialist_id = p_specialist_id;

  -- Calculate profile completeness (rough estimate)
  -- Check which fields are filled: full_name, phone, bio, category, service_areas, verified
  v_profile_completeness := CASE
    WHEN (SELECT COUNT(*) FROM profiles 
          WHERE id = p_specialist_id 
          AND full_name IS NOT NULL 
          AND phone IS NOT NULL) > 0 THEN 50
    ELSE 20
  END;
  IF EXISTS(SELECT 1 FROM specialist_reputation WHERE specialist_id = p_specialist_id) THEN
    UPDATE specialist_reputation
    SET 
      total_completed_jobs = v_completed_jobs,
      total_reviews = (SELECT COUNT(*) FROM reviews WHERE specialist_id = p_specialist_id AND rating IS NOT NULL),
      average_rating = COALESCE(v_avg_rating, 0),
      response_time_hours = COALESCE(v_avg_response_time, 0),
      updated_at = now()
    WHERE specialist_id = p_specialist_id;
  ELSE
    INSERT INTO specialist_reputation (specialist_id, total_completed_jobs, total_reviews, average_rating, response_time_hours, updated_at)
    VALUES (p_specialist_id, v_completed_jobs, COALESCE((SELECT COUNT(*) FROM reviews WHERE specialist_id = p_specialist_id AND rating IS NOT NULL), 0), COALESCE(v_avg_rating, 0), COALESCE(v_avg_response_time, 0), now());
  END IF;
END;
$$;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_sender_id UUID,
  p_type notification_type,
  p_task_id bigint,
  p_title TEXT,
  p_message TEXT,
  p_action_url TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    recipient_id, sender_id, type, task_id, title, message, action_url
  )
  VALUES (p_recipient_id, p_sender_id, p_type, p_task_id, p_title, p_message, p_action_url)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tables created:
--   1. notifications (main in-app notifications)
--   2. notification_preferences (per-user channel preferences)
--   3. notification_delivery (email/SMS delivery tracking)
--   4. specialist_metrics (response time tracking)
--   5. specialist_reputation (aggregated reputation scores)
--   6. contact_access_log (audit log for contact reveals)
--
-- Columns altered:
--   1. workspace_rooms.contact_revealed_at
--
-- Helper functions:
--   1. calculate_specialist_reputation()
--   2. create_notification()
--
-- Next steps (in application code):
--   1. Create notification hooks and services
--   2. Update components to show notifications
--   3. Add reputation display components
--   4. Update contact visibility RLS policies
-- ============================================================================
