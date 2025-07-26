import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../src/lib/database/index.js';

// Mock Supabase client
const mockSupabase = {
  rpc: vi.fn()
};

vi.mock('../../src/lib/database/client.js', () => ({
  supabase: mockSupabase,
  TABLES: {
    USER_PROFILES: 'user_profiles'
  },
  isSupabaseAvailable: () => true,
  getSupabaseClient: () => mockSupabase
}));

describe('Profile Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('upsertUserProfile Security', () => {
    it('should use secure RPC function that does not accept wallet address from client', async () => {
      // Mock successful response
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          id: 'test-id',
          wallet_address: '0x1234567890123456789012345678901234567890',
          nickname: 'TestUser',
          bio: 'Test bio',
          avatar_url: null,
          notifications_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }],
        error: null
      });

      const profileData = {
        nickname: 'TestUser',
        bio: 'Test bio',
        avatarUrl: null,
        notificationsEnabled: true
      };

      await db.upsertUserProfile(profileData);

      // Verify that the secure RPC function is called
      expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_user_profile_secure', {
        p_nickname: 'TestUser',
        p_avatar_url: null,
        p_bio: 'Test bio',
        p_notifications_enabled: true
      });

      // Verify that wallet address is NOT passed as a parameter
      const callArgs = mockSupabase.rpc.mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('wallet_addr');
      expect(callArgs).not.toHaveProperty('walletAddress');
      expect(callArgs).not.toHaveProperty('wallet_address');
    });

    it('should handle authentication errors gracefully', async () => {
      // Mock authentication error
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'No authenticated wallet address found. User must be authenticated with a valid wallet address.'
        }
      });

      const profileData = {
        nickname: 'TestUser',
        bio: 'Test bio',
        avatarUrl: null,
        notificationsEnabled: true
      };

      await expect(db.upsertUserProfile(profileData)).rejects.toThrow(
        'You must be logged in with a wallet to update your profile.'
      );
    });

    it('should handle JWT authentication errors gracefully', async () => {
      // Mock JWT error
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'JWT token is invalid or expired'
        }
      });

      const profileData = {
        nickname: 'TestUser',
        bio: 'Test bio',
        avatarUrl: null,
        notificationsEnabled: true
      };

      await expect(db.upsertUserProfile(profileData)).rejects.toThrow(
        'Authentication error. Please reconnect your wallet and try again.'
      );
    });

    it('should not allow profile updates without authentication', async () => {
      // Mock unauthenticated error
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'No authenticated wallet address found'
        }
      });

      const profileData = {
        nickname: 'MaliciousUser',
        bio: 'Trying to hack',
        avatarUrl: null,
        notificationsEnabled: true
      };

      await expect(db.upsertUserProfile(profileData)).rejects.toThrow(
        'You must be logged in with a wallet to update your profile.'
      );
    });

    it('should validate that secure function is called with correct parameters', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ id: 'test' }],
        error: null
      });

      const profileData = {
        nickname: 'ValidUser',
        bio: 'Valid bio',
        avatarUrl: 'https://example.com/avatar.jpg',
        notificationsEnabled: false
      };

      await db.upsertUserProfile(profileData);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_user_profile_secure', {
        p_nickname: 'ValidUser',
        p_avatar_url: 'https://example.com/avatar.jpg',
        p_bio: 'Valid bio',
        p_notifications_enabled: false
      });
    });

    it('should handle null/undefined values correctly', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ id: 'test' }],
        error: null
      });

      const profileData = {
        nickname: null,
        bio: undefined,
        avatarUrl: '',
        notificationsEnabled: true
      };

      await db.upsertUserProfile(profileData);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_user_profile_secure', {
        p_nickname: null,
        p_avatar_url: null, // Empty string should be converted to null
        p_bio: null,
        p_notifications_enabled: true
      });
    });
  });

  describe('Security Documentation', () => {
    it('should document the security vulnerability that was fixed', () => {
      // This test serves as documentation of the security issue
      const securityIssue = {
        vulnerability: 'Client-side wallet address parameter allowed unauthorized profile modifications',
        impact: 'Users could modify other users\' profiles by changing the wallet address parameter',
        fix: 'Server-side authentication using JWT token to get authenticated user\'s wallet address',
        migration: '20250726114400_secure_profile_updates.sql',
        rpcFunction: 'upsert_user_profile_secure'
      };

      expect(securityIssue.vulnerability).toBeDefined();
      expect(securityIssue.fix).toContain('Server-side authentication');
      expect(securityIssue.rpcFunction).toBe('upsert_user_profile_secure');
    });
  });
});