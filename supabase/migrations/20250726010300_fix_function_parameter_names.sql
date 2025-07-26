-- Fix function parameter names to match application expectations
-- This migration addresses the function signature mismatch error

-- Drop the function with incorrect parameter names
DROP FUNCTION IF EXISTS upsert_user_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN);

-- Recreate the function with the original parameter names but fixed ambiguity
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
COMMENT ON FUNCTION upsert_user_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN) IS 'Creates or updates user profile using explicit INSERT/UPDATE pattern with original parameter names to eliminate wallet_address column ambiguity';