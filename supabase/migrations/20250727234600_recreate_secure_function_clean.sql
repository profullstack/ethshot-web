-- Migration: Recreate secure function cleanly after dropping conflicts
-- This migration creates the final ES256 JWT secure function

-- Create the secure function that validates ES256 JWT tokens
CREATE OR REPLACE FUNCTION upsert_user_profile_secure(
  p_wallet_address text,
  p_nickname text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_twitter_handle text DEFAULT NULL,
  p_discord_handle text DEFAULT NULL,
  p_website_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_result json;
  v_jwt_wallet_address text;
BEGIN
  -- Validate input
  IF p_wallet_address IS NULL OR p_wallet_address = '' THEN
    RAISE EXCEPTION 'Wallet address is required';
  END IF;

  -- Extract wallet address from JWT token in the current context
  -- This will be validated by Supabase's JWT verification using our ES256 public key
  v_jwt_wallet_address := COALESCE(
    auth.jwt() ->> 'wallet_address',
    auth.jwt() ->> 'walletAddress',
    auth.jwt() ->> 'sub'
  );

  -- Ensure the wallet address in the JWT matches the provided wallet address
  IF v_jwt_wallet_address IS NULL THEN
    RAISE EXCEPTION 'No wallet address found in JWT token';
  END IF;

  IF LOWER(v_jwt_wallet_address) != LOWER(p_wallet_address) THEN
    RAISE EXCEPTION 'JWT wallet address does not match provided wallet address';
  END IF;

  -- Normalize wallet address to lowercase for consistency
  p_wallet_address := LOWER(p_wallet_address);

  -- Check if user already exists
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
      created_at,
      updated_at
    )
    VALUES (
      p_wallet_address,
      p_nickname,
      p_bio,
      p_avatar_url,
      p_twitter_handle,
      p_discord_handle,
      p_website_url,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_user_id;
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
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_result
  FROM user_profiles
  WHERE id = v_user_id;

  RETURN v_result;
END;
$$;

-- Note: GRANT permissions handled in separate migration to avoid function signature conflicts
-- Note: COMMENT handled in separate migration to avoid function signature conflicts