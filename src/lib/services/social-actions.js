/**
 * Social Actions Service
 * 
 * Pure functions for social media and external sharing actions
 */

import { browser } from '$app/environment';
import { SOCIAL_CONFIG } from '../config.js';
import { shareOnTwitter as shareOnTwitterExternal } from '../utils/external-links.js';
import { toastStore } from '../stores/toast.js';

/**
 * Share game result on X (formerly Twitter)
 * @param {Object} params - Parameters object
 * @param {string} params.currentPot - Current pot amount
 * @param {string} params.activeCrypto - Active cryptocurrency symbol
 * @returns {void}
 */
export const shareOnTwitter = ({ currentPot, activeCrypto = 'ETH' }) => {
  if (!browser) return;

  const cryptoSymbol = activeCrypto || 'ETH';
  // Ensure we have a valid pot value, fallback to "the current pot" if not loaded
  const potValue = currentPot && currentPot !== '0' ? `${currentPot} ${cryptoSymbol}` : 'the current pot';
  const text = `I just took a shot at #${cryptoSymbol}Shot and the pot is now ${potValue}! 🎯 Try your luck: #${cryptoSymbol.toLowerCase()}`;
  const url = SOCIAL_CONFIG.APP_URL;
  
  console.log('🐦 Sharing on X:', { currentPot, cryptoSymbol, potValue, text });
  
  // Use the external links utility to properly handle webviews
  shareOnTwitterExternal(text, url);
};

/**
 * Copy app link to clipboard
 * @returns {Promise<void>}
 */
export const copyLink = async () => {
  if (!browser) return;

  try {
    await navigator.clipboard.writeText(SOCIAL_CONFIG.APP_URL);
    toastStore.success('Link copied to clipboard!');
  } catch (error) {
    toastStore.error('Failed to copy link');
    throw error;
  }
};