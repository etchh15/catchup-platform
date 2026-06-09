-- Compatibility RPCs for production schemas where task ids may be bigint
-- while newer local schemas use uuid.

CREATE OR REPLACE FUNCTION public.is_task_participant(p_task_identifier text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id::text = p_task_identifier
      AND (
        t.user_id::text = p_user_id::text
        OR t.specialist_id::text = p_user_id::text
        OR EXISTS (
          SELECT 1
          FROM public.workspace_rooms wr
          WHERE wr.task_id::text = t.id::text
            AND (wr.client_id = p_user_id OR wr.specialist_id = p_user_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.bids b
          WHERE b.task_id::text = t.id::text
            AND b.specialist_id = p_user_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_dispute_participant(p_dispute_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.disputes d
    WHERE d.id = p_dispute_id
      AND (
        d.filed_by = p_user_id
        OR public.is_task_participant(d.task_id::text, p_user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.create_app_notification(
  p_recipient_id uuid,
  p_sender_id uuid,
  p_type notification_type,
  p_title text,
  p_message text,
  p_action_url text DEFAULT NULL,
  p_task_id text DEFAULT NULL,
  p_related_id uuid DEFAULT NULL
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_notification public.notifications;
  v_task_column_type text;
  v_task_value text := p_task_id;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_sender_id IS NOT NULL AND p_sender_id <> v_actor THEN
    RAISE EXCEPTION 'Forbidden: sender must match authenticated user';
  END IF;

  IF p_task_id IS NOT NULL AND NOT public.is_task_participant(p_task_id, v_actor) THEN
    RAISE EXCEPTION 'Forbidden: sender is not a task participant';
  END IF;

  IF p_task_id IS NOT NULL AND NOT public.is_task_participant(p_task_id, p_recipient_id) THEN
    RAISE EXCEPTION 'Forbidden: recipient is not a task participant';
  END IF;

  SELECT data_type INTO v_task_column_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'notifications'
    AND column_name = 'task_id';

  IF v_task_column_type = 'uuid'
    AND (p_task_id IS NULL OR p_task_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  THEN
    v_task_value := NULL;
  END IF;

  IF v_task_column_type = 'uuid' THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, task_id, related_id, title, message, action_url)
    VALUES (p_recipient_id, p_sender_id, p_type, v_task_value::uuid, p_related_id, p_title, p_message, p_action_url)
    RETURNING * INTO v_notification;
  ELSIF v_task_column_type IN ('bigint', 'integer', 'smallint') THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, task_id, related_id, title, message, action_url)
    VALUES (p_recipient_id, p_sender_id, p_type, v_task_value::bigint, p_related_id, p_title, p_message, p_action_url)
    RETURNING * INTO v_notification;
  ELSE
    INSERT INTO public.notifications (recipient_id, sender_id, type, task_id, related_id, title, message, action_url)
    VALUES (p_recipient_id, p_sender_id, p_type, v_task_value, p_related_id, p_title, p_message, p_action_url)
    RETURNING * INTO v_notification;
  END IF;

  RETURN v_notification;
END;
$$;

CREATE OR REPLACE FUNCTION public.file_task_dispute(
  p_task_id text,
  p_reason text,
  p_reason_category text DEFAULT NULL,
  p_referenced_message_id uuid DEFAULT NULL
)
RETURNS public.disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_dispute public.disputes;
  v_task_column_type text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_task_participant(p_task_id, v_actor) THEN
    RAISE EXCEPTION 'Forbidden: only task participants can file disputes';
  END IF;

  SELECT data_type INTO v_task_column_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'disputes'
    AND column_name = 'task_id';

  IF v_task_column_type = 'uuid' THEN
    INSERT INTO public.disputes (task_id, filed_by, reason, reason_category, referenced_message_id, status)
    VALUES (p_task_id::uuid, v_actor, p_reason, p_reason_category, p_referenced_message_id, 'open')
    RETURNING * INTO v_dispute;
  ELSIF v_task_column_type IN ('bigint', 'integer', 'smallint') THEN
    INSERT INTO public.disputes (task_id, filed_by, reason, reason_category, referenced_message_id, status)
    VALUES (p_task_id::bigint, v_actor, p_reason, p_reason_category, p_referenced_message_id, 'open')
    RETURNING * INTO v_dispute;
  ELSE
    INSERT INTO public.disputes (task_id, filed_by, reason, reason_category, referenced_message_id, status)
    VALUES (p_task_id, v_actor, p_reason, p_reason_category, p_referenced_message_id, 'open')
    RETURNING * INTO v_dispute;
  END IF;

  RETURN v_dispute;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_dispute_evidence(
  p_dispute_id uuid,
  p_evidence jsonb
)
RETURNS public.disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_dispute public.disputes;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_dispute_participant(p_dispute_id, v_actor) THEN
    RAISE EXCEPTION 'Forbidden: only dispute participants can attach evidence';
  END IF;

  UPDATE public.disputes
  SET evidence = COALESCE(p_evidence, '[]'::jsonb),
      updated_at = now()
  WHERE id = p_dispute_id
  RETURNING * INTO v_dispute;

  RETURN v_dispute;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_task_dispute(
  p_dispute_id uuid,
  p_message text,
  p_evidence jsonb DEFAULT NULL
)
RETURNS public.dispute_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_response public.dispute_responses;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_dispute_participant(p_dispute_id, v_actor) THEN
    RAISE EXCEPTION 'Forbidden: only dispute participants can respond';
  END IF;

  INSERT INTO public.dispute_responses (dispute_id, responder_id, message, evidence)
  VALUES (p_dispute_id, v_actor, p_message, p_evidence)
  RETURNING * INTO v_response;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.create_app_notification(uuid, uuid, notification_type, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.file_task_dispute(text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_dispute_evidence(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_to_task_dispute(uuid, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_app_notification(uuid, uuid, notification_type, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.file_task_dispute(text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_dispute_evidence(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_task_dispute(uuid, text, jsonb) TO authenticated;
