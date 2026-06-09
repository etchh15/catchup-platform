-- Harden role ownership, public marketplace reads, and admin-only operations.
-- Normal users may choose client/specialist. Platform admins are granted through
-- public.app_admins by a service-role migration or dashboard operation.

CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages app admins" ON public.app_admins;
CREATE POLICY "Service role manages app admins" ON public.app_admins
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.current_user_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_admins
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_platform_admin() TO authenticated;

DROP POLICY IF EXISTS "Authenticated update own profile" ON public.profiles;
CREATE POLICY "Authenticated update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role IN ('client', 'specialist')
  );

DROP POLICY IF EXISTS "Public read registered specialists" ON public.profiles;
CREATE POLICY "Public read registered specialists" ON public.profiles
  FOR SELECT
  USING (role = 'specialist');

DROP POLICY IF EXISTS "Public read bids" ON public.bids;
DROP POLICY IF EXISTS "Task owners and bidding specialists read bids" ON public.bids;
CREATE POLICY "Task owners and bidding specialists read bids" ON public.bids
  FOR SELECT
  USING (
    specialist_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id::text = bids.task_id::text
        AND tasks.user_id::text = auth.uid()::text
    )
    OR public.current_user_is_platform_admin()
  );

DROP POLICY IF EXISTS "Disputes readable by participants" ON public.disputes;
CREATE POLICY "Disputes readable by participants" ON public.disputes
  FOR SELECT
  USING (
    filed_by::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id::text = disputes.task_id::text
        AND (
          tasks.user_id::text = auth.uid()::text
          OR tasks.specialist_id::text = auth.uid()::text
        )
    )
    OR public.current_user_is_platform_admin()
  );

DROP POLICY IF EXISTS "Disputes insertable by service role" ON public.disputes;
CREATE POLICY "Disputes insertable by service role" ON public.disputes
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Disputes updateable by service role" ON public.disputes;
CREATE POLICY "Disputes updateable by service role" ON public.disputes
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Disputes updateable by admin" ON public.disputes;
CREATE POLICY "Disputes updateable by admin" ON public.disputes
  FOR UPDATE
  USING (public.current_user_is_platform_admin())
  WITH CHECK (public.current_user_is_platform_admin());

DROP POLICY IF EXISTS "Dispute responses readable by participants" ON public.dispute_responses;
CREATE POLICY "Dispute responses readable by participants" ON public.dispute_responses
  FOR SELECT
  USING (
    responder_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.disputes
      WHERE disputes.id = dispute_responses.dispute_id
        AND disputes.filed_by::text = auth.uid()::text
    )
    OR public.current_user_is_platform_admin()
  );

DROP POLICY IF EXISTS "Dispute responses insertable by service role" ON public.dispute_responses;
CREATE POLICY "Dispute responses insertable by service role" ON public.dispute_responses
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Dispute resolutions readable by service role" ON public.dispute_resolutions;
DROP POLICY IF EXISTS "Dispute resolutions readable by admins" ON public.dispute_resolutions;
CREATE POLICY "Dispute resolutions readable by admins" ON public.dispute_resolutions
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR public.current_user_is_platform_admin()
  );

DROP POLICY IF EXISTS "Dispute resolutions insertable by admin" ON public.dispute_resolutions;
CREATE POLICY "Dispute resolutions insertable by admin" ON public.dispute_resolutions
  FOR INSERT
  WITH CHECK (public.current_user_is_platform_admin());

DROP POLICY IF EXISTS "Agreements insertable by service role" ON public.agreements;
CREATE POLICY "Agreements insertable by service role" ON public.agreements
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Milestones insertable by service role" ON public.agreement_milestones;
CREATE POLICY "Milestones insertable by service role" ON public.agreement_milestones
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Milestones updateable by service role" ON public.agreement_milestones;
CREATE POLICY "Milestones updateable by service role" ON public.agreement_milestones
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
