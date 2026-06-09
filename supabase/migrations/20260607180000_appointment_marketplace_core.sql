-- Appointment-driven marketplace core for CatchUp:
-- profile offerings, precise appointment windows, atomic reservations,
-- payment webhook idempotency, and conditional online/in-person activation.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fulfillment_types text[] NOT NULL DEFAULT ARRAY['IN_PERSON']::text[],
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS online_hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS in_person_hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS service_radius_km numeric DEFAULT 25;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_marketplace_check,
  ADD CONSTRAINT profiles_role_marketplace_check
    CHECK (role IN ('client', 'specialist', 'admin', 'USER', 'SPECIALIST', 'ADMIN'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_fulfillment_types_check,
  ADD CONSTRAINT profiles_fulfillment_types_check
    CHECK (
      fulfillment_types IS NULL
      OR fulfillment_types <@ ARRAY['IN_PERSON', 'ONLINE']::text[]
    );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_geo_bounds_check,
  ADD CONSTRAINT profiles_geo_bounds_check
    CHECK (
      (latitude IS NULL OR latitude BETWEEN -90 AND 90)
      AND (longitude IS NULL OR longitude BETWEEN -180 AND 180)
      AND (service_radius_km IS NULL OR service_radius_km BETWEEN 0 AND 500)
      AND (online_hourly_rate IS NULL OR online_hourly_rate >= 0)
      AND (in_person_hourly_rate IS NULL OR in_person_hourly_rate >= 0)
    );

UPDATE public.profiles
SET pricing = jsonb_strip_nulls(
      COALESCE(pricing, '{}'::jsonb)
      || jsonb_build_object(
        'online_hourly_rate', online_hourly_rate,
        'in_person_hourly_rate', COALESCE(
          in_person_hourly_rate,
          NULLIF(regexp_replace(hourly_rate::text, '[^0-9.]', '', 'g'), '')::numeric
        )
      )
    )
WHERE pricing IS NULL
   OR pricing = '{}'::jsonb
   OR online_hourly_rate IS NOT NULL
   OR in_person_hourly_rate IS NOT NULL
   OR hourly_rate IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.specialist_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  fulfillment_types text[] NOT NULL DEFAULT ARRAY['IN_PERSON', 'ONLINE']::text[],
  timezone text NOT NULL DEFAULT 'Africa/Cairo',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  CHECK (fulfillment_types <@ ARRAY['IN_PERSON', 'ONLINE']::text[])
);

CREATE INDEX IF NOT EXISTS idx_specialist_availability_specialist
  ON public.specialist_availability (specialist_id, day_of_week, is_active);

ALTER TABLE public.specialist_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Availability readable by authenticated users" ON public.specialist_availability;
CREATE POLICY "Availability readable by authenticated users" ON public.specialist_availability
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Specialists manage own availability" ON public.specialist_availability;
CREATE POLICY "Specialists manage own availability" ON public.specialist_availability
  FOR ALL
  USING (specialist_id = auth.uid())
  WITH CHECK (specialist_id = auth.uid());

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS specialist_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'IN_PERSON',
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS rate_snapshot numeric,
  ADD COLUMN IF NOT EXISTS price_total numeric,
  ADD COLUMN IF NOT EXISTS destination_latitude double precision,
  ADD COLUMN IF NOT EXISTS destination_longitude double precision,
  ADD COLUMN IF NOT EXISTS video_room_url text,
  ADD COLUMN IF NOT EXISTS payment_hold_status text NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS live_data jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

UPDATE public.appointments a
SET
  starts_at = COALESCE(a.starts_at, a.proposed_date),
  ends_at = COALESCE(a.ends_at, a.proposed_date + make_interval(mins => COALESCE(a.duration_minutes, 60))),
  specialist_id = COALESCE(a.specialist_id, NULLIF(t.specialist_id::text, '')::uuid),
  client_id = COALESCE(a.client_id, NULLIF(t.user_id::text, '')::uuid),
  status = CASE
    WHEN upper(a.status) IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED') THEN upper(a.status)
    WHEN a.status = 'rescheduled' THEN 'PENDING'
    ELSE 'PENDING'
  END,
  fulfillment_type = CASE
    WHEN upper(a.fulfillment_type) = 'ONLINE' THEN 'ONLINE'
    ELSE 'IN_PERSON'
  END
FROM public.tasks t
WHERE a.task_id = t.id;

ALTER TABLE public.appointments
  ALTER COLUMN starts_at SET NOT NULL,
  ALTER COLUMN ends_at SET NOT NULL,
  ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  DROP CONSTRAINT IF EXISTS appointments_window_check,
  ADD CONSTRAINT appointments_window_check
    CHECK (starts_at < ends_at AND duration_minutes > 0 AND duration_minutes <= 480),
  DROP CONSTRAINT IF EXISTS appointments_fulfillment_type_check,
  ADD CONSTRAINT appointments_fulfillment_type_check
    CHECK (fulfillment_type IN ('IN_PERSON', 'ONLINE')),
  DROP CONSTRAINT IF EXISTS appointments_payment_hold_status_check,
  ADD CONSTRAINT appointments_payment_hold_status_check
    CHECK (payment_hold_status IN ('NOT_REQUIRED', 'PENDING', 'HELD', 'FAILED', 'RELEASED')),
  DROP CONSTRAINT IF EXISTS appointments_geo_bounds_check,
  ADD CONSTRAINT appointments_geo_bounds_check
    CHECK (
      (destination_latitude IS NULL OR destination_latitude BETWEEN -90 AND 90)
      AND (destination_longitude IS NULL OR destination_longitude BETWEEN -180 AND 180)
    );

CREATE INDEX IF NOT EXISTS idx_appointments_specialist_window
  ON public.appointments (specialist_id, starts_at, ends_at)
  WHERE status IN ('PENDING', 'CONFIRMED');

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_overlapping_active_slots;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlapping_active_slots
  EXCLUDE USING gist (
    specialist_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status IN ('PENDING', 'CONFIRMED'));

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  event_id text PRIMARY KEY,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'manual',
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages payment webhook events" ON public.payment_webhook_events;
CREATE POLICY "Service role manages payment webhook events" ON public.payment_webhook_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.sync_profile_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id)
  DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    updated_at = now();

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;
    CREATE TRIGGER on_auth_user_profile_sync
    AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_from_auth_user();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371 * 2 * asin(
    sqrt(
      power(sin(radians(($3 - $1) / 2)), 2)
      + cos(radians($1)) * cos(radians($3))
      * power(sin(radians(($4 - $2) / 2)), 2)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.reserve_appointment_slot(
  p_task_id text,
  p_agreement_id text,
  p_starts_at timestamptz,
  p_duration_minutes integer DEFAULT 60,
  p_fulfillment_type text DEFAULT 'IN_PERSON',
  p_service_address text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_destination_latitude double precision DEFAULT NULL,
  p_destination_longitude double precision DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
  v_specialist public.profiles%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
  v_fulfillment text := upper(COALESCE(p_fulfillment_type, 'IN_PERSON'));
  v_ends_at timestamptz;
  v_rate numeric := 0;
  v_distance_km double precision;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_starts_at IS NULL OR p_starts_at <= now() THEN
    RAISE EXCEPTION 'Choose a future appointment time';
  END IF;

  IF COALESCE(p_duration_minutes, 0) < 15 OR p_duration_minutes > 480 THEN
    RAISE EXCEPTION 'Appointment duration must be between 15 minutes and 8 hours';
  END IF;

  IF v_fulfillment NOT IN ('IN_PERSON', 'ONLINE') THEN
    RAISE EXCEPTION 'Unsupported appointment fulfillment type';
  END IF;

  SELECT *
    INTO v_task
  FROM public.tasks
  WHERE id::text = p_task_id
  LIMIT 1;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.specialist_id IS NULL THEN
    RAISE EXCEPTION 'Task has no accepted specialist yet';
  END IF;

  IF v_task.user_id::text <> v_actor::text
    AND v_task.specialist_id::text <> v_actor::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.workspace_rooms wr
      WHERE wr.task_id::text = p_task_id
        AND (wr.client_id::text = v_actor::text OR wr.specialist_id::text = v_actor::text)
    )
  THEN
    RAISE EXCEPTION 'Forbidden: only task participants can reserve this appointment';
  END IF;

  SELECT *
    INTO v_specialist
  FROM public.profiles
  WHERE id::text = v_task.specialist_id::text
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Specialist profile not found';
  END IF;

  IF NOT (v_specialist.fulfillment_types @> ARRAY[v_fulfillment]::text[]) THEN
    RAISE EXCEPTION 'Specialist does not offer this appointment type';
  END IF;

  IF v_fulfillment = 'IN_PERSON' THEN
    IF NULLIF(btrim(COALESCE(p_service_address, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Service address is required for in-person visits';
    END IF;

    IF v_specialist.latitude IS NOT NULL
      AND v_specialist.longitude IS NOT NULL
      AND p_destination_latitude IS NOT NULL
      AND p_destination_longitude IS NOT NULL
    THEN
      v_distance_km := public.haversine_km(
        v_specialist.latitude,
        v_specialist.longitude,
        p_destination_latitude,
        p_destination_longitude
      );

      IF v_distance_km > COALESCE(v_specialist.service_radius_km, 25) THEN
        RAISE EXCEPTION 'Destination is outside the specialist service radius';
      END IF;
    END IF;
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => p_duration_minutes);
  v_rate := CASE
    WHEN v_fulfillment = 'ONLINE' THEN COALESCE(v_specialist.online_hourly_rate, (v_specialist.pricing->>'online_hourly_rate')::numeric, v_specialist.hourly_rate, 0)
    ELSE COALESCE(v_specialist.in_person_hourly_rate, (v_specialist.pricing->>'in_person_hourly_rate')::numeric, v_specialist.hourly_rate, 0)
  END;

  PERFORM pg_advisory_xact_lock(hashtext(v_task.specialist_id::text));

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.specialist_id::text = v_task.specialist_id::text
      AND a.status IN ('PENDING', 'CONFIRMED')
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, v_ends_at, '[)')
      AND a.task_id::text <> p_task_id
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'This specialist already has an appointment in that time window';
  END IF;

  UPDATE public.appointments
  SET status = 'CANCELLED',
      updated_at = now()
  WHERE task_id::text = p_task_id
    AND status = 'PENDING';

  INSERT INTO public.appointments (
    task_id,
    agreement_id,
    specialist_id,
    client_id,
    proposed_date,
    proposed_by,
    starts_at,
    ends_at,
    duration_minutes,
    fulfillment_type,
    rate_snapshot,
    price_total,
    service_address,
    destination_latitude,
    destination_longitude,
    notes,
    status,
    payment_hold_status,
    live_data
  )
  VALUES (
    v_task.id,
    NULLIF(p_agreement_id, '')::uuid,
    v_task.specialist_id,
    v_task.user_id,
    p_starts_at,
    CASE WHEN v_actor::text = v_task.specialist_id::text THEN 'specialist' ELSE 'client' END,
    p_starts_at,
    v_ends_at,
    p_duration_minutes,
    v_fulfillment,
    v_rate,
    ROUND((v_rate * p_duration_minutes::numeric / 60), 2),
    NULLIF(btrim(COALESCE(p_service_address, '')), ''),
    p_destination_latitude,
    p_destination_longitude,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    'PENDING',
    'PENDING',
    jsonb_build_object('reservation_locked_at', now())
  )
  RETURNING * INTO v_appointment;

  RETURN v_appointment;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'This specialist already has an appointment in that time window';
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_appointment_slot(
  p_appointment_id text
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_appointment public.appointments%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
    INTO v_appointment
  FROM public.appointments
  WHERE id::text = p_appointment_id
  FOR UPDATE;

  IF v_appointment.id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF v_appointment.client_id::text <> v_actor::text
    AND v_appointment.specialist_id::text <> v_actor::text
  THEN
    RAISE EXCEPTION 'Forbidden: only appointment participants can confirm';
  END IF;

  IF v_appointment.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Only pending appointments can be confirmed';
  END IF;

  UPDATE public.appointments
  SET status = 'CONFIRMED',
      confirmed_by = CASE WHEN v_actor::text = v_appointment.client_id::text THEN 'client' ELSE 'specialist' END,
      confirmed_date = now(),
      payment_hold_status = CASE WHEN payment_hold_status = 'PENDING' THEN 'HELD' ELSE payment_hold_status END,
      video_room_url = CASE
        WHEN fulfillment_type = 'ONLINE' THEN COALESCE(video_room_url, 'https://meet.jit.si/catchup-' || replace(id::text, '-', ''))
        ELSE video_room_url
      END,
      live_data = COALESCE(live_data, '{}'::jsonb) || jsonb_build_object(
        'confirmed_at', now(),
        'schedule_flag', CASE WHEN fulfillment_type = 'IN_PERSON' THEN service_address ELSE 'online_session' END
      ),
      updated_at = now()
  WHERE id = v_appointment.id
  RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_appointment_slot(
  p_appointment_id text
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_appointment public.appointments%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
    INTO v_appointment
  FROM public.appointments
  WHERE id::text = p_appointment_id
  FOR UPDATE;

  IF v_appointment.id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF v_appointment.client_id::text <> v_actor::text
    AND v_appointment.specialist_id::text <> v_actor::text
  THEN
    RAISE EXCEPTION 'Forbidden: only appointment participants can complete';
  END IF;

  IF v_appointment.status <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'Only confirmed appointments can be completed';
  END IF;

  UPDATE public.appointments
  SET status = 'COMPLETED',
      updated_at = now()
  WHERE id = v_appointment.id
  RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment_slot(
  p_appointment_id text,
  p_reason text DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_appointment public.appointments%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
    INTO v_appointment
  FROM public.appointments
  WHERE id::text = p_appointment_id
  FOR UPDATE;

  IF v_appointment.id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF v_appointment.client_id::text <> v_actor::text
    AND v_appointment.specialist_id::text <> v_actor::text
  THEN
    RAISE EXCEPTION 'Forbidden: only appointment participants can cancel';
  END IF;

  IF v_appointment.status NOT IN ('PENDING', 'CONFIRMED') THEN
    RAISE EXCEPTION 'Only pending or confirmed appointments can be cancelled';
  END IF;

  UPDATE public.appointments
  SET status = 'CANCELLED',
      live_data = COALESCE(live_data, '{}'::jsonb) || jsonb_build_object('cancel_reason', NULLIF(btrim(COALESCE(p_reason, '')), '')),
      updated_at = now()
  WHERE id = v_appointment.id
  RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_payment_hold_webhook(
  p_event_id text,
  p_appointment_id text,
  p_provider text DEFAULT 'manual',
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_count integer := 0;
  v_appointment public.appointments%ROWTYPE;
BEGIN
  INSERT INTO public.payment_webhook_events (event_id, appointment_id, provider, event_type, payload)
  VALUES (p_event_id, p_appointment_id::uuid, COALESCE(p_provider, 'manual'), 'payment_hold_succeeded', COALESCE(p_payload, '{}'::jsonb))
  ON CONFLICT (event_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  SELECT *
    INTO v_appointment
  FROM public.appointments
  WHERE id::text = p_appointment_id
  FOR UPDATE;

  IF v_appointment.id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF v_inserted_count > 0 THEN
    UPDATE public.appointments
    SET status = 'CONFIRMED',
        payment_hold_status = 'HELD',
        confirmed_date = COALESCE(confirmed_date, now()),
        video_room_url = CASE
          WHEN fulfillment_type = 'ONLINE' THEN COALESCE(video_room_url, COALESCE(p_payload->>'video_room_url', 'https://meet.jit.si/catchup-' || replace(id::text, '-', '')))
          ELSE video_room_url
        END,
        live_data = COALESCE(live_data, '{}'::jsonb) || jsonb_build_object(
          'payment_event_id', p_event_id,
          'activated_at', now(),
          'appointment_asset', CASE WHEN fulfillment_type = 'ONLINE' THEN 'video_room' ELSE 'destination_schedule' END
        ),
        updated_at = now()
    WHERE id = v_appointment.id
    RETURNING * INTO v_appointment;
  END IF;

  RETURN v_appointment;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_appointment_slot(text, text, timestamptz, integer, text, text, text, double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_appointment_slot(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_appointment_slot(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_appointment_slot(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_payment_hold_webhook(text, text, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_appointment_slot(text, text, timestamptz, integer, text, text, text, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_appointment_slot(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment_slot(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_slot(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_hold_webhook(text, text, text, jsonb) TO service_role;
