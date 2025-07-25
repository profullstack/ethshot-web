/**
 * Test for referral stats formatting after database migration
 * Verifies that the formatReferralStats function correctly handles
 * the new discount-based schema instead of bonus shots
 */

import { expect } from 'chai';
import { formatReferralStats } from '../src/lib/utils/referral.js';

describe('formatReferralStats', () => {
  describe('with new discount-based database schema', () => {
    it('should correctly format stats with referral code', () => {
      const mockDbResponse = {
        referral_code: 'ABC12345',
        total_referrals: 5,
        successful_referrals: 3,
        available_discounts: 2,
        total_discounts_earned: 8,
        referred_by: '0x1234567890abcdef1234567890abcdef12345678'
      };

      const result = formatReferralStats(mockDbResponse);

      expect(result).to.deep.equal({
        referralCode: 'ABC12345',
        totalReferrals: 5,
        successfulReferrals: 3,
        availableDiscounts: 2,
        totalDiscountsEarned: 8,
        referredBy: '0x1234567890abcdef1234567890abcdef12345678',
        successRate: 60 // 3/5 * 100
      });
    });

    it('should handle null/undefined stats gracefully', () => {
      const result = formatReferralStats(null);

      expect(result).to.deep.equal({
        referralCode: null,
        totalReferrals: 0,
        successfulReferrals: 0,
        availableDiscounts: 0,
        totalDiscountsEarned: 0,
        referredBy: null,
        successRate: 0
      });
    });

    it('should handle missing fields with defaults', () => {
      const mockDbResponse = {
        referral_code: 'XYZ98765'
        // Missing other fields
      };

      const result = formatReferralStats(mockDbResponse);

      expect(result).to.deep.equal({
        referralCode: 'XYZ98765',
        totalReferrals: 0,
        successfulReferrals: 0,
        availableDiscounts: 0,
        totalDiscountsEarned: 0,
        referredBy: null,
        successRate: 0
      });
    });

    it('should calculate success rate correctly', () => {
      const mockDbResponse = {
        referral_code: 'TEST1234',
        total_referrals: 10,
        successful_referrals: 7,
        available_discounts: 3,
        total_discounts_earned: 15
      };

      const result = formatReferralStats(mockDbResponse);

      expect(result.successRate).to.equal(70); // 7/10 * 100
    });

    it('should handle zero referrals without division by zero', () => {
      const mockDbResponse = {
        referral_code: 'ZERO0000',
        total_referrals: 0,
        successful_referrals: 0,
        available_discounts: 0,
        total_discounts_earned: 0
      };

      const result = formatReferralStats(mockDbResponse);

      expect(result.successRate).to.equal(0);
    });
  });

  describe('referral code widget visibility logic', () => {
    it('should show referral code widget when referralCode exists', () => {
      const mockDbResponse = {
        referral_code: 'SHOW1234',
        total_referrals: 0,
        successful_referrals: 0,
        available_discounts: 0,
        total_discounts_earned: 0
      };

      const result = formatReferralStats(mockDbResponse);

      // This is the key condition that determines if the referral code widget shows
      expect(result.referralCode).to.not.be.null;
      expect(result.referralCode).to.equal('SHOW1234');
    });

    it('should not show referral code widget when referralCode is null', () => {
      const mockDbResponse = {
        referral_code: null,
        total_referrals: 0,
        successful_referrals: 0,
        available_discounts: 0,
        total_discounts_earned: 0
      };

      const result = formatReferralStats(mockDbResponse);

      // This condition would hide the referral code widget
      expect(result.referralCode).to.be.null;
    });
  });
});