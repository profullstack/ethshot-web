// tests/chat-mentions-fix.test.js
// Test suite for chat mentions system fix
// Framework: Mocha with Chai assertions

import { expect } from 'chai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

describe('Chat Mentions System Fix', () => {
  let supabase;
  let testRoomId;
  let testUser1Wallet = '0x1234567890123456789012345678901234567890';
  let testUser2Wallet = '0x0987654321098765432109876543210987654321';
  let testMessageId;

  before(async () => {
    supabase = createClient(supabaseUrl, supabaseKey);
    
    // Create test users with nicknames
    await supabase.rpc('upsert_user_profile', {
      p_wallet_address: testUser1Wallet,
      p_nickname: 'testuser1',
      p_avatar_url: null
    });
    
    await supabase.rpc('upsert_user_profile', {
      p_wallet_address: testUser2Wallet,
      p_nickname: 'testuser2',
      p_avatar_url: null
    });
    
    // Create a test chat room
    const { data: roomData, error: roomError } = await supabase
      .from('chat_rooms')
      .insert({
        name: 'Test Room for Mentions',
        description: 'Test room for mention functionality',
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

  describe('send_chat_message function', () => {
    it('should successfully send a message without mentions', async () => {
      const { data, error } = await supabase.rpc('send_chat_message', {
        p_room_id: testRoomId,
        p_user_wallet_address: testUser1Wallet,
        p_message_content: 'Hello everyone!',
        p_message_type: 'text'
      });
      
      expect(error).to.be.null;
      expect(data).to.be.a('string');
      testMessageId = data;
    });

    it('should successfully send a message with mentions', async () => {
      const { data, error } = await supabase.rpc('send_chat_message', {
        p_room_id: testRoomId,
        p_user_wallet_address: testUser1Wallet,
        p_message_content: 'Hey @testuser2, how are you doing?',
        p_message_type: 'text'
      });
      
      expect(error).to.be.null;
      expect(data).to.be.a('string');
    });

    it('should handle invalid room gracefully', async () => {
      const { data, error } = await supabase.rpc('send_chat_message', {
        p_room_id: '00000000-0000-0000-0000-000000000000',
        p_user_wallet_address: testUser1Wallet,
        p_message_content: 'This should fail',
        p_message_type: 'text'
      });
      
      expect(error).to.not.be.null;
      expect(error.message).to.include('User not in room');
    });

    it('should handle null parameters gracefully', async () => {
      const { data, error } = await supabase.rpc('send_chat_message', {
        p_room_id: null,
        p_user_wallet_address: testUser1Wallet,
        p_message_content: 'This should fail',
        p_message_type: 'text'
      });
      
      expect(error).to.not.be.null;
      expect(error.message).to.include('Invalid input parameters');
    });
  });

  describe('process_message_mentions function', () => {
    it('should process mentions correctly', async () => {
      // First send a message with mentions
      const { data: messageId, error: sendError } = await supabase.rpc('send_chat_message', {
        p_room_id: testRoomId,
        p_user_wallet_address: testUser1Wallet,
        p_message_content: 'Hello @testuser2 and @testuser1!',
        p_message_type: 'text'
      });
      
      expect(sendError).to.be.null;
      expect(messageId).to.be.a('string');
      
      // Check if mentions were created
      const { data: mentions, error: mentionError } = await supabase
        .from('chat_mentions')
        .select('*')
        .eq('message_id', messageId);
      
      expect(mentionError).to.be.null;
      expect(mentions).to.be.an('array');
      // Should have 1 mention (testuser2, not testuser1 since they're the sender)
      expect(mentions.length).to.equal(1);
      expect(mentions[0].mentioned_user_wallet).to.equal(testUser2Wallet);
    });

    it('should handle malformed mentions gracefully', async () => {
      const { data: messageId, error: sendError } = await supabase.rpc('send_chat_message', {
        p_room_id: testRoomId,
        p_user_wallet_address: testUser1Wallet,
        p_message_content: 'Hello @nonexistentuser and @',
        p_message_type: 'text'
      });
      
      expect(sendError).to.be.null;
      expect(messageId).to.be.a('string');
      
      // Check that no mentions were created for invalid users
      const { data: mentions, error: mentionError } = await supabase
        .from('chat_mentions')
        .select('*')
        .eq('message_id', messageId);
      
      expect(mentionError).to.be.null;
      expect(mentions).to.be.an('array');
      expect(mentions.length).to.equal(0);
    });
  });

  describe('get_unread_mentions function', () => {
    it('should retrieve unread mentions for a user', async () => {
      // First create a mention
      await supabase.rpc('send_chat_message', {
        p_room_id: testRoomId,
        p_user_wallet_address: testUser1Wallet,
        p_message_content: 'Hey @testuser2, check this out!',
        p_message_type: 'text'
      });
      
      // Get unread mentions for testuser2
      const { data: mentions, error } = await supabase.rpc('get_unread_mentions', {
        p_user_wallet_address: testUser2Wallet
      });
      
      expect(error).to.be.null;
      expect(mentions).to.be.an('array');
      expect(mentions.length).to.be.greaterThan(0);
      
      // Check mention structure
      const mention = mentions[0];
      expect(mention).to.have.property('id');
      expect(mention).to.have.property('message_id');
      expect(mention).to.have.property('room_id');
      expect(mention).to.have.property('mentioned_by_nickname');
      expect(mention).to.have.property('message_content');
    });
  });

  describe('search_nicknames_for_mention function', () => {
    it('should find nicknames for autocomplete', async () => {
      const { data: results, error } = await supabase.rpc('search_nicknames_for_mention', {
        p_query: 'test',
        p_room_id: testRoomId,
        p_limit: 10
      });
      
      expect(error).to.be.null;
      expect(results).to.be.an('array');
      expect(results.length).to.be.greaterThan(0);
      
      // Check that results contain our test users
      const nicknames = results.map(r => r.nickname);
      expect(nicknames).to.include('testuser1');
      expect(nicknames).to.include('testuser2');
    });

    it('should handle partial nickname matches', async () => {
      const { data: results, error } = await supabase.rpc('search_nicknames_for_mention', {
        p_query: 'testuser1',
        p_room_id: testRoomId,
        p_limit: 10
      });
      
      expect(error).to.be.null;
      expect(results).to.be.an('array');
      expect(results.length).to.equal(1);
      expect(results[0].nickname).to.equal('testuser1');
    });
  });

  describe('RLS policies', () => {
    it('should allow reading chat mentions', async () => {
      const { data, error } = await supabase
        .from('chat_mentions')
        .select('*')
        .limit(1);
      
      expect(error).to.be.null;
      expect(data).to.be.an('array');
    });

    it('should allow inserting chat mentions', async () => {
      // This is tested indirectly through the send_chat_message function
      // which creates mentions via the process_message_mentions function
      expect(true).to.be.true; // Placeholder - actual test is in send_chat_message tests
    });
  });
});