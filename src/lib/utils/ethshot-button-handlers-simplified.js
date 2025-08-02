/**
 * Simplified Game action handlers for GameButton component
 * Contains streamlined business logic for handling game actions
 */
import { get } from 'svelte/store';
import { takeShot, sponsorRound, revealShot } from '../services/ethshot-actions-simplified.js';
import { GAME_CONFIG, NETWORK_CONFIG } from '../config.js';
import { resetTransactionStatus, setCooldownStatus } from './ethshot-button-utils.js';

/**
 * Create simplified game action handlers
 * @param {Object} dependencies - Required dependencies
 * @returns {Object} Object containing all handler functions
 */
export const createGameActionHandlers = (dependencies) => {
  const {
    gameStore,
    walletStore,
    toastStore,
    handleStatusUpdate,
    setTransactionStatus,
    setStatusMessage,
    setProgressPercentage,
    timeRemaining,
    // Add reactive store getters
    getIsConnected,
    getIsCorrectNetwork,
    getCanTakeShot,
    getContractDeployed,
    getIsLoading,
    getGameError
  } = dependencies;

  /**
   * Handle taking a shot (simplified)
   */
  const handleTakeShot = async () => {
    console.log('🎯 TAKE SHOT BUTTON CLICKED!');
    console.log('🔍 Button click handler executing...');
    
    const isConnected = getIsConnected();
    const isCorrectNetwork = getIsCorrectNetwork();
    const canTakeShot = getCanTakeShot();
    const contractDeployed = getContractDeployed();
    const isLoading = getIsLoading();
    const gameError = getGameError();

    console.log('Debug info:', {
      isConnected,
      isCorrectNetwork,
      canTakeShot,
      contractDeployed,
      isLoading,
      gameError
    });

    if (!isConnected) {
      console.log('❌ Wallet not connected - stopping here');
      toastStore.error('Please connect your wallet first');
      return;
    }

    if (!isCorrectNetwork) {
      console.log('❌ Wrong network - stopping here');
      toastStore.error('Please switch to the correct network');
      return;
    }

    if (!canTakeShot) {
      console.log('❌ Cannot take shot - stopping here');
      toastStore.error('Cannot take shot at this time');
      return;
    }

    console.log('✅ All checks passed, calling gameStore.takeShot()');
    console.log('🚀 About to call gameStore.takeShot()...');
    
    // Reset status
    setTransactionStatus('idle');
    setStatusMessage('');
    setProgressPercentage(0);
    
    try {
      const gameState = gameStore.getGameState();
      const walletStoreInstance = gameStore.getWalletStore();
      const wallet = get(walletStoreInstance);
      
      const result = await takeShot({
        useDiscount: false,
        discountId: null,
        customShotCost: null,
        gameState,
        wallet,
        contract: gameStore.getContract(),
        ethers: gameStore.getEthers(),
        updateGameState: gameStore.updateState,
        loadGameState: gameStore.loadGameState,
        loadPlayerData: gameStore.loadPlayerData,
        onStatusUpdate: handleStatusUpdate
      });
      console.log('✅ takeShot() completed:', result);
      
      // Handle first shot (no reveal needed)
      if (result && result.isFirstShot) {
        console.log('🚀 First shot committed successfully - no reveal needed!');
        toastStore.success('🚀 First shot committed! The pot has been started. Other players can now take shots to try to win it!');
        
        // Reset transaction status after successful completion, but keep some info during cooldown
        setTimeout(() => {
          if (timeRemaining > 0) {
            // If cooldown is active, show cooldown status instead of idle
            setCooldownStatus(setTransactionStatus, setStatusMessage, setProgressPercentage,
              'First shot completed successfully! Cooldown active.', 100);
          } else {
            resetTransactionStatus(setTransactionStatus, setStatusMessage, setProgressPercentage, 0);
          }
        }, 2000);
      } 
      // Handle regular shot (commit + auto-reveal)
      else if (result && result.revealResult) {
        console.log('🎯 Shot committed and revealed successfully');
        
        // Show appropriate message based on win/loss
        if (result.revealResult.won) {
          toastStore.success('🎉 JACKPOT! YOU WON! 🎊');
          console.log('🎉 Shot revealed - YOU WON THE JACKPOT!');
        } else {
          toastStore.info('🎲 Shot completed - No win this time. Better luck next shot!');
          console.log('🎲 Shot revealed - No win this time');
        }
        
        // Reset transaction status after successful completion, but keep some info during cooldown
        setTimeout(() => {
          if (timeRemaining > 0) {
            // If cooldown is active, show cooldown status instead of idle
            setCooldownStatus(setTransactionStatus, setStatusMessage, setProgressPercentage,
              'Shot completed successfully! Cooldown active.', 100);
          } else {
            resetTransactionStatus(setTransactionStatus, setStatusMessage, setProgressPercentage, 0);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Failed to take shot:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      toastStore.error('Failed to take shot: ' + error.message);
      
      // Reset status on error
      resetTransactionStatus(setTransactionStatus, setStatusMessage, setProgressPercentage, 0);
    }
  };

  /**
   * Handle taking the first shot (when pot is empty)
   */
  const handleTakeFirstShot = async () => {
    console.log('🎯 TAKE FIRST SHOT BUTTON CLICKED!');
    console.log('🔍 First shot handler executing...');
    
    const isConnected = getIsConnected();
    const isCorrectNetwork = getIsCorrectNetwork();
    const canTakeShot = getCanTakeShot();
    const contractDeployed = getContractDeployed();
    const isLoading = getIsLoading();
    const gameState = gameStore.getGameState();
    const currentPot = gameState.currentPot;
    const gameError = getGameError();

    console.log('Debug info:', {
      isConnected,
      isCorrectNetwork,
      canTakeShot,
      contractDeployed,
      isLoading,
      currentPot,
      gameError
    });

    if (!isConnected) {
      console.log('❌ Wallet not connected - stopping here');
      toastStore.error('Please connect your wallet first');
      return;
    }

    if (!isCorrectNetwork) {
      console.log('❌ Wrong network - stopping here');
      toastStore.error('Please switch to the correct network');
      return;
    }

    if (!canTakeShot) {
      console.log('❌ Cannot take shot - stopping here');
      toastStore.error('Cannot take shot at this time');
      return;
    }

    console.log('✅ All checks passed, calling gameStore.takeShot() with first shot cost');
    console.log('🚀 About to call gameStore.takeShot() for first shot...');
    
    // Reset status
    setTransactionStatus('idle');
    setStatusMessage('');
    setProgressPercentage(0);
    
    try {
      const gameState = gameStore.getGameState();
      const walletStoreInstance = gameStore.getWalletStore();
      const wallet = get(walletStoreInstance);
      
      const result = await takeShot({
        useDiscount: false,
        discountId: null,
        customShotCost: GAME_CONFIG.FIRST_SHOT_COST_ETH,
        gameState,
        wallet,
        contract: gameStore.getContract(),
        ethers: gameStore.getEthers(),
        updateGameState: gameStore.updateState,
        loadGameState: gameStore.loadGameState,
        loadPlayerData: gameStore.loadPlayerData,
        onStatusUpdate: handleStatusUpdate
      });
      console.log('✅ takeShot() (first shot) completed:', result);
      
      // First shots are handled by the main takeShot logic above
      console.log('✅ First shot handled by main takeShot logic');
    } catch (error) {
      console.error('❌ Failed to take first shot:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      toastStore.error('Failed to take first shot: ' + error.message);
      
      // Reset status on error
      resetTransactionStatus(setTransactionStatus, setStatusMessage, setProgressPercentage, 0);
    }
  };

  /**
   * Handle sponsor round
   */
  const handleSponsorRound = async () => {
    console.log('💰 SPONSOR ROUND BUTTON CLICKED!');
    
    const isConnected = getIsConnected();
    const isCorrectNetwork = getIsCorrectNetwork();

    if (!isConnected) {
      toastStore.error('Please connect your wallet first');
      return;
    }

    if (!isCorrectNetwork) {
      toastStore.error('Please switch to the correct network');
      return;
    }

    try {
      const gameState = gameStore.getGameState();
      const walletStoreInstance = gameStore.getWalletStore();
      const wallet = get(walletStoreInstance);
      
      const result = await sponsorRound({
        name: 'Anonymous Sponsor',
        logoUrl: '/icons/sponsor-default.png',
        sponsorUrl: null,
        gameState,
        wallet,
        contract: gameStore.getContract(),
        ethers: gameStore.getEthers(),
        loadGameState: gameStore.loadGameState
      });
      console.log('✅ sponsorRound() completed:', result);
    } catch (error) {
      console.error('❌ Failed to sponsor round:', error);
      toastStore.error('Failed to sponsor round: ' + error.message);
    }
  };

  /**
   * Switch to correct network
   */
  const handleSwitchNetwork = async () => {
    try {
      await walletStore.switchNetwork(NETWORK_CONFIG.CHAIN_ID);
    } catch (error) {
      toastStore.error('Failed to switch network');
    }
  };

  return {
    handleTakeShot,
    handleTakeFirstShot,
    handleSponsorRound,
    handleSwitchNetwork
  };
};