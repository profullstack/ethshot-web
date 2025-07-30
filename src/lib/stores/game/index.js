/**
 * Game Store Module - Main Export
 * 
 * Refactored game store with modular architecture for better maintainability.
 * This file maintains backward compatibility with the original game-unified.js exports.
 */

import { derived, get } from 'svelte/store';
import { gameStore, winnerEventStore } from './core.js';

// Re-export the main game store and winner event store
export { gameStore, winnerEventStore };

// Derived stores for convenience (maintaining backward compatibility)
export const currentPot = derived(gameStore, $game => $game.currentPot);

export const currentPotUSD = derived(gameStore, $game => $game.currentPotUSD);

export const canTakeShot = derived(gameStore, $game => $game.canShoot && !$game.takingShot);

export const cooldownRemaining = derived(gameStore, $game => $game.cooldownRemaining);

export const isLoading = derived(gameStore, $game => $game.loading || $game.takingShot);

export const currentSponsor = derived(gameStore, $game => $game.currentSponsor);

export const recentWinners = derived(gameStore, $game => $game.recentWinners);

export const playerStats = derived(gameStore, $game => $game.playerStats);

export const contractDeployed = derived(gameStore, $game => $game.contractDeployed);

export const gameError = derived(gameStore, $game => $game.error);

export const activeCrypto = derived(gameStore, $game => $game.activeCrypto);

export const gameConfig = derived(gameStore, $game => $game.gameConfig);

export const shotCost = derived(gameStore, $game => $game.shotCost);

export const shotCostUSD = derived(gameStore, $game => $game.shotCostUSD);

export const sponsorCost = derived(gameStore, $game => $game.sponsorCost);

export const sponsorCostUSD = derived(gameStore, $game => $game.sponsorCostUSD);

export const isMultiCryptoMode = derived(gameStore, $game => $game.isMultiCryptoMode);

// Referral system derived stores
export const availableDiscounts = derived(gameStore, $game => $game.availableDiscounts || []);

export const discountCount = derived(gameStore, $game => $game.availableDiscounts?.length || 0);

export const referralStats = derived(gameStore, $game => $game.referralStats);

export const hasReferralData = derived(gameStore, $game => $game.referralStats !== null);

export const canUseDiscount = derived(gameStore, $game =>
  ($game.availableDiscounts?.length || 0) > 0 && !$game.takingShot && $game.canShoot
);

export const nextDiscount = derived(gameStore, $game => {
  const discounts = $game.availableDiscounts || [];
  return discounts.length > 0 ? discounts[0] : null;
});

// Legacy exports for backward compatibility
export const multiCryptoGameStore = gameStore;

// Export service modules for business logic (moved from store)
export * as GameActions from '../services/game-actions.js';
export * as SocialActions from '../services/social-actions.js';
export * as NotificationService from '../services/notification-service.js';
export * as ReferralService from '../services/referral-service.js';

// Export core game functions for direct access (state management only)
export const loadGameState = (...args) => gameStore.loadGameState(...args);
export const loadPlayerData = (...args) => gameStore.loadPlayerData(...args);
export const init = (...args) => gameStore.init(...args);
export const switchCrypto = (...args) => gameStore.switchCrypto(...args);

// Auto-initialize the game store for backward compatibility
if (typeof window !== 'undefined') {
  // Initialize the game store automatically when imported
  gameStore.init().catch(error => {
    console.warn('Auto-initialization failed:', error.message);
  });
}

// Re-export individual modules for advanced usage
export * as GameCache from './cache.js';
export * as GameUtils from './utils.js';
export * as ContractOperations from './contract-operations.js';
export * as PlayerOperations from './player-operations.js';
export * as ReferralOperations from './referral-operations.js';
export * as RealTimeUpdates from './real-time.js';