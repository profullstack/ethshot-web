/**
 * Profile Reactivity Fix Test
 * 
 * Tests the fix for the profile editing reactivity issue where form fields
 * weren't properly updating when profile data changed.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import UserProfile from '../src/lib/components/UserProfile.svelte';

// Mock the stores
const mockProfileStore = {
  subscribe: jest.fn(),
  loadProfile: jest.fn(),
  updateProfile: jest.fn(),
  uploadAvatar: jest.fn(),
  checkNicknameAvailability: jest.fn(),
  clear: jest.fn(),
  clearError: jest.fn()
};

const mockUserProfile = writable(null);
const mockProfileLoading = writable(false);
const mockProfileError = writable(null);
const mockUploadingAvatar = writable(false);
const mockWalletAddress = writable('0x1234567890abcdef');
const mockToastStore = {
  success: jest.fn(),
  error: jest.fn()
};

// Mock the imports
jest.mock('../src/lib/stores/profile.js', () => ({
  profileStore: mockProfileStore,
  userProfile: mockUserProfile,
  profileLoading: mockProfileLoading,
  profileError: mockProfileError,
  uploadingAvatar: mockUploadingAvatar
}));

jest.mock('../src/lib/stores/wallet.js', () => ({
  walletAddress: mockWalletAddress
}));

jest.mock('../src/lib/stores/toast.js', () => ({
  toastStore: mockToastStore
}));

describe('Profile Reactivity Fix', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockUserProfile.set(null);
    mockProfileLoading.set(false);
    mockProfileError.set(null);
    mockUploadingAvatar.set(false);
    mockWalletAddress.set('0x1234567890abcdef');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize form with empty values when no profile data exists', async () => {
    const { component } = render(UserProfile, {
      props: { show: true }
    });

    await waitFor(() => {
      const nicknameInput = screen.getByPlaceholderText('Enter a display name');
      const bioTextarea = screen.getByPlaceholderText('Tell us about yourself...');
      
      expect(nicknameInput.value).toBe('');
      expect(bioTextarea.value).toBe('');
    });
  });

  it('should initialize form with profile data when available', async () => {
    const mockProfile = {
      nickname: 'TestUser',
      bio: 'Test bio content',
      avatar_url: 'https://example.com/avatar.jpg',
      notifications_enabled: false
    };

    mockUserProfile.set(mockProfile);

    const { component } = render(UserProfile, {
      props: { show: true }
    });

    await waitFor(() => {
      const nicknameInput = screen.getByPlaceholderText('Enter a display name');
      const bioTextarea = screen.getByPlaceholderText('Tell us about yourself...');
      
      expect(nicknameInput.value).toBe('TestUser');
      expect(bioTextarea.value).toBe('Test bio content');
    });
  });

  it('should update form when profile data changes after modal opens', async () => {
    // Start with no profile data
    mockUserProfile.set(null);

    const { component } = render(UserProfile, {
      props: { show: true }
    });

    // Verify form starts empty
    await waitFor(() => {
      const nicknameInput = screen.getByPlaceholderText('Enter a display name');
      expect(nicknameInput.value).toBe('');
    });

    // Simulate profile data loading after modal opens
    const mockProfile = {
      nickname: 'LoadedUser',
      bio: 'Loaded bio content',
      avatar_url: 'https://example.com/loaded-avatar.jpg',
      notifications_enabled: true
    };

    mockUserProfile.set(mockProfile);

    // Verify form updates with new data
    await waitFor(() => {
      const nicknameInput = screen.getByPlaceholderText('Enter a display name');
      const bioTextarea = screen.getByPlaceholderText('Tell us about yourself...');
      
      expect(nicknameInput.value).toBe('LoadedUser');
      expect(bioTextarea.value).toBe('Loaded bio content');
    });
  });

  it('should update form when profile data changes between modal sessions', async () => {
    // First session with initial profile
    const initialProfile = {
      nickname: 'InitialUser',
      bio: 'Initial bio',
      avatar_url: null,
      notifications_enabled: true
    };

    mockUserProfile.set(initialProfile);

    const { component, rerender } = render(UserProfile, {
      props: { show: true }
    });

    await waitFor(() => {
      const nicknameInput = screen.getByPlaceholderText('Enter a display name');
      expect(nicknameInput.value).toBe('InitialUser');
    });

    // Close modal
    await rerender({ show: false });

    // Update profile data
    const updatedProfile = {
      nickname: 'UpdatedUser',
      bio: 'Updated bio content',
      avatar_url: 'https://example.com/updated-avatar.jpg',
      notifications_enabled: false
    };

    mockUserProfile.set(updatedProfile);

    // Reopen modal
    await rerender({ show: true });

    // Verify form shows updated data
    await waitFor(() => {
      const nicknameInput = screen.getByPlaceholderText('Enter a display name');
      const bioTextarea = screen.getByPlaceholderText('Tell us about yourself...');
      
      expect(nicknameInput.value).toBe('UpdatedUser');
      expect(bioTextarea.value).toBe('Updated bio content');
    });
  });

  it('should handle profile data reference changes correctly', async () => {
    // Create initial profile object
    const initialProfile = {
      nickname: 'User1',
      bio: 'Bio1',
      avatar_url: null,
      notifications_enabled: true
    };

    mockUserProfile.set(initialProfile);

    const { component } = render(UserProfile, {
      props: { show: true }
    });

    await waitFor(() => {
      const nicknameInput = screen.getByPlaceholderText('Enter a display name');
      expect(nicknameInput.value).toBe('User1');
    });

    // Create new profile object with same content (different reference)
    const sameContentProfile = {
      nickname: 'User1',
      bio: 'Bio1',
      avatar_url: null,
      notifications_enabled: true
    };

    mockUserProfile.set(sameContentProfile);

    // Form should still work correctly even with reference change
    await waitFor(() => {
      const nicknameInput = screen.getByPlaceholderText('Enter a display name');
      expect(nicknameInput.value).toBe('User1');
    });

    // Now change the actual content
    const differentContentProfile = {
      nickname: 'User2',
      bio: 'Bio2',
      avatar_url: 'https://example.com/avatar2.jpg',
      notifications_enabled: false
    };

    mockUserProfile.set(differentContentProfile);

    // Form should update with new content
    await waitFor(() => {
      const nicknameInput = screen.getByPlaceholderText('Enter a display name');
      const bioTextarea = screen.getByPlaceholderText('Tell us about yourself...');
      
      expect(nicknameInput.value).toBe('User2');
      expect(bioTextarea.value).toBe('Bio2');
    });
  });

  it('should reset form state when modal closes', async () => {
    const mockProfile = {
      nickname: 'TestUser',
      bio: 'Test bio',
      avatar_url: null,
      notifications_enabled: true
    };

    mockUserProfile.set(mockProfile);

    const { component, rerender } = render(UserProfile, {
      props: { show: true }
    });

    // Modify form data
    await waitFor(() => {
      const nicknameInput = screen.getByPlaceholderText('Enter a display name');
      fireEvent.input(nicknameInput, { target: { value: 'ModifiedUser' } });
      expect(nicknameInput.value).toBe('ModifiedUser');
    });

    // Close modal
    await rerender({ show: false });

    // Reopen modal
    await rerender({ show: true });

    // Form should be reset to original profile data
    await waitFor(() => {
      const nicknameInput = screen.getByPlaceholderText('Enter a display name');
      expect(nicknameInput.value).toBe('TestUser');
    });
  });
});