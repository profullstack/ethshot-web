/**
 * Server-side JWT Authentication Utilities
 * 
 * This module handles JWT operations securely on the server-side only.
 * It safely accesses environment variables and performs cryptographic operations
 * that should never be exposed to the client.
 */

import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import crypto from 'crypto';
import { SERVER_CONFIG, validateServerConfig } from '../config-server.js';

// Server-side environment variable access
const SUPABASE_JWT_SECRET = SERVER_CONFIG.SUPABASE_JWT_SECRET;

/**
 * Generate a cryptographically secure nonce for wallet signature verification
 * @returns {string} A unique nonce string with timestamp
 */
export function generateNonce() {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(16);
  const randomHex = randomBytes.toString('hex');
  
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
 * Generate JWT token for Supabase authentication
 * @param {string} walletAddress - The wallet address to authenticate
 * @param {string} expiresIn - Token expiration time (default: 7 days)
 * @returns {string} JWT token
 */
export function generateJWT(walletAddress, expiresIn = '7d') {
  validateServerConfig('JWT generation');

  const normalizedAddress = walletAddress.toLowerCase();
  
  const payload = {
    sub: normalizedAddress, // Use wallet address as unique user identifier
    aud: 'authenticated',
    wallet_address: normalizedAddress, // Add this for compatibility
    walletAddress: normalizedAddress,
    role: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, SUPABASE_JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256'
  });
}

/**
 * Verify and decode JWT token
 * @param {string} token - The JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export function verifyJWT(token) {
  validateServerConfig('JWT verification');

  try {
    return jwt.verify(token, SUPABASE_JWT_SECRET, {
      algorithms: ['HS256'],
      audience: 'authenticated'
    });
  } catch (error) {
    console.error('❌ JWT verification failed:', error);
    throw new Error(`Invalid JWT token: ${error.message}`);
  }
}

/**
 * Extract wallet address from JWT token without verification
 * Useful for quick checks when you don't need full verification
 * @param {string} token - The JWT token
 * @returns {string|null} Wallet address or null if invalid
 */
export function extractWalletFromJWT(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded?.walletAddress || decoded?.sub || null;
  } catch (error) {
    console.error('❌ Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Check if JWT token is expired
 * @param {string} token - The JWT token
 * @returns {boolean} True if token is expired
 */
export function isJWTExpired(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded?.exp) return true;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp <= currentTime; // Use <= to handle edge cases
  } catch (error) {
    console.error('❌ Failed to check JWT expiration:', error);
    return true;
  }
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