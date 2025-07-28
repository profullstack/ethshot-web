import { writable, derived } from 'svelte/store';
import { walletAddress, isConnected } from './wallet.js';
import { db } from '../database/index.js';

// Profile store state
const createProfileStore = () => {
  const { subscribe, set, update } = writable({
    profile: null,
    loading: false,
    error: null,
    uploadingAvatar: false,
  });

  return {
    subscribe,
    
    // Load user profile by wallet address
    async loadProfile(address) {
      if (!address) {
        set({ profile: null, loading: false, error: null, uploadingAvatar: false });
        return;
      }

      update(state => ({ ...state, loading: true, error: null }));

      try {
        const profile = await db.getUserProfile(address);
        update(state => ({ 
          ...state, 
          profile, 
          loading: false, 
          error: null 
        }));
        return profile;
      } catch (error) {
        console.error('Failed to load user profile:', error);
        update(state => ({ 
          ...state, 
          loading: false, 
          error: error.message || 'Failed to load profile' 
        }));
        throw error;
      }
    },

    // Update user profile
    async updateProfile(profileData) {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        // Unwrap if wrapped in { profileData }
        const actualProfileData = profileData.profileData ? profileData.profileData : profileData;
        
        console.log('🔄 Profile Store: Updating profile with data:', {
          debug_mode: actualProfileData.debugMode,
          notifications_enabled: actualProfileData.notificationsEnabled,
          nickname: actualProfileData.nickname
        });
        
        const updatedProfile = await db.upsertUserProfile(actualProfileData);
        
        console.log('✅ Profile Store: Profile updated, received from API:', {
          debug_mode: updatedProfile?.debug_mode,
          notifications_enabled: updatedProfile?.notifications_enabled,
          nickname: updatedProfile?.nickname
        });
        
        // Update the store with the fresh data from the API
        update(state => ({
          ...state,
          profile: updatedProfile,
          loading: false,
          error: null
        }));
        
        console.log('🔄 Profile Store: Store updated with fresh profile data');
        
        return updatedProfile;
      } catch (error) {
        console.error('Failed to update user profile:', error);
        update(state => ({ ...state, loading: false, error: error.message || 'Failed to update profile' }));
        throw error;
      }
    },

    // Upload avatar (returns URL without updating profile)
    async uploadAvatar(file, walletAddr) {
      update(state => ({ ...state, uploadingAvatar: true, error: null }));

      try {
        // Delete old avatar if exists
        let currentState;
        const unsubscribe = subscribe(state => {
          currentState = state;
        });
        unsubscribe();

        if (currentState.profile?.avatar_url) {
          try {
            await db.deleteAvatar(currentState.profile.avatar_url);
          } catch (deleteError) {
            console.warn('Failed to delete old avatar:', deleteError);
            // Continue with upload even if deletion fails
          }
        }

        // Upload new avatar and return URL
        const avatarUrl = await db.uploadAvatar(file, walletAddr);
        
        update(state => ({
          ...state,
          uploadingAvatar: false,
          error: null
        }));

        return avatarUrl;
      } catch (error) {
        console.error('Failed to upload avatar:', error);
        update(state => ({
          ...state,
          uploadingAvatar: false,
          error: error.message || 'Failed to upload avatar'
        }));
        throw error;
      }
    },


    // Check nickname availability
    async checkNicknameAvailability(nickname, excludeWalletAddress = null) {
      try {
        return await db.isNicknameAvailable(nickname, excludeWalletAddress);
      } catch (error) {
        console.error('Failed to check nickname availability:', error);
        return false;
      }
    },

    // Clear profile data
    clear() {
      set({ profile: null, loading: false, error: null, uploadingAvatar: false });
    },

    // Clear error
    clearError() {
      update(state => ({ ...state, error: null }));
    },

    // Force reload profile (useful for page refresh scenarios)
    async forceReloadProfile(address) {
      if (!address) {
        this.clear();
        return;
      }

      console.log('🔄 Profile Store: Force reloading profile for:', address);
      
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const profile = await db.getUserProfile(address);
        update(state => ({
          ...state,
          profile,
          loading: false,
          error: null
        }));
        
        console.log('✅ Profile Store: Profile force reloaded successfully:', {
          debug_mode: profile?.debug_mode,
          notifications_enabled: profile?.notifications_enabled
        });
        
        return profile;
      } catch (error) {
        console.error('❌ Profile Store: Failed to force reload profile:', error);
        update(state => ({
          ...state,
          loading: false,
          error: error.message || 'Failed to reload profile'
        }));
        throw error;
      }
    }
  };
};

export const profileStore = createProfileStore();

// Derived stores for easy access to specific profile data
export const userProfile = derived(profileStore, $profileStore => $profileStore.profile);
export const profileLoading = derived(profileStore, $profileStore => $profileStore.loading);
export const profileError = derived(profileStore, $profileStore => $profileStore.error);
export const uploadingAvatar = derived(profileStore, $profileStore => $profileStore.uploadingAvatar);

// Derived store for display name (nickname or truncated address)
export const displayName = derived(
  [userProfile, walletAddress],
  ([$userProfile, $walletAddress]) => {
    if ($userProfile?.nickname) return $userProfile.nickname;
    if ($walletAddress) return `${$walletAddress.slice(0, 6)}...${$walletAddress.slice(-4)}`;
    return '';
  }
);

// Derived store for avatar URL with fallback
export const avatarUrl = derived(userProfile, $userProfile => {
  return $userProfile?.avatar_url || null;
});

// Derived store for notification preferences
export const notificationsEnabled = derived(userProfile, $userProfile => {
  return $userProfile?.notifications_enabled ?? true; // Default to true if not set
});

// Derived store for admin status
export const isAdmin = derived(userProfile, $userProfile => {
  return $userProfile?.is_admin ?? false; // Default to false if not set
});

// Auto-load profile when wallet connects
let currentAddress = null;
walletAddress.subscribe(async (address) => {
  if (address && address !== currentAddress) {
    currentAddress = address;
    try {
      await profileStore.loadProfile(address);
    } catch (error) {
      console.warn('Failed to auto-load profile:', error);
    }
  } else if (!address && currentAddress) {
    currentAddress = null;
    profileStore.clear();
  }
});

// Clear profile when wallet disconnects
isConnected.subscribe((connected) => {
  if (!connected) {
    profileStore.clear();
  }
});