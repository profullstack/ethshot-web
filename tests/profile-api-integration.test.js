/**
 * Profile API Integration Tests
 * 
 * Tests the complete profile API integration including:
 * - Server-side profile API endpoints
 * - Client-side profile utilities
 * - Database function integration
 * - JWT authentication flow
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { upsertUserProfileAPI, getUserProfileAPI, isNicknameAvailableAPI } from '../src/lib/utils/client-profile.js';
import { db } from '../src/lib/database/index.js';

// Mock localStorage for testing
const mockLocalStorage = {
  store: {},
  getItem: function(key) {
    return this.store[key] || null;
  },
  setItem: function(key, value) {
    this.store[key] = value.toString();
  },
  removeItem: function(key) {
    delete this.store[key];
  },
  clear: function() {
    this.store = {};
  }
};

// Mock fetch for API calls
const mockFetch = (url, options) => {
  const body = JSON.parse(options.body);
  const action = body.action;
  
  // Simulate server responses based on action
  switch (action) {
    case 'upsert':
      if (!options.headers.Authorization) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({
            success: false,
            error: 'Authorization header required'
          })
        });
      }
      
      // Simulate successful profile upsert
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          profile: {
            wallet_address: '0x1234567890123456789012345678901234567890',
            nickname: body.profileData.nickname,
            avatar_url: body.profileData.avatarUrl,
            bio: body.profileData.bio,
            notifications_enabled: body.profileData.notificationsEnabled,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        })
      });
      
    case 'get':
      // Simulate profile retrieval
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          profile: {
            wallet_address: body.walletAddress.toLowerCase(),
            nickname: 'TestUser',
            avatar_url: 'https://example.com/avatar.png',
            bio: 'Test bio',
            notifications_enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        })
      });
      
    case 'check_nickname':
      // Simulate nickname availability check
      const isAvailable = body.nickname !== 'taken_nickname';
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          available: isAvailable
        })
      });
      
    default:
      return Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          success: false,
          error: 'Invalid action'
        })
      });
  }
};

describe('Profile API Integration', () => {
  let originalFetch;
  let originalLocalStorage;

  beforeEach(() => {
    // Mock global fetch
    originalFetch = global.fetch;
    global.fetch = mockFetch;
    
    // Mock localStorage
    originalLocalStorage = global.localStorage;
    global.localStorage = mockLocalStorage;
    
    // Clear localStorage
    mockLocalStorage.clear();
    
    // Set up a mock JWT token
    const mockJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXRfYWRkcmVzcyI6IjB4MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MCIsImV4cCI6OTk5OTk5OTk5OX0.test';
    mockLocalStorage.setItem('jwt_token', mockJWT);
  });

  afterEach(() => {
    // Restore original implementations
    global.fetch = originalFetch;
    global.localStorage = originalLocalStorage;
  });

  describe('Client-side Profile API Utilities', () => {
    it('should successfully upsert user profile with valid JWT', async () => {
      const profileData = {
        nickname: 'TestUser',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'This is a test bio',
        notificationsEnabled: true
      };

      const result = await upsertUserProfileAPI(profileData);

      expect(result).toBeDefined();
      expect(result.wallet_address).toBe('0x1234567890123456789012345678901234567890');
      expect(result.nickname).toBe('TestUser');
      expect(result.avatar_url).toBe('https://example.com/avatar.png');
      expect(result.bio).toBe('This is a test bio');
      expect(result.notifications_enabled).toBe(true);
    });

    it('should fail to upsert user profile without JWT token', async () => {
      // Remove JWT token
      mockLocalStorage.removeItem('jwt_token');

      const profileData = {
        nickname: 'TestUser',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'This is a test bio',
        notificationsEnabled: true
      };

      await expect(upsertUserProfileAPI(profileData)).rejects.toThrow(
        'No authentication token found. Please connect your wallet first.'
      );
    });

    it('should successfully get user profile', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      const result = await getUserProfileAPI(walletAddress);

      expect(result).toBeDefined();
      expect(result.wallet_address).toBe(walletAddress.toLowerCase());
      expect(result.nickname).toBe('TestUser');
      expect(result.avatar_url).toBe('https://example.com/avatar.png');
      expect(result.bio).toBe('Test bio');
      expect(result.notifications_enabled).toBe(true);
    });

    it('should check nickname availability correctly', async () => {
      // Test available nickname
      const availableResult = await isNicknameAvailableAPI('available_nickname');
      expect(availableResult).toBe(true);

      // Test taken nickname
      const takenResult = await isNicknameAvailableAPI('taken_nickname');
      expect(takenResult).toBe(false);
    });

    it('should check nickname availability with exclusion', async () => {
      const result = await isNicknameAvailableAPI(
        'test_nickname', 
        '0x1234567890123456789012345678901234567890'
      );
      expect(result).toBe(true);
    });
  });

  describe('Database Function Integration', () => {
    it('should use API-based upsertUserProfile', async () => {
      const profileData = {
        nickname: 'DatabaseTestUser',
        avatarUrl: 'https://example.com/db-avatar.png',
        bio: 'Database integration test',
        notificationsEnabled: false
      };

      const result = await db.upsertUserProfile(profileData);

      expect(result).toBeDefined();
      expect(result.nickname).toBe('DatabaseTestUser');
      expect(result.avatar_url).toBe('https://example.com/db-avatar.png');
      expect(result.bio).toBe('Database integration test');
      expect(result.notifications_enabled).toBe(false);
    });

    it('should use API-based getUserProfile', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      const result = await db.getUserProfile(walletAddress);

      expect(result).toBeDefined();
      expect(result.wallet_address).toBe(walletAddress.toLowerCase());
      expect(result.nickname).toBe('TestUser');
    });

    it('should use API-based isNicknameAvailable', async () => {
      const result = await db.isNicknameAvailable('test_nickname');
      expect(result).toBe(true);

      const takenResult = await db.isNicknameAvailable('taken_nickname');
      expect(takenResult).toBe(false);
    });
  });

  describe('Authentication Integration', () => {
    it('should handle JWT token validation', () => {
      // Mock a valid JWT token
      const validJWT = btoa(JSON.stringify({ header: 'test' })) + '.' + 
                      btoa(JSON.stringify({ 
                        wallet_address: '0x1234567890123456789012345678901234567890',
                        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
                      })) + '.signature';
      
      mockLocalStorage.setItem('jwt_token', validJWT);

      // Import the function that checks authentication
      const { isAuthenticatedForProfile, getAuthenticatedWalletAddress } = 
        require('../src/lib/utils/client-profile.js');

      expect(isAuthenticatedForProfile()).toBe(true);
      expect(getAuthenticatedWalletAddress()).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should handle expired JWT token', () => {
      // Mock an expired JWT token
      const expiredJWT = btoa(JSON.stringify({ header: 'test' })) + '.' + 
                        btoa(JSON.stringify({ 
                          wallet_address: '0x1234567890123456789012345678901234567890',
                          exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
                        })) + '.signature';
      
      mockLocalStorage.setItem('jwt_token', expiredJWT);

      const { isAuthenticatedForProfile, getAuthenticatedWalletAddress } = 
        require('../src/lib/utils/client-profile.js');

      expect(isAuthenticatedForProfile()).toBe(false);
      expect(getAuthenticatedWalletAddress()).toBe(null);
    });

    it('should handle invalid JWT token format', () => {
      mockLocalStorage.setItem('jwt_token', 'invalid.jwt.token');

      const { isAuthenticatedForProfile, getAuthenticatedWalletAddress } = 
        require('../src/lib/utils/client-profile.js');

      expect(isAuthenticatedForProfile()).toBe(false);
      expect(getAuthenticatedWalletAddress()).toBe(null);
    });
  });

  describe('Error Handling', () => {
    it('should handle API server errors gracefully', async () => {
      // Mock server error
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          success: false,
          error: 'Server configuration error. Please check environment variables.'
        })
      });

      const profileData = {
        nickname: 'TestUser',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Test bio',
        notificationsEnabled: true
      };

      await expect(upsertUserProfileAPI(profileData)).rejects.toThrow(
        'Server configuration error. Please check environment variables.'
      );
    });

    it('should handle network errors gracefully', async () => {
      // Mock network error
      global.fetch = () => Promise.reject(new Error('Network error'));

      const profileData = {
        nickname: 'TestUser',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Test bio',
        notificationsEnabled: true
      };

      await expect(upsertUserProfileAPI(profileData)).rejects.toThrow('Network error');
    });

    it('should handle database function errors gracefully', async () => {
      // Mock API error response
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          success: false,
          error: 'Invalid or expired token'
        })
      });

      const profileData = {
        nickname: 'TestUser',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Test bio',
        notificationsEnabled: true
      };

      await expect(db.upsertUserProfile(profileData)).rejects.toThrow(
        'Invalid or expired token'
      );
    });
  });
});