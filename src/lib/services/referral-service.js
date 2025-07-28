/**
 * Referral Service
 * 
 * Pure functions for referral system operations
 * Wraps referral utilities for cleaner API
 */

import {
  processReferralOnLoad as processReferralOnLoadUtil,
  clearStoredReferralCode
} from '../utils/referral.js';
import { processReferralSignup as processReferralSignupOperation } from '../stores/game/referral-operations.js';

/**
 * Process referral code on page load
 * @returns {Promise<void>}
 */
export const processReferralOnLoad = async () => {
  return await processReferralOnLoadUtil();
};

/**
 * Process referral signup when wallet connects
 * @param {string} walletAddress - Wallet address of the new user
 * @param {Object} db - Database instance
 * @param {Function} updateGameState - Function to update game state
 * @returns {Promise<void>}
 */
export const processReferralSignup = async (walletAddress, db, updateGameState) => {
  return await processReferralSignupOperation(walletAddress, db, updateGameState);
};

/**
 * Clear stored referral code from localStorage
 * @returns {void}
 */
export const clearReferralCode = () => {
  clearStoredReferralCode();
};

/**
 * Get stored referral code from localStorage
 * @returns {string|null} Referral code or null if not found
 */
export const getStoredReferralCode = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ethshot_referral_code');
};

/**
 * Store referral code in localStorage
 * @param {string} code - Referral code to store
 * @returns {void}
 */
export const storeReferralCode = (code) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ethshot_referral_code', code);
};