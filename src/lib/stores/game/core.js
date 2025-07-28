/**
 * Core Game Store Module
 * 
 * Main game store implementation with initialization and core functionality
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { multiCryptoWalletStore } from '../wallet-multi-crypto.js';
import { walletStore } from '../wallet.js';
import { toastStore } from '../toast.js';
import { getCryptoGameConfig, getCurrentCrypto } from '../../crypto/config.js';
import { GAME_CONFIG, SOCIAL_CONFIG } from '../../config.js';
import { shareOnTwitter as shareOnTwitterExternal } from '../../utils/external-links.js';
import { 
  processReferralOnLoad,
  clearStoredReferralCode
} from '../../utils/referral.js';
import { 
  notificationManager
} from '../../utils/notifications.js';
import { db } from '../../database/index.js';
import { rpcCache } from './cache.js';
import { createInitialGameState, updateUSDValues, formatTimeRemaining } from './utils.js';
import { loadGameState, initializeEthContract, initializeMultiCryptoAdapter } from './contract-operations.js';
import { loadPlayerData, takeShot } from './player-operations.js';
import { processReferralSignup } from './referral-operations.js';
import { startRealTimeUpdates, stopRealTimeUpdates } from './real-time.js';

// Winner event store for triggering animations
export const winnerEventStore = writable(null);

/**
 * Create the unified game store
 */
const createUnifiedGameStore = () => {
  const { subscribe, set, update } = writable(createInitialGameState());

  let contract = null;
  let updateInterval = null;
  let ethers = null;

  // Helper function to get the appropriate wallet store
  const getWalletStore = () => {
    const state = get({ subscribe });
    return state.isMultiCryptoMode ? multiCryptoWalletStore : walletStore;
  };

  // Initialize game store
  const init = async (cryptoType = null, multiCryptoMode = false) => {
    if (!browser) {
      console.warn('Unified game initialization skipped on server');
      return;
    }

    try {
      const targetCrypto = cryptoType || (multiCryptoMode ? getCurrentCrypto().type : 'ETH');
      const gameConfig = multiCryptoMode ? getCryptoGameConfig(targetCrypto) : GAME_CONFIG;

      update(state => ({
        ...state,
        activeCrypto: targetCrypto,
        gameConfig,
        isMultiCryptoMode: multiCryptoMode,
        loading: true,
        error: null
      }));

      if (multiCryptoMode) {
        // Multi-crypto mode: use adapter pattern
        const success = await initializeMultiCryptoAdapter(targetCrypto, update);
        if (!success) return;
      } else {
        // ETH-only mode: direct ethers.js integration
        const result = await initializeEthContract({ updateState: update });
        contract = result.contract;
        ethers = result.ethers;
        if (!contract) return;
      }
      
      // Load initial game state
      await loadGameStateWrapper();
      
      // Start real-time updates
      startRealTimeUpdatesWrapper();
      
      // Update USD values after loading game state
      const currentState = get({ subscribe });
      const updatedState = await updateUSDValues({
        ...currentState,
        loading: false,
        lastUpdate: new Date().toISOString()
      });
      
      update(state => updatedState);
      
    } catch (error) {
      console.error('Failed to initialize unified game:', error);
      
      let errorMessage = `Failed to initialize ${cryptoType || 'game'}: ${error.message}`;
      if (error.message.includes('Too Many Requests')) {
        errorMessage = 'RPC provider rate limit exceeded. Please try again later.';
      }
      
      update(state => ({
        ...state,
        contractDeployed: false,
        loading: false,
        error: errorMessage
      }));
    }
  };

  // Switch to a different cryptocurrency (multi-crypto mode only)
  const switchCrypto = async (cryptoType) => {
    if (!browser) return;

    const state = get({ subscribe });
    if (!state.isMultiCryptoMode) {
      console.warn('switchCrypto called in single-crypto mode');
      return;
    }

    try {
      update(state => ({
        ...state,
        loading: true,
        error: null
      }));

      // Stop current real-time updates
      stopRealTimeUpdatesWrapper();

      // Clear cache
      rpcCache.clear();

      // Initialize for new crypto
      await init(cryptoType, true);

    } catch (error) {
      console.error(`Failed to switch game to ${cryptoType}:`, error);
      
      update(state => ({
        ...state,
        loading: false,
        error: `Failed to switch to ${cryptoType}: ${error.message}`
      }));
    }
  };

  // Wrapper functions to maintain compatibility
  const loadGameStateWrapper = async () => {
    const state = get({ subscribe });
    await loadGameState({
      state,
      contract,
      ethers,
      db,
      updateState: update
    });
  };

  const loadPlayerDataWrapper = async (address) => {
    const state = get({ subscribe });
    await loadPlayerData({
      address,
      state,
      contract,
      ethers,
      db,
      updateState: update
    });
  };

  const takeShotWrapper = async (useDiscount = false, discountId = null, customShotCost = null) => {
    const state = get({ subscribe });
    const walletStore = getWalletStore();
    const wallet = get(walletStore);
    
    await takeShot({
      useDiscount,
      discountId,
      customShotCost,
      state,
      contract,
      ethers,
      wallet,
      db,
      updateState: update,
      loadGameState: loadGameStateWrapper,
      loadPlayerData: loadPlayerDataWrapper,
      walletStore
    });
  };

  // Sponsor a round
  const sponsorRound = async (name, logoUrl, sponsorUrl = null) => {
    if (!browser) {
      toastStore.error('Not available on server');
      return;
    }

    const state = get({ subscribe });
    const walletStore = getWalletStore();
    const wallet = get(walletStore);
    
    if (!wallet.connected || !wallet.address) {
      toastStore.error('Please connect your wallet first');
      return;
    }

    if (state.contractDeployed === false) {
      toastStore.error(`${state.activeCrypto} contract not deployed yet.`);
      return;
    }

    if (!name || !logoUrl) {
      toastStore.error('Please provide sponsor name and logo URL');
      return;
    }

    try {
      let result;

      if (state.isMultiCryptoMode) {
        // Multi-crypto mode: use adapter
        const adapter = getActiveAdapter();
        if (!adapter) {
          throw new Error('No active cryptocurrency adapter');
        }

        result = await adapter.sponsorRound(name, logoUrl);
      } else {
        // ETH-only mode: direct contract interaction
        if (!contract || !ethers || !wallet.signer) {
          throw new Error('Contract or signer not available');
        }

        const contractWithSigner = contract.connect(wallet.signer);
        const sponsorCost = await contract.SPONSOR_COST();

        // Check user balance
        const balance = await wallet.provider.getBalance(wallet.address);
        
        // Estimate gas
        let gasEstimate;
        try {
          gasEstimate = await contractWithSigner.sponsorRound.estimateGas(name, logoUrl, {
            value: sponsorCost
          });
        } catch (estimateError) {
          console.warn('Failed to estimate gas, using default:', estimateError.message);
          gasEstimate = 100000n;
        }
        
        const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);
        
        // Get gas price and calculate total cost
        const feeData = await wallet.provider.getFeeData();
        const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
        const estimatedGasCost = gasLimit * gasPrice;
        const totalCost = sponsorCost + estimatedGasCost;
        
        if (balance < totalCost) {
          const shortfall = ethers.formatEther(totalCost - balance);
          throw new Error(`Insufficient ETH. Need ${shortfall} more ETH for gas fees.`);
        }

        const tx = await contractWithSigner.sponsorRound(name, logoUrl, {
          value: sponsorCost,
          gasLimit: gasLimit
        });

        toastStore.info('Sponsorship submitted! Waiting for confirmation...');
        const receipt = await tx.wait();
        
        result = {
          hash: receipt.hash,
          receipt
        };
      }
      
      toastStore.success('Round sponsored successfully!');
      
      // Log sponsorship to database
      try {
        await db.recordSponsor({
          sponsorAddress: wallet.address,
          name,
          logoUrl,
          sponsorUrl,
          amount: state.sponsorCost,
          txHash: result.hash,
          blockNumber: result.receipt.blockNumber,
          timestamp: new Date().toISOString(),
          active: true,
          cryptoType: state.activeCrypto
        });
      } catch (dbError) {
        console.error('Failed to log sponsorship to database:', dbError);
      }
      
      // Clear cache and refresh state
      rpcCache.clear();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadGameStateWrapper();
      await walletStore.updateBalance();

    } catch (error) {
      console.error('Failed to sponsor round:', error);
      
      let errorMessage = 'Failed to sponsor round';
      if (error.message.includes('insufficient funds')) {
        errorMessage = `Insufficient ${state.activeCrypto} balance`;
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction cancelled';
      } else if (error.message.includes('not yet implemented')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toastStore.error(errorMessage);
    }
  };

  // Share on X (formerly Twitter)
  const shareOnTwitter = () => {
    if (!browser) return;

    const state = get({ subscribe });
    const cryptoSymbol = state.activeCrypto || 'ETH';
    // Ensure we have a valid pot value, fallback to "the current pot" if not loaded
    const potValue = state.currentPot && state.currentPot !== '0' ? `${state.currentPot} ${cryptoSymbol}` : 'the current pot';
    const text = `I just took a shot at #${cryptoSymbol}Shot and the pot is now ${potValue}! 🎯 Try your luck: #${cryptoSymbol.toLowerCase()}`;
    const url = SOCIAL_CONFIG.APP_URL;
    
    console.log('🐦 Sharing on X:', { currentPot: state.currentPot, cryptoSymbol, potValue, text });
    
    // Use the external links utility to properly handle webviews
    shareOnTwitterExternal(text, url);
  };

  // Copy link to clipboard
  const copyLink = async () => {
    if (!browser) return;

    try {
      await navigator.clipboard.writeText(SOCIAL_CONFIG.APP_URL);
      toastStore.success('Link copied to clipboard!');
    } catch (error) {
      toastStore.error('Failed to copy link');
    }
  };

  // Start real-time updates wrapper
  const startRealTimeUpdatesWrapper = () => {
    updateInterval = startRealTimeUpdates({
      db,
      getWalletStore,
      loadGameState: loadGameStateWrapper,
      loadPlayerData: loadPlayerDataWrapper,
      updateState: update,
      subscribe
    });
  };

  // Stop real-time updates wrapper
  const stopRealTimeUpdatesWrapper = () => {
    stopRealTimeUpdates(updateInterval);
    updateInterval = null;
  };

  // Clean up expired pending shot
  const cleanupExpiredPendingShot = async (playerAddress) => {
    if (!browser) {
      throw new Error('Not available on server');
    }

    const state = get({ subscribe });
    const walletStore = getWalletStore();
    const wallet = get(walletStore);
    
    if (!wallet.connected || !wallet.address) {
      throw new Error('Please connect your wallet first');
    }

    if (state.contractDeployed === false) {
      throw new Error(`${state.activeCrypto} contract not deployed yet.`);
    }

    try {
      if (state.isMultiCryptoMode) {
        // Multi-crypto mode: use adapter pattern
        throw new Error('Cleanup function not yet implemented for multi-crypto mode');
      } else {
        // ETH-only mode: direct ethers.js integration
        if (!contract || !ethers || !wallet.signer) {
          throw new Error('Contract or signer not available');
        }

        const contractWithSigner = contract.connect(wallet.signer);
        
        // Estimate gas
        let gasEstimate;
        try {
          gasEstimate = await contractWithSigner.cleanupExpiredPendingShot.estimateGas(playerAddress);
        } catch (estimateError) {
          console.warn('Failed to estimate gas, using default:', estimateError.message);
          gasEstimate = 100000n;
        }
        
        const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);
        
        const tx = await contractWithSigner.cleanupExpiredPendingShot(playerAddress, {
          gasLimit: gasLimit
        });

        const receipt = await tx.wait();
        
        return {
          hash: receipt.hash,
          receipt
        };
      }
      
    } catch (error) {
      console.error('Failed to cleanup expired pending shot:', error);
      throw error;
    }
  };

  return {
    subscribe,
    init,
    switchCrypto,
    loadGameState: loadGameStateWrapper,
    loadPlayerData: loadPlayerDataWrapper,
    takeShot: takeShotWrapper,
    sponsorRound,
    shareOnTwitter,
    copyLink,
    formatTimeRemaining,
    stopRealTimeUpdates: stopRealTimeUpdatesWrapper,
    cleanupExpiredPendingShot,
    // Referral system functions
    processReferralOnLoad: () => processReferralOnLoad(),
    processReferralSignup: (address) => processReferralSignup(address, db, update),
    // Notification management
    requestNotificationPermission: () => notificationManager.requestPermission(),
    getNotificationPermissionStatus: () => notificationManager.getPermissionStatus(),
    isNotificationsEnabled: () => notificationManager.isEnabled(),
  };
};

export const gameStore = createUnifiedGameStore();