-- Migration: Add Website URL Column
-- Created: 2025-07-28 04:05:00 UTC
-- Description: Adds website_url column to user_profiles table

-- Add website_url column
ALTER TABLE user_profiles 
ADD COLUMN website_url TEXT;

-- Create index for better performance on website URL lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_website_url ON user_profiles(website_url);

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.website_url IS 'Website URL for the user (optional)';