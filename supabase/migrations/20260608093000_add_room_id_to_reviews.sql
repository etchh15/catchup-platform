-- Production compatibility: older reviews tables were created without room_id.
-- The workspace UI and review RPC now use room_id to seal the exact deal room,
-- so add it safely without breaking existing historical reviews.

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS room_id uuid;

UPDATE public.reviews r
SET room_id = wr.id
FROM public.workspace_rooms wr
WHERE r.room_id IS NULL
  AND r.task_id::text = wr.task_id::text
  AND r.client_id::text = wr.client_id::text
  AND r.specialist_id::text = wr.specialist_id::text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reviews_room_id_fkey'
      AND conrelid = 'public.reviews'::regclass
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_room_id_fkey
      FOREIGN KEY (room_id)
      REFERENCES public.workspace_rooms(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reviews_room_id
  ON public.reviews (room_id);

CREATE INDEX IF NOT EXISTS idx_reviews_room_task_participants
  ON public.reviews (room_id, task_id, client_id, specialist_id);
