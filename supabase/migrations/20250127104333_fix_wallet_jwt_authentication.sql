-- Migration: Fix Wallet-based JWT Authentication System
-- Created: 2025-01-27 10:43:33 UTC
-- Description: Fixes RLS policies for wallet-based authentication with proper type casting

-- Create the users table first
CREATE TABLE IF NOT EXISTS users (
    wallet_address TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Drop existing policies if they exist (now that table exists)
DROP POLICY IF EXISTS "Users can view own data only" ON users;
DROP POLICY IF EXISTS "Users can insert their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;

-- Drop existing policies on other tables that might conflict
DROP POLICY IF EXISTS "Users can view own player data" ON players;
DROP POLICY IF EXISTS "Users can update own player data" ON players;
DROP POLICY IF EXISTS "Users can view own shots" ON shots;
DROP POLICY IF EXISTS "Users can insert own shots" ON shots;
DROP POLICY IF EXISTS "Users can view own wins" ON winners;
DROP POLICY IF EXISTS "Users can view own sponsorships" ON sponsors;
DROP POLICY IF EXISTS "Users can update own sponsorships" ON sponsors;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS policies for users table with proper type casting
-- Users can view their own data only
CREATE POLICY "Users can view own data only"
ON users
FOR SELECT USING (
  wallet_address = CAST(auth.uid() AS TEXT)
);

-- Users can insert their own data
CREATE POLICY "Users can insert their own data"
ON users
FOR INSERT WITH CHECK (
  wallet_address = CAST(auth.uid() AS TEXT)
);

-- Users can update their own data
CREATE POLICY "Users can update their own data"
ON users
FOR UPDATE USING (
  wallet_address = CAST(auth.uid() AS TEXT)
);

-- Create function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_users_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_users_updated_at_column();

-- Update existing tables to use wallet_address consistently
-- Add wallet_address columns where needed and create indexes

-- Update players table to ensure wallet addresses are properly indexed
CREATE INDEX IF NOT EXISTS idx_players_address_lower ON players(LOWER(address));

-- Update shots table to ensure wallet addresses are properly indexed  
CREATE INDEX IF NOT EXISTS idx_shots_player_address_lower ON shots(LOWER(player_address));

-- Update winners table to ensure wallet addresses are properly indexed
CREATE INDEX IF NOT EXISTS idx_winners_winner_address_lower ON winners(LOWER(winner_address));

-- Update sponsors table to ensure wallet addresses are properly indexed
CREATE INDEX IF NOT EXISTS idx_sponsors_sponsor_address_lower ON sponsors(LOWER(sponsor_address));

-- Create RLS policies for existing tables using wallet addresses with proper type casting
-- Players table policies
CREATE POLICY "Users can view own player data"
ON players
FOR SELECT USING (
  LOWER(address) = LOWER(CAST(auth.uid() AS TEXT))
);

CREATE POLICY "Users can update own player data"
ON players
FOR UPDATE USING (
  LOWER(address) = LOWER(CAST(auth.uid() AS TEXT))
);

-- Shots table policies
CREATE POLICY "Users can view own shots"
ON shots
FOR SELECT USING (
  LOWER(player_address) = LOWER(CAST(auth.uid() AS TEXT))
);

CREATE POLICY "Users can insert own shots"
ON shots
FOR INSERT WITH CHECK (
  LOWER(player_address) = LOWER(CAST(auth.uid() AS TEXT))
);

-- Winners table policies
CREATE POLICY "Users can view own wins"
ON winners
FOR SELECT USING (
  LOWER(winner_address) = LOWER(CAST(auth.uid() AS TEXT))
);

-- Sponsors table policies
CREATE POLICY "Users can view own sponsorships"
ON sponsors
FOR SELECT USING (
  LOWER(sponsor_address) = LOWER(CAST(auth.uid() AS TEXT))
);

CREATE POLICY "Users can update own sponsorships"
ON sponsors
FOR UPDATE USING (
  LOWER(sponsor_address) = LOWER(CAST(auth.uid() AS TEXT))
);

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores wallet addresses and authentication nonces for JWT-based auth';
COMMENT ON COLUMN users.wallet_address IS 'Ethereum wallet address (checksummed, used as primary key)';
COMMENT ON COLUMN users.nonce IS 'Current nonce for signature verification';
COMMENT ON COLUMN users.metadata IS 'Additional user metadata (JSON)';