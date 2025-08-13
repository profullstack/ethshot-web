-- Migration: Fix Function Search Path Warnings (NO-OP)
-- Created: 2025-08-13 13:26:08 UTC
-- Description: This migration has been made a no-op to avoid function signature conflicts
--              The actual fixes are handled by the final migration using ALTER FUNCTION SET

-- =============================================================================
-- NO-OP: Avoiding function recreation conflicts
-- =============================================================================

-- This migration was originally intended to fix function search path warnings
-- by recreating functions with SET search_path = public
-- However, this approach caused "cannot change return type" errors
-- The fixes are now handled by a later migration using ALTER FUNCTION SET

DO $$
BEGIN
    RAISE NOTICE 'Migration 20250813132608 made no-op to avoid conflicts';
    RAISE NOTICE 'Function search path fixes handled by later migration';
END $$;