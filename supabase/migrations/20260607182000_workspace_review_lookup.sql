-- Robust review lookup for workspace UI.
-- Older production rows can differ in task/room id shape, so compare IDs as
-- text inside the database and still enforce participant ownership.

CREATE OR REPLACE FUNCTION public.fetch_workspace_review(
  p_room_id text DEFAULT NULL,
  p_task_id text DEFAULT NULL,
  p_client_id text DEFAULT NULL,
  p_specialist_id text DEFAULT NULL
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_review public.reviews%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
    INTO v_review
  FROM public.reviews r
  WHERE (
      (p_room_id IS NOT NULL AND r.room_id::text = p_room_id)
      OR (p_task_id IS NOT NULL AND r.task_id::text = p_task_id)
    )
    AND (p_client_id IS NULL OR r.client_id::text = p_client_id)
    AND (p_specialist_id IS NULL OR r.specialist_id::text = p_specialist_id)
    AND (r.client_id::text = v_actor::text OR r.specialist_id::text = v_actor::text)
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT 1;

  RETURN v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_workspace_review(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_workspace_review(text, text, text, text) TO authenticated;
