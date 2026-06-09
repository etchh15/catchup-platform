-- Completed workspaces are closed records. Participants can still read history,
-- receipts, and reviews, but cannot add new chat messages after closeout.

CREATE OR REPLACE FUNCTION public.send_workspace_message(
  p_room_identifier text,
  p_task_identifier text,
  p_message_text text
)
RETURNS public.workspace_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_room record;
  v_chat_room_id uuid;
  v_message public.workspace_messages;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_message_text IS NULL OR length(trim(p_message_text)) = 0 THEN
    RAISE EXCEPTION 'Message text is required';
  END IF;

  IF p_room_identifier IS NOT NULL THEN
    SELECT *
    INTO v_room
    FROM public.workspace_rooms
    WHERE id::text = p_room_identifier
      AND (client_id = v_actor OR specialist_id = v_actor)
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND AND p_task_identifier IS NOT NULL THEN
    SELECT *
    INTO v_room
    FROM public.workspace_rooms
    WHERE task_id::text = p_task_identifier
      AND (client_id = v_actor OR specialist_id = v_actor)
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace room not found for this user';
  END IF;

  IF COALESCE(v_room.status, 'pending') <> 'active' THEN
    RAISE EXCEPTION 'This workspace is closed. Messaging is only available while work is active.';
  END IF;

  v_chat_room_id := public.resolve_workspace_chat_room_id(v_room.id::text, v_room.task_id::text);

  INSERT INTO public.workspace_messages (room_id, sender_id, message_text)
  VALUES (v_chat_room_id, v_actor, trim(p_message_text))
  RETURNING * INTO v_message;

  RETURN v_message;
END;
$$;

REVOKE ALL ON FUNCTION public.send_workspace_message(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_workspace_message(text, text, text) TO authenticated;
