import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { profileStore, notificationsEnabled } from '../src/lib/stores/profile.js';

// Mock Supabase
const mockSupabase = {
  getUserProfile: vi.fn(),
  upsertUserProfile: vi.fn(),
  isNicknameAvailable: vi.fn()
};

vi.mock('../src/lib/supabase.js', () => ({
  db: mockSupabase
}));

describe('Notification Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileStore.clear();
  });

  describe('notificationsEnabled store', () => {
    it('should default to true when no profile is loaded', () => {
      const enabled = get(notificationsEnabled);
      expect(enabled).toBe(true);
    });

    it('should return profile notification setting when profile is loaded', async () => {
      const mockProfile = {
        wallet_address: '0x123',
        nickname: 'testuser',
        notifications_enabled: false
      };

      mockSupabase.getUserProfile.mockResolvedValue(mockProfile);
      
      await profileStore.loadProfile('0x123');
      
      const enabled = get(notificationsEnabled);
      expect(enabled).toBe(false);
    });

    it('should handle null notifications_enabled gracefully', async () => {
      const mockProfile = {
        wallet_address: '0x123',
        nickname: 'testuser',
        notifications_enabled: null
      };

      mockSupabase.getUserProfile.mockResolvedValue(mockProfile);
      
      await profileStore.loadProfile('0x123');
      
      const enabled = get(notificationsEnabled);
      expect(enabled).toBe(true); // Should default to true
    });
  });

  describe('Profile update with notifications', () => {
    it('should include notifications_enabled when updating profile', async () => {
      const mockUpdatedProfile = {
        wallet_address: '0x123',
        nickname: 'testuser',
        notifications_enabled: false
      };

      mockSupabase.upsertUserProfile.mockResolvedValue(mockUpdatedProfile);

      await profileStore.updateProfile({
        walletAddress: '0x123',
        nickname: 'testuser',
        notificationsEnabled: false
      });

      expect(mockSupabase.upsertUserProfile).toHaveBeenCalledWith({
        walletAddress: '0x123',
        nickname: 'testuser',
        notificationsEnabled: false
      });
    });

    it('should default notifications to true if not specified', async () => {
      const mockUpdatedProfile = {
        wallet_address: '0x123',
        nickname: 'testuser',
        notifications_enabled: true
      };

      mockSupabase.upsertUserProfile.mockResolvedValue(mockUpdatedProfile);

      await profileStore.updateProfile({
        walletAddress: '0x123',
        nickname: 'testuser'
        // notificationsEnabled not specified
      });

      expect(mockSupabase.upsertUserProfile).toHaveBeenCalledWith({
        walletAddress: '0x123',
        nickname: 'testuser'
      });
    });
  });

  describe('Notification toggle behavior', () => {
    it('should update notification preference when toggled', async () => {
      // Load initial profile
      const initialProfile = {
        wallet_address: '0x123',
        nickname: 'testuser',
        notifications_enabled: true
      };

      mockSupabase.getUserProfile.mockResolvedValue(initialProfile);
      await profileStore.loadProfile('0x123');

      // Verify initial state
      expect(get(notificationsEnabled)).toBe(true);

      // Update with notifications disabled
      const updatedProfile = {
        ...initialProfile,
        notifications_enabled: false
      };

      mockSupabase.upsertUserProfile.mockResolvedValue(updatedProfile);

      await profileStore.updateProfile({
        walletAddress: '0x123',
        nickname: 'testuser',
        notificationsEnabled: false
      });

      // Verify updated state
      expect(get(notificationsEnabled)).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle profile update errors gracefully', async () => {
      mockSupabase.upsertUserProfile.mockRejectedValue(new Error('Database error'));

      await expect(profileStore.updateProfile({
        walletAddress: '0x123',
        notificationsEnabled: false
      })).rejects.toThrow('Database error');
    });

    it('should handle profile load errors gracefully', async () => {
      mockSupabase.getUserProfile.mockRejectedValue(new Error('Profile not found'));

      await expect(profileStore.loadProfile('0x123')).rejects.toThrow('Profile not found');
    });
  });
});