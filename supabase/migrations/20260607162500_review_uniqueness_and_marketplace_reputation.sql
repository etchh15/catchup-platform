-- Keep repeat client/specialist relationships possible across different tasks,
-- while preventing the same task review from being inserted and counted twice.

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

CREATE OR REPLACE FUNCTION public.recalculate_specialist_reputation(p_specialist_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed_jobs INT;
  v_avg_rating DECIMAL;
  v_total_reviews INT;
  v_avg_response_time INT;
  v_profile_completeness INT;
BEGIN
  SELECT COUNT(DISTINCT id) INTO v_completed_jobs
  FROM public.tasks
  WHERE specialist_id = p_specialist_id
    AND status = 'completed';

  SELECT
    ROUND(AVG(latest_reviews.rating_score)::numeric, 1),
    COUNT(*)
  INTO v_avg_rating, v_total_reviews
  FROM (
    SELECT DISTINCT ON (task_id, client_id, specialist_id)
      rating_score
    FROM public.reviews
    WHERE specialist_id = p_specialist_id
      AND rating_score IS NOT NULL
    ORDER BY task_id, client_id, specialist_id, created_at DESC, id DESC
  ) latest_reviews;

  SELECT AVG(response_time_hours) INTO v_avg_response_time
  FROM public.specialist_metrics
  WHERE specialist_id = p_specialist_id;

  v_profile_completeness := CASE
    WHEN (
      SELECT COUNT(*)
      FROM public.profiles
      WHERE id = p_specialist_id
        AND full_name IS NOT NULL
        AND phone_number IS NOT NULL
    ) > 0 THEN 50
    ELSE 20
  END;

  IF EXISTS (SELECT 1 FROM public.specialist_reputation WHERE specialist_id = p_specialist_id) THEN
    UPDATE public.specialist_reputation
    SET total_completed_jobs = COALESCE(v_completed_jobs, 0),
        total_reviews = COALESCE(v_total_reviews, 0),
        average_rating = COALESCE(v_avg_rating, 0),
        response_time_hours = COALESCE(v_avg_response_time, 0),
        profile_completeness = COALESCE(profile_completeness, v_profile_completeness),
        updated_at = now()
    WHERE specialist_id = p_specialist_id;
  ELSE
    INSERT INTO public.specialist_reputation (
      specialist_id,
      total_completed_jobs,
      total_reviews,
      average_rating,
      response_time_hours,
      profile_completeness,
      updated_at
    )
    VALUES (
      p_specialist_id,
      COALESCE(v_completed_jobs, 0),
      COALESCE(v_total_reviews, 0),
      COALESCE(v_avg_rating, 0),
      COALESCE(v_avg_response_time, 0),
      v_profile_completeness,
      now()
    );
  END IF;
END;
$$;

DO $$
DECLARE
  specialist_record RECORD;
BEGIN
  FOR specialist_record IN
    SELECT DISTINCT specialist_id
    FROM public.reviews
    WHERE specialist_id IS NOT NULL
  LOOP
    PERFORM public.recalculate_specialist_reputation(specialist_record.specialist_id);
  END LOOP;
END $$;
