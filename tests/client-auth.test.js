/**
 * Client-side Authentication Utilities Tests
 * 
 * Tests for the new client-side authentication functions that communicate
 * with the server-side API instead of directly calling Supabase.
 * Uses Mocha testing framework with Chai assertions.
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import {
  authenticateWithWalletAPI,
  validateTokenAPI,
  refreshTokenAPI,
  signOutFromSupabaseAPI,
  getCurrentSessionAPI,
  isAuthenticatedAPI,
  isAuthenticatedForWalletAPI,
  getAuthStatusAPI
} from '../src/lib/utils/client-auth.js';

// Mock objects
let mockFetch;
let mockSigner;
let mockSupabase;
let originalFetch;

describe('Client-side Authentication Utilities', () => {
  beforeEach(() => {
    // Store original fetch
    originalFetch = global.fetch;
    
    // Create mock signer
    mockSigner = {
      signMessage: async (message) => {
        if (message.includes('Sign in to ETH Shot')) {
          return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234';
        }
        throw new Error('Invalid message format');
      }
    };

    // Create mock Supabase
    mockSupabase = {
      auth: {
        signInWithCustomToken: async ({ token }) => {
          if (token && token.startsWith('eyJ')) {
            return {
              data: {
                user: { id: '0x742d35cc6634c0532925a3b8d0c9c0e3c5d5c8ef', email: null },
                session: { 
                  access_token: token,
                  expires_at: Math.floor(Date.now() / 1000) + 3600
                }
              },
              error: null
            };
          }
          return {
            data: null,
            error: { message: 'Invalid token' }
          };
        },
        signOut: async () => ({ error: null }),
        getSession: async () => ({
          data: {
            session: {
              user: { id: '0x742d35cc6634c0532925a3b8d0c9c0e3c5d5c8ef' },
              access_token: 'mock-token',
              expires_at: Math.floor(Date.now() / 1000) + 3600
            }
          },
          error: null
        }),
        refreshSession: async () => ({
          data: {
            session: {
              user: { id: '0x742d35cc6634c0532925a3b8d0c9c0e3c5d5c8ef' },
              access_token: 'refreshed-token',
              expires_at: Math.floor(Date.now() / 1000) + 3600
            }
          },
          error: null
        })
      }
    };

    // Mock the supabase import
    global.supabase = mockSupabase;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    delete global.supabase;
  });

  describe('authenticateWithWalletAPI', () => {
    it('should successfully authenticate with valid wallet and signer', async () => {
      const testWalletAddress = '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF';
      
      // Mock API responses
      let callCount = 0;
      global.fetch = async (url, options) => {
        callCount++;
        const body = JSON.parse(options.body);
        
        if (callCount === 1 && body.action === 'generate_nonce') {
          return {
            ok: true,
            json: async () => ({
              success: true,
              nonce: 'Sign in to ETH Shot - 1234567890 - abcdef123456',
              message: 'Sign in to ETH Shot - 1234567890 - abcdef123456\n\nWallet: 0x742d35cc6634c0532925a3b8d0c9c0e3c5d5c8ef',
              walletAddress: testWalletAddress.toLowerCase()
            })
          };
        }
        
        if (callCount === 2 && body.action === 'verify_signature') {
          return {
            ok: true,
            json: async () => ({
              success: true,
              jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock.token',
              walletAddress: testWalletAddress.toLowerCase(),
              message: 'Authentication successful'
            })
          };
        }
        
        throw new Error('Unexpected API call');
      };

      const result = await authenticateWithWalletAPI(testWalletAddress, mockSigner);
      
      expect(result.success).to.be.true;
      expect(result.user).to.be.an('object');
      expect(result.session).to.be.an('object');
      expect(result.jwtToken).to.be.a('string');
      expect(result.walletAddress).to.equal(testWalletAddress.toLowerCase());
      expect(result.authMethod).to.equal('api_jwt_wallet_signature');
      expect(callCount).to.equal(2);
    });

    it('should handle wallet signature rejection', async () => {
      const testWalletAddress = '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF';
      
      // Mock signer that rejects signature
      const rejectingSigner = {
        signMessage: async () => {
          throw new Error('User rejected the request');
        }
      };

      // Mock nonce generation
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'generate_nonce') {
          return {
            ok: true,
            json: async () => ({
              success: true,
              nonce: 'Sign in to ETH Shot - 1234567890 - abcdef123456',
              message: 'Sign in to ETH Shot - 1234567890 - abcdef123456\n\nWallet: 0x742d35cc6634c0532925a3b8d0c9c0e3c5d5c8ef',
              walletAddress: testWalletAddress.toLowerCase()
            })
          };
        }
        throw new Error('Should not reach signature verification');
      };

      try {
        await authenticateWithWalletAPI(testWalletAddress, rejectingSigner);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Wallet signature was rejected');
      }
    });

    it('should retry on server errors', async () => {
      const testWalletAddress = '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF';
      
      let callCount = 0;
      global.fetch = async (url, options) => {
        callCount++;
        const body = JSON.parse(options.body);
        
        if (body.action === 'generate_nonce') {
          if (callCount === 1) {
            // First call fails
            return {
              ok: false,
              status: 500,
              json: async () => ({
                success: false,
                error: 'Server error'
              })
            };
          } else {
            // Second call succeeds
            return {
              ok: true,
              json: async () => ({
                success: true,
                nonce: 'Sign in to ETH Shot - 1234567890 - abcdef123456',
                message: 'Sign in to ETH Shot - 1234567890 - abcdef123456\n\nWallet: 0x742d35cc6634c0532925a3b8d0c9c0e3c5d5c8ef',
                walletAddress: testWalletAddress.toLowerCase()
              })
            };
          }
        }
        
        if (body.action === 'verify_signature') {
          return {
            ok: true,
            json: async () => ({
              success: true,
              jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock.token',
              walletAddress: testWalletAddress.toLowerCase(),
              message: 'Authentication successful'
            })
          };
        }
        
        throw new Error('Unexpected API call');
      };

      const result = await authenticateWithWalletAPI(testWalletAddress, mockSigner);
      expect(result.success).to.be.true;
      expect(callCount).to.be.greaterThan(2); // Should have retried
    });

    it('should require walletAddress parameter', async () => {
      try {
        await authenticateWithWalletAPI(null, mockSigner);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Wallet address is required');
      }
    });

    it('should require signer parameter', async () => {
      try {
        await authenticateWithWalletAPI('0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF', null);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Wallet signer is required');
      }
    });
  });

  describe('validateTokenAPI', () => {
    it('should validate valid JWT token', async () => {
      const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock.token';
      
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        expect(body.action).to.equal('validate_token');
        expect(body.jwtToken).to.equal(testToken);
        
        return {
          ok: true,
          json: async () => ({
            success: true,
            user: {
              walletAddress: '0x742d35cc6634c0532925a3b8d0c9c0e3c5d5c8ef',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              metadata: {}
            },
            tokenPayload: {
              sub: '0x742d35cc6634c0532925a3b8d0c9c0e3c5d5c8ef',
              aud: 'authenticated'
            }
          })
        };
      };

      const result = await validateTokenAPI(testToken);
      expect(result.success).to.be.true;
      expect(result.user).to.be.an('object');
      expect(result.tokenPayload).to.be.an('object');
    });

    it('should handle invalid token', async () => {
      const invalidToken = 'invalid.token';
      
      global.fetch = async (url, options) => {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            error: 'Token validation failed',
            message: 'Invalid JWT token'
          })
        };
      };

      try {
        await validateTokenAPI(invalidToken);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Token validation failed');
      }
    });
  });

  describe('refreshTokenAPI', () => {
    it('should refresh valid token', async () => {
      const currentToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.current.token';
      const newToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new.token';
      
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        expect(body.action).to.equal('refresh_token');
        expect(body.currentToken).to.equal(currentToken);
        
        return {
          ok: true,
          json: async () => ({
            success: true,
            jwtToken: newToken,
            walletAddress: '0x742d35cc6634c0532925a3b8d0c9c0e3c5d5c8ef',
            message: 'Token refreshed successfully'
          })
        };
      };

      const result = await refreshTokenAPI(currentToken);
      expect(result.success).to.be.true;
      expect(result.jwtToken).to.equal(newToken);
      expect(result.walletAddress).to.be.a('string');
    });

    it('should handle expired token', async () => {
      const expiredToken = 'expired.token';
      
      global.fetch = async (url, options) => {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            error: 'Token refresh failed',
            message: 'Current token is invalid'
          })
        };
      };

      try {
        await refreshTokenAPI(expiredToken);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Token refresh failed');
      }
    });
  });

  describe('signOutFromSupabaseAPI', () => {
    it('should sign out successfully', async () => {
      const result = await signOutFromSupabaseAPI();
      expect(result).to.be.undefined; // Function returns void on success
    });

    it('should handle sign out errors', async () => {
      // Mock Supabase with error
      global.supabase = {
        auth: {
          signOut: async () => ({
            error: { message: 'Sign out failed' }
          })
        }
      };

      try {
        await signOutFromSupabaseAPI();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Sign out failed');
      }
    });
  });

  describe('getCurrentSessionAPI', () => {
    it('should get current session', async () => {
      const session = await getCurrentSessionAPI();
      expect(session).to.be.an('object');
      expect(session.user).to.be.an('object');
      expect(session.access_token).to.be.a('string');
    });

    it('should handle expired session and refresh', async () => {
      // Mock expired session
      global.supabase = {
        auth: {
          getSession: async () => ({
            data: {
              session: {
                user: { id: '0x742d35cc6634c0532925a3b8d0c9c0e3c5d5c8ef' },
                access_token: 'expired-token',
                expires_at: Math.floor(Date.now() / 1000) - 3600 // Expired
              }
            },
            error: null
          }),
          refreshSession: async () => ({
            data: {
              session: {
                user: { id: '0x742d35cc6634c0532925a3b8d0c9c0e3c5d5c8ef' },
                access_token: 'refreshed-token',
                expires_at: Math.floor(Date.now() / 1000) + 3600
              }
            },
            error: null
          })
        }
      };

      const session = await getCurrentSessionAPI();
      expect(session).to.be.an('object');
      expect(session.access_token).to.equal('refreshed-token');
    });

    it('should return null when no session exists', async () => {
      // Mock no session
      global.supabase = {
        auth: {
          getSession: async () => ({
            data: { session: null },
            error: null
          })
        }
      };

      const session = await getCurrentSessionAPI();
      expect(session).to.be.null;
    });
  });

  describe('isAuthenticatedAPI', () => {
    it('should return true when authenticated', async () => {
      const isAuth = await isAuthenticatedAPI();
      expect(isAuth).to.be.true;
    });

    it('should return false when not authenticated', async () => {
      // Mock no session
      global.supabase = {
        auth: {
          getSession: async () => ({
            data: { session: null },
            error: null
          })
        }
      };

      const isAuth = await isAuthenticatedAPI();
      expect(isAuth).to.be.false;
    });
  });

  describe('isAuthenticatedForWalletAPI', () => {
    it('should return true for matching wallet address', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF';
      const isAuth = await isAuthenticatedForWalletAPI(walletAddress);
      expect(isAuth).to.be.true;
    });

    it('should return false for non-matching wallet address', async () => {
      const differentWallet = '0x1234567890123456789012345678901234567890';
      const isAuth = await isAuthenticatedForWalletAPI(differentWallet);
      expect(isAuth).to.be.false;
    });

    it('should return false for null wallet address', async () => {
      const isAuth = await isAuthenticatedForWalletAPI(null);
      expect(isAuth).to.be.false;
    });
  });

  describe('getAuthStatusAPI', () => {
    it('should return detailed auth status', async () => {
      const status = await getAuthStatusAPI();
      expect(status).to.be.an('object');
      expect(status.isAuthenticated).to.be.true;
      expect(status.session).to.be.an('object');
      expect(status.user).to.be.an('object');
      expect(status.walletAddress).to.be.a('string');
      expect(status.authMethod).to.equal('api_jwt_wallet_signature');
    });

    it('should handle errors gracefully', async () => {
      // Mock Supabase error
      global.supabase = {
        auth: {
          getSession: async () => {
            throw new Error('Database connection failed');
          }
        }
      };

      const status = await getAuthStatusAPI();
      expect(status).to.be.an('object');
      expect(status.isAuthenticated).to.be.false;
      expect(status.error).to.include('Database connection failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      global.fetch = async () => {
        throw new Error('Network error');
      };

      try {
        await validateTokenAPI('test-token');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Network error');
      }
    });

    it('should handle malformed API responses', async () => {
      global.fetch = async () => ({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      try {
        await validateTokenAPI('test-token');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid JSON');
      }
    });
  });
});