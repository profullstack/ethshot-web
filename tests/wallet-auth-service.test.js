// tests/wallet-auth-service.test.js (Mocha with Chai)
import { expect } from 'chai';
import { ethers } from 'ethers';
import sinon from 'sinon';
import {
  generateAuthNonce,
  verifyAndAuthenticate,
  validateAuthToken,
  refreshAuthToken
} from '../src/lib/services/wallet-auth-service.js';

describe('Wallet Authentication Service', () => {
  let wallet;
  let walletAddress;
  let supabaseStub;
  
  before(() => {
    // Set test JWT secret for testing
    process.env.SUPABASE_JWT_SECRET = 'test-secret-key-for-jwt-testing-only-not-for-production';
    
    // Create a test wallet for signing
    wallet = ethers.Wallet.createRandom();
    walletAddress = wallet.address;
  });
  
  beforeEach(() => {
    // Create Supabase mock
    supabaseStub = {
      from: sinon.stub().returnsThis(),
      upsert: sinon.stub().returnsThis(),
      select: sinon.stub().returnsThis(),
      eq: sinon.stub().returnsThis(),
      single: sinon.stub().returnsThis(),
      update: sinon.stub().returnsThis()
    };
  });
  
  after(() => {
    // Clean up test environment
    delete process.env.SUPABASE_JWT_SECRET;
  });

  describe('generateAuthNonce', () => {
    it('should generate nonce for valid wallet address', async () => {
      // Mock successful database upsert
      supabaseStub.upsert.resolves({ error: null });
      
      // Mock the supabase import
      const originalSupabase = await import('../src/lib/database/client.js');
      sinon.stub(originalSupabase, 'supabase').value(supabaseStub);
      
      const result = await generateAuthNonce(walletAddress);
      
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.nonce).to.be.a('string');
      expect(result.message).to.be.a('string');
      expect(result.walletAddress).to.equal(ethers.getAddress(walletAddress));
      expect(result.message).to.include(result.nonce);
      expect(result.message).to.include(walletAddress.toLowerCase());
      
      // Restore stub
      originalSupabase.supabase.restore();
    });

    it('should reject invalid wallet address', async () => {
      const invalidAddress = '0xinvalid';
      
      try {
        await generateAuthNonce(invalidAddress);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid wallet address');
      }
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      supabaseStub.upsert.resolves({ error: { message: 'Database error' } });
      
      const originalSupabase = await import('../src/lib/database/client.js');
      sinon.stub(originalSupabase, 'supabase').value(supabaseStub);
      
      try {
        await generateAuthNonce(walletAddress);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to generate authentication nonce');
      }
      
      originalSupabase.supabase.restore();
    });
  });

  describe('verifyAndAuthenticate', () => {
    it('should authenticate with valid signature', async () => {
      const nonce = 'test-nonce-' + Date.now();
      const message = `${nonce}\n\nWallet: ${walletAddress.toLowerCase()}`;
      const signature = await wallet.signMessage(message);
      
      // Mock database responses
      supabaseStub.select.onFirstCall().resolves({
        data: { nonce },
        error: null
      });
      supabaseStub.update.resolves({ error: null });
      
      const originalSupabase = await import('../src/lib/database/client.js');
      sinon.stub(originalSupabase, 'supabase').value(supabaseStub);
      
      const result = await verifyAndAuthenticate(walletAddress, signature);
      
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.jwtToken).to.be.a('string');
      expect(result.walletAddress).to.equal(ethers.getAddress(walletAddress));
      expect(result.message).to.equal('Authentication successful');
      
      originalSupabase.supabase.restore();
    });

    it('should reject invalid signature', async () => {
      const nonce = 'test-nonce-' + Date.now();
      const invalidSignature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b';
      
      // Mock database response
      supabaseStub.select.resolves({
        data: { nonce },
        error: null
      });
      
      const originalSupabase = await import('../src/lib/database/client.js');
      sinon.stub(originalSupabase, 'supabase').value(supabaseStub);
      
      try {
        await verifyAndAuthenticate(walletAddress, invalidSignature);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid signature');
      }
      
      originalSupabase.supabase.restore();
    });

    it('should handle missing nonce', async () => {
      const signature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b';
      
      // Mock database response with no data
      supabaseStub.select.resolves({
        data: null,
        error: { message: 'No rows returned' }
      });
      
      const originalSupabase = await import('../src/lib/database/client.js');
      sinon.stub(originalSupabase, 'supabase').value(supabaseStub);
      
      try {
        await verifyAndAuthenticate(walletAddress, signature);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('No authentication nonce found');
      }
      
      originalSupabase.supabase.restore();
    });

    it('should require both wallet address and signature', async () => {
      try {
        await verifyAndAuthenticate('', 'signature');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Wallet address and signature are required');
      }

      try {
        await verifyAndAuthenticate(walletAddress, '');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Wallet address and signature are required');
      }
    });
  });

  describe('validateAuthToken', () => {
    it('should validate valid JWT token', async () => {
      // First generate a valid token
      const { generateJWT } = await import('../src/lib/utils/jwt-wallet-auth.js');
      const token = generateJWT(walletAddress);
      
      // Mock database response
      supabaseStub.select.resolves({
        data: {
          wallet_address: ethers.getAddress(walletAddress),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: { test: 'data' }
        },
        error: null
      });
      
      const originalSupabase = await import('../src/lib/database/client.js');
      sinon.stub(originalSupabase, 'supabase').value(supabaseStub);
      
      const result = await validateAuthToken(token);
      
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.user).to.be.an('object');
      expect(result.user.walletAddress).to.equal(ethers.getAddress(walletAddress));
      expect(result.tokenPayload).to.be.an('object');
      expect(result.tokenPayload.walletAddress).to.equal(walletAddress.toLowerCase());
      
      originalSupabase.supabase.restore();
    });

    it('should reject invalid JWT token', async () => {
      const invalidToken = 'invalid.jwt.token';
      
      try {
        await validateAuthToken(invalidToken);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Token validation failed');
      }
    });

    it('should require JWT token', async () => {
      try {
        await validateAuthToken('');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Token validation failed');
      }
    });
  });

  describe('refreshAuthToken', () => {
    it('should refresh valid token', async () => {
      // Generate initial token
      const { generateJWT } = await import('../src/lib/utils/jwt-wallet-auth.js');
      const currentToken = generateJWT(walletAddress);
      
      // Mock database response for validation
      supabaseStub.select.resolves({
        data: {
          wallet_address: ethers.getAddress(walletAddress),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {}
        },
        error: null
      });
      
      const originalSupabase = await import('../src/lib/database/client.js');
      sinon.stub(originalSupabase, 'supabase').value(supabaseStub);
      
      const result = await refreshAuthToken(currentToken);
      
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.jwtToken).to.be.a('string');
      expect(result.jwtToken).to.not.equal(currentToken); // Should be a new token
      expect(result.walletAddress).to.equal(ethers.getAddress(walletAddress));
      expect(result.message).to.equal('Token refreshed successfully');
      
      originalSupabase.supabase.restore();
    });

    it('should reject invalid current token', async () => {
      const invalidToken = 'invalid.jwt.token';
      
      try {
        await refreshAuthToken(invalidToken);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Token refresh failed');
      }
    });
  });

  describe('Integration test', () => {
    it('should complete full authentication flow', async () => {
      // Mock all database operations
      supabaseStub.upsert.resolves({ error: null });
      supabaseStub.select.onFirstCall().resolves({
        data: { nonce: 'test-nonce-integration' },
        error: null
      });
      supabaseStub.select.onSecondCall().resolves({
        data: {
          wallet_address: ethers.getAddress(walletAddress),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {}
        },
        error: null
      });
      supabaseStub.update.resolves({ error: null });
      
      const originalSupabase = await import('../src/lib/database/client.js');
      sinon.stub(originalSupabase, 'supabase').value(supabaseStub);
      
      // 1. Generate nonce
      const nonceResult = await generateAuthNonce(walletAddress);
      expect(nonceResult.success).to.be.true;
      
      // 2. Sign message
      const signature = await wallet.signMessage(nonceResult.message);
      
      // 3. Authenticate
      const authResult = await verifyAndAuthenticate(walletAddress, signature);
      expect(authResult.success).to.be.true;
      expect(authResult.jwtToken).to.be.a('string');
      
      // 4. Validate token
      const validationResult = await validateAuthToken(authResult.jwtToken);
      expect(validationResult.success).to.be.true;
      expect(validationResult.user.walletAddress).to.equal(ethers.getAddress(walletAddress));
      
      // 5. Refresh token
      const refreshResult = await refreshAuthToken(authResult.jwtToken);
      expect(refreshResult.success).to.be.true;
      expect(refreshResult.jwtToken).to.not.equal(authResult.jwtToken);
      
      originalSupabase.supabase.restore();
    });
  });
});