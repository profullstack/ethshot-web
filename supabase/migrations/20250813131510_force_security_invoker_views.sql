-- Migration: Force SECURITY INVOKER on Views
-- Created: 2025-08-13 13:15:10 UTC
-- Description: Explicitly set SECURITY INVOKER on all views to override any SECURITY DEFINER defaults

-- =============================================================================
-- PART 1: Drop and recreate views with explicit SECURITY INVOKER
-- =============================================================================

-- Drop existing views first
DROP VIEW IF EXISTS recent_activity;
DROP VIEW IF EXISTS leaderboard_by_shots;
DROP VIEW IF EXISTS leaderboard_by_winnings;
DROP VIEW IF EXISTS rpc_provider_stats;

-- Recreate recent_activity view with explicit SECURITY INVOKER
CREATE VIEW recent_activity
WITH (security_invoker = true)
AS
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

-- Recreate leaderboard_by_shots view with explicit SECURITY INVOKER
CREATE VIEW leaderboard_by_shots
WITH (security_invoker = true)
AS
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

-- Recreate leaderboard_by_winnings view with explicit SECURITY INVOKER
CREATE VIEW leaderboard_by_winnings
WITH (security_invoker = true)
AS
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

-- Recreate rpc_provider_stats view with explicit SECURITY INVOKER
CREATE VIEW rpc_provider_stats
WITH (security_invoker = true)
AS
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
-- PART 2: Grant appropriate permissions
-- =============================================================================

-- Grant SELECT permissions to authenticated users
GRANT SELECT ON recent_activity TO authenticated;
GRANT SELECT ON leaderboard_by_shots TO authenticated;
GRANT SELECT ON leaderboard_by_winnings TO authenticated;
GRANT SELECT ON rpc_provider_stats TO authenticated;

-- Grant SELECT permissions to anon users for public leaderboards
GRANT SELECT ON leaderboard_by_shots TO anon;
GRANT SELECT ON leaderboard_by_winnings TO anon;
GRANT SELECT ON recent_activity TO anon;

-- =============================================================================
-- PART 3: Verification comments
-- =============================================================================

-- The following views now explicitly use SECURITY INVOKER:
-- 1. recent_activity - Shows recent game activity (shots and wins)
-- 2. leaderboard_by_shots - Leaderboard ordered by total shots played
-- 3. leaderboard_by_winnings - Leaderboard ordered by total winnings
-- 4. rpc_provider_stats - Statistics about RPC provider performance
--
-- All views execute with the permissions of the querying user (SECURITY INVOKER)
-- rather than the permissions of the view creator (SECURITY DEFINER).
-- This ensures proper Row Level Security (RLS) enforcement.