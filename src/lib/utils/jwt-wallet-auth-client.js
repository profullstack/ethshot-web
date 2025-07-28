/**
 * Client-Safe JWT Wallet Authentication Utilities
 *
 * Provides wallet authentication utilities that are safe to use on the client-side.
 * This module does NOT contain JWT secret operations - those are server-side only.
 *
 * SECURITY: This module is safe for client-side use as it does not expose JWT secrets.
 * BROWSER-SAFE: No Node.js-specific dependencies that cause browser errors.
 */

import { ethers } from 'ethers';

/**
 * Generate a unique nonce for wallet signature verification (client-side)
 * Uses Web Crypto API for secure random generation
 * @returns {string} A unique nonce string with timestamp
 */
export function generateNonce() {
  const timestamp = Date.now();
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const randomHex = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  
  return `Sign in to ETH Shot - ${timestamp} - ${randomHex}`;
}

/**
 * Create authentication message for wallet signing
 * @param {string} walletAddress - The wallet address
 * @param {string} nonce - The unique nonce
 * @returns {string} Formatted message for signing
 */
export function createAuthMessage(walletAddress, nonce) {
  const normalizedAddress = walletAddress.toLowerCase();
  return `${nonce}\n\nWallet: ${normalizedAddress}`;
}

/**
 * Verify wallet signature against message and expected signer
 * @param {string} message - The original message that was signed
 * @param {string} signature - The signature from the wallet
 * @param {string} expectedSigner - The expected wallet address
 * @returns {Promise<boolean>} True if signature is valid
 */
export async function verifySignature(message, signature, expectedSigner) {
  try {
    // Recover the address from the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    // Compare addresses (case-insensitive)
    const normalizedRecovered = recoveredAddress.toLowerCase();
    const normalizedExpected = expectedSigner.toLowerCase();
    
    return normalizedRecovered === normalizedExpected;
  } catch (error) {
    console.error('❌ Signature verification failed:', error);
    return false;
  }
}

/**
 * Extract wallet address from JWT token without verification (MOVED TO SERVER-SIDE)
 * This function has been moved to server-side for security.
 * Use the /api/auth endpoint with action 'decode_token' instead.
 * @param {string} token - The JWT token
 * @returns {string|null} Always returns null - use server-side API instead
 * @deprecated Use server-side API endpoint instead
 */
export function extractWalletFromJWT(token) {
  console.warn('⚠️ DEPRECATED: extractWalletFromJWT moved to server-side. Use /api/auth with action "decode_token" instead.');
  return null;
}

/**
 * Check if JWT token is expired (MOVED TO SERVER-SIDE)
 * This function has been moved to server-side for security.
 * Use the /api/auth endpoint with action 'validate_token' instead.
 * @param {string} token - The JWT token
 * @returns {boolean} Always returns true - use server-side API instead
 * @deprecated Use server-side API endpoint instead
 */
export function isJWTExpired(token) {
  console.warn('⚠️ DEPRECATED: isJWTExpired moved to server-side. Use /api/auth with action "validate_token" instead.');
  return true;
}

/**
 * Generate checksummed wallet address
 * @param {string} address - The wallet address
 * @returns {string} Checksummed address
 */
export function getChecksumAddress(address) {
  try {
    // ethers.getAddress handles case normalization automatically
    return ethers.getAddress(address.toLowerCase());
  } catch (error) {
    console.error('❌ Invalid wallet address:', address);
    throw new Error(`Invalid wallet address: ${address}`);
  }
}

/**
 * Validate wallet address format
 * @param {string} address - The wallet address to validate
 * @returns {boolean} True if address is valid
 */
export function isValidWalletAddress(address) {
  try {
    ethers.getAddress(address);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Client-side authentication helper that calls server API
 * @param {string} walletAddress - The wallet address
 * @returns {Promise<Object>} Nonce and message for signing
 */
export async function requestAuthNonce(walletAddress) {
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generate_nonce',
        walletAddress
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to generate nonce');
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to request auth nonce:', error);
    throw new Error(`Nonce request failed: ${error.message}`);
  }
}

/**
 * Client-side signature verification that calls server API
 * @param {string} walletAddress - The wallet address
 * @param {string} signature - The wallet signature
 * @returns {Promise<Object>} JWT token and authentication result
 */
export async function submitSignatureForAuth(walletAddress, signature) {
  try {
    const response = await fetch('/api/auth', {
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

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Authentication failed');
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to submit signature for auth:', error);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

/**
 * Client-side token validation that calls server API
 * @param {string} jwtToken - The JWT token to validate
 * @returns {Promise<Object>} Validation result
 */
export async function validateTokenViaAPI(jwtToken) {
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

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Token validation failed');
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to validate token via API:', error);
    throw new Error(`Token validation failed: ${error.message}`);
  }
}

/**
 * Client-side token refresh that calls server API
 * @param {string} currentToken - The current JWT token
 * @returns {Promise<Object>} New JWT token
 */
export async function refreshTokenViaAPI(currentToken) {
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

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Token refresh failed');
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to refresh token via API:', error);
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}