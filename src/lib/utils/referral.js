/**
 * Referral System Utility
 * 
 * Handles referral code generation, validation, and URL management
 * for the viral referral system that gives bonus shots to users
 */

import { browser } from '$app/environment';
import { SOCIAL_CONFIG } from '../config.js';

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
 * Extracts referral code from current URL parameters
 * @returns {string|null} Referral code if found, null otherwise
 */
export const getReferralCodeFromURL = () => {
  if (!browser) return null;
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    
    // Validate referral code format (8 alphanumeric characters)
    if (referralCode && /^[A-Z0-9]{8}$/.test(referralCode)) {
      return referralCode;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to extract referral code from URL:', error);
    return null;
  }
};

/**
 * Stores referral code in localStorage for later processing
 * @param {string} referralCode - The referral code to store
 */
export const storeReferralCode = (referralCode) => {
  if (!browser || !referralCode) return;
  
  try {
    localStorage.setItem('ethshot_referral_code', referralCode);
    localStorage.setItem('ethshot_referral_timestamp', Date.now().toString());
    console.log('Stored referral code:', referralCode);
  } catch (error) {
    console.warn('Failed to store referral code:', error);
  }
};

/**
 * Retrieves stored referral code from localStorage
 * @returns {string|null} Stored referral code if valid, null otherwise
 */
export const getStoredReferralCode = () => {
  if (!browser) return null;
  
  try {
    const referralCode = localStorage.getItem('ethshot_referral_code');
    const timestamp = localStorage.getItem('ethshot_referral_timestamp');
    
    // Check if referral code exists and is not expired (24 hours)
    if (referralCode && timestamp) {
      const age = Date.now() - parseInt(timestamp);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (age < maxAge) {
        return referralCode;
      } else {
        // Clean up expired referral code
        clearStoredReferralCode();
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to retrieve stored referral code:', error);
    return null;
  }
};

/**
 * Clears stored referral code from localStorage
 */
export const clearStoredReferralCode = () => {
  if (!browser) return;
  
  try {
    localStorage.removeItem('ethshot_referral_code');
    localStorage.removeItem('ethshot_referral_timestamp');
    console.log('Cleared stored referral code');
  } catch (error) {
    console.warn('Failed to clear stored referral code:', error);
  }
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
  
  return `🎯 Join me on ETH Shot and get a FREE bonus shot! ${potText} Use my referral code: ${referralCode} 🚀`;
};

/**
 * Copies referral URL to clipboard
 * @param {string} referralCode - The referral code
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export const copyReferralURL = async (referralCode) => {
  if (!browser) return false;
  
  try {
    const url = generateReferralURL(referralCode);
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    console.warn('Failed to copy referral URL:', error);
    return false;
  }
};

/**
 * Shares referral URL via Web Share API (mobile)
 * @param {string} referralCode - The referral code
 * @param {string} currentPot - Current pot amount (optional)
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export const shareReferralURL = async (referralCode, currentPot = null) => {
  if (!browser || !navigator.share) return false;
  
  try {
    const url = generateReferralURL(referralCode);
    const text = generateReferralShareText(referralCode, currentPot);
    
    await navigator.share({
      title: 'ETH Shot - Get Your Free Bonus Shot!',
      text: text,
      url: url
    });
    
    return true;
  } catch (error) {
    // User cancelled or sharing not supported
    console.log('Web Share API cancelled or not supported:', error);
    return false;
  }
};

/**
 * Opens Twitter share dialog with referral content
 * @param {string} referralCode - The referral code
 * @param {string} currentPot - Current pot amount (optional)
 */
export const shareReferralOnTwitter = (referralCode, currentPot = null) => {
  if (!browser) return;
  
  const url = generateReferralURL(referralCode);
  const text = generateReferralShareText(referralCode, currentPot);
  
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  
  // Open in new window/tab
  window.open(twitterUrl, '_blank', 'width=550,height=420');
};

/**
 * Processes referral code on page load
 * Extracts from URL and stores for later use when user connects wallet
 */
export const processReferralOnLoad = () => {
  if (!browser) return;
  
  const referralCode = getReferralCodeFromURL();
  if (referralCode) {
    storeReferralCode(referralCode);
    
    // Clean up URL without refreshing page
    try {
      const url = new URL(window.location);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
    } catch (error) {
      console.warn('Failed to clean up URL:', error);
    }
  }
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
      bonusShotsAvailable: 0,
      totalBonusShotsEarned: 0,
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
    bonusShotsAvailable: stats.bonus_shots_available || 0,
    totalBonusShotsEarned: stats.total_bonus_shots_earned || 0,
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