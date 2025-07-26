/**
 * Real-time Updates Module
 * 
 * Handles real-time subscriptions and periodic updates for the game store
 */

import { get } from 'svelte/store';
import { notifyShotTaken } from '../../utils/notifications.js';

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
  // Set up Supabase real-time subscriptions
  const winnersSubscription = db.subscribeToWinners((payload) => {
    console.log('New winner:', payload);
    updateState(state => ({
      ...state,
      recentWinners: [payload.new, ...state.recentWinners.slice(0, 9)],
      lastUpdate: new Date().toISOString()
    }));
  });

  const shotsSubscription = db.subscribeToShots((payload) => {
    console.log('New shot:', payload);
    
    // Notify about new shot taken (only if it's not the current user)
    const walletStore = getWalletStore();
    const wallet = get(walletStore);
    if (payload.new && payload.new.player_address !== wallet.address?.toLowerCase()) {
      const currentState = get({ subscribe });
      notifyShotTaken(currentState.currentPot || 'the current pot');
    }
    
    // Refresh game state when new shots are taken
    loadGameState();
  });

  const sponsorsSubscription = db.subscribeToSponsors((payload) => {
    console.log('New sponsor:', payload);
    updateState(state => ({
      ...state,
      currentSponsor: payload.new,
      lastUpdate: new Date().toISOString()
    }));
  });

  // Update every 60 seconds as fallback
  const timer = setInterval(async () => {
    await loadGameState();
    
    const walletStore = getWalletStore();
    const wallet = get(walletStore);
    if (wallet.connected && wallet.address) {
      await loadPlayerData(wallet.address);
    }
  }, 60000);

  // Listen for wallet connection changes
  const walletStore = getWalletStore();
  const walletUnsubscribe = walletStore.subscribe(async (wallet) => {
    if (wallet.connected && wallet.address) {
      await loadPlayerData(wallet.address);
    }
  });

  // Return subscriptions for cleanup
  return {
    timer,
    subscriptions: [winnersSubscription, shotsSubscription, sponsorsSubscription],
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