/**
 * Password Generation Tests
 * 
 * Standalone tests for the generateSecurePassword function
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { createHash } from 'crypto';

/**
 * Generate a secure password from wallet signature that stays under 72 characters
 * Uses SHA-256 hash to create a deterministic but secure password
 * @param {string} signature - The wallet signature
 * @param {string} walletAddress - The wallet address
 * @param {number} timestamp - The timestamp used in the message
 * @returns {string} A 64-character SHA-256 hash suitable for Supabase password
 */
function generateSecurePassword(signature, walletAddress, timestamp) {
  // Handle null/undefined inputs gracefully
  const safeSignature = signature || '';
  const safeWalletAddress = walletAddress || '';
  const safeTimestamp = timestamp || 0;
  
  // Combine signature, wallet address, and timestamp for uniqueness
  const combinedData = `${safeSignature}:${safeWalletAddress.toLowerCase()}:${safeTimestamp}`;
  
  // Create SHA-256 hash (64 characters, well under 72 limit)
  return createHash('sha256').update(combinedData).digest('hex');
}

describe('Password Generation', () => {
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

    it('should demonstrate the password length issue with raw signatures', () => {
      // This test shows why we need the hash - raw signatures are too long
      const longSignature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      
      // Raw signature is too long for Supabase (132 characters > 72 limit)
      expect(longSignature.length).to.be.greaterThan(72);
      
      // But our hashed password is safe
      const hashedPassword = generateSecurePassword(longSignature, '0x123', Date.now());
      expect(hashedPassword.length).to.be.lessThan(72);
      expect(hashedPassword.length).to.equal(64); // SHA-256 hex is always 64 chars
    });
  });
});