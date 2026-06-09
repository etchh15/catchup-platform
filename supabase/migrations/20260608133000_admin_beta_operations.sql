-- Admin beta operations: platform pause setting, actionable verification queue, and safer admin reads.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.platform_settings (key, value)
VALUES (
  'onboarding',
  jsonb_build_object(
    'paused', false,
    'reason', '',
    'updated_at', now()
  )
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read platform settings" ON public.platform_settings;
CREATE POLICY "Public read platform settings" ON public.platform_settings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage platform settings" ON public.platform_settings;
CREATE POLICY "Admins manage platform settings" ON public.platform_settings
  FOR ALL
  USING (public.current_user_is_platform_admin())
  WITH CHECK (public.current_user_is_platform_admin());

DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT
  USING (public.current_user_is_platform_admin());

DROP POLICY IF EXISTS "Admins update verification fields" ON public.profiles;
CREATE POLICY "Admins update verification fields" ON public.profiles
  FOR UPDATE
  USING (public.current_user_is_platform_admin())
  WITH CHECK (public.current_user_is_platform_admin());

DROP POLICY IF EXISTS "Admins update waitlist signups" ON public.waitlist_signups;
CREATE POLICY "Admins update waitlist signups" ON public.waitlist_signups
  FOR UPDATE
  USING (public.current_user_is_platform_admin())
  WITH CHECK (public.current_user_is_platform_admin());
