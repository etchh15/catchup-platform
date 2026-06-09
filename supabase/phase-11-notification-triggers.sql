-- ==========================================================================
-- PHASE 11: Notification Triggers (idempotent)
-- Adds DB-side triggers to ensure in-app notifications are created for
-- bids and workspace messages regardless of which application path created
-- the rows. Safe to run multiple times.
-- ==========================================================================

-- Trigger: on bids.insert -> notify task owner (bid_received)
CREATE OR REPLACE FUNCTION notify_on_bid_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_owner uuid;
  v_task_title text;
BEGIN
  -- Find task owner
  SELECT user_id, title INTO v_task_owner, v_task_title FROM tasks WHERE id = NEW.task_id;
  IF v_task_owner IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert notification (service role allowed by RLS)
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

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_on_bid_insert') THEN
    CREATE TRIGGER trg_notify_on_bid_insert
    AFTER INSERT ON bids
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_bid_insert();
  END IF;
END$$;


-- Trigger: on workspace_messages.insert -> notify other participant (message_received)
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

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_on_workspace_message_insert') THEN
    CREATE TRIGGER trg_notify_on_workspace_message_insert
    AFTER INSERT ON workspace_messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_workspace_message_insert();
  END IF;
END$$;

-- No-op: ensure function signatures exist for idempotency
-- End of migration
