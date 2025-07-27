-- Migration: Add User Profile Columns
-- Created: 2025-01-27 12:58:00 UTC
-- Description: Adds profile columns to users table for nickname, avatar, bio, and notifications

-- Add profile columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS nickname TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname) WHERE nickname IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_notifications ON users(notifications_enabled);

-- Add constraints
ALTER TABLE users 
ADD CONSTRAINT users_nickname_length CHECK (LENGTH(nickname) >= 2 AND LENGTH(nickname) <= 50),
ADD CONSTRAINT users_bio_length CHECK (LENGTH(bio) <= 500);

-- Comments for documentation
COMMENT ON COLUMN users.nickname IS 'User display name (unique, 2-50 characters)';
COMMENT ON COLUMN users.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN users.bio IS 'User biography (max 500 characters)';
COMMENT ON COLUMN users.notifications_enabled IS 'Whether user wants to receive notifications';