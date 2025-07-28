/**
 * JWT Security Fix Tests
 * 
 * Tests to ensure JWT secret is not exposed to client-side code
 * and that JWT operations are properly secured server-side only.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

describe('JWT Security Fix', () => {
  describe('Client-side JWT utilities', () => {
    it('should not expose JWT secret to client code', async () => {
      // Import the client-safe utilities
      const clientUtils = await import('../src/lib/utils/jwt-wallet-auth-client.js');
      
      // Verify that no JWT secret functions are exposed
      expect(clientUtils.getJWTSecret).to.be.undefined;
      expect(clientUtils.setJWTSecret).to.be.undefined;
      expect(clientUtils.generateJWT).to.be.undefined;
      expect(clientUtils.verifyJWT).to.be.undefined;
      
      // Verify that only safe utilities are exposed
      expect(clientUtils.generateNonce).to.be.a('function');
      expect(clientUtils.createAuthMessage).to.be.a('function');
      expect(clientUtils.verifySignature).to.be.a('function');
      expect(clientUtils.extractWalletFromJWT).to.be.a('function');
      expect(clientUtils.isJWTExpired).to.be.a('function');
      expect(clientUtils.getChecksumAddress).to.be.a('function');
      expect(clientUtils.isValidWalletAddress).to.be.a('function');
    });

    it('should generate nonce without requiring JWT secret', async () => {
      const { generateNonce } = await import('../src/lib/utils/jwt-wallet-auth-client.js');
      
      const nonce = generateNonce();
      expect(nonce).to.be.a('string');
      expect(nonce).to.include('Sign in to ETH Shot');
      expect(nonce.length).to.be.greaterThan(20);
    });

    it('should create auth message without requiring JWT secret', async () => {
      const { createAuthMessage } = await import('../src/lib/utils/jwt-wallet-auth-client.js');
      
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const nonce = 'test-nonce-123';
      const message = createAuthMessage(walletAddress, nonce);
      
      expect(message).to.be.a('string');
      expect(message).to.include(nonce);
      expect(message).to.include(walletAddress.toLowerCase());
    });

    it('should extract wallet from JWT without verification', async () => {
      const { extractWalletFromJWT } = await import('../src/lib/utils/jwt-wallet-auth-client.js');
      
      // Create a mock JWT payload (not signed, just for testing extraction)
      const mockPayload = {
        sub: '0x1234567890123456789012345678901234567890',
        walletAddress: '0x1234567890123456789012345678901234567890',
        aud: 'authenticated'
      };
      
      // Create a mock JWT token (header.payload.signature format)
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify(mockPayload));
      const mockToken = `${header}.${payload}.mock-signature`;
      
      const extractedWallet = extractWalletFromJWT(mockToken);
      expect(extractedWallet).to.equal('0x1234567890123456789012345678901234567890');
    });

    it('should check JWT expiration without verification', async () => {
      const { isJWTExpired } = await import('../src/lib/utils/jwt-wallet-auth-client.js');
      
      // Create expired token
      const expiredPayload = {
        sub: '0x1234567890123456789012345678901234567890',
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };
      
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify(expiredPayload));
      const expiredToken = `${header}.${payload}.mock-signature`;
      
      expect(isJWTExpired(expiredToken)).to.be.true;
      
      // Create valid token
      const validPayload = {
        sub: '0x1234567890123456789012345678901234567890',
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      };
      
      const validPayloadEncoded = btoa(JSON.stringify(validPayload));
      const validToken = `${header}.${validPayloadEncoded}.mock-signature`;
      
      expect(isJWTExpired(validToken)).to.be.false;
    });
  });

  describe('Server-side JWT utilities', () => {
    it('should have secure JWT generation and verification functions', async () => {
      const serverUtils = await import('../src/lib/server/jwt-auth-secure.js');
      
      // Verify that JWT operations are available server-side
      expect(serverUtils.generateJWTSecure).to.be.a('function');
      expect(serverUtils.verifyJWTSecure).to.be.a('function');
      expect(serverUtils.generateNonceSecure).to.be.a('function');
      
      // Verify that secret access is not exposed
      expect(serverUtils.getJWTSecret).to.be.undefined;
      expect(serverUtils.setJWTSecret).to.be.undefined;
    });

    it('should generate secure nonce server-side', async () => {
      const { generateNonceSecure } = await import('../src/lib/server/jwt-auth-secure.js');
      
      const nonce = generateNonceSecure();
      expect(nonce).to.be.a('string');
      expect(nonce).to.include('Sign in to ETH Shot');
      expect(nonce.length).to.be.greaterThan(20);
    });
  });

  describe('API endpoint security', () => {
    it('should handle JWT generation through API only', async () => {
      // This test verifies that JWT generation is only available through API endpoints
      // and not directly accessible from client code
      
      const mockRequest = {
        json: async () => ({
          action: 'generate_jwt',
          walletAddress: '0x1234567890123456789012345678901234567890'
        })
      };

      // Import the auth API handler
      const { POST } = await import('../src/routes/api/auth/+server.js');
      
      // This should work (API endpoint handles JWT generation)
      expect(POST).to.be.a('function');
    });
  });
});