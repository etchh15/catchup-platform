-- Phase 14: Automated Updated-At Timestamp Triggers
-- Purpose: Implement database-level automatic timestamp tracking across all tables
-- This ensures updated_at is managed by PostgreSQL, not frontend/service layer
-- Eliminates synchronization bugs and ensures data consistency

-- ============================================================================
-- 1. CREATE REUSABLE TRIGGER FUNCTION
-- ============================================================================
-- This function is applied to every table with an updated_at column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

COMMENT ON FUNCTION update_modified_column() IS
  'Reusable trigger function that automatically updates the updated_at timestamp on any row modification.';


-- ============================================================================
-- 2. CREATE TRIGGERS FOR CORE TABLES
-- ============================================================================

-- Profiles table: tracks all user profile changes
DROP TRIGGER IF EXISTS update_profiles_modtime ON profiles;
CREATE TRIGGER update_profiles_modtime
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- Clients table: tracks client-specific data changes
DROP TRIGGER IF EXISTS update_clients_modtime ON clients;
CREATE TRIGGER update_clients_modtime
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- Specialists table: tracks specialist-specific data changes
DROP TRIGGER IF EXISTS update_specialists_modtime ON specialists;
CREATE TRIGGER update_specialists_modtime
    BEFORE UPDATE ON specialists
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- Tasks table: tracks task status, assignment, and detail changes
DROP TRIGGER IF EXISTS update_tasks_modtime ON tasks;
CREATE TRIGGER update_tasks_modtime
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- Bids table: tracks bid status and amount changes
DROP TRIGGER IF EXISTS update_bids_modtime ON bids;
CREATE TRIGGER update_bids_modtime
    BEFORE UPDATE ON bids
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- Workspace rooms table: tracks room status, disputes, and communication state
DROP TRIGGER IF EXISTS update_workspace_rooms_modtime ON workspace_rooms;
CREATE TRIGGER update_workspace_rooms_modtime
    BEFORE UPDATE ON workspace_rooms
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- Notification preferences table: tracks user notification channel settings
DROP TRIGGER IF EXISTS update_notification_preferences_modtime ON notification_preferences;
CREATE TRIGGER update_notification_preferences_modtime
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- Specialist reputation table: tracks aggregated reputation metrics
DROP TRIGGER IF EXISTS update_specialist_reputation_modtime ON specialist_reputation;
CREATE TRIGGER update_specialist_reputation_modtime
    BEFORE UPDATE ON specialist_reputation
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- Agreements table: tracks contract acceptance and milestone updates
DROP TRIGGER IF EXISTS update_agreements_modtime ON agreements;
CREATE TRIGGER update_agreements_modtime
    BEFORE UPDATE ON agreements
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- Disputes table: tracks dispute status and resolution
DROP TRIGGER IF EXISTS update_disputes_modtime ON disputes;
CREATE TRIGGER update_disputes_modtime
    BEFORE UPDATE ON disputes
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();


-- ============================================================================
-- 3. VERIFICATION: List all triggers
-- ============================================================================
-- Run this query to verify all triggers are in place:
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE event_object_schema = 'public'
-- AND trigger_name LIKE 'update_%_modtime'
-- ORDER BY event_object_table;

-- Expected output:
-- update_profiles_modtime          UPDATE  profiles
-- update_clients_modtime           UPDATE  clients
-- update_specialists_modtime       UPDATE  specialists
-- update_tasks_modtime             UPDATE  tasks
-- update_bids_modtime              UPDATE  bids
-- update_workspace_rooms_modtime   UPDATE  workspace_rooms
-- update_notification_preferences_modtime UPDATE notification_preferences
-- update_specialist_reputation_modtime UPDATE specialist_reputation
-- update_agreements_modtime        UPDATE  agreements
-- update_disputes_modtime          UPDATE  disputes
