/**
 * Client-side Referral API Utilities
 * 
 * Provides secure client-side functions to interact with the server-side referral API.
 * All sensitive operations are handled server-side with optional JWT authentication.
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
 * Create referral code via server-side API
 * @param {string} referrerAddress - The referrer's wallet address
 * @returns {Promise<string|null>} Referral code or null if failed
 */
export async function createReferralCodeAPI(referrerAddress) {
  try {
    console.log('🔗 Creating referral code via API:', { referrerAddress });

    const authToken = getStoredJWTToken();
    
    const response = await fetch('/api/referral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'create_referral_code',
        referrerAddress,
        authToken
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Create referral code API error:', result);
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!result.success) {
      console.error('❌ Create referral code failed:', result);
      throw new Error(result.error || 'Failed to create referral code');
    }

    console.log('✅ Referral code created successfully via API:', result.referralCode);
    return result.referralCode;
  } catch (error) {
    console.error('❌ Create referral code API error:', error);
    throw error;
  }
}

/**
 * Process referral signup via server-side API
 * @param {string} referralCode - The referral code
 * @param {string} refereeAddress - The referee's wallet address
 * @returns {Promise<boolean>} True if successful
 */
export async function processReferralSignupAPI(referralCode, refereeAddress) {
  try {
    console.log('🔗 Processing referral signup via API:', { referralCode, refereeAddress });

    const response = await fetch('/api/referral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'process_referral_signup',
        referralCode,
        refereeAddress
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Process referral signup API error:', result);
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!result.success) {
      console.error('❌ Process referral signup failed:', result);
      return false;
    }

    console.log('✅ Referral signup processed successfully via API:', result.result);
    return result.result;
  } catch (error) {
    console.error('❌ Process referral signup API error:', error);
    return false;
  }
}

/**
 * Use referral discount via server-side API
 * @param {number} discountId - The discount ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object|null>} Discount usage result or null if failed
 */
export async function useReferralDiscountAPI(discountId, userId) {
  try {
    console.log('🔗 Using referral discount via API:', { discountId, userId });

    const authToken = getStoredJWTToken();
    
    const response = await fetch('/api/referral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'use_referral_discount',
        discountId,
        userId,
        authToken
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Use referral discount API error:', result);
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!result.success) {
      console.error('❌ Use referral discount failed:', result);
      return null;
    }

    console.log('✅ Referral discount used successfully via API:', result.result);
    return result.result;
  } catch (error) {
    console.error('❌ Use referral discount API error:', error);
    return null;
  }
}

/**
 * Get referral statistics via server-side API
 * @param {string} playerAddress - The player's wallet address
 * @returns {Promise<Object|null>} Referral stats or null if failed
 */
export async function getReferralStatsAPI(playerAddress) {
  try {
    console.log('🔗 Getting referral stats via API:', { playerAddress });

    const response = await fetch('/api/referral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'get_referral_stats',
        playerAddress
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Get referral stats API error:', result);
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!result.success) {
      console.error('❌ Get referral stats failed:', result);
      return null;
    }

    console.log('✅ Referral stats retrieved successfully via API:', result.stats);
    return result.stats;
  } catch (error) {
    console.error('❌ Get referral stats API error:', error);
    return null;
  }
}

/**
 * Get referral code for a referrer via server-side API
 * @param {string} referrerAddress - The referrer's wallet address
 * @returns {Promise<string|null>} Referral code or null if not found
 */
export async function getReferralCodeAPI(referrerAddress) {
  try {
    console.log('🔗 Getting referral code via API:', { referrerAddress });

    const response = await fetch('/api/referral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'get_referral_code',
        referrerAddress
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Get referral code API error:', result);
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!result.success) {
      console.error('❌ Get referral code failed:', result);
      return null;
    }

    console.log('✅ Referral code retrieved successfully via API:', result.referralCode);
    return result.referralCode;
  } catch (error) {
    console.error('❌ Get referral code API error:', error);
    return null;
  }
}

/**
 * Validate referral code via server-side API
 * @param {string} referralCode - The referral code to validate
 * @returns {Promise<boolean>} True if valid
 */
export async function validateReferralCodeAPI(referralCode) {
  try {
    console.log('🔗 Validating referral code via API:', { referralCode });

    const response = await fetch('/api/referral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'validate_referral_code',
        referralCode
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Validate referral code API error:', result);
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!result.success) {
      console.error('❌ Validate referral code failed:', result);
      return false;
    }

    console.log('✅ Referral code validated successfully via API:', result.isValid);
    return result.isValid;
  } catch (error) {
    console.error('❌ Validate referral code API error:', error);
    return false;
  }
}