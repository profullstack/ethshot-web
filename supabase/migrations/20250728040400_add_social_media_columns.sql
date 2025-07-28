-- Migration: Add Social Media Columns
-- Created: 2025-07-28 04:04:00 UTC
-- Description: Adds twitter_handle and discord_handle columns to user_profiles table

-- Add twitter_handle column
ALTER TABLE user_profiles 
ADD COLUMN twitter_handle TEXT;

-- Add discord_handle column  
ALTER TABLE user_profiles 
ADD COLUMN discord_handle TEXT;

-- Create indexes for better performance on social media handle lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_twitter_handle ON user_profiles(twitter_handle);
CREATE INDEX IF NOT EXISTS idx_user_profiles_discord_handle ON user_profiles(discord_handle);

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.twitter_handle IS 'Twitter/X handle for the user (optional)';
COMMENT ON COLUMN user_profiles.discord_handle IS 'Discord handle for the user (optional)';