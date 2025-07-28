-- Add debug_mode flag to user_profiles table
-- This allows users to enable/disable debug information display
-- Created: 2025-07-28 12:44:00 UTC

-- Add debug_mode column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN debug_mode BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.debug_mode IS 'Flag to enable debug information display for the user (off by default)';

-- Create index for efficient debug mode queries
CREATE INDEX idx_user_profiles_debug_mode ON user_profiles(debug_mode) WHERE debug_mode = TRUE;

-- Update the upsert_user_profile_secure function to handle debug_mode
-- Drop existing function first
DROP FUNCTION IF EXISTS upsert_user_profile_secure(text, text, text, text, text, text, text);

-- Recreate with debug_mode parameter
CREATE OR REPLACE FUNCTION upsert_user_profile_secure(
  p_wallet_address text,
  p_nickname text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_twitter_handle text DEFAULT NULL,
  p_discord_handle text DEFAULT NULL,
  p_website_url text DEFAULT NULL,
  p_debug_mode boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_result json;
BEGIN
  -- Validate wallet address format (basic check)
  IF p_wallet_address IS NULL OR LENGTH(p_wallet_address) < 10 THEN
    RAISE EXCEPTION 'Invalid wallet address format';
  END IF;

  -- Normalize wallet address to lowercase
  p_wallet_address := LOWER(p_wallet_address);

  -- Get existing user ID or create new user
  SELECT id INTO v_user_id
  FROM user_profiles
  WHERE wallet_address = p_wallet_address;

  IF v_user_id IS NULL THEN
    -- Create new user profile
    INSERT INTO user_profiles (
      wallet_address,
      nickname,
      bio,
      avatar_url,
      twitter_handle,
      discord_handle,
      website_url,
      debug_mode
    ) VALUES (
      p_wallet_address,
      p_nickname,
      p_bio,
      p_avatar_url,
      p_twitter_handle,
      p_discord_handle,
      p_website_url,
      COALESCE(p_debug_mode, FALSE)
    ) RETURNING id INTO v_user_id;
  ELSE
    -- Update existing user profile (only update non-null values)
    UPDATE user_profiles
    SET
      nickname = COALESCE(p_nickname, nickname),
      bio = COALESCE(p_bio, bio),
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      twitter_handle = COALESCE(p_twitter_handle, twitter_handle),
      discord_handle = COALESCE(p_discord_handle, discord_handle),
      website_url = COALESCE(p_website_url, website_url),
      debug_mode = COALESCE(p_debug_mode, debug_mode),
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- Return the updated/created user profile
  SELECT json_build_object(
    'id', id,
    'wallet_address', wallet_address,
    'nickname', nickname,
    'bio', bio,
    'avatar_url', avatar_url,
    'twitter_handle', twitter_handle,
    'discord_handle', discord_handle,
    'website_url', website_url,
    'debug_mode', debug_mode,
    'is_admin', is_admin,
    'notifications_enabled', notifications_enabled,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_result
  FROM user_profiles
  WHERE id = v_user_id;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_user_profile_secure(
  text, -- p_wallet_address
  text, -- p_nickname
  text, -- p_bio
  text, -- p_avatar_url
  text, -- p_twitter_handle
  text, -- p_discord_handle
  text, -- p_website_url
  boolean -- p_debug_mode
) TO authenticated;

-- Add comment explaining the updated function
COMMENT ON FUNCTION upsert_user_profile_secure(
  text, -- p_wallet_address
  text, -- p_nickname
  text, -- p_bio
  text, -- p_avatar_url
  text, -- p_twitter_handle
  text, -- p_discord_handle
  text, -- p_website_url
  boolean -- p_debug_mode
) IS 'Securely upsert user profile with ES256 JWT wallet address validation - Now includes debug_mode support';