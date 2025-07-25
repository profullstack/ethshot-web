-- Add notification preferences to user profiles
ALTER TABLE user_profiles
ADD COLUMN notifications_enabled BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.notifications_enabled IS 'Whether the user has enabled push notifications';

-- Create index for faster queries
CREATE INDEX idx_user_profiles_notifications ON user_profiles(notifications_enabled);

-- Update the upsert_user_profile function to handle notifications_enabled
CREATE OR REPLACE FUNCTION upsert_user_profile(
  wallet_addr TEXT,
  p_nickname TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_notifications_enabled BOOLEAN DEFAULT true
)
RETURNS TABLE(
  wallet_address TEXT,
  nickname TEXT,
  avatar_url TEXT,
  bio TEXT,
  notifications_enabled BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update the user profile
  INSERT INTO user_profiles (
    wallet_address,
    nickname,
    avatar_url,
    bio,
    notifications_enabled,
    created_at,
    updated_at
  )
  VALUES (
    LOWER(wallet_addr),
    p_nickname,
    p_avatar_url,
    p_bio,
    p_notifications_enabled,
    NOW(),
    NOW()
  )
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    nickname = EXCLUDED.nickname,
    avatar_url = EXCLUDED.avatar_url,
    bio = EXCLUDED.bio,
    notifications_enabled = EXCLUDED.notifications_enabled,
    updated_at = NOW();

  -- Return the updated profile
  RETURN QUERY
  SELECT
    up.wallet_address,
    up.nickname,
    up.avatar_url,
    up.bio,
    up.notifications_enabled,
    up.created_at,
    up.updated_at
  FROM user_profiles up
  WHERE up.wallet_address = LOWER(wallet_addr);
END;
$$;