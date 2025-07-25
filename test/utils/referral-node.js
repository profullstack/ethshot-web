/**
 * Node.js-compatible version of referral utilities for testing
 * Removes SvelteKit dependencies and browser-specific code
 */

import { SOCIAL_CONFIG } from '../../src/lib/config.js';

// Mock browser environment for testing
const mockBrowser = false;

/**
 * Generates a shareable referral URL with the given code
 * @param {string} referralCode - The referral code to include in the URL
 * @returns {string} Complete shareable URL
 */
export const generateReferralURL = (referralCode) => {
  const baseUrl = SOCIAL_CONFIG.APP_URL || 'https://ethshot.io';
  return `${baseUrl}?ref=${referralCode}`;
};

/**
 * Validates referral code format
 * @param {string} code - The referral code to validate
 * @returns {boolean} True if code format is valid
 */
export const isValidReferralCodeFormat = (code) => {
  return typeof code === 'string' && /^[A-Z0-9]{8}$/.test(code);
};

/**
 * Generates social sharing text for referral
 * @param {string} referralCode - The referral code
 * @param {string} currentPot - Current pot amount (optional)
 * @returns {string} Shareable text
 */
export const generateReferralShareText = (referralCode, currentPot = null) => {
  const potText = currentPot && currentPot !== '0' ? 
    `The current jackpot is ${currentPot} ETH!` : 
    'The jackpot is growing!';
  
  return `🎯 Join me on ETH Shot and get a 20% discount! ${potText} Use my referral code: ${referralCode} 🚀`;
};

/**
 * Gets referral statistics display data
 * @param {Object} stats - Raw stats from database
 * @returns {Object} Formatted stats for display
 */
export const formatReferralStats = (stats) => {
  if (!stats) {
    return {
      referralCode: null,
      totalReferrals: 0,
      successfulReferrals: 0,
      availableDiscounts: 0,
      totalDiscountsEarned: 0,
      referredBy: null,
      successRate: 0
    };
  }
  
  const successRate = stats.total_referrals > 0 ? 
    Math.round((stats.successful_referrals / stats.total_referrals) * 100) : 0;
  
  return {
    referralCode: stats.referral_code,
    totalReferrals: stats.total_referrals || 0,
    successfulReferrals: stats.successful_referrals || 0,
    availableDiscounts: stats.available_discounts || 0,
    totalDiscountsEarned: stats.total_discounts_earned || 0,
    referredBy: stats.referred_by,
    successRate
  };
};

/**
 * Generates referral achievement messages
 * @param {number} totalReferrals - Total number of referrals
 * @returns {string|null} Achievement message or null
 */
export const getReferralAchievement = (totalReferrals) => {
  const achievements = {
    1: "🎉 First Referral! You're spreading the word!",
    5: "🔥 5 Referrals! You're on fire!",
    10: "⭐ 10 Referrals! Superstar status!",
    25: "💎 25 Referrals! Diamond referrer!",
    50: "👑 50 Referrals! Referral royalty!",
    100: "🚀 100 Referrals! To the moon!"
  };
  
  return achievements[totalReferrals] || null;
};

// Mock functions that require browser environment
export const getReferralCodeFromURL = () => null;
export const storeReferralCode = () => {};
export const getStoredReferralCode = () => null;
export const clearStoredReferralCode = () => {};
export const copyReferralURL = async () => false;
export const shareReferralURL = async () => false;
export const shareReferralOnTwitter = () => {};
export const processReferralOnLoad = () => {};