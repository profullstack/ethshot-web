-- Migration: Add Contract Address Tracking (Fixed)
-- Created: 2025-07-26 08:32:00 UTC
-- Description: Adds contract_address field to all relevant tables to support multiple contract deployments
-- This is a corrected version that doesn't try to modify existing views

-- Add contract_address to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS contract_address TEXT;

-- Add contract_address to shots table
ALTER TABLE shots ADD COLUMN IF NOT EXISTS contract_address TEXT;

-- Add contract_address to winners table
ALTER TABLE winners ADD COLUMN IF NOT EXISTS contract_address TEXT;

-- Add contract_address to sponsors table
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS contract_address TEXT;

-- Add contract_address to game_stats table
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS contract_address TEXT;

-- Add contract_address to leaderboard table if it exists
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS contract_address TEXT;

-- Create indexes for contract_address fields for better query performance
CREATE INDEX IF NOT EXISTS idx_players_contract_address ON players(contract_address);
CREATE INDEX IF NOT EXISTS idx_shots_contract_address ON shots(contract_address);
CREATE INDEX IF NOT EXISTS idx_winners_contract_address ON winners(contract_address);
CREATE INDEX IF NOT EXISTS idx_sponsors_contract_address ON sponsors(contract_address);
CREATE INDEX IF NOT EXISTS idx_game_stats_contract_address ON game_stats(contract_address);
CREATE INDEX IF NOT EXISTS idx_leaderboard_contract_address ON leaderboard(contract_address);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_players_contract_total_shots ON players(contract_address, total_shots DESC);
CREATE INDEX IF NOT EXISTS idx_players_contract_total_won ON players(contract_address, total_won DESC);
CREATE INDEX IF NOT EXISTS idx_shots_contract_timestamp ON shots(contract_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_shots_contract_player ON shots(contract_address, player_address);
CREATE INDEX IF NOT EXISTS idx_winners_contract_timestamp ON winners(contract_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sponsors_contract_active ON sponsors(contract_address, active);

-- Update the get_player_rank function to be contract-aware
CREATE OR REPLACE FUNCTION get_player_rank(player_address TEXT, contract_addr TEXT DEFAULT NULL, rank_by TEXT DEFAULT 'total_shots')
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
            AND (contract_addr IS NULL OR contract_address = contract_addr)
        ) ranked
        WHERE address = player_address;
    ELSIF rank_by = 'total_won' THEN
        SELECT rank INTO player_rank
        FROM (
            SELECT address, RANK() OVER (ORDER BY total_won DESC) as rank
            FROM players
            WHERE total_won > 0
            AND (contract_addr IS NULL OR contract_address = contract_addr)
        ) ranked
        WHERE address = player_address;
    END IF;
    
    RETURN COALESCE(player_rank, 0);
END;
$$ LANGUAGE plpgsql;

-- Update the update_game_statistics function to be contract-aware
CREATE OR REPLACE FUNCTION update_game_statistics(contract_addr TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    -- If contract_addr is provided, update stats for that specific contract
    -- Otherwise, update global stats (for backward compatibility)
    IF contract_addr IS NOT NULL THEN
        INSERT INTO game_stats (id, contract_address, total_shots, total_players, total_pot_won, updated_at)
        VALUES (
            -- Use a hash of contract address as ID to ensure uniqueness
            abs(hashtext(contract_addr)),
            contract_addr,
            (SELECT COUNT(*) FROM shots WHERE contract_address = contract_addr),
            (SELECT COUNT(DISTINCT player_address) FROM players WHERE contract_address = contract_addr AND total_shots > 0),
            (SELECT COALESCE(SUM(amount), 0) FROM winners WHERE contract_address = contract_addr),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            total_shots = EXCLUDED.total_shots,
            total_players = EXCLUDED.total_players,
            total_pot_won = EXCLUDED.total_pot_won,
            updated_at = EXCLUDED.updated_at;
    ELSE
        -- Update global stats (legacy behavior)
        UPDATE game_stats SET
            total_shots = (SELECT COUNT(*) FROM shots),
            total_players = (SELECT COUNT(DISTINCT address) FROM players WHERE total_shots > 0),
            total_pot_won = (SELECT COALESCE(SUM(amount), 0) FROM winners),
            updated_at = NOW()
        WHERE id = 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get contract-specific game stats
CREATE OR REPLACE FUNCTION get_contract_game_stats(contract_addr TEXT)
RETURNS TABLE(
    contract_address TEXT,
    total_shots INTEGER,
    total_players INTEGER,
    total_pot_won DECIMAL(20, 18),
    current_pot DECIMAL(20, 18),
    last_winner TEXT,
    last_win_amount DECIMAL(20, 18),
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gs.contract_address,
        gs.total_shots,
        gs.total_players,
        gs.total_pot_won,
        gs.current_pot,
        gs.last_winner,
        gs.last_win_amount,
        gs.updated_at
    FROM game_stats gs
    WHERE gs.contract_address = contract_addr
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get leaderboard for a specific contract
CREATE OR REPLACE FUNCTION get_contract_leaderboard(
    contract_addr TEXT,
    rank_by TEXT DEFAULT 'total_shots',
    limit_count INTEGER DEFAULT 100
)
RETURNS TABLE(
    address TEXT,
    total_shots INTEGER,
    total_spent DECIMAL(20, 18),
    total_won DECIMAL(20, 18),
    roi_percentage DECIMAL(10, 2),
    last_shot_time TIMESTAMP WITH TIME ZONE,
    player_rank INTEGER
) AS $$
BEGIN
    IF rank_by = 'total_won' THEN
        RETURN QUERY
        SELECT 
            p.address,
            p.total_shots,
            p.total_spent,
            p.total_won,
            CASE 
                WHEN p.total_spent > 0 THEN ROUND((p.total_won / p.total_spent) * 100, 2)
                ELSE 0
            END as roi_percentage,
            p.last_shot_time,
            ROW_NUMBER() OVER (ORDER BY p.total_won DESC)::INTEGER as player_rank
        FROM players p
        WHERE p.contract_address = contract_addr
        AND p.total_won > 0
        ORDER BY p.total_won DESC
        LIMIT limit_count;
    ELSE
        RETURN QUERY
        SELECT 
            p.address,
            p.total_shots,
            p.total_spent,
            p.total_won,
            CASE 
                WHEN p.total_spent > 0 THEN ROUND((p.total_won / p.total_spent) * 100, 2)
                ELSE 0
            END as roi_percentage,
            p.last_shot_time,
            ROW_NUMBER() OVER (ORDER BY p.total_shots DESC)::INTEGER as player_rank
        FROM players p
        WHERE p.contract_address = contract_addr
        AND p.total_shots > 0
        ORDER BY p.total_shots DESC
        LIMIT limit_count;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON COLUMN players.contract_address IS 'Smart contract address this player data belongs to';
COMMENT ON COLUMN shots.contract_address IS 'Smart contract address this shot was taken on';
COMMENT ON COLUMN winners.contract_address IS 'Smart contract address this win occurred on';
COMMENT ON COLUMN sponsors.contract_address IS 'Smart contract address this sponsorship is for';
COMMENT ON COLUMN game_stats.contract_address IS 'Smart contract address these stats are for (NULL for global stats)';

-- Note: Existing data will have NULL contract_address values
-- These should be updated when the application starts up with the current contract address