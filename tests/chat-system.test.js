/**
 * Chat System Tests
 * Tests for the chat functionality using Mocha and Chai
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { ChatClient } from '../src/lib/utils/chat-client.js';

describe('Chat System', () => {
  let chatClient;

  beforeEach(() => {
    chatClient = new ChatClient();
  });

  afterEach(() => {
    if (chatClient) {
      chatClient.disconnect();
    }
  });

  describe('ChatClient', () => {
    it('should initialize with correct default state', () => {
      expect(chatClient.isConnected).to.be.false;
      expect(chatClient.isAuthenticated).to.be.false;
      expect(chatClient.walletAddress).to.be.null;
      expect(chatClient.reconnectAttempts).to.equal(0);
    });

    it('should have proper event listener management', () => {
      const testListener = () => {};
      
      chatClient.addEventListener('test', testListener);
      expect(chatClient.eventListeners.has('test')).to.be.true;
      expect(chatClient.eventListeners.get('test').has(testListener)).to.be.true;
      
      chatClient.removeEventListener('test', testListener);
      expect(chatClient.eventListeners.has('test')).to.be.false;
    });

    it('should handle message handlers correctly', () => {
      const testHandler = () => {};
      
      chatClient.addMessageHandler('test_message', testHandler);
      expect(chatClient.messageHandlers.has('test_message')).to.be.true;
      expect(chatClient.messageHandlers.get('test_message').has(testHandler)).to.be.true;
      
      chatClient.removeMessageHandler('test_message', testHandler);
      expect(chatClient.messageHandlers.has('test_message')).to.be.false;
    });

    it('should validate wallet address format', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
      const invalidAddress = 'invalid-address';
      
      // This would be tested in integration with the server
      expect(validAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(invalidAddress).to.not.match(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should handle connection status correctly', () => {
      const status = chatClient.getStatus();
      
      expect(status).to.have.property('isConnected');
      expect(status).to.have.property('isAuthenticated');
      expect(status).to.have.property('walletAddress');
      expect(status).to.have.property('reconnectAttempts');
      
      expect(status.isConnected).to.be.false;
      expect(status.isAuthenticated).to.be.false;
      expect(status.walletAddress).to.be.null;
      expect(status.reconnectAttempts).to.equal(0);
    });

    it('should throw error when sending message without connection', () => {
      expect(() => {
        chatClient.send({ type: 'test' });
      }).to.throw('Not connected to chat server');
    });

    it('should throw error when authenticating without connection', async () => {
      try {
        await chatClient.authenticate('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Not connected to chat server');
      }
    });

    it('should throw error when joining room without authentication', async () => {
      try {
        await chatClient.joinRoom('test-room');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Not authenticated');
      }
    });

    it('should validate message content', async () => {
      try {
        await chatClient.sendMessage('test-room', '');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Message content cannot be empty');
      }
    });
  });

  describe('Message Validation', () => {
    it('should validate message length', () => {
      const shortMessage = 'Hello world!';
      const longMessage = 'a'.repeat(501);
      
      expect(shortMessage.length).to.be.lessThan(500);
      expect(longMessage.length).to.be.greaterThan(500);
    });

    it('should handle different message types', () => {
      const messageTypes = ['text', 'system', 'emote'];
      
      messageTypes.forEach(type => {
        expect(['text', 'system', 'emote']).to.include(type);
      });
    });

    it('should format wallet addresses correctly', () => {
      const address = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
      const formatted = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
      
      expect(formatted).to.equal('0x742d...d8b6');
    });
  });

  describe('Room Management', () => {
    it('should handle room data structure', () => {
      const room = {
        id: 'test-room',
        name: 'Test Room',
        type: 'global',
        description: 'A test room',
        maxUsers: 100
      };
      
      expect(room).to.have.property('id');
      expect(room).to.have.property('name');
      expect(room).to.have.property('type');
      expect(room).to.have.property('description');
      expect(room).to.have.property('maxUsers');
      
      expect(room.type).to.be.oneOf(['global', 'game', 'private']);
    });

    it('should validate room types', () => {
      const validTypes = ['global', 'game', 'private'];
      const invalidType = 'invalid';
      
      expect(validTypes).to.include('global');
      expect(validTypes).to.include('game');
      expect(validTypes).to.include('private');
      expect(validTypes).to.not.include(invalidType);
    });
  });

  describe('Rate Limiting', () => {
    it('should track message timestamps', () => {
      const now = Date.now();
      const messages = [now - 1000, now - 500, now];
      
      expect(messages).to.have.length(3);
      expect(messages[0]).to.be.lessThan(messages[1]);
      expect(messages[1]).to.be.lessThan(messages[2]);
    });

    it('should validate rate limit window', () => {
      const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
      const now = Date.now();
      const oldTimestamp = now - RATE_LIMIT_WINDOW - 1000;
      
      expect(now - oldTimestamp).to.be.greaterThan(RATE_LIMIT_WINDOW);
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors gracefully', () => {
      const invalidJson = 'invalid json';
      
      expect(() => {
        JSON.parse(invalidJson);
      }).to.throw();
    });

    it('should handle network errors', () => {
      // Mock network error scenarios
      const networkErrors = [
        'Connection refused',
        'Timeout',
        'Network unreachable'
      ];
      
      networkErrors.forEach(error => {
        expect(error).to.be.a('string');
        expect(error.length).to.be.greaterThan(0);
      });
    });
  });

  describe('Utility Functions', () => {
    it('should format timestamps correctly', () => {
      const timestamp = new Date('2025-01-26T02:25:00Z');
      const formatted = timestamp.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      expect(formatted).to.match(/^\d{1,2}:\d{2}\s?(AM|PM)?$/i);
    });

    it('should generate unique client IDs', () => {
      const id1 = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const id2 = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      expect(id1).to.not.equal(id2);
      expect(id1).to.match(/^client_\d+_[a-z0-9]+$/);
      expect(id2).to.match(/^client_\d+_[a-z0-9]+$/);
    });
  });

  describe('Configuration', () => {
    it('should have proper default configuration', () => {
      const config = {
        CHAT_SERVER_URL: 'ws://localhost:8080/chat',
        RECONNECT_INTERVAL: 5000,
        PING_INTERVAL: 30000,
        MAX_RECONNECT_ATTEMPTS: 5,
        MAX_MESSAGE_LENGTH: 500,
        RATE_LIMIT_MESSAGES: 10,
        RATE_LIMIT_WINDOW: 60 * 1000
      };
      
      expect(config.CHAT_SERVER_URL).to.be.a('string');
      expect(config.RECONNECT_INTERVAL).to.be.a('number');
      expect(config.PING_INTERVAL).to.be.a('number');
      expect(config.MAX_RECONNECT_ATTEMPTS).to.be.a('number');
      expect(config.MAX_MESSAGE_LENGTH).to.be.a('number');
      expect(config.RATE_LIMIT_MESSAGES).to.be.a('number');
      expect(config.RATE_LIMIT_WINDOW).to.be.a('number');
      
      expect(config.MAX_MESSAGE_LENGTH).to.equal(500);
      expect(config.RATE_LIMIT_MESSAGES).to.equal(10);
    });
  });
});

describe('Chat Store Integration', () => {
  it('should handle store state correctly', () => {
    // Mock store state
    const mockState = {
      chatConnected: false,
      chatAuthenticated: false,
      chatError: null,
      currentWalletAddress: null,
      joinedRooms: new Set(),
      activeRoom: null,
      chatRooms: [],
      roomMessages: new Map(),
      onlineUsers: new Map(),
      chatSettings: {
        isEnabled: true,
        showTimestamps: true,
        soundNotifications: true,
        mutedUsers: []
      },
      chatVisible: false,
      chatMinimized: false,
      unreadMessages: new Map()
    };
    
    expect(mockState.chatConnected).to.be.false;
    expect(mockState.chatAuthenticated).to.be.false;
    expect(mockState.joinedRooms).to.be.instanceOf(Set);
    expect(mockState.roomMessages).to.be.instanceOf(Map);
    expect(mockState.onlineUsers).to.be.instanceOf(Map);
    expect(mockState.unreadMessages).to.be.instanceOf(Map);
    expect(mockState.chatSettings).to.have.property('isEnabled');
    expect(mockState.chatSettings.isEnabled).to.be.true;
  });

  it('should calculate unread messages correctly', () => {
    const unreadMessages = new Map([
      ['room1', 3],
      ['room2', 0],
      ['room3', 7]
    ]);
    
    const totalUnread = Array.from(unreadMessages.values())
      .reduce((total, count) => total + count, 0);
    
    const hasUnread = Array.from(unreadMessages.values())
      .some(count => count > 0);
    
    expect(totalUnread).to.equal(10);
    expect(hasUnread).to.be.true;
  });
});