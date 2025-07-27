/**
 * Core JWT Wallet Authentication Test
 * 
 * Tests the core JWT-based wallet authentication utilities without Svelte dependencies.
 * This validates the authentication flow as specified in your requirements.
 */

import { expect } from 'chai';
import { ethers } from 'ethers';
import {
  generateNonce,
  createAuthMessage,
  verifySignature,
  generateJWT,
  verifyJWT,
  getChecksumAddress,
  isValidWalletAddress,
  extractWalletFromJWT,
  isJWTExpired
} from '../src/lib/utils/jwt-wallet-auth.js';

// Mock environment variables for testing
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-key-for-testing-only-do-not-use-in-production';

describe('Core JWT Wallet Authentication', () => {
  let testWallet;
  let testWalletAddress;
  let testSigner;

  before(async () => {
    // Create a test wallet for signing
    testWallet = ethers.Wallet.createRandom();
    testWalletAddress = testWallet.address;
    testSigner = testWallet;
    
    console.log('🧪 Test wallet created:', testWalletAddress);
  });

  describe('Step 1: Wallet Address Validation', () => {
    it('should validate wallet address format', () => {
      expect(isValidWalletAddress(testWalletAddress)).to.be.true;
      expect(isValidWalletAddress('invalid-address')).to.be.false;
      expect(isValidWalletAddress('')).to.be.false;
      expect(isValidWalletAddress(null)).to.be.false;
    });

    it('should generate checksummed address', () => {
      const checksummed = getChecksumAddress(testWalletAddress.toLowerCase());
      expect(checksummed).to.equal(testWalletAddress);
      expect(ethers.isAddress(checksummed)).to.be.true;
    });
  });

  describe('Step 2: Nonce Generation and Message Creation', () => {
    it('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      
      expect(nonce1).to.be.a('string');
      expect(nonce2).to.be.a('string');
      expect(nonce1).to.not.equal(nonce2);
      expect(nonce1).to.include('Sign in to ETH Shot');
      expect(nonce1).to.include(Date.now().toString().substring(0, 10)); // Check timestamp prefix
    });

    it('should create proper authentication message', () => {
      const nonce = generateNonce();
      const message = createAuthMessage(testWalletAddress, nonce);
      
      expect(message).to.include(nonce);
      expect(message).to.include(testWalletAddress.toLowerCase());
      expect(message).to.include('Wallet:');
    });

    it('should prevent replay attacks with unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      
      // Nonces should be different to prevent replay attacks
      expect(nonce1).to.not.equal(nonce2);
      
      // Each nonce should include timestamp for freshness
      const timestamp1 = parseInt(nonce1.match(/\d{13}/)?.[0] || '0');
      const timestamp2 = parseInt(nonce2.match(/\d{13}/)?.[0] || '0');
      
      expect(timestamp2).to.be.at.least(timestamp1);
    });
  });

  describe('Step 3: Signature Verification', () => {
    it('should verify valid wallet signatures', async () => {
      const nonce = generateNonce();
      const message = createAuthMessage(testWalletAddress, nonce);
      const signature = await testSigner.signMessage(message);
      
      const isValid = await verifySignature(message, signature, testWalletAddress);
      expect(isValid).to.be.true;
    });

    it('should reject invalid signatures', async () => {
      const nonce = generateNonce();
      const message = createAuthMessage(testWalletAddress, nonce);
      const wrongMessage = createAuthMessage(testWalletAddress, 'wrong-nonce');
      const signature = await testSigner.signMessage(wrongMessage);
      
      const isValid = await verifySignature(message, signature, testWalletAddress);
      expect(isValid).to.be.false;
    });

    it('should reject signatures from wrong wallet', async () => {
      const wrongWallet = ethers.Wallet.createRandom();
      const nonce = generateNonce();
      const message = createAuthMessage(testWalletAddress, nonce);
      const signature = await wrongWallet.signMessage(message);
      
      const isValid = await verifySignature(message, signature, testWalletAddress);
      expect(isValid).to.be.false;
    });

    it('should handle case-insensitive address comparison', async () => {
      const nonce = generateNonce();
      const message = createAuthMessage(testWalletAddress.toLowerCase(), nonce);
      const signature = await testSigner.signMessage(message);
      
      // Should work with different case variations
      const isValidLower = await verifySignature(message, signature, testWalletAddress.toLowerCase());
      const isValidUpper = await verifySignature(message, signature, testWalletAddress.toUpperCase());
      const isValidMixed = await verifySignature(message, signature, testWalletAddress);
      
      expect(isValidLower).to.be.true;
      expect(isValidUpper).to.be.true;
      expect(isValidMixed).to.be.true;
    });
  });

  describe('Step 4: JWT Token Generation and Verification', () => {
    it('should generate valid JWT tokens', () => {
      const token = generateJWT(testWalletAddress);
      
      expect(token).to.be.a('string');
      expect(token.split('.')).to.have.length(3); // JWT has 3 parts
      
      const decoded = verifyJWT(token);
      expect(decoded.sub).to.equal(testWalletAddress.toLowerCase());
      expect(decoded.walletAddress).to.equal(testWalletAddress.toLowerCase());
      expect(decoded.aud).to.equal('authenticated');
      expect(decoded.role).to.equal('authenticated');
    });

    it('should reject invalid JWT tokens', () => {
      expect(() => verifyJWT('invalid.jwt.token')).to.throw();
      expect(() => verifyJWT('')).to.throw();
      expect(() => verifyJWT(null)).to.throw();
    });

    it('should handle token expiration', () => {
      // Generate token with very short expiry
      const shortToken = generateJWT(testWalletAddress, '1ms');
      
      // Wait a bit for token to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(() => verifyJWT(shortToken)).to.throw(/expired/i);
          resolve();
        }, 10);
      });
    });

    it('should extract wallet address from JWT without verification', () => {
      const token = generateJWT(testWalletAddress);
      const extractedWallet = extractWalletFromJWT(token);
      
      expect(extractedWallet).to.equal(testWalletAddress.toLowerCase());
    });

    it('should detect expired tokens', () => {
      const expiredToken = generateJWT(testWalletAddress, '1ms');
      
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(isJWTExpired(expiredToken)).to.be.true;
          resolve();
        }, 10);
      });
    });

    it('should detect valid tokens as not expired', () => {
      const validToken = generateJWT(testWalletAddress, '1h');
      expect(isJWTExpired(validToken)).to.be.false;
    });
  });

  describe('Step 5: JWT Claims for RLS Integration', () => {
    it('should generate JWT with correct claims for Supabase RLS', () => {
      const token = generateJWT(testWalletAddress);
      const decoded = verifyJWT(token);
      
      // Check all required claims for Supabase RLS
      expect(decoded.sub).to.equal(testWalletAddress.toLowerCase()); // Used as auth.uid()
      expect(decoded.aud).to.equal('authenticated');
      expect(decoded.role).to.equal('authenticated');
      expect(decoded.walletAddress).to.equal(testWalletAddress.toLowerCase());
      expect(decoded.iat).to.be.a('number');
      expect(decoded.exp).to.be.a('number');
      expect(decoded.exp).to.be.greaterThan(decoded.iat);
    });

    it('should normalize wallet addresses consistently for RLS', () => {
      const variations = [
        testWalletAddress.toLowerCase(),
        testWalletAddress.toUpperCase(),
        testWalletAddress
      ];
      
      const tokens = variations.map(addr => generateJWT(addr));
      const decoded = tokens.map(token => verifyJWT(token));
      
      // All tokens should have the same normalized wallet address
      const walletAddresses = decoded.map(d => d.walletAddress);
      expect(walletAddresses[0]).to.equal(walletAddresses[1]);
      expect(walletAddresses[1]).to.equal(walletAddresses[2]);
      expect(walletAddresses[0]).to.equal(testWalletAddress.toLowerCase());
      
      // All should have the same sub claim (used by RLS as auth.uid())
      const subs = decoded.map(d => d.sub);
      expect(subs[0]).to.equal(subs[1]);
      expect(subs[1]).to.equal(subs[2]);
      expect(subs[0]).to.equal(testWalletAddress.toLowerCase());
    });

    it('should generate consistent checksummed addresses', () => {
      const variations = [
        testWalletAddress.toLowerCase(),
        testWalletAddress.toUpperCase(),
        testWalletAddress
      ];
      
      const checksummed = variations.map(addr => getChecksumAddress(addr));
      
      // All should result in the same checksummed address
      expect(checksummed[0]).to.equal(checksummed[1]);
      expect(checksummed[1]).to.equal(checksummed[2]);
      expect(checksummed[0]).to.equal(testWalletAddress);
    });
  });

  describe('Step 6: Complete Authentication Flow Simulation', () => {
    it('should complete the full authentication flow', async () => {
      console.log('🔄 Starting complete authentication flow simulation...');
      
      // Step 1: Generate nonce
      const nonce = generateNonce();
      console.log('✅ Step 1: Nonce generated');
      
      // Step 2: Create authentication message
      const message = createAuthMessage(testWalletAddress, nonce);
      console.log('✅ Step 2: Authentication message created');
      
      // Step 3: Sign message with wallet
      const signature = await testSigner.signMessage(message);
      console.log('✅ Step 3: Message signed by wallet');
      
      // Step 4: Verify signature server-side
      const isValidSignature = await verifySignature(message, signature, testWalletAddress);
      expect(isValidSignature).to.be.true;
      console.log('✅ Step 4: Signature verified server-side');
      
      // Step 5: Generate JWT token
      const jwtToken = generateJWT(testWalletAddress);
      console.log('✅ Step 5: JWT token generated');
      
      // Step 6: Verify JWT token
      const decoded = verifyJWT(jwtToken);
      expect(decoded.sub).to.equal(testWalletAddress.toLowerCase());
      expect(decoded.walletAddress).to.equal(testWalletAddress.toLowerCase());
      console.log('✅ Step 6: JWT token verified');
      
      console.log('🎉 Complete authentication flow successful!');
      
      // Return the authentication result
      return {
        success: true,
        walletAddress: testWalletAddress,
        jwtToken,
        decoded,
        message: 'Authentication flow completed successfully'
      };
    });
  });

  describe('Step 7: Security Edge Cases', () => {
    it('should handle malformed JWT tokens gracefully', () => {
      expect(extractWalletFromJWT('malformed')).to.be.null;
      expect(isJWTExpired('malformed')).to.be.true;
    });

    it('should handle null/undefined inputs gracefully', () => {
      expect(extractWalletFromJWT(null)).to.be.null;
      expect(extractWalletFromJWT(undefined)).to.be.null;
      expect(isJWTExpired(null)).to.be.true;
      expect(isJWTExpired(undefined)).to.be.true;
    });

    it('should validate JWT secret requirement', () => {
      // Temporarily remove JWT secret
      const originalSecret = process.env.SUPABASE_JWT_SECRET;
      delete process.env.SUPABASE_JWT_SECRET;
      
      expect(() => generateJWT(testWalletAddress)).to.throw(/SUPABASE_JWT_SECRET is required/);
      expect(() => verifyJWT('any.jwt.token')).to.throw(/SUPABASE_JWT_SECRET is required/);
      
      // Restore JWT secret
      process.env.SUPABASE_JWT_SECRET = originalSecret;
    });
  });
});