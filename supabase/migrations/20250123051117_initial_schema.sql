-- Migration: Initial ETH Shot Database Schema
-- Created: 2025-01-23 05:11:17 UTC
-- Description: Creates all initial tables, indexes, functions, triggers, and RLS policies for the ETH Shot game

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table - stores player statistics and information
CREATE TABLE IF NOT EXISTS players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    address TEXT UNIQUE NOT NULL,
    total_shots INTEGER DEFAULT 0,
    total_spent DECIMAL(20, 18) DEFAULT 0,
    total_won DECIMAL(20, 18) DEFAULT 0,
    last_shot_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shots table - records every shot taken
CREATE TABLE IF NOT EXISTS shots (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_address TEXT NOT NULL,
    amount DECIMAL(20, 18) NOT NULL,
    won BOOLEAN DEFAULT FALSE,
    tx_hash TEXT UNIQUE,
    block_number BIGINT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Winners table - records all jackpot wins
CREATE TABLE IF NOT EXISTS winners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    winner_address TEXT NOT NULL,
    amount DECIMAL(20, 18) NOT NULL,
    tx_hash TEXT UNIQUE,
    block_number BIGINT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sponsors table - records sponsor rounds
CREATE TABLE IF NOT EXISTS sponsors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sponsor_address TEXT NOT NULL,
    name TEXT NOT NULL,
    logo_url TEXT,
    amount DECIMAL(20, 18) NOT NULL,
    tx_hash TEXT UNIQUE,
    active BOOLEAN DEFAULT TRUE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game stats table - global game statistics
CREATE TABLE IF NOT EXISTS game_stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_shots INTEGER DEFAULT 0,
    total_players INTEGER DEFAULT 0,
    total_pot_won DECIMAL(20, 18) DEFAULT 0,
    current_pot DECIMAL(20, 18) DEFAULT 0,
    last_winner TEXT,
    last_win_amount DECIMAL(20, 18),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_address ON players(address);
CREATE INDEX IF NOT EXISTS idx_players_total_shots ON players(total_shots DESC);
CREATE INDEX IF NOT EXISTS idx_players_total_won ON players(total_won DESC);
CREATE INDEX IF NOT EXISTS idx_players_updated_at ON players(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_shots_player_address ON shots(player_address);
CREATE INDEX IF NOT EXISTS idx_shots_timestamp ON shots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_shots_won ON shots(won);
CREATE INDEX IF NOT EXISTS idx_shots_tx_hash ON shots(tx_hash);

CREATE INDEX IF NOT EXISTS idx_winners_timestamp ON winners(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_winners_winner_address ON winners(winner_address);
CREATE INDEX IF NOT EXISTS idx_winners_amount ON winners(amount DESC);

CREATE INDEX IF NOT EXISTS idx_sponsors_active ON sponsors(active);
CREATE INDEX IF NOT EXISTS idx_sponsors_timestamp ON sponsors(timestamp DESC);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_players_updated_at 
    BEFORE UPDATE ON players 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all tables (game is public)
CREATE POLICY "Allow public read access on players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public read access on shots" ON shots FOR SELECT USING (true);
CREATE POLICY "Allow public read access on winners" ON winners FOR SELECT USING (true);
CREATE POLICY "Allow public read access on sponsors" ON sponsors FOR SELECT USING (true);
CREATE POLICY "Allow public read access on game_stats" ON game_stats FOR SELECT USING (true);

-- Allow public insert/update for game operations (in production, you might want to restrict this)
CREATE POLICY "Allow public insert on players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on players" ON players FOR UPDATE USING (true);
CREATE POLICY "Allow public insert on shots" ON shots FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on winners" ON winners FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on sponsors" ON sponsors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on sponsors" ON sponsors FOR UPDATE USING (true);
CREATE POLICY "Allow public update on game_stats" ON game_stats FOR UPDATE USING (true);
CREATE POLICY "Allow public insert on game_stats" ON game_stats FOR INSERT WITH CHECK (true);

-- Initialize game stats with default values
INSERT INTO game_stats (id, total_shots, total_players, total_pot_won, current_pot)
VALUES (1, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW leaderboard_by_shots AS
SELECT 
    address,
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
ORDER BY total_shots DESC;

CREATE OR REPLACE VIEW leaderboard_by_winnings AS
SELECT 
    address,
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
ORDER BY total_won DESC;

CREATE OR REPLACE VIEW recent_activity AS
SELECT 
    'shot' as activity_type,
    s.player_address as address,
    s.amount,
    s.won,
    s.timestamp,
    s.tx_hash
FROM shots s
UNION ALL
SELECT 
    'win' as activity_type,
    w.winner_address as address,
    w.amount,
    true as won,
    w.timestamp,
    w.tx_hash
FROM winners w
ORDER BY timestamp DESC;

-- Create function to get player rank
CREATE OR REPLACE FUNCTION get_player_rank(player_address TEXT, rank_by TEXT DEFAULT 'total_shots')
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
        ) ranked
        WHERE address = player_address;
    ELSIF rank_by = 'total_won' THEN
        SELECT rank INTO player_rank
        FROM (
            SELECT address, RANK() OVER (ORDER BY total_won DESC) as rank
            FROM players
            WHERE total_won > 0
        ) ranked
        WHERE address = player_address;
    END IF;
    
    RETURN COALESCE(player_rank, 0);
END;
$$ LANGUAGE plpgsql;

-- Create function to update game statistics
CREATE OR REPLACE FUNCTION update_game_statistics()
RETURNS VOID AS $$
BEGIN
    UPDATE game_stats SET
        total_shots = (SELECT COUNT(*) FROM shots),
        total_players = (SELECT COUNT(DISTINCT address) FROM players WHERE total_shots > 0),
        total_pot_won = (SELECT COALESCE(SUM(amount), 0) FROM winners),
        updated_at = NOW()
    WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update game statistics
CREATE OR REPLACE FUNCTION trigger_update_game_stats()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_game_statistics();
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to update game stats automatically
CREATE TRIGGER shots_update_stats 
    AFTER INSERT OR UPDATE OR DELETE ON shots
    FOR EACH STATEMENT 
    EXECUTE FUNCTION trigger_update_game_stats();

CREATE TRIGGER winners_update_stats 
    AFTER INSERT OR UPDATE OR DELETE ON winners
    FOR EACH STATEMENT 
    EXECUTE FUNCTION trigger_update_game_stats();

CREATE TRIGGER players_update_stats 
    AFTER INSERT OR UPDATE OR DELETE ON players
    FOR EACH STATEMENT 
    EXECUTE FUNCTION trigger_update_game_stats();

-- Comments for documentation
COMMENT ON TABLE players IS 'Stores player statistics and information';
COMMENT ON TABLE shots IS 'Records every shot taken in the game';
COMMENT ON TABLE winners IS 'Records all jackpot wins';
COMMENT ON TABLE sponsors IS 'Records sponsor rounds and branding';
COMMENT ON TABLE game_stats IS 'Global game statistics and metrics';

COMMENT ON COLUMN players.address IS 'Ethereum wallet address (lowercase)';
COMMENT ON COLUMN players.total_shots IS 'Total number of shots taken by player';
COMMENT ON COLUMN players.total_spent IS 'Total ETH spent by player';
COMMENT ON COLUMN players.total_won IS 'Total ETH won by player';

COMMENT ON COLUMN shots.player_address IS 'Ethereum address of player who took the shot';
COMMENT ON COLUMN shots.amount IS 'Amount of ETH spent on the shot';
COMMENT ON COLUMN shots.won IS 'Whether this shot won the jackpot';
COMMENT ON COLUMN shots.tx_hash IS 'Ethereum transaction hash';

COMMENT ON COLUMN winners.winner_address IS 'Ethereum address of the winner';
COMMENT ON COLUMN winners.amount IS 'Amount of ETH won';
COMMENT ON COLUMN winners.tx_hash IS 'Ethereum transaction hash of winning shot';

COMMENT ON COLUMN sponsors.sponsor_address IS 'Ethereum address of the sponsor';
COMMENT ON COLUMN sponsors.name IS 'Display name of the sponsor';
COMMENT ON COLUMN sponsors.logo_url IS 'URL to sponsor logo image';
COMMENT ON COLUMN sponsors.active IS 'Whether this sponsorship is currently active';