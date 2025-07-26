/**
 * Integration Tests for Complete @Mention Feature
 * Using Mocha testing framework with Chai assertions
 * Tests the full flow from input to database to notifications
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';

// Import all the components we're testing
import {
  extractMentions,
  formatMessageWithMentions,
  parseMessageMentions,
  getAutocompleteContext
} from '../src/lib/utils/chat-mentions.js';

import {
  addMentionNotification,
  markMentionAsRead,
  clearAllMentions,
  getMentionsByRoom,
  totalPendingMentions,
  roomPendingMentions
} from '../src/lib/stores/mention-notifications.js';

import { get } from 'svelte/store';

describe('Complete @Mention Feature Integration', () => {
  // Mock data for testing
  const mockUsers = [
    { nickname: 'alice', wallet_address: '0x123', avatar_url: 'avatar1.jpg' },
    { nickname: 'bob', wallet_address: '0x456', avatar_url: null },
    { nickname: 'charlie', wallet_address: '0x789', avatar_url: 'avatar2.jpg' },
    { nickname: 'dave_123', wallet_address: '0xabc', avatar_url: null }
  ];

  const mockRoomId = 'room-global-chat';
  const mockMessageId = 'msg-12345';

  beforeEach(() => {
    // Clear all mentions before each test
    clearAllMentions();
  });

  describe('End-to-End Message Processing Flow', () => {
    it('should process a message with mentions from input to notification', () => {
      const messageContent = 'Hey @alice and @bob, great game! @charlie you missed it.';
      
      // Step 1: Extract mentions from message
      const mentions = extractMentions(messageContent);
      expect(mentions).to.have.lengthOf(3);
      expect(mentions).to.include.members(['alice', 'bob', 'charlie']);
      
      // Step 2: Parse mentions with user validation
      const parsedMessage = parseMessageMentions(messageContent, mockUsers);
      expect(parsedMessage.hasMentions).to.be.true;
      expect(parsedMessage.mentions).to.have.lengthOf(3);
      expect(parsedMessage.invalidMentions).to.have.lengthOf(0);
      
      // Step 3: Format message for display
      const formattedMessage = formatMessageWithMentions(messageContent);
      expect(formattedMessage).to.include('<span class="mention">@alice</span>');
      expect(formattedMessage).to.include('<span class="mention">@bob</span>');
      expect(formattedMessage).to.include('<span class="mention">@charlie</span>');
      
      // Step 4: Create mention notifications
      parsedMessage.mentions.forEach((mention, index) => {
        addMentionNotification({
          id: `mention-${index + 1}`,
          messageId: mockMessageId,
          roomId: mockRoomId,
          roomName: 'Global Chat',
          mentionedByWallet: '0xdef',
          mentionedByNickname: 'sender',
          messageContent: messageContent,
          createdAt: new Date().toISOString(),
          isRead: false
        });
      });
      
      // Step 5: Verify notifications were created
      const totalPending = get(totalPendingMentions);
      const roomPending = get(roomPendingMentions);
      
      expect(totalPending).to.equal(3);
      expect(roomPending.get(mockRoomId)).to.equal(3);
    });

    it('should handle invalid mentions gracefully', () => {
      const messageContent = 'Hey @alice and @nonexistent, how are you?';
      
      // Parse mentions with user validation
      const parsedMessage = parseMessageMentions(messageContent, mockUsers);
      
      expect(parsedMessage.mentions).to.have.lengthOf(1);
      expect(parsedMessage.mentions[0].nickname).to.equal('alice');
      expect(parsedMessage.invalidMentions).to.have.lengthOf(1);
      expect(parsedMessage.invalidMentions[0]).to.equal('nonexistent');
      
      // Only valid mentions should create notifications
      parsedMessage.mentions.forEach((mention, index) => {
        addMentionNotification({
          id: `mention-${index + 1}`,
          messageId: mockMessageId,
          roomId: mockRoomId,
          roomName: 'Global Chat',
          mentionedByWallet: '0xdef',
          mentionedByNickname: 'sender',
          messageContent: messageContent,
          createdAt: new Date().toISOString(),
          isRead: false
        });
      });
      
      const totalPending = get(totalPendingMentions);
      expect(totalPending).to.equal(1);
    });

    it('should handle HTML escaping in mentions', () => {
      const messageContent = 'Hey @alice, check this <script>alert("xss")</script>';
      
      const formattedMessage = formatMessageWithMentions(messageContent);
      
      expect(formattedMessage).to.include('<span class="mention">@alice</span>');
      expect(formattedMessage).to.include('&lt;script&gt;');
      expect(formattedMessage).to.not.include('<script>');
    });
  });

  describe('Autocomplete Integration', () => {
    it('should provide autocomplete context for partial mentions', () => {
      const message = 'Hey @al';
      const cursorPosition = 6; // After '@al'
      
      const context = getAutocompleteContext(message, cursorPosition);
      
      expect(context).to.not.be.null;
      expect(context.isActive).to.be.true;
      expect(context.query).to.equal('al');
      expect(context.startIndex).to.equal(4); // Position of '@'
      expect(context.endIndex).to.equal(6); // End of 'al'
    });

    it('should not provide autocomplete context for completed mentions', () => {
      const message = 'Hey @alice how are you?';
      const cursorPosition = 15; // After 'alice '
      
      const context = getAutocompleteContext(message, cursorPosition);
      
      expect(context).to.be.null;
    });

    it('should handle autocomplete at different cursor positions', () => {
      const message = 'Hey @a and @b';
      
      // Test first mention
      let context = getAutocompleteContext(message, 6); // After '@a'
      expect(context).to.not.be.null;
      expect(context.query).to.equal('a');
      
      // Test second mention
      context = getAutocompleteContext(message, 14); // After '@b'
      expect(context).to.not.be.null;
      expect(context.query).to.equal('b');
    });
  });

  describe('Notification Management Integration', () => {
    beforeEach(() => {
      // Add some test mentions
      const testMentions = [
        {
          id: 'mention-1',
          messageId: 'msg-1',
          roomId: 'room-1',
          roomName: 'Global Chat',
          mentionedByWallet: '0x123',
          mentionedByNickname: 'alice',
          messageContent: 'Hey @bob!',
          createdAt: '2025-01-01T10:00:00Z',
          isRead: false
        },
        {
          id: 'mention-2',
          messageId: 'msg-2',
          roomId: 'room-1',
          roomName: 'Global Chat',
          mentionedByWallet: '0x456',
          mentionedByNickname: 'charlie',
          messageContent: 'Hi @bob!',
          createdAt: '2025-01-01T11:00:00Z',
          isRead: false
        },
        {
          id: 'mention-3',
          messageId: 'msg-3',
          roomId: 'room-2',
          roomName: 'Game Chat',
          mentionedByWallet: '0x789',
          mentionedByNickname: 'dave',
          messageContent: 'Good game @bob!',
          createdAt: '2025-01-01T12:00:00Z',
          isRead: false
        }
      ];

      testMentions.forEach(mention => addMentionNotification(mention));
    });

    it('should track pending mentions correctly across rooms', () => {
      const totalPending = get(totalPendingMentions);
      const roomPending = get(roomPendingMentions);
      
      expect(totalPending).to.equal(3);
      expect(roomPending.get('room-1')).to.equal(2);
      expect(roomPending.get('room-2')).to.equal(1);
    });

    it('should update counts when mentions are marked as read', () => {
      // Mark one mention as read
      markMentionAsRead('mention-1');
      
      const totalPending = get(totalPendingMentions);
      const roomPending = get(roomPendingMentions);
      
      expect(totalPending).to.equal(2);
      expect(roomPending.get('room-1')).to.equal(1);
      expect(roomPending.get('room-2')).to.equal(1);
    });

    it('should filter mentions by room correctly', () => {
      const room1Mentions = getMentionsByRoom('room-1');
      const room2Mentions = getMentionsByRoom('room-2');
      
      expect(room1Mentions).to.have.lengthOf(2);
      expect(room2Mentions).to.have.lengthOf(1);
      
      // Check sorting (newest first)
      expect(room1Mentions[0].id).to.equal('mention-2');
      expect(room1Mentions[1].id).to.equal('mention-1');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty messages gracefully', () => {
      const mentions = extractMentions('');
      const formatted = formatMessageWithMentions('');
      const parsed = parseMessageMentions('', mockUsers);
      
      expect(mentions).to.have.lengthOf(0);
      expect(formatted).to.equal('');
      expect(parsed.hasMentions).to.be.false;
    });

    it('should handle messages with only @ symbols', () => {
      const messageContent = '@ @@ @@@ @ @';
      
      const mentions = extractMentions(messageContent);
      const formatted = formatMessageWithMentions(messageContent);
      
      expect(mentions).to.have.lengthOf(0);
      expect(formatted).to.equal(messageContent); // No changes
    });

    it('should handle very long nicknames', () => {
      const longNickname = 'a'.repeat(50);
      const messageContent = `Hey @${longNickname}, how are you?`;
      
      const mentions = extractMentions(messageContent);
      
      // Should not extract overly long nicknames (our regex limits to 32 chars)
      expect(mentions).to.have.lengthOf(0);
    });

    it('should handle special characters in messages', () => {
      const messageContent = 'Hey @alice! How\'s the "game" going? #winning 🎉';
      
      const mentions = extractMentions(messageContent);
      const formatted = formatMessageWithMentions(messageContent);
      
      expect(mentions).to.have.lengthOf(1);
      expect(mentions[0]).to.equal('alice');
      expect(formatted).to.include('<span class="mention">@alice</span>');
      expect(formatted).to.include('🎉'); // Emoji should be preserved
    });

    it('should handle duplicate mention notifications', () => {
      const mention = {
        id: 'duplicate-test',
        messageId: 'msg-dup',
        roomId: 'room-dup',
        roomName: 'Test Room',
        mentionedByWallet: '0x123',
        mentionedByNickname: 'alice',
        messageContent: 'Test message',
        createdAt: new Date().toISOString(),
        isRead: false
      };

      // Add the same mention twice
      addMentionNotification(mention);
      addMentionNotification(mention);
      
      const totalPending = get(totalPendingMentions);
      expect(totalPending).to.equal(1); // Should only count once
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple mentions efficiently', () => {
      const manyMentions = mockUsers.map(user => `@${user.nickname}`).join(' ');
      const messageContent = `Hey everyone: ${manyMentions}!`;
      
      const startTime = Date.now();
      
      const mentions = extractMentions(messageContent);
      const formatted = formatMessageWithMentions(messageContent);
      const parsed = parseMessageMentions(messageContent, mockUsers);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(mentions).to.have.lengthOf(4);
      expect(parsed.mentions).to.have.lengthOf(4);
      expect(processingTime).to.be.lessThan(100); // Should process quickly
    });

    it('should handle large user lists for autocomplete', () => {
      const largeUserList = Array.from({ length: 1000 }, (_, i) => ({
        nickname: `user${i}`,
        wallet_address: `0x${i.toString(16).padStart(40, '0')}`,
        avatar_url: null
      }));

      const messageContent = 'Hey @user1 and @user999!';
      
      const startTime = Date.now();
      const parsed = parseMessageMentions(messageContent, largeUserList);
      const endTime = Date.now();
      
      expect(parsed.mentions).to.have.lengthOf(2);
      expect(endTime - startTime).to.be.lessThan(50); // Should be fast even with large lists
    });
  });
});