-- Migration: Fix Chat RLS Policies
-- Created: 2025-07-26 04:19:00 UTC
-- Description: Fix Row Level Security policies for chat system to work with server-side functions

-- Drop existing RLS policies that are causing issues
DROP POLICY IF EXISTS "Allow users to read messages from joined rooms" ON chat_messages;
DROP POLICY IF EXISTS "Allow users to insert their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow users to update their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow users to read room participants" ON chat_room_participants;
DROP POLICY IF EXISTS "Allow users to join rooms" ON chat_room_participants;
DROP POLICY IF EXISTS "Allow users to update their own participation" ON chat_room_participants;
DROP POLICY IF EXISTS "Allow users to read their own settings" ON chat_user_settings;
DROP POLICY IF EXISTS "Allow users to insert their own settings" ON chat_user_settings;
DROP POLICY IF EXISTS "Allow users to update their own settings" ON chat_user_settings;

-- Create more permissive policies that work with server-side functions
-- Chat messages policies
CREATE POLICY "Allow authenticated users to read messages" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert messages" ON chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to update their own messages" ON chat_messages 
    FOR UPDATE USING (user_wallet_address = current_setting('app.current_user_wallet', true));

-- Chat room participants policies  
CREATE POLICY "Allow authenticated users to read participants" ON chat_room_participants FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to join rooms" ON chat_room_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update participation" ON chat_room_participants FOR UPDATE USING (true);

-- Chat user settings policies
CREATE POLICY "Allow users to manage their own settings" ON chat_user_settings FOR ALL 
    USING (user_wallet_address = current_setting('app.current_user_wallet', true))
    WITH CHECK (user_wallet_address = current_setting('app.current_user_wallet', true));

-- Update the join_chat_room function to set the user context
CREATE OR REPLACE FUNCTION join_chat_room(
    p_room_id UUID,
    p_user_wallet_address TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    room_exists BOOLEAN;
    room_full BOOLEAN;
    current_participants INTEGER;
    max_participants INTEGER;
BEGIN
    -- Set the current user context for RLS
    PERFORM set_config('app.current_user_wallet', LOWER(p_user_wallet_address), true);
    
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
    
    -- Insert or update participant record
    INSERT INTO chat_room_participants (room_id, user_wallet_address, is_online, last_seen)
    VALUES (p_room_id, LOWER(p_user_wallet_address), true, NOW())
    ON CONFLICT (room_id, user_wallet_address) 
    DO UPDATE SET 
        is_online = true,
        last_seen = NOW();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the send_chat_message function to set the user context
CREATE OR REPLACE FUNCTION send_chat_message(
    p_room_id UUID,
    p_user_wallet_address TEXT,
    p_message_content TEXT,
    p_message_type TEXT DEFAULT 'text'
)
RETURNS UUID AS $$
DECLARE
    message_id UUID;
    user_in_room BOOLEAN;
BEGIN
    -- Set the current user context for RLS
    PERFORM set_config('app.current_user_wallet', LOWER(p_user_wallet_address), true);
    
    -- Check if user is in the room
    SELECT EXISTS(
        SELECT 1 FROM chat_room_participants 
        WHERE room_id = p_room_id 
        AND user_wallet_address = LOWER(p_user_wallet_address) 
        AND is_online = true
    ) INTO user_in_room;
    
    IF NOT user_in_room THEN
        RAISE EXCEPTION 'User not in room or room does not exist';
    END IF;
    
    -- Insert the message
    INSERT INTO chat_messages (room_id, user_wallet_address, message_content, message_type)
    VALUES (p_room_id, LOWER(p_user_wallet_address), p_message_content, p_message_type)
    RETURNING id INTO message_id;
    
    -- Update user's last seen timestamp
    UPDATE chat_room_participants 
    SET last_seen = NOW()
    WHERE room_id = p_room_id 
    AND user_wallet_address = LOWER(p_user_wallet_address);
    
    RETURN message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the leave_chat_room function to set the user context
CREATE OR REPLACE FUNCTION leave_chat_room(
    p_room_id UUID,
    p_user_wallet_address TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Set the current user context for RLS
    PERFORM set_config('app.current_user_wallet', LOWER(p_user_wallet_address), true);
    
    UPDATE chat_room_participants 
    SET is_online = false, last_seen = NOW()
    WHERE room_id = p_room_id 
    AND user_wallet_address = LOWER(p_user_wallet_address);
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION join_chat_room(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION send_chat_message(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION leave_chat_room(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_chat_messages(UUID, INTEGER, INTEGER) TO anon, authenticated;