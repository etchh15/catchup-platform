-- Keep workspace chat compatible with production schemas where tasks and
-- workspace_rooms may use numeric ids while workspace_messages.room_id is UUID.

CREATE TABLE IF NOT EXISTS public.workspace_chat_room_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_room_identifier text,
  task_identifier text,
  client_id uuid NOT NULL,
  specialist_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_room_identifier, task_identifier, client_id, specialist_id)
);

ALTER TABLE public.workspace_chat_room_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace chat map readable by participants" ON public.workspace_chat_room_map;
CREATE POLICY "Workspace chat map readable by participants"
  ON public.workspace_chat_room_map
  FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = specialist_id);

CREATE OR REPLACE FUNCTION public.resolve_workspace_chat_room_id(
  p_room_identifier text,
  p_task_identifier text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_room record;
  v_room_id_type text;
  v_chat_room_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT data_type INTO v_room_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'workspace_rooms'
    AND column_name = 'id';

  IF v_room_id_type = 'uuid'
    AND p_room_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    SELECT id::text AS room_identifier, task_id::text AS task_identifier, client_id, specialist_id
    INTO v_room
    FROM public.workspace_rooms
    WHERE id = p_room_identifier::uuid
      AND (client_id = v_actor OR specialist_id = v_actor)
    LIMIT 1;

    IF FOUND THEN
      RETURN p_room_identifier::uuid;
    END IF;
  END IF;

  IF p_room_identifier IS NOT NULL THEN
    SELECT id::text AS room_identifier, task_id::text AS task_identifier, client_id, specialist_id
    INTO v_room
    FROM public.workspace_rooms
    WHERE id::text = p_room_identifier
      AND (client_id = v_actor OR specialist_id = v_actor)
    LIMIT 1;
  END IF;

  IF NOT FOUND AND p_task_identifier IS NOT NULL THEN
    SELECT id::text AS room_identifier, task_id::text AS task_identifier, client_id, specialist_id
    INTO v_room
    FROM public.workspace_rooms
    WHERE task_id::text = p_task_identifier
      AND (client_id = v_actor OR specialist_id = v_actor)
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace room not found for this user';
  END IF;

  INSERT INTO public.workspace_chat_room_map (
    workspace_room_identifier,
    task_identifier,
    client_id,
    specialist_id
  )
  VALUES (
    v_room.room_identifier,
    v_room.task_identifier,
    v_room.client_id,
    v_room.specialist_id
  )
  ON CONFLICT (workspace_room_identifier, task_identifier, client_id, specialist_id)
  DO UPDATE SET workspace_room_identifier = EXCLUDED.workspace_room_identifier
  RETURNING id INTO v_chat_room_id;

  RETURN v_chat_room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_workspace_chat_messages(
  p_room_identifier text,
  p_task_identifier text
)
RETURNS SETOF public.workspace_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_room_id uuid;
BEGIN
  v_chat_room_id := public.resolve_workspace_chat_room_id(p_room_identifier, p_task_identifier);

  RETURN QUERY
  SELECT *
  FROM public.workspace_messages
  WHERE room_id = v_chat_room_id
  ORDER BY created_at ASC;
END;
$$;

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
  v_chat_room_id uuid;
  v_message public.workspace_messages;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_message_text IS NULL OR length(trim(p_message_text)) = 0 THEN
    RAISE EXCEPTION 'Message text is required';
  END IF;

  v_chat_room_id := public.resolve_workspace_chat_room_id(p_room_identifier, p_task_identifier);

  INSERT INTO public.workspace_messages (room_id, sender_id, message_text)
  VALUES (v_chat_room_id, v_actor, trim(p_message_text))
  RETURNING * INTO v_message;

  RETURN v_message;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_workspace_chat_room_id(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fetch_workspace_chat_messages(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_workspace_message(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.resolve_workspace_chat_room_id(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_workspace_chat_messages(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_workspace_message(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_on_workspace_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_recipient uuid;
  v_task_identifier text;
  v_notification_task_type text;
  v_exists int;
BEGIN
  SELECT id::text AS room_identifier, task_id::text AS task_identifier, client_id, specialist_id
  INTO v_room
  FROM public.workspace_rooms
  WHERE id::text = NEW.room_id::text
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT workspace_room_identifier AS room_identifier, task_identifier, client_id, specialist_id
    INTO v_room
    FROM public.workspace_chat_room_map
    WHERE id = NEW.room_id
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_room.client_id = NEW.sender_id THEN
    v_recipient := v_room.specialist_id;
  ELSE
    v_recipient := v_room.client_id;
  END IF;

  v_task_identifier := v_room.task_identifier;

  SELECT data_type INTO v_notification_task_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'notifications'
    AND column_name = 'task_id';

  SELECT 1 INTO v_exists
  FROM public.notifications
  WHERE recipient_id = v_recipient
    AND sender_id = NEW.sender_id
    AND type = 'message_received'
    AND action_url = CONCAT('/workspace/', COALESCE(v_room.room_identifier, NEW.room_id::text))
    AND created_at > now() - INTERVAL '2 minutes'
  LIMIT 1;

  IF v_recipient IS NOT NULL AND v_exists IS NULL THEN
    IF v_notification_task_type = 'uuid'
      AND v_task_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN
      INSERT INTO public.notifications (recipient_id, sender_id, type, task_id, title, message, action_url, created_at)
      VALUES (
        v_recipient,
        NEW.sender_id,
        'message_received',
        v_task_identifier::uuid,
        'New message in workspace',
        LEFT(NEW.message_text, 300),
        CONCAT('/workspace/', COALESCE(v_room.room_identifier, NEW.room_id::text)),
        now()
      );
    ELSIF v_notification_task_type IN ('bigint', 'integer', 'smallint')
      AND v_task_identifier ~ '^[0-9]+$'
    THEN
      INSERT INTO public.notifications (recipient_id, sender_id, type, task_id, title, message, action_url, created_at)
      VALUES (
        v_recipient,
        NEW.sender_id,
        'message_received',
        v_task_identifier::bigint,
        'New message in workspace',
        LEFT(NEW.message_text, 300),
        CONCAT('/workspace/', COALESCE(v_room.room_identifier, NEW.room_id::text)),
        now()
      );
    ELSE
      INSERT INTO public.notifications (recipient_id, sender_id, type, title, message, action_url, created_at)
      VALUES (
        v_recipient,
        NEW.sender_id,
        'message_received',
        'New message in workspace',
        LEFT(NEW.message_text, 300),
        CONCAT('/workspace/', COALESCE(v_room.room_identifier, NEW.room_id::text)),
        now()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
