-- Specialist identity documents for controlled beta verification.
-- Documents live in a private bucket. Only platform admins can read them.

CREATE TABLE IF NOT EXISTS public.specialist_identity_documents (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_name text,
  mime_type text NOT NULL,
  file_size_bytes integer NOT NULL DEFAULT 0,
  review_status text NOT NULL DEFAULT 'pending_review',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_note text,
  CONSTRAINT specialist_identity_documents_review_status_check
    CHECK (review_status IN ('pending_review', 'approved', 'rejected')),
  CONSTRAINT specialist_identity_documents_mime_type_check
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  CONSTRAINT specialist_identity_documents_file_size_check
    CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760)
);

ALTER TABLE public.specialist_identity_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read specialist identity documents" ON public.specialist_identity_documents;
CREATE POLICY "Admins read specialist identity documents"
  ON public.specialist_identity_documents
  FOR SELECT
  USING (public.current_user_is_platform_admin());

DROP POLICY IF EXISTS "Users create own identity document record" ON public.specialist_identity_documents;
CREATE POLICY "Users create own identity document record"
  ON public.specialist_identity_documents
  FOR INSERT
  WITH CHECK (auth.uid()::text = profile_id::text);

DROP POLICY IF EXISTS "Users update own pending identity document record" ON public.specialist_identity_documents;
CREATE POLICY "Users update own pending identity document record"
  ON public.specialist_identity_documents
  FOR UPDATE
  USING (auth.uid()::text = profile_id::text AND review_status = 'pending_review')
  WITH CHECK (auth.uid()::text = profile_id::text AND review_status = 'pending_review');

DROP POLICY IF EXISTS "Admins update specialist identity document review" ON public.specialist_identity_documents;
CREATE POLICY "Admins update specialist identity document review"
  ON public.specialist_identity_documents
  FOR UPDATE
  USING (public.current_user_is_platform_admin())
  WITH CHECK (public.current_user_is_platform_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('specialist-identity-documents', 'specialist-identity-documents', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

DROP POLICY IF EXISTS "Users upload own specialist identity documents" ON storage.objects;
CREATE POLICY "Users upload own specialist identity documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'specialist-identity-documents'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Admins read specialist identity document files" ON storage.objects;
CREATE POLICY "Admins read specialist identity document files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'specialist-identity-documents'
    AND public.current_user_is_platform_admin()
  );

CREATE OR REPLACE FUNCTION public.create_specialist_profile_with_identity_document(
  p_email text,
  p_full_name text,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_file_size_bytes integer
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_profile public.profiles;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to request specialist verification.';
  END IF;

  IF p_storage_path IS NULL OR split_part(p_storage_path, '/', 1) <> v_actor::text THEN
    RAISE EXCEPTION 'Identity document path must belong to the signed-in user.';
  END IF;

  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') THEN
    RAISE EXCEPTION 'Identity document must be a JPG, PNG, WEBP, or PDF file.';
  END IF;

  IF COALESCE(p_file_size_bytes, 0) <= 0 OR p_file_size_bytes > 10485760 THEN
    RAISE EXCEPTION 'Identity document must be smaller than 10MB.';
  END IF;

  INSERT INTO public.profiles (
    id,
    role,
    email,
    full_name,
    is_verified,
    verification_status,
    verification_requested_at
  )
  VALUES (
    v_actor,
    'client',
    lower(COALESCE(p_email, '')),
    COALESCE(NULLIF(p_full_name, ''), 'Specialist'),
    false,
    'unverified',
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    is_verified = false,
    verification_status = CASE
      WHEN public.profiles.verification_status = 'verified' THEN 'verified'
      ELSE 'pending_verification'
    END,
    verification_requested_at = COALESCE(public.profiles.verification_requested_at, now()),
    updated_at = now();

  INSERT INTO public.specialist_identity_documents (
    profile_id,
    storage_path,
    original_name,
    mime_type,
    file_size_bytes,
    review_status,
    uploaded_at
  )
  VALUES (
    v_actor,
    p_storage_path,
    p_original_name,
    p_mime_type,
    p_file_size_bytes,
    'pending_review',
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE
  SET
    storage_path = EXCLUDED.storage_path,
    original_name = EXCLUDED.original_name,
    mime_type = EXCLUDED.mime_type,
    file_size_bytes = EXCLUDED.file_size_bytes,
    review_status = 'pending_review',
    uploaded_at = now(),
    reviewed_at = null,
    reviewed_by = null,
    review_note = null;

  UPDATE public.profiles
  SET
    role = 'specialist',
    is_verified = false,
    verification_status = 'pending_verification',
    verification_requested_at = now(),
    updated_at = now()
  WHERE id = v_actor
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_specialist_identity_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.current_user_is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF lower(COALESCE(NEW.role, '')) = 'specialist'
    AND (TG_OP = 'INSERT' OR lower(COALESCE(OLD.role, '')) IS DISTINCT FROM 'specialist')
    AND NOT EXISTS (
      SELECT 1
      FROM public.specialist_identity_documents sid
      WHERE sid.profile_id::text = NEW.id::text
    )
  THEN
    RAISE EXCEPTION 'Specialist registration requires an identity document upload before beta review.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_specialist_identity_document_trigger ON public.profiles;
CREATE TRIGGER enforce_specialist_identity_document_trigger
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_specialist_identity_document();

NOTIFY pgrst, 'reload schema';
