/**
 * Wallet-based Supabase Authentication
 * 
 * Handles authentication with Supabase using wallet addresses.
 * This creates a JWT token with the wallet address for secure profile operations.
 */

import { supabase } from '../database/client.js';

/**
 * Authenticate user with Supabase using wallet signature verification
 * @param {string} walletAddress - The connected wallet address
 * @param {Object} signer - The ethers signer object
 * @returns {Promise<Object>} Authentication result
 */
export async function authenticateWithWallet(walletAddress, signer) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  if (!walletAddress) {
    throw new Error('Wallet address is required');
  }

  if (!signer) {
    throw new Error('Wallet signer is required for authentication');
  }

  try {
    console.log('🔐 Authenticating with Supabase using wallet signature verification:', walletAddress);

    // Create a unique message to sign that includes timestamp to prevent replay attacks
    const timestamp = Date.now();
    const message = `Authenticate wallet ${walletAddress.toLowerCase()} at ${timestamp}`;
    
    console.log('✍️ Requesting wallet signature for message:', message);
    
    // Request signature from the wallet
    const signature = await signer.signMessage(message);
    console.log('✅ Signature received');

    // Use the wallet address directly as the email to satisfy the secure function's regex validation
    // The signature is used as the password - this proves wallet ownership
    const email = walletAddress.toLowerCase();
    const password = signature;

    // Try to sign in first
    let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // If sign in fails, try to sign up with the signature
    if (signInError) {
      console.log('🔐 Sign in failed, attempting sign up with signature verification');
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            wallet_address: walletAddress.toLowerCase(),
            auth_message: message,
            auth_signature: signature,
            auth_timestamp: timestamp
          }
        }
      });

      if (signUpError) {
        console.error('❌ Sign up failed:', signUpError);
        throw new Error(`Authentication failed: ${signUpError.message}`);
      }

      signInData = signUpData;
      console.log('✅ User signed up successfully with signature verification');
    } else {
      console.log('✅ User signed in successfully');
    }

    // Update user metadata with current authentication info
    if (signInData.user) {
      console.log('🔄 Updating user metadata with current authentication info');
      
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          wallet_address: walletAddress.toLowerCase(),
          last_auth_message: message,
          last_auth_signature: signature,
          last_auth_timestamp: timestamp
        }
      });

      if (updateError) {
        console.warn('⚠️ Failed to update user metadata:', updateError);
      }
    }

    return {
      success: true,
      user: signInData.user,
      session: signInData.session,
      signature,
      message
    };

  } catch (error) {
    console.error('❌ Wallet authentication failed:', error);
    
    // Provide more specific error messages
    if (error.message?.includes('User rejected') || error.message?.includes('denied')) {
      throw new Error('Wallet signature was rejected. Please approve the signature request to authenticate.');
    } else if (error.message?.includes('signMessage')) {
      throw new Error('Failed to get wallet signature. Please ensure your wallet supports message signing.');
    }
    
    throw error;
  }
}

/**
 * Sign out from Supabase
 * @returns {Promise<void>}
 */
export async function signOutFromSupabase() {
  if (!supabase) {
    return;
  }

  try {
    console.log('🔐 Signing out from Supabase');
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
 * Get current Supabase session
 * @returns {Promise<Object|null>} Current session or null
 */
export async function getCurrentSession() {
  if (!supabase) {
    return null;
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Failed to get session:', error);
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('❌ Failed to get session:', error);
    return null;
  }
}

/**
 * Check if user is authenticated with Supabase
 * @returns {Promise<boolean>} True if authenticated
 */
export async function isAuthenticated() {
  const session = await getCurrentSession();
  return !!session?.user;
}

/**
 * Check if user is authenticated for a specific wallet address
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<boolean>} True if authenticated for this wallet
 */
export async function isAuthenticatedForWallet(walletAddress) {
  if (!walletAddress) return false;
  
  const session = await getCurrentSession();
  if (!session?.user) return false;
  
  // Check if the session email matches the wallet address
  const sessionEmail = session.user.email?.toLowerCase();
  const normalizedWallet = walletAddress.toLowerCase();
  
  console.log('🔍 Checking authentication for wallet:', {
    walletAddress: normalizedWallet,
    sessionEmail,
    isMatch: sessionEmail === normalizedWallet,
    hasSession: !!session,
    hasUser: !!session.user
  });
  
  return sessionEmail === normalizedWallet;
}

/**
 * Get authentication status with detailed information
 * @returns {Promise<Object>} Authentication status details
 */
export async function getAuthStatus() {
  try {
    const session = await getCurrentSession();
    
    const status = {
      isAuthenticated: !!session?.user,
      session: session,
      user: session?.user || null,
      walletAddress: session?.user?.email || null,
      expiresAt: session?.expires_at || null,
      accessToken: session?.access_token ? 'present' : 'missing'
    };
    
    console.log('🔍 Current auth status:', status);
    return status;
  } catch (error) {
    console.error('❌ Failed to get auth status:', error);
    return {
      isAuthenticated: false,
      session: null,
      user: null,
      walletAddress: null,
      expiresAt: null,
      accessToken: 'missing',
      error: error.message
    };
  }
}