-- Migration: Restore upsert_user_profile function for custom JWT authentication
-- Created: 2025-07-27 23:37 UTC
-- Description: Restores the regular upsert_user_profile function to work with our custom JWT system
-- The secure version expects Supabase-signed JWTs, but we use custom wallet-based JWTs

-- Recreate the regular upsert_user_profile function
-- This function accepts wallet_addr as a parameter (validated by our JWT system)
CREATE OR REPLACE FUNCTION upsert_user_profile(
    wallet_addr TEXT,
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
DECLARE
    normalized_wallet_addr TEXT := LOWER(wallet_addr);
    profile_exists BOOLEAN;
BEGIN
    -- Check if profile exists
    SELECT EXISTS(
        SELECT 1 FROM user_profiles AS up 
        WHERE up.wallet_address = normalized_wallet_addr
    ) INTO profile_exists;
    
    IF profile_exists THEN
        -- Update existing profile
        UPDATE user_profiles AS up SET
            nickname = COALESCE(p_nickname, up.nickname),
            avatar_url = COALESCE(p_avatar_url, up.avatar_url),
            bio = COALESCE(p_bio, up.bio),
            notifications_enabled = COALESCE(p_notifications_enabled, up.notifications_enabled),
            updated_at = NOW()
        WHERE up.wallet_address = normalized_wallet_addr;
    ELSE
        -- Insert new profile
        INSERT INTO user_profiles (wallet_address, nickname, avatar_url, bio, notifications_enabled)
        VALUES (normalized_wallet_addr, p_nickname, p_avatar_url, p_bio, p_notifications_enabled);
    END IF;

    -- Return the updated/inserted profile
    RETURN QUERY
    SELECT
        profiles.id,
        profiles.wallet_address,
        profiles.nickname,
        profiles.avatar_url,
        profiles.bio,
        profiles.notifications_enabled,
        profiles.created_at,
        profiles.updated_at
    FROM user_profiles AS profiles
    WHERE profiles.wallet_address = normalized_wallet_addr;
END;
$$ LANGUAGE plpgsql;

-- Add function comment
COMMENT ON FUNCTION upsert_user_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN) IS 'Creates or updates user profile using wallet address parameter (validated by custom JWT system)';