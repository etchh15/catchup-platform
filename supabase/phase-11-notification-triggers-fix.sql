-- ==========================================================================
-- PHASE 11 (fix): Prevent duplicate notifications by checking recent similar
-- Exists (2 minute window). Replaces previous notify functions with safe guards.
-- ==========================================================================

CREATE OR REPLACE FUNCTION notify_on_bid_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_owner uuid;
  v_task_title text;
  v_exists int;
BEGIN
  SELECT user_id, title INTO v_task_owner, v_task_title FROM tasks WHERE id = NEW.task_id;
  IF v_task_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT 1 INTO v_exists FROM notifications
    WHERE recipient_id = v_task_owner
      AND sender_id = NEW.specialist_id
      AND type = 'bid_received'
      AND task_id = NEW.task_id
      AND created_at > now() - INTERVAL '2 minutes'
    LIMIT 1;

  IF v_exists IS NULL THEN
    INSERT INTO notifications (recipient_id, sender_id, type, task_id, title, message, action_url, created_at)
    VALUES (
      v_task_owner,
      NEW.specialist_id,
      'bid_received',
      NEW.task_id,
      CONCAT('New proposal for ', COALESCE(v_task_title, 'your task')),
      CONCAT('You have a new proposal on "', COALESCE(v_task_title, 'your task'), '"'),
      CONCAT('/workspace/', NEW.task_id::text),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_on_workspace_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room workspace_rooms%ROWTYPE;
  v_recipient uuid;
  v_task_id uuid;
  v_exists int;
BEGIN
  SELECT * INTO v_room FROM workspace_rooms WHERE id = NEW.room_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_room.client_id = NEW.sender_id THEN
    v_recipient := v_room.specialist_id;
  ELSE
    v_recipient := v_room.client_id;
  END IF;

  v_task_id := v_room.task_id;

  IF v_recipient IS NOT NULL THEN
    SELECT 1 INTO v_exists FROM notifications
      WHERE recipient_id = v_recipient
        AND sender_id = NEW.sender_id
        AND type = 'message_received'
        AND (task_id = v_task_id OR action_url = CONCAT('/workspace/', NEW.room_id::text))
        AND created_at > now() - INTERVAL '2 minutes'
      LIMIT 1;

    IF v_exists IS NULL THEN
      INSERT INTO notifications (recipient_id, sender_id, type, task_id, title, message, action_url, created_at)
      VALUES (
        v_recipient,
        NEW.sender_id,
        'message_received',
        v_task_id,
        'New message in workspace',
        LEFT(NEW.message_text, 300),
        CONCAT('/workspace/', NEW.room_id::text),
        now()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- No need to re-create triggers; functions are replaced in-place.
