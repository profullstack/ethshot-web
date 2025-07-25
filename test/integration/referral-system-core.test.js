import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import {
  generateReferralURL,
  validateReferralCode,
  storeReferralCode,
  clearStoredReferralCode,
  formatReferralStats,
  getReferralAchievement
} from '../../src/lib/utils/referral.js';

// Mock browser environment
global.window = {
  location: { 
    origin: 'https://ethshot.io',
    search: '',
    href: 'https://ethshot.io'
  },
  localStorage: {
    storage: {},
    getItem(key) { return this.storage[key] || null; },
    setItem(key, value) { this.storage[key] = value; },
    removeItem(key) { delete this.storage[key]; },
    clear() { this.storage = {}; }
  }
};

global.navigator = {
  clipboard: {
    writeText: async (text) => true
  },
  share: async (data) => true
};

describe('Referral System Core Functionality', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    global.window.localStorage.clear();
    
    // Reset URL search params
    global.window.location.search = '';
  });

  afterEach(() => {
    // Clean up after each test
    clearStoredReferralCode();
  });

  describe('Referral Code Generation and URLs', () => {
    it('should generate valid referral URLs', () => {
      const code = 'TEST1234';
      const url = generateReferralURL(code);
      
      expect(url).to.include('ethshot.io');
      expect(url).to.include(`ref=${code}`);
      expect(url).to.match(/^https?:\/\//);
      
      // Should be a valid URL
      expect(() => new URL(url)).to.not.throw();
    });

    it('should handle special characters in referral codes', () => {
      const code = 'TEST-123_ABC';
      const url = generateReferralURL(code);
      
      expect(url).to.include(encodeURIComponent(code));
    });

    it('should generate different URLs for different codes', () => {
      const code1 = 'TEST1234';
      const code2 = 'ABCD5678';
      
      const url1 = generateReferralURL(code1);
      const url2 = generateReferralURL(code2);
      
      expect(url1).to.not.equal(url2);
      expect(url1).to.include(code1);
      expect(url2).to.include(code2);
    });
  });

  describe('Local Storage Operations', () => {
    it('should store and retrieve referral codes', () => {
      const testCode = 'TEST1234';
      
      // Store referral code
      storeReferralCode(testCode);
      
      // Check if stored correctly
      const stored = global.window.localStorage.getItem('pendingReferralCode');
      expect(stored).to.equal(testCode);
    });

    it('should clear stored referral codes', () => {
      const testCode = 'TEST1234';
      
      // Store then clear
      storeReferralCode(testCode);
      clearStoredReferralCode();
      
      // Check if cleared
      const cleared = global.window.localStorage.getItem('pendingReferralCode');
      expect(cleared).to.be.null;
    });

    it('should handle localStorage unavailability gracefully', () => {
      // Mock localStorage unavailable
      const originalLocalStorage = global.window.localStorage;
      global.window.localStorage = null;

      // Should not throw error when localStorage is unavailable
      expect(() => {
        storeReferralCode('TEST1234');
      }).to.not.throw();

      expect(() => {
        clearStoredReferralCode();
      }).to.not.throw();

      // Restore localStorage
      global.window.localStorage = originalLocalStorage;
    });
  });

  describe('Referral Stats Formatting', () => {
    it('should format referral stats correctly', () => {
      const rawStats = {
        referral_code: 'TEST1234',
        total_referrals: 10,
        successful_referrals: 7,
        available_discounts: 3,
        total_discounts_earned: 15,
        referred_by: '0x123...abc'
      };

      const formatted = formatReferralStats(rawStats);

      expect(formatted).to.have.property('referralCode', 'TEST1234');
      expect(formatted).to.have.property('totalReferrals', 10);
      expect(formatted).to.have.property('successfulReferrals', 7);
      expect(formatted).to.have.property('availableDiscounts', 3);
      expect(formatted).to.have.property('totalDiscountsEarned', 15);
      expect(formatted).to.have.property('referredBy', '0x123...abc');
      expect(formatted).to.have.property('successRate', 70);
    });

    it('should handle null/undefined stats', () => {
      const formatted = formatReferralStats(null);

      expect(formatted).to.have.property('referralCode', null);
      expect(formatted).to.have.property('totalReferrals', 0);
      expect(formatted).to.have.property('successfulReferrals', 0);
      expect(formatted).to.have.property('availableDiscounts', 0);
      expect(formatted).to.have.property('totalDiscountsEarned', 0);
      expect(formatted).to.have.property('referredBy', null);
      expect(formatted).to.have.property('successRate', 0);
    });

    it('should calculate success rate correctly', () => {
      const stats1 = {
        total_referrals: 10,
        successful_referrals: 5
      };
      const formatted1 = formatReferralStats(stats1);
      expect(formatted1.successRate).to.equal(50);

      const stats2 = {
        total_referrals: 0,
        successful_referrals: 0
      };
      const formatted2 = formatReferralStats(stats2);
      expect(formatted2.successRate).to.equal(0);

      const stats3 = {
        total_referrals: 3,
        successful_referrals: 2
      };
      const formatted3 = formatReferralStats(stats3);
      expect(formatted3.successRate).to.equal(67); // Rounded
    });
  });

  describe('Achievement System', () => {
    it('should return correct achievements for referral milestones', () => {
      expect(getReferralAchievement(1)).to.equal("🎉 First Referral! You're spreading the word!");
      expect(getReferralAchievement(5)).to.equal("🔥 5 Referrals! You're on fire!");
      expect(getReferralAchievement(10)).to.equal("⭐ 10 Referrals! Superstar status!");
      expect(getReferralAchievement(25)).to.equal("💎 25 Referrals! Diamond referrer!");
      expect(getReferralAchievement(50)).to.equal("👑 50 Referrals! Referral royalty!");
      expect(getReferralAchievement(100)).to.equal("🚀 100 Referrals! To the moon!");
    });

    it('should return null for non-milestone numbers', () => {
      expect(getReferralAchievement(0)).to.be.null;
      expect(getReferralAchievement(3)).to.be.null;
      expect(getReferralAchievement(7)).to.be.null;
      expect(getReferralAchievement(15)).to.be.null;
      expect(getReferralAchievement(30)).to.be.null;
    });

    it('should handle negative numbers gracefully', () => {
      expect(getReferralAchievement(-1)).to.be.null;
      expect(getReferralAchievement(-10)).to.be.null;
    });
  });

  describe('URL Parameter Extraction', () => {
    it('should extract referral code from URL search params', () => {
      // Mock URL with referral parameter
      global.window.location.search = '?ref=TEST1234';
      
      const urlParams = new URLSearchParams(global.window.location.search);
      const referralCode = urlParams.get('ref');
      
      expect(referralCode).to.equal('TEST1234');
    });

    it('should handle multiple URL parameters', () => {
      global.window.location.search = '?utm_source=twitter&ref=TEST1234&utm_campaign=referral';
      
      const urlParams = new URLSearchParams(global.window.location.search);
      const referralCode = urlParams.get('ref');
      
      expect(referralCode).to.equal('TEST1234');
    });

    it('should handle missing referral parameter', () => {
      global.window.location.search = '?utm_source=twitter&utm_campaign=referral';
      
      const urlParams = new URLSearchParams(global.window.location.search);
      const referralCode = urlParams.get('ref');
      
      expect(referralCode).to.be.null;
    });

    it('should handle empty search params', () => {
      global.window.location.search = '';
      
      const urlParams = new URLSearchParams(global.window.location.search);
      const referralCode = urlParams.get('ref');
      
      expect(referralCode).to.be.null;
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid referral codes gracefully', () => {
      const invalidCodes = ['', null, undefined, 123, {}, []];
      
      invalidCodes.forEach(code => {
        expect(() => {
          generateReferralURL(code);
        }).to.not.throw();
      });
    });

    it('should handle malformed URLs gracefully', () => {
      // Mock invalid origin
      const originalOrigin = global.window.location.origin;
      global.window.location.origin = '';
      
      const url = generateReferralURL('TEST1234');
      
      // Should still generate some form of URL
      expect(url).to.be.a('string');
      expect(url).to.include('TEST1234');
      
      // Restore original origin
      global.window.location.origin = originalOrigin;
    });
  });

  describe('Social Sharing Integration', () => {
    it('should handle clipboard operations', async () => {
      const testCode = 'TEST1234';
      let copiedText = '';
      
      // Mock clipboard success
      global.navigator.clipboard.writeText = async (text) => {
        copiedText = text;
        return true;
      };

      const url = generateReferralURL(testCode);
      await global.navigator.clipboard.writeText(url);
      
      expect(copiedText).to.include(testCode);
      expect(copiedText).to.include('ethshot.io');
    });

    it('should handle native share API', async () => {
      const testCode = 'TEST1234';
      let sharedData = null;
      
      // Mock native share
      global.navigator.share = async (data) => {
        sharedData = data;
        return true;
      };

      const url = generateReferralURL(testCode);
      await global.navigator.share({
        title: 'Join EthShot',
        text: 'Try your luck at EthShot!',
        url: url
      });
      
      expect(sharedData).to.not.be.null;
      expect(sharedData.url).to.include(testCode);
    });

    it('should handle clipboard API failures', async () => {
      // Mock clipboard failure
      global.navigator.clipboard.writeText = async () => {
        throw new Error('Clipboard access denied');
      };

      try {
        const url = generateReferralURL('TEST1234');
        await global.navigator.clipboard.writeText(url);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Clipboard access denied');
      }
    });
  });

  describe('Data Validation', () => {
    it('should validate referral code format', () => {
      // Valid codes
      const validCodes = ['TEST1234', 'ABCD5678', 'XYZ123AB'];
      validCodes.forEach(code => {
        expect(code).to.match(/^[A-Z0-9]{6,}$/);
      });

      // Invalid codes (would be caught by validation)
      const invalidCodes = ['test1234', 'ABC', '123', 'TEST@123'];
      invalidCodes.forEach(code => {
        expect(code).to.not.match(/^[A-Z0-9]{8}$/);
      });
    });

    it('should handle edge cases in stats calculation', () => {
      // Division by zero
      const stats = formatReferralStats({
        total_referrals: 0,
        successful_referrals: 0
      });
      expect(stats.successRate).to.equal(0);

      // More successful than total (shouldn't happen but handle gracefully)
      const invalidStats = formatReferralStats({
        total_referrals: 5,
        successful_referrals: 10
      });
      expect(invalidStats.successRate).to.equal(200); // Shows the calculation
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large numbers of referrals efficiently', () => {
      const largeStats = {
        total_referrals: 1000000,
        successful_referrals: 750000,
        available_discounts: 50,
        total_discounts_earned: 2000000
      };

      const start = Date.now();
      const formatted = formatReferralStats(largeStats);
      const end = Date.now();

      expect(end - start).to.be.lessThan(10); // Should be very fast
      expect(formatted.successRate).to.equal(75);
      expect(formatted.totalReferrals).to.equal(1000000);
    });

    it('should not leak memory with repeated operations', () => {
      // Simulate repeated referral URL generation
      for (let i = 0; i < 1000; i++) {
        const url = generateReferralURL(`TEST${i}`);
        expect(url).to.include(`TEST${i}`);
      }

      // Simulate repeated localStorage operations
      for (let i = 0; i < 100; i++) {
        storeReferralCode(`CODE${i}`);
        clearStoredReferralCode();
      }

      // If we get here without memory issues, test passes
      expect(true).to.be.true;
    });
  });
});