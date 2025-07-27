import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';

/**
 * Complete Authentication Flow Tests
 * 
 * Tests the entire flow from wallet authentication to profile updates
 * to ensure session persistence works correctly.
 */

describe('Complete Authentication Flow', () => {
  let mockSupabase;
  let mockSession;
  let mockUser;
  let mockSigner;

  beforeEach(() => {
    // Mock user and session objects
    mockUser = {
      id: 'user-123',
      email: '0x6ee8fbd7b699d3da2942562ffa526920ce784d8a@ethshot.io',
      user_metadata: {
        wallet_address: '0x6ee8fbd7b699d3da2942562ffa526920ce784d8a'
      }
    };

    mockSession = {
      user: mockUser,
      access_token: 'mock-jwt-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      refresh_token: 'mock-refresh-token'
    };

    // Mock signer for wallet operations
    mockSigner = {
      signMessage: async (message) => {
        // Simulate a wallet signature (132+ characters)
        return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      },
      getAddress: async () => '0x6ee8fbd7b699d3da2942562ffa526920ce784d8a'
    };

    // Mock Supabase client with realistic timing
    let sessionEstablished = false;
    mockSupabase = {
      auth: {
        getSession: () => {
          if (sessionEstablished) {
            return Promise.resolve({ data: { session: mockSession }, error: null });
          } else {
            return Promise.resolve({ data: { session: null }, error: null });
          }
        },
        signInWithPassword: () => {
          // Simulate session establishment after a delay
          setTimeout(() => { sessionEstablished = true; }, 100);
          return Promise.resolve({ data: { user: mockUser, session: mockSession }, error: null });
        },
        signUp: () => {
          // Simulate session establishment after a delay
          setTimeout(() => { sessionEstablished = true; }, 100);
          return Promise.resolve({ data: { user: mockUser, session: mockSession }, error: null });
        },
        updateUser: () => Promise.resolve({ data: { user: mockUser }, error: null })
      },
      rpc: (functionName, params) => {
        if (functionName === 'upsert_user_profile_secure') {
          return Promise.resolve({ data: [{ id: 1, nickname: params.p_nickname }], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      }
    };
  });

  describe('Authentication to Profile Update Flow', () => {
    it('should successfully authenticate and then update profile', async () => {
      const walletAddress = '0x6ee8fbd7b699d3da2942562ffa526920ce784d8a';
      const profileData = {
        nickname: 'TestUser',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
        notificationsEnabled: true
      };

      // Step 1: Authenticate with wallet
      const authResult = await simulateWalletAuth(mockSupabase, walletAddress, mockSigner);
      expect(authResult.success).to.be.true;
      expect(authResult.user).to.not.be.null;

      // Step 2: Wait for session to be established (simulating real-world timing)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 3: Attempt profile update
      const profileResult = await simulateProfileUpdate(mockSupabase, profileData);
      expect(profileResult.success).to.be.true;
      expect(profileResult.data.nickname).to.equal('TestUser');
    });

    it('should handle session establishment delays gracefully', async () => {
      const walletAddress = '0x6ee8fbd7b699d3da2942562ffa526920ce784d8a';
      const profileData = { nickname: 'DelayedUser' };

      // Mock Supabase with delayed session establishment
      let sessionCallCount = 0;
      const delayedSupabase = {
        ...mockSupabase,
        auth: {
          ...mockSupabase.auth,
          getSession: () => {
            sessionCallCount++;
            if (sessionCallCount <= 2) {
              // First two calls return no session
              return Promise.resolve({ data: { session: null }, error: null });
            }
            // Third call returns valid session
            return Promise.resolve({ data: { session: mockSession }, error: null });
          }
        }
      };

      // Step 1: Authenticate
      const authResult = await simulateWalletAuth(delayedSupabase, walletAddress, mockSigner);
      expect(authResult.success).to.be.true;

      // Step 2: Attempt profile update with retry logic
      const profileResult = await simulateProfileUpdateWithRetry(delayedSupabase, profileData);
      expect(profileResult.success).to.be.true;
      expect(sessionCallCount).to.be.greaterThan(2); // Should have retried
    });

    it('should handle expired sessions by refreshing', async () => {
      const walletAddress = '0x6ee8fbd7b699d3da2942562ffa526920ce784d8a';
      const profileData = { nickname: 'RefreshUser' };

      // Mock expired session
      const expiredSession = {
        ...mockSession,
        expires_at: Math.floor(Date.now() / 1000) - 60 // Expired 1 minute ago
      };

      const refreshSupabase = {
        ...mockSupabase,
        auth: {
          ...mockSupabase.auth,
          getSession: () => Promise.resolve({ data: { session: expiredSession }, error: null }),
          refreshSession: () => Promise.resolve({ 
            data: { 
              session: { ...mockSession, expires_at: Math.floor(Date.now() / 1000) + 3600 } 
            }, 
            error: null 
          })
        }
      };

      // Simulate session refresh logic
      let session = await refreshSupabase.auth.getSession();
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (session.data.session.expires_at < currentTime) {
        const refreshResult = await refreshSupabase.auth.refreshSession();
        session = refreshResult;
      }

      expect(session.data.session.expires_at).to.be.greaterThan(currentTime);
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error when session cannot be established', async () => {
      const noSessionSupabase = {
        ...mockSupabase,
        auth: {
          ...mockSupabase.auth,
          getSession: () => Promise.resolve({ data: { session: null }, error: null })
        }
      };

      try {
        await simulateProfileUpdateWithTimeout(noSessionSupabase, { nickname: 'FailUser' }, 1000);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('session');
      }
    });

    it('should handle authentication failures gracefully', async () => {
      const failingSupabase = {
        ...mockSupabase,
        auth: {
          ...mockSupabase.auth,
          signInWithPassword: () => Promise.resolve({ 
            data: { user: null, session: null }, 
            error: { message: 'Invalid credentials' } 
          }),
          signUp: () => Promise.resolve({ 
            data: { user: null, session: null }, 
            error: { message: 'Sign up failed' } 
          })
        }
      };

      try {
        await simulateWalletAuth(failingSupabase, '0x123', mockSigner);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Authentication failed');
      }
    });
  });
});

// Helper functions to simulate the authentication flow

async function simulateWalletAuth(supabase, walletAddress, signer) {
  const timestamp = Date.now();
  const message = `Authenticate wallet ${walletAddress.toLowerCase()} at ${timestamp}`;
  const signature = await signer.signMessage(message);
  
  const email = `${walletAddress.toLowerCase()}@ethshot.io`;
  const password = await generateMockSecurePassword(signature, walletAddress, timestamp);

  // Try sign in first
  let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // If sign in fails, try sign up
  if (signInError) {
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
      throw new Error(`Authentication failed: ${signUpError.message}`);
    }
    signInData = signUpData;
  }

  return {
    success: true,
    user: signInData.user,
    session: signInData.session,
    signature,
    message
  };
}

async function simulateProfileUpdate(supabase, profileData) {
  const session = await supabase.auth.getSession();
  
  if (!session.data.session) {
    throw new Error('No active session found');
  }

  const { data, error } = await supabase.rpc('upsert_user_profile_secure', {
    p_nickname: profileData.nickname || null,
    p_avatar_url: profileData.avatarUrl || null,
    p_bio: profileData.bio || null,
    p_notifications_enabled: profileData.notificationsEnabled ?? true
  });

  if (error) {
    throw new Error(`Profile update failed: ${error.message}`);
  }

  return {
    success: true,
    data: data && data.length > 0 ? data[0] : null
  };
}

async function simulateProfileUpdateWithRetry(supabase, profileData, maxRetries = 3, retryDelay = 500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await simulateProfileUpdate(supabase, profileData);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

async function simulateProfileUpdateWithTimeout(supabase, profileData, timeout = 5000) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Profile update timed out')), timeout);
  });

  const updatePromise = simulateProfileUpdate(supabase, profileData);
  
  return Promise.race([updatePromise, timeoutPromise]);
}

async function generateMockSecurePassword(signature, walletAddress, timestamp) {
  const combinedData = `${signature}:${walletAddress.toLowerCase()}:${timestamp}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(combinedData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}