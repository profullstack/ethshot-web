/**
 * Real-time Updates Module
 *
 * Handles real-time subscriptions and periodic updates for the game store
 */

import { get } from 'svelte/store';
import { notifyShotTaken } from '../../utils/notifications.js';
import {
  handleShotEvent,
  handleWinnerEvent,
  handlePotUpdate
} from './social-proof-integration.js';

/**
 * Start real-time updates
 * @param {Object} params - Parameters object
 * @param {Object} params.db - Database instance
 * @param {Function} params.getWalletStore - Function to get wallet store
 * @param {Function} params.loadGameState - Function to load game state
 * @param {Function} params.loadPlayerData - Function to load player data
 * @param {Function} params.updateState - State update function
 * @param {Function} params.subscribe - Store subscribe function
 * @returns {Object} Update interval object with timer and subscriptions
 */
export const startRealTimeUpdates = ({
  db,
  getWalletStore,
  loadGameState,
  loadPlayerData,
  updateState,
  subscribe
}) => {
  // DISABLED: Supabase real-time subscriptions to avoid websocket connection errors
  // Real-time updates are now handled via periodic polling only
  console.log('🔄 Starting periodic updates (realtime subscriptions disabled)');
  
  // Placeholder subscriptions that return null to avoid errors
  const winnersSubscription = null;
  const shotsSubscription = null;
  const sponsorsSubscription = null;

  // Update every 30 seconds for more responsive updates (since realtime is disabled)
  const timer = setInterval(async () => {
    const previousState = get({ subscribe });
    const previousPot = previousState.currentPot;
    
    await loadGameState();
    
    // Check for pot updates for social proof
    const currentState = get({ subscribe });
    const currentPot = currentState.currentPot;
    if (currentPot && currentPot !== previousPot) {
      handlePotUpdate(currentPot);
    }
    
    const walletStore = getWalletStore();
    const wallet = get(walletStore);
    if (wallet.connected && wallet.address) {
      await loadPlayerData(wallet.address);
    }
  }, 30000); // Reduced from 60s to 30s for better responsiveness

  // Listen for wallet connection changes
  const walletStore = getWalletStore();
  const walletUnsubscribe = walletStore.subscribe(async (wallet) => {
    if (wallet.connected && wallet.address) {
      console.log('🔄 Wallet connected - refreshing player data immediately');
      try {
        await loadPlayerData(wallet.address);
        console.log('✅ Player data refreshed after wallet connection');
      } catch (error) {
        console.error('❌ Failed to refresh player data after wallet connection:', error);
      }
    }
  });

  // Return subscriptions for cleanup (subscriptions are null since realtime is disabled)
  return {
    timer,
    subscriptions: [winnersSubscription, shotsSubscription, sponsorsSubscription].filter(Boolean),
    walletUnsubscribe
  };
};

/**
 * Stop real-time updates
 * @param {Object} updateInterval - Update interval object from startRealTimeUpdates
 */
export const stopRealTimeUpdates = (updateInterval) => {
  if (updateInterval) {
    if (updateInterval.timer) {
      clearInterval(updateInterval.timer);
    }
    if (updateInterval.subscriptions) {
      updateInterval.subscriptions.forEach(subscription => {
        if (subscription && subscription.unsubscribe) {
          subscription.unsubscribe();
        }
      });
    }
    if (updateInterval.walletUnsubscribe) {
      updateInterval.walletUnsubscribe();
    }
  }
};