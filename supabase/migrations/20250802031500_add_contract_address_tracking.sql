-- Add Contract Address Tracking to All Tables
-- 
-- This migration ensures all game data is properly associated with specific contract addresses
-- to prevent data contamination when multiple developers use different contracts with the same database.

-- Add contract_address column to players table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' AND column_name = 'contract_address'
    ) THEN
        ALTER TABLE players ADD COLUMN contract_address TEXT;
        CREATE INDEX IF NOT EXISTS idx_players_contract_address ON players(contract_address);
    END IF;
END $$;

-- Add contract_address column to game_stats table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_stats' AND column_name = 'contract_address'
    ) THEN
        ALTER TABLE game_stats ADD COLUMN contract_address TEXT;
        CREATE INDEX IF NOT EXISTS idx_game_stats_contract_address ON game_stats(contract_address);
    END IF;
END $$;

-- Update the game_stats table structure to support multiple contracts
-- Remove the single row constraint and make it contract-specific
DO $$
BEGIN
    -- Drop the old constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'game_stats' AND constraint_name = 'single_row'
    ) THEN
        ALTER TABLE game_stats DROP CONSTRAINT single_row;
    END IF;
    
    -- Add new constraint for unique contract addresses
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'game_stats' AND constraint_name = 'unique_contract_stats'
    ) THEN
        ALTER TABLE game_stats ADD CONSTRAINT unique_contract_stats UNIQUE (contract_address);
    END IF;
END $$;

-- Handle trigger dependencies - drop ALL triggers first, then functions, then recreate
DO $$
BEGIN
    -- Drop ALL possible triggers that might depend on functions we're updating
    DROP TRIGGER IF EXISTS trigger_update_player_stats ON shots;
    DROP TRIGGER IF EXISTS trigger_update_game_stats_on_shots ON shots;
    DROP TRIGGER IF EXISTS trigger_update_game_stats_on_winners ON winners;
    DROP TRIGGER IF EXISTS update_game_stats_trigger ON shots;
    DROP TRIGGER IF EXISTS update_game_stats_trigger ON winners;
    DROP TRIGGER IF EXISTS shots_update_stats ON shots;
    DROP TRIGGER IF EXISTS winners_update_stats ON winners;
    DROP TRIGGER IF EXISTS game_stats_update ON shots;
    DROP TRIGGER IF EXISTS game_stats_update ON winners;
END $$;

-- Drop all triggers that use trigger_update_game_stats function
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Find and drop all triggers that use the trigger_update_game_stats function
    FOR trigger_record IN
        SELECT t.trigger_name, t.event_object_table
        FROM information_schema.triggers t
        WHERE t.action_statement LIKE '%trigger_update_game_stats%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_record.trigger_name, trigger_record.event_object_table);
    END LOOP;
END $$;

-- Now we can safely drop and recreate the player stats trigger function
-- First, let's be more aggressive about dropping any remaining triggers that might depend on this function
DO $$
BEGIN
    -- Drop any remaining triggers that might depend on update_player_stats_from_shots
    DROP TRIGGER IF EXISTS update_player_stats_from_shots ON shots;
    
    -- Also drop any triggers with similar names
    DROP TRIGGER IF EXISTS player_stats_trigger ON shots;
    DROP TRIGGER IF EXISTS stats_trigger ON shots;
END $$;

-- Now drop the function with CASCADE to force removal of dependencies
DROP FUNCTION IF EXISTS update_player_stats_from_shots() CASCADE;

CREATE FUNCTION update_player_stats_from_shots()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    player_stats RECORD;
    target_contract_address TEXT;
BEGIN
    -- Get the contract address from the shot record
    target_contract_address := COALESCE(NEW.contract_address, OLD.contract_address);
    
    -- Calculate stats for the player from all their shots for this contract
    SELECT
        COUNT(*) as total_shots,
        COALESCE(SUM(amount::decimal), 0) as total_spent,
        COALESCE(SUM(CASE WHEN won THEN amount::decimal ELSE 0 END), 0) as total_won,
        MAX(timestamp) as last_shot_time
    INTO player_stats
    FROM shots
    WHERE player_address = COALESCE(NEW.player_address, OLD.player_address)
      AND (contract_address = target_contract_address OR (contract_address IS NULL AND target_contract_address IS NULL));
    
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
        target_contract_address,
        NOW(),
        NOW()
    )
    ON CONFLICT (address, contract_address) DO UPDATE SET
        total_shots = EXCLUDED.total_shots,
        total_spent = EXCLUDED.total_spent,
        total_won = EXCLUDED.total_won,
        last_shot_time = EXCLUDED.last_shot_time,
        crypto_type = EXCLUDED.crypto_type,
        updated_at = NOW();
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop and recreate the refresh all player stats function to be contract-aware
-- Use CASCADE to handle any dependencies
DROP FUNCTION IF EXISTS refresh_all_player_stats() CASCADE;

CREATE FUNCTION refresh_all_player_stats()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    updated_count INTEGER := 0;
    player_record RECORD;
BEGIN
    -- Loop through all unique player addresses and contract addresses in shots table
    FOR player_record IN
        SELECT DISTINCT player_address, contract_address FROM shots
    LOOP
        -- Calculate and update stats for each player per contract
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
            player_record.contract_address,
            NOW(),
            NOW()
        FROM shots
        WHERE player_address = player_record.player_address
          AND (contract_address = player_record.contract_address OR (contract_address IS NULL AND player_record.contract_address IS NULL))
        ON CONFLICT (address, contract_address) DO UPDATE SET
            total_shots = EXCLUDED.total_shots,
            total_spent = EXCLUDED.total_spent,
            total_won = EXCLUDED.total_won,
            last_shot_time = EXCLUDED.last_shot_time,
            crypto_type = EXCLUDED.crypto_type,
            updated_at = NOW();
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$;

-- Drop and recreate the game statistics function to be contract-aware
-- Use CASCADE to handle any dependencies
DROP FUNCTION IF EXISTS update_game_statistics(TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_game_statistics() CASCADE;

CREATE FUNCTION update_game_statistics(p_contract_address TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    -- If no contract address provided, update stats for all contracts
    IF p_contract_address IS NULL THEN
        -- Update stats for each contract separately
        INSERT INTO game_stats (
            contract_address,
            total_shots,
            total_players,
            total_pot_won,
            updated_at
        )
        SELECT
            COALESCE(s.contract_address, 'default') as contract_address,
            COUNT(s.id) as total_shots,
            COUNT(DISTINCT s.player_address) as total_players,
            COALESCE(SUM(w.amount), 0) as total_pot_won,
            NOW() as updated_at
        FROM shots s
        LEFT JOIN winners w ON w.contract_address = s.contract_address OR (w.contract_address IS NULL AND s.contract_address IS NULL)
        GROUP BY COALESCE(s.contract_address, 'default')
        ON CONFLICT (contract_address) DO UPDATE SET
            total_shots = EXCLUDED.total_shots,
            total_players = EXCLUDED.total_players,
            total_pot_won = EXCLUDED.total_pot_won,
            updated_at = EXCLUDED.updated_at;
    ELSE
        -- Update stats for specific contract
        INSERT INTO game_stats (
            contract_address,
            total_shots,
            total_players,
            total_pot_won,
            updated_at
        )
        SELECT
            p_contract_address,
            COUNT(s.id),
            COUNT(DISTINCT s.player_address),
            COALESCE(SUM(w.amount), 0),
            NOW()
        FROM shots s
        LEFT JOIN winners w ON w.contract_address = p_contract_address
        WHERE s.contract_address = p_contract_address OR (s.contract_address IS NULL AND p_contract_address = 'default')
        ON CONFLICT (contract_address) DO UPDATE SET
            total_shots = EXCLUDED.total_shots,
            total_players = EXCLUDED.total_players,
            total_pot_won = EXCLUDED.total_pot_won,
            updated_at = EXCLUDED.updated_at;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger function to be contract-aware
-- First, let's be more aggressive about dropping any remaining triggers that might depend on this function
DO $$
BEGIN
    -- Drop any remaining triggers that might depend on trigger_update_game_stats
    DROP TRIGGER IF EXISTS trigger_update_game_stats ON shots;
    DROP TRIGGER IF EXISTS trigger_update_game_stats ON winners;
    
    -- Also drop any triggers with similar names
    DROP TRIGGER IF EXISTS update_stats_trigger ON shots;
    DROP TRIGGER IF EXISTS update_stats_trigger ON winners;
    DROP TRIGGER IF EXISTS stats_update_trigger ON shots;
    DROP TRIGGER IF EXISTS stats_update_trigger ON winners;
END $$;

-- Now drop the function with CASCADE to force removal of dependencies
DROP FUNCTION IF EXISTS trigger_update_game_stats() CASCADE;

CREATE FUNCTION trigger_update_game_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_contract_address TEXT;
BEGIN
    -- Get contract address from the affected row
    target_contract_address := COALESCE(NEW.contract_address, OLD.contract_address, 'default');
    
    -- Update stats for the specific contract
    PERFORM update_game_statistics(target_contract_address);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers after functions are ready
DO $$
BEGIN
    -- Recreate player stats trigger
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'trigger_update_player_stats' AND event_object_table = 'shots'
    ) THEN
        CREATE TRIGGER trigger_update_player_stats
            AFTER INSERT OR UPDATE OR DELETE ON shots
            FOR EACH ROW EXECUTE FUNCTION update_player_stats_from_shots();
    END IF;
    
    -- Recreate game stats triggers
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'trigger_update_game_stats_on_shots' AND event_object_table = 'shots'
    ) THEN
        CREATE TRIGGER trigger_update_game_stats_on_shots
            AFTER INSERT OR UPDATE OR DELETE ON shots
            FOR EACH ROW EXECUTE FUNCTION trigger_update_game_stats();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'trigger_update_game_stats_on_winners' AND event_object_table = 'winners'
    ) THEN
        CREATE TRIGGER trigger_update_game_stats_on_winners
            AFTER INSERT OR UPDATE OR DELETE ON winners
            FOR EACH ROW EXECUTE FUNCTION trigger_update_game_stats();
    END IF;
END $$;

-- Drop existing views first to avoid column structure conflicts
DROP VIEW IF EXISTS leaderboard_by_shots;
DROP VIEW IF EXISTS leaderboard_by_winnings;
DROP VIEW IF EXISTS recent_activity;

-- Create contract-aware leaderboard views
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

-- Create contract-aware recent activity view
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

-- Drop and recreate player rank function to be contract-aware
-- Use CASCADE to handle any dependencies
DROP FUNCTION IF EXISTS get_player_rank(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_player_rank(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_player_rank(TEXT) CASCADE;

CREATE FUNCTION get_player_rank(
    player_address TEXT,
    rank_by TEXT DEFAULT 'total_shots',
    p_contract_address TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    player_rank INTEGER;
BEGIN
    IF rank_by = 'total_shots' THEN
        SELECT rank INTO player_rank
        FROM (
            SELECT address, RANK() OVER (ORDER BY total_shots DESC) as rank
            FROM players
            WHERE total_shots > 0
              AND (p_contract_address IS NULL OR contract_address = p_contract_address)
        ) ranked
        WHERE address = player_address;
    ELSIF rank_by = 'total_won' THEN
        SELECT rank INTO player_rank
        FROM (
            SELECT address, RANK() OVER (ORDER BY total_won DESC) as rank
            FROM players
            WHERE total_won > 0
              AND (p_contract_address IS NULL OR contract_address = p_contract_address)
        ) ranked
        WHERE address = player_address;
    END IF;
    
    RETURN COALESCE(player_rank, 0);
END;
$$ LANGUAGE plpgsql;

-- Create a function to get top players for a specific contract
CREATE OR REPLACE FUNCTION get_top_players_by_contract(
    p_contract_address TEXT,
    player_limit INTEGER DEFAULT 10,
    order_by_field TEXT DEFAULT 'total_shots'
)
RETURNS TABLE (
    address TEXT,
    total_shots INTEGER,
    total_spent DECIMAL,
    total_won DECIMAL,
    roi_percentage DECIMAL,
    last_shot_time TIMESTAMP WITH TIME ZONE,
    contract_address TEXT
) AS $$
BEGIN
    IF order_by_field = 'total_shots' THEN
        RETURN QUERY
        SELECT 
            p.address,
            p.total_shots,
            p.total_spent,
            p.total_won,
            CASE 
                WHEN p.total_spent > 0 THEN (p.total_won / p.total_spent) * 100
                ELSE 0
            END as roi_percentage,
            p.last_shot_time,
            p.contract_address
        FROM players p
        WHERE p.total_shots > 0
          AND (p.contract_address = p_contract_address OR (p.contract_address IS NULL AND p_contract_address = 'default'))
        ORDER BY p.total_shots DESC
        LIMIT player_limit;
    ELSIF order_by_field = 'total_won' THEN
        RETURN QUERY
        SELECT 
            p.address,
            p.total_shots,
            p.total_spent,
            p.total_won,
            CASE 
                WHEN p.total_spent > 0 THEN (p.total_won / p.total_spent) * 100
                ELSE 0
            END as roi_percentage,
            p.last_shot_time,
            p.contract_address
        FROM players p
        WHERE p.total_won > 0
          AND (p.contract_address = p_contract_address OR (p.contract_address IS NULL AND p_contract_address = 'default'))
        ORDER BY p.total_won DESC
        LIMIT player_limit;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update the unique constraint on players table to include contract_address
DO $$
BEGIN
    -- Drop the old unique constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'players' AND constraint_name = 'players_address_key'
    ) THEN
        ALTER TABLE players DROP CONSTRAINT players_address_key;
    END IF;
    
    -- Add new unique constraint that includes contract_address
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'players' AND constraint_name = 'players_address_contract_key'
    ) THEN
        ALTER TABLE players ADD CONSTRAINT players_address_contract_key UNIQUE (address, contract_address);
    END IF;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_player_stats_from_shots TO authenticated, anon;
GRANT EXECUTE ON FUNCTION refresh_all_player_stats TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_game_statistics TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_player_rank TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_top_players_by_contract TO authenticated, anon;

-- Add helpful comments
COMMENT ON COLUMN players.contract_address IS 'Contract address this player data is associated with';
COMMENT ON COLUMN game_stats.contract_address IS 'Contract address these game stats are associated with';
COMMENT ON FUNCTION get_top_players_by_contract IS 'Gets top players for a specific contract address';
COMMENT ON FUNCTION update_game_statistics IS 'Updates game statistics, optionally for a specific contract';

-- Log the completion
DO $$
BEGIN
    RAISE NOTICE 'Contract address tracking added to all tables successfully';
    RAISE NOTICE 'All functions updated to be contract-aware';
    RAISE NOTICE 'Database now supports multiple contract deployments safely';
END $$;