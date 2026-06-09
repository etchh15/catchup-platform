-- Lock CatchUp platform admin access to one approved email.

CREATE OR REPLACE FUNCTION public.enforce_single_platform_admin_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email text;
BEGIN
  SELECT lower(email)
  INTO admin_email
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF admin_email IS DISTINCT FROM 'etchh0@gmail.com' THEN
    RAISE EXCEPTION 'Only etchh0@gmail.com can be granted platform admin access.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_platform_admin_email_trigger ON public.app_admins;
CREATE TRIGGER enforce_single_platform_admin_email_trigger
  BEFORE INSERT OR UPDATE ON public.app_admins
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_platform_admin_email();

DELETE FROM public.app_admins
WHERE user_id NOT IN (
  SELECT id FROM public.profiles WHERE lower(email) = 'etchh0@gmail.com'
);

INSERT INTO public.app_admins (user_id)
SELECT id
FROM public.profiles
WHERE lower(email) = 'etchh0@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
