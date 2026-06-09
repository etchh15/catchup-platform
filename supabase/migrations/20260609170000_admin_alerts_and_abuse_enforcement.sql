-- Founder-away hardening: admin alert outbox and stricter server-side abuse controls.

CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  subject text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipient_email text NOT NULL DEFAULT 'etchh0@gmail.com',
  delivery_status text NOT NULL DEFAULT 'pending',
  delivery_attempts integer NOT NULL DEFAULT 0,
  last_delivery_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE public.admin_alerts
  DROP CONSTRAINT IF EXISTS admin_alerts_severity_check;
ALTER TABLE public.admin_alerts
  ADD CONSTRAINT admin_alerts_severity_check
  CHECK (severity IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE public.admin_alerts
  DROP CONSTRAINT IF EXISTS admin_alerts_delivery_status_check;
ALTER TABLE public.admin_alerts
  ADD CONSTRAINT admin_alerts_delivery_status_check
  CHECK (delivery_status IN ('pending', 'sent', 'skipped', 'failed'));

ALTER TABLE public.admin_alerts
  DROP CONSTRAINT IF EXISTS admin_alerts_single_recipient_check;
ALTER TABLE public.admin_alerts
  ADD CONSTRAINT admin_alerts_single_recipient_check
  CHECK (lower(recipient_email) = 'etchh0@gmail.com');

CREATE INDEX IF NOT EXISTS idx_admin_alerts_status_created
  ON public.admin_alerts(delivery_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_event_created
  ON public.admin_alerts(event_type, created_at DESC);

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read admin alerts" ON public.admin_alerts;
CREATE POLICY "Admins read admin alerts" ON public.admin_alerts
  FOR SELECT
  USING (public.current_user_is_platform_admin());

DROP POLICY IF EXISTS "Admins update admin alert delivery" ON public.admin_alerts;
CREATE POLICY "Admins update admin alert delivery" ON public.admin_alerts
  FOR UPDATE
  USING (public.current_user_is_platform_admin())
  WITH CHECK (public.current_user_is_platform_admin());

DROP POLICY IF EXISTS "Service role manages admin alerts" ON public.admin_alerts;
CREATE POLICY "Service role manages admin alerts" ON public.admin_alerts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.enqueue_admin_alert(
  p_event_type text,
  p_severity text,
  p_subject text,
  p_body text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert_id uuid;
  v_severity text := COALESCE(NULLIF(p_severity, ''), 'medium');
BEGIN
  IF v_severity NOT IN ('low', 'medium', 'high', 'critical') THEN
    v_severity := 'medium';
  END IF;

  INSERT INTO public.admin_alerts (
    event_type,
    severity,
    subject,
    body,
    payload,
    recipient_email
  )
  VALUES (
    COALESCE(NULLIF(p_event_type, ''), 'platform_alert'),
    v_severity,
    LEFT(COALESCE(NULLIF(p_subject, ''), 'CatchUp platform alert'), 180),
    LEFT(COALESCE(NULLIF(p_body, ''), 'Review the CatchUp admin console.'), 4000),
    COALESCE(p_payload, '{}'::jsonb),
    'etchh0@gmail.com'
  )
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_admin_alert(text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_admin_alert(text, text, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_admin_new_dispute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_title text;
BEGIN
  SELECT title INTO v_task_title
  FROM public.tasks
  WHERE id = NEW.task_id;

  PERFORM public.enqueue_admin_alert(
    'new_dispute',
    'critical',
    'New CatchUp dispute needs review',
    'A dispute was filed for "' || COALESCE(v_task_title, 'Untitled task') || '". Open the admin dispute queue.',
    jsonb_build_object(
      'dispute_id', NEW.id,
      'task_id', NEW.task_id,
      'filed_by', NEW.filed_by,
      'reason_category', NEW.reason_category,
      'created_at', NEW.created_at
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alert_admin_new_dispute_trigger ON public.disputes;
CREATE TRIGGER alert_admin_new_dispute_trigger
  AFTER INSERT ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_dispute();

CREATE OR REPLACE FUNCTION public.notify_admin_pending_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('specialist', 'SPECIALIST')
     AND NEW.verification_status = 'pending_verification'
     AND COALESCE(OLD.verification_status, 'unverified') IS DISTINCT FROM 'pending_verification' THEN
    PERFORM public.enqueue_admin_alert(
      'pending_specialist_verification',
      'high',
      'Specialist verification waiting',
      COALESCE(NEW.full_name, NEW.email, 'A specialist') || ' requested verification. Review within 48 hours.',
      jsonb_build_object(
        'profile_id', NEW.id,
        'email', NEW.email,
        'full_name', NEW.full_name,
        'category', NEW.category,
        'district_tag', NEW.district_tag,
        'requested_at', NEW.verification_requested_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alert_admin_pending_verification_trigger ON public.profiles;
CREATE TRIGGER alert_admin_pending_verification_trigger
  AFTER UPDATE OF verification_status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_pending_verification();

CREATE OR REPLACE FUNCTION public.notify_admin_onboarding_pause()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.key = 'onboarding'
     AND COALESCE((NEW.value ->> 'paused')::boolean, false) = true
     AND COALESCE((OLD.value ->> 'paused')::boolean, false) = false THEN
    PERFORM public.enqueue_admin_alert(
      'onboarding_pause_triggered',
      'high',
      'CatchUp onboarding was paused',
      COALESCE(NEW.value ->> 'reason', 'Onboarding was paused from the admin console.'),
      jsonb_build_object(
        'setting_key', NEW.key,
        'updated_by', NEW.updated_by,
        'updated_at', NEW.updated_at,
        'value', NEW.value
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alert_admin_onboarding_pause_trigger ON public.platform_settings;
CREATE TRIGGER alert_admin_onboarding_pause_trigger
  AFTER UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_onboarding_pause();

CREATE OR REPLACE FUNCTION public.notify_admin_abuse_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_admin_alert(
    'suspicious_activity',
    CASE WHEN NEW.severity IN ('high', 'critical') THEN NEW.severity ELSE 'medium' END,
    'Suspicious activity logged',
    COALESCE(NEW.notes, 'An abuse event was logged. Review the admin console.'),
    jsonb_build_object(
      'abuse_event_id', NEW.id,
      'actor_id', NEW.actor_id,
      'target_id', NEW.target_id,
      'target_type', NEW.target_type,
      'event_type', NEW.event_type,
      'severity', NEW.severity,
      'created_at', NEW.created_at
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alert_admin_abuse_event_trigger ON public.abuse_events;
CREATE TRIGGER alert_admin_abuse_event_trigger
  AFTER INSERT ON public.abuse_events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_abuse_event();

CREATE OR REPLACE FUNCTION public.report_critical_workflow_failure(
  p_workflow text,
  p_error_message text,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_alert_id uuid;
BEGIN
  INSERT INTO public.abuse_events (
    actor_id,
    target_type,
    event_type,
    severity,
    status,
    notes
  )
  VALUES (
    v_actor,
    'workflow',
    'critical_workflow_failure',
    'high',
    'open',
    LEFT(COALESCE(p_workflow, 'unknown_workflow') || ': ' || COALESCE(p_error_message, 'Unknown error'), 1000)
  );

  v_alert_id := public.enqueue_admin_alert(
    'failed_critical_workflow',
    'high',
    'CatchUp critical workflow failed',
    COALESCE(p_workflow, 'unknown_workflow') || ' failed: ' || COALESCE(p_error_message, 'Unknown error'),
    jsonb_build_object(
      'actor_id', v_actor,
      'workflow', p_workflow,
      'error_message', p_error_message,
      'context', COALESCE(p_context, '{}'::jsonb),
      'reported_at', now()
    )
  );

  RETURN v_alert_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_critical_workflow_failure(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_critical_workflow_failure(text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.raise_abuse_limit(
  p_actor_id uuid,
  p_event_type text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '%', p_message
    USING ERRCODE = 'P0001',
          DETAIL = 'actor_id=' || COALESCE(p_actor_id::text, 'unknown') || ', event_type=' || COALESCE(p_event_type, 'rate_limit');
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_actor_insert_rate_limit(
  p_actor_id uuid,
  p_table regclass,
  p_actor_column text,
  p_event_type text,
  p_window interval,
  p_max_count integer,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_actor_id IS NULL OR p_max_count IS NULL OR p_max_count < 1 THEN
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT count(*) FROM %s WHERE %I = $1 AND created_at >= now() - $2',
    p_table,
    p_actor_column
  )
  INTO v_count
  USING p_actor_id, p_window;

  IF v_count >= p_max_count THEN
    PERFORM public.raise_abuse_limit(p_actor_id, p_event_type, p_message);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_task_creation_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_actor_insert_rate_limit(NEW.user_id, 'public.tasks', 'user_id', 'task_post_rate_limit', interval '1 hour', 4, 'Too many job posts. Please wait before posting again.');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.user_id, 'public.tasks', 'user_id', 'task_post_daily_limit', interval '1 day', 12, 'Daily job post limit reached for beta safety.');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_task_creation_rate_limit_trigger ON public.tasks;
CREATE TRIGGER enforce_task_creation_rate_limit_trigger
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_creation_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_bid_creation_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_actor_insert_rate_limit(NEW.specialist_id, 'public.bids', 'specialist_id', 'proposal_rate_limit', interval '1 hour', 12, 'Too many proposals. Please wait before bidding again.');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.specialist_id, 'public.bids', 'specialist_id', 'proposal_daily_limit', interval '1 day', 40, 'Daily proposal limit reached for beta safety.');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_bid_creation_rate_limit_trigger ON public.bids;
CREATE TRIGGER enforce_bid_creation_rate_limit_trigger
  BEFORE INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_bid_creation_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_workspace_message_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_actor_insert_rate_limit(NEW.sender_id, 'public.workspace_messages', 'sender_id', 'message_burst_rate_limit', interval '1 minute', 10, 'Message limit reached. Please slow down.');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.sender_id, 'public.workspace_messages', 'sender_id', 'message_hourly_rate_limit', interval '1 hour', 60, 'Hourly message limit reached for beta safety.');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_workspace_message_rate_limit_trigger ON public.workspace_messages;
CREATE TRIGGER enforce_workspace_message_rate_limit_trigger
  BEFORE INSERT ON public.workspace_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_workspace_message_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_dispute_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_actor_insert_rate_limit(NEW.filed_by, 'public.disputes', 'filed_by', 'dispute_rate_limit', interval '1 hour', 2, 'Too many disputes filed. Please wait before opening another case.');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.filed_by, 'public.disputes', 'filed_by', 'dispute_daily_limit', interval '1 day', 5, 'Daily dispute limit reached. Contact support for urgent safety issues.');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_dispute_rate_limit_trigger ON public.disputes;
CREATE TRIGGER enforce_dispute_rate_limit_trigger
  BEFORE INSERT ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_dispute_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_dispute_response_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_actor_insert_rate_limit(NEW.responder_id, 'public.dispute_responses', 'responder_id', 'dispute_response_rate_limit', interval '1 hour', 10, 'Too many dispute responses. Please wait before replying again.');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_dispute_response_rate_limit_trigger ON public.dispute_responses;
CREATE TRIGGER enforce_dispute_response_rate_limit_trigger
  BEFORE INSERT ON public.dispute_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_dispute_response_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_dispute_upload_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NEW.bucket_id <> 'disputes' OR NEW.owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'disputes'
    AND owner = NEW.owner
    AND created_at >= now() - interval '1 hour';

  IF v_count >= 10 THEN
    PERFORM public.raise_abuse_limit(NEW.owner, 'dispute_upload_rate_limit', 'Too many dispute evidence uploads. Please wait before uploading more files.');
  END IF;

  SELECT count(*)
  INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'disputes'
    AND owner = NEW.owner
    AND created_at >= now() - interval '1 day';

  IF v_count >= 40 THEN
    PERFORM public.raise_abuse_limit(NEW.owner, 'dispute_upload_daily_limit', 'Daily dispute evidence upload limit reached.');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_dispute_upload_rate_limit_trigger ON storage.objects;
CREATE TRIGGER enforce_dispute_upload_rate_limit_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_dispute_upload_rate_limit();
