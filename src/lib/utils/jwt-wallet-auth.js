/**
 * JWT-based Wallet Authentication Utilities (DEPRECATED - CLIENT UNSAFE)
 *
 * This module is deprecated due to security concerns.
 * Use jwt-wallet-auth-client.js for client-safe operations.
 * Use jwt-auth-secure.js for server-side operations.
 *
 * SECURITY WARNING: This module previously exposed JWT secrets to client code.
 */

import { ethers } from 'ethers';

console.warn('⚠️ DEPRECATED: jwt-wallet-auth.js is deprecated due to security concerns. Use jwt-wallet-auth-client.js for client operations or jwt-auth-secure.js for server operations.');

// JWT secret access is now REMOVED for security
// These functions will throw errors if called
function getJWTSecret() {
  throw new Error('SECURITY ERROR: JWT secret access is not allowed. Use server-side jwt-auth-secure.js module.');
}

export function setJWTSecret(secret) {
  throw new Error('SECURITY ERROR: JWT secret setting is not allowed. Use server-side jwt-auth-secure.js module.');
}

/**
 * Generate a unique nonce for wallet signature verification
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
 * Generate JWT token for Supabase authentication (DEPRECATED - SECURITY RISK)
 * @param {string} walletAddress - The wallet address to authenticate
 * @param {string} expiresIn - Token expiration time (default: 7 days)
 * @returns {string} JWT token
 * @throws {Error} Always throws - use server-side jwt-auth-secure.js instead
 */
export function generateJWT(walletAddress, expiresIn = '7d') {
  throw new Error('SECURITY ERROR: JWT generation is not allowed in client code. Use server-side API endpoints.');
}

/**
 * Verify and decode JWT token (DEPRECATED - SECURITY RISK)
 * @param {string} token - The JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} Always throws - use server-side jwt-auth-secure.js instead
 */
export function verifyJWT(token) {
  throw new Error('SECURITY ERROR: JWT verification is not allowed in client code. Use server-side API endpoints.');
}

/**
 * Extract wallet address from JWT token without verification (DEPRECATED - SECURITY RISK)
 * @param {string} token - The JWT token
 * @returns {string|null} Wallet address or null if invalid
 * @throws {Error} Always throws - use server-side jwt-auth-secure.js instead
 */
export function extractWalletFromJWT(token) {
  throw new Error('SECURITY ERROR: JWT decoding is not allowed in client code. Use server-side API endpoints.');
}

/**
 * Check if JWT token is expired (DEPRECATED - SECURITY RISK)
 * @param {string} token - The JWT token
 * @returns {boolean} True if token is expired
 * @throws {Error} Always throws - use server-side jwt-auth-secure.js instead
 */
export function isJWTExpired(token) {
  throw new Error('SECURITY ERROR: JWT operations are not allowed in client code. Use server-side API endpoints.');
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