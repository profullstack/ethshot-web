-- Migration: Chat System
-- Created: 2025-07-26 02:15:00 UTC
-- Description: Creates chat rooms, messages, and user management for real-time chat

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Chat rooms table - stores different chat rooms (global, game-specific, etc.)
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'global', -- 'global', 'game', 'private'
    description TEXT,
    max_users INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table - stores all chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_wallet_address TEXT NOT NULL,
    message_content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- 'text', 'system', 'emote'
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat room participants - tracks who is in which room
CREATE TABLE IF NOT EXISTS chat_room_participants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_wallet_address TEXT NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_online BOOLEAN DEFAULT true,
    UNIQUE(room_id, user_wallet_address)
);

-- Chat user settings - user preferences for chat
CREATE TABLE IF NOT EXISTS chat_user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_wallet_address TEXT UNIQUE NOT NULL,
    is_chat_enabled BOOLEAN DEFAULT true,
    show_timestamps BOOLEAN DEFAULT true,
    sound_notifications BOOLEAN DEFAULT true,
    muted_users TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON chat_rooms(type);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_is_active ON chat_rooms(is_active);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_wallet ON chat_messages(user_wallet_address);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_participants_room_id ON chat_room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_wallet ON chat_room_participants(user_wallet_address);
CREATE INDEX IF NOT EXISTS idx_chat_participants_online ON chat_room_participants(is_online);

CREATE INDEX IF NOT EXISTS idx_chat_user_settings_wallet ON chat_user_settings(user_wallet_address);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_chat_rooms_updated_at 
    BEFORE UPDATE ON chat_rooms 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON chat_messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_user_settings_updated_at 
    BEFORE UPDATE ON chat_user_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_user_settings ENABLE ROW LEVEL SECURITY;

-- Chat rooms policies - public read access
CREATE POLICY "Allow public read access on chat_rooms" ON chat_rooms FOR SELECT USING (is_active = true);

-- Chat messages policies - users can read messages from rooms they're in
CREATE POLICY "Allow users to read messages from joined rooms" ON chat_messages 
    FOR SELECT USING (
        room_id IN (
            SELECT room_id FROM chat_room_participants 
            WHERE user_wallet_address = current_setting('app.current_user_wallet', true)
        )
    );

-- Users can insert their own messages
CREATE POLICY "Allow users to insert their own messages" ON chat_messages 
    FOR INSERT WITH CHECK (user_wallet_address = current_setting('app.current_user_wallet', true));

-- Users can update their own messages (for editing)
CREATE POLICY "Allow users to update their own messages" ON chat_messages 
    FOR UPDATE USING (user_wallet_address = current_setting('app.current_user_wallet', true));

-- Chat room participants policies
CREATE POLICY "Allow users to read room participants" ON chat_room_participants FOR SELECT USING (true);
CREATE POLICY "Allow users to join rooms" ON chat_room_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to update their own participation" ON chat_room_participants 
    FOR UPDATE USING (user_wallet_address = current_setting('app.current_user_wallet', true));

-- Chat user settings policies
CREATE POLICY "Allow users to read their own settings" ON chat_user_settings 
    FOR SELECT USING (user_wallet_address = current_setting('app.current_user_wallet', true));
CREATE POLICY "Allow users to insert their own settings" ON chat_user_settings 
    FOR INSERT WITH CHECK (user_wallet_address = current_setting('app.current_user_wallet', true));
CREATE POLICY "Allow users to update their own settings" ON chat_user_settings 
    FOR UPDATE USING (user_wallet_address = current_setting('app.current_user_wallet', true));

-- Insert default chat rooms
INSERT INTO chat_rooms (name, type, description, max_users) VALUES
    ('Global Chat', 'global', 'General discussion for all players', 100),
    ('Trash Talk', 'global', 'Let the trash talking begin!', 50),
    ('Game Discussion', 'game', 'Discuss game strategies and tips', 75)
ON CONFLICT DO NOTHING;

-- Function to get chat messages with user profile information
CREATE OR REPLACE FUNCTION get_chat_messages(
    p_room_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    room_id UUID,
    user_wallet_address TEXT,
    nickname TEXT,
    avatar_url TEXT,
    message_content TEXT,
    message_type TEXT,
    is_deleted BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.id,
        cm.room_id,
        cm.user_wallet_address,
        COALESCE(up.nickname, SUBSTRING(cm.user_wallet_address, 1, 8) || '...') as nickname,
        up.avatar_url,
        cm.message_content,
        cm.message_type,
        cm.is_deleted,
        cm.created_at
    FROM chat_messages cm
    LEFT JOIN user_profiles up ON up.wallet_address = cm.user_wallet_address
    WHERE cm.room_id = p_room_id 
    AND cm.is_deleted = false
    ORDER BY cm.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to join a chat room
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
$$ LANGUAGE plpgsql;

-- Function to leave a chat room
CREATE OR REPLACE FUNCTION leave_chat_room(
    p_room_id UUID,
    p_user_wallet_address TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE chat_room_participants 
    SET is_online = false, last_seen = NOW()
    WHERE room_id = p_room_id 
    AND user_wallet_address = LOWER(p_user_wallet_address);
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to send a chat message
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
$$ LANGUAGE plpgsql;

-- Function to get user's chat settings
CREATE OR REPLACE FUNCTION get_chat_user_settings(p_user_wallet_address TEXT)
RETURNS TABLE (
    user_wallet_address TEXT,
    is_chat_enabled BOOLEAN,
    show_timestamps BOOLEAN,
    sound_notifications BOOLEAN,
    muted_users TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cus.user_wallet_address,
        cus.is_chat_enabled,
        cus.show_timestamps,
        cus.sound_notifications,
        cus.muted_users
    FROM chat_user_settings cus
    WHERE cus.user_wallet_address = LOWER(p_user_wallet_address);
    
    -- If no settings exist, return defaults
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            LOWER(p_user_wallet_address)::TEXT,
            true::BOOLEAN,
            true::BOOLEAN,
            true::BOOLEAN,
            '{}'::TEXT[];
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update user chat settings
CREATE OR REPLACE FUNCTION update_chat_user_settings(
    p_user_wallet_address TEXT,
    p_is_chat_enabled BOOLEAN DEFAULT NULL,
    p_show_timestamps BOOLEAN DEFAULT NULL,
    p_sound_notifications BOOLEAN DEFAULT NULL,
    p_muted_users TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO chat_user_settings (
        user_wallet_address, 
        is_chat_enabled, 
        show_timestamps, 
        sound_notifications, 
        muted_users
    )
    VALUES (
        LOWER(p_user_wallet_address),
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
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE chat_rooms IS 'Stores different chat rooms (global, game-specific, private)';
COMMENT ON TABLE chat_messages IS 'Stores all chat messages with user and room references';
COMMENT ON TABLE chat_room_participants IS 'Tracks which users are in which chat rooms';
COMMENT ON TABLE chat_user_settings IS 'Stores user preferences for chat functionality';

COMMENT ON FUNCTION get_chat_messages(UUID, INTEGER, INTEGER) IS 'Retrieves chat messages with user profile information';
COMMENT ON FUNCTION join_chat_room(UUID, TEXT) IS 'Adds user to a chat room';
COMMENT ON FUNCTION leave_chat_room(UUID, TEXT) IS 'Removes user from a chat room';
COMMENT ON FUNCTION send_chat_message(UUID, TEXT, TEXT, TEXT) IS 'Sends a message to a chat room';
COMMENT ON FUNCTION get_chat_user_settings(TEXT) IS 'Gets user chat preferences';
COMMENT ON FUNCTION update_chat_user_settings(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT[]) IS 'Updates user chat preferences';