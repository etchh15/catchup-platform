-- Tighten Help Desk lifecycle:
-- - User support messages notify the single platform admin in-app.
-- - Admin replies notify the requesting user in-app.
-- - Resolved help cases are closed to further messages until reopened.

DROP POLICY IF EXISTS "Participants create help messages" ON public.help_case_messages;
CREATE POLICY "Participants create help messages"
  ON public.help_case_messages
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = sender_id::text
    AND EXISTS (
      SELECT 1
      FROM public.help_cases hc
      WHERE hc.id = help_case_messages.case_id
        AND hc.status <> 'resolved'
        AND (
          hc.user_id::text = auth.uid()::text
          OR public.current_user_is_platform_admin()
        )
    )
  );

CREATE OR REPLACE FUNCTION public.touch_help_case_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_case public.help_cases;
  v_admin_id uuid;
  v_subject text;
BEGIN
  SELECT *
  INTO v_case
  FROM public.help_cases
  WHERE id = NEW.case_id;

  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Help case not found.';
  END IF;

  IF v_case.status = 'resolved' THEN
    RAISE EXCEPTION 'This help case is done. Reopen it before sending more messages.';
  END IF;

  v_is_admin := public.current_user_is_platform_admin();
  v_subject := COALESCE(v_case.subject, 'Support case');

  UPDATE public.help_cases
  SET
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at,
    status = CASE
      WHEN v_is_admin THEN 'waiting_on_user'
      ELSE 'open'
    END,
    resolved_at = null
  WHERE id = NEW.case_id;

  IF NOT v_is_admin THEN
    SELECT id
    INTO v_admin_id
    FROM public.profiles
    WHERE lower(email) = 'etchh0@gmail.com'
      AND role = 'admin'
    LIMIT 1;

    INSERT INTO public.admin_alerts (
      event_type,
      severity,
      subject,
      body,
      payload,
      recipient_email
    )
    VALUES (
      'help_case_message',
      CASE WHEN v_case.priority IN ('urgent', 'high') OR v_case.category = 'safety' THEN 'high' ELSE 'medium' END,
      LEFT('CatchUp help desk: ' || v_subject, 180),
      LEFT(NEW.body, 4000),
      jsonb_build_object('case_id', NEW.case_id, 'user_id', NEW.sender_id, 'category', v_case.category, 'priority', v_case.priority),
      'etchh0@gmail.com'
    );

    IF v_admin_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_id,
        sender_id,
        type,
        related_id,
        title,
        message,
        action_url
      )
      VALUES (
        v_admin_id,
        NEW.sender_id,
        'message_received',
        NEW.case_id,
        'New help desk case',
        LEFT(v_subject || ': ' || NEW.body, 280),
        '/help'
      );
    END IF;
  ELSE
    INSERT INTO public.notifications (
      recipient_id,
      sender_id,
      type,
      related_id,
      title,
      message,
      action_url
    )
    VALUES (
      v_case.user_id,
      NEW.sender_id,
      'message_received',
      NEW.case_id,
      'CatchUp admin replied',
      LEFT(v_subject || ': ' || NEW.body, 280),
      '/help'
    );
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
