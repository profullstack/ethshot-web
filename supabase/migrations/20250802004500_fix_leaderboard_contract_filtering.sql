-- Fix Leaderboard Contract Address Filtering Issues
-- 
-- This migration addresses issues where player stats don't appear on leaderboards
-- due to contract address filtering problems or synchronization issues.

-- First, let's check if there are any players with NULL contract addresses
-- and update the refresh function to handle this case better

-- Update the refresh_all_player_stats function to be more robust
CREATE OR REPLACE FUNCTION refresh_all_player_stats()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    updated_count INTEGER := 0;
    player_record RECORD;
BEGIN
    -- Loop through all unique player addresses in shots table
    FOR player_record IN 
        SELECT DISTINCT player_address FROM shots
    LOOP
        -- Calculate and update stats for each player
        INSERT INTO players (
            address,
            total_shots,
            total_spent,
            total_won,
            last_shot_time,
            crypto_type,
            contract_address,
            created_at,
            updated_at
        )
        SELECT
            player_record.player_address,
            COUNT(*),
            COALESCE(SUM(amount::decimal), 0),
            COALESCE(SUM(CASE WHEN won THEN amount::decimal ELSE 0 END), 0),
            MAX(timestamp),
            COALESCE(MAX(crypto_type), 'ETH'),
            -- Use the most recent contract_address, or NULL if none
            MAX(contract_address),
            NOW(),
            NOW()
        FROM shots 
        WHERE player_address = player_record.player_address
        ON CONFLICT (address) DO UPDATE SET
            total_shots = EXCLUDED.total_shots,
            total_spent = EXCLUDED.total_spent,
            total_won = EXCLUDED.total_won,
            last_shot_time = EXCLUDED.last_shot_time,
            crypto_type = EXCLUDED.crypto_type,
            contract_address = COALESCE(EXCLUDED.contract_address, players.contract_address),
            updated_at = NOW();
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$;

-- Update the trigger function to be more robust as well
CREATE OR REPLACE FUNCTION update_player_stats_from_shots()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    player_stats RECORD;
BEGIN
    -- Calculate stats for the player from all their shots
    SELECT 
        COUNT(*) as total_shots,
        COALESCE(SUM(amount::decimal), 0) as total_spent,
        COALESCE(SUM(CASE WHEN won THEN amount::decimal ELSE 0 END), 0) as total_won,
        MAX(timestamp) as last_shot_time,
        MAX(contract_address) as latest_contract_address
    INTO player_stats
    FROM shots 
    WHERE player_address = COALESCE(NEW.player_address, OLD.player_address);
    
    -- Upsert player record with calculated stats
    INSERT INTO players (
        address,
        total_shots,
        total_spent,
        total_won,
        last_shot_time,
        crypto_type,
        contract_address,
        created_at,
        updated_at
    )
    VALUES (
        COALESCE(NEW.player_address, OLD.player_address),
        player_stats.total_shots,
        player_stats.total_spent,
        player_stats.total_won,
        player_stats.last_shot_time,
        COALESCE(NEW.crypto_type, OLD.crypto_type, 'ETH'),
        COALESCE(player_stats.latest_contract_address, NEW.contract_address, OLD.contract_address),
        NOW(),
        NOW()
    )
    ON CONFLICT (address) DO UPDATE SET
        total_shots = EXCLUDED.total_shots,
        total_spent = EXCLUDED.total_spent,
        total_won = EXCLUDED.total_won,
        last_shot_time = EXCLUDED.last_shot_time,
        crypto_type = EXCLUDED.crypto_type,
        contract_address = COALESCE(EXCLUDED.contract_address, players.contract_address),
        updated_at = NOW();
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate the trigger to use the updated function
DROP TRIGGER IF EXISTS trigger_update_player_stats ON shots;
CREATE TRIGGER trigger_update_player_stats
    AFTER INSERT OR UPDATE OR DELETE ON shots
    FOR EACH ROW
    EXECUTE FUNCTION update_player_stats_from_shots();

-- Create a function to get top players with more flexible contract filtering
CREATE OR REPLACE FUNCTION get_top_players_flexible(
    player_limit INTEGER DEFAULT 50,
    order_by_field TEXT DEFAULT 'total_shots',
    filter_contract_address TEXT DEFAULT NULL
)
RETURNS TABLE (
    address TEXT,
    total_shots INTEGER,
    total_spent DECIMAL,
    total_won DECIMAL,
    last_shot_time TIMESTAMP WITH TIME ZONE,
    crypto_type TEXT,
    contract_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- If no contract address filter is provided, return all players
    -- If a contract address is provided, filter by it, but also include players with NULL contract_address
    -- This ensures backward compatibility and catches players who might have been recorded before contract tracking
    
    IF filter_contract_address IS NULL OR filter_contract_address = '' THEN
        -- No filtering, return all players
        RETURN QUERY
        SELECT 
            p.address,
            p.total_shots,
            p.total_spent,
            p.total_won,
            p.last_shot_time,
            p.crypto_type,
            p.contract_address,
            p.created_at,
            p.updated_at
        FROM players p
        WHERE p.total_shots > 0  -- Only include players who have actually taken shots
        ORDER BY 
            CASE 
                WHEN order_by_field = 'total_shots' THEN p.total_shots
                WHEN order_by_field = 'total_spent' THEN p.total_spent::INTEGER
                WHEN order_by_field = 'total_won' THEN p.total_won::INTEGER
                ELSE p.total_shots
            END DESC
        LIMIT player_limit;
    ELSE
        -- Filter by contract address, but include NULL addresses for backward compatibility
        RETURN QUERY
        SELECT 
            p.address,
            p.total_shots,
            p.total_spent,
            p.total_won,
            p.last_shot_time,
            p.crypto_type,
            p.contract_address,
            p.created_at,
            p.updated_at
        FROM players p
        WHERE p.total_shots > 0  -- Only include players who have actually taken shots
        AND (p.contract_address = filter_contract_address OR p.contract_address IS NULL)
        ORDER BY 
            CASE 
                WHEN order_by_field = 'total_shots' THEN p.total_shots
                WHEN order_by_field = 'total_spent' THEN p.total_spent::INTEGER
                WHEN order_by_field = 'total_won' THEN p.total_won::INTEGER
                ELSE p.total_shots
            END DESC
        LIMIT player_limit;
    END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION refresh_all_player_stats TO authenticated;
GRANT EXECUTE ON FUNCTION update_player_stats_from_shots TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_players_flexible TO authenticated, anon;

-- Run a comprehensive refresh to ensure all existing data is properly synchronized
SELECT refresh_all_player_stats();

-- Add helpful comments
COMMENT ON FUNCTION refresh_all_player_stats IS 'Refreshes all player statistics from shots data with improved contract address handling';
COMMENT ON FUNCTION update_player_stats_from_shots IS 'Automatically updates player statistics when shots are modified with better contract address logic';
COMMENT ON FUNCTION get_top_players_flexible IS 'Gets top players with flexible contract address filtering for backward compatibility';

-- Create an index on players.total_shots for better leaderboard performance
CREATE INDEX IF NOT EXISTS idx_players_total_shots_desc ON players (total_shots DESC) WHERE total_shots > 0;
CREATE INDEX IF NOT EXISTS idx_players_contract_address ON players (contract_address) WHERE contract_address IS NOT NULL;

-- Log the completion
DO $$
BEGIN
    RAISE NOTICE 'Leaderboard contract filtering fix completed successfully';
END $$;