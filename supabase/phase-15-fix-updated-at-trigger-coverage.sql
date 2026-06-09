-- Phase 15: Fix missing updated_at trigger coverage and workspace_rooms schema
-- Ensures every live table with updated_at has DB-level automatic timestamp updates.

-- Ensure workspace_rooms has the updated_at column expected by its trigger.
ALTER TABLE public.workspace_rooms
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Ensure clients and specialists have updated_at columns for their existing triggers.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.specialists
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Reusable trigger function exists or is updated
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure every updated_at table has a trigger attached.
DROP TRIGGER IF EXISTS update_agreement_milestones_modtime ON public.agreement_milestones;
CREATE TRIGGER update_agreement_milestones_modtime
  BEFORE UPDATE ON public.agreement_milestones
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_modified_column();

DROP TRIGGER IF EXISTS update_appointments_modtime ON public.appointments;
CREATE TRIGGER update_appointments_modtime
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_modified_column();

DROP TRIGGER IF EXISTS update_client_reputation_modtime ON public.client_reputation;
CREATE TRIGGER update_client_reputation_modtime
  BEFORE UPDATE ON public.client_reputation
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_modified_column();

-- Re-create workspace_rooms trigger to ensure it is bound to the newly ensured column.
DROP TRIGGER IF EXISTS update_workspace_rooms_modtime ON public.workspace_rooms;
CREATE TRIGGER update_workspace_rooms_modtime
  BEFORE UPDATE ON public.workspace_rooms
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_modified_column();
