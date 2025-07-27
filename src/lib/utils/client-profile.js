/**
 * Client-side Profile API Utilities
 * 
 * Provides secure client-side functions to interact with the server-side profile API.
 * All sensitive operations are handled server-side with JWT authentication.
 */

/**
 * Get JWT token from localStorage
 * @returns {string|null} JWT token or null if not found
 */
function getStoredJWTToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ethshot_jwt_token');
}

/**
 * Create authorization headers with JWT token
 * @returns {Object} Headers object with authorization
 */
function createAuthHeaders() {
  const token = getStoredJWTToken();
  if (!token) {
    throw new Error('No authentication token found. Please connect your wallet first.');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Upsert user profile via server-side API
 * @param {Object} profileData - Profile data to update
 * @param {string} profileData.nickname - User nickname
 * @param {string} profileData.avatarUrl - Avatar URL
 * @param {string} profileData.bio - User bio
 * @param {boolean} profileData.notificationsEnabled - Notifications preference
 * @returns {Promise<Object>} API response with profile data
 */
export async function upsertUserProfileAPI(profileData) {
  try {
    console.log('🔄 Upserting user profile via API:', profileData);

    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify({
        action: 'upsert',
        profileData
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Profile upsert API error:', result);
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!result.success) {
      console.error('❌ Profile upsert failed:', result);
      throw new Error(result.error || 'Profile upsert failed');
    }

    console.log('✅ Profile upserted successfully via API:', result.profile);
    return result.profile;
  } catch (error) {
    console.error('❌ Profile upsert API error:', error);
    throw error;
  }
}

/**
 * Get user profile via server-side API
 * @param {string} walletAddress - Wallet address to get profile for
 * @returns {Promise<Object|null>} Profile data or null if not found
 */
export async function getUserProfileAPI(walletAddress) {
  try {
    console.log('🔍 Getting user profile via API:', { walletAddress });

    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'get',
        walletAddress
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Profile get API error:', result);
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!result.success) {
      console.error('❌ Profile get failed:', result);
      throw new Error(result.error || 'Profile retrieval failed');
    }

    console.log('✅ Profile retrieved successfully via API:', result.profile);
    return result.profile;
  } catch (error) {
    console.error('❌ Profile get API error:', error);
    throw error;
  }
}

/**
 * Check if nickname is available via server-side API
 * @param {string} nickname - Nickname to check
 * @param {string} [excludeWalletAddress] - Wallet address to exclude from check
 * @returns {Promise<boolean>} True if nickname is available
 */
export async function isNicknameAvailableAPI(nickname, excludeWalletAddress = null) {
  try {
    console.log('🔍 Checking nickname availability via API:', { nickname, excludeWalletAddress });

    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'check_nickname',
        nickname,
        excludeWalletAddress
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Nickname check API error:', result);
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!result.success) {
      console.error('❌ Nickname check failed:', result);
      throw new Error(result.error || 'Nickname availability check failed');
    }

    console.log('✅ Nickname availability checked via API:', result.available);
    return result.available;
  } catch (error) {
    console.error('❌ Nickname check API error:', error);
    throw error;
  }
}

/**
 * Check if user is authenticated (has valid JWT token)
 * @returns {boolean} True if user has a valid JWT token
 */
export function isAuthenticatedForProfile() {
  const token = getStoredJWTToken();
  if (!token) return false;
  
  try {
    // Basic JWT structure check (header.payload.signature)
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Decode payload to check expiration
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    
    return payload.exp > now;
  } catch (error) {
    console.warn('❌ Invalid JWT token format:', error);
    return false;
  }
}

/**
 * Get current authenticated wallet address from JWT token
 * @returns {string|null} Wallet address or null if not authenticated
 */
export function getAuthenticatedWalletAddress() {
  const token = getStoredJWTToken();
  if (!token) return null;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp <= now) return null; // Token expired
    
    return payload.wallet_address || null;
  } catch (error) {
    console.warn('❌ Error extracting wallet address from JWT:', error);
    return null;
  }
}