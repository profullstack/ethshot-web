/**
 * Authenticated Database Client
 * 
 * Provides database operations using JWT authentication instead of anonymous access.
 * This ensures all database operations are properly authenticated and authorized.
 */

import { createClient } from '@supabase/supabase-js';
import { get } from 'svelte/store';
import { walletAddress } from '../stores/wallet.js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/**
 * Get JWT token for authenticated requests from localStorage
 * @returns {Promise<string>} JWT token
 * @throws {Error} If no valid token is found
 */
async function getAuthToken() {
  // Get JWT token from localStorage (set by server-side authentication)
  const jwtToken = localStorage.getItem('ethshot_jwt_token');
  const storedWalletAddress = localStorage.getItem('ethshot_wallet_address');
  const expiresAtStr = localStorage.getItem('ethshot_auth_expires_at');

  if (!jwtToken || !storedWalletAddress) {
    throw new Error('No authentication token found. Please connect and authenticate your wallet first.');
  }

  // Check if token is expired
  if (expiresAtStr) {
    const expiresAt = parseInt(expiresAtStr);
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (expiresAt && expiresAt < currentTime) {
      // Clear expired token
      localStorage.removeItem('ethshot_jwt_token');
      localStorage.removeItem('ethshot_wallet_address');
      localStorage.removeItem('ethshot_auth_expires_at');
      throw new Error('Authentication token has expired. Please sign in again.');
    }
  }

  // Optional: Verify the stored wallet matches the current wallet from store
  // But don't fail if store is not available - localStorage is the source of truth
  try {
    const currentWalletAddress = get(walletAddress);
    if (currentWalletAddress && storedWalletAddress.toLowerCase() !== currentWalletAddress.toLowerCase()) {
      console.warn('⚠️ Wallet address mismatch between localStorage and store. Using localStorage as source of truth.');
    }
  } catch (error) {
    // Store might not be available, that's okay - localStorage is sufficient
    console.log('📝 Wallet store not available, using localStorage authentication only');
  }

  return jwtToken;
}

/**
 * Create an authenticated Supabase client using JWT token
 * @returns {Promise<Object>} Authenticated Supabase client
 */
export async function createAuthenticatedClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
  }

  try {
    const jwtToken = await getAuthToken();
    
    // Create client with JWT token
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // We manage JWT manually
        autoRefreshToken: false, // We manage JWT manually
      },
      realtime: {
        enabled: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${jwtToken}`
        }
      }
    });

    console.log('🔐 Created authenticated Supabase client with JWT token');
    return client;
  } catch (error) {
    console.error('❌ Failed to create authenticated Supabase client:', error);
    throw error;
  }
}

/**
 * Execute a database operation with authentication
 * @param {Function} operation - Database operation function that receives the authenticated client
 * @returns {Promise<any>} Operation result
 */
export async function withAuthenticatedClient(operation) {
  try {
    const client = await createAuthenticatedClient();
    return await operation(client);
  } catch (error) {
    console.error('❌ Authenticated database operation failed:', error);
    throw error;
  }
}