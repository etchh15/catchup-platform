-- Keep existing lowercase app roles working while allowing the canonical
-- marketplace role vocabulary requested by the appointment platform blueprint.

DROP POLICY IF EXISTS "Public read registered specialists" ON public.profiles;
CREATE POLICY "Public read registered specialists" ON public.profiles
  FOR SELECT
  USING (role IN ('specialist', 'SPECIALIST'));

DROP POLICY IF EXISTS "Authenticated update own profile" ON public.profiles;
CREATE POLICY "Authenticated update own profile" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid()::uuid)
  WITH CHECK (
    id = auth.uid()::uuid
    AND role IN ('client', 'specialist', 'USER', 'SPECIALIST')
  );
