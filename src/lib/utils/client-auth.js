/**
 * Client-side Authentication Utilities
 *
 * This module provides client-side authentication functions that communicate
 * with the server-side API endpoints instead of directly calling Supabase.
 * This ensures security by keeping sensitive operations on the server.
 */

import { supabase } from '../database/client.js';
import { clearAllAuthStorage, verifyAuthStorageCleared } from './storage-cleanup.js';

/**
 * Authenticate user with wallet signature via server-side API
 * @param {string} walletAddress - The connected wallet address
 * @param {Object} signer - The ethers signer object
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Object>} Authentication result with JWT token
 */
export async function authenticateWithWalletAPI(walletAddress, signer, maxRetries = 3) {
  if (!walletAddress) {
    throw new Error('Wallet address is required');
  }

  if (!signer) {
    throw new Error('Wallet signer is required for authentication');
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔐 Starting API-based authentication (attempt ${attempt}/${maxRetries}):`, walletAddress);

      // Step 1: Generate nonce via API
      console.log('📝 Requesting authentication nonce from server...');
      const nonceResponse = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate_nonce',
          walletAddress
        })
      });

      if (!nonceResponse.ok) {
        const errorData = await nonceResponse.json();
        throw new Error(`Server error: ${errorData.error || 'Failed to generate nonce'}`);
      }

      const nonceResult = await nonceResponse.json();
      
      if (!nonceResult.success) {
        throw new Error('Failed to generate authentication nonce');
      }

      console.log('✅ Nonce received, requesting wallet signature...');
      
      // Step 2: Request signature from wallet
      const signature = await signer.signMessage(nonceResult.message);
      console.log('✅ Signature received from wallet');

      // Step 3: Verify signature via API and get JWT token
      console.log('🔍 Verifying signature with server...');
      const authResponse = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'verify_signature',
          walletAddress,
          signature
        })
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        throw new Error(`Authentication failed: ${errorData.error || 'Server error'}`);
      }

      const authResult = await authResponse.json();
      
      if (!authResult.success) {
        throw new Error('Authentication verification failed');
      }

      console.log('✅ JWT token received from server');

      // Step 4: Store JWT token for API-based authentication
      console.log('💾 Storing JWT token for API-based authentication...');
      
      // Store the JWT token in localStorage for API calls
      localStorage.setItem('ethshot_jwt_token', authResult.jwtToken);
      localStorage.setItem('ethshot_wallet_address', authResult.walletAddress);
      localStorage.setItem('ethshot_auth_expires_at', authResult.expiresAt?.toString() || '');
      
      // Create a mock user object for compatibility
      const mockUser = {
        id: authResult.walletAddress,
        email: null,
        wallet_address: authResult.walletAddress,
        aud: 'authenticated',
        role: 'authenticated'
      };
      
      // Create a mock session object for compatibility
      const mockSession = {
        access_token: authResult.jwtToken,
        token_type: 'bearer',
        expires_at: authResult.expiresAt,
        user: mockUser
      };

      console.log('✅ JWT-based authentication successful:', {
        hasUser: !!mockUser,
        hasSession: !!mockSession,
        walletAddress: authResult.walletAddress,
        expiresAt: authResult.expiresAt
      });

      return {
        success: true,
        user: mockUser,
        session: mockSession,
        jwtToken: authResult.jwtToken,
        walletAddress: authResult.walletAddress,
        authMethod: 'api_jwt_wallet_signature'
      };

    } catch (error) {
      console.error(`❌ API wallet authentication failed (attempt ${attempt}/${maxRetries}):`, error);
      
      // Handle specific error types
      if (error.message?.includes('User rejected') || error.message?.includes('denied')) {
        throw new Error('Wallet signature was rejected. Please approve the signature request to authenticate.');
      } else if (error.message?.includes('signMessage')) {
        throw new Error('Failed to get wallet signature. Please ensure your wallet supports message signing.');
      } else if (error.message?.includes('Invalid signature')) {
        throw new Error('Signature verification failed. Please try again.');
      }
      
      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }
      
      // For other errors, wait a bit before retrying
      console.log(`⏳ Waiting 2 seconds before retry (attempt ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Validate JWT token via server-side API
 * @param {string} jwtToken - The JWT token to validate
 * @returns {Promise<Object>} Validation result
 */
export async function validateTokenAPI(jwtToken) {
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'validate_token',
        jwtToken
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token validation failed: ${errorData.error || 'Server error'}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Token validation failed:', error);
    throw error;
  }
}

/**
 * Refresh JWT token via server-side API
 * @param {string} currentToken - The current JWT token
 * @returns {Promise<Object>} Refresh result with new token
 */
export async function refreshTokenAPI(currentToken) {
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'refresh_token',
        currentToken
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token refresh failed: ${errorData.error || 'Server error'}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    throw error;
  }
}

/**
 * Sign out from JWT-based authentication system and clear all storage
 * @returns {Promise<void>}
 */
export async function signOutFromSupabaseAPI() {
  try {
    console.log('🔐 Signing out from JWT-based authentication...');
    
    // Use comprehensive storage cleanup utility
    const clearedItems = clearAllAuthStorage(true);
    
    // Verify that all authentication data has been cleared
    const verification = verifyAuthStorageCleared();
    
    if (verification.isCleared) {
      console.log('✅ Signed out successfully - all authentication storage cleared');
      console.log(`📊 Cleanup summary: ${clearedItems.localStorage.length} localStorage items, ${clearedItems.sessionStorage.length} sessionStorage items`);
    } else {
      console.warn('⚠️ Sign out completed but some data may remain:', verification.remainingKeys);
    }
    
  } catch (error) {
    console.error('❌ Sign out failed:', error);
    throw error;
  }
}

/**
 * Get current JWT-based session from localStorage
 * @param {number} maxRetries - Maximum number of retry attempts (kept for compatibility)
 * @param {number} retryDelay - Delay between retries in milliseconds (kept for compatibility)
 * @returns {Promise<Object|null>} Current session or null
 */
export async function getCurrentSessionAPI(maxRetries = 3, retryDelay = 500) {
  try {
    const jwtToken = localStorage.getItem('ethshot_jwt_token');
    const walletAddress = localStorage.getItem('ethshot_wallet_address');
    const expiresAtStr = localStorage.getItem('ethshot_auth_expires_at');
    
    if (!jwtToken || !walletAddress) {
      return null;
    }
    
    // Check if token is expired
    if (expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr);
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (expiresAt && expiresAt < currentTime) {
        console.warn('⚠️ JWT token is expired, clearing stored auth data...');
        localStorage.removeItem('ethshot_jwt_token');
        localStorage.removeItem('ethshot_wallet_address');
        localStorage.removeItem('ethshot_auth_expires_at');
        return null;
      }
    }
    
    // Create mock user and session objects for compatibility
    const mockUser = {
      id: walletAddress,
      email: null,
      wallet_address: walletAddress,
      aud: 'authenticated',
      role: 'authenticated'
    };
    
    const mockSession = {
      access_token: jwtToken,
      token_type: 'bearer',
      expires_at: expiresAtStr ? parseInt(expiresAtStr) : null,
      user: mockUser
    };
    
    return mockSession;
    
  } catch (error) {
    console.error('❌ Failed to get JWT session from localStorage:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>} True if authenticated
 */
export async function isAuthenticatedAPI() {
  const session = await getCurrentSessionAPI();
  return !!session?.user;
}

/**
 * Check if user is authenticated for a specific wallet address
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<boolean>} True if authenticated for this wallet
 */
export async function isAuthenticatedForWalletAPI(walletAddress) {
  if (!walletAddress) return false;
  
  const session = await getCurrentSessionAPI();
  if (!session?.user) return false;
  
  // In JWT-based auth, the user ID is the wallet address
  const sessionWalletAddress = session.user.id?.toLowerCase();
  const normalizedWallet = walletAddress.toLowerCase();
  
  console.log('🔍 Checking API authentication for wallet:', {
    walletAddress: normalizedWallet,
    sessionWalletAddress,
    isMatch: sessionWalletAddress === normalizedWallet,
    hasSession: !!session,
    hasUser: !!session.user
  });
  
  return sessionWalletAddress === normalizedWallet;
}

/**
 * Get authentication status with detailed information
 * @returns {Promise<Object>} Authentication status details
 */
export async function getAuthStatusAPI() {
  try {
    const session = await getCurrentSessionAPI();
    
    const status = {
      isAuthenticated: !!session?.user,
      session: session,
      user: session?.user || null,
      walletAddress: session?.user?.id || null,
      expiresAt: session?.expires_at || null,
      accessToken: session?.access_token ? 'present' : 'missing',
      authMethod: 'api_jwt_wallet_signature'
    };
    
    console.log('🔍 Current API auth status:', status);
    return status;
  } catch (error) {
    console.error('❌ Failed to get API auth status:', error);
    return {
      isAuthenticated: false,
      session: null,
      user: null,
      walletAddress: null,
      expiresAt: null,
      accessToken: 'missing',
      authMethod: 'api_jwt_wallet_signature',
      error: error.message
    };
  }
}