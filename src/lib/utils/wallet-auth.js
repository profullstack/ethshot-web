/**
 * Wallet-based Supabase Authentication
 *
 * Handles authentication with Supabase using wallet addresses.
 * This creates a JWT token with the wallet address for secure profile operations.
 */

import { supabase } from '../database/client.js';

// Global authentication lock to prevent concurrent authentication attempts
let authenticationInProgress = false;
let pendingAuthPromise = null;

/**
 * Generate a secure password from wallet signature that stays under 72 characters
 * Uses SHA-256 hash to create a deterministic but secure password
 * @param {string} signature - The wallet signature
 * @param {string} walletAddress - The wallet address
 * @param {number} timestamp - The timestamp used in the message
 * @returns {Promise<string>} A 64-character SHA-256 hash suitable for Supabase password
 */
export async function generateSecurePassword(signature, walletAddress, timestamp) {
  // Handle null/undefined inputs gracefully
  const safeSignature = signature || '';
  const safeWalletAddress = walletAddress || '';
  const safeTimestamp = timestamp || 0;
  
  // Combine signature, wallet address, and timestamp for uniqueness
  const combinedData = `${safeSignature}:${safeWalletAddress.toLowerCase()}:${safeTimestamp}`;
  
  // Use Web Crypto API for browser compatibility
  const encoder = new TextEncoder();
  const data = encoder.encode(combinedData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string (64 characters, well under 72 limit)
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse rate limit error message to extract wait time
 * @param {string} errorMessage - The error message from Supabase
 * @returns {number} Wait time in milliseconds
 */
function parseRateLimitWaitTime(errorMessage) {
  const match = errorMessage.match(/after (\d+) seconds/);
  if (match) {
    return parseInt(match[1]) * 1000; // Convert to milliseconds
  }
  return 5000; // Default to 5 seconds if we can't parse
}

/**
 * Check if error is a rate limiting error
 * @param {Error} error - The error to check
 * @returns {boolean} True if it's a rate limiting error
 */
function isRateLimitError(error) {
  return error.message?.includes('For security purposes, you can only request this after');
}

/**
 * Authenticate user with Supabase using wallet signature verification with rate limiting handling
 * @param {string} walletAddress - The connected wallet address
 * @param {Object} signer - The ethers signer object
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Object>} Authentication result
 */
export async function authenticateWithWallet(walletAddress, signer, maxRetries = 3) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  if (!walletAddress) {
    throw new Error('Wallet address is required');
  }

  if (!signer) {
    throw new Error('Wallet signer is required for authentication');
  }

  // Check if authentication is already in progress for this wallet
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

  // Create the authentication promise and store it for concurrent requests
  pendingAuthPromise = (async () => {
    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔐 Authenticating with Supabase (attempt ${attempt}/${maxRetries}):`, walletAddress);

          // Create a unique message to sign that includes timestamp to prevent replay attacks
          const timestamp = Date.now();
          const message = `Authenticate wallet ${walletAddress.toLowerCase()} at ${timestamp}`;
          
          console.log('✍️ Requesting wallet signature for message:', message);
          
          // Request signature from the wallet
          const signature = await signer.signMessage(message);
          console.log('✅ Signature received');

          // Create a valid email format using the wallet address
          // This satisfies Supabase's email validation while maintaining wallet-based authentication
          const email = `${walletAddress.toLowerCase()}@ethshot.io`;
          const password = await generateSecurePassword(signature, walletAddress, timestamp);

          // Try signup first, then fallback to signin if user already exists
          // This approach is simpler and avoids the need to check user existence
          console.log('🔐 Attempting signup first (will fallback to signin if user exists)');
          
          let signInData;
          let authMethod = 'signup';

          // First attempt: Try signup
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
            console.log('❌ Signup failed:', signUpError.message);
            
            // Handle rate limiting errors
            if (isRateLimitError(signUpError)) {
              const waitTime = parseRateLimitWaitTime(signUpError.message);
              console.log(`⏳ Rate limited, waiting ${waitTime/1000} seconds before retry (attempt ${attempt}/${maxRetries})`);
              
              if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue; // Retry the authentication
              } else {
                throw new Error(`Authentication failed after ${maxRetries} attempts due to rate limiting. Please wait a moment and try again.`);
              }
            }
            
            // If signup fails because user already exists, try signin
            if (signUpError.message?.includes('User already registered') ||
                signUpError.message?.includes('already been registered') ||
                signUpError.message?.includes('email address is already registered')) {
              console.log('🔄 User already exists, attempting signin');
              authMethod = 'signin';
              
              const { data: signInRetryData, error: signInRetryError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              
              if (signInRetryError) {
                console.error('❌ Signin failed for existing user:', signInRetryError);
                
                // Handle rate limiting errors for signin
                if (isRateLimitError(signInRetryError)) {
                  const waitTime = parseRateLimitWaitTime(signInRetryError.message);
                  console.log(`⏳ Rate limited on signin, waiting ${waitTime/1000} seconds before retry (attempt ${attempt}/${maxRetries})`);
                  
                  if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue; // Retry the authentication
                  } else {
                    throw new Error(`Authentication failed after ${maxRetries} attempts due to rate limiting. Please wait a moment and try again.`);
                  }
                }
                
                throw new Error(`Authentication failed: User exists but signin failed - ${signInRetryError.message}`);
              }
              
              signInData = signInRetryData;
              console.log('✅ Existing user signed in successfully');
            } else {
              throw new Error(`Authentication failed: ${signUpError.message}`);
            }
          } else {
            signInData = signUpData;
            authMethod = 'signup';
            console.log('✅ New user signed up successfully');
          }

          // Enhanced session establishment with better error handling
          console.log(`⏳ Waiting for session to be established after ${authMethod}...`);
          
          let currentSession = null;
          
          // First, try to use the session from the authentication response
          if (signInData?.session?.access_token && signInData?.session?.user) {
            currentSession = signInData.session;
            console.log('✅ Using session from authentication response');
          } else {
            // If no session in response, wait a bit and try to retrieve it
            console.log('🔄 No session in auth response, waiting and retrieving...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try multiple approaches to get the session
            let sessionAttempts = 0;
            const maxSessionAttempts = 8; // Increased attempts
            
            while (!currentSession && sessionAttempts < maxSessionAttempts) {
              sessionAttempts++;
              console.log(`🔄 Attempting to get session (attempt ${sessionAttempts}/${maxSessionAttempts})`);
              
              try {
                // Method 1: Get session directly
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (!sessionError && session?.user && session?.access_token) {
                  currentSession = session;
                  console.log('✅ Session retrieved successfully via getSession()');
                  break;
                }

                // Method 2: Try to get user first, then session
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (!userError && user) {
                  console.log('✅ User found, attempting to get session...');
                  // Small delay to let session sync
                  await new Promise(resolve => setTimeout(resolve, 200));
                  
                  const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
                  if (!retryError && retrySession?.access_token && retrySession?.user) {
                    currentSession = retrySession;
                    console.log('✅ Session retrieved successfully via getUser() + retry');
                    break;
                  }
                }

                // Progressive delay: shorter delays initially, longer delays later
                const delay = sessionAttempts <= 3 ? 300 : sessionAttempts <= 6 ? 600 : 1000;
                console.log(`⏳ Session not ready yet, waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                
              } catch (sessionErr) {
                console.warn(`⚠️ Error getting session (attempt ${sessionAttempts}):`, sessionErr);
                const delay = 500;
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }

          if (!currentSession?.user || !currentSession?.access_token) {
            console.error('❌ Failed to establish session after multiple attempts');
            console.error('Session state:', {
              hasSession: !!currentSession,
              hasUser: !!currentSession?.user,
              hasAccessToken: !!currentSession?.access_token,
              authMethod,
              signInDataHasSession: !!signInData?.session
            });
            throw new Error(`Authentication ${authMethod} succeeded but session could not be established. Please try connecting your wallet again.`);
          }

          console.log('✅ Session established successfully:', {
            hasUser: !!currentSession.user,
            hasAccessToken: !!currentSession.access_token,
            userEmail: currentSession.user?.email,
            expiresAt: currentSession.expires_at
          });

          // Update user metadata now that we have a valid session
          console.log('🔄 Updating user metadata with current authentication info');
          try {
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
            } else {
              console.log('✅ User metadata updated successfully');
            }
          } catch (updateErr) {
            console.warn('⚠️ Error updating user metadata:', updateErr);
          }

          return {
            success: true,
            user: currentSession.user,
            session: currentSession,
            signature,
            message
          };

        } catch (error) {
          console.error(`❌ Wallet authentication failed (attempt ${attempt}/${maxRetries}):`, error);
          
          // Handle rate limiting errors
          if (isRateLimitError(error)) {
            const waitTime = parseRateLimitWaitTime(error.message);
            console.log(`⏳ Rate limited, waiting ${waitTime/1000} seconds before retry (attempt ${attempt}/${maxRetries})`);
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue; // Retry the authentication
            } else {
              throw new Error(`Authentication failed after ${maxRetries} attempts due to rate limiting. Please wait a moment and try again.`);
            }
          }
          
          // Handle other specific error types
          if (error.message?.includes('User rejected') || error.message?.includes('denied')) {
            throw new Error('Wallet signature was rejected. Please approve the signature request to authenticate.');
          } else if (error.message?.includes('signMessage')) {
            throw new Error('Failed to get wallet signature. Please ensure your wallet supports message signing.');
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
 * Get current Supabase session with retry logic
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} retryDelay - Delay between retries in milliseconds
 * @returns {Promise<Object|null>} Current session or null
 */
export async function getCurrentSession(maxRetries = 3, retryDelay = 500) {
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
      
      // If we have a session, check if it's valid and not expired
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
 * Ensure session is established and valid before proceeding with operations
 * @param {number} maxWaitTime - Maximum time to wait in milliseconds
 * @param {number} checkInterval - Interval between checks in milliseconds
 * @returns {Promise<Object|null>} Valid session or null if timeout
 */
export async function ensureSessionEstablished(maxWaitTime = 10000, checkInterval = 500) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const session = await getCurrentSession(1, 100); // Single attempt with short delay
    
    if (session?.user && session?.access_token) {
      console.log('✅ Session established and valid');
      return session;
    }
    
    console.log('🔄 Waiting for session to be established...');
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  console.error('❌ Timeout waiting for session establishment');
  return null;
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
  
  // Check if the session email matches the wallet address (extract wallet from email format)
  const sessionEmail = session.user.email?.toLowerCase();
  const normalizedWallet = walletAddress.toLowerCase();
  const expectedEmail = `${normalizedWallet}@ethshot.io`;
  
  console.log('🔍 Checking authentication for wallet:', {
    walletAddress: normalizedWallet,
    sessionEmail,
    expectedEmail,
    isMatch: sessionEmail === expectedEmail,
    hasSession: !!session,
    hasUser: !!session.user
  });
  
  return sessionEmail === expectedEmail;
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
      walletAddress: session?.user?.email ? session.user.email.replace('@ethshot.io', '') : null,
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