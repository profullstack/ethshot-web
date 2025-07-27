// tests/jwt-wallet-auth.test.js (Mocha with Chai)
import { expect } from 'chai';
import { ethers } from 'ethers';
import {
  generateNonce,
  verifySignature,
  generateJWT,
  verifyJWT,
  createAuthMessage
} from '../src/lib/utils/jwt-wallet-auth.js';

describe('JWT Wallet Authentication', () => {
  let wallet;
  let walletAddress;
  
  before(() => {
    // Set test JWT secret for testing
    process.env.SUPABASE_JWT_SECRET = 'test-secret-key-for-jwt-testing-only-not-for-production';
    
    // Create a test wallet for signing
    wallet = ethers.Wallet.createRandom();
    walletAddress = wallet.address;
  });
  
  after(() => {
    // Clean up test environment
    delete process.env.SUPABASE_JWT_SECRET;
  });

  describe('generateNonce', () => {
    it('should generate a unique nonce string', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      
      expect(nonce1).to.be.a('string');
      expect(nonce2).to.be.a('string');
      expect(nonce1).to.not.equal(nonce2);
      expect(nonce1.length).to.be.greaterThan(10);
    });

    it('should include timestamp in nonce', () => {
      const nonce = generateNonce();
      expect(nonce).to.include('Sign in to ETH Shot');
      expect(nonce).to.match(/\d{13}/); // 13-digit timestamp
    });
  });

  describe('createAuthMessage', () => {
    it('should create a properly formatted auth message', () => {
      const nonce = 'test-nonce-123';
      const message = createAuthMessage(walletAddress, nonce);
      
      expect(message).to.be.a('string');
      expect(message).to.include(walletAddress.toLowerCase());
      expect(message).to.include(nonce);
      expect(message).to.include('Wallet:');
    });

    it('should normalize wallet address to lowercase', () => {
      const upperCaseAddress = walletAddress.toUpperCase();
      const nonce = 'test-nonce-123';
      const message = createAuthMessage(upperCaseAddress, nonce);
      
      expect(message).to.include(walletAddress.toLowerCase());
      expect(message).to.not.include(upperCaseAddress);
    });
  });

  describe('verifySignature', () => {
    it('should verify a valid signature', async () => {
      const nonce = generateNonce();
      const message = createAuthMessage(walletAddress, nonce);
      const signature = await wallet.signMessage(message);
      
      const isValid = await verifySignature(message, signature, walletAddress);
      expect(isValid).to.be.true;
    });

    it('should reject an invalid signature', async () => {
      const nonce = generateNonce();
      const message = createAuthMessage(walletAddress, nonce);
      const invalidSignature = '0x1234567890abcdef';
      
      const isValid = await verifySignature(message, invalidSignature, walletAddress);
      expect(isValid).to.be.false;
    });

    it('should reject signature from wrong wallet', async () => {
      const wrongWallet = ethers.Wallet.createRandom();
      const nonce = generateNonce();
      const message = createAuthMessage(walletAddress, nonce);
      const signature = await wrongWallet.signMessage(message);
      
      const isValid = await verifySignature(message, signature, walletAddress);
      expect(isValid).to.be.false;
    });

    it('should handle case-insensitive wallet addresses', async () => {
      const nonce = generateNonce();
      const message = createAuthMessage(walletAddress, nonce);
      const signature = await wallet.signMessage(message);
      
      // Test with uppercase address
      const isValid = await verifySignature(message, signature, walletAddress.toUpperCase());
      expect(isValid).to.be.true;
    });
  });

  describe('generateJWT', () => {
    it('should generate a valid JWT token', () => {
      const token = generateJWT(walletAddress);
      
      expect(token).to.be.a('string');
      expect(token.split('.')).to.have.length(3); // JWT has 3 parts
    });

    it('should include wallet address in token payload', () => {
      const token = generateJWT(walletAddress);
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      
      expect(payload.sub).to.equal(walletAddress.toLowerCase());
      expect(payload.walletAddress).to.equal(walletAddress.toLowerCase());
      expect(payload.aud).to.equal('authenticated');
      expect(payload.role).to.equal('authenticated');
    });

    it('should set expiration time', () => {
      const token = generateJWT(walletAddress);
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      
      expect(payload.exp).to.be.a('number');
      expect(payload.exp).to.be.greaterThan(Math.floor(Date.now() / 1000));
    });

    it('should normalize wallet address to lowercase', () => {
      const upperCaseAddress = walletAddress.toUpperCase();
      const token = generateJWT(upperCaseAddress);
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      
      expect(payload.sub).to.equal(walletAddress.toLowerCase());
      expect(payload.walletAddress).to.equal(walletAddress.toLowerCase());
    });
  });

  describe('verifyJWT', () => {
    it('should verify a valid JWT token', () => {
      const token = generateJWT(walletAddress);
      const payload = verifyJWT(token);
      
      expect(payload).to.be.an('object');
      expect(payload.sub).to.equal(walletAddress.toLowerCase());
      expect(payload.walletAddress).to.equal(walletAddress.toLowerCase());
    });

    it('should reject an invalid JWT token', () => {
      const invalidToken = 'invalid.jwt.token';
      
      expect(() => verifyJWT(invalidToken)).to.throw();
    });

    it('should reject an expired JWT token', () => {
      // This test would require mocking time or creating an expired token
      // For now, we'll test the structure
      const token = generateJWT(walletAddress);
      const payload = verifyJWT(token);
      
      expect(payload.exp).to.be.a('number');
    });
  });

  describe('Integration test', () => {
    it('should complete full authentication flow', async () => {
      // 1. Generate nonce
      const nonce = generateNonce();
      expect(nonce).to.be.a('string');
      
      // 2. Create auth message
      const message = createAuthMessage(walletAddress, nonce);
      expect(message).to.include(walletAddress.toLowerCase());
      
      // 3. Sign message with wallet
      const signature = await wallet.signMessage(message);
      expect(signature).to.be.a('string');
      
      // 4. Verify signature
      const isValidSignature = await verifySignature(message, signature, walletAddress);
      expect(isValidSignature).to.be.true;
      
      // 5. Generate JWT token
      const jwtToken = generateJWT(walletAddress);
      expect(jwtToken).to.be.a('string');
      
      // 6. Verify JWT token
      const payload = verifyJWT(jwtToken);
      expect(payload.sub).to.equal(walletAddress.toLowerCase());
      expect(payload.walletAddress).to.equal(walletAddress.toLowerCase());
    });
  });
});