-- Help Desk private support cases.
-- Airbnb-style pattern for CatchUp beta: user opens a private case, admin replies and resolves.

CREATE TABLE IF NOT EXISTS public.help_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_role text NOT NULL DEFAULT 'client',
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  subject text NOT NULL,
  related_task_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT help_cases_requester_role_check
    CHECK (requester_role IN ('client', 'specialist', 'admin')),
  CONSTRAINT help_cases_category_check
    CHECK (category IN ('general', 'account', 'verification', 'job', 'payment', 'dispute', 'safety')),
  CONSTRAINT help_cases_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT help_cases_status_check
    CHECK (status IN ('open', 'waiting_on_user', 'resolved')),
  CONSTRAINT help_cases_subject_length_check
    CHECK (char_length(trim(subject)) BETWEEN 4 AND 180)
);

CREATE TABLE IF NOT EXISTS public.help_case_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.help_cases(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role text NOT NULL DEFAULT 'client',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT help_case_messages_sender_role_check
    CHECK (sender_role IN ('client', 'specialist', 'admin')),
  CONSTRAINT help_case_messages_body_length_check
    CHECK (char_length(trim(body)) BETWEEN 2 AND 4000)
);

CREATE INDEX IF NOT EXISTS idx_help_cases_user_status_last
  ON public.help_cases(user_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_help_cases_status_last
  ON public.help_cases(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_help_case_messages_case_created
  ON public.help_case_messages(case_id, created_at ASC);

ALTER TABLE public.help_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_case_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and admins read help cases" ON public.help_cases;
CREATE POLICY "Users and admins read help cases"
  ON public.help_cases
  FOR SELECT
  USING (
    auth.uid()::text = user_id::text
    OR public.current_user_is_platform_admin()
  );

DROP POLICY IF EXISTS "Users create own help cases" ON public.help_cases;
CREATE POLICY "Users create own help cases"
  ON public.help_cases
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id::text
    AND requester_role IN ('client', 'specialist')
  );

DROP POLICY IF EXISTS "Admins update help cases" ON public.help_cases;
CREATE POLICY "Admins update help cases"
  ON public.help_cases
  FOR UPDATE
  USING (public.current_user_is_platform_admin())
  WITH CHECK (public.current_user_is_platform_admin());

DROP POLICY IF EXISTS "Users and admins read help messages" ON public.help_case_messages;
CREATE POLICY "Users and admins read help messages"
  ON public.help_case_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.help_cases hc
      WHERE hc.id = help_case_messages.case_id
        AND (
          hc.user_id::text = auth.uid()::text
          OR public.current_user_is_platform_admin()
        )
    )
  );

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
BEGIN
  SELECT *
  INTO v_case
  FROM public.help_cases
  WHERE id = NEW.case_id;

  v_is_admin := public.current_user_is_platform_admin();

  UPDATE public.help_cases
  SET
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at,
    status = CASE
      WHEN status = 'resolved' THEN 'open'
      WHEN v_is_admin THEN 'waiting_on_user'
      ELSE 'open'
    END,
    resolved_at = CASE WHEN status = 'resolved' THEN null ELSE resolved_at END
  WHERE id = NEW.case_id;

  IF NOT v_is_admin THEN
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
      LEFT('CatchUp help desk: ' || COALESCE(v_case.subject, 'New support message'), 180),
      LEFT(NEW.body, 4000),
      jsonb_build_object('case_id', NEW.case_id, 'user_id', NEW.sender_id, 'category', v_case.category, 'priority', v_case.priority),
      'etchh0@gmail.com'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_help_case_from_message_trigger ON public.help_case_messages;
CREATE TRIGGER touch_help_case_from_message_trigger
  AFTER INSERT ON public.help_case_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_help_case_from_message();

CREATE OR REPLACE FUNCTION public.resolve_help_case(
  p_case_id uuid,
  p_status text
)
RETURNS public.help_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.help_cases;
BEGIN
  IF NOT public.current_user_is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform admin can update help case status.';
  END IF;

  IF p_status NOT IN ('open', 'waiting_on_user', 'resolved') THEN
    RAISE EXCEPTION 'Unsupported help case status.';
  END IF;

  UPDATE public.help_cases
  SET
    status = p_status,
    resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE null END,
    updated_at = now()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Help case not found.';
  END IF;

  RETURN v_case;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_help_case(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_help_case(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
