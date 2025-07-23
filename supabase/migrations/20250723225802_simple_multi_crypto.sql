-- Migration: Simple Multi-Cryptocurrency Support
-- Created: 2025-07-23 22:58:02 UTC
-- Description: Simply adds crypto_type columns with ETH default for existing data

-- Add crypto_type column to existing tables with default 'ETH'
-- This automatically sets all existing data to 'ETH'
ALTER TABLE players ADD COLUMN IF NOT EXISTS crypto_type TEXT DEFAULT 'ETH';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS crypto_type TEXT DEFAULT 'ETH';
ALTER TABLE winners ADD COLUMN IF NOT EXISTS crypto_type TEXT DEFAULT 'ETH';
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS crypto_type TEXT DEFAULT 'ETH';

-- Update any existing NULL values to 'ETH' (just in case)
UPDATE players SET crypto_type = 'ETH' WHERE crypto_type IS NULL;
UPDATE shots SET crypto_type = 'ETH' WHERE crypto_type IS NULL;
UPDATE winners SET crypto_type = 'ETH' WHERE crypto_type IS NULL;
UPDATE sponsors SET crypto_type = 'ETH' WHERE crypto_type IS NULL;

-- Add basic indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_crypto_type ON players(crypto_type);
CREATE INDEX IF NOT EXISTS idx_shots_crypto_type ON shots(crypto_type);
CREATE INDEX IF NOT EXISTS idx_winners_crypto_type ON winners(crypto_type);
CREATE INDEX IF NOT EXISTS idx_sponsors_crypto_type ON sponsors(crypto_type);

-- Add constraints to ensure valid crypto types (skip if they already exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_players_crypto_type') THEN
        ALTER TABLE players ADD CONSTRAINT check_players_crypto_type CHECK (crypto_type IN ('ETH', 'SOL'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_shots_crypto_type') THEN
        ALTER TABLE shots ADD CONSTRAINT check_shots_crypto_type CHECK (crypto_type IN ('ETH', 'SOL'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_winners_crypto_type') THEN
        ALTER TABLE winners ADD CONSTRAINT check_winners_crypto_type CHECK (crypto_type IN ('ETH', 'SOL'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_sponsors_crypto_type') THEN
        ALTER TABLE sponsors ADD CONSTRAINT check_sponsors_crypto_type CHECK (crypto_type IN ('ETH', 'SOL'));
    END IF;
END $$;

-- That's it! Simple and reliable.
-- All existing data is now tagged as 'ETH'
-- New data can specify crypto_type when inserted
-- The application layer handles the rest