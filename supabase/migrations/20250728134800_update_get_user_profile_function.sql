-- Migration: Update get_user_profile function to include all profile fields
-- Created: 2025-07-28 13:48:00 UTC
-- Description: Updates get_user_profile function to return debug_mode, notifications_enabled, and social media fields

-- Drop and recreate the get_user_profile function with all current fields
DROP FUNCTION IF EXISTS get_user_profile(TEXT);

CREATE OR REPLACE FUNCTION get_user_profile(wallet_addr TEXT)
RETURNS TABLE (
    id UUID,
    wallet_address TEXT,
    nickname TEXT,
    avatar_url TEXT,
    bio TEXT,
    twitter_handle TEXT,
    discord_handle TEXT,
    website_url TEXT,
    notifications_enabled BOOLEAN,
    debug_mode BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        up.id,
        up.wallet_address,
        up.nickname,
        up.avatar_url,
        up.bio,
        up.twitter_handle,
        up.discord_handle,
        up.website_url,
        up.notifications_enabled,
        up.debug_mode,
        up.created_at,
        up.updated_at
    FROM user_profiles up
    WHERE up.wallet_address = LOWER(wallet_addr);
END;
$$ LANGUAGE plpgsql;

-- Update function comment
COMMENT ON FUNCTION get_user_profile(TEXT) IS 'Retrieves complete user profile by wallet address including debug_mode, notifications, and social media fields';