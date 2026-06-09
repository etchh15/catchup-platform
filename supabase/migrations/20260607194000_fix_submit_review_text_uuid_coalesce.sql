-- Fix client review submission on production schemas where tasks.user_id and
-- tasks.confirmed_by_client are text while auth.uid() is uuid.

CREATE OR REPLACE FUNCTION public.submit_task_review(
  p_room_id text,
  p_task_id text,
  p_specialist_id text,
  p_rating_score integer,
  p_feedback_text text DEFAULT NULL
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
  v_room public.workspace_rooms%ROWTYPE;
  v_review public.reviews%ROWTYPE;
  v_feedback text := NULLIF(btrim(COALESCE(p_feedback_text, '')), '');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit a review.';
  END IF;

  IF p_rating_score IS NULL OR p_rating_score < 1 OR p_rating_score > 5 THEN
    RAISE EXCEPTION 'Rating score must be between 1 and 5.';
  END IF;

  SELECT *
  INTO v_task
  FROM public.tasks
  WHERE id::text = p_task_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found for review submission.';
  END IF;

  SELECT *
  INTO v_room
  FROM public.workspace_rooms
  WHERE (
      p_room_id IS NOT NULL
      AND id::text = p_room_id
    )
    OR (
      task_id::text = p_task_id
      AND client_id::text = v_actor::text
      AND specialist_id::text = p_specialist_id
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace room not found for review submission.';
  END IF;

  IF v_task.user_id::text <> v_actor::text OR v_room.client_id::text <> v_actor::text THEN
    RAISE EXCEPTION 'Only the client who owns this task can submit the specialist review.';
  END IF;

  IF v_room.specialist_id::text <> p_specialist_id THEN
    RAISE EXCEPTION 'Review specialist does not match the workspace specialist.';
  END IF;

  IF COALESCE(v_task.status, '') <> 'completed' AND v_task.work_delivered_at IS NULL THEN
    RAISE EXCEPTION 'The specialist must mark the work delivered before the client can review it.';
  END IF;

  UPDATE public.tasks
  SET
    status = 'completed',
    confirmed_by_client = COALESCE(NULLIF(confirmed_by_client, ''), v_actor::text),
    confirmed_by_client_at = COALESCE(confirmed_by_client_at, now()),
    updated_at = now()
  WHERE id::text = p_task_id;

  UPDATE public.workspace_rooms
  SET status = 'completed'
  WHERE id = v_room.id;

  SELECT *
  INTO v_review
  FROM public.reviews
  WHERE task_id::text = p_task_id
    AND client_id::text = v_actor::text
    AND specialist_id::text = p_specialist_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.reviews
    SET
      rating_score = p_rating_score,
      feedback_text = v_feedback
    WHERE id = v_review.id
    RETURNING * INTO v_review;
  ELSE
    INSERT INTO public.reviews (
      room_id,
      task_id,
      client_id,
      specialist_id,
      rating_score,
      feedback_text
    )
    VALUES (
      v_room.id,
      v_task.id,
      v_actor,
      v_room.specialist_id,
      p_rating_score,
      v_feedback
    )
    RETURNING * INTO v_review;
  END IF;

  IF to_regprocedure('public.recalculate_specialist_reputation(uuid)') IS NOT NULL THEN
    PERFORM public.recalculate_specialist_reputation(v_room.specialist_id);
  END IF;

  RETURN v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_task_review(text, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_task_review(text, text, text, integer, text) TO authenticated;
