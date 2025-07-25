-- Migration: Make Nickname Unique
-- Created: 2025-07-25 17:18:00 UTC
-- Description: Adds unique constraint to nickname field and creates availability checking function

-- Add unique constraint to nickname column
ALTER TABLE user_profiles ADD CONSTRAINT unique_nickname UNIQUE (nickname);

-- Create index for better performance on nickname lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_nickname ON user_profiles(nickname);

-- Function to check nickname availability
CREATE OR REPLACE FUNCTION is_nickname_available(p_nickname TEXT, exclude_wallet_addr TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    nickname_count INTEGER;
BEGIN
    -- Return true if nickname is null or empty (optional field)
    IF p_nickname IS NULL OR TRIM(p_nickname) = '' THEN
        RETURN true;
    END IF;
    
    SELECT COUNT(*) INTO nickname_count
    FROM user_profiles
    WHERE nickname = p_nickname
    AND (exclude_wallet_addr IS NULL OR wallet_address != LOWER(exclude_wallet_addr));
    
    RETURN nickname_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Update table comment to reflect nickname uniqueness
COMMENT ON COLUMN user_profiles.nickname IS 'Display name for the user (unique, optional)';
COMMENT ON FUNCTION is_nickname_available(TEXT, TEXT) IS 'Checks if nickname is available for use';