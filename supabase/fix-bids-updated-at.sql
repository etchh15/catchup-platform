-- Fix missing bids.updated_at column in production schema
-- This column is required by the accept_bid RPC and other bid update operations.

ALTER TABLE bids
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
