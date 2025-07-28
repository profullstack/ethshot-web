-- Migration: Fix GRANT permissions by specifying exact function signature
-- This migration fixes the ambiguous function name issue in GRANT statements

-- Grant execute permission to authenticated users with specific signature
GRANT EXECUTE ON FUNCTION upsert_user_profile_secure(
  text, -- p_wallet_address
  text, -- p_nickname
  text, -- p_bio
  text, -- p_avatar_url
  text, -- p_twitter_handle
  text, -- p_discord_handle
  text  -- p_website_url
) TO authenticated;

-- Add comment explaining the function with specific signature
COMMENT ON FUNCTION upsert_user_profile_secure(
  text, -- p_wallet_address
  text, -- p_nickname
  text, -- p_bio
  text, -- p_avatar_url
  text, -- p_twitter_handle
  text, -- p_discord_handle
  text  -- p_website_url
) IS 'Securely upsert user profile with ES256 JWT wallet address validation - Fixed permissions';