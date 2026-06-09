-- Chat privacy hardening.
--
-- Legacy task messages and active workspace messages must be visible only to
-- the client and the relevant specialist for that specific task/workspace.

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_messages ENABLE ROW LEVEL SECURITY;

-- Remove permissive legacy policies that made task chat public.
DROP POLICY IF EXISTS "Public read messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can read messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can send messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated insert task messages" ON public.messages;
DROP POLICY IF EXISTS "Task participants can read messages" ON public.messages;
DROP POLICY IF EXISTS "Task participants can insert messages" ON public.messages;

CREATE POLICY "Task participants can read messages" ON public.messages
  FOR SELECT
  USING (
    sender_id::text = auth.uid()::text
    OR receiver_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id::text = messages.task_id::text
        AND (
          t.user_id::text = auth.uid()::text
          OR t.specialist_id::text = auth.uid()::text
        )
    )
  );

CREATE POLICY "Task participants can insert messages" ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id::text = auth.uid()::text
    AND receiver_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id::text = messages.task_id::text
        AND (
          -- Task owner can message the assigned specialist or a bidding specialist.
          (
            t.user_id::text = auth.uid()::text
            AND (
              receiver_id::text = t.specialist_id::text
              OR EXISTS (
                SELECT 1
                FROM public.bids b
                WHERE b.task_id::text = messages.task_id::text
                  AND b.specialist_id::text = messages.receiver_id::text
              )
            )
          )
          OR
          -- Assigned specialist can message the task owner.
          (
            t.specialist_id::text = auth.uid()::text
            AND receiver_id::text = t.user_id::text
          )
          OR
          -- Bidding specialist can message only the task owner.
          (
            receiver_id::text = t.user_id::text
            AND EXISTS (
              SELECT 1
              FROM public.bids b
              WHERE b.task_id::text = messages.task_id::text
                AND b.specialist_id::text = auth.uid()::text
            )
          )
        )
    )
  );

-- Re-assert workspace chat privacy, including mapped UUID channels used for
-- legacy numeric workspace ids.
DROP POLICY IF EXISTS "Workspace message participants can read" ON public.workspace_messages;
DROP POLICY IF EXISTS "Workspace participants can insert messages" ON public.workspace_messages;

CREATE POLICY "Workspace message participants can read" ON public.workspace_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_rooms wr
      WHERE wr.id::text = workspace_messages.room_id::text
        AND (
          wr.client_id::text = auth.uid()::text
          OR wr.specialist_id::text = auth.uid()::text
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.workspace_chat_room_map m
      WHERE m.id = workspace_messages.room_id
        AND (
          m.client_id::text = auth.uid()::text
          OR m.specialist_id::text = auth.uid()::text
        )
    )
  );

CREATE POLICY "Workspace participants can insert messages" ON public.workspace_messages
  FOR INSERT
  WITH CHECK (
    sender_id::text = auth.uid()::text
    AND (
      EXISTS (
        SELECT 1
        FROM public.workspace_rooms wr
        WHERE wr.id::text = workspace_messages.room_id::text
          AND (
            wr.client_id::text = auth.uid()::text
            OR wr.specialist_id::text = auth.uid()::text
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.workspace_chat_room_map m
        WHERE m.id = workspace_messages.room_id
          AND (
            m.client_id::text = auth.uid()::text
            OR m.specialist_id::text = auth.uid()::text
          )
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_messages_task_sender_receiver
  ON public.messages (task_id, sender_id, receiver_id, created_at);
