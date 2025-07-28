-- Fix Duplicate Functions Issue
-- 
-- This migration resolves the "function update_game_statistics() is not unique" error
-- by dropping duplicate functions and ensuring clean function definitions.

-- Drop any duplicate or conflicting functions that might exist
DROP FUNCTION IF EXISTS update_game_statistics() CASCADE;
DROP FUNCTION IF EXISTS update_game_statistics(TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_game_statistics(TEXT, TEXT) CASCADE;

-- Drop and recreate the trigger function to ensure it's clean
DROP FUNCTION IF EXISTS update_player_stats_on_shot() CASCADE;

-- Recreate the player stats trigger function with proper signature
CREATE OR REPLACE FUNCTION update_player_stats_on_shot()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insert or update player stats when a shot is recorded
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
        LOWER(NEW.player_address),
        1,
        NEW.amount::numeric,
        CASE WHEN NEW.won THEN NEW.amount::numeric ELSE 0 END,
        NEW.timestamp,
        NEW.crypto_type,
        NEW.contract_address,
        NOW(),
        NOW()
    )
    ON CONFLICT (address) DO UPDATE SET
        total_shots = players.total_shots + 1,
        total_spent = players.total_spent + NEW.amount::numeric,
        total_won = players.total_won + CASE WHEN NEW.won THEN NEW.amount::numeric ELSE 0 END,
        last_shot_time = NEW.timestamp,
        crypto_type = COALESCE(NEW.crypto_type, players.crypto_type),
        contract_address = COALESCE(NEW.contract_address, players.contract_address),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_player_stats_on_shot ON shots;
CREATE TRIGGER trigger_update_player_stats_on_shot
    AFTER INSERT ON shots
    FOR EACH ROW
    EXECUTE FUNCTION update_player_stats_on_shot();

-- Clean up any other potential duplicate functions
DROP FUNCTION IF EXISTS update_game_stats() CASCADE;
DROP FUNCTION IF EXISTS refresh_game_stats() CASCADE;

-- Ensure we have a clean game stats update function
CREATE OR REPLACE FUNCTION update_game_statistics()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update global game statistics
    UPDATE game_stats SET
        total_shots = (SELECT COUNT(*) FROM shots),
        total_players = (SELECT COUNT(DISTINCT address) FROM players WHERE total_shots > 0),
        total_pot_won = (SELECT COALESCE(SUM(amount), 0) FROM winners),
        updated_at = NOW()
    WHERE id = 1;
    
    -- Insert if doesn't exist
    INSERT INTO game_stats (id, total_shots, total_players, total_pot_won, updated_at)
    SELECT 1, 
           (SELECT COUNT(*) FROM shots),
           (SELECT COUNT(DISTINCT address) FROM players WHERE total_shots > 0),
           (SELECT COALESCE(SUM(amount), 0) FROM winners),
           NOW()
    WHERE NOT EXISTS (SELECT 1 FROM game_stats WHERE id = 1);
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION update_player_stats_on_shot IS 'Updates player statistics when shots are inserted, using UPSERT to handle existing players';
COMMENT ON FUNCTION update_game_statistics IS 'Updates global game statistics';