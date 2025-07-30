/**
 * Shot Result Message Store
 * 
 * Manages the display of prominent win/loss messages after shot results
 */

import { writable } from 'svelte/store';

// Store for shot result message state
export const shotResultMessageStore = writable({
  show: false,
  result: null // { won: boolean, amount?: string, shotCost: string }
});

/**
 * Show a win message
 * @param {string} amount - Amount won in ETH (as string)
 * @param {string} shotCost - Cost of the shot in ETH (as string)
 */
export const showWinMessage = (amount, shotCost) => {
  shotResultMessageStore.set({
    show: true,
    result: {
      won: true,
      amount,
      shotCost
    }
  });
};

/**
 * Show a loss message
 * @param {string} shotCost - Cost of the shot in ETH (as string)
 */
export const showLossMessage = (shotCost) => {
  shotResultMessageStore.set({
    show: true,
    result: {
      won: false,
      shotCost
    }
  });
};

/**
 * Hide the shot result message
 */
export const hideShotResultMessage = () => {
  shotResultMessageStore.set({
    show: false,
    result: null
  });
};

/**
 * Clear the shot result message (alias for hide)
 */
export const clearShotResultMessage = hideShotResultMessage;