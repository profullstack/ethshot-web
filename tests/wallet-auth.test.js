/**
 * Wallet Authentication Tests
 * 
 * Tests for the wallet-based Supabase authentication system
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { authenticateWithWallet, signOutFromSupabase, getCurrentSession, isAuthenticated, generateSecurePassword } from '../src/lib/utils/wallet-auth.js';
import { createHash } from 'crypto';

describe('Wallet Authentication', () => {
  const testWalletAddress = '0x1234567890123456789012345678901234567890';

  afterEach(async () => {
    // Clean up after each test
    try {
      await signOutFromSupabase();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('authenticateWithWallet', () => {
    it('should require a wallet address', async () => {
      try {
        await authenticateWithWallet();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Wallet address is required');
      }
    });

    it('should require a non-empty wallet address', async () => {
      try {
        await authenticateWithWallet('');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Wallet address is required');
      }
    });

    it('should require a signer for signature verification', async () => {
      try {
        await authenticateWithWallet(testWalletAddress);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Wallet signer is required for authentication');
      }
    });

    it('should require both wallet address and signer', async () => {
      const mockSigner = { signMessage: () => Promise.resolve('0xsignature') };
      
      try {
        await authenticateWithWallet(testWalletAddress, mockSigner);
      } catch (error) {
        // Expected to fail in test environment without Supabase
        expect(error.message).to.include('Supabase not configured');
      }
    });

    it('should handle signature rejection gracefully', async () => {
      const mockSigner = {
        signMessage: () => Promise.reject(new Error('User rejected the request'))
      };
      
      try {
        await authenticateWithWallet(testWalletAddress, mockSigner);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Wallet signature was rejected');
      }
    });
  });

  describe('signOutFromSupabase', () => {
    it('should handle sign out gracefully when not configured', async () => {
      // Should not throw an error even when Supabase is not configured
      await signOutFromSupabase();
    });
  });

  describe('getCurrentSession', () => {
    it('should return null when Supabase is not configured', async () => {
      const session = await getCurrentSession();
      expect(session).to.be.null;
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when not authenticated', async () => {
      const authenticated = await isAuthenticated();
      expect(authenticated).to.be.false;
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate a password under 72 characters', () => {
      const signature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const timestamp = Date.now();
      
      const password = generateSecurePassword(signature, walletAddress, timestamp);
      
      expect(password).to.be.a('string');
      expect(password.length).to.be.lessThan(72);
      expect(password.length).to.be.greaterThan(0);
    });

    it('should generate consistent passwords for same inputs', () => {
      const signature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const timestamp = 1643723400000;
      
      const password1 = generateSecurePassword(signature, walletAddress, timestamp);
      const password2 = generateSecurePassword(signature, walletAddress, timestamp);
      
      expect(password1).to.equal(password2);
    });

    it('should generate different passwords for different signatures', () => {
      const signature1 = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      const signature2 = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const timestamp = Date.now();
      
      const password1 = generateSecurePassword(signature1, walletAddress, timestamp);
      const password2 = generateSecurePassword(signature2, walletAddress, timestamp);
      
      expect(password1).to.not.equal(password2);
    });

    it('should generate different passwords for different wallet addresses', () => {
      const signature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      const walletAddress1 = '0x1234567890123456789012345678901234567890';
      const walletAddress2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef';
      const timestamp = Date.now();
      
      const password1 = generateSecurePassword(signature, walletAddress1, timestamp);
      const password2 = generateSecurePassword(signature, walletAddress2, timestamp);
      
      expect(password1).to.not.equal(password2);
    });

    it('should generate different passwords for different timestamps', () => {
      const signature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const timestamp1 = 1643723400000;
      const timestamp2 = 1643723500000;
      
      const password1 = generateSecurePassword(signature, walletAddress, timestamp1);
      const password2 = generateSecurePassword(signature, walletAddress, timestamp2);
      
      expect(password1).to.not.equal(password2);
    });

    it('should handle empty or null inputs gracefully', () => {
      expect(() => generateSecurePassword('', '', 0)).to.not.throw();
      expect(() => generateSecurePassword(null, null, null)).to.not.throw();
      expect(() => generateSecurePassword(undefined, undefined, undefined)).to.not.throw();
    });

    it('should produce a valid SHA-256 hash format', () => {
      const signature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const timestamp = Date.now();
      
      const password = generateSecurePassword(signature, walletAddress, timestamp);
      
      // SHA-256 hash should be 64 characters long (hex)
      expect(password).to.match(/^[a-f0-9]{64}$/);
    });
  });
});