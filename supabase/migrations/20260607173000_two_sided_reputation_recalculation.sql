-- Two-sided reputation contract:
-- - one counted review per task per direction
-- - immediate recalculation after review/task changes
-- - weekly full refresh as a backstop for honest marketplace scores

ALTER TABLE public.client_reputation
  ALTER COLUMN completion_rate TYPE numeric(4,1),
  ALTER COLUMN average_acceptance_rate TYPE numeric(4,1);

WITH ranked_reviews AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY task_id, client_id, specialist_id
      ORDER BY created_at DESC, id DESC
    ) AS duplicate_rank
  FROM public.reviews
)
DELETE FROM public.reviews r
USING ranked_reviews rr
WHERE r.id = rr.id
  AND rr.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_unique_task_client_specialist
  ON public.reviews (task_id, client_id, specialist_id);

WITH ranked_client_ratings AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY specialist_id, task_id
      ORDER BY submitted_at DESC, id DESC
    ) AS duplicate_rank
  FROM public.specialist_client_ratings
)
DELETE FROM public.specialist_client_ratings r
USING ranked_client_ratings rr
WHERE r.id = rr.id
  AND rr.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS specialist_client_ratings_unique_specialist_task
  ON public.specialist_client_ratings (specialist_id, task_id);

CREATE OR REPLACE FUNCTION public.recalculate_specialist_reputation(p_specialist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed_jobs integer := 0;
  v_avg_rating numeric := 0;
  v_total_reviews integer := 0;
  v_avg_response_time integer := 0;
  v_profile_completeness integer := 20;
BEGIN
  IF p_specialist_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT id)
    INTO v_completed_jobs
  FROM public.tasks
  WHERE specialist_id::text = p_specialist_id::text
    AND status = 'completed';

  SELECT
    COALESCE(ROUND(AVG(latest_reviews.rating_score)::numeric, 1), 0),
    COUNT(*)
    INTO v_avg_rating, v_total_reviews
  FROM (
    SELECT DISTINCT ON (task_id, client_id, specialist_id)
      rating_score
    FROM public.reviews
    WHERE specialist_id::text = p_specialist_id::text
      AND rating_score IS NOT NULL
    ORDER BY task_id, client_id, specialist_id, created_at DESC, id DESC
  ) latest_reviews;

  SELECT COALESCE(ROUND(AVG(response_time_hours))::integer, 0)
    INTO v_avg_response_time
  FROM public.specialist_metrics
  WHERE specialist_id::text = p_specialist_id::text;

  SELECT
    CASE
      WHEN full_name IS NOT NULL AND phone_number IS NOT NULL THEN 70
      WHEN full_name IS NOT NULL OR phone_number IS NOT NULL THEN 45
      ELSE 20
    END
    INTO v_profile_completeness
  FROM public.profiles
  WHERE id::text = p_specialist_id::text
  LIMIT 1;

  INSERT INTO public.specialist_reputation (
    specialist_id,
    total_completed_jobs,
    total_reviews,
    average_rating,
    response_time_hours,
    profile_completeness,
    calculated_at,
    updated_at
  )
  VALUES (
    p_specialist_id,
    COALESCE(v_completed_jobs, 0),
    COALESCE(v_total_reviews, 0),
    LEAST(COALESCE(v_avg_rating, 0), 5),
    COALESCE(v_avg_response_time, 0),
    COALESCE(v_profile_completeness, 20),
    now(),
    now()
  )
  ON CONFLICT (specialist_id)
  DO UPDATE SET
    total_completed_jobs = EXCLUDED.total_completed_jobs,
    total_reviews = EXCLUDED.total_reviews,
    average_rating = EXCLUDED.average_rating,
    response_time_hours = EXCLUDED.response_time_hours,
    profile_completeness = GREATEST(
      COALESCE(public.specialist_reputation.profile_completeness, 0),
      EXCLUDED.profile_completeness
    ),
    calculated_at = now(),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_specialist_reputation(p_specialist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_specialist_reputation(p_specialist_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_client_reputation(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jobs_posted integer := 0;
  v_jobs_completed integer := 0;
  v_completion_rate numeric := 0;
  v_avg_rating numeric := 0;
  v_total_ratings integer := 0;
  v_phone_verified boolean := false;
  v_email_verified boolean := false;
BEGIN
  IF p_client_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
    INTO v_jobs_posted
  FROM public.tasks
  WHERE user_id::text = p_client_id::text;

  SELECT COUNT(*)
    INTO v_jobs_completed
  FROM public.tasks
  WHERE user_id::text = p_client_id::text
    AND status = 'completed';

  v_completion_rate := CASE
    WHEN COALESCE(v_jobs_posted, 0) = 0 THEN 0
    ELSE ROUND((v_jobs_completed::numeric / v_jobs_posted::numeric) * 100, 1)
  END;

  SELECT
    COALESCE(ROUND(AVG(latest_ratings.rating)::numeric, 1), 0),
    COUNT(*)
    INTO v_avg_rating, v_total_ratings
  FROM (
    SELECT DISTINCT ON (specialist_id, task_id)
      rating
    FROM public.specialist_client_ratings
    WHERE client_id::text = p_client_id::text
    ORDER BY specialist_id, task_id, submitted_at DESC, id DESC
  ) latest_ratings;

  SELECT
    COALESCE(phone_number IS NOT NULL AND btrim(phone_number) <> '', false),
    true
    INTO v_phone_verified, v_email_verified
  FROM public.profiles
  WHERE id::text = p_client_id::text
  LIMIT 1;

  INSERT INTO public.client_reputation (
    client_id,
    total_jobs_posted,
    total_jobs_completed,
    completion_rate,
    phone_verified,
    email_verified,
    average_rating_from_specialists,
    total_ratings_given,
    calculated_at,
    updated_at
  )
  VALUES (
    p_client_id,
    COALESCE(v_jobs_posted, 0),
    COALESCE(v_jobs_completed, 0),
    LEAST(COALESCE(v_completion_rate, 0), 100),
    COALESCE(v_phone_verified, false),
    COALESCE(v_email_verified, false),
    LEAST(COALESCE(v_avg_rating, 0), 5),
    COALESCE(v_total_ratings, 0),
    now(),
    now()
  )
  ON CONFLICT (client_id)
  DO UPDATE SET
    total_jobs_posted = EXCLUDED.total_jobs_posted,
    total_jobs_completed = EXCLUDED.total_jobs_completed,
    completion_rate = EXCLUDED.completion_rate,
    phone_verified = EXCLUDED.phone_verified,
    email_verified = EXCLUDED.email_verified,
    average_rating_from_specialists = EXCLUDED.average_rating_from_specialists,
    total_ratings_given = EXCLUDED.total_ratings_given,
    calculated_at = now(),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.rate_client_after_completion(
  p_task_id text,
  p_rating integer,
  p_comment text DEFAULT NULL
)
RETURNS public.specialist_client_ratings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
  v_rating public.specialist_client_ratings;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  SELECT *
    INTO v_task
  FROM public.tasks
  WHERE id::text = p_task_id
  LIMIT 1;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.status <> 'completed' OR v_task.confirmed_by_client_at IS NULL THEN
    RAISE EXCEPTION 'Client can only be rated after confirmed completion';
  END IF;

  IF v_task.specialist_id::text <> v_actor::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.workspace_rooms wr
      WHERE wr.task_id::text = p_task_id
        AND wr.specialist_id::text = v_actor::text
    )
  THEN
    RAISE EXCEPTION 'Forbidden: only the assigned specialist can rate this client';
  END IF;

  INSERT INTO public.specialist_client_ratings (
    specialist_id,
    client_id,
    task_id,
    rating,
    comment,
    submitted_at
  )
  VALUES (
    v_actor,
    v_task.user_id::text::uuid,
    v_task.id,
    p_rating,
    NULLIF(btrim(COALESCE(p_comment, '')), ''),
    now()
  )
  ON CONFLICT (specialist_id, task_id)
  DO UPDATE SET
    rating = EXCLUDED.rating,
    comment = EXCLUDED.comment,
    submitted_at = now()
  RETURNING * INTO v_rating;

  PERFORM public.recalculate_client_reputation(v_task.user_id::text::uuid);

  RETURN v_rating;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_all_marketplace_reputation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_specialist_count integer := 0;
  v_client_count integer := 0;
  v_record record;
BEGIN
  FOR v_record IN
    SELECT DISTINCT specialist_id::uuid AS id
    FROM public.tasks
    WHERE specialist_id IS NOT NULL
    UNION
    SELECT DISTINCT specialist_id::uuid AS id
    FROM public.reviews
    WHERE specialist_id IS NOT NULL
  LOOP
    PERFORM public.recalculate_specialist_reputation(v_record.id);
    v_specialist_count := v_specialist_count + 1;
  END LOOP;

  FOR v_record IN
    SELECT DISTINCT user_id::uuid AS id
    FROM public.tasks
    WHERE user_id IS NOT NULL
    UNION
    SELECT DISTINCT client_id::uuid AS id
    FROM public.specialist_client_ratings
    WHERE client_id IS NOT NULL
  LOOP
    PERFORM public.recalculate_client_reputation(v_record.id);
    v_client_count := v_client_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'specialists_recalculated', v_specialist_count,
    'clients_recalculated', v_client_count,
    'calculated_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_reputation_after_review_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.recalculate_specialist_reputation(NEW.specialist_id);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.recalculate_specialist_reputation(OLD.specialist_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS reviews_recalculate_specialist_reputation ON public.reviews;
DROP TRIGGER IF EXISTS reviews_recalc_specialist_reputation ON public.reviews;
CREATE TRIGGER reviews_recalculate_specialist_reputation
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_reputation_after_review_change();

CREATE OR REPLACE FUNCTION public.recalculate_reputation_after_client_rating_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.recalculate_client_reputation(NEW.client_id);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.recalculate_client_reputation(OLD.client_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS specialist_client_ratings_recalculate_client_reputation ON public.specialist_client_ratings;
CREATE TRIGGER specialist_client_ratings_recalculate_client_reputation
AFTER INSERT OR UPDATE OR DELETE ON public.specialist_client_ratings
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_reputation_after_client_rating_change();

CREATE OR REPLACE FUNCTION public.recalculate_reputation_after_task_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.recalculate_client_reputation(NEW.user_id::text::uuid);
    PERFORM public.recalculate_specialist_reputation(NEW.specialist_id::text::uuid);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.recalculate_client_reputation(OLD.user_id::text::uuid);
    PERFORM public.recalculate_specialist_reputation(OLD.specialist_id::text::uuid);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tasks_recalculate_marketplace_reputation ON public.tasks;
CREATE TRIGGER tasks_recalculate_marketplace_reputation
AFTER INSERT OR UPDATE OF status, specialist_id, user_id OR DELETE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_reputation_after_task_change();

REVOKE ALL ON FUNCTION public.recalculate_specialist_reputation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_specialist_reputation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_client_reputation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_all_marketplace_reputation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rate_client_after_completion(text, integer, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.recalculate_specialist_reputation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_specialist_reputation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_client_reputation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_marketplace_reputation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rate_client_after_completion(text, integer, text) TO authenticated;

SELECT public.recalculate_all_marketplace_reputation();

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension is unavailable in this environment: %', SQLERRM;
  END;

  BEGIN
    EXECUTE 'SELECT cron.unschedule(''catchup_weekly_reputation_recalc'')';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    EXECUTE $cron$
      SELECT cron.schedule(
        'catchup_weekly_reputation_recalc',
        '0 3 * * 1',
        'SELECT public.recalculate_all_marketplace_reputation();'
      )
    $cron$;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Weekly reputation cron could not be scheduled here: %', SQLERRM;
  END;
END $$;
