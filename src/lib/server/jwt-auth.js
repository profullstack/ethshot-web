/**
 * Server-side JWT Authentication Module (DEPRECATED)
 *
 * This module is deprecated and redirects to the secure JWT auth module.
 * Use jwt-auth-secure.js directly for new code.
 *
 * SECURITY: This module no longer exposes JWT secrets.
 */

import {
  generateNonceSecure,
  createAuthMessageSecure,
  verifySignatureSecure,
  generateJWTSecure,
  verifyJWTSecure,
  getChecksumAddressSecure,
  isValidWalletAddressSecure,
  hasJWTSecret,
  extractWalletFromJWTSecure,
  isJWTExpiredSecure
} from './jwt-auth-secure.js';

console.warn('⚠️ DEPRECATED: jwt-auth.js is deprecated. Use jwt-auth-secure.js for server-side operations.');

// Re-export secure functions with original names for backward compatibility
export const generateNonce = generateNonceSecure;
export const createAuthMessage = createAuthMessageSecure;
export const verifySignature = verifySignatureSecure;
export const generateJWT = generateJWTSecure;
export const verifyJWT = verifyJWTSecure;
export const getChecksumAddress = getChecksumAddressSecure;
export const isValidWalletAddress = isValidWalletAddressSecure;

// Re-export client-safe functions (now from secure module)
export const extractWalletFromJWT = extractWalletFromJWTSecure;
export const isJWTExpired = isJWTExpiredSecure;

/**
 * Server-side JWT verification with proper error handling (DEPRECATED)
 * @param {string} token - The JWT token to verify
 * @returns {Promise<Object>} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export async function verifyJWTServer(token) {
  console.warn('⚠️ DEPRECATED: Use verifyJWTSecure from jwt-auth-secure.js instead');
  return verifyJWTSecure(token);
}

/**
 * Generate JWT token with server-side secret (DEPRECATED)
 * @param {string} walletAddress - The wallet address to authenticate
 * @param {string} expiresIn - Token expiration time (default: 7 days)
 * @returns {string} JWT token
 */
export function generateJWTServer(walletAddress, expiresIn = '7d') {
  console.warn('⚠️ DEPRECATED: Use generateJWTSecure from jwt-auth-secure.js instead');
  return generateJWTSecure(walletAddress, expiresIn);
}