-- Trust operations: account restriction, automatic pause thresholds, and server-side suspension blocks.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS account_status_note text,
  ADD COLUMN IF NOT EXISTS account_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_status_updated_by uuid;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'restricted', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles(account_status);

CREATE OR REPLACE FUNCTION public.actor_account_status(p_actor_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(account_status, 'active')
  FROM public.profiles
  WHERE id::text = p_actor_id
$$;

CREATE OR REPLACE FUNCTION public.enforce_actor_not_suspended(
  p_actor_id text,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_actor_id IS NULL OR p_actor_id = '' THEN
    RETURN;
  END IF;

  v_status := COALESCE(public.actor_account_status(p_actor_id), 'active');

  IF v_status = 'suspended' THEN
    RAISE EXCEPTION 'This account is suspended and cannot %.', COALESCE(p_action, 'use this feature')
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profile_account_status(
  p_profile_id uuid,
  p_status text,
  p_note text DEFAULT ''
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF NOT public.current_user_is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden: only platform admins can restrict accounts';
  END IF;

  IF p_status NOT IN ('active', 'restricted', 'suspended') THEN
    RAISE EXCEPTION 'Unsupported account status.';
  END IF;

  UPDATE public.profiles
  SET account_status = p_status,
      account_status_note = NULLIF(p_note, ''),
      account_status_updated_at = now(),
      account_status_updated_by = auth.uid()
  WHERE id = p_profile_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF p_status IN ('restricted', 'suspended') THEN
    PERFORM public.enqueue_admin_alert(
      'account_' || p_status,
      CASE WHEN p_status = 'suspended' THEN 'critical' ELSE 'high' END,
      'CatchUp account ' || p_status,
      COALESCE(v_profile.email, v_profile.full_name, v_profile.id::text) || ' was marked ' || p_status || '.',
      jsonb_build_object(
        'profile_id', v_profile.id,
        'email', v_profile.email,
        'status', p_status,
        'note', p_note,
        'updated_by', auth.uid(),
        'updated_at', now()
      )
    );
  END IF;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile_account_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_profile_account_status(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_pause_if_thresholds_exceeded()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open_disputes integer := 0;
  v_recent_abuse integer := 0;
  v_recent_failures integer := 0;
  v_reason text;
BEGIN
  SELECT count(*) INTO v_open_disputes
  FROM public.disputes
  WHERE status IN ('open', 'under_review');

  SELECT count(*) INTO v_recent_abuse
  FROM public.abuse_events
  WHERE status = 'open'
    AND severity IN ('high', 'critical')
    AND created_at >= now() - interval '24 hours';

  SELECT count(*) INTO v_recent_failures
  FROM public.admin_alerts
  WHERE event_type = 'failed_critical_workflow'
    AND created_at >= now() - interval '1 hour';

  IF v_open_disputes <= 3 AND v_recent_abuse < 5 AND v_recent_failures < 3 THEN
    RETURN;
  END IF;

  v_reason := 'Automatic safety pause: '
    || v_open_disputes || ' open disputes, '
    || v_recent_abuse || ' high/critical abuse events in 24h, '
    || v_recent_failures || ' failed critical workflows in 1h.';

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES (
    'onboarding',
    jsonb_build_object('paused', true, 'reason', v_reason, 'updated_at', now(), 'source', 'auto_pause_thresholds'),
    now()
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

  PERFORM public.enqueue_admin_alert(
    'automatic_onboarding_pause',
    'critical',
    'CatchUp automatically paused onboarding',
    v_reason,
    jsonb_build_object(
      'open_disputes', v_open_disputes,
      'recent_abuse_events', v_recent_abuse,
      'recent_failed_workflows', v_recent_failures,
      'paused_at', now()
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.after_dispute_auto_pause_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.auto_pause_if_thresholds_exceeded();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_pause_after_dispute_trigger ON public.disputes;
CREATE TRIGGER auto_pause_after_dispute_trigger
  AFTER INSERT OR UPDATE OF status ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.after_dispute_auto_pause_check();

CREATE OR REPLACE FUNCTION public.after_abuse_auto_pause_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.auto_pause_if_thresholds_exceeded();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_pause_after_abuse_trigger ON public.abuse_events;
CREATE TRIGGER auto_pause_after_abuse_trigger
  AFTER INSERT OR UPDATE OF status, severity ON public.abuse_events
  FOR EACH ROW
  EXECUTE FUNCTION public.after_abuse_auto_pause_check();

CREATE OR REPLACE FUNCTION public.after_alert_auto_pause_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type = 'failed_critical_workflow' THEN
    PERFORM public.auto_pause_if_thresholds_exceeded();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_pause_after_admin_alert_trigger ON public.admin_alerts;
CREATE TRIGGER auto_pause_after_admin_alert_trigger
  AFTER INSERT ON public.admin_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.after_alert_auto_pause_check();

CREATE OR REPLACE FUNCTION public.enforce_task_creation_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_actor_not_suspended(NEW.user_id::text, 'post jobs');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.user_id::text, 'public.tasks', 'user_id', 'task_post_rate_limit', interval '1 hour', 4, 'Too many job posts. Please wait before posting again.');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.user_id::text, 'public.tasks', 'user_id', 'task_post_daily_limit', interval '1 day', 12, 'Daily job post limit reached for beta safety.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_bid_creation_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verified boolean;
BEGIN
  PERFORM public.enforce_actor_not_suspended(NEW.specialist_id::text, 'send proposals');

  IF public.onboarding_is_paused() THEN
    RAISE EXCEPTION '%', public.onboarding_pause_reason()
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(is_verified, false) OR verification_status = 'verified'
  INTO v_verified
  FROM public.profiles
  WHERE id::text = NEW.specialist_id::text
    AND role IN ('specialist', 'SPECIALIST');

  IF COALESCE(v_verified, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Specialist accounts must be manually verified before sending beta proposals.'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.enforce_actor_insert_rate_limit(NEW.specialist_id::text, 'public.bids', 'specialist_id', 'proposal_rate_limit', interval '1 hour', 12, 'Too many proposals. Please wait before bidding again.');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.specialist_id::text, 'public.bids', 'specialist_id', 'proposal_daily_limit', interval '1 day', 40, 'Daily proposal limit reached for beta safety.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_workspace_message_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_actor_not_suspended(NEW.sender_id::text, 'send messages');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.sender_id::text, 'public.workspace_messages', 'sender_id', 'message_burst_rate_limit', interval '1 minute', 10, 'Message limit reached. Please slow down.');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.sender_id::text, 'public.workspace_messages', 'sender_id', 'message_hourly_rate_limit', interval '1 hour', 60, 'Hourly message limit reached for beta safety.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_dispute_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_actor_not_suspended(NEW.filed_by::text, 'file disputes');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.filed_by::text, 'public.disputes', 'filed_by', 'dispute_rate_limit', interval '1 hour', 2, 'Too many disputes filed. Please wait before opening another case.');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.filed_by::text, 'public.disputes', 'filed_by', 'dispute_daily_limit', interval '1 day', 5, 'Daily dispute limit reached. Contact support for urgent safety issues.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_dispute_response_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_actor_not_suspended(NEW.responder_id::text, 'reply to disputes');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.responder_id::text, 'public.dispute_responses', 'responder_id', 'dispute_response_rate_limit', interval '1 hour', 10, 'Too many dispute responses. Please wait before replying again.');
  RETURN NEW;
END;
$$;

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

  PERFORM public.enforce_actor_not_suspended(NEW.owner::text, 'upload dispute evidence');

  SELECT count(*)
  INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'disputes'
    AND owner::text = NEW.owner::text
    AND created_at >= now() - interval '1 hour';

  IF v_count >= 10 THEN
    PERFORM public.raise_abuse_limit(NEW.owner::text, 'dispute_upload_rate_limit', 'Too many dispute evidence uploads. Please wait before uploading more files.');
  END IF;

  SELECT count(*)
  INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'disputes'
    AND owner::text = NEW.owner::text
    AND created_at >= now() - interval '1 day';

  IF v_count >= 40 THEN
    PERFORM public.raise_abuse_limit(NEW.owner::text, 'dispute_upload_daily_limit', 'Daily dispute evidence upload limit reached.');
  END IF;

  RETURN NEW;
END;
$$;
