/**
 * Secure Server-side JWT Authentication Module with ES256
 *
 * This module handles JWT operations using ES256 algorithm with our own private key.
 * It ensures the JWT private key is never exposed to client-side code.
 * 
 * SECURITY: This module should ONLY be used on the server-side.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createPrivateKey, createPublicKey } from 'crypto';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load JWT signing secret (HS256) - compatible with Supabase
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.VITE_SUPABASE_JWT_SECRET;

if (!SUPABASE_JWT_SECRET) {
  console.warn('⚠️ SUPABASE_JWT_SECRET not found in environment variables');
}

// Load ES256 JWK keys for JWT operations - REQUIRED
let privateKey = null;
let publicKey = null;

// Load JWK keys and convert to KeyObject format for jsonwebtoken library
try {
  // Load private key for signing
  const privateKeyPath = join(__dirname, '../../../jwk-private-key.json');
  const privateKeyData = JSON.parse(readFileSync(privateKeyPath, 'utf8'));
  
  // Load public key for verification
  const publicKeyPath = join(__dirname, '../../../jwt.json');
  const publicKeyData = JSON.parse(readFileSync(publicKeyPath, 'utf8'));
  
  // Convert JWK to KeyObject format for jsonwebtoken library
  privateKey = createPrivateKey({ key: privateKeyData, format: 'jwk' });
  publicKey = createPublicKey({ key: publicKeyData, format: 'jwk' });
  
  console.log('✅ ES256 JWK keys loaded and converted to KeyObject format successfully');
  console.log('🔑 Private key type:', privateKey.asymmetricKeyType);
  console.log('🔑 Public key type:', publicKey.asymmetricKeyType);
} catch (error) {
  console.error('❌ CRITICAL: Failed to load ES256 JWK keys:', error.message);
  console.error('❌ ES256 keys are REQUIRED for JWT authentication');
  throw new Error(`ES256 key loading failed: ${error.message}`);
}

// Server configuration validation
const SERVER_CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
};

/**
 * Create a configuration error response for API endpoints
 * @returns {Object} Error response object
 */
export function createConfigurationError() {
  const missingVars = [];
  if (!SERVER_CONFIG.SUPABASE_URL) missingVars.push('SUPABASE_URL');
  if (!SERVER_CONFIG.SUPABASE_ANON_KEY) missingVars.push('SUPABASE_ANON_KEY');
  if (!SERVER_CONFIG.SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');

  return {
    success: false,
    error: 'Server configuration incomplete',
    message: `Missing required environment variables: ${missingVars.join(', ')}`,
    details: {
      missingVariables: missingVars,
      help: 'Please ensure all required environment variables are set in your .env file or deployment environment'
    }
  };
}

/**
 * Validate server configuration and throw error if incomplete
 * @param {string} context - Context where validation is being performed
 * @throws {Error} If configuration is incomplete
 */
export function validateServerConfig(context = 'Server operation') {
  const missingVars = [];
  if (!SERVER_CONFIG.SUPABASE_URL) missingVars.push('SUPABASE_URL');
  if (!SERVER_CONFIG.SUPABASE_ANON_KEY) missingVars.push('SUPABASE_ANON_KEY');
  if (!SERVER_CONFIG.SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missingVars.length > 0) {
    const error = new Error(
      `${context} failed: Missing required environment variables: ${missingVars.join(', ')}`
    );
    error.code = 'SERVER_CONFIG_INCOMPLETE';
    error.missingVariables = missingVars;
    throw error;
  }
}

/**
 * Generate a unique nonce for wallet signature verification (server-side only)
 * @returns {string} A unique nonce string with timestamp
 */
export function generateNonceSecure() {
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
export function createAuthMessageSecure(walletAddress, nonce) {
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
export async function verifySignatureSecure(message, signature, expectedSigner) {
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
 * Generate JWT token using ES256 algorithm with JWK private key (server-side only)
 * @param {string} walletAddress - The wallet address to authenticate
 * @param {Object} additionalPayload - Additional data to include in the JWT payload
 * @returns {string} JWT token
 * @throws {Error} If private key is not available
 */
export function generateJWTSecure(walletAddress, additionalPayload = {}) {
  if (!privateKey) {
    throw new Error('ES256 private key is required for JWT generation - key loading failed');
  }

  if (!walletAddress) {
    throw new Error('Wallet address is required for JWT generation');
  }

  const normalizedAddress = walletAddress.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  
  // Create a Supabase-compatible JWT payload
  const payload = {
    aud: 'authenticated',
    exp: now + (24 * 60 * 60), // 24 hours
    iat: now,
    iss: 'supabase',
    sub: normalizedAddress, // Use wallet address as unique user identifier
    email: '', // Required by Supabase but can be empty for wallet auth
    phone: '',
    app_metadata: {
      provider: 'wallet',
      providers: ['wallet']
    },
    user_metadata: {
      wallet_address: normalizedAddress,
      auth_method: 'wallet_signature'
    },
    role: 'authenticated',
    aal: 'aal1',
    amr: [{ method: 'wallet', timestamp: now }],
    session_id: crypto.randomUUID(),
    // Custom fields for our app
    walletAddress: normalizedAddress,
    wallet_address: normalizedAddress,
    ...additionalPayload
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'ES256'
  });
}

/**
 * Fallback JWT generation using HS256 algorithm
 * @param {string} walletAddress - The wallet address to authenticate
 * @param {Object} additionalPayload - Additional data to include in the JWT payload
 * @returns {string} JWT token
 */
function generateJWTWithHS256(walletAddress, additionalPayload = {}) {
  const normalizedAddress = walletAddress.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    aud: 'authenticated',
    exp: now + (24 * 60 * 60), // 24 hours
    iat: now,
    iss: 'supabase',
    sub: normalizedAddress,
    email: '',
    phone: '',
    app_metadata: {
      provider: 'wallet',
      providers: ['wallet']
    },
    user_metadata: {
      wallet_address: normalizedAddress,
      auth_method: 'wallet_signature'
    },
    role: 'authenticated',
    aal: 'aal1',
    amr: [{ method: 'wallet', timestamp: now }],
    session_id: crypto.randomUUID(),
    walletAddress: normalizedAddress,
    wallet_address: normalizedAddress,
    ...additionalPayload
  };

  return jwt.sign(payload, SUPABASE_JWT_SECRET, {
    algorithm: 'HS256'
  });
}

/**
 * Verify and decode JWT token using ES256 algorithm with JWK public key (server-side only)
 * @param {string} token - The JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired or public key is not available
 */
export function verifyJWTSecure(token) {
  if (!publicKey) {
    throw new Error('ES256 public key is required for JWT verification - key loading failed');
  }

  if (!token) {
    throw new Error('Token is required for verification');
  }

  try {
    return jwt.verify(token, publicKey, {
      algorithms: ['ES256'],
      audience: 'authenticated'
    });
  } catch (error) {
    console.error('❌ JWT verification failed:', error);
    throw new Error(`Invalid JWT token: ${error.message}`);
  }
}

/**
 * Fallback JWT verification using HS256 algorithm
 * @param {string} token - The JWT token to verify
 * @returns {Object} Decoded token payload
 */
function verifyJWTWithHS256(token) {
  try {
    return jwt.verify(token, SUPABASE_JWT_SECRET, {
      algorithms: ['HS256'],
      audience: 'authenticated'
    });
  } catch (error) {
    console.error('❌ JWT verification failed (HS256):', error);
    throw new Error(`Invalid JWT token: ${error.message}`);
  }
}

/**
 * Generate checksummed wallet address
 * @param {string} address - The wallet address
 * @returns {string} Checksummed address
 */
export function getChecksumAddressSecure(address) {
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
export function isValidWalletAddressSecure(address) {
  try {
    ethers.getAddress(address);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if the server has valid JWT secret configured
 * @returns {boolean} True if JWT secret is available
 */
export function hasJWTSecret() {
  return !!SUPABASE_JWT_SECRET;
}

/**
 * Extract wallet address from JWT token without verification (server-side)
 * Useful for quick checks when you don't need full verification
 * @param {string} token - The JWT token
 * @returns {string|null} Wallet address or null if invalid
 */
export function extractWalletFromJWTSecure(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded?.walletAddress || decoded?.sub || null;
  } catch (error) {
    console.error('❌ Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Check if JWT token is expired (without verification) (server-side)
 * @param {string} token - The JWT token
 * @returns {boolean} True if token is expired
 */
export function isJWTExpiredSecure(token) {
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