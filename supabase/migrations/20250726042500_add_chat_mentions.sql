-- Migration: Add Chat Mentions System
-- Created: 2025-07-26 04:25:00 UTC
-- Description: Adds mention tracking and notification system for @nickname functionality

-- Chat mentions table - tracks when users are mentioned in messages
CREATE TABLE IF NOT EXISTS chat_mentions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    mentioned_user_wallet TEXT NOT NULL,
    mentioned_by_wallet TEXT NOT NULL,
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_mentions_mentioned_user ON chat_mentions(mentioned_user_wallet);
CREATE INDEX IF NOT EXISTS idx_chat_mentions_message_id ON chat_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_mentions_room_id ON chat_mentions(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_mentions_is_read ON chat_mentions(is_read);
CREATE INDEX IF NOT EXISTS idx_chat_mentions_created_at ON chat_mentions(created_at DESC);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_chat_mentions_updated_at 
    BEFORE UPDATE ON chat_mentions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE chat_mentions ENABLE ROW LEVEL SECURITY;

-- Users can read mentions directed at them
CREATE POLICY "Allow users to read their own mentions" ON chat_mentions 
    FOR SELECT USING (mentioned_user_wallet = current_setting('app.current_user_wallet', true));

-- Users can insert mentions (when they mention others)
CREATE POLICY "Allow users to create mentions" ON chat_mentions 
    FOR INSERT WITH CHECK (mentioned_by_wallet = current_setting('app.current_user_wallet', true));

-- Users can update their own mention read status
CREATE POLICY "Allow users to update their mention read status" ON chat_mentions 
    FOR UPDATE USING (mentioned_user_wallet = current_setting('app.current_user_wallet', true));

-- Function to extract mentions from message content and create mention records
CREATE OR REPLACE FUNCTION process_message_mentions(
    p_message_id UUID,
    p_message_content TEXT,
    p_room_id UUID,
    p_mentioned_by_wallet TEXT
)
RETURNS INTEGER AS $$
DECLARE
    mention_pattern TEXT := '@([a-zA-Z0-9_]+)';
    mentioned_nickname TEXT;
    mentioned_wallet TEXT;
    mention_count INTEGER := 0;
BEGIN
    -- Extract all @nickname mentions from the message
    FOR mentioned_nickname IN 
        SELECT DISTINCT regexp_replace(match[1], '^@', '') 
        FROM regexp_split_to_table(p_message_content, '\s+') AS t(word),
             regexp_matches(word, mention_pattern, 'g') AS match
    LOOP
        -- Find the wallet address for this nickname
        SELECT wallet_address INTO mentioned_wallet
        FROM user_profiles 
        WHERE nickname = mentioned_nickname
        LIMIT 1;
        
        -- If we found a valid user and they're not mentioning themselves
        IF mentioned_wallet IS NOT NULL AND mentioned_wallet != LOWER(p_mentioned_by_wallet) THEN
            -- Check if the mentioned user is in the room
            IF EXISTS(
                SELECT 1 FROM chat_room_participants 
                WHERE room_id = p_room_id 
                AND user_wallet_address = mentioned_wallet 
                AND is_online = true
            ) THEN
                -- Create mention record
                INSERT INTO chat_mentions (
                    message_id, 
                    mentioned_user_wallet, 
                    mentioned_by_wallet, 
                    room_id
                )
                VALUES (
                    p_message_id, 
                    mentioned_wallet, 
                    LOWER(p_mentioned_by_wallet), 
                    p_room_id
                );
                
                mention_count := mention_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN mention_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get unread mentions for a user
CREATE OR REPLACE FUNCTION get_unread_mentions(p_user_wallet_address TEXT)
RETURNS TABLE (
    id UUID,
    message_id UUID,
    room_id UUID,
    room_name TEXT,
    mentioned_by_wallet TEXT,
    mentioned_by_nickname TEXT,
    message_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.id,
        cm.message_id,
        cm.room_id,
        cr.name as room_name,
        cm.mentioned_by_wallet,
        COALESCE(up.nickname, SUBSTRING(cm.mentioned_by_wallet, 1, 8) || '...') as mentioned_by_nickname,
        msg.message_content,
        cm.created_at
    FROM chat_mentions cm
    JOIN chat_messages msg ON msg.id = cm.message_id
    JOIN chat_rooms cr ON cr.id = cm.room_id
    LEFT JOIN user_profiles up ON up.wallet_address = cm.mentioned_by_wallet
    WHERE cm.mentioned_user_wallet = LOWER(p_user_wallet_address)
    AND cm.is_read = false
    AND msg.is_deleted = false
    ORDER BY cm.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to mark mentions as read
CREATE OR REPLACE FUNCTION mark_mentions_as_read(
    p_user_wallet_address TEXT,
    p_room_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    IF p_room_id IS NOT NULL THEN
        -- Mark mentions as read for specific room
        UPDATE chat_mentions 
        SET is_read = true, updated_at = NOW()
        WHERE mentioned_user_wallet = LOWER(p_user_wallet_address)
        AND room_id = p_room_id
        AND is_read = false;
    ELSE
        -- Mark all mentions as read
        UPDATE chat_mentions 
        SET is_read = true, updated_at = NOW()
        WHERE mentioned_user_wallet = LOWER(p_user_wallet_address)
        AND is_read = false;
    END IF;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get mention count for a user (optionally by room)
CREATE OR REPLACE FUNCTION get_mention_count(
    p_user_wallet_address TEXT,
    p_room_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    mention_count INTEGER;
BEGIN
    IF p_room_id IS NOT NULL THEN
        -- Count mentions for specific room
        SELECT COUNT(*) INTO mention_count
        FROM chat_mentions
        WHERE mentioned_user_wallet = LOWER(p_user_wallet_address)
        AND room_id = p_room_id
        AND is_read = false;
    ELSE
        -- Count all unread mentions
        SELECT COUNT(*) INTO mention_count
        FROM chat_mentions
        WHERE mentioned_user_wallet = LOWER(p_user_wallet_address)
        AND is_read = false;
    END IF;
    
    RETURN COALESCE(mention_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Update the send_chat_message function to process mentions
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
    mention_count INTEGER;
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
    
    -- Process mentions in the message
    SELECT process_message_mentions(
        message_id, 
        p_message_content, 
        p_room_id, 
        p_user_wallet_address
    ) INTO mention_count;
    
    -- Update user's last seen timestamp
    UPDATE chat_room_participants 
    SET last_seen = NOW()
    WHERE room_id = p_room_id 
    AND user_wallet_address = LOWER(p_user_wallet_address);
    
    RETURN message_id;
END;
$$ LANGUAGE plpgsql;

-- Function to search for users by nickname (for autocomplete)
CREATE OR REPLACE FUNCTION search_nicknames_for_mention(
    p_query TEXT,
    p_room_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    nickname TEXT,
    wallet_address TEXT,
    avatar_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.nickname,
        up.wallet_address,
        up.avatar_url
    FROM user_profiles up
    JOIN chat_room_participants crp ON crp.user_wallet_address = up.wallet_address
    WHERE crp.room_id = p_room_id
    AND crp.is_online = true
    AND up.nickname IS NOT NULL
    AND up.nickname ILIKE p_query || '%'
    ORDER BY up.nickname
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE chat_mentions IS 'Tracks when users are mentioned (@nickname) in chat messages';
COMMENT ON FUNCTION process_message_mentions(UUID, TEXT, UUID, TEXT) IS 'Extracts @nickname mentions from message content and creates mention records';
COMMENT ON FUNCTION get_unread_mentions(TEXT) IS 'Gets all unread mentions for a user';
COMMENT ON FUNCTION mark_mentions_as_read(TEXT, UUID) IS 'Marks mentions as read for a user, optionally filtered by room';
COMMENT ON FUNCTION get_mention_count(TEXT, UUID) IS 'Gets count of unread mentions for a user, optionally filtered by room';
COMMENT ON FUNCTION search_nicknames_for_mention(TEXT, UUID, INTEGER) IS 'Searches for nicknames in a room for autocomplete functionality';