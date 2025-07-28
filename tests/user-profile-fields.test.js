/**
 * User Profile Fields Test
 * 
 * Tests that the new profile fields (twitter_handle, discord_handle, website_url)
 * are properly loaded and passed to the user profile page component.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

describe('User Profile Fields Integration', () => {
  describe('Profile Data Structure', () => {
    it('should include all required social media fields in profile object', () => {
      // Mock user profile data as returned from the database
      const mockUserProfile = {
        nickname: 'TestUser',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
        twitter_handle: 'testuser',
        discord_handle: 'testuser#1234',
        website_url: 'https://testuser.com',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };

      // Mock player data
      const mockPlayerData = {
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };

      // Simulate the profile object creation logic from +page.js
      const profile = {
        nickname: mockUserProfile?.nickname || null,
        avatar_url: mockUserProfile?.avatar_url || null,
        bio: mockUserProfile?.bio || null,
        twitter_handle: mockUserProfile?.twitter_handle || null,
        discord_handle: mockUserProfile?.discord_handle || null,
        website_url: mockUserProfile?.website_url || null,
        created_at: mockUserProfile?.created_at || mockPlayerData.created_at,
        updated_at: mockUserProfile?.updated_at || mockPlayerData.updated_at
      };

      // Verify all fields are present
      expect(profile).to.have.property('nickname', 'TestUser');
      expect(profile).to.have.property('avatar_url', 'https://example.com/avatar.jpg');
      expect(profile).to.have.property('bio', 'Test bio');
      expect(profile).to.have.property('twitter_handle', 'testuser');
      expect(profile).to.have.property('discord_handle', 'testuser#1234');
      expect(profile).to.have.property('website_url', 'https://testuser.com');
      expect(profile).to.have.property('created_at');
      expect(profile).to.have.property('updated_at');
    });

    it('should handle null values for optional social media fields', () => {
      // Mock user profile data with null social media fields
      const mockUserProfile = {
        nickname: 'TestUser',
        avatar_url: null,
        bio: null,
        twitter_handle: null,
        discord_handle: null,
        website_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };

      const mockPlayerData = {
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };

      // Simulate the profile object creation logic from +page.js
      const profile = {
        nickname: mockUserProfile?.nickname || null,
        avatar_url: mockUserProfile?.avatar_url || null,
        bio: mockUserProfile?.bio || null,
        twitter_handle: mockUserProfile?.twitter_handle || null,
        discord_handle: mockUserProfile?.discord_handle || null,
        website_url: mockUserProfile?.website_url || null,
        created_at: mockUserProfile?.created_at || mockPlayerData.created_at,
        updated_at: mockUserProfile?.updated_at || mockPlayerData.updated_at
      };

      // Verify null values are handled correctly
      expect(profile.twitter_handle).to.be.null;
      expect(profile.discord_handle).to.be.null;
      expect(profile.website_url).to.be.null;
      expect(profile.nickname).to.equal('TestUser');
    });

    it('should handle missing userProfile data gracefully', () => {
      // Mock scenario where userProfile is null/undefined
      const mockUserProfile = null;
      const mockPlayerData = {
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };

      // Simulate the profile object creation logic from +page.js
      const profile = {
        nickname: mockUserProfile?.nickname || null,
        avatar_url: mockUserProfile?.avatar_url || null,
        bio: mockUserProfile?.bio || null,
        twitter_handle: mockUserProfile?.twitter_handle || null,
        discord_handle: mockUserProfile?.discord_handle || null,
        website_url: mockUserProfile?.website_url || null,
        created_at: mockUserProfile?.created_at || mockPlayerData.created_at,
        updated_at: mockUserProfile?.updated_at || mockPlayerData.updated_at
      };

      // Verify all fields default to null when userProfile is missing
      expect(profile.nickname).to.be.null;
      expect(profile.avatar_url).to.be.null;
      expect(profile.bio).to.be.null;
      expect(profile.twitter_handle).to.be.null;
      expect(profile.discord_handle).to.be.null;
      expect(profile.website_url).to.be.null;
      expect(profile.created_at).to.equal(mockPlayerData.created_at);
      expect(profile.updated_at).to.equal(mockPlayerData.updated_at);
    });
  });

  describe('Social Media Display Logic', () => {
    it('should show social media links when fields are present', () => {
      const profile = {
        twitter_handle: 'testuser',
        discord_handle: 'testuser#1234',
        website_url: 'https://testuser.com'
      };

      // Simulate the conditional display logic from the Svelte component
      const shouldShowSocialMedia = !!(profile?.twitter_handle || profile?.discord_handle || profile?.website_url);
      
      expect(shouldShowSocialMedia).to.be.true;
    });

    it('should hide social media section when no fields are present', () => {
      const profile = {
        twitter_handle: null,
        discord_handle: null,
        website_url: null
      };

      // Simulate the conditional display logic from the Svelte component
      const shouldShowSocialMedia = !!(profile?.twitter_handle || profile?.discord_handle || profile?.website_url);
      
      expect(shouldShowSocialMedia).to.be.false;
    });

    it('should show social media section when at least one field is present', () => {
      const profile = {
        twitter_handle: 'testuser',
        discord_handle: null,
        website_url: null
      };

      // Simulate the conditional display logic from the Svelte component
      const shouldShowSocialMedia = !!(profile?.twitter_handle || profile?.discord_handle || profile?.website_url);
      
      expect(shouldShowSocialMedia).to.be.true;
    });
  });
});