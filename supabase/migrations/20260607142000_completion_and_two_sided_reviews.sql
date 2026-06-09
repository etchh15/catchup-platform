-- Harden task closeout so active marketplace deals can be delivered,
-- confirmed, and reviewed by both sides without depending on broad table
-- update policies.

CREATE OR REPLACE FUNCTION public.mark_task_work_delivered(
  p_task_id text,
  p_message text DEFAULT NULL
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
    INTO v_task
  FROM public.tasks
  WHERE id::text = p_task_id
  LIMIT 1;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.specialist_id::text <> v_actor::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.workspace_rooms wr
      WHERE wr.task_id::text = p_task_id
        AND wr.specialist_id::text = v_actor::text
    )
  THEN
    RAISE EXCEPTION 'Forbidden: only the assigned specialist can mark delivery';
  END IF;

  UPDATE public.tasks
  SET work_delivered_by = v_actor::text,
      work_delivered_at = COALESCE(work_delivered_at, now()),
      updated_at = now()
  WHERE id::text = p_task_id
  RETURNING * INTO v_task;

  INSERT INTO public.completion_log (task_id, action, actor_id, message)
  VALUES (v_task.id, 'work_delivered', v_actor, COALESCE(p_message, ''))
  ON CONFLICT DO NOTHING;

  RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_task_work_completed(
  p_task_id text,
  p_message text DEFAULT NULL
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
    INTO v_task
  FROM public.tasks
  WHERE id::text = p_task_id
  LIMIT 1;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.user_id::text <> v_actor::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.workspace_rooms wr
      WHERE wr.task_id::text = p_task_id
        AND wr.client_id::text = v_actor::text
    )
  THEN
    RAISE EXCEPTION 'Forbidden: only the client can confirm completion';
  END IF;

  IF v_task.work_delivered_at IS NULL THEN
    RAISE EXCEPTION 'Work must be marked delivered before completion can be confirmed';
  END IF;

  UPDATE public.tasks
  SET confirmed_by_client = v_actor::text,
      confirmed_by_client_at = COALESCE(confirmed_by_client_at, now()),
      status = 'completed',
      updated_at = now()
  WHERE id::text = p_task_id
  RETURNING * INTO v_task;

  UPDATE public.workspace_rooms
  SET status = 'completed',
      updated_at = now()
  WHERE task_id::text = p_task_id
    AND client_id::text = v_actor::text;

  INSERT INTO public.completion_log (task_id, action, actor_id, message)
  VALUES (v_task.id, 'work_confirmed', v_actor, COALESCE(p_message, ''))
  ON CONFLICT DO NOTHING;

  RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION public.rate_client_after_completion(
  p_task_id text,
  p_rating integer,
  p_comment text DEFAULT NULL
)
RETURNS public.specialist_client_ratings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
  v_rating public.specialist_client_ratings;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  SELECT *
    INTO v_task
  FROM public.tasks
  WHERE id::text = p_task_id
  LIMIT 1;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.status <> 'completed' OR v_task.confirmed_by_client_at IS NULL THEN
    RAISE EXCEPTION 'Client can only be rated after confirmed completion';
  END IF;

  IF v_task.specialist_id::text <> v_actor::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.workspace_rooms wr
      WHERE wr.task_id::text = p_task_id
        AND wr.specialist_id::text = v_actor::text
    )
  THEN
    RAISE EXCEPTION 'Forbidden: only the assigned specialist can rate this client';
  END IF;

  INSERT INTO public.specialist_client_ratings (
    specialist_id,
    client_id,
    task_id,
    rating,
    comment,
    submitted_at
  )
  VALUES (
    v_actor,
    v_task.user_id::text::uuid,
    v_task.id,
    p_rating,
    p_comment,
    now()
  )
  ON CONFLICT (specialist_id, task_id)
  DO UPDATE SET
    rating = EXCLUDED.rating,
    comment = EXCLUDED.comment,
    submitted_at = now()
  RETURNING * INTO v_rating;

  INSERT INTO public.client_reputation (
    client_id,
    average_rating_from_specialists,
    total_ratings_given,
    updated_at
  )
  SELECT
    v_task.user_id::text::uuid,
    COALESCE(AVG(rating), 0),
    COUNT(*),
    now()
  FROM public.specialist_client_ratings
  WHERE client_id = v_task.user_id::text::uuid
  ON CONFLICT (client_id)
  DO UPDATE SET
    average_rating_from_specialists = EXCLUDED.average_rating_from_specialists,
    total_ratings_given = EXCLUDED.total_ratings_given,
    updated_at = now();

  RETURN v_rating;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_task_work_delivered(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_task_work_completed(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rate_client_after_completion(text, integer, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mark_task_work_delivered(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_task_work_completed(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rate_client_after_completion(text, integer, text) TO authenticated;
