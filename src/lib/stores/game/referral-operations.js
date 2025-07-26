/**
 * Referral Operations Module
 * 
 * Handles referral system integration within the game store
 */

import { browser } from '$app/environment';
import { toastStore } from '../toast.js';
import { clearStoredReferralCode } from '../../utils/referral.js';

/**
 * Process referral signup when wallet connects
 * @param {string} address - Wallet address
 * @param {Object} db - Database instance
 * @param {Function} updateState - State update function
 */
export const processReferralSignup = async (address, db, updateState) => {
  if (!browser || !address) return;

  try {
    // Get stored referral code from localStorage
    const storedReferralCode = localStorage.getItem('ethshot_referral_code');
    
    if (storedReferralCode) {
      console.log('🔗 Processing referral signup with code:', storedReferralCode);
      
      // Process the referral signup
      const success = await db.processReferralSignup(storedReferralCode, address);
      
      if (success) {
        console.log('✅ Referral processed successfully for:', address);
        toastStore.success('Welcome! You\'ve received a 20% discount on your next shot from your referral!');
        
        // Clear the stored referral code
        clearStoredReferralCode();
        
        // Reload discounts and referral stats after processing referral
        const [availableDiscounts, referralStats] = await Promise.all([
          db.getUserDiscounts(address),
          db.getReferralStats(address)
        ]);
        
        updateState(state => ({
          ...state,
          availableDiscounts,
          referralStats,
          referralProcessed: true
        }));
      } else {
        console.log('❌ Referral processing failed - code may be invalid or expired');
        clearStoredReferralCode();
        updateState(state => ({
          ...state,
          referralProcessed: true
        }));
      }
    } else {
      // No referral code found, just mark as processed
      updateState(state => ({
        ...state,
        referralProcessed: true
      }));
    }
  } catch (error) {
    console.error('Failed to process referral signup:', error);
    clearStoredReferralCode();
    updateState(state => ({
      ...state,
      referralProcessed: true
    }));
  }
};