/**
 * Core Game Store Module
 *
 * Pure state management for game data - business logic moved to services
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { multiCryptoWalletStore } from '../wallet-multi-crypto.js';
import { walletStore } from '../wallet.js';
import { getCryptoGameConfig, getCurrentCrypto } from '../../crypto/config.js';
import { GAME_CONFIG } from '../../config.js';
import { db } from '../../database/index.js';
import { rpcCache } from './cache.js';
import { createInitialGameState, updateUSDValues, formatTimeRemaining, safeBigIntToNumber } from './utils.js';
import { loadGameState, initializeEthContract, initializeMultiCryptoAdapter } from './contract-operations.js';
import { loadPlayerData } from './player-operations.js';
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
        
        // Store contract and ethers in the state so components can access them
        update(state => ({
          ...state,
          contract: result.contract,
          ethers: result.ethers
        }));
        
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

  // These wrapper functions now just provide access to state for external services
  const getGameState = () => get({ subscribe });
  const getContract = () => contract;
  const getEthers = () => ethers;

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

  // Clean up expired pending shot - try contract call first, fallback to refresh
  const cleanupExpiredPendingShot = async (playerAddress = null) => {
    if (!browser) {
      throw new Error('Not available on server');
    }

    console.log('🧹 GameStore: Starting cleanupExpiredPendingShot...');

    const state = get({ subscribe });
    const walletStore = getWalletStore();
    const wallet = get(walletStore);
    
    console.log('🧹 GameStore: Wallet check:', {
      connected: wallet.connected,
      address: wallet.address,
      contractDeployed: state.contractDeployed
    });
    
    if (!wallet.connected || !wallet.address) {
      throw new Error('Please connect your wallet first');
    }

    if (state.contractDeployed === false) {
      throw new Error(`${state.activeCrypto} contract not deployed yet.`);
    }

    // Default to cleaning up the current user's pending shot
    const targetPlayer = playerAddress || wallet.address;
    
    console.log('🧹 GameStore: Target player:', targetPlayer);
    
    // Only allow users to clean up their own pending shots for privacy
    if (targetPlayer !== wallet.address) {
      throw new Error('You can only clean up your own pending shots');
    }

    try {
      if (state.isMultiCryptoMode) {
        // Multi-crypto mode: use adapter pattern
        throw new Error('Cleanup function not yet implemented for multi-crypto mode. Please refresh the page.');
      } else {
        // ETH-only mode: try to call the contract function
        console.log('🧹 GameStore: Checking contract availability:', {
          contract: !!contract,
          ethers: !!ethers,
          signer: !!wallet.signer
        });
        
        if (!contract || !ethers || !wallet.signer) {
          throw new Error('Contract or signer not available. Please refresh the page.');
        }

        console.log('🧹 GameStore: Checking if pending shot exists...');
        
        // First check if the pending shot is actually expired
        const hasPending = await contract.hasPendingShot(targetPlayer);
        if (!hasPending) {
          throw new Error('No pending shot found to clean up');
        }

        console.log('🧹 GameStore: Getting pending shot details...');
        const pendingShot = await contract.getPendingShot(targetPlayer);
            const currentBlock = await wallet.provider.getBlockNumber();
    const commitBlock = safeBigIntToNumber(pendingShot.blockNumber);
        const maxRevealDelay = 256; // MAX_REVEAL_DELAY from contract
        
        const revealExpired = currentBlock > commitBlock + maxRevealDelay;
        
        console.log('🧹 GameStore: Expiration check:', {
          commitBlock,
          currentBlock,
          maxRevealDelay,
          revealExpired,
          blocksRemaining: (commitBlock + maxRevealDelay) - currentBlock
        });
        
        if (!revealExpired) {
          const blocksRemaining = (commitBlock + maxRevealDelay) - currentBlock;
          throw new Error(`Pending shot is not expired yet. Please wait ${blocksRemaining} more blocks or refresh the page to start over.`);
        }

        // Try to call the cleanup function
        try {
          console.log('🧹 GameStore: Calling contract cleanup function...');
          const contractWithSigner = contract.connect(wallet.signer);
          
          // Estimate gas
          let gasEstimate;
          try {
            console.log('🧹 GameStore: Estimating gas...');
            gasEstimate = await contractWithSigner.cleanupExpiredPendingShot.estimateGas(targetPlayer);
            console.log('🧹 GameStore: Gas estimate:', gasEstimate.toString());
          } catch (estimateError) {
            console.warn('🧹 GameStore: Failed to estimate gas for cleanup, using default:', estimateError.message);
            gasEstimate = 100000n;
          }
          
          const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);
          console.log('🧹 GameStore: Using gas limit:', gasLimit.toString());
          
          console.log('🧹 GameStore: Sending transaction...');
          const tx = await contractWithSigner.cleanupExpiredPendingShot(targetPlayer, {
            gasLimit: gasLimit
          });

          console.log('🧹 GameStore: Transaction sent, waiting for receipt...', tx.hash);
          const receipt = await tx.wait();
          console.log('🧹 GameStore: Transaction confirmed!', receipt.hash);
          
          return {
            hash: receipt.hash,
            receipt
          };
        } catch (contractError) {
          console.error('🧹 GameStore: Contract cleanup failed:', contractError);
          console.error('🧹 GameStore: Contract error details:', {
            message: contractError.message,
            code: contractError.code,
            reason: contractError.reason
          });
          throw new Error('Contract cleanup failed. Please refresh the page to clear the pending shot state.');
        }
      }
      
    } catch (error) {
      console.error('🧹 GameStore: Failed to cleanup expired pending shot:', error);
      throw error;
    }
  };


  return {
    subscribe,
    init,
    switchCrypto,
    loadGameState: loadGameStateWrapper,
    loadPlayerData: loadPlayerDataWrapper,
    formatTimeRemaining,
    stopRealTimeUpdates: stopRealTimeUpdatesWrapper,
    cleanupExpiredPendingShot,
    // State access functions for external services
    getGameState,
    getWalletStore,
    getContract,
    getEthers,
    // Database access
    get db() { return db; },
    // State update function for external services
    updateState: update
  };
};

export const gameStore = createUnifiedGameStore();