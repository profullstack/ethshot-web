-- Fix wallet_address column ambiguity in upsert_user_profile function
-- This migration addresses the "column reference 'wallet_address' is ambiguous" error
-- by using completely unambiguous parameter names and explicit table references

-- Drop the existing function that has ambiguity issues
DROP FUNCTION IF EXISTS upsert_user_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN);

-- Recreate the function with unambiguous parameter names and explicit INSERT/UPDATE pattern
CREATE OR REPLACE FUNCTION upsert_user_profile(
    wallet_addr_param TEXT,
    nickname_param TEXT DEFAULT NULL,
    avatar_url_param TEXT DEFAULT NULL,
    bio_param TEXT DEFAULT NULL,
    notifications_param BOOLEAN DEFAULT true
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
    normalized_wallet TEXT := LOWER(wallet_addr_param);
    profile_exists BOOLEAN;
BEGIN
    -- Check if profile exists
    SELECT EXISTS(
        SELECT 1 FROM user_profiles AS up 
        WHERE up.wallet_address = normalized_wallet
    ) INTO profile_exists;
    
    IF profile_exists THEN
        -- Update existing profile
        UPDATE user_profiles AS up SET
            nickname = COALESCE(nickname_param, up.nickname),
            avatar_url = COALESCE(avatar_url_param, up.avatar_url),
            bio = COALESCE(bio_param, up.bio),
            notifications_enabled = COALESCE(notifications_param, up.notifications_enabled),
            updated_at = NOW()
        WHERE up.wallet_address = normalized_wallet;
    ELSE
        -- Insert new profile
        INSERT INTO user_profiles (wallet_address, nickname, avatar_url, bio, notifications_enabled)
        VALUES (normalized_wallet, nickname_param, avatar_url_param, bio_param, notifications_param);
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
    WHERE profiles.wallet_address = normalized_wallet;
END;
$$ LANGUAGE plpgsql;

-- Add function comment
COMMENT ON FUNCTION upsert_user_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN) IS 'Creates or updates user profile using explicit INSERT/UPDATE pattern to eliminate wallet_address column ambiguity';