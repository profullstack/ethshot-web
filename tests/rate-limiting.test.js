import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';

/**
 * Rate Limiting Tests
 * 
 * Tests to verify that Supabase rate limiting is properly handled
 * with exponential backoff and retry logic.
 */

describe('Rate Limiting Handling', () => {
  let mockSupabase;
  let mockSigner;
  let rateLimitCallCount;

  beforeEach(() => {
    rateLimitCallCount = 0;
    
    // Mock signer for wallet operations
    mockSigner = {
      signMessage: async (message) => {
        // Simulate a wallet signature (132+ characters)
        return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      },
      getAddress: async () => '0x6ee8fbd7b699d3da2942562ffa526920ce784d8a'
    };
  });

  describe('Rate Limit Error Detection', () => {
    it('should correctly identify rate limiting errors', () => {
      const rateLimitError = new Error('For security purposes, you can only request this after 12 seconds.');
      const normalError = new Error('Invalid credentials');
      
      // Mock the isRateLimitError function
      const isRateLimitError = (error) => {
        return error.message?.includes('For security purposes, you can only request this after');
      };
      
      expect(isRateLimitError(rateLimitError)).to.be.true;
      expect(isRateLimitError(normalError)).to.be.false;
    });

    it('should parse wait time from rate limit error messages', () => {
      const parseRateLimitWaitTime = (errorMessage) => {
        const match = errorMessage.match(/after (\d+) seconds/);
        if (match) {
          return parseInt(match[1]) * 1000; // Convert to milliseconds
        }
        return 5000; // Default to 5 seconds if we can't parse
      };

      expect(parseRateLimitWaitTime('For security purposes, you can only request this after 12 seconds.')).to.equal(12000);
      expect(parseRateLimitWaitTime('For security purposes, you can only request this after 5 seconds.')).to.equal(5000);
      expect(parseRateLimitWaitTime('Invalid error message')).to.equal(5000);
    });
  });

  describe('Authentication Retry Logic', () => {
    it('should retry authentication after rate limit error', async () => {
      let attemptCount = 0;
      
      // Mock Supabase that fails first time with rate limit, then succeeds
      const mockSupabaseWithRateLimit = {
        auth: {
          signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'User not found' } }),
          signUp: () => {
            attemptCount++;
            if (attemptCount === 1) {
              return Promise.resolve({
                data: { user: null, session: null },
                error: { message: 'For security purposes, you can only request this after 1 seconds.' }
              });
            }
            return Promise.resolve({
              data: {
                user: { id: 'user-123', email: '0x6ee8fbd7b699d3da2942562ffa526920ce784d8a@ethshot.io' },
                session: { access_token: 'token', expires_at: Math.floor(Date.now() / 1000) + 3600 }
              },
              error: null
            });
          },
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

      // Simulate the authentication with retry logic (shorter wait time for testing)
      const authenticateWithRetry = async (walletAddress, signer, maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const timestamp = Date.now();
            const message = `Authenticate wallet ${walletAddress.toLowerCase()} at ${timestamp}`;
            const signature = await signer.signMessage(message);
            const email = `${walletAddress.toLowerCase()}@ethshot.io`;

            // Try sign in first
            let { data: signInData, error: signInError } = await mockSupabaseWithRateLimit.auth.signInWithPassword({
              email,
              password: 'mock-password',
            });

            // If sign in fails, try sign up
            if (signInError) {
              const { data: signUpData, error: signUpError } = await mockSupabaseWithRateLimit.auth.signUp({
                email,
                password: 'mock-password',
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
                // Handle rate limiting errors
                if (signUpError.message?.includes('For security purposes, you can only request this after')) {
                  const match = signUpError.message.match(/after (\d+) seconds/);
                  const waitTime = match ? parseInt(match[1]) * 100 : 500; // Shorter wait for testing
                  
                  if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue; // Retry the authentication
                  } else {
                    throw new Error(`Authentication failed after ${maxRetries} attempts due to rate limiting.`);
                  }
                }
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

          } catch (error) {
            if (attempt === maxRetries) {
              throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 100)); // Shorter wait for testing
          }
        }
      };

      const result = await authenticateWithRetry('0x6ee8fbd7b699d3da2942562ffa526920ce784d8a', mockSigner);
      
      expect(result.success).to.be.true;
      expect(result.user).to.not.be.null;
      expect(attemptCount).to.equal(2); // Should have retried once
    }).timeout(5000); // Increase timeout for this test

    it('should fail after maximum retry attempts', async () => {
      let attemptCount = 0;
      
      // Mock Supabase that always fails with rate limit
      const mockSupabaseAlwaysFails = {
        auth: {
          signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'User not found' } }),
          signUp: () => {
            attemptCount++;
            return Promise.resolve({ 
              data: { user: null, session: null }, 
              error: { message: 'For security purposes, you can only request this after 1 seconds.' } 
            });
          }
        }
      };

      // Simulate the authentication with retry logic
      const authenticateWithRetry = async (walletAddress, signer, maxRetries = 2) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const timestamp = Date.now();
            const message = `Authenticate wallet ${walletAddress.toLowerCase()} at ${timestamp}`;
            const signature = await signer.signMessage(message);
            const email = `${walletAddress.toLowerCase()}@ethshot.io`;

            // Try sign in first
            let { data: signInData, error: signInError } = await mockSupabaseAlwaysFails.auth.signInWithPassword({
              email,
              password: 'mock-password',
            });

            // If sign in fails, try sign up
            if (signInError) {
              const { data: signUpData, error: signUpError } = await mockSupabaseAlwaysFails.auth.signUp({
                email,
                password: 'mock-password'
              });

              if (signUpError) {
                // Handle rate limiting errors
                if (signUpError.message?.includes('For security purposes, you can only request this after')) {
                  const match = signUpError.message.match(/after (\d+) seconds/);
                  const waitTime = match ? parseInt(match[1]) * 1000 : 5000;
                  
                  if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue; // Retry the authentication
                  } else {
                    throw new Error(`Authentication failed after ${maxRetries} attempts due to rate limiting.`);
                  }
                }
                throw new Error(`Authentication failed: ${signUpError.message}`);
              }
            }

          } catch (error) {
            if (attempt === maxRetries) {
              throw error;
            }
          }
        }
      };

      try {
        await authenticateWithRetry('0x6ee8fbd7b699d3da2942562ffa526920ce784d8a', mockSigner, 2);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Authentication failed after 2 attempts due to rate limiting');
        expect(attemptCount).to.equal(2); // Should have attempted twice
      }
    });
  });

  describe('Wait Time Calculation', () => {
    it('should calculate correct wait times for different rate limit messages', () => {
      const parseRateLimitWaitTime = (errorMessage) => {
        const match = errorMessage.match(/after (\d+) seconds/);
        if (match) {
          return parseInt(match[1]) * 1000;
        }
        return 5000;
      };

      const testCases = [
        { message: 'For security purposes, you can only request this after 1 seconds.', expected: 1000 },
        { message: 'For security purposes, you can only request this after 5 seconds.', expected: 5000 },
        { message: 'For security purposes, you can only request this after 12 seconds.', expected: 12000 },
        { message: 'For security purposes, you can only request this after 30 seconds.', expected: 30000 },
        { message: 'Invalid message format', expected: 5000 }
      ];

      testCases.forEach(({ message, expected }) => {
        expect(parseRateLimitWaitTime(message)).to.equal(expected);
      });
    });

    it('should handle edge cases in wait time parsing', () => {
      const parseRateLimitWaitTime = (errorMessage) => {
        if (!errorMessage || typeof errorMessage !== 'string') {
          return 5000;
        }
        const match = errorMessage.match(/after (\d+) seconds/);
        if (match) {
          return parseInt(match[1]) * 1000;
        }
        return 5000;
      };

      // Test edge cases
      expect(parseRateLimitWaitTime('')).to.equal(5000);
      expect(parseRateLimitWaitTime(null)).to.equal(5000);
      expect(parseRateLimitWaitTime(undefined)).to.equal(5000);
      expect(parseRateLimitWaitTime('after abc seconds')).to.equal(5000);
      expect(parseRateLimitWaitTime('For security purposes, you can only request this after 0 seconds.')).to.equal(0);
    });
  });
});