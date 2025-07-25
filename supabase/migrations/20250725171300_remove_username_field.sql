-- Migration: Remove Username Field
-- Created: 2025-07-25 17:13:00 UTC
-- Description: Removes username field from user_profiles table and related functions

-- Drop the username availability function since we no longer need it
DROP FUNCTION IF EXISTS is_username_available(TEXT, TEXT);

-- Drop the unique index on username
DROP INDEX IF EXISTS idx_user_profiles_username;

-- Remove the username column from user_profiles table
ALTER TABLE user_profiles DROP COLUMN IF EXISTS username;

-- Drop existing functions to recreate with new signatures
DROP FUNCTION IF EXISTS get_user_profile(TEXT);
DROP FUNCTION IF EXISTS upsert_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT);

-- Recreate the get_user_profile function without username
CREATE OR REPLACE FUNCTION get_user_profile(wallet_addr TEXT)
RETURNS TABLE (
    id UUID,
    wallet_address TEXT,
    nickname TEXT,
    avatar_url TEXT,
    bio TEXT,
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
        up.created_at,
        up.updated_at
    FROM user_profiles up
    WHERE up.wallet_address = LOWER(wallet_addr);
END;
$$ LANGUAGE plpgsql;

-- Recreate the upsert_user_profile function without username
CREATE OR REPLACE FUNCTION upsert_user_profile(
    wallet_addr TEXT,
    p_nickname TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    wallet_address TEXT,
    nickname TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    existing_profile user_profiles%ROWTYPE;
BEGIN
    -- Check if profile exists
    SELECT * INTO existing_profile FROM user_profiles WHERE user_profiles.wallet_address = LOWER(wallet_addr);
    
    IF existing_profile.id IS NOT NULL THEN
        -- Update existing profile
        UPDATE user_profiles SET
            nickname = COALESCE(p_nickname, user_profiles.nickname),
            avatar_url = COALESCE(p_avatar_url, user_profiles.avatar_url),
            bio = COALESCE(p_bio, user_profiles.bio),
            updated_at = NOW()
        WHERE user_profiles.wallet_address = LOWER(wallet_addr);
    ELSE
        -- Insert new profile
        INSERT INTO user_profiles (wallet_address, nickname, avatar_url, bio)
        VALUES (LOWER(wallet_addr), p_nickname, p_avatar_url, p_bio);
    END IF;
    
    -- Return the updated/inserted profile
    RETURN QUERY
    SELECT
        up.id,
        up.wallet_address,
        up.nickname,
        up.avatar_url,
        up.bio,
        up.created_at,
        up.updated_at
    FROM user_profiles up
    WHERE up.wallet_address = LOWER(wallet_addr);
END;
$$ LANGUAGE plpgsql;

-- Update function comments
COMMENT ON FUNCTION get_user_profile(TEXT) IS 'Retrieves user profile by wallet address';
COMMENT ON FUNCTION upsert_user_profile(TEXT, TEXT, TEXT, TEXT) IS 'Creates or updates user profile (nickname, avatar, bio only)';