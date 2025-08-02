-- Fix Game Stats Primary Key Issue
--
-- This migration fixes the duplicate key violation error in game_stats table
-- by removing the id primary key constraint and using contract_address as the primary identifier.

-- Drop the primary key constraint on id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'game_stats' AND constraint_name = 'game_stats_pkey'
    ) THEN
        ALTER TABLE game_stats DROP CONSTRAINT game_stats_pkey;
    END IF;
END $$;

-- Add a new primary key constraint on contract_address
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'game_stats' AND constraint_name = 'game_stats_contract_address_key'
    ) THEN
        ALTER TABLE game_stats ADD CONSTRAINT game_stats_contract_address_key PRIMARY KEY (contract_address);
    END IF;
END $$;

-- Update the update_game_statistics function to handle the new primary key structure
CREATE OR REPLACE FUNCTION update_game_statistics(p_contract_address TEXT DEFAULT NULL)
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

-- Ensure the initial game stats record exists for the default contract
DO $$
BEGIN
    INSERT INTO game_stats (contract_address, total_shots, total_players, total_pot_won, current_pot, updated_at)
    VALUES ('default', 0, 0, 0, 0, NOW())
    ON CONFLICT (contract_address) DO NOTHING;
    
    RAISE NOTICE 'Fixed game_stats primary key issue and ensured default contract stats exist';
END $$;