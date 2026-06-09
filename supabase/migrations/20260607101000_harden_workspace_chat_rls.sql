-- Allow workspace chat realtime reads for both direct workspace room ids and
-- mapped chat room ids used by legacy/numeric workspace identifiers.

CREATE INDEX IF NOT EXISTS idx_workspace_messages_room_created
  ON public.workspace_messages (room_id, created_at);

CREATE INDEX IF NOT EXISTS idx_workspace_chat_room_map_id_participants
  ON public.workspace_chat_room_map (id, client_id, specialist_id);

CREATE INDEX IF NOT EXISTS idx_workspace_chat_room_map_identifiers
  ON public.workspace_chat_room_map (workspace_room_identifier, task_identifier);

DROP POLICY IF EXISTS "Workspace message participants can read" ON public.workspace_messages;
CREATE POLICY "Workspace message participants can read" ON public.workspace_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_rooms
      WHERE workspace_rooms.id::text = workspace_messages.room_id::text
        AND (
          workspace_rooms.client_id::text = auth.uid()::text
          OR workspace_rooms.specialist_id::text = auth.uid()::text
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.workspace_chat_room_map
      WHERE workspace_chat_room_map.id = workspace_messages.room_id
        AND (
          workspace_chat_room_map.client_id::text = auth.uid()::text
          OR workspace_chat_room_map.specialist_id::text = auth.uid()::text
        )
    )
  );

DROP POLICY IF EXISTS "Workspace participants can insert messages" ON public.workspace_messages;
CREATE POLICY "Workspace participants can insert messages" ON public.workspace_messages
  FOR INSERT
  WITH CHECK (
    sender_id::text = auth.uid()::text
    AND (
      EXISTS (
        SELECT 1
        FROM public.workspace_rooms
        WHERE workspace_rooms.id::text = workspace_messages.room_id::text
          AND (
            workspace_rooms.client_id::text = auth.uid()::text
            OR workspace_rooms.specialist_id::text = auth.uid()::text
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.workspace_chat_room_map
        WHERE workspace_chat_room_map.id = workspace_messages.room_id
          AND (
            workspace_chat_room_map.client_id::text = auth.uid()::text
            OR workspace_chat_room_map.specialist_id::text = auth.uid()::text
          )
      )
    )
  );
