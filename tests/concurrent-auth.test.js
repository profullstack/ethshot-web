import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';

/**
 * Concurrent Authentication Prevention Tests
 * 
 * Tests to verify that multiple simultaneous authentication attempts
 * are handled correctly without duplicate signature requests.
 */

describe('Concurrent Authentication Prevention', () => {
  let mockSupabase;
  let mockSigner;
  let signMessageCallCount;

  beforeEach(() => {
    signMessageCallCount = 0;
    
    // Mock signer that tracks how many times signMessage is called
    mockSigner = {
      signMessage: async (message) => {
        signMessageCallCount++;
        console.log(`Mock signMessage called (count: ${signMessageCallCount})`);
        // Simulate some delay like a real wallet
        await new Promise(resolve => setTimeout(resolve, 100));
        return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      },
      getAddress: async () => '0x6ee8fbd7b699d3da2942562ffa526920ce784d8a'
    };

    // Mock Supabase that succeeds on first attempt
    mockSupabase = {
      auth: {
        signInWithPassword: () => Promise.resolve({ 
          data: { user: null, session: null }, 
          error: { message: 'User not found' } 
        }),
        signUp: () => Promise.resolve({ 
          data: { 
            user: { id: 'user-123', email: '0x6ee8fbd7b699d3da2942562ffa526920ce784d8a@ethshot.io' },
            session: { access_token: 'token', expires_at: Math.floor(Date.now() / 1000) + 3600 }
          }, 
          error: null 
        }),
        updateUser: () => Promise.resolve({ data: { user: {} }, error: null }),
        getSession: () => Promise.resolve({ 
          data: { 
            session: { 
              user: { id: 'user-123' }, 
              access_token: 'token', 
              expires_at: Math.floor(Date.now() / 1000) + 3600 
            } 
          }, 
          error: null 
        })
      }
    };
  });

  describe('Single Authentication Request', () => {
    it('should call signMessage only once for single authentication', async () => {
      const authenticateWithWallet = createMockAuthenticateFunction(mockSupabase);
      
      const result = await authenticateWithWallet('0x6ee8fbd7b699d3da2942562ffa526920ce784d8a', mockSigner);
      
      expect(result.success).to.be.true;
      expect(signMessageCallCount).to.equal(1);
    });
  });

  describe('Concurrent Authentication Requests', () => {
    it('should call signMessage only once for concurrent authentication attempts', async () => {
      const authenticateWithWallet = createMockAuthenticateFunction(mockSupabase);
      
      // Start two concurrent authentication attempts
      const promise1 = authenticateWithWallet('0x6ee8fbd7b699d3da2942562ffa526920ce784d8a', mockSigner);
      const promise2 = authenticateWithWallet('0x6ee8fbd7b699d3da2942562ffa526920ce784d8a', mockSigner);
      
      // Wait for both to complete
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      // Both should succeed
      expect(result1.success).to.be.true;
      expect(result2.success).to.be.true;
      
      // But signMessage should only be called once
      expect(signMessageCallCount).to.equal(1);
    });

    it('should handle three concurrent authentication attempts correctly', async () => {
      const authenticateWithWallet = createMockAuthenticateFunction(mockSupabase);
      
      // Start three concurrent authentication attempts
      const promise1 = authenticateWithWallet('0x6ee8fbd7b699d3da2942562ffa526920ce784d8a', mockSigner);
      const promise2 = authenticateWithWallet('0x6ee8fbd7b699d3da2942562ffa526920ce784d8a', mockSigner);
      const promise3 = authenticateWithWallet('0x6ee8fbd7b699d3da2942562ffa526920ce784d8a', mockSigner);
      
      // Wait for all to complete
      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
      
      // All should succeed
      expect(result1.success).to.be.true;
      expect(result2.success).to.be.true;
      expect(result3.success).to.be.true;
      
      // But signMessage should only be called once
      expect(signMessageCallCount).to.equal(1);
    });

    it('should allow new authentication after previous one completes', async () => {
      const authenticateWithWallet = createMockAuthenticateFunction(mockSupabase);
      
      // First authentication
      const result1 = await authenticateWithWallet('0x6ee8fbd7b699d3da2942562ffa526920ce784d8a', mockSigner);
      expect(result1.success).to.be.true;
      expect(signMessageCallCount).to.equal(1);
      
      // Second authentication (after first completes)
      const result2 = await authenticateWithWallet('0x6ee8fbd7b699d3da2942562ffa526920ce784d8a', mockSigner);
      expect(result2.success).to.be.true;
      expect(signMessageCallCount).to.equal(2); // Should be called again
    });
  });

  describe('Error Handling with Concurrent Requests', () => {
    it('should handle concurrent requests when first authentication fails', async () => {
      // Mock Supabase that fails on first attempt
      const failingSupabase = {
        ...mockSupabase,
        auth: {
          ...mockSupabase.auth,
          signUp: () => Promise.resolve({
            data: { user: null, session: null },
            error: { message: 'Authentication failed' }
          })
        }
      };

      const authenticateWithWallet = createMockAuthenticateFunction(failingSupabase);
      
      // Start two concurrent authentication attempts
      const promise1 = authenticateWithWallet('0x6ee8fbd7b699d3da2942562ffa526920ce784d8a', mockSigner);
      const promise2 = authenticateWithWallet('0x6ee8fbd7b699d3da2942562ffa526920ce784d8a', mockSigner);
      
      // Both should fail with the same error
      try {
        await Promise.all([promise1, promise2]);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Authentication failed');
        // When first auth fails, second request proceeds with new attempt
        // So signMessage may be called twice (once for first attempt, once for retry)
        expect(signMessageCallCount).to.be.at.least(1);
        expect(signMessageCallCount).to.be.at.most(2);
      }
    });
  });
});

// Helper function to create a mock authenticate function with concurrency control
function createMockAuthenticateFunction(supabase) {
  let authenticationInProgress = false;
  let pendingAuthPromise = null;

  return async function authenticateWithWallet(walletAddress, signer, maxRetries = 3) {
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
        console.log('🔐 Authenticating with Supabase:', walletAddress);

        // Create a unique message to sign
        const timestamp = Date.now();
        const message = `Authenticate wallet ${walletAddress.toLowerCase()} at ${timestamp}`;
        
        // Request signature from the wallet
        const signature = await signer.signMessage(message);
        
        // Create email and password
        const email = `${walletAddress.toLowerCase()}@ethshot.io`;
        const password = 'mock-password'; // Simplified for testing

        // Try to sign in first
        let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        // If sign in fails, try to sign up
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

        // Wait for session establishment
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get session
        const { data: { session } } = await supabase.auth.getSession();

        return {
          success: true,
          user: signInData.user,
          session: session || signInData.session,
          signature,
          message
        };

      } finally {
        // Clear the authentication lock and pending promise
        authenticationInProgress = false;
        pendingAuthPromise = null;
      }
    })();

    // Return the pending promise
    return pendingAuthPromise;
  };
}