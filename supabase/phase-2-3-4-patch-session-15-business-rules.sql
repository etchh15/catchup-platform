-- Session 15: Business rules and data integrity
-- Enforce specialist self-bid blocking, open-task-only cancellation/editing, and review submission only after dual completion.

-- Tasks: client can edit or delete only open tasks with no accepted bid
DROP POLICY IF EXISTS "Authenticated update own task" ON tasks;
CREATE POLICY "Authenticated update own task" ON tasks
  FOR UPDATE USING (
    auth.uid()::text = user_id
    AND status = 'open'
    AND specialist_id IS NULL
  ) WITH CHECK (
    auth.uid()::text = user_id
    AND specialist_id IS NULL
    AND status IN ('open', 'archived')
  );

DROP POLICY IF EXISTS "Authenticated delete own task" ON tasks;
CREATE POLICY "Authenticated delete own task" ON tasks
  FOR DELETE USING (
    auth.uid()::text = user_id
    AND status = 'open'
    AND specialist_id IS NULL
  );

-- Bids: specialists may only bid on open tasks they do not own
DROP POLICY IF EXISTS "Authenticated insert own bid" ON bids;
CREATE POLICY "Authenticated insert own bid" ON bids
  FOR INSERT WITH CHECK (
    auth.uid()::uuid = specialist_id
    AND NOT EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = bids.task_id
        AND tasks.user_id = auth.uid()::text
    )
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = bids.task_id
        AND tasks.status = 'open'
    )
  );

-- Reviews: only the client can insert a review after both work delivery and client confirmation
DROP POLICY IF EXISTS "Authenticated insert reviews" ON reviews;
CREATE POLICY "Authenticated insert reviews" ON reviews
  FOR INSERT WITH CHECK (
    auth.uid()::uuid = client_id
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = reviews.task_id
        AND tasks.user_id = auth.uid()::text
        AND tasks.work_delivered_at IS NOT NULL
        AND tasks.confirmed_by_client_at IS NOT NULL
    )
  );
