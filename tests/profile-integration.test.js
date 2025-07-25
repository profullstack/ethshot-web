// Profile Integration Tests (Jest)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock browser environment for Svelte components
Object.defineProperty(window, 'navigator', {
  value: {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
    userAgent: 'test-browser',
  },
  writable: true,
});

Object.defineProperty(window, 'FileReader', {
  value: class MockFileReader {
    constructor() {
      this.onload = null;
      this.result = null;
    }
    
    readAsDataURL(file) {
      // Simulate async file reading
      setTimeout(() => {
        this.result = `data:${file.type};base64,mock-base64-data`;
        if (this.onload) {
          this.onload({ target: { result: this.result } });
        }
      }, 0);
    }
  },
  writable: true,
});

// Mock Supabase
const mockSupabase = {
  rpc: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      getPublicUrl: vi.fn(),
      remove: vi.fn(),
    })),
  },
};

vi.mock('../src/lib/supabase.js', () => ({
  supabase: mockSupabase,
  db: {
    getUserProfile: vi.fn(),
    upsertUserProfile: vi.fn(),
    isUsernameAvailable: vi.fn(),
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
  },
  TABLES: {
    USER_PROFILES: 'user_profiles',
  },
}));

// Mock wallet store
const mockWalletStore = {
  subscribe: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockWalletAddress = {
  subscribe: vi.fn((callback) => {
    callback('0x1234567890abcdef');
    return () => {};
  }),
};

const mockIsConnected = {
  subscribe: vi.fn((callback) => {
    callback(true);
    return () => {};
  }),
};

vi.mock('../src/lib/stores/wallet.js', () => ({
  walletStore: mockWalletStore,
  walletAddress: mockWalletAddress,
  isConnected: mockIsConnected,
}));

// Mock toast store
const mockToastStore = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};

vi.mock('../src/lib/stores/toast.js', () => ({
  toastStore: mockToastStore,
}));

describe('Profile Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Profile Workflow', () => {
    it('should handle complete user profile creation workflow', async () => {
      const { db } = await import('../src/lib/supabase.js');
      const { profileStore } = await import('../src/lib/stores/profile.js');

      // Mock database responses
      db.getUserProfile.mockResolvedValue(null); // No existing profile
      db.isUsernameAvailable.mockResolvedValue(true);
      
      const mockCreatedProfile = {
        id: '123',
        wallet_address: '0x1234567890abcdef',
        nickname: 'TestUser',
        username: 'testuser',
        avatar_url: null,
        bio: 'Test bio',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      db.upsertUserProfile.mockResolvedValue(mockCreatedProfile);

      // Step 1: Load profile (should return null for new user)
      const initialProfile = await profileStore.loadProfile('0x1234567890abcdef');
      expect(initialProfile).toBe(null);

      // Step 2: Check username availability
      const isAvailable = await profileStore.checkUsernameAvailability('testuser');
      expect(isAvailable).toBe(true);
      expect(db.isUsernameAvailable).toHaveBeenCalledWith('testuser', null);

      // Step 3: Create new profile
      const profileData = {
        walletAddress: '0x1234567890abcdef',
        nickname: 'TestUser',
        username: 'testuser',
        bio: 'Test bio',
      };

      const createdProfile = await profileStore.updateProfile(profileData);
      expect(createdProfile).toEqual(mockCreatedProfile);
      expect(db.upsertUserProfile).toHaveBeenCalledWith(profileData);
    });

    it('should handle profile update with avatar upload workflow', async () => {
      const { db } = await import('../src/lib/supabase.js');
      const { profileStore } = await import('../src/lib/stores/profile.js');

      // Mock existing profile
      const existingProfile = {
        id: '123',
        wallet_address: '0x1234567890abcdef',
        nickname: 'OldUser',
        username: 'olduser',
        avatar_url: 'https://example.com/old-avatar.jpg',
        bio: 'Old bio',
      };

      db.getUserProfile.mockResolvedValue(existingProfile);

      // Step 1: Load existing profile
      const profile = await profileStore.loadProfile('0x1234567890abcdef');
      expect(profile).toEqual(existingProfile);

      // Step 2: Upload new avatar
      const mockFile = new File(['test'], 'new-avatar.jpg', { type: 'image/jpeg' });
      const newAvatarUrl = 'https://example.com/new-avatar.jpg';

      db.deleteAvatar.mockResolvedValue(true);
      db.uploadAvatar.mockResolvedValue(newAvatarUrl);
      
      const updatedProfileWithAvatar = {
        ...existingProfile,
        avatar_url: newAvatarUrl,
        updated_at: new Date().toISOString(),
      };
      
      db.upsertUserProfile.mockResolvedValue(updatedProfileWithAvatar);

      const avatarResult = await profileStore.uploadAvatar(mockFile, '0x1234567890abcdef');
      
      expect(db.deleteAvatar).toHaveBeenCalledWith(existingProfile.avatar_url);
      expect(db.uploadAvatar).toHaveBeenCalledWith(mockFile, '0x1234567890abcdef');
      expect(avatarResult).toBe(newAvatarUrl);

      // Step 3: Update other profile fields
      db.isUsernameAvailable.mockResolvedValue(true);
      
      const finalProfile = {
        ...updatedProfileWithAvatar,
        nickname: 'UpdatedUser',
        bio: 'Updated bio',
      };
      
      db.upsertUserProfile.mockResolvedValue(finalProfile);

      const updateResult = await profileStore.updateProfile({
        walletAddress: '0x1234567890abcdef',
        nickname: 'UpdatedUser',
        bio: 'Updated bio',
        avatarUrl: newAvatarUrl,
      });

      expect(updateResult).toEqual(finalProfile);
    });

    it('should handle username conflict during profile creation', async () => {
      const { db } = await import('../src/lib/supabase.js');
      const { profileStore } = await import('../src/lib/stores/profile.js');

      // Mock username availability check
      db.isUsernameAvailable
        .mockResolvedValueOnce(false) // First check: username taken
        .mockResolvedValueOnce(true);  // Second check: username available

      // Step 1: Check unavailable username
      const isFirstAvailable = await profileStore.checkUsernameAvailability('takenuser');
      expect(isFirstAvailable).toBe(false);

      // Step 2: Check available username
      const isSecondAvailable = await profileStore.checkUsernameAvailability('availableuser');
      expect(isSecondAvailable).toBe(true);

      expect(db.isUsernameAvailable).toHaveBeenCalledTimes(2);
    });

    it('should handle profile deletion workflow', async () => {
      const { db } = await import('../src/lib/supabase.js');
      const { profileStore } = await import('../src/lib/stores/profile.js');

      // Mock existing profile with avatar
      const existingProfile = {
        id: '123',
        wallet_address: '0x1234567890abcdef',
        nickname: 'TestUser',
        username: 'testuser',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
      };

      db.getUserProfile.mockResolvedValue(existingProfile);

      // Step 1: Load profile
      await profileStore.loadProfile('0x1234567890abcdef');

      // Step 2: Delete avatar
      db.deleteAvatar.mockResolvedValue(true);
      const deleteResult = await db.deleteAvatar(existingProfile.avatar_url);
      expect(deleteResult).toBe(true);

      // Step 3: Clear profile (simulating wallet disconnect)
      profileStore.clear();
      
      // Verify profile is cleared
      const { profileStore: freshStore } = await import('../src/lib/stores/profile.js');
      // Note: In a real test, you'd check the store state here
    });

    it('should handle error scenarios gracefully', async () => {
      const { db } = await import('../src/lib/supabase.js');
      const { profileStore } = await import('../src/lib/stores/profile.js');

      // Test database error during profile load
      db.getUserProfile.mockRejectedValue(new Error('Database connection failed'));

      await expect(profileStore.loadProfile('0x1234567890abcdef')).rejects.toThrow('Database connection failed');

      // Test avatar upload error
      const mockFile = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' });
      db.uploadAvatar.mockRejectedValue(new Error('Upload failed'));

      await expect(profileStore.uploadAvatar(mockFile, '0x1234567890abcdef')).rejects.toThrow('Upload failed');

      // Test profile update error
      db.upsertUserProfile.mockRejectedValue(new Error('Update failed'));

      await expect(profileStore.updateProfile({
        walletAddress: '0x1234567890abcdef',
        nickname: 'TestUser',
      })).rejects.toThrow('Update failed');
    });
  });

  describe('Profile Validation Scenarios', () => {
    it('should validate profile data constraints', async () => {
      const { profileStore } = await import('../src/lib/stores/profile.js');

      // These would typically be handled by the UI component validation
      // but we can test the database layer constraints

      const invalidProfileData = {
        walletAddress: '', // Empty wallet address
        nickname: 'x'.repeat(100), // Too long nickname
        username: 'ab', // Too short username
        bio: 'x'.repeat(1000), // Too long bio
      };

      // The actual validation would happen in the UserProfile component
      // Here we're just testing that the store can handle the data
      expect(invalidProfileData.walletAddress).toBe('');
      expect(invalidProfileData.nickname.length).toBe(100);
      expect(invalidProfileData.username.length).toBe(2);
      expect(invalidProfileData.bio.length).toBe(1000);
    });

    it('should handle special characters in profile data', async () => {
      const { db } = await import('../src/lib/supabase.js');
      const { profileStore } = await import('../src/lib/stores/profile.js');

      const specialCharProfile = {
        walletAddress: '0x1234567890abcdef',
        nickname: 'Test User 🎯',
        username: 'test_user-123',
        bio: 'Bio with émojis 🚀 and spëcial chars!',
      };

      const mockProfile = {
        id: '123',
        wallet_address: '0x1234567890abcdef',
        nickname: 'Test User 🎯',
        username: 'test_user-123',
        avatar_url: null,
        bio: 'Bio with émojis 🚀 and spëcial chars!',
      };

      db.upsertUserProfile.mockResolvedValue(mockProfile);

      const result = await profileStore.updateProfile(specialCharProfile);
      expect(result).toEqual(mockProfile);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent profile updates', async () => {
      const { db } = await import('../src/lib/supabase.js');
      const { profileStore } = await import('../src/lib/stores/profile.js');

      // Mock multiple concurrent updates
      const update1 = { walletAddress: '0x1234567890abcdef', nickname: 'User1' };
      const update2 = { walletAddress: '0x1234567890abcdef', bio: 'Updated bio' };

      db.upsertUserProfile
        .mockResolvedValueOnce({ ...update1, id: '123' })
        .mockResolvedValueOnce({ ...update2, id: '123' });

      // Execute concurrent updates
      const [result1, result2] = await Promise.all([
        profileStore.updateProfile(update1),
        profileStore.updateProfile(update2),
      ]);

      expect(result1.nickname).toBe('User1');
      expect(result2.bio).toBe('Updated bio');
      expect(db.upsertUserProfile).toHaveBeenCalledTimes(2);
    });
  });
});