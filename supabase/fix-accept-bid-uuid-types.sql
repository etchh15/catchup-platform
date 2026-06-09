-- Fix: Accept Bid UUID Type Alignment
-- tasks.id is UUID in the production schema, so this patch keeps accept_bid
-- aligned with the task table and returns the agreement/workspace identifiers.

CREATE OR REPLACE FUNCTION public.accept_bid(p_task_id uuid, p_bid_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
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

  -- Get client ID from task, ensuring it's cast to UUID
  SELECT (user_id::text)::uuid INTO v_client_id
  FROM tasks
  WHERE id = p_task_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  -- Verify client is the one accepting (their own task)
  IF v_client_id <> auth.uid()::uuid THEN
    RAISE EXCEPTION 'Forbidden: Only task creator can accept bids';
  END IF;

  -- Get bid details, all values cast to proper types
  SELECT 
    (specialist_id::text)::uuid,
    amount,
    note
  INTO v_specialist_id, v_amount, v_proposal_note
  FROM bids
  WHERE id = p_bid_id AND task_id = p_task_id
  FOR UPDATE;

  IF v_specialist_id IS NULL THEN
    RAISE EXCEPTION 'Bid not found for task';
  END IF;

  -- Update bid status to accepted
  UPDATE bids
  SET status = 'accepted', updated_at = now()
  WHERE id = p_bid_id;

  -- Reject other bids for this task
  UPDATE bids
  SET status = 'rejected', updated_at = now()
  WHERE task_id = p_task_id AND id <> p_bid_id AND status <> 'accepted';

  -- Create agreement with explicit type casting
  INSERT INTO agreements (
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
    (v_client_id::text)::uuid,
    (v_specialist_id::text)::uuid,
    v_amount,
    v_proposal_note,
    now(),
    now(),
    now()
  ) RETURNING id INTO v_agreement_id;

  -- Update task status and link agreement
  UPDATE tasks
  SET 
    status = 'active',
    specialist_id = (v_specialist_id::text)::uuid,
    agreement_id = v_agreement_id,
    updated_at = now()
  WHERE id = p_task_id;

  -- Create workspace room with explicit type casting
  INSERT INTO workspace_rooms (
    task_id, 
    client_id, 
    specialist_id, 
    status
  ) VALUES (
    p_task_id,
    (v_client_id::text)::uuid,
    (v_specialist_id::text)::uuid,
    'active'
  )
  ON CONFLICT (task_id, client_id, specialist_id) DO NOTHING
  RETURNING id INTO v_room_id;

  -- If conflict occurred, fetch existing room
  IF v_room_id IS NULL THEN
    SELECT id INTO v_room_id
    FROM workspace_rooms
    WHERE task_id = p_task_id 
      AND client_id = (v_client_id::text)::uuid 
      AND specialist_id = (v_specialist_id::text)::uuid
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Create default milestones for the agreement
  INSERT INTO agreement_milestones (
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
  SELECT 
    v_agreement_id,
    n,
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
    now(),
    now()
  FROM generate_series(1, 5) AS g(n)
  ON CONFLICT (agreement_id, milestone_number) DO NOTHING;

  -- Return success response
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
$function$;

-- Ensure proper permissions
REVOKE ALL ON FUNCTION public.accept_bid(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_bid(uuid, uuid) TO authenticated;

-- Create missing agreement_milestones table and RLS if not present
CREATE TABLE IF NOT EXISTS agreement_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  milestone_number INT NOT NULL CHECK (milestone_number BETWEEN 1 AND 5),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_by TEXT,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (agreement_id, milestone_number)
);

COMMENT ON TABLE agreement_milestones IS 'Agreement milestones that segment work into ordered deliverables.';
CREATE INDEX IF NOT EXISTS idx_milestones_agreement ON agreement_milestones(agreement_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON agreement_milestones(status);

DROP POLICY IF EXISTS "Milestones readable by participants" ON agreement_milestones;
CREATE POLICY "Milestones readable by participants" ON agreement_milestones
  FOR SELECT USING (
    agreement_id IN (
      SELECT id FROM agreements
      WHERE specialist_id = auth.uid() OR client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Milestones updateable by service role" ON agreement_milestones;
CREATE POLICY "Milestones updateable by service role" ON agreement_milestones
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Milestones insertable by service role" ON agreement_milestones;
CREATE POLICY "Milestones insertable by service role" ON agreement_milestones
  FOR INSERT WITH CHECK (true);

ALTER TABLE agreement_milestones ENABLE ROW LEVEL SECURITY;

-- Fix trigger that creates a workspace room on bid acceptance.
CREATE OR REPLACE FUNCTION public.handle_accepted_bid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    INSERT INTO public.workspace_rooms (task_id, client_id, specialist_id, status)
    VALUES (
      NEW.task_id,
      (SELECT (user_id::text)::uuid FROM public.tasks WHERE id = NEW.task_id),
      NEW.specialist_id,
      'active'
    )
    ON CONFLICT (task_id, client_id, specialist_id) DO NOTHING;

    UPDATE public.tasks
    SET status = 'active',
        specialist_id = NEW.specialist_id,
        updated_at = now()
    WHERE id = NEW.task_id;

    UPDATE public.bids
    SET status = 'rejected'
    WHERE task_id = NEW.task_id AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
