-- Automatic blocking must live in the database, not only the browser.
-- This migration blocks unverified proposals and paused onboarding server-side.

CREATE OR REPLACE FUNCTION public.onboarding_is_paused()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((value ->> 'paused')::boolean, false)
  FROM public.platform_settings
  WHERE key = 'onboarding'
$$;

CREATE OR REPLACE FUNCTION public.onboarding_pause_reason()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(value ->> 'reason', ''), 'Beta onboarding is paused right now.')
  FROM public.platform_settings
  WHERE key = 'onboarding'
$$;

CREATE OR REPLACE FUNCTION public.enforce_waitlist_onboarding_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.onboarding_is_paused() THEN
    RAISE EXCEPTION '%', public.onboarding_pause_reason()
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_waitlist_onboarding_open_trigger ON public.waitlist_signups;
CREATE TRIGGER enforce_waitlist_onboarding_open_trigger
  BEFORE INSERT ON public.waitlist_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_waitlist_onboarding_open();

CREATE OR REPLACE FUNCTION public.enforce_profile_onboarding_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF public.onboarding_is_paused() THEN
    RAISE EXCEPTION '%', public.onboarding_pause_reason()
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_onboarding_open_trigger ON public.profiles;
CREATE TRIGGER enforce_profile_onboarding_open_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_onboarding_open();

CREATE OR REPLACE FUNCTION public.enforce_bid_creation_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verified boolean;
BEGIN
  IF public.onboarding_is_paused() THEN
    RAISE EXCEPTION '%', public.onboarding_pause_reason()
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(is_verified, false) OR verification_status = 'verified'
  INTO v_verified
  FROM public.profiles
  WHERE id::text = NEW.specialist_id::text
    AND role IN ('specialist', 'SPECIALIST');

  IF COALESCE(v_verified, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Specialist accounts must be manually verified before sending beta proposals.'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.enforce_actor_insert_rate_limit(NEW.specialist_id::text, 'public.bids', 'specialist_id', 'proposal_rate_limit', interval '1 hour', 12, 'Too many proposals. Please wait before bidding again.');
  PERFORM public.enforce_actor_insert_rate_limit(NEW.specialist_id::text, 'public.bids', 'specialist_id', 'proposal_daily_limit', interval '1 day', 40, 'Daily proposal limit reached for beta safety.');
  RETURN NEW;
END;
$$;
