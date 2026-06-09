-- Completion receipts are durable closeout records: one receipt per task/type,
-- readable whenever participants reopen the workspace.

WITH ranked_receipts AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY task_id, COALESCE(receipt_type, 'service_agreement')
      ORDER BY created_at DESC, id DESC
    ) AS duplicate_rank
  FROM public.completion_receipts
)
DELETE FROM public.completion_receipts cr
USING ranked_receipts rr
WHERE cr.id = rr.id
  AND rr.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS completion_receipts_unique_task_type
  ON public.completion_receipts (task_id, COALESCE(receipt_type, 'service_agreement'));

CREATE OR REPLACE FUNCTION public.ensure_completion_receipt(
  p_task_id text,
  p_agreement_id text DEFAULT NULL,
  p_receipt_type text DEFAULT 'service_agreement',
  p_note text DEFAULT NULL
)
RETURNS public.completion_receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
  v_receipt public.completion_receipts%ROWTYPE;
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
    AND COALESCE(v_task.specialist_id::text, '') <> v_actor::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.workspace_rooms wr
      WHERE wr.task_id::text = p_task_id
        AND (wr.client_id::text = v_actor::text OR wr.specialist_id::text = v_actor::text)
    )
  THEN
    RAISE EXCEPTION 'Forbidden: only task participants can access this receipt';
  END IF;

  INSERT INTO public.completion_receipts (
    task_id,
    agreement_id,
    receipt_type,
    note
  )
  VALUES (
    v_task.id,
    NULLIF(p_agreement_id, '')::uuid,
    COALESCE(NULLIF(p_receipt_type, ''), 'service_agreement'),
    NULLIF(btrim(COALESCE(p_note, '')), '')
  )
  ON CONFLICT (task_id, COALESCE(receipt_type, 'service_agreement'))
  DO UPDATE SET
    agreement_id = COALESCE(public.completion_receipts.agreement_id, EXCLUDED.agreement_id),
    note = COALESCE(public.completion_receipts.note, EXCLUDED.note)
  RETURNING * INTO v_receipt;

  RETURN v_receipt;
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_completion_receipt(
  p_task_id text,
  p_receipt_type text DEFAULT 'service_agreement'
)
RETURNS public.completion_receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_receipt public.completion_receipts%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT cr.*
    INTO v_receipt
  FROM public.completion_receipts cr
  JOIN public.tasks t ON t.id = cr.task_id
  WHERE cr.task_id::text = p_task_id
    AND COALESCE(cr.receipt_type, 'service_agreement') = COALESCE(NULLIF(p_receipt_type, ''), 'service_agreement')
    AND (
      t.user_id::text = v_actor::text
      OR COALESCE(t.specialist_id::text, '') = v_actor::text
      OR EXISTS (
        SELECT 1
        FROM public.workspace_rooms wr
        WHERE wr.task_id = t.id
          AND (wr.client_id::text = v_actor::text OR wr.specialist_id::text = v_actor::text)
      )
    )
  ORDER BY cr.created_at DESC, cr.id DESC
  LIMIT 1;

  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_completion_receipt(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fetch_completion_receipt(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ensure_completion_receipt(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_completion_receipt(text, text) TO authenticated;
