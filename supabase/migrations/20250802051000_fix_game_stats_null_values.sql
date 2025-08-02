-- Fix Game Stats Primary Key Structure
--
-- This migration properly fixes the game_stats table structure to use contract_address as the primary key
-- by first dropping the old primary key constraint and then adding the new one.

-- First, update existing NULL values in contract_address to 'default'
UPDATE game_stats
SET contract_address = 'default'
WHERE contract_address IS NULL;

-- Drop the existing primary key constraint on id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'game_stats' AND constraint_name = 'game_stats_pkey'
    ) THEN
        ALTER TABLE game_stats DROP CONSTRAINT game_stats_pkey;
    END IF;
END $$;

-- Drop the existing unique constraint on contract_address if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'game_stats' AND constraint_name = 'unique_contract_stats'
    ) THEN
        ALTER TABLE game_stats DROP CONSTRAINT unique_contract_stats;
    END IF;
END $$;

-- Now add the primary key constraint on contract_address
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'game_stats' AND constraint_name = 'game_stats_contract_address_key'
    ) THEN
        ALTER TABLE game_stats ADD CONSTRAINT game_stats_contract_address_key PRIMARY KEY (contract_address);
    END IF;
END $$;

-- Ensure the initial game stats record exists for the default contract
DO $$
BEGIN
    INSERT INTO game_stats (contract_address, total_shots, total_players, total_pot_won, current_pot, updated_at)
    VALUES ('default', 0, 0, 0, 0, NOW())
    ON CONFLICT (contract_address) DO NOTHING;
    
    RAISE NOTICE 'Fixed game_stats table structure to use contract_address as primary key';
END $$;