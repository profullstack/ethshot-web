-- Fix Game Stats NULL Values Before Primary Key
--
-- This migration fixes the NULL values in contract_address column
-- before adding the primary key constraint.

-- First, update existing NULL values in contract_address to 'default'
UPDATE game_stats 
SET contract_address = 'default' 
WHERE contract_address IS NULL;

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
    
    RAISE NOTICE 'Fixed NULL values in game_stats.contract_address and added primary key constraint';
END $$;