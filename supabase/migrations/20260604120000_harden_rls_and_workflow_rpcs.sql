-- Superseded by 20260604134000_schema_compatible_workflow_rpcs.sql.
--
-- The first version of this migration assumed UUID task ids. The production
-- schema uses bigint task ids, so the hardening RPCs were moved into a
-- schema-compatible migration that compares task ids as text and casts only at
-- write boundaries.
SELECT 1;
