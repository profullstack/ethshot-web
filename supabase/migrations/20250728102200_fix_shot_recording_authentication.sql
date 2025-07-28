-- Fix Shot Recording Authentication Issues
-- 
-- This migration ensures that shot and winner recording requires proper JWT authentication
-- and removes any anonymous access that could bypass security.

-- Enable RLS on all tables if not already enabled
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "shots_insert_policy" ON shots;
DROP POLICY IF EXISTS "shots_select_policy" ON shots;
DROP POLICY IF EXISTS "shots_authenticated_insert" ON shots;
DROP POLICY IF EXISTS "shots_anonymous_insert" ON shots;
DROP POLICY IF EXISTS "shots_select_all" ON shots;

DROP POLICY IF EXISTS "winners_insert_policy" ON winners;
DROP POLICY IF EXISTS "winners_select_policy" ON winners;
DROP POLICY IF EXISTS "winners_authenticated_insert" ON winners;
DROP POLICY IF EXISTS "winners_anonymous_insert" ON winners;
DROP POLICY IF EXISTS "winners_select_all" ON winners;

DROP POLICY IF EXISTS "players_insert_policy" ON players;
DROP POLICY IF EXISTS "players_select_policy" ON players;
DROP POLICY IF EXISTS "players_update_policy" ON players;
DROP POLICY IF EXISTS "players_authenticated_insert" ON players;
DROP POLICY IF EXISTS "players_authenticated_update" ON players;
DROP POLICY IF EXISTS "players_anonymous_insert" ON players;
DROP POLICY IF EXISTS "players_anonymous_update" ON players;
DROP POLICY IF EXISTS "players_select_all" ON players;

-- Create STRICT authentication-only policies for shots table
-- ONLY authenticated users can insert shots (no anonymous access)
CREATE POLICY "shots_authenticated_only_insert" ON shots
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Ensure the JWT token contains a valid wallet address
        auth.jwt() ->> 'walletAddress' IS NOT NULL
        AND length(auth.jwt() ->> 'walletAddress') = 42
        AND lower(auth.jwt() ->> 'walletAddress') = lower(player_address)
    );

-- Allow everyone to read shots (for leaderboards, etc.)
CREATE POLICY "shots_public_select" ON shots
    FOR SELECT
    TO public
    USING (true);

-- Create STRICT authentication-only policies for winners table
-- ONLY authenticated users can insert winners (no anonymous access)
CREATE POLICY "winners_authenticated_only_insert" ON winners
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Ensure the JWT token contains a valid wallet address
        auth.jwt() ->> 'walletAddress' IS NOT NULL
        AND length(auth.jwt() ->> 'walletAddress') = 42
        AND lower(auth.jwt() ->> 'walletAddress') = lower(winner_address)
    );

-- Allow everyone to read winners (for leaderboards, etc.)
CREATE POLICY "winners_public_select" ON winners
    FOR SELECT
    TO public
    USING (true);

-- Create STRICT authentication-only policies for players table
-- ONLY authenticated users can insert/update their own player records
CREATE POLICY "players_authenticated_only_insert" ON players
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Ensure the JWT token contains a valid wallet address
        auth.jwt() ->> 'walletAddress' IS NOT NULL
        AND length(auth.jwt() ->> 'walletAddress') = 42
        AND lower(auth.jwt() ->> 'walletAddress') = lower(address)
    );

CREATE POLICY "players_authenticated_only_update" ON players
    FOR UPDATE
    TO authenticated
    USING (
        -- Users can only update their own records
        auth.jwt() ->> 'walletAddress' IS NOT NULL
        AND lower(auth.jwt() ->> 'walletAddress') = lower(address)
    )
    WITH CHECK (
        -- Ensure they're not changing the address
        auth.jwt() ->> 'walletAddress' IS NOT NULL
        AND lower(auth.jwt() ->> 'walletAddress') = lower(address)
    );

-- Allow everyone to read players (for leaderboards, etc.)
CREATE POLICY "players_public_select" ON players
    FOR SELECT
    TO public
    USING (true);

-- Create indexes for better performance on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_shots_player_address ON shots(player_address);
CREATE INDEX IF NOT EXISTS idx_shots_timestamp ON shots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_shots_contract_address ON shots(contract_address);
CREATE INDEX IF NOT EXISTS idx_shots_crypto_type ON shots(crypto_type);
CREATE INDEX IF NOT EXISTS idx_shots_won ON shots(won);

CREATE INDEX IF NOT EXISTS idx_winners_winner_address ON winners(winner_address);
CREATE INDEX IF NOT EXISTS idx_winners_timestamp ON winners(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_winners_contract_address ON winners(contract_address);
CREATE INDEX IF NOT EXISTS idx_winners_crypto_type ON winners(crypto_type);

CREATE INDEX IF NOT EXISTS idx_players_address ON players(address);
CREATE INDEX IF NOT EXISTS idx_players_total_shots ON players(total_shots DESC);
CREATE INDEX IF NOT EXISTS idx_players_total_won ON players(total_won DESC);
CREATE INDEX IF NOT EXISTS idx_players_crypto_type ON players(crypto_type);

-- Add a function to validate JWT wallet address matches the record
CREATE OR REPLACE FUNCTION validate_jwt_wallet_address(record_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is authenticated and wallet address matches
    IF auth.jwt() IS NULL THEN
        RETURN FALSE;
    END IF;
    
    IF auth.jwt() ->> 'walletAddress' IS NULL THEN
        RETURN FALSE;
    END IF;
    
    IF length(auth.jwt() ->> 'walletAddress') != 42 THEN
        RETURN FALSE;
    END IF;
    
    RETURN lower(auth.jwt() ->> 'walletAddress') = lower(record_address);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to get the authenticated wallet address from JWT
CREATE OR REPLACE FUNCTION get_authenticated_wallet_address()
RETURNS TEXT AS $$
BEGIN
    IF auth.jwt() IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN lower(auth.jwt() ->> 'walletAddress');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger function to automatically update player stats when shots are recorded
CREATE OR REPLACE FUNCTION update_player_stats_on_shot()
RETURNS TRIGGER AS $$
DECLARE
    current_player RECORD;
BEGIN
    -- Get current player stats or create default values
    SELECT * INTO current_player
    FROM players
    WHERE lower(address) = lower(NEW.player_address)
    AND crypto_type = NEW.crypto_type
    AND contract_address = NEW.contract_address;
    
    IF current_player IS NULL THEN
        -- Insert new player record
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
        ) VALUES (
            NEW.player_address,
            1,
            NEW.amount::numeric,
            CASE WHEN NEW.won THEN NEW.amount::numeric ELSE 0 END,
            NEW.timestamp,
            NEW.crypto_type,
            NEW.contract_address,
            NOW(),
            NOW()
        );
    ELSE
        -- Update existing player record
        UPDATE players
        SET
            total_shots = current_player.total_shots + 1,
            total_spent = current_player.total_spent + NEW.amount::numeric,
            total_won = CASE 
                WHEN NEW.won THEN current_player.total_won + NEW.amount::numeric 
                ELSE current_player.total_won 
            END,
            last_shot_time = NEW.timestamp,
            updated_at = NOW()
        WHERE lower(address) = lower(NEW.player_address)
        AND crypto_type = NEW.crypto_type
        AND contract_address = NEW.contract_address;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update player stats
DROP TRIGGER IF EXISTS trigger_update_player_stats_on_shot ON shots;
CREATE TRIGGER trigger_update_player_stats_on_shot
    AFTER INSERT ON shots
    FOR EACH ROW
    EXECUTE FUNCTION update_player_stats_on_shot();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON shots TO authenticated;
GRANT SELECT, INSERT ON winners TO authenticated;
GRANT SELECT, INSERT, UPDATE ON players TO authenticated;

-- Ensure anon role can only read public data
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON shots TO anon;
GRANT SELECT ON winners TO anon;
GRANT SELECT ON players TO anon;