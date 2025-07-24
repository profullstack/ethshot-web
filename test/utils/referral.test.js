/**
 * Referral Utility Tests
 * 
 * Tests for referral code generation, validation, and URL management
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import {
  generateReferralURL,
  getReferralCodeFromURL,
  storeReferralCode,
  getStoredReferralCode,
  clearStoredReferralCode,
  isValidReferralCodeFormat,
  generateReferralShareText,
  formatReferralStats,
  getReferralAchievement
} from '../../src/lib/utils/referral.js';

// Mock browser environment
global.window = {
  location: {
    search: '?ref=ABC12345'
  },
  history: {
    replaceState: () => {}
  },
  open: () => {}
};

global.localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  }
};

global.navigator = {
  clipboard: {
    writeText: async (text) => {
      return Promise.resolve();
    }
  },
  share: async (data) => {
    return Promise.resolve();
  }
};

describe('Referral Utility Functions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('generateReferralURL', () => {
    it('should generate a valid referral URL with code', () => {
      const code = 'ABC12345';
      const url = generateReferralURL(code);
      
      expect(url).to.be.a('string');
      expect(url).to.include('?ref=ABC12345');
      expect(url).to.match(/^https?:\/\/.+/);
    });

    it('should handle different referral codes', () => {
      const codes = ['TEST1234', 'XYZ98765', 'BONUS123'];
      
      codes.forEach(code => {
        const url = generateReferralURL(code);
        expect(url).to.include(`?ref=${code}`);
      });
    });
  });

  describe('getReferralCodeFromURL', () => {
    it('should extract valid referral code from URL', () => {
      // Mock URL with referral code
      global.window.location.search = '?ref=ABC12345';
      
      const code = getReferralCodeFromURL();
      expect(code).to.equal('ABC12345');
    });

    it('should return null for invalid referral code format', () => {
      global.window.location.search = '?ref=invalid';
      
      const code = getReferralCodeFromURL();
      expect(code).to.be.null;
    });

    it('should return null when no referral code in URL', () => {
      global.window.location.search = '?other=param';
      
      const code = getReferralCodeFromURL();
      expect(code).to.be.null;
    });

    it('should handle empty search params', () => {
      global.window.location.search = '';
      
      const code = getReferralCodeFromURL();
      expect(code).to.be.null;
    });
  });

  describe('storeReferralCode and getStoredReferralCode', () => {
    it('should store and retrieve referral code', () => {
      const code = 'TEST1234';
      
      storeReferralCode(code);
      const retrieved = getStoredReferralCode();
      
      expect(retrieved).to.equal(code);
    });

    it('should return null for expired referral code', () => {
      const code = 'TEST1234';
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      
      localStorage.setItem('ethshot_referral_code', code);
      localStorage.setItem('ethshot_referral_timestamp', expiredTimestamp.toString());
      
      const retrieved = getStoredReferralCode();
      expect(retrieved).to.be.null;
    });

    it('should clear expired referral code automatically', () => {
      const code = 'TEST1234';
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      
      localStorage.setItem('ethshot_referral_code', code);
      localStorage.setItem('ethshot_referral_timestamp', expiredTimestamp.toString());
      
      getStoredReferralCode();
      
      expect(localStorage.getItem('ethshot_referral_code')).to.be.null;
      expect(localStorage.getItem('ethshot_referral_timestamp')).to.be.null;
    });
  });

  describe('clearStoredReferralCode', () => {
    it('should clear stored referral code', () => {
      const code = 'TEST1234';
      
      storeReferralCode(code);
      expect(getStoredReferralCode()).to.equal(code);
      
      clearStoredReferralCode();
      expect(getStoredReferralCode()).to.be.null;
    });
  });

  describe('isValidReferralCodeFormat', () => {
    it('should validate correct referral code format', () => {
      const validCodes = ['ABC12345', 'XYZ98765', '12345678', 'TESTCODE'];
      
      validCodes.forEach(code => {
        expect(isValidReferralCodeFormat(code)).to.be.true;
      });
    });

    it('should reject invalid referral code formats', () => {
      const invalidCodes = [
        'abc12345', // lowercase
        'ABC1234',  // too short
        'ABC123456', // too long
        'ABC-1234', // special characters
        'ABC 1234', // spaces
        '',         // empty
        null,       // null
        undefined,  // undefined
        123         // number
      ];
      
      invalidCodes.forEach(code => {
        expect(isValidReferralCodeFormat(code)).to.be.false;
      });
    });
  });

  describe('generateReferralShareText', () => {
    it('should generate share text with referral code', () => {
      const code = 'ABC12345';
      const text = generateReferralShareText(code);
      
      expect(text).to.be.a('string');
      expect(text).to.include(code);
      expect(text).to.include('ETH Shot');
      expect(text).to.include('FREE bonus shot');
    });

    it('should include pot amount when provided', () => {
      const code = 'ABC12345';
      const pot = '2.5';
      const text = generateReferralShareText(code, pot);
      
      expect(text).to.include('2.5 ETH');
      expect(text).to.include(code);
    });

    it('should handle null pot amount', () => {
      const code = 'ABC12345';
      const text = generateReferralShareText(code, null);
      
      expect(text).to.include('jackpot is growing');
      expect(text).to.include(code);
    });
  });

  describe('formatReferralStats', () => {
    it('should format referral stats correctly', () => {
      const rawStats = {
        referral_code: 'ABC12345',
        total_referrals: 10,
        successful_referrals: 8,
        bonus_shots_available: 3,
        total_bonus_shots_earned: 15,
        referred_by: '0x123...abc'
      };
      
      const formatted = formatReferralStats(rawStats);
      
      expect(formatted).to.deep.equal({
        referralCode: 'ABC12345',
        totalReferrals: 10,
        successfulReferrals: 8,
        bonusShotsAvailable: 3,
        totalBonusShotsEarned: 15,
        referredBy: '0x123...abc',
        successRate: 80
      });
    });

    it('should handle null stats', () => {
      const formatted = formatReferralStats(null);
      
      expect(formatted).to.deep.equal({
        referralCode: null,
        totalReferrals: 0,
        successfulReferrals: 0,
        bonusShotsAvailable: 0,
        totalBonusShotsEarned: 0,
        referredBy: null,
        successRate: 0
      });
    });

    it('should calculate success rate correctly', () => {
      const stats1 = { total_referrals: 10, successful_referrals: 5 };
      const formatted1 = formatReferralStats(stats1);
      expect(formatted1.successRate).to.equal(50);
      
      const stats2 = { total_referrals: 0, successful_referrals: 0 };
      const formatted2 = formatReferralStats(stats2);
      expect(formatted2.successRate).to.equal(0);
    });
  });

  describe('getReferralAchievement', () => {
    it('should return achievement messages for milestones', () => {
      const achievements = {
        1: "🎉 First Referral! You're spreading the word!",
        5: "🔥 5 Referrals! You're on fire!",
        10: "⭐ 10 Referrals! Superstar status!",
        25: "💎 25 Referrals! Diamond referrer!",
        50: "👑 50 Referrals! Referral royalty!",
        100: "🚀 100 Referrals! To the moon!"
      };
      
      Object.entries(achievements).forEach(([count, message]) => {
        expect(getReferralAchievement(parseInt(count))).to.equal(message);
      });
    });

    it('should return null for non-milestone counts', () => {
      const nonMilestones = [0, 2, 3, 4, 6, 7, 8, 9, 11, 15, 20, 30, 75, 150];
      
      nonMilestones.forEach(count => {
        expect(getReferralAchievement(count)).to.be.null;
      });
    });
  });
});