-- Production compatibility: some legacy actor columns are text-shaped, so rate limits
-- compare actor IDs as text instead of assuming UUID-typed columns.

CREATE OR REPLACE FUNCTION public.raise_abuse_limit(
  p_actor_id text,
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
          DETAIL = 'actor_id=' || COALESCE(p_actor_id, 'unknown') || ', event_type=' || COALESCE(p_event_type, 'rate_limit');
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_actor_insert_rate_limit(
  p_actor_id text,
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
  IF p_actor_id IS NULL OR p_actor_id = '' OR p_max_count IS NULL OR p_max_count < 1 THEN
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT count(*) FROM %s WHERE %I::text = $1 AND created_at >= now() - $2',
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
BEGIN
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
