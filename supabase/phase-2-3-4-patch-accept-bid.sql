-- Patch: Extend accept_bid to create agreement and milestones on bid acceptance
-- Run after Phase 2-3-4 migrations have been applied.
-- Updated with defensive UUID type casting to prevent type errors

CREATE OR REPLACE FUNCTION public.accept_bid(p_task_id uuid, p_bid_id uuid)
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
  v_room_id uuid;
  v_agreement_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Defensive UUID casting: cast to text first, then to uuid
  SELECT (user_id::text)::uuid INTO v_client_id
  FROM tasks
  WHERE id = p_task_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_client_id <> auth.uid()::uuid THEN
    RAISE EXCEPTION 'Forbidden: Only task creator can accept bids';
  END IF;

  -- Defensive UUID casting for specialist_id
  SELECT (specialist_id::text)::uuid, amount, note
    INTO v_specialist_id, v_amount, v_proposal_note
  FROM bids
  WHERE id = p_bid_id AND task_id = p_task_id
  FOR UPDATE;

  IF v_specialist_id IS NULL THEN
    RAISE EXCEPTION 'Bid not found for task';
  END IF;

  UPDATE bids
  SET status = 'accepted', updated_at = now()
  WHERE id = p_bid_id;

  UPDATE bids
  SET status = 'rejected', updated_at = now()
  WHERE task_id = p_task_id AND id <> p_bid_id AND status <> 'accepted';

  -- Defensive UUID casting in INSERT values
  INSERT INTO agreements (
    task_id, client_id, specialist_id, agreed_amount, proposal_note, accepted_at, created_at, updated_at
  ) VALUES (
    p_task_id, (v_client_id::text)::uuid, (v_specialist_id::text)::uuid, v_amount, v_proposal_note, now(), now(), now()
  ) RETURNING id INTO v_agreement_id;

  -- Defensive UUID casting for specialist_id UPDATE
  UPDATE tasks
  SET status = 'active',
      specialist_id = (v_specialist_id::text)::uuid,
      agreement_id = v_agreement_id,
      updated_at = now()
  WHERE id = p_task_id;

  -- Defensive UUID casting in workspace_rooms INSERT
  INSERT INTO workspace_rooms (task_id, client_id, specialist_id, status)
  VALUES (p_task_id, (v_client_id::text)::uuid, (v_specialist_id::text)::uuid, 'active')
  ON CONFLICT (task_id, client_id, specialist_id) DO NOTHING
  RETURNING id INTO v_room_id;

  IF v_room_id IS NULL THEN
    -- Defensive UUID casting in SELECT
    SELECT id INTO v_room_id
    FROM workspace_rooms
    WHERE task_id = p_task_id AND client_id = (v_client_id::text)::uuid AND specialist_id = (v_specialist_id::text)::uuid
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  INSERT INTO agreement_milestones (
    agreement_id, milestone_number, name, description, status, completed_by, completed_at, created_at, updated_at
  )
  SELECT v_agreement_id, n,
    CASE n
      WHEN 1 THEN 'Request Confirmed'
      WHEN 2 THEN 'Work Scheduled'
      WHEN 3 THEN 'Work Started'
      WHEN 4 THEN 'Client Inspection'
      WHEN 5 THEN 'Completed'
    END,
    CASE n
      WHEN 1 THEN 'Task posted and agreement created'
      WHEN 2 THEN 'Appointment confirmed'
      WHEN 3 THEN 'Specialist began work'
      WHEN 4 THEN 'Client reviews quality'
      WHEN 5 THEN 'Work has been confirmed complete'
    END,
    CASE WHEN n = 1 THEN 'completed' ELSE 'pending' END,
    CASE WHEN n = 1 THEN v_client_id::text ELSE NULL END,
    CASE WHEN n = 1 THEN now() ELSE NULL END,
    now(), now()
  FROM generate_series(1, 5) AS g(n)
  ON CONFLICT (agreement_id, milestone_number) DO NOTHING;

  RETURN jsonb_build_object(
    'task_id', p_task_id,
    'bid_id', p_bid_id,
    'client_id', v_client_id,
    'specialist_id', v_specialist_id,
    'room_id', v_room_id,
    'agreement_id', v_agreement_id,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_bid(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_bid(uuid, uuid) TO authenticated;
