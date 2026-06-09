-- Airbnb-style request discipline for CatchUp:
-- public tasks stay available, but each specialist proposal has a 24 hour
-- client response window. Expired proposals remain auditable history and
-- cannot be accepted into a workspace.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

UPDATE public.bids
SET expires_at = COALESCE(expires_at, created_at + interval '24 hours')
WHERE expires_at IS NULL;

ALTER TABLE public.bids
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

CREATE INDEX IF NOT EXISTS idx_bids_pending_expiry
  ON public.bids (expires_at)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.expire_stale_bid_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count integer;
BEGIN
  UPDATE public.bids b
  SET
    status = 'expired',
    updated_at = now()
  FROM public.tasks t
  WHERE b.task_id::text = t.id::text
    AND b.status = 'pending'
    AND b.expires_at <= now()
    AND COALESCE(t.status, 'open') = 'open';

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_bid_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_bid_requests() TO authenticated;

DROP FUNCTION IF EXISTS public.accept_bid(text, uuid);
DROP FUNCTION IF EXISTS public.accept_bid(uuid, uuid);

CREATE OR REPLACE FUNCTION public.accept_bid(p_task_id bigint, p_bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_specialist_id uuid;
  v_amount numeric;
  v_proposal_note text;
  v_expires_at timestamptz;
  v_room_id uuid;
  v_agreement_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.expire_stale_bid_requests();

  SELECT (user_id::text)::uuid INTO v_client_id
  FROM public.tasks
  WHERE id = p_task_id
    AND status = 'open';

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Task not found or no longer accepting proposals';
  END IF;

  IF v_client_id <> auth.uid()::uuid THEN
    RAISE EXCEPTION 'Forbidden: Only task creator can accept proposals';
  END IF;

  SELECT (specialist_id::text)::uuid, amount, note, expires_at
    INTO v_specialist_id, v_amount, v_proposal_note, v_expires_at
  FROM public.bids
  WHERE id = p_bid_id
    AND task_id = p_task_id
    AND status = 'pending'
  FOR UPDATE;

  IF v_specialist_id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found or no longer pending';
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at <= now() THEN
    UPDATE public.bids
    SET status = 'expired',
        updated_at = now()
    WHERE id = p_bid_id;

    RAISE EXCEPTION 'This proposal response window has expired. Ask the specialist to send a new proposal.';
  END IF;

  UPDATE public.bids
  SET status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  WHERE id = p_bid_id;

  UPDATE public.bids
  SET status = 'rejected',
      updated_at = now()
  WHERE task_id = p_task_id
    AND id <> p_bid_id
    AND status <> 'accepted';

  SELECT id INTO v_agreement_id
  FROM public.agreements
  WHERE task_id = p_task_id
    AND client_id = v_client_id
    AND specialist_id = v_specialist_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_agreement_id IS NULL THEN
    INSERT INTO public.agreements (
      task_id,
      client_id,
      specialist_id,
      agreed_amount,
      proposal_note,
      accepted_at,
      created_at,
      updated_at
    ) VALUES (
      p_task_id,
      v_client_id,
      v_specialist_id,
      v_amount,
      v_proposal_note,
      now(),
      now(),
      now()
    )
    RETURNING id INTO v_agreement_id;
  ELSE
    UPDATE public.agreements
    SET agreed_amount = v_amount,
        proposal_note = v_proposal_note,
        accepted_at = COALESCE(accepted_at, now()),
        updated_at = now()
    WHERE id = v_agreement_id;
  END IF;

  UPDATE public.tasks
  SET status = 'active',
      specialist_id = v_specialist_id,
      agreement_id = v_agreement_id,
      updated_at = now()
  WHERE id = p_task_id;

  INSERT INTO public.workspace_rooms (task_id, client_id, specialist_id, status)
  VALUES (p_task_id, v_client_id, v_specialist_id, 'active')
  ON CONFLICT (task_id, client_id, specialist_id) DO NOTHING
  RETURNING id INTO v_room_id;

  IF v_room_id IS NULL THEN
    SELECT id INTO v_room_id
    FROM public.workspace_rooms
    WHERE task_id = p_task_id
      AND client_id = v_client_id
      AND specialist_id = v_specialist_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  INSERT INTO public.agreement_milestones (
    agreement_id,
    milestone_number,
    name,
    description,
    status,
    completed_by,
    completed_at,
    created_at,
    updated_at
  )
  SELECT v_agreement_id, n,
    CASE n
      WHEN 1 THEN 'Request confirmed'
      WHEN 2 THEN 'Visit scheduled'
      WHEN 3 THEN 'Work started'
      WHEN 4 THEN 'Client inspection'
      WHEN 5 THEN 'Review and receipt'
    END,
    CASE n
      WHEN 1 THEN 'Client accepted a specialist proposal before the response window expired'
      WHEN 2 THEN 'Appointment confirmed'
      WHEN 3 THEN 'Specialist began work'
      WHEN 4 THEN 'Client reviews delivery quality'
      WHEN 5 THEN 'Two-sided review and receipt close the transaction'
    END,
    CASE WHEN n = 1 THEN 'completed' ELSE 'pending' END,
    CASE WHEN n = 1 THEN v_client_id::text ELSE NULL END,
    CASE WHEN n = 1 THEN now() ELSE NULL END,
    now(),
    now()
  FROM generate_series(1, 5) AS g(n)
  ON CONFLICT (agreement_id, milestone_number) DO NOTHING;

  RETURN jsonb_build_object(
    'task_id', p_task_id,
    'bid_id', p_bid_id,
    'client_id', v_client_id,
    'specialist_id', v_specialist_id,
    'room_id', v_room_id,
    'agreement_id', v_agreement_id,
    'amount', v_amount,
    'accepted_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_bid(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_bid(bigint, uuid) TO authenticated;
