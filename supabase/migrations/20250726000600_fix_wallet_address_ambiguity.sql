-- Fix wallet_address column ambiguity in database functions
-- This migration addresses the "column reference 'wallet_address' is ambiguous" error

-- Drop and recreate the get_user_profile function to include notifications_enabled
DROP FUNCTION IF EXISTS get_user_profile(TEXT);

CREATE FUNCTION get_user_profile(wallet_addr TEXT)
RETURNS TABLE (
    id UUID,
    wallet_address TEXT,
    nickname TEXT,
    avatar_url TEXT,
    bio TEXT,
    notifications_enabled BOOLEAN,
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
        up.notifications_enabled,
        up.created_at,
        up.updated_at
    FROM user_profiles up
    WHERE up.wallet_address = LOWER(wallet_addr);
END;
$$ LANGUAGE plpgsql;

-- Update the nickname availability function (renamed from username to nickname)
CREATE OR REPLACE FUNCTION is_nickname_available(p_nickname TEXT, exclude_wallet_addr TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    nickname_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO nickname_count
    FROM user_profiles up
    WHERE up.nickname = p_nickname
    AND (exclude_wallet_addr IS NULL OR up.wallet_address != LOWER(exclude_wallet_addr));
    
    RETURN nickname_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Drop the old username availability function since we removed username field
DROP FUNCTION IF EXISTS is_username_available(TEXT, TEXT);

-- Fix the upsert_user_profile function to resolve wallet_address ambiguity
DROP FUNCTION IF EXISTS upsert_user_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION upsert_user_profile(
    p_wallet_address TEXT,
    p_nickname TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT NULL,
    p_notifications_enabled BOOLEAN DEFAULT true
)
RETURNS TABLE (
    id UUID,
    wallet_address TEXT,
    nickname TEXT,
    avatar_url TEXT,
    bio TEXT,
    notifications_enabled BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Insert or update the user profile
    INSERT INTO user_profiles (wallet_address, nickname, avatar_url, bio, notifications_enabled)
    VALUES (LOWER(p_wallet_address), p_nickname, p_avatar_url, p_bio, p_notifications_enabled)
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        nickname = COALESCE(EXCLUDED.nickname, user_profiles.nickname),
        avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
        bio = COALESCE(EXCLUDED.bio, user_profiles.bio),
        notifications_enabled = COALESCE(EXCLUDED.notifications_enabled, user_profiles.notifications_enabled),
        updated_at = NOW();

    -- Return the updated profile with proper table aliases
    RETURN QUERY
    SELECT
        up.id,
        up.wallet_address,
        up.nickname,
        up.avatar_url,
        up.bio,
        up.notifications_enabled,
        up.created_at,
        up.updated_at
    FROM user_profiles up
    WHERE up.wallet_address = LOWER(p_wallet_address);
END;
$$ LANGUAGE plpgsql;

-- Update comments
COMMENT ON FUNCTION get_user_profile(TEXT) IS 'Retrieves user profile by wallet address including notification preferences';
COMMENT ON FUNCTION is_nickname_available(TEXT, TEXT) IS 'Checks if nickname is available (nicknames are unique)';
COMMENT ON FUNCTION upsert_user_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN) IS 'Creates or updates user profile with proper wallet_address handling';