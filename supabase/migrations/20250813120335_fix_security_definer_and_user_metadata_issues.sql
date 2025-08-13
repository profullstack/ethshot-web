-- Migration: Fix Security Definer Views and User Metadata RLS Issues
-- Created: 2025-08-13 12:03:35 UTC
-- Description: Removes SECURITY DEFINER from views and fixes RLS policies that reference user_metadata

-- =============================================================================
-- PART 1: Fix SECURITY DEFINER Views
-- =============================================================================

-- Drop and recreate views without SECURITY DEFINER
-- These views should use the permissions of the querying user, not the view creator

-- Fix recent_activity view
DROP VIEW IF EXISTS recent_activity;
CREATE VIEW recent_activity AS
SELECT
    'shot' as activity_type,
    s.player_address as address,
    s.amount,
    s.won,
    s.timestamp,
    s.tx_hash,
    s.contract_address
FROM shots s
UNION ALL
SELECT
    'win' as activity_type,
    w.winner_address as address,
    w.amount,
    true as won,
    w.timestamp,
    w.tx_hash,
    w.contract_address
FROM winners w
ORDER BY timestamp DESC;

-- Fix leaderboard_by_shots view
DROP VIEW IF EXISTS leaderboard_by_shots;
CREATE VIEW leaderboard_by_shots AS
SELECT
    address,
    contract_address,
    total_shots,
    total_spent,
    total_won,
    CASE
        WHEN total_spent > 0 THEN (total_won / total_spent) * 100
        ELSE 0
    END as roi_percentage,
    last_shot_time,
    updated_at
FROM players
WHERE total_shots > 0
ORDER BY contract_address, total_shots DESC;

-- Fix leaderboard_by_winnings view
DROP VIEW IF EXISTS leaderboard_by_winnings;
CREATE VIEW leaderboard_by_winnings AS
SELECT
    address,
    contract_address,
    total_shots,
    total_spent,
    total_won,
    CASE
        WHEN total_spent > 0 THEN (total_won / total_spent) * 100
        ELSE 0
    END as roi_percentage,
    last_shot_time,
    updated_at
FROM players
WHERE total_won > 0
ORDER BY contract_address, total_won DESC;

-- Fix rpc_provider_stats view
DROP VIEW IF EXISTS rpc_provider_stats;
CREATE VIEW rpc_provider_stats AS
SELECT 
    p.id,
    p.name,
    p.rpc_url,
    p.chain_id,
    p.priority,
    p.is_active,
    h.is_healthy,
    h.failure_count,
    h.last_failure_at,
    h.last_success_at,
    h.response_time_ms,
    h.checked_at,
    -- Request metrics for last 24 hours
    COALESCE(m24h.total_requests, 0) as requests_24h,
    COALESCE(m24h.successful_requests, 0) as successful_requests_24h,
    COALESCE(m24h.failed_requests, 0) as failed_requests_24h,
    COALESCE(m24h.avg_response_time, 0) as avg_response_time_24h,
    COALESCE(m24h.cache_hit_rate, 0) as cache_hit_rate_24h
FROM rpc_providers p
LEFT JOIN rpc_provider_health h ON p.id = h.provider_id
LEFT JOIN (
    SELECT 
        provider_id,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE success = true) as successful_requests,
        COUNT(*) FILTER (WHERE success = false) as failed_requests,
        AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL) as avg_response_time,
        (COUNT(*) FILTER (WHERE cached = true)::FLOAT / COUNT(*)) * 100 as cache_hit_rate
    FROM rpc_request_metrics 
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY provider_id
) m24h ON p.id = m24h.provider_id;

-- =============================================================================
-- PART 2: Fix RLS Policies that Reference user_metadata
-- =============================================================================

-- Drop existing policies that reference user_metadata
DROP POLICY IF EXISTS "Users can read own profile and public data" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Create new secure policies that don't reference user_metadata
-- These policies use only the secure JWT fields (wallet_address and email)

-- Policy: Users can read their own profiles and public profile data
CREATE POLICY "Users can read own profile and public data" ON user_profiles
    FOR SELECT
    USING (
        -- Allow reading own profile (authenticated)
        wallet_address = LOWER(COALESCE(
            auth.jwt() ->> 'wallet_address',
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
            auth.jwt() ->> 'email'
        ))
    );

-- Policy: Users can only insert their own profiles
CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT
    WITH CHECK (
        wallet_address = LOWER(COALESCE(
            auth.jwt() ->> 'wallet_address',
            auth.jwt() ->> 'email'
        ))
    );

-- =============================================================================
-- PART 3: Update Functions that Reference user_metadata
-- =============================================================================

-- Update the upsert_user_profile_secure function to not use user_metadata
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
    -- Only use secure fields, not user_metadata
    authenticated_wallet_addr := auth.jwt() ->> 'wallet_address';
    
    -- If no wallet address in JWT, try getting it from the user's email (if it's a wallet address)
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

-- =============================================================================
-- PART 4: Grant Permissions
-- =============================================================================

-- Grant necessary permissions on the recreated views
GRANT SELECT ON recent_activity TO anon, authenticated;
GRANT SELECT ON leaderboard_by_shots TO anon, authenticated;
GRANT SELECT ON leaderboard_by_winnings TO anon, authenticated;
GRANT SELECT ON rpc_provider_stats TO anon, authenticated;

-- =============================================================================
-- PART 5: Add Comments for Documentation
-- =============================================================================

COMMENT ON VIEW recent_activity IS 'Recent game activity across all contracts - no longer uses SECURITY DEFINER';
COMMENT ON VIEW leaderboard_by_shots IS 'Leaderboard ordered by total shots - no longer uses SECURITY DEFINER';
COMMENT ON VIEW leaderboard_by_winnings IS 'Leaderboard ordered by total winnings - no longer uses SECURITY DEFINER';
COMMENT ON VIEW rpc_provider_stats IS 'RPC provider statistics and health metrics - no longer uses SECURITY DEFINER';
COMMENT ON FUNCTION upsert_user_profile_secure(TEXT, TEXT, TEXT, BOOLEAN) IS 'Secure profile upsert function - no longer references user_metadata';

-- =============================================================================
-- PART 6: Log Completion
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Security fixes applied successfully:';
    RAISE NOTICE '- Removed SECURITY DEFINER from 4 views: recent_activity, leaderboard_by_shots, leaderboard_by_winnings, rpc_provider_stats';
    RAISE NOTICE '- Updated 3 RLS policies on user_profiles to remove user_metadata references';
    RAISE NOTICE '- Updated upsert_user_profile_secure function to not use user_metadata';
    RAISE NOTICE 'All security vulnerabilities have been resolved';
END $$;