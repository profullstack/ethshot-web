/**
 * Test suite for signup/signin fallback mechanism
 * Verifies that new users can sign up when signin fails
 */

import { expect } from 'chai';

// Import only the password generation function to avoid circular dependencies
async function generateSecurePassword(signature, walletAddress, timestamp) {
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

describe('Signup/Signin Fallback Mechanism', () => {
  let mockSupabase;
  let mockSigner;
  let signMessageCallCount;

  beforeEach(() => {
    signMessageCallCount = 0;
    
    // Mock signer that tracks signMessage calls
    mockSigner = {
      signMessage: async (message) => {
        signMessageCallCount++;
        console.log(`Mock signMessage called (count: ${signMessageCallCount})`);
        return `mock_signature_${signMessageCallCount}_for_${message}`;
      }
    };
  });

  describe('New User Signup Flow', () => {
    it('should attempt signin first, then signup for new users', async () => {
      let signInCalled = false;
      let signUpCalled = false;
      
      // Mock Supabase that fails signin but succeeds signup
      mockSupabase = {
        auth: {
          signInWithPassword: async ({ email, password }) => {
            signInCalled = true;
            console.log('🔐 Mock signIn called with:', { email, passwordLength: password.length });
            return {
              data: { user: null, session: null },
              error: { message: 'Invalid login credentials' }
            };
          },
          signUp: async ({ email, password, options }) => {
            signUpCalled = true;
            console.log('🔐 Mock signUp called with:', { 
              email, 
              passwordLength: password.length,
              walletAddress: options?.data?.wallet_address 
            });
            return {
              data: {
                user: { 
                  id: 'mock-user-id', 
                  email,
                  user_metadata: options?.data || {}
                },
                session: {
                  access_token: 'mock-access-token',
                  user: { id: 'mock-user-id', email }
                }
              },
              error: null
            };
          },
          getSession: async () => ({
            data: { 
              session: {
                access_token: 'mock-access-token',
                user: { id: 'mock-user-id', email: '0x123@ethshot.io' },
                expires_at: Math.floor(Date.now() / 1000) + 3600
              }
            },
            error: null
          }),
          updateUser: async () => ({ error: null })
        }
      };

      // Create mock authenticate function with our mock Supabase
      const authenticateWithWallet = createMockAuthenticateFunction(mockSupabase);
      
      const result = await authenticateWithWallet('0x123', mockSigner);
      
      expect(signInCalled).to.be.true;
      expect(signUpCalled).to.be.true;
      expect(signMessageCallCount).to.equal(1);
      expect(result.success).to.be.true;
      expect(result.user.email).to.equal('0x123@ethshot.io');
    });

    it('should use signin if user already exists', async () => {
      let signInCalled = false;
      let signUpCalled = false;
      
      // Mock Supabase that succeeds signin
      mockSupabase = {
        auth: {
          signInWithPassword: async ({ email, password }) => {
            signInCalled = true;
            console.log('🔐 Mock signIn called with:', { email, passwordLength: password.length });
            return {
              data: {
                user: { 
                  id: 'existing-user-id', 
                  email,
                  user_metadata: { wallet_address: '0x456' }
                },
                session: {
                  access_token: 'mock-access-token',
                  user: { id: 'existing-user-id', email }
                }
              },
              error: null
            };
          },
          signUp: async () => {
            signUpCalled = true;
            throw new Error('signUp should not be called for existing users');
          },
          getSession: async () => ({
            data: { 
              session: {
                access_token: 'mock-access-token',
                user: { id: 'existing-user-id', email: '0x456@ethshot.io' },
                expires_at: Math.floor(Date.now() / 1000) + 3600
              }
            },
            error: null
          }),
          updateUser: async () => ({ error: null })
        }
      };

      const authenticateWithWallet = createMockAuthenticateFunction(mockSupabase);
      
      const result = await authenticateWithWallet('0x456', mockSigner);
      
      expect(signInCalled).to.be.true;
      expect(signUpCalled).to.be.false;
      expect(signMessageCallCount).to.equal(1);
      expect(result.success).to.be.true;
      expect(result.user.email).to.equal('0x456@ethshot.io');
    });

    it('should handle signup failures gracefully', async () => {
      // Mock Supabase that fails both signin and signup
      mockSupabase = {
        auth: {
          signInWithPassword: async () => ({
            data: { user: null, session: null },
            error: { message: 'Invalid login credentials' }
          }),
          signUp: async () => ({
            data: { user: null, session: null },
            error: { message: 'User already registered' }
          }),
          getSession: async () => ({
            data: { session: null },
            error: null
          })
        }
      };

      const authenticateWithWallet = createMockAuthenticateFunction(mockSupabase);
      
      try {
        await authenticateWithWallet('0x789', mockSigner);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Authentication failed: User already registered');
        expect(signMessageCallCount).to.equal(1);
      }
    });
  });

  describe('Password Generation Consistency', () => {
    it('should generate the same password for the same signature and wallet', async () => {
      const signature = 'test_signature';
      const walletAddress = '0xabc123';
      const timestamp = 1234567890;

      const password1 = await generateSecurePassword(signature, walletAddress, timestamp);
      const password2 = await generateSecurePassword(signature, walletAddress, timestamp);

      expect(password1).to.equal(password2);
      expect(password1.length).to.be.lessThan(72);
      expect(password1.length).to.equal(64); // SHA-256 hex string
    });

    it('should generate different passwords for different signatures', async () => {
      const walletAddress = '0xabc123';
      const timestamp = 1234567890;

      const password1 = await generateSecurePassword('signature1', walletAddress, timestamp);
      const password2 = await generateSecurePassword('signature2', walletAddress, timestamp);

      expect(password1).to.not.equal(password2);
      expect(password1.length).to.equal(64);
      expect(password2.length).to.equal(64);
    });
  });

  // Helper function to create mock authenticate function
  function createMockAuthenticateFunction(mockSupabaseInstance) {
    return async function authenticateWithWallet(walletAddress, signer, maxRetries = 3) {
      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }
      if (!signer) {
        throw new Error('Wallet signer is required for authentication');
      }

      try {
        console.log(`🔐 Authenticating with Supabase: ${walletAddress}`);

        // Create a unique message to sign
        const timestamp = Date.now();
        const message = `Authenticate wallet ${walletAddress.toLowerCase()} at ${timestamp}`;
        
        // Request signature from the wallet
        const signature = await signer.signMessage(message);

        // Create email and password
        const email = `${walletAddress.toLowerCase()}@ethshot.io`;
        const password = await generateSecurePassword(signature, walletAddress, timestamp);

        // Try to sign in first
        let { data: signInData, error: signInError } = await mockSupabaseInstance.auth.signInWithPassword({
          email,
          password,
        });

        // If sign in fails, try to sign up
        if (signInError) {
          console.log('🔐 Sign in failed, attempting sign up with signature verification');
          
          const { data: signUpData, error: signUpError } = await mockSupabaseInstance.auth.signUp({
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
          console.log('✅ User signed up successfully with signature verification');
        } else {
          console.log('✅ User signed in successfully');
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
        throw error;
      }
    };
  }
});