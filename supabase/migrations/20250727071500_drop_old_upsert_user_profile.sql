-- Migration: Drop old upsert_user_profile function
-- Created: 2025-07-27 07:15 UTC
-- Description: Removes the legacy upsert_user_profile function (use upsert_user_profile_secure instead)

DROP FUNCTION IF EXISTS upsert_user_profile(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS upsert_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT);

-- No changes to upsert_user_profile_secure
