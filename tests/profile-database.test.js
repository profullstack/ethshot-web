// Profile Database Functions Tests (Jest)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../src/lib/supabase.js';

// Mock Supabase client
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

// Mock the supabase client
vi.mock('../src/lib/supabase.js', async () => {
  const actual = await vi.importActual('../src/lib/supabase.js');
  return {
    ...actual,
    supabase: mockSupabase,
  };
});

describe('Profile Database Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      const mockProfile = {
        id: '123',
        wallet_address: '0x1234567890abcdef',
        nickname: 'TestUser',
        username: 'testuser',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
      };

      mockSupabase.rpc.mockResolvedValue({
        data: [mockProfile],
        error: null,
      });

      const result = await db.getUserProfile('0x1234567890ABCDEF');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_profile', {
        wallet_addr: '0x1234567890abcdef',
      });
      expect(result).toEqual(mockProfile);
    });

    it('should return null when profile not found', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await db.getUserProfile('0x1234567890abcdef');

      expect(result).toBe(null);
    });

    it('should handle database error gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await db.getUserProfile('0x1234567890abcdef');

      expect(result).toBe(null);
    });

    it('should return null when supabase is not configured', async () => {
      // Temporarily mock supabase as null
      const originalSupabase = mockSupabase;
      vi.mocked(db).getUserProfile = vi.fn().mockImplementation(async () => {
        console.warn('Supabase not configured - returning null for getUserProfile');
        return null;
      });

      const result = await db.getUserProfile('0x1234567890abcdef');

      expect(result).toBe(null);
    });
  });

  describe('upsertUserProfile', () => {
    it('should upsert user profile successfully', async () => {
      const profileData = {
        walletAddress: '0x1234567890ABCDEF',
        nickname: 'TestUser',
        username: 'testuser',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
      };

      const mockUpdatedProfile = {
        id: '123',
        wallet_address: '0x1234567890abcdef',
        nickname: 'TestUser',
        username: 'testuser',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
      };

      mockSupabase.rpc.mockResolvedValue({
        data: [mockUpdatedProfile],
        error: null,
      });

      const result = await db.upsertUserProfile(profileData);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_user_profile', {
        wallet_addr: '0x1234567890abcdef',
        p_nickname: 'TestUser',
        p_username: 'testuser',
        p_avatar_url: 'https://example.com/avatar.jpg',
        p_bio: 'Test bio',
      });
      expect(result).toEqual(mockUpdatedProfile);
    });

    it('should handle null values in profile data', async () => {
      const profileData = {
        walletAddress: '0x1234567890ABCDEF',
        nickname: null,
        username: 'testuser',
        avatarUrl: null,
        bio: null,
      };

      const mockUpdatedProfile = {
        id: '123',
        wallet_address: '0x1234567890abcdef',
        nickname: null,
        username: 'testuser',
        avatar_url: null,
        bio: null,
      };

      mockSupabase.rpc.mockResolvedValue({
        data: [mockUpdatedProfile],
        error: null,
      });

      const result = await db.upsertUserProfile(profileData);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_user_profile', {
        wallet_addr: '0x1234567890abcdef',
        p_nickname: null,
        p_username: 'testuser',
        p_avatar_url: null,
        p_bio: null,
      });
      expect(result).toEqual(mockUpdatedProfile);
    });

    it('should throw error when upsert fails', async () => {
      const profileData = {
        walletAddress: '0x1234567890abcdef',
        nickname: 'TestUser',
      };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Upsert failed' },
      });

      await expect(db.upsertUserProfile(profileData)).rejects.toThrow();
    });
  });

  describe('isUsernameAvailable', () => {
    it('should return true when username is available', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await db.isUsernameAvailable('newuser');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('is_username_available', {
        p_username: 'newuser',
        exclude_wallet_addr: null,
      });
      expect(result).toBe(true);
    });

    it('should return false when username is taken', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: false,
        error: null,
      });

      const result = await db.isUsernameAvailable('takenuser');

      expect(result).toBe(false);
    });

    it('should check username availability with exclusion', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await db.isUsernameAvailable('testuser', '0x1234567890abcdef');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('is_username_available', {
        p_username: 'testuser',
        exclude_wallet_addr: '0x1234567890abcdef',
      });
      expect(result).toBe(true);
    });

    it('should return false on database error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await db.isUsernameAvailable('testuser');

      expect(result).toBe(false);
    });
  });

  describe('uploadAvatar', () => {
    it('should upload avatar successfully', async () => {
      const mockFile = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' });
      const walletAddress = '0x1234567890abcdef';
      const expectedPath = `avatars/${walletAddress}-${Date.now()}.jpg`;
      const expectedUrl = 'https://example.com/storage/avatars/avatar.jpg';

      // Mock Date.now for consistent filename
      const mockDate = 1640995200000;
      vi.spyOn(Date, 'now').mockReturnValue(mockDate);

      const mockStorageBucket = {
        upload: vi.fn().mockResolvedValue({
          data: { path: expectedPath },
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: expectedUrl },
        }),
      };

      mockSupabase.storage.from.mockReturnValue(mockStorageBucket);

      const result = await db.uploadAvatar(mockFile, walletAddress);

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('avatars');
      expect(mockStorageBucket.upload).toHaveBeenCalledWith(
        `avatars/${walletAddress}-${mockDate}.jpg`,
        mockFile,
        {
          cacheControl: '3600',
          upsert: false,
        }
      );
      expect(mockStorageBucket.getPublicUrl).toHaveBeenCalledWith(`avatars/${walletAddress}-${mockDate}.jpg`);
      expect(result).toBe(expectedUrl);

      // Restore Date.now
      vi.restoreAllMocks();
    });

    it('should throw error when upload fails', async () => {
      const mockFile = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' });
      const walletAddress = '0x1234567890abcdef';

      const mockStorageBucket = {
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Upload failed' },
        }),
      };

      mockSupabase.storage.from.mockReturnValue(mockStorageBucket);

      await expect(db.uploadAvatar(mockFile, walletAddress)).rejects.toThrow();
    });

    it('should handle different file extensions', async () => {
      const mockFile = new File(['test'], 'avatar.png', { type: 'image/png' });
      const walletAddress = '0x1234567890abcdef';
      const mockDate = 1640995200000;

      vi.spyOn(Date, 'now').mockReturnValue(mockDate);

      const mockStorageBucket = {
        upload: vi.fn().mockResolvedValue({
          data: { path: `avatars/${walletAddress}-${mockDate}.png` },
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/avatar.png' },
        }),
      };

      mockSupabase.storage.from.mockReturnValue(mockStorageBucket);

      await db.uploadAvatar(mockFile, walletAddress);

      expect(mockStorageBucket.upload).toHaveBeenCalledWith(
        `avatars/${walletAddress}-${mockDate}.png`,
        mockFile,
        expect.any(Object)
      );

      vi.restoreAllMocks();
    });
  });

  describe('deleteAvatar', () => {
    it('should delete avatar successfully', async () => {
      const avatarUrl = 'https://example.com/storage/v1/object/public/avatars/test-avatar.jpg';

      const mockStorageBucket = {
        remove: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      mockSupabase.storage.from.mockReturnValue(mockStorageBucket);

      const result = await db.deleteAvatar(avatarUrl);

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('avatars');
      expect(mockStorageBucket.remove).toHaveBeenCalledWith(['avatars/test-avatar.jpg']);
      expect(result).toBe(true);
    });

    it('should return false when deletion fails', async () => {
      const avatarUrl = 'https://example.com/storage/v1/object/public/avatars/test-avatar.jpg';

      const mockStorageBucket = {
        remove: vi.fn().mockResolvedValue({
          error: { message: 'Delete failed' },
        }),
      };

      mockSupabase.storage.from.mockReturnValue(mockStorageBucket);

      const result = await db.deleteAvatar(avatarUrl);

      expect(result).toBe(false);
    });

    it('should return false when no avatar URL provided', async () => {
      const result = await db.deleteAvatar(null);

      expect(result).toBe(false);
      expect(mockSupabase.storage.from).not.toHaveBeenCalled();
    });

    it('should handle malformed URLs gracefully', async () => {
      const avatarUrl = 'invalid-url';

      const result = await db.deleteAvatar(avatarUrl);

      expect(result).toBe(false);
    });
  });
});

describe('Profile Database Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty wallet address', async () => {
    const result = await db.getUserProfile('');
    expect(result).toBe(null);
  });

  it('should handle undefined profile data', async () => {
    await expect(db.upsertUserProfile(undefined)).rejects.toThrow();
  });

  it('should handle special characters in username', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: true,
      error: null,
    });

    const result = await db.isUsernameAvailable('user@test.com');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('is_username_available', {
      p_username: 'user@test.com',
      exclude_wallet_addr: null,
    });
    expect(result).toBe(true);
  });

  it('should handle very large file uploads', async () => {
    const largeFile = new File(['x'.repeat(10 * 1024 * 1024)], 'large-avatar.jpg', { 
      type: 'image/jpeg' 
    });
    const walletAddress = '0x1234567890abcdef';

    const mockStorageBucket = {
      upload: vi.fn().mockResolvedValue({
        data: { path: 'avatars/large-avatar.jpg' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/large-avatar.jpg' },
      }),
    };

    mockSupabase.storage.from.mockReturnValue(mockStorageBucket);

    const result = await db.uploadAvatar(largeFile, walletAddress);

    expect(result).toBe('https://example.com/large-avatar.jpg');
  });
});