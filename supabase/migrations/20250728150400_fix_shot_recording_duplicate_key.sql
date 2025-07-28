-- Fix Shot Recording Duplicate Key Issue
-- 
-- This migration fixes the duplicate key constraint violation when recording shots
-- by ensuring the trigger function properly handles existing players and supports multiple shots per player.

-- Update the trigger function to handle existing players properly
CREATE OR REPLACE FUNCTION update_player_stats_on_shot()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    current_player RECORD;
BEGIN
    -- Get current player stats or create default values
    SELECT 
        address,
        total_shots,
        total_spent,
        total_won,
        last_shot_time,
        crypto_type,
        contract_address
    INTO current_player
    FROM players 
    WHERE address = LOWER(NEW.player_address);
    
    -- If player doesn't exist, create them
    IF current_player IS NULL THEN
        INSERT INTO players (
            address,
            total_shots,
            total_spent,
            total_won,
            last_shot_time,
            crypto_type,
            contract_address
        )
        VALUES (
            LOWER(NEW.player_address),
            1,
            NEW.amount::numeric,
            CASE WHEN NEW.won THEN NEW.amount::numeric ELSE 0 END,
            NEW.timestamp,
            NEW.crypto_type,
            NEW.contract_address
        );
    ELSE
        -- Player exists, update their stats (supporting multiple shots)
        UPDATE players 
        SET
            total_shots = current_player.total_shots + 1,
            total_spent = current_player.total_spent + NEW.amount::numeric,
            total_won = current_player.total_won + CASE WHEN NEW.won THEN NEW.amount::numeric ELSE 0 END,
            last_shot_time = NEW.timestamp,
            crypto_type = COALESCE(NEW.crypto_type, current_player.crypto_type),
            contract_address = COALESCE(NEW.contract_address, current_player.contract_address),
            updated_at = NOW()
        WHERE address = LOWER(NEW.player_address);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS trigger_update_player_stats_on_shot ON shots;
CREATE TRIGGER trigger_update_player_stats_on_shot
    AFTER INSERT ON shots
    FOR EACH ROW
    EXECUTE FUNCTION update_player_stats_on_shot();

-- Add comment for documentation
COMMENT ON FUNCTION update_player_stats_on_shot IS 'Automatically updates player statistics when shots are recorded, supporting multiple shots per player';

-- Ensure proper indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_players_address_lower ON players(LOWER(address));
CREATE INDEX IF NOT EXISTS idx_shots_player_address_lower ON shots(LOWER(player_address));

-- Verify the shots table supports multiple shots per player (it should already)
-- The shots table has a UUID primary key, so multiple shots per player are naturally supported
-- Each shot is a separate record with its own unique ID

-- Add constraint to ensure tx_hash uniqueness (prevent duplicate transaction recording)
-- This prevents the same transaction from being recorded multiple times
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'shots_tx_hash_unique'
    ) THEN
        ALTER TABLE shots ADD CONSTRAINT shots_tx_hash_unique UNIQUE (tx_hash);
    END IF;
END $$;

-- Add constraint to ensure winner tx_hash uniqueness
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'winners_tx_hash_unique'
    ) THEN
        ALTER TABLE winners ADD CONSTRAINT winners_tx_hash_unique UNIQUE (tx_hash);
    END IF;
END $$;