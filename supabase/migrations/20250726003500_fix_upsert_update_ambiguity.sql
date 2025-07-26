-- Fix remaining ambiguity in upsert_user_profile UPDATE clause
-- The ON CONFLICT DO UPDATE SET clause needs proper table qualification

-- Drop the function with ambiguous UPDATE clause
DROP FUNCTION IF EXISTS upsert_user_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN);

-- Create function with fully qualified column references in UPDATE
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
BEGIN
    -- Insert or update the user profile with fully qualified column references
    INSERT INTO user_profiles (wallet_address, nickname, avatar_url, bio, notifications_enabled)
    VALUES (LOWER(wallet_addr), p_nickname, p_avatar_url, p_bio, p_notifications_enabled)
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
    WHERE up.wallet_address = LOWER(wallet_addr);
END;
$$ LANGUAGE plpgsql;

-- Add function comment
COMMENT ON FUNCTION upsert_user_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN) IS 'Creates or updates user profile with fully qualified column references to prevent ambiguity';