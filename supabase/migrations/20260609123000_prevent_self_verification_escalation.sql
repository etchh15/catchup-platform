-- Prevent users from self-escalating specialist verification.
-- Users may request review, but only platform admins/service role may approve or reject.

CREATE OR REPLACE FUNCTION public.prevent_self_verification_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.current_user_is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'Verification flags can only be changed by platform admins.';
  END IF;

  IF NEW.verification_reviewed_at IS DISTINCT FROM OLD.verification_reviewed_at THEN
    RAISE EXCEPTION 'Verification review timestamps can only be changed by platform admins.';
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NEW.verification_status <> 'pending_verification' THEN
      RAISE EXCEPTION 'Only platform admins can approve or reject verification.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_verification_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_self_verification_escalation_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_verification_escalation();
