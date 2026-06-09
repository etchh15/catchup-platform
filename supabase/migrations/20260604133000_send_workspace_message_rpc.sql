-- Send workspace chat through a database resolver so legacy numeric route/task
-- identifiers never get inserted into UUID-typed workspace_messages.room_id.

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
  v_room public.workspace_rooms%ROWTYPE;
  v_message public.workspace_messages;
  v_room_id_type text;
  v_task_id_type text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_message_text IS NULL OR length(trim(p_message_text)) = 0 THEN
    RAISE EXCEPTION 'Message text is required';
  END IF;

  SELECT data_type
    INTO v_room_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'workspace_rooms'
    AND column_name = 'id';

  SELECT data_type
    INTO v_task_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'workspace_rooms'
    AND column_name = 'task_id';

  IF p_room_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    EXECUTE 'SELECT * FROM public.workspace_rooms WHERE id = $1 AND (client_id = $2 OR specialist_id = $2) LIMIT 1'
      INTO v_room
      USING p_room_identifier::uuid, v_actor;
  END IF;

  IF v_room.id IS NULL AND p_task_identifier IS NOT NULL THEN
    IF v_task_id_type = 'uuid'
      AND p_task_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN
      EXECUTE 'SELECT * FROM public.workspace_rooms WHERE task_id = $1 AND (client_id = $2 OR specialist_id = $2) LIMIT 1'
        INTO v_room
        USING p_task_identifier::uuid, v_actor;
    ELSIF v_task_id_type IN ('bigint', 'integer', 'smallint')
      AND p_task_identifier ~ '^[0-9]+$'
    THEN
      EXECUTE 'SELECT * FROM public.workspace_rooms WHERE task_id = $1 AND (client_id = $2 OR specialist_id = $2) LIMIT 1'
        INTO v_room
        USING p_task_identifier::bigint, v_actor;
    ELSE
      EXECUTE 'SELECT * FROM public.workspace_rooms WHERE task_id::text = $1 AND (client_id = $2 OR specialist_id = $2) LIMIT 1'
        INTO v_room
        USING p_task_identifier, v_actor;
    END IF;
  END IF;

  IF v_room.id IS NULL
    AND p_room_identifier IS NOT NULL
    AND v_room_id_type IN ('bigint', 'integer', 'smallint')
    AND p_room_identifier ~ '^[0-9]+$'
  THEN
    EXECUTE 'SELECT * FROM public.workspace_rooms WHERE id = $1 AND (client_id = $2 OR specialist_id = $2) LIMIT 1'
      INTO v_room
      USING p_room_identifier::bigint, v_actor;
  END IF;

  IF v_room.id IS NULL THEN
    RAISE EXCEPTION 'Workspace room not found for this user';
  END IF;

  INSERT INTO public.workspace_messages (
    room_id,
    sender_id,
    message_text
  )
  VALUES (
    v_room.id,
    v_actor,
    trim(p_message_text)
  )
  RETURNING * INTO v_message;

  RETURN v_message;
END;
$$;

REVOKE ALL ON FUNCTION public.send_workspace_message(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_workspace_message(text, text, text) TO authenticated;
