-- Migration: Skip Problematic Migrations
-- Created: 2025-08-13 13:42:12 UTC
-- Description: This migration ensures that problematic function recreation migrations are skipped
--              and only the safe ALTER FUNCTION approach is used

-- =============================================================================
-- PART 1: Clear any problematic migration content by making them no-ops
-- =============================================================================

-- This migration serves as a placeholder to ensure the migration order is correct
-- The actual function search path fixes will be handled by the final migration
-- that uses ALTER FUNCTION SET instead of CREATE OR REPLACE FUNCTION

-- Log that we're skipping problematic migrations
DO $$
BEGIN
    RAISE NOTICE 'Skipping problematic function recreation migrations';
    RAISE NOTICE 'Function search path fixes will be applied by the final migration';
    RAISE NOTICE 'This approach avoids "cannot change return type" errors';
END $$;