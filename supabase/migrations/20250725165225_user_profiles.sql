-- Migration: User Profiles
-- Created: 2025-07-25 16:52:25 UTC
-- Description: Creates user profiles table with nickname/username and avatar support

-- Enable necessary extensions for storage
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table - stores user profile information associated with wallet addresses
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    nickname TEXT,
    username TEXT UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet_address ON user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles(updated_at DESC);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to user profiles (for displaying usernames/avatars)
CREATE POLICY "Allow public read access on user_profiles" ON user_profiles FOR SELECT USING (true);

-- Allow users to insert their own profile
CREATE POLICY "Allow users to insert their own profile" ON user_profiles 
    FOR INSERT WITH CHECK (true);

-- Allow users to update their own profile
CREATE POLICY "Allow users to update their own profile" ON user_profiles 
    FOR UPDATE USING (true);

-- Create storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatar uploads
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can upload an avatar" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Anyone can update their own avatar" ON storage.objects
    FOR UPDATE USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can delete their own avatar" ON storage.objects
    FOR DELETE USING (bucket_id = 'avatars');

-- Function to get user profile by wallet address
CREATE OR REPLACE FUNCTION get_user_profile(wallet_addr TEXT)
RETURNS TABLE (
    id UUID,
    wallet_address TEXT,
    nickname TEXT,
    username TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.wallet_address,
        up.nickname,
        up.username,
        up.avatar_url,
        up.bio,
        up.created_at,
        up.updated_at
    FROM user_profiles up
    WHERE up.wallet_address = LOWER(wallet_addr);
END;
$$ LANGUAGE plpgsql;

-- Function to upsert user profile
CREATE OR REPLACE FUNCTION upsert_user_profile(
    wallet_addr TEXT,
    p_nickname TEXT DEFAULT NULL,
    p_username TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    wallet_address TEXT,
    nickname TEXT,
    username TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    existing_profile user_profiles%ROWTYPE;
BEGIN
    -- Check if profile exists
    SELECT * INTO existing_profile FROM user_profiles WHERE user_profiles.wallet_address = LOWER(wallet_addr);
    
    IF existing_profile.id IS NOT NULL THEN
        -- Update existing profile
        UPDATE user_profiles SET
            nickname = COALESCE(p_nickname, user_profiles.nickname),
            username = COALESCE(p_username, user_profiles.username),
            avatar_url = COALESCE(p_avatar_url, user_profiles.avatar_url),
            bio = COALESCE(p_bio, user_profiles.bio),
            updated_at = NOW()
        WHERE user_profiles.wallet_address = LOWER(wallet_addr);
    ELSE
        -- Insert new profile
        INSERT INTO user_profiles (wallet_address, nickname, username, avatar_url, bio)
        VALUES (LOWER(wallet_addr), p_nickname, p_username, p_avatar_url, p_bio);
    END IF;
    
    -- Return the updated/inserted profile
    RETURN QUERY
    SELECT 
        up.id,
        up.wallet_address,
        up.nickname,
        up.username,
        up.avatar_url,
        up.bio,
        up.created_at,
        up.updated_at
    FROM user_profiles up
    WHERE up.wallet_address = LOWER(wallet_addr);
END;
$$ LANGUAGE plpgsql;

-- Function to check username availability
CREATE OR REPLACE FUNCTION is_username_available(p_username TEXT, exclude_wallet_addr TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    username_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO username_count
    FROM user_profiles
    WHERE username = p_username
    AND (exclude_wallet_addr IS NULL OR wallet_address != LOWER(exclude_wallet_addr));
    
    RETURN username_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE user_profiles IS 'Stores user profile information associated with wallet addresses';
COMMENT ON COLUMN user_profiles.wallet_address IS 'Ethereum wallet address (lowercase, unique)';
COMMENT ON COLUMN user_profiles.nickname IS 'Display name for the user (not unique)';
COMMENT ON COLUMN user_profiles.username IS 'Unique username for the user';
COMMENT ON COLUMN user_profiles.avatar_url IS 'URL to user avatar image stored in Supabase Storage';
COMMENT ON COLUMN user_profiles.bio IS 'User biography/description';

COMMENT ON FUNCTION get_user_profile(TEXT) IS 'Retrieves user profile by wallet address';
COMMENT ON FUNCTION upsert_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT) IS 'Creates or updates user profile';
COMMENT ON FUNCTION is_username_available(TEXT, TEXT) IS 'Checks if username is available';