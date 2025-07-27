/**
 * New JWT-based Wallet Authentication
 * 
 * This replaces the problematic email/password approach with a secure JWT-based system
 * that avoids Supabase rate limiting issues.
 */

import { supabase } from '../database/client.js';
import {
  generateAuthNonce,
  verifyAndAuthenticate,
  validateAuthToken,
  refreshAuthToken
} from '../services/wallet-auth-service.js';

// Global authentication state
let authenticationInProgress = false;
let pendingAuthPromise = null;

/**
 * Authenticate user with wallet signature and JWT tokens
 * @param {string} walletAddress - The connected wallet address
 * @param {Object} signer - The ethers signer object
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Object>} Authentication result with JWT token
 */
export async function authenticateWithWalletJWT(walletAddress, signer, maxRetries = 3) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  if (!walletAddress) {
    throw new Error('Wallet address is required');
  }

  if (!signer) {
    throw new Error('Wallet signer is required for authentication');
  }

  // Check if authentication is already in progress
  if (authenticationInProgress) {
    console.log('🔄 Authentication already in progress, waiting for completion...');
    if (pendingAuthPromise) {
      try {
        const result = await pendingAuthPromise;
        console.log('✅ Using result from concurrent authentication');
        return result;
      } catch (error) {
        console.log('❌ Concurrent authentication failed, proceeding with new attempt');
        // Continue with new authentication attempt
      }
    }
  }

  // Set authentication lock
  authenticationInProgress = true;

  // Create the authentication promise
  pendingAuthPromise = (async () => {
    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔐 Starting JWT-based authentication (attempt ${attempt}/${maxRetries}):`, walletAddress);

          // Step 1: Generate nonce
          console.log('📝 Generating authentication nonce...');
          const nonceResult = await generateAuthNonce(walletAddress);
          
          if (!nonceResult.success) {
            throw new Error('Failed to generate authentication nonce');
          }

          console.log('✅ Nonce generated, requesting wallet signature...');
          
          // Step 2: Request signature from wallet
          const signature = await signer.signMessage(nonceResult.message);
          console.log('✅ Signature received from wallet');

          // Step 3: Verify signature and get JWT token
          console.log('🔍 Verifying signature and generating JWT token...');
          const authResult = await verifyAndAuthenticate(walletAddress, signature);
          
          if (!authResult.success) {
            throw new Error('Authentication verification failed');
          }

          console.log('✅ JWT token generated successfully');

          // Step 4: Sign in to Supabase with custom JWT token
          console.log('🔐 Signing in to Supabase with custom JWT token...');
          const { data: supabaseAuth, error: supabaseError } = await supabase.auth.signInWithCustomToken({
            token: authResult.jwtToken
          });

          if (supabaseError) {
            console.error('❌ Supabase custom token sign-in failed:', supabaseError);
            throw new Error(`Supabase authentication failed: ${supabaseError.message}`);
          }

          if (!supabaseAuth.user || !supabaseAuth.session) {
            throw new Error('Supabase authentication succeeded but no user/session returned');
          }

          console.log('✅ Supabase authentication successful:', {
            hasUser: !!supabaseAuth.user,
            hasSession: !!supabaseAuth.session,
            userEmail: supabaseAuth.user?.email,
            expiresAt: supabaseAuth.session?.expires_at
          });

          return {
            success: true,
            user: supabaseAuth.user,
            session: supabaseAuth.session,
            jwtToken: authResult.jwtToken,
            walletAddress: authResult.walletAddress,
            authMethod: 'jwt_wallet_signature'
          };

        } catch (error) {
          console.error(`❌ JWT wallet authentication failed (attempt ${attempt}/${maxRetries}):`, error);
          
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
    } finally {
      // Clear the authentication lock and pending promise
      authenticationInProgress = false;
      pendingAuthPromise = null;
    }
  })();

  // Return the pending promise
  return pendingAuthPromise;
}

/**
 * Sign out from Supabase (JWT-based)
 * @returns {Promise<void>}
 */
export async function signOutFromSupabaseJWT() {
  if (!supabase) {
    return;
  }

  try {
    console.log('🔐 Signing out from Supabase (JWT-based)');
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('❌ Sign out error:', error);
      throw error;
    }
    
    console.log('✅ Signed out successfully');
  } catch (error) {
    console.error('❌ Sign out failed:', error);
    throw error;
  }
}

/**
 * Get current Supabase session with JWT validation
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} retryDelay - Delay between retries in milliseconds
 * @returns {Promise<Object|null>} Current session or null
 */
export async function getCurrentSessionJWT(maxRetries = 3, retryDelay = 500) {
  if (!supabase) {
    return null;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error(`❌ Failed to get session (attempt ${attempt}/${maxRetries}):`, error);
        if (attempt === maxRetries) return null;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      // If we have a session, validate it
      if (session) {
        const currentTime = Math.floor(Date.now() / 1000);
        const isExpired = session.expires_at && session.expires_at < currentTime;
        
        if (isExpired) {
          console.warn('⚠️ Session is expired, attempting refresh...');
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.error('❌ Failed to refresh session:', refreshError);
              if (attempt === maxRetries) return null;
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              continue;
            }
            return refreshData.session;
          } catch (refreshErr) {
            console.error('❌ Session refresh failed:', refreshErr);
            if (attempt === maxRetries) return null;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
        
        return session;
      }
      
      // No session found, retry if not last attempt
      if (attempt < maxRetries) {
        console.log(`🔄 No session found, retrying in ${retryDelay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
      
    } catch (error) {
      console.error(`❌ Failed to get session (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) return null;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  return null;
}

/**
 * Check if user is authenticated with JWT-based system
 * @returns {Promise<boolean>} True if authenticated
 */
export async function isAuthenticatedJWT() {
  const session = await getCurrentSessionJWT();
  return !!session?.user;
}

/**
 * Check if user is authenticated for a specific wallet address
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<boolean>} True if authenticated for this wallet
 */
export async function isAuthenticatedForWalletJWT(walletAddress) {
  if (!walletAddress) return false;
  
  const session = await getCurrentSessionJWT();
  if (!session?.user) return false;
  
  // In JWT-based auth, the user ID is the wallet address
  const sessionWalletAddress = session.user.id?.toLowerCase();
  const normalizedWallet = walletAddress.toLowerCase();
  
  console.log('🔍 Checking JWT authentication for wallet:', {
    walletAddress: normalizedWallet,
    sessionWalletAddress,
    isMatch: sessionWalletAddress === normalizedWallet,
    hasSession: !!session,
    hasUser: !!session.user
  });
  
  return sessionWalletAddress === normalizedWallet;
}

/**
 * Get authentication status with detailed information (JWT-based)
 * @returns {Promise<Object>} Authentication status details
 */
export async function getAuthStatusJWT() {
  try {
    const session = await getCurrentSessionJWT();
    
    const status = {
      isAuthenticated: !!session?.user,
      session: session,
      user: session?.user || null,
      walletAddress: session?.user?.id || null,
      expiresAt: session?.expires_at || null,
      accessToken: session?.access_token ? 'present' : 'missing',
      authMethod: 'jwt_wallet_signature'
    };
    
    console.log('🔍 Current JWT auth status:', status);
    return status;
  } catch (error) {
    console.error('❌ Failed to get JWT auth status:', error);
    return {
      isAuthenticated: false,
      session: null,
      user: null,
      walletAddress: null,
      expiresAt: null,
      accessToken: 'missing',
      authMethod: 'jwt_wallet_signature',
      error: error.message
    };
  }
}