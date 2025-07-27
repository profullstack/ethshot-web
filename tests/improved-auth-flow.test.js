import { expect } from 'chai';
import { authenticateWithWallet, generateSecurePassword } from '../src/lib/utils/wallet-auth.js';

describe('Improved Authentication Flow', () => {
  let mockSupabase;
  let mockSigner;
  
  beforeEach(() => {
    // Mock signer
    mockSigner = {
      signMessage: async (message) => `mock_signature_for_${message}`
    };
    
    // Reset global state
    global.supabase = mockSupabase;
  });

  describe('Signup-first approach', () => {
    it('should successfully signup new users', async () => {
      const mockSession = {
        user: { id: 'user123', email: '0xtest@ethshot.io' },
        access_token: 'mock_token',
        expires_at: Date.now() / 1000 + 3600
      };

      mockSupabase = {
        auth: {
          signUp: async ({ email, password, options }) => {
            expect(email).to.equal('0xtest@ethshot.io');
            expect(password).to.be.a('string');
            expect(options.data.wallet_address).to.equal('0xtest');
            
            return {
              data: { session: mockSession },
              error: null
            };
          },
          getSession: async () => ({
            data: { session: mockSession },
            error: null
          }),
          updateUser: async () => ({ error: null })
        }
      };

      global.supabase = mockSupabase;

      const result = await authenticateWithWallet('0xTest', mockSigner);
      
      expect(result.success).to.be.true;
      expect(result.user.email).to.equal('0xtest@ethshot.io');
      expect(result.session.access_token).to.equal('mock_token');
    });

    it('should fallback to signin when user already exists', async () => {
      const mockSession = {
        user: { id: 'user123', email: '0xtest@ethshot.io' },
        access_token: 'mock_token',
        expires_at: Date.now() / 1000 + 3600
      };

      let signUpCalled = false;
      let signInCalled = false;

      mockSupabase = {
        auth: {
          signUp: async () => {
            signUpCalled = true;
            return {
              data: null,
              error: { message: 'User already registered' }
            };
          },
          signInWithPassword: async ({ email, password }) => {
            signInCalled = true;
            expect(email).to.equal('0xtest@ethshot.io');
            
            return {
              data: { session: mockSession },
              error: null
            };
          },
          getSession: async () => ({
            data: { session: mockSession },
            error: null
          }),
          updateUser: async () => ({ error: null })
        }
      };

      global.supabase = mockSupabase;

      const result = await authenticateWithWallet('0xTest', mockSigner);
      
      expect(signUpCalled).to.be.true;
      expect(signInCalled).to.be.true;
      expect(result.success).to.be.true;
      expect(result.user.email).to.equal('0xtest@ethshot.io');
    });

    it('should handle rate limiting with proper wait times', async () => {
      let attemptCount = 0;
      const startTime = Date.now();

      mockSupabase = {
        auth: {
          signUp: async () => {
            attemptCount++;
            if (attemptCount === 1) {
              return {
                data: null,
                error: { message: 'For security purposes, you can only request this after 2 seconds.' }
              };
            }
            
            const mockSession = {
              user: { id: 'user123', email: '0xtest@ethshot.io' },
              access_token: 'mock_token',
              expires_at: Date.now() / 1000 + 3600
            };
            
            return {
              data: { session: mockSession },
              error: null
            };
          },
          getSession: async () => ({
            data: { 
              session: {
                user: { id: 'user123', email: '0xtest@ethshot.io' },
                access_token: 'mock_token',
                expires_at: Date.now() / 1000 + 3600
              }
            },
            error: null
          }),
          updateUser: async () => ({ error: null })
        }
      };

      global.supabase = mockSupabase;

      const result = await authenticateWithWallet('0xTest', mockSigner);
      const endTime = Date.now();
      
      expect(attemptCount).to.equal(2);
      expect(endTime - startTime).to.be.at.least(2000); // Should wait at least 2 seconds
      expect(result.success).to.be.true;
    });
  });

  describe('Session establishment', () => {
    it('should use session from auth response when available', async () => {
      const mockSession = {
        user: { id: 'user123', email: '0xtest@ethshot.io' },
        access_token: 'mock_token',
        expires_at: Date.now() / 1000 + 3600
      };

      let getSessionCalled = false;

      mockSupabase = {
        auth: {
          signUp: async () => ({
            data: { session: mockSession },
            error: null
          }),
          getSession: async () => {
            getSessionCalled = true;
            return {
              data: { session: mockSession },
              error: null
            };
          },
          updateUser: async () => ({ error: null })
        }
      };

      global.supabase = mockSupabase;

      const result = await authenticateWithWallet('0xTest', mockSigner);
      
      // Should use session from auth response, not call getSession
      expect(getSessionCalled).to.be.false;
      expect(result.success).to.be.true;
      expect(result.session.access_token).to.equal('mock_token');
    });

    it('should retry session retrieval when not in auth response', async () => {
      const mockSession = {
        user: { id: 'user123', email: '0xtest@ethshot.io' },
        access_token: 'mock_token',
        expires_at: Date.now() / 1000 + 3600
      };

      let getSessionCallCount = 0;

      mockSupabase = {
        auth: {
          signUp: async () => ({
            data: { session: null }, // No session in response
            error: null
          }),
          getSession: async () => {
            getSessionCallCount++;
            if (getSessionCallCount === 1) {
              return { data: { session: null }, error: null };
            }
            return { data: { session: mockSession }, error: null };
          },
          getUser: async () => ({
            data: { user: mockSession.user },
            error: null
          }),
          updateUser: async () => ({ error: null })
        }
      };

      global.supabase = mockSupabase;

      const result = await authenticateWithWallet('0xTest', mockSigner);
      
      expect(getSessionCallCount).to.be.at.least(1);
      expect(result.success).to.be.true;
      expect(result.session.access_token).to.equal('mock_token');
    });

    it('should throw error when session cannot be established', async () => {
      mockSupabase = {
        auth: {
          signUp: async () => ({
            data: { session: null },
            error: null
          }),
          getSession: async () => ({
            data: { session: null },
            error: null
          }),
          getUser: async () => ({
            data: { user: null },
            error: null
          })
        }
      };

      global.supabase = mockSupabase;

      try {
        await authenticateWithWallet('0xTest', mockSigner);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('session could not be established');
      }
    });
  });

  describe('Error handling', () => {
    it('should handle wallet signature rejection', async () => {
      const rejectingSigner = {
        signMessage: async () => {
          throw new Error('User rejected the request');
        }
      };

      mockSupabase = {
        auth: {
          signUp: async () => ({ data: null, error: null })
        }
      };

      global.supabase = mockSupabase;

      try {
        await authenticateWithWallet('0xTest', rejectingSigner);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('signature was rejected');
      }
    });

    it('should retry on transient errors', async () => {
      let attemptCount = 0;
      const mockSession = {
        user: { id: 'user123', email: '0xtest@ethshot.io' },
        access_token: 'mock_token',
        expires_at: Date.now() / 1000 + 3600
      };

      mockSupabase = {
        auth: {
          signUp: async () => {
            attemptCount++;
            if (attemptCount === 1) {
              throw new Error('Network error');
            }
            return {
              data: { session: mockSession },
              error: null
            };
          },
          getSession: async () => ({
            data: { session: mockSession },
            error: null
          }),
          updateUser: async () => ({ error: null })
        }
      };

      global.supabase = mockSupabase;

      const result = await authenticateWithWallet('0xTest', mockSigner);
      
      expect(attemptCount).to.equal(2);
      expect(result.success).to.be.true;
    });
  });
});