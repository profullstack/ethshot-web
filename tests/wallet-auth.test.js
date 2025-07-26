/**
 * Wallet Authentication Tests
 * 
 * Tests for the wallet-based Supabase authentication system
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { authenticateWithWallet, signOutFromSupabase, getCurrentSession, isAuthenticated } from '../src/lib/utils/wallet-auth.js';

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
});