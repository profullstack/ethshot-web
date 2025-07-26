-- Security Fix: Add server-side ownership validation for profile updates
-- This migration creates a secure version of upsert_user_profile that uses authentication
-- instead of trusting client-provided wallet addresses

-- Create a secure version of the upsert_user_profile function
-- This function gets the wallet address from the authenticated user's JWT token
-- instead of accepting it as a parameter from the client
CREATE OR REPLACE FUNCTION upsert_user_profile_secure(
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
    authenticated_wallet_addr TEXT;
    normalized_wallet_addr TEXT;
    profile_exists BOOLEAN;
BEGIN
    -- Get the wallet address from the authenticated user's JWT token
    -- This assumes the wallet address is stored in the JWT as 'wallet_address'
    authenticated_wallet_addr := auth.jwt() ->> 'wallet_address';
    
    -- If no wallet address in JWT, check if it's in the user metadata
    IF authenticated_wallet_addr IS NULL THEN
        authenticated_wallet_addr := (auth.jwt() -> 'user_metadata' ->> 'wallet_address');
    END IF;
    
    -- If still no wallet address, try getting it from the user's email (if it's a wallet address)
    IF authenticated_wallet_addr IS NULL THEN
        authenticated_wallet_addr := auth.jwt() ->> 'email';
        -- Validate that it looks like a wallet address (starts with 0x and is 42 chars)
        IF authenticated_wallet_addr IS NULL OR 
           NOT (authenticated_wallet_addr ~ '^0x[a-fA-F0-9]{40}$') THEN
            authenticated_wallet_addr := NULL;
        END IF;
    END IF;
    
    -- If we still don't have a wallet address, raise an error
    IF authenticated_wallet_addr IS NULL THEN
        RAISE EXCEPTION 'No authenticated wallet address found. User must be authenticated with a valid wallet address.';
    END IF;
    
    -- Normalize the wallet address
    normalized_wallet_addr := LOWER(authenticated_wallet_addr);
    
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS (Row Level Security) policies to user_profiles table if not already present
-- This provides an additional layer of security

-- Enable RLS on user_profiles table
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own profiles and public profile data
CREATE POLICY "Users can read own profile and public data" ON user_profiles
    FOR SELECT
    USING (
        -- Allow reading own profile (authenticated)
        wallet_address = LOWER(COALESCE(
            auth.jwt() ->> 'wallet_address',
            auth.jwt() -> 'user_metadata' ->> 'wallet_address',
            auth.jwt() ->> 'email'
        ))
        OR
        -- Allow reading public profile data (nickname, avatar_url, bio) for all users
        -- This is needed for displaying user profiles publicly
        true
    );

-- Policy: Users can only update their own profiles
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE
    USING (
        wallet_address = LOWER(COALESCE(
            auth.jwt() ->> 'wallet_address',
            auth.jwt() -> 'user_metadata' ->> 'wallet_address',
            auth.jwt() ->> 'email'
        ))
    );

-- Policy: Users can only insert their own profiles
CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT
    WITH CHECK (
        wallet_address = LOWER(COALESCE(
            auth.jwt() ->> 'wallet_address',
            auth.jwt() -> 'user_metadata' ->> 'wallet_address',
            auth.jwt() ->> 'email'
        ))
    );

-- Add function comment
COMMENT ON FUNCTION upsert_user_profile_secure(TEXT, TEXT, TEXT, BOOLEAN) IS 'Secure version of upsert_user_profile that uses authenticated user wallet address instead of client-provided address. Prevents unauthorized profile modifications.';

-- Note: The old upsert_user_profile function is kept for backward compatibility
-- but should be migrated to use the secure version. Consider deprecating it in future migrations.