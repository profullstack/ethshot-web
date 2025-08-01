-- Fix Player Statistics for Wallet Addresses Without Usernames
-- 
-- This migration creates functions to update player statistics based on shots
-- without requiring user profiles or usernames, ensuring all wallet addresses
-- appear in leaderboards regardless of profile status.

-- Create a function to automatically update player statistics from shots
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
        MAX(timestamp) as last_shot_time
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
        COALESCE(NEW.contract_address, OLD.contract_address),
        NOW(),
        NOW()
    )
    ON CONFLICT (address) DO UPDATE SET
        total_shots = EXCLUDED.total_shots,
        total_spent = EXCLUDED.total_spent,
        total_won = EXCLUDED.total_won,
        last_shot_time = EXCLUDED.last_shot_time,
        crypto_type = EXCLUDED.crypto_type,
        contract_address = EXCLUDED.contract_address,
        updated_at = NOW();
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to automatically update player stats when shots are inserted/updated
DROP TRIGGER IF EXISTS trigger_update_player_stats ON shots;
CREATE TRIGGER trigger_update_player_stats
    AFTER INSERT OR UPDATE OR DELETE ON shots
    FOR EACH ROW
    EXECUTE FUNCTION update_player_stats_from_shots();

-- Create a function to manually refresh all player statistics
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
            contract_address = EXCLUDED.contract_address,
            updated_at = NOW();
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_player_stats_from_shots TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_player_stats TO authenticated;

-- Run initial refresh to populate player stats from existing shots
SELECT refresh_all_player_stats();

-- Add comments for documentation
COMMENT ON FUNCTION update_player_stats_from_shots IS 'Automatically updates player statistics when shots are modified';
COMMENT ON FUNCTION refresh_all_player_stats IS 'Manually refreshes all player statistics from shots data';
COMMENT ON TRIGGER trigger_update_player_stats ON shots IS 'Automatically maintains player statistics based on shots';