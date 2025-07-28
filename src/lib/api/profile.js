/**
 * Profile API Client
 *
 * Handles all profile-related API operations with proper JWT authentication.
 * Provides a clean interface for profile CRUD operations.
 */

import { BaseApiClient } from './base.js';

/**
 * Profile API endpoints
 */
const ENDPOINTS = {
  PROFILE: '/api/profile'
};

/**
 * Profile API client that extends BaseApiClient for centralized auth
 */
export class ProfileAPI extends BaseApiClient {
  constructor() {
    super(); // Initialize base client
  }
  /**
   * Update or create user profile
   * @param {Object} profileData - Profile data to upsert
   * @param {string} [profileData.nickname] - User nickname
   * @param {string} [profileData.avatarUrl] - Avatar URL
   * @param {string} [profileData.bio] - User bio
   * @param {boolean} [profileData.notificationsEnabled] - Notification preferences
   * @returns {Promise<Object>} Updated profile data
   */
  async upsertProfile(profileData) {
    console.log('🔄 Profile API: Upserting profile:', {
      nickname: profileData.nickname,
      avatarUrl: profileData.avatarUrl ? 'provided' : 'none',
      bio: profileData.bio ? `${profileData.bio.length} chars` : 'none',
      notificationsEnabled: profileData.notificationsEnabled
    });

    try {
      const response = await this.post(ENDPOINTS.PROFILE, {
        action: 'upsert',
        profileData
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update profile');
      }

      console.log('✅ Profile API: Profile upserted successfully:', response.profile);
      return response.profile;
    } catch (error) {
      console.error('❌ Profile API: Failed to upsert profile:', error);
      throw new Error(`Profile update failed: ${error.message}`);
    }
  }

  /**
   * Get user profile by wallet address
   * @param {string} walletAddress - Wallet address to get profile for
   * @returns {Promise<Object|null>} User profile or null if not found
   */
  async getProfile(walletAddress) {
    console.log('🔍 Profile API: Getting profile:', { walletAddress });

    try {
      const response = await this.post(ENDPOINTS.PROFILE, {
        action: 'get',
        walletAddress
      }, {}, false); // Public endpoint, no auth required

      if (!response.success) {
        if (response.error?.includes('not found')) {
          console.log('ℹ️ Profile API: Profile not found for wallet:', walletAddress);
          return null;
        }
        throw new Error(response.error || 'Failed to get profile');
      }

      console.log('✅ Profile API: Profile retrieved successfully:', response.profile);
      return response.profile;
    } catch (error) {
      console.error('❌ Profile API: Failed to get profile:', error);
      
      // Return null for not found errors, throw for others
      if (error.message?.includes('not found') || error.status === 404) {
        return null;
      }
      
      throw new Error(`Profile retrieval failed: ${error.message}`);
    }
  }

  /**
   * Check if nickname is available
   * @param {string} nickname - Nickname to check
   * @param {string} [excludeWalletAddress] - Wallet address to exclude from check
   * @returns {Promise<boolean>} True if nickname is available
   */
  async checkNicknameAvailability(nickname, excludeWalletAddress = null) {
    console.log('🔍 Profile API: Checking nickname availability:', {
      nickname,
      excludeWalletAddress
    });

    try {
      const response = await this.post(ENDPOINTS.PROFILE, {
        action: 'check_nickname',
        nickname,
        excludeWalletAddress
      }, {}, false); // Public endpoint, no auth required

      if (!response.success) {
        throw new Error(response.error || 'Failed to check nickname availability');
      }

      console.log('✅ Profile API: Nickname availability checked:', {
        nickname,
        available: response.available
      });

      return response.available;
    } catch (error) {
      console.error('❌ Profile API: Failed to check nickname availability:', error);
      // Return false on error to be safe (assume nickname is not available)
      return false;
    }
  }

  /**
   * Get multiple user profiles by wallet addresses
   * @param {string[]} walletAddresses - Array of wallet addresses
   * @returns {Promise<Object[]>} Array of user profiles
   */
  async getProfiles(walletAddresses) {
    console.log('🔍 Profile API: Getting multiple profiles:', {
      count: walletAddresses.length,
      addresses: walletAddresses.slice(0, 3) // Log first 3 for debugging
    });

    try {
      // For now, get profiles individually
      // TODO: Consider adding a batch endpoint if needed for performance
      const profiles = await Promise.all(
        walletAddresses.map(async (address) => {
          try {
            const profile = await this.getProfile(address);
            return profile;
          } catch (error) {
            console.warn(`Failed to get profile for ${address}:`, error);
            return null;
          }
        })
      );

      const validProfiles = profiles.filter(profile => profile !== null);
      
      console.log('✅ Profile API: Multiple profiles retrieved:', {
        requested: walletAddresses.length,
        found: validProfiles.length
      });

      return validProfiles;
    } catch (error) {
      console.error('❌ Profile API: Failed to get multiple profiles:', error);
      throw new Error(`Batch profile retrieval failed: ${error.message}`);
    }
  }
}

// Create and export default instance
export const profileAPI = new ProfileAPI();

// Export convenience functions
export const {
  upsertProfile,
  getProfile,
  checkNicknameAvailability,
  getProfiles
} = profileAPI;
