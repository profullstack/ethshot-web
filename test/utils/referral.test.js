/**
 * Referral Utility Tests (Node.js Compatible)
 * 
 * Tests for referral code generation, validation, and URL management
 * Uses Node.js-compatible version of referral utilities
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  generateReferralURL,
  isValidReferralCodeFormat,
  generateReferralShareText,
  formatReferralStats,
  getReferralAchievement
} from './referral-node.js';

describe('Referral Utility Functions (Node.js Compatible)', () => {
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

    it('should handle zero pot amount', () => {
      const code = 'ABC12345';
      const text = generateReferralShareText(code, '0');
      
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

    it('should handle undefined stats', () => {
      const formatted = formatReferralStats(undefined);
      
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

      const stats3 = { total_referrals: 3, successful_referrals: 1 };
      const formatted3 = formatReferralStats(stats3);
      expect(formatted3.successRate).to.equal(33); // Math.round(33.33)
    });

    it('should handle missing fields gracefully', () => {
      const partialStats = {
        referral_code: 'TEST1234',
        total_referrals: 5
        // missing other fields
      };
      
      const formatted = formatReferralStats(partialStats);
      
      expect(formatted.referralCode).to.equal('TEST1234');
      expect(formatted.totalReferrals).to.equal(5);
      expect(formatted.successfulReferrals).to.equal(0);
      expect(formatted.bonusShotsAvailable).to.equal(0);
      expect(formatted.totalBonusShotsEarned).to.equal(0);
      expect(formatted.referredBy).to.be.null;
      expect(formatted.successRate).to.equal(0);
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

    it('should handle negative numbers', () => {
      expect(getReferralAchievement(-1)).to.be.null;
      expect(getReferralAchievement(-10)).to.be.null;
    });

    it('should handle non-integer numbers', () => {
      expect(getReferralAchievement(1.5)).to.be.null;
      expect(getReferralAchievement(5.9)).to.be.null;
    });
  });
});