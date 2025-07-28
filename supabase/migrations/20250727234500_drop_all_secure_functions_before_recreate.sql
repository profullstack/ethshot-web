-- Migration: Drop all existing secure functions to avoid conflicts
-- This migration ensures we can cleanly recreate the secure function

-- Drop all possible variations of the secure function
DROP FUNCTION IF EXISTS upsert_user_profile_secure(text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS upsert_user_profile_secure(text);
DROP FUNCTION IF EXISTS upsert_user_profile_secure();

-- Also drop any other variations that might exist
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT proname, oidvectortypes(proargtypes) as argtypes
             FROM pg_proc 
             WHERE proname = 'upsert_user_profile_secure'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.proname || '(' || r.argtypes || ')';
    END LOOP;
END$$;

-- Add a comment to indicate this migration cleans up function conflicts
COMMENT ON SCHEMA public IS 'Cleaned up upsert_user_profile_secure function conflicts at 20250727234500';