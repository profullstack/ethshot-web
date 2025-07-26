/**
 * Tests for Chat Mention Utilities
 * Using Mocha testing framework with Chai assertions
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

// Import the utilities we'll be testing (to be implemented)
import {
  extractMentions,
  formatMessageWithMentions,
  validateNickname,
  searchNicknames,
  isMentionValid
} from '../src/lib/utils/chat-mentions.js';

describe('Chat Mention Utilities', () => {
  describe('extractMentions', () => {
    it('should extract single mention from message', () => {
      const message = 'Hey @alice, how are you?';
      const mentions = extractMentions(message);
      
      expect(mentions).to.be.an('array');
      expect(mentions).to.have.lengthOf(1);
      expect(mentions[0]).to.equal('alice');
    });

    it('should extract multiple mentions from message', () => {
      const message = 'Hey @alice and @bob, let\'s play!';
      const mentions = extractMentions(message);
      
      expect(mentions).to.be.an('array');
      expect(mentions).to.have.lengthOf(2);
      expect(mentions).to.include('alice');
      expect(mentions).to.include('bob');
    });

    it('should handle mentions at start of message', () => {
      const message = '@alice are you there?';
      const mentions = extractMentions(message);
      
      expect(mentions).to.have.lengthOf(1);
      expect(mentions[0]).to.equal('alice');
    });

    it('should handle mentions at end of message', () => {
      const message = 'Good game @alice';
      const mentions = extractMentions(message);
      
      expect(mentions).to.have.lengthOf(1);
      expect(mentions[0]).to.equal('alice');
    });

    it('should handle mentions with underscores and numbers', () => {
      const message = 'Hey @user_123 and @test_user_456!';
      const mentions = extractMentions(message);
      
      expect(mentions).to.have.lengthOf(2);
      expect(mentions).to.include('user_123');
      expect(mentions).to.include('test_user_456');
    });

    it('should ignore invalid mention patterns', () => {
      const message = 'Email me at user@domain.com or check @';
      const mentions = extractMentions(message);
      
      expect(mentions).to.be.an('array');
      expect(mentions).to.have.lengthOf(0);
    });

    it('should deduplicate repeated mentions', () => {
      const message = '@alice @alice @bob @alice';
      const mentions = extractMentions(message);
      
      expect(mentions).to.have.lengthOf(2);
      expect(mentions).to.include('alice');
      expect(mentions).to.include('bob');
    });

    it('should handle empty message', () => {
      const message = '';
      const mentions = extractMentions(message);
      
      expect(mentions).to.be.an('array');
      expect(mentions).to.have.lengthOf(0);
    });

    it('should handle message with no mentions', () => {
      const message = 'Hello everyone, how is the game going?';
      const mentions = extractMentions(message);
      
      expect(mentions).to.be.an('array');
      expect(mentions).to.have.lengthOf(0);
    });
  });

  describe('formatMessageWithMentions', () => {
    it('should wrap mentions in HTML spans', () => {
      const message = 'Hey @alice, how are you?';
      const formatted = formatMessageWithMentions(message);
      
      expect(formatted).to.include('<span class="mention">@alice</span>');
      expect(formatted).to.equal('Hey <span class="mention">@alice</span>, how are you?');
    });

    it('should format multiple mentions', () => {
      const message = '@alice and @bob are playing';
      const formatted = formatMessageWithMentions(message);
      
      expect(formatted).to.include('<span class="mention">@alice</span>');
      expect(formatted).to.include('<span class="mention">@bob</span>');
    });

    it('should not format invalid mentions', () => {
      const message = 'Email user@domain.com';
      const formatted = formatMessageWithMentions(message);
      
      expect(formatted).to.equal(message);
      expect(formatted).to.not.include('<span class="mention">');
    });

    it('should handle message with no mentions', () => {
      const message = 'Hello everyone!';
      const formatted = formatMessageWithMentions(message);
      
      expect(formatted).to.equal(message);
    });

    it('should escape HTML in message content', () => {
      const message = 'Hey @alice, check <script>alert("xss")</script>';
      const formatted = formatMessageWithMentions(message);
      
      expect(formatted).to.include('<span class="mention">@alice</span>');
      expect(formatted).to.include('&lt;script&gt;');
      expect(formatted).to.not.include('<script>');
    });
  });

  describe('validateNickname', () => {
    it('should validate correct nickname format', () => {
      expect(validateNickname('alice')).to.be.true;
      expect(validateNickname('user123')).to.be.true;
      expect(validateNickname('test_user')).to.be.true;
      expect(validateNickname('user_123_test')).to.be.true;
    });

    it('should reject invalid nickname formats', () => {
      expect(validateNickname('')).to.be.false;
      expect(validateNickname('a')).to.be.false; // too short
      expect(validateNickname('a'.repeat(33))).to.be.false; // too long
      expect(validateNickname('user-name')).to.be.false; // hyphen not allowed
      expect(validateNickname('user.name')).to.be.false; // dot not allowed
      expect(validateNickname('user name')).to.be.false; // space not allowed
      expect(validateNickname('123user')).to.be.false; // can't start with number
      expect(validateNickname('_user')).to.be.false; // can't start with underscore
    });

    it('should handle null and undefined', () => {
      expect(validateNickname(null)).to.be.false;
      expect(validateNickname(undefined)).to.be.false;
    });
  });

  describe('searchNicknames', () => {
    const mockUsers = [
      { nickname: 'alice', wallet_address: '0x123', avatar_url: null },
      { nickname: 'alice_123', wallet_address: '0x456', avatar_url: 'avatar1.jpg' },
      { nickname: 'bob', wallet_address: '0x789', avatar_url: null },
      { nickname: 'charlie', wallet_address: '0xabc', avatar_url: 'avatar2.jpg' }
    ];

    it('should find exact matches', () => {
      const results = searchNicknames('alice', mockUsers);
      
      expect(results).to.be.an('array');
      expect(results).to.have.lengthOf(1);
      expect(results[0].nickname).to.equal('alice');
    });

    it('should find partial matches', () => {
      const results = searchNicknames('ali', mockUsers);
      
      expect(results).to.be.an('array');
      expect(results).to.have.lengthOf(2);
      expect(results.map(u => u.nickname)).to.include('alice');
      expect(results.map(u => u.nickname)).to.include('alice_123');
    });

    it('should be case insensitive', () => {
      const results = searchNicknames('ALICE', mockUsers);
      
      expect(results).to.have.lengthOf(1);
      expect(results[0].nickname).to.equal('alice');
    });

    it('should return empty array for no matches', () => {
      const results = searchNicknames('xyz', mockUsers);
      
      expect(results).to.be.an('array');
      expect(results).to.have.lengthOf(0);
    });

    it('should limit results', () => {
      const results = searchNicknames('', mockUsers, 2);
      
      expect(results).to.have.lengthOf(2);
    });

    it('should handle empty query', () => {
      const results = searchNicknames('', mockUsers);
      
      expect(results).to.be.an('array');
      expect(results).to.have.lengthOf(mockUsers.length);
    });
  });

  describe('isMentionValid', () => {
    const mockValidUsers = ['alice', 'bob', 'charlie'];

    it('should validate mentions against user list', () => {
      expect(isMentionValid('alice', mockValidUsers)).to.be.true;
      expect(isMentionValid('bob', mockValidUsers)).to.be.true;
      expect(isMentionValid('charlie', mockValidUsers)).to.be.true;
    });

    it('should reject invalid mentions', () => {
      expect(isMentionValid('dave', mockValidUsers)).to.be.false;
      expect(isMentionValid('', mockValidUsers)).to.be.false;
      expect(isMentionValid(null, mockValidUsers)).to.be.false;
    });

    it('should be case sensitive', () => {
      expect(isMentionValid('Alice', mockValidUsers)).to.be.false;
      expect(isMentionValid('ALICE', mockValidUsers)).to.be.false;
    });

    it('should handle empty user list', () => {
      expect(isMentionValid('alice', [])).to.be.false;
    });
  });
});