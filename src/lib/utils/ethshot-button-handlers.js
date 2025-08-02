/**
 * Game action handlers for GameButton component
 * Contains all the business logic for handling game actions
 */

import { get } from 'svelte/store';
import { takeShot, sponsorRound, revealShot, cleanupExpiredPendingShot } from '../services/ethshot-actions.js';
import { GAME_CONFIG, NETWORK_CONFIG } from '../config.js';
import { saveSecretToStorage, removeRevealedSecret, copySecretToClipboard } from './ethshot-button-storage.js';
import { resetTransactionStatus, setCooldownStatus } from './ethshot-button-utils.js';

/**
 * Create game action handlers
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
    setPendingSecret,
    setPendingTxHash,
    setShowRevealModal,
    setRevealingShot,
    setSavingToLocalStorage,
    setCopyingToClipboard,
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
   * Handle taking a shot
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
      
      // Handle commit-only result (new approach with automatic reveal)
      if (result && result.isCommitOnly && result.secret && !result.isFirstShot) {
        console.log('🎯 Regular shot committed successfully, attempting automatic reveal...');
        
        // Store the secret and hash for potential manual reveal
        setPendingSecret(result.secret);
        setPendingTxHash(result.hash);
        
        // Wait for blockchain state to update and attempt auto-reveal with retries
        handleStatusUpdate('waiting_reveal_window', 'Waiting for reveal window to open...');
        
        let autoRevealSuccess = false;
        let retryCount = 0;
        const maxRetries = 3;
        const baseDelay = 5000; // Start with 5 seconds
        
        while (!autoRevealSuccess && retryCount < maxRetries) {
          try {
            // Progressive delay: 5s, 10s, 15s
            const delay = baseDelay * (retryCount + 1);
            console.log(`🎯 Auto-reveal attempt ${retryCount + 1}/${maxRetries}, waiting ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            console.log('🎯 Starting automatic reveal...');
            const revealResult = await revealShot({
              secret: result.secret,
              gameState,
              wallet,
              contract: gameStore.getContract(),
              ethers: gameStore.getEthers(),
              loadGameState: gameStore.loadGameState,
              loadPlayerData: gameStore.loadPlayerData,
              onStatusUpdate: handleStatusUpdate
            });
            
            console.log('✅ Shot revealed automatically:', revealResult);
            autoRevealSuccess = true;
            
            // Clear the pending secret since reveal was successful
            setPendingSecret(null);
            setPendingTxHash(null);
            
            // Show appropriate message based on win/loss
            if (revealResult && revealResult.won) {
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
            
          } catch (revealError) {
            retryCount++;
            console.error(`❌ Auto-reveal attempt ${retryCount} failed:`, revealError);
            
            if (retryCount >= maxRetries) {
              console.error('❌ All auto-reveal attempts failed, falling back to manual reveal');
              
              // Fallback to manual reveal modal - with validation
              console.log('🎯 Falling back to manual reveal modal');
              console.log('🔍 Debug - result object:', result);
              console.log('🔍 Debug - result.secret:', result.secret);
              console.log('🔍 Debug - result.hash:', result.hash);
              
              // Validate that we have the necessary data for manual reveal
              if (result.secret && result.hash) {
                setShowRevealModal(true);
                toastStore.error('❌\n\nShot committed but auto-reveal failed. Please reveal manually.');
                console.log('✅ Manual reveal modal set up with secret and hash');
              } else {
                console.error('❌ Missing secret or hash for manual reveal:', {
                  hasSecret: !!result.secret,
                  hasHash: !!result.hash,
                  result
                });
                toastStore.error('Shot committed but auto-reveal failed and no secret available for manual reveal. Check debug panel for saved secrets.');
              }
              
              // Reset transaction status
              setTimeout(() => {
                if (timeRemaining > 0) {
                  // If cooldown is active, show cooldown status instead of idle
                  setCooldownStatus(setTransactionStatus, setStatusMessage, setProgressPercentage,
                    'Shot committed but auto-reveal failed. Manual reveal required.', 52);
                } else {
                  resetTransactionStatus(setTransactionStatus, setStatusMessage, setProgressPercentage, 0);
                }
              }, 2000);
            } else {
              console.log(`🔄 Retrying auto-reveal in ${baseDelay * (retryCount + 1)/1000}s...`);
              handleStatusUpdate('waiting_reveal_window', `Auto-reveal failed, retrying in ${baseDelay * (retryCount + 1)/1000}s... (${retryCount}/${maxRetries})`);
            }
          }
        }
      } else if (result && result.isCommitOnly && result.isFirstShot) {
        // First shot: no reveal needed, just adds to pot
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
      } else if (result && result.secret) {
        // Fallback for old approach
        console.log('🎯 Shot committed successfully, showing reveal modal');
        setPendingSecret(result.secret);
        setPendingTxHash(result.hash);
        setShowRevealModal(true);
        toastStore.success('Shot committed! Click "Reveal Now" to complete your shot.');
        
        // Reset transaction status after successful completion
        resetTransactionStatus(setTransactionStatus, setStatusMessage, setProgressPercentage);
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
      
      // First shots are now handled by the main takeShot logic above
      // This function should only be called for first shots, but the result handling
      // is now unified in the main handleTakeShot function
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

  /**
   * Handle revealing the shot immediately
   */
  const handleRevealNow = async (pendingSecret) => {
    if (!pendingSecret) {
      toastStore.error('No secret available to reveal');
      return { success: false, error: 'No secret available' };
    }

    console.log('🎯 Manual reveal requested with secret:', pendingSecret);
    setRevealingShot(true);
    
    try {
      // Retry logic for manual reveals too
      let retryCount = 0;
      const maxRetries = 2;
      const retryDelay = 3000; // 3 seconds between retries
      
      while (retryCount <= maxRetries) {
        try {
          if (retryCount > 0) {
            console.log(`🔄 Manual reveal retry ${retryCount}/${maxRetries}, waiting ${retryDelay/1000}s...`);
            toastStore.info(`Retrying reveal... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
          
          const gameState = gameStore.getGameState();
          const walletStoreInstance = gameStore.getWalletStore();
          const wallet = get(walletStoreInstance);
          
          console.log('🎯 Attempting manual reveal...');
          const result = await revealShot({
            secret: pendingSecret,
            gameState,
            wallet,
            contract: gameStore.getContract(),
            ethers: gameStore.getEthers(),
            loadGameState: gameStore.loadGameState,
            loadPlayerData: gameStore.loadPlayerData,
            onStatusUpdate: handleStatusUpdate
          });
          
          console.log('✅ Shot revealed successfully via manual reveal:', result);
          
          // Show appropriate message based on win/loss
          if (result && result.won) {
            toastStore.success('🎉 JACKPOT! YOU WON! 🎊');
            console.log('🎉 Shot revealed - YOU WON THE JACKPOT!');
          } else {
            toastStore.info('🎲 Shot revealed - No win this time. Better luck next shot!');
            console.log('🎲 Shot revealed - No win this time');
          }
          
          // Remove the revealed secret from localStorage
          const currentWallet = get(walletStore);
          if (currentWallet.connected && currentWallet.address && result.receipt?.hash) {
            removeRevealedSecret(currentWallet.address, result.receipt.hash);
          }
          
          return { success: true, result };
          
        } catch (error) {
          retryCount++;
          console.error(`❌ Manual reveal attempt ${retryCount} failed:`, error);
          
          // Check if it's a "no pending shot" error and we should retry
          const isPendingShotError = error.message?.includes('No pending shot') ||
                                    error.message?.includes('pending shot') ||
                                    error.message?.includes('reveal window');
          
          if (isPendingShotError && retryCount <= maxRetries) {
            console.log('🔄 Pending shot error detected, will retry...');
            continue; // Try again
          } else if (retryCount > maxRetries) {
            console.error('❌ All manual reveal attempts failed');
            toastStore.error(`Failed to reveal shot after ${maxRetries + 1} attempts: ${error.message}`);
            return { success: false, error };
          } else {
            // Non-retryable error
            console.error('❌ Non-retryable error in manual reveal:', error);
            toastStore.error('Failed to reveal shot: ' + error.message);
            return { success: false, error };
          }
        }
      }
      
      // This should never be reached, but just in case
      return { success: false, error: 'Unexpected error in reveal process' };
    } finally {
      setRevealingShot(false);
    }
  };

  /**
   * Handle saving secret to localStorage
   */
  const handleSaveToLocalStorage = (pendingSecret, pendingTxHash) => {
    if (!pendingSecret || !pendingTxHash) {
      toastStore.error('No secret or transaction hash available to save');
      return;
    }

    setSavingToLocalStorage(true);
    
    try {
      const currentWallet = get(walletStore);
      const success = saveSecretToStorage(pendingSecret, pendingTxHash, currentWallet.address);
      
      if (success) {
        toastStore.success('Secret saved to browser storage! You can retrieve it later from the debug panel.');
      } else {
        toastStore.error('Failed to save secret to browser storage');
      }
    } catch (error) {
      console.error('❌ Failed to save secret to localStorage:', error);
      toastStore.error('Failed to save secret to browser storage');
    } finally {
      setSavingToLocalStorage(false);
    }
  };

  /**
   * Handle saving secret for later (clipboard + localStorage)
   */
  const handleSaveForLater = async (pendingSecret) => {
    if (!pendingSecret) {
      toastStore.error('No secret available to copy');
      return;
    }
    
    setCopyingToClipboard(true);
    
    try {
      const success = await copySecretToClipboard(pendingSecret);
      if (success) {
        toastStore.success(`Secret copied to clipboard: ${pendingSecret}`);
      } else {
        toastStore.info(`Save this secret: ${pendingSecret}`);
      }
    } catch (error) {
      toastStore.info(`Save this secret: ${pendingSecret}`);
    } finally {
      setCopyingToClipboard(false);
    }
  };

  return {
    handleTakeShot,
    handleTakeFirstShot,
    handleSponsorRound,
    handleSwitchNetwork,
    handleRevealNow,
    handleSaveToLocalStorage,
    handleSaveForLater
  };
};