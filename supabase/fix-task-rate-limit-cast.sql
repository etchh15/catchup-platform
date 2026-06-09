-- Fix remote task creation rate-limit trigger for auth.uid() / user_id type mismatch
-- This function runs before INSERT on tasks and must compare auth.uid()::text
-- against tasks.user_id, because tasks.user_id is stored as text in production.

CREATE OR REPLACE FUNCTION public.enforce_task_creation_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_posts_count INT;
BEGIN
  SELECT COUNT(*) INTO recent_posts_count
  FROM public.tasks
  WHERE user_id = auth.uid()::text
    AND created_at > (NOW() - INTERVAL '1 minute');

  IF recent_posts_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit reached. You can only publish up to 3 marketplace tasks per minute to prevent system spam.';
  END IF;

  RETURN NEW;
END;
$$;
