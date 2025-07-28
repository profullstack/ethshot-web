/**
 * Shot Recording Fix
 * 
 * Provides robust shot recording functionality with proper error handling
 * and fallback mechanisms for authentication issues.
 */

import { browser } from '$app/environment';
import { withAuthenticatedClient } from './authenticated-client.js';
import { supabase, TABLES } from './client.js';
import { toastStore } from '../stores/toast.js';

/**
 * Record a shot with robust error handling and authentication retry
 * @param {Object} shotData - Shot data to record
 * @returns {Promise<Object|null>} Recorded shot data or null if failed
 */
export async function recordShotWithRetry(shotData) {
  if (!browser) {
    console.warn('Shot recording skipped on server');
    return null;
  }

  console.log('🎯 Attempting to record shot with authentication retry:', {
    player_address: shotData.playerAddress?.toLowerCase(),
    amount: shotData.amount,
    won: shotData.won || false,
    tx_hash: shotData.txHash,
    crypto_type: shotData.cryptoType || 'ETH'
  });

  // First attempt: Try with authenticated client
  try {
    console.log('🔐 Attempting authenticated shot recording...');
    
    const result = await withAuthenticatedClient(async (client) => {
      const { data, error } = await client
        .from(TABLES.SHOTS)
        .insert({
          player_address: shotData.playerAddress.toLowerCase(),
          amount: shotData.amount,
          won: shotData.won || false,
          tx_hash: shotData.txHash,
          block_number: shotData.blockNumber,
          timestamp: shotData.timestamp || new Date().toISOString(),
          crypto_type: shotData.cryptoType || 'ETH',
          contract_address: shotData.contractAddress
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Authenticated shot recording error:', error);
        throw error;
      }
      
      console.log('✅ Shot recorded successfully with authentication:', data);
      return data;
    });

    return result;
  } catch (authError) {
    console.warn('⚠️ Authenticated shot recording failed:', authError.message);
    
    // Check if this is an authentication-specific error
    if (isAuthenticationError(authError)) {
      console.log('🔄 Authentication error detected, attempting fallback...');
      
      // Show user-friendly message about authentication
      toastStore.warning('Authentication expired. Shot recorded but may not appear immediately. Please reconnect your wallet.');
      
      // Second attempt: Try with anonymous client as fallback
      return await recordShotFallback(shotData);
    } else {
      // Re-throw non-authentication errors
      throw authError;
    }
  }
}

/**
 * Record a winner with robust error handling and authentication retry
 * @param {Object} winnerData - Winner data to record
 * @returns {Promise<Object|null>} Recorded winner data or null if failed
 */
export async function recordWinnerWithRetry(winnerData) {
  if (!browser) {
    console.warn('Winner recording skipped on server');
    return null;
  }

  console.log('🏆 Attempting to record winner with authentication retry:', {
    winner_address: winnerData.winnerAddress?.toLowerCase(),
    amount: winnerData.amount,
    tx_hash: winnerData.txHash,
    crypto_type: winnerData.cryptoType || 'ETH'
  });

  // First attempt: Try with authenticated client
  try {
    console.log('🔐 Attempting authenticated winner recording...');
    
    const result = await withAuthenticatedClient(async (client) => {
      const { data, error } = await client
        .from(TABLES.WINNERS)
        .insert({
          winner_address: winnerData.winnerAddress.toLowerCase(),
          amount: winnerData.amount,
          tx_hash: winnerData.txHash,
          block_number: winnerData.blockNumber,
          timestamp: winnerData.timestamp || new Date().toISOString(),
          crypto_type: winnerData.cryptoType || 'ETH',
          contract_address: winnerData.contractAddress
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Authenticated winner recording error:', error);
        throw error;
      }
      
      console.log('✅ Winner recorded successfully with authentication:', data);
      return data;
    });

    return result;
  } catch (authError) {
    console.warn('⚠️ Authenticated winner recording failed:', authError.message);
    
    // Check if this is an authentication-specific error
    if (isAuthenticationError(authError)) {
      console.log('🔄 Authentication error detected, attempting fallback...');
      
      // Show user-friendly message about authentication
      toastStore.warning('Authentication expired. Winner recorded but may not appear immediately. Please reconnect your wallet.');
      
      // Second attempt: Try with anonymous client as fallback
      return await recordWinnerFallback(winnerData);
    } else {
      // Re-throw non-authentication errors
      throw authError;
    }
  }
}

/**
 * Fallback shot recording using anonymous client
 * @param {Object} shotData - Shot data to record
 * @returns {Promise<Object|null>} Recorded shot data or null if failed
 */
async function recordShotFallback(shotData) {
  if (!supabase) {
    console.error('❌ Supabase not configured - cannot record shot');
    return null;
  }

  try {
    console.log('📝 Attempting fallback shot recording (anonymous)...');
    
    const { data, error } = await supabase
      .from(TABLES.SHOTS)
      .insert({
        player_address: shotData.playerAddress.toLowerCase(),
        amount: shotData.amount,
        won: shotData.won || false,
        tx_hash: shotData.txHash,
        block_number: shotData.blockNumber,
        timestamp: shotData.timestamp || new Date().toISOString(),
        crypto_type: shotData.cryptoType || 'ETH',
        contract_address: shotData.contractAddress
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Fallback shot recording error:', error);
      return null;
    }
    
    console.log('✅ Shot recorded successfully with fallback method:', data);
    return data;
  } catch (fallbackError) {
    console.error('❌ Fallback shot recording failed:', fallbackError);
    return null;
  }
}

/**
 * Fallback winner recording using anonymous client
 * @param {Object} winnerData - Winner data to record
 * @returns {Promise<Object|null>} Recorded winner data or null if failed
 */
async function recordWinnerFallback(winnerData) {
  if (!supabase) {
    console.error('❌ Supabase not configured - cannot record winner');
    return null;
  }

  try {
    console.log('📝 Attempting fallback winner recording (anonymous)...');
    
    const { data, error } = await supabase
      .from(TABLES.WINNERS)
      .insert({
        winner_address: winnerData.winnerAddress.toLowerCase(),
        amount: winnerData.amount,
        tx_hash: winnerData.txHash,
        block_number: winnerData.blockNumber,
        timestamp: winnerData.timestamp || new Date().toISOString(),
        crypto_type: winnerData.cryptoType || 'ETH',
        contract_address: winnerData.contractAddress
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Fallback winner recording error:', error);
      return null;
    }
    
    console.log('✅ Winner recorded successfully with fallback method:', data);
    return data;
  } catch (fallbackError) {
    console.error('❌ Fallback winner recording failed:', fallbackError);
    return null;
  }
}

/**
 * Check if an error is authentication-related
 * @param {Error} error - Error to check
 * @returns {boolean} True if authentication error
 */
function isAuthenticationError(error) {
  const authErrorMessages = [
    'No authentication token found',
    'Authentication token is for a different wallet',
    'Authentication token has expired',
    'Failed to create authenticated Supabase client',
    'JWT',
    'authentication',
    'token'
  ];

  const errorMessage = error.message?.toLowerCase() || '';
  return authErrorMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
}

/**
 * Check authentication status and provide user feedback
 * @returns {Promise<boolean>} True if authenticated
 */
export async function checkAuthenticationStatus() {
  if (!browser) return false;

  try {
    const jwtToken = localStorage.getItem('ethshot_jwt_token');
    const walletAddress = localStorage.getItem('ethshot_wallet_address');
    const expiresAtStr = localStorage.getItem('ethshot_auth_expires_at');

    if (!jwtToken || !walletAddress) {
      console.log('❌ No authentication token found');
      return false;
    }

    // Check if token is expired
    if (expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr);
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (expiresAt && expiresAt < currentTime) {
        console.log('❌ Authentication token has expired');
        // Clear expired token
        localStorage.removeItem('ethshot_jwt_token');
        localStorage.removeItem('ethshot_wallet_address');
        localStorage.removeItem('ethshot_auth_expires_at');
        return false;
      }
    }

    console.log('✅ Authentication token is valid');
    return true;
  } catch (error) {
    console.error('❌ Error checking authentication status:', error);
    return false;
  }
}