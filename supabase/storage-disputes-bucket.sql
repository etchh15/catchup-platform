-- Create a private Supabase Storage bucket for dispute evidence uploads
-- Run this in Supabase SQL Editor.

INSERT INTO storage.buckets (id, name, public)
VALUES ('disputes', 'Disputes', false)
ON CONFLICT (id) DO NOTHING;

-- Secure dispute evidence to authenticated owners only.
DROP POLICY IF EXISTS "Allow authenticated inserts into disputes bucket" ON storage.objects;
CREATE POLICY "Allow authenticated inserts into disputes bucket"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'disputes' AND
    auth.uid() IS NOT NULL AND
    auth.uid() = owner
  );

DROP POLICY IF EXISTS "Allow authenticated reads from disputes bucket" ON storage.objects;
CREATE POLICY "Allow authenticated reads from disputes bucket"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'disputes' AND
    auth.uid() IS NOT NULL AND
    auth.uid() = owner
  );

DROP POLICY IF EXISTS "Allow authenticated updates to disputes bucket" ON storage.objects;
CREATE POLICY "Allow authenticated updates to disputes bucket"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'disputes' AND
    auth.uid() IS NOT NULL AND
    auth.uid() = owner
  )
  WITH CHECK (
    bucket_id = 'disputes' AND
    auth.uid() IS NOT NULL AND
    auth.uid() = owner
  );

DROP POLICY IF EXISTS "Allow authenticated deletes from disputes bucket" ON storage.objects;
CREATE POLICY "Allow authenticated deletes from disputes bucket"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'disputes' AND
    auth.uid() IS NOT NULL AND
    auth.uid() = owner
  );
