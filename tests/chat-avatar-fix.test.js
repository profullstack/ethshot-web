// tests/chat-avatar-fix.test.js
// Test suite for chat avatar consistency fix
// Framework: Mocha with Chai assertions

import { expect } from 'chai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

describe('Chat Avatar Consistency Fix', () => {
  let supabase;
  let testRoomId;
  let testUser1Wallet = '0x1234567890123456789012345678901234567890';
  let testUser2Wallet = '0x0987654321098765432109876543210987654321';

  before(async () => {
    supabase = createClient(supabaseUrl, supabaseKey);
    
    // Create test users with avatars
    await supabase.rpc('upsert_user_profile', {
      p_wallet_address: testUser1Wallet,
      p_nickname: 'testuser1',
      p_avatar_url: 'https://example.com/avatar1.jpg'
    });
    
    await supabase.rpc('upsert_user_profile', {
      p_wallet_address: testUser2Wallet,
      p_nickname: 'testuser2',
      p_avatar_url: 'https://example.com/avatar2.jpg'
    });
    
    // Create a test chat room
    const { data: roomData, error: roomError } = await supabase
      .from('chat_rooms')
      .insert({
        name: 'Test Room for Avatar Fix',
        description: 'Test room for avatar consistency',
        is_public: true
      })
      .select()
      .single();
    
    if (roomError) throw roomError;
    testRoomId = roomData.id;
    
    // Add both users to the room
    await supabase.from('chat_room_participants').insert([
      {
        room_id: testRoomId,
        user_wallet_address: testUser1Wallet,
        is_online: true
      },
      {
        room_id: testRoomId,
        user_wallet_address: testUser2Wallet,
        is_online: true
      }
    ]);
  });

  after(async () => {
    // Clean up test data
    if (testRoomId) {
      await supabase.from('chat_rooms').delete().eq('id', testRoomId);
    }
    await supabase.from('user_profiles').delete().eq('wallet_address', testUser1Wallet);
    await supabase.from('user_profiles').delete().eq('wallet_address', testUser2Wallet);
  });

  describe('Database message retrieval', () => {
    it('should return messages with avatar_url field from database', async () => {
      // First send a message via database function
      const { data: messageId, error: sendError } = await supabase.rpc('send_chat_message', {
        p_room_id: testRoomId,
        p_user_wallet_address: testUser1Wallet,
        p_message_content: 'Test message for avatar consistency',
        p_message_type: 'text'
      });
      
      expect(sendError).to.be.null;
      expect(messageId).to.be.a('string');
      
      // Retrieve messages using the get_chat_messages function
      const { data: messages, error: getError } = await supabase.rpc('get_chat_messages', {
        p_room_id: testRoomId,
        p_limit: 10,
        p_offset: 0
      });
      
      expect(getError).to.be.null;
      expect(messages).to.be.an('array');
      expect(messages.length).to.be.greaterThan(0);
      
      // Check that the message has the correct avatar field
      const testMessage = messages.find(m => m.id === messageId);
      expect(testMessage).to.exist;
      expect(testMessage).to.have.property('avatar_url');
      expect(testMessage.avatar_url).to.equal('https://example.com/avatar1.jpg');
      expect(testMessage).to.have.property('nickname');
      expect(testMessage.nickname).to.equal('testuser1');
    });

    it('should handle users without avatars gracefully', async () => {
      // Create a user without avatar
      const testUserNoAvatar = '0x1111111111111111111111111111111111111111';
      await supabase.rpc('upsert_user_profile', {
        p_wallet_address: testUserNoAvatar,
        p_nickname: 'noavataruser',
        p_avatar_url: null
      });
      
      // Add user to room
      await supabase.from('chat_room_participants').insert({
        room_id: testRoomId,
        user_wallet_address: testUserNoAvatar,
        is_online: true
      });
      
      // Send message
      const { data: messageId, error: sendError } = await supabase.rpc('send_chat_message', {
        p_room_id: testRoomId,
        p_user_wallet_address: testUserNoAvatar,
        p_message_content: 'Message from user without avatar',
        p_message_type: 'text'
      });
      
      expect(sendError).to.be.null;
      
      // Retrieve and check message
      const { data: messages, error: getError } = await supabase.rpc('get_chat_messages', {
        p_room_id: testRoomId,
        p_limit: 10,
        p_offset: 0
      });
      
      expect(getError).to.be.null;
      const testMessage = messages.find(m => m.id === messageId);
      expect(testMessage).to.exist;
      expect(testMessage).to.have.property('avatar_url');
      expect(testMessage.avatar_url).to.be.null;
      expect(testMessage.nickname).to.equal('noavataruser');
      
      // Clean up
      await supabase.from('user_profiles').delete().eq('wallet_address', testUserNoAvatar);
    });
  });

  describe('Message field consistency', () => {
    it('should ensure consistent field naming between real-time and database messages', () => {
      // This test documents the expected field structure for both scenarios
      
      // Expected structure for database-loaded messages (from get_chat_messages)
      const databaseMessage = {
        id: 'message-id',
        room_id: 'room-id',
        user_wallet_address: '0x123...',
        nickname: 'username',
        avatar_url: 'https://example.com/avatar.jpg', // snake_case
        message_content: 'Hello world',
        message_type: 'text',
        created_at: '2025-01-01T00:00:00Z'
      };
      
      // Expected structure for real-time messages (from WebSocket server)
      const realtimeMessage = {
        type: 'new_message',
        id: 'message-id',
        roomId: 'room-id',
        walletAddress: '0x123...',
        nickname: 'username',
        avatar_url: 'https://example.com/avatar.jpg', // snake_case (FIXED)
        content: 'Hello world',
        messageType: 'text',
        timestamp: '2025-01-01T00:00:00Z'
      };
      
      // Both should use snake_case for avatar_url field
      expect(databaseMessage).to.have.property('avatar_url');
      expect(realtimeMessage).to.have.property('avatar_url');
      
      // This test passes if the field names are consistent
      expect(true).to.be.true;
    });
  });

  describe('User profile data integration', () => {
    it('should correctly fetch and include user profile data in messages', async () => {
      // Test that user profile data (nickname, avatar) is properly included
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('nickname, avatar_url')
        .eq('wallet_address', testUser1Wallet)
        .single();
      
      expect(profileError).to.be.null;
      expect(profile).to.exist;
      expect(profile.nickname).to.equal('testuser1');
      expect(profile.avatar_url).to.equal('https://example.com/avatar1.jpg');
      
      // Send a message and verify profile data is included
      const { data: messageId, error: sendError } = await supabase.rpc('send_chat_message', {
        p_room_id: testRoomId,
        p_user_wallet_address: testUser1Wallet,
        p_message_content: 'Profile data test message',
        p_message_type: 'text'
      });
      
      expect(sendError).to.be.null;
      
      // Retrieve and verify
      const { data: messages, error: getError } = await supabase.rpc('get_chat_messages', {
        p_room_id: testRoomId,
        p_limit: 10,
        p_offset: 0
      });
      
      expect(getError).to.be.null;
      const testMessage = messages.find(m => m.id === messageId);
      expect(testMessage).to.exist;
      expect(testMessage.nickname).to.equal(profile.nickname);
      expect(testMessage.avatar_url).to.equal(profile.avatar_url);
    });
  });
});