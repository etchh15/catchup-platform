-- Trigger: recalculate specialist reputation after reviews change

BEGIN;

-- Drop existing trigger/function if present (idempotent)
DROP TRIGGER IF EXISTS reviews_recalc_specialist_reputation ON reviews;
DROP FUNCTION IF EXISTS public.recalc_specialist_reputation_trigger();

-- Trigger function that calls calculate_specialist_reputation for the affected specialist
CREATE OR REPLACE FUNCTION public.recalc_specialist_reputation_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF (NEW.specialist_id IS NOT NULL) THEN
      PERFORM public.calculate_specialist_reputation(NEW.specialist_id);
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    -- On delete, attempt to recalc using OLD.specialist_id
    IF (OLD.specialist_id IS NOT NULL) THEN
      PERFORM public.calculate_specialist_reputation(OLD.specialist_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on reviews for INSERT, UPDATE, DELETE
CREATE TRIGGER reviews_recalc_specialist_reputation
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION public.recalc_specialist_reputation_trigger();

COMMIT;
