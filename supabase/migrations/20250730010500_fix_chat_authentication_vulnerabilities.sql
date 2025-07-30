-- Migration: Fix Critical Chat System Authentication Vulnerabilities
-- Created: 2025-07-30 01:05:00 UTC
-- Description: Replace vulnerable chat functions that accept wallet addresses as parameters
--              with secure versions that get wallet address from JWT authentication context

-- Drop the vulnerable chat functions that accept wallet_address as parameter
DROP FUNCTION IF EXISTS send_chat_message(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS join_chat_room(UUID, TEXT);
DROP FUNCTION IF EXISTS leave_chat_room(UUID, TEXT);
DROP FUNCTION IF EXISTS update_chat_user_settings(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT[]);

-- Create secure function to send chat messages
-- This function does NOT accept wallet_address as a parameter - it gets it from auth.jwt()
CREATE OR REPLACE FUNCTION send_chat_message_secure(
    p_room_id UUID,
    p_message_content TEXT,
    p_message_type TEXT DEFAULT 'text'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_address TEXT;
    v_jwt_claims json;
    message_id UUID;
    user_in_room BOOLEAN;
BEGIN
    -- Get the JWT claims from the current session
    v_jwt_claims := auth.jwt();
    
    -- Ensure user is authenticated
    IF v_jwt_claims IS NULL THEN
        RAISE EXCEPTION 'Authentication required: No JWT token found';
    END IF;
    
    -- Extract wallet address from JWT claims
    v_wallet_address := LOWER(COALESCE(
        v_jwt_claims->>'walletAddress',
        v_jwt_claims->>'wallet_address', 
        v_jwt_claims->>'sub'
    ));
    
    -- Validate that we have a wallet address
    IF v_wallet_address IS NULL OR LENGTH(v_wallet_address) < 10 THEN
        RAISE EXCEPTION 'Invalid authentication: No wallet address found in JWT token';
    END IF;
    
    -- Check if user is in the room
    SELECT EXISTS(
        SELECT 1 FROM chat_room_participants 
        WHERE room_id = p_room_id 
        AND user_wallet_address = v_wallet_address 
        AND is_online = true
    ) INTO user_in_room;
    
    IF NOT user_in_room THEN
        RAISE EXCEPTION 'Access denied: User not in room or room does not exist';
    END IF;
    
    -- Insert the message using authenticated wallet address
    INSERT INTO chat_messages (room_id, user_wallet_address, message_content, message_type)
    VALUES (p_room_id, v_wallet_address, p_message_content, p_message_type)
    RETURNING id INTO message_id;
    
    -- Update user's last seen timestamp
    UPDATE chat_room_participants 
    SET last_seen = NOW()
    WHERE room_id = p_room_id 
    AND user_wallet_address = v_wallet_address;
    
    RETURN message_id;
END;
$$;

-- Create secure function to join chat rooms
-- This function does NOT accept wallet_address as a parameter - it gets it from auth.jwt()
CREATE OR REPLACE FUNCTION join_chat_room_secure(
    p_room_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_address TEXT;
    v_jwt_claims json;
    room_exists BOOLEAN;
    room_full BOOLEAN;
    current_participants INTEGER;
    max_participants INTEGER;
BEGIN
    -- Get the JWT claims from the current session
    v_jwt_claims := auth.jwt();
    
    -- Ensure user is authenticated
    IF v_jwt_claims IS NULL THEN
        RAISE EXCEPTION 'Authentication required: No JWT token found';
    END IF;
    
    -- Extract wallet address from JWT claims
    v_wallet_address := LOWER(COALESCE(
        v_jwt_claims->>'walletAddress',
        v_jwt_claims->>'wallet_address', 
        v_jwt_claims->>'sub'
    ));
    
    -- Validate that we have a wallet address
    IF v_wallet_address IS NULL OR LENGTH(v_wallet_address) < 10 THEN
        RAISE EXCEPTION 'Invalid authentication: No wallet address found in JWT token';
    END IF;
    
    -- Check if room exists and is active
    SELECT EXISTS(SELECT 1 FROM chat_rooms WHERE id = p_room_id AND is_active = true) INTO room_exists;
    
    IF NOT room_exists THEN
        RETURN false;
    END IF;
    
    -- Check room capacity
    SELECT max_users INTO max_participants FROM chat_rooms WHERE id = p_room_id;
    SELECT COUNT(*) INTO current_participants FROM chat_room_participants 
    WHERE room_id = p_room_id AND is_online = true;
    
    IF current_participants >= max_participants THEN
        RETURN false;
    END IF;
    
    -- Insert or update participant record using authenticated wallet address
    INSERT INTO chat_room_participants (room_id, user_wallet_address, is_online, last_seen)
    VALUES (p_room_id, v_wallet_address, true, NOW())
    ON CONFLICT (room_id, user_wallet_address) 
    DO UPDATE SET 
        is_online = true,
        last_seen = NOW();
    
    RETURN true;
END;
$$;

-- Create secure function to leave chat rooms
-- This function does NOT accept wallet_address as a parameter - it gets it from auth.jwt()
CREATE OR REPLACE FUNCTION leave_chat_room_secure(
    p_room_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_address TEXT;
    v_jwt_claims json;
BEGIN
    -- Get the JWT claims from the current session
    v_jwt_claims := auth.jwt();
    
    -- Ensure user is authenticated
    IF v_jwt_claims IS NULL THEN
        RAISE EXCEPTION 'Authentication required: No JWT token found';
    END IF;
    
    -- Extract wallet address from JWT claims
    v_wallet_address := LOWER(COALESCE(
        v_jwt_claims->>'walletAddress',
        v_jwt_claims->>'wallet_address', 
        v_jwt_claims->>'sub'
    ));
    
    -- Validate that we have a wallet address
    IF v_wallet_address IS NULL OR LENGTH(v_wallet_address) < 10 THEN
        RAISE EXCEPTION 'Invalid authentication: No wallet address found in JWT token';
    END IF;
    
    -- Update participant record using authenticated wallet address
    UPDATE chat_room_participants 
    SET is_online = false, last_seen = NOW()
    WHERE room_id = p_room_id 
    AND user_wallet_address = v_wallet_address;
    
    RETURN FOUND;
END;
$$;

-- Create secure function to update chat user settings
-- This function does NOT accept wallet_address as a parameter - it gets it from auth.jwt()
CREATE OR REPLACE FUNCTION update_chat_user_settings_secure(
    p_is_chat_enabled BOOLEAN DEFAULT NULL,
    p_show_timestamps BOOLEAN DEFAULT NULL,
    p_sound_notifications BOOLEAN DEFAULT NULL,
    p_muted_users TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_address TEXT;
    v_jwt_claims json;
BEGIN
    -- Get the JWT claims from the current session
    v_jwt_claims := auth.jwt();
    
    -- Ensure user is authenticated
    IF v_jwt_claims IS NULL THEN
        RAISE EXCEPTION 'Authentication required: No JWT token found';
    END IF;
    
    -- Extract wallet address from JWT claims
    v_wallet_address := LOWER(COALESCE(
        v_jwt_claims->>'walletAddress',
        v_jwt_claims->>'wallet_address', 
        v_jwt_claims->>'sub'
    ));
    
    -- Validate that we have a wallet address
    IF v_wallet_address IS NULL OR LENGTH(v_wallet_address) < 10 THEN
        RAISE EXCEPTION 'Invalid authentication: No wallet address found in JWT token';
    END IF;
    
    -- Insert or update settings using authenticated wallet address
    INSERT INTO chat_user_settings (
        user_wallet_address, 
        is_chat_enabled, 
        show_timestamps, 
        sound_notifications, 
        muted_users
    )
    VALUES (
        v_wallet_address,
        COALESCE(p_is_chat_enabled, true),
        COALESCE(p_show_timestamps, true),
        COALESCE(p_sound_notifications, true),
        COALESCE(p_muted_users, '{}')
    )
    ON CONFLICT (user_wallet_address) 
    DO UPDATE SET
        is_chat_enabled = COALESCE(p_is_chat_enabled, chat_user_settings.is_chat_enabled),
        show_timestamps = COALESCE(p_show_timestamps, chat_user_settings.show_timestamps),
        sound_notifications = COALESCE(p_sound_notifications, chat_user_settings.sound_notifications),
        muted_users = COALESCE(p_muted_users, chat_user_settings.muted_users),
        updated_at = NOW();
    
    RETURN true;
END;
$$;

-- Also create a secure version of get_chat_user_settings that gets wallet from JWT
CREATE OR REPLACE FUNCTION get_chat_user_settings_secure()
RETURNS TABLE (
    user_wallet_address TEXT,
    is_chat_enabled BOOLEAN,
    show_timestamps BOOLEAN,
    sound_notifications BOOLEAN,
    muted_users TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_address TEXT;
    v_jwt_claims json;
BEGIN
    -- Get the JWT claims from the current session
    v_jwt_claims := auth.jwt();
    
    -- Ensure user is authenticated
    IF v_jwt_claims IS NULL THEN
        RAISE EXCEPTION 'Authentication required: No JWT token found';
    END IF;
    
    -- Extract wallet address from JWT claims
    v_wallet_address := LOWER(COALESCE(
        v_jwt_claims->>'walletAddress',
        v_jwt_claims->>'wallet_address', 
        v_jwt_claims->>'sub'
    ));
    
    -- Validate that we have a wallet address
    IF v_wallet_address IS NULL OR LENGTH(v_wallet_address) < 10 THEN
        RAISE EXCEPTION 'Invalid authentication: No wallet address found in JWT token';
    END IF;
    
    RETURN QUERY
    SELECT 
        cus.user_wallet_address,
        cus.is_chat_enabled,
        cus.show_timestamps,
        cus.sound_notifications,
        cus.muted_users
    FROM chat_user_settings cus
    WHERE cus.user_wallet_address = v_wallet_address;
    
    -- If no settings exist, return defaults
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            v_wallet_address::TEXT,
            true::BOOLEAN,
            true::BOOLEAN,
            true::BOOLEAN,
            '{}'::TEXT[];
    END IF;
END;
$$;

-- Grant execute permissions to authenticated users only
GRANT EXECUTE ON FUNCTION send_chat_message_secure(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION join_chat_room_secure(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION leave_chat_room_secure(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_chat_user_settings_secure(BOOLEAN, BOOLEAN, BOOLEAN, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_chat_user_settings_secure() TO authenticated;

-- Revoke access from anonymous users (extra security)
REVOKE EXECUTE ON FUNCTION send_chat_message_secure(UUID, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION join_chat_room_secure(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION leave_chat_room_secure(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION update_chat_user_settings_secure(BOOLEAN, BOOLEAN, BOOLEAN, TEXT[]) FROM anon;
REVOKE EXECUTE ON FUNCTION get_chat_user_settings_secure() FROM anon;

-- Add comments explaining the security fixes
COMMENT ON FUNCTION send_chat_message_secure(UUID, TEXT, TEXT) IS 'SECURE: Send chat message function that gets wallet address from JWT authentication context instead of trusting client input. Fixes critical authentication bypass vulnerability.';
COMMENT ON FUNCTION join_chat_room_secure(UUID) IS 'SECURE: Join chat room function that gets wallet address from JWT authentication context instead of trusting client input. Fixes critical authentication bypass vulnerability.';
COMMENT ON FUNCTION leave_chat_room_secure(UUID) IS 'SECURE: Leave chat room function that gets wallet address from JWT authentication context instead of trusting client input. Fixes critical authentication bypass vulnerability.';
COMMENT ON FUNCTION update_chat_user_settings_secure(BOOLEAN, BOOLEAN, BOOLEAN, TEXT[]) IS 'SECURE: Update chat settings function that gets wallet address from JWT authentication context instead of trusting client input. Fixes critical authentication bypass vulnerability.';
COMMENT ON FUNCTION get_chat_user_settings_secure() IS 'SECURE: Get chat settings function that gets wallet address from JWT authentication context instead of trusting client input. Fixes critical authentication bypass vulnerability.';

-- Log the security fix
COMMENT ON SCHEMA public IS 'Chat system authentication vulnerabilities fixed at 20250730010500 - wallet addresses now extracted from JWT context instead of client parameters';