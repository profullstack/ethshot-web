/**
 * Wallet Authentication Service
 * 
 * Server-side service for handling wallet-based authentication with JWT tokens.
 * This service manages nonce generation, signature verification, and JWT token creation.
 */

import { supabaseServer, isSupabaseServerAvailable } from '../database/server-client.js';
import {
  generateNonceSecure,
  createAuthMessageSecure,
  verifySignatureSecure,
  generateJWTSecure,
  verifyJWTSecure,
  getChecksumAddressSecure,
  isValidWalletAddressSecure,
  hasJWTSecret,
  validateServerConfig,
  createConfigurationError
} from '../server/jwt-auth-secure.js';

/**
 * Generate and store a nonce for wallet authentication
 * @param {string} walletAddress - The wallet address requesting authentication
 * @returns {Promise<Object>} Object containing nonce and message to sign
 */
export async function generateAuthNonce(walletAddress) {
  try {
    // Validate server configuration
    if (!isSupabaseServerAvailable()) {
      console.error('❌ Server-side Supabase not configured for nonce generation');
      return createConfigurationError();
    }

    // Validate server configuration for JWT operations
    validateServerConfig('Nonce generation');

    // Validate wallet address format
    if (!isValidWalletAddressSecure(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    // Normalize wallet address to lowercase for database consistency
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Generate unique nonce
    const nonce = generateNonceSecure();
    
    // Create the message to be signed
    const message = createAuthMessageSecure(normalizedAddress, nonce);
    
    // Store nonce in database (upsert to handle existing users)
    const { error: dbError } = await supabaseServer
      .from('users')
      .upsert({
        wallet_address: normalizedAddress,
        nonce: nonce,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'wallet_address'
      });

    if (dbError) {
      console.error('❌ Failed to store nonce:', dbError);
      throw new Error('Failed to generate authentication nonce');
    }

    console.log('✅ Generated nonce for wallet:', normalizedAddress);
    
    return {
      success: true,
      nonce,
      message,
      walletAddress: normalizedAddress
    };
    
  } catch (error) {
    console.error('❌ Generate nonce failed:', error);
    throw new Error(`Nonce generation failed: ${error.message}`);
  }
}

/**
 * Verify wallet signature and generate JWT token
 * @param {string} walletAddress - The wallet address
 * @param {string} signature - The signature from the wallet
 * @returns {Promise<Object>} Object containing JWT token and user info
 */
export async function verifyAndAuthenticate(walletAddress, signature) {
  try {
    // Validate server configuration
    if (!isSupabaseServerAvailable()) {
      console.error('❌ Server-side Supabase not configured for authentication');
      return createConfigurationError();
    }

    // Validate server configuration for JWT operations
    validateServerConfig('Signature verification and authentication');

    // Validate inputs
    if (!walletAddress || !signature) {
      throw new Error('Wallet address and signature are required');
    }

    if (!isValidWalletAddressSecure(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    // Normalize wallet address to lowercase for database consistency
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Get stored nonce from database
    const { data: userData, error: fetchError } = await supabaseServer
      .from('users')
      .select('nonce')
      .eq('wallet_address', normalizedAddress)
      .single();

    if (fetchError || !userData) {
      console.error('❌ Failed to fetch user nonce:', fetchError);
      throw new Error('No authentication nonce found. Please request a new nonce first.');
    }

    // Create the message that should have been signed
    const message = createAuthMessageSecure(normalizedAddress, userData.nonce);
    
    // Verify the signature
    const isValidSignature = await verifySignatureSecure(message, signature, normalizedAddress);
    
    if (!isValidSignature) {
      throw new Error('Invalid signature. Authentication failed.');
    }

    // Generate JWT token
    const jwtToken = generateJWTSecure(normalizedAddress);
    
    // Update user record with successful authentication
    const { error: updateError } = await supabaseServer
      .from('users')
      .update({
        updated_at: new Date().toISOString(),
        metadata: {
          last_auth: new Date().toISOString(),
          auth_method: 'wallet_signature'
        }
      })
      .eq('wallet_address', normalizedAddress);

    if (updateError) {
      console.warn('⚠️ Failed to update user record:', updateError);
      // Don't fail authentication if we can't update the record
    }

    console.log('✅ Wallet authentication successful:', normalizedAddress);
    
    return {
      success: true,
      jwtToken,
      walletAddress: normalizedAddress,
      message: 'Authentication successful'
    };
    
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

/**
 * Validate JWT token and get user info
 * @param {string} jwtToken - The JWT token to validate
 * @returns {Promise<Object>} Object containing user info
 */
export async function validateAuthToken(jwtToken) {
  try {
    // Validate server configuration for JWT operations
    validateServerConfig('JWT token validation');

    if (!jwtToken) {
      throw new Error('JWT token is required');
    }

    // Verify JWT token
    const payload = verifyJWTSecure(jwtToken);
    
    // Get user info from database if server is available
    if (isSupabaseServerAvailable()) {
      const { data: userData, error: fetchError } = await supabaseServer
        .from('users')
        .select('wallet_address, created_at, updated_at, metadata')
        .eq('wallet_address', payload.walletAddress || payload.wallet_address)
        .single();

      if (fetchError || !userData) {
        throw new Error('User not found');
      }

      return {
        success: true,
        user: {
          walletAddress: userData.wallet_address,
          createdAt: userData.created_at,
          updatedAt: userData.updated_at,
          metadata: userData.metadata || {}
        },
        tokenPayload: payload
      };
    } else {
      // If database is not available, just return token payload
      return {
        success: true,
        user: {
          walletAddress: payload.walletAddress || payload.wallet_address,
          createdAt: null,
          updatedAt: null,
          metadata: {}
        },
        tokenPayload: payload
      };
    }
    
  } catch (error) {
    console.error('❌ Token validation failed:', error);
    throw new Error(`Token validation failed: ${error.message}`);
  }
}

/**
 * Refresh JWT token for authenticated user
 * @param {string} currentToken - The current JWT token
 * @returns {Promise<Object>} Object containing new JWT token
 */
export async function refreshAuthToken(currentToken) {
  try {
    // Validate server configuration for JWT operations
    validateServerConfig('JWT token refresh');

    // Validate current token
    const validation = await validateAuthToken(currentToken);
    
    if (!validation.success) {
      throw new Error('Current token is invalid');
    }

    // Generate new JWT token
    const newJwtToken = generateJWTSecure(validation.user.walletAddress);
    
    console.log('✅ Token refreshed for wallet:', validation.user.walletAddress);
    
    return {
      success: true,
      jwtToken: newJwtToken,
      walletAddress: validation.user.walletAddress,
      message: 'Token refreshed successfully'
    };
    
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}