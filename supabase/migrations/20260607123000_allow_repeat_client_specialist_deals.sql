-- Allow the same client and specialist to work together repeatedly on
-- different tasks without merging or blocking workspaces, agreements, reviews,
-- or specialist-client ratings. Deal identity must be task-scoped.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      conrelid::regclass AS table_name,
      conname AS constraint_name
    FROM pg_constraint
    WHERE contype = 'u'
      AND conrelid IN (
        to_regclass('public.workspace_rooms'),
        to_regclass('public.agreements'),
        to_regclass('public.reviews'),
        to_regclass('public.specialist_client_ratings')
      )
      AND (
        SELECT array_agg(att.attname ORDER BY cols.ordinality)
        FROM unnest(conkey) WITH ORDINALITY AS cols(attnum, ordinality)
        JOIN pg_attribute att
          ON att.attrelid = conrelid
         AND att.attnum = cols.attnum
      ) = ARRAY['client_id', 'specialist_id']::name[]
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
  END LOOP;

  FOR r IN
    SELECT
      idx.indrelid::regclass AS table_name,
      cls.relname AS index_name
    FROM pg_index idx
    JOIN pg_class cls ON cls.oid = idx.indexrelid
    WHERE idx.indisunique
      AND idx.indrelid IN (
        to_regclass('public.workspace_rooms'),
        to_regclass('public.agreements'),
        to_regclass('public.reviews'),
        to_regclass('public.specialist_client_ratings')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conindid = idx.indexrelid
      )
      AND (
        SELECT array_agg(att.attname ORDER BY cols.ordinality)
        FROM unnest(idx.indkey::int2[]) WITH ORDINALITY AS cols(attnum, ordinality)
        JOIN pg_attribute att
          ON att.attrelid = idx.indrelid
         AND att.attnum = cols.attnum
      ) = ARRAY['client_id', 'specialist_id']::name[]
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.index_name);
  END LOOP;
END $$;

DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT task_id, client_id, specialist_id
    FROM public.workspace_rooms
    GROUP BY task_id, client_id, specialist_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS workspace_rooms_unique_task_participants
      ON public.workspace_rooms (task_id, client_id, specialist_id);
  ELSE
    RAISE NOTICE 'Skipped workspace_rooms_unique_task_participants: % duplicate task/client/specialist groups exist', duplicate_count;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agreements_task_client_specialist_created
  ON public.agreements (task_id, client_id, specialist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_task_client_specialist_created
  ON public.reviews (task_id, client_id, specialist_id, created_at DESC);

DO $$
BEGIN
  IF to_regclass('public.specialist_client_ratings') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_specialist_client_ratings_task_pair
      ON public.specialist_client_ratings (task_id, specialist_id, client_id);
  END IF;
END $$;
