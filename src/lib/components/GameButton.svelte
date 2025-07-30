<script>
  console.log('🔧 GameButton component loading...');
  
  import { gameStore, canTakeShot, cooldownRemaining, isLoading, contractDeployed, gameError, currentPot, GameActions } from '../stores/game/index.js';
  import { walletStore, isConnected, isCorrectNetwork } from '../stores/wallet.js';
  import { toastStore } from '../stores/toast.js';
  import { debugMode } from '../stores/debug.js';
  import { GAME_CONFIG, NETWORK_CONFIG, formatEth, formatTime as configFormatTime } from '../config.js';
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';

  console.log('✅ GameButton imports loaded successfully');

  let cooldownTimer = null;
  let timeRemaining = 0;
  let shotFlowState = 'idle'; // 'idle', 'committing', 'pending_reveal', 'revealing', 'completed'
  let shotFlowMessage = '';
  
  // Reveal confirmation modal state
  let showRevealModal = false;
  let pendingSecret = null;
  let pendingTxHash = null;
  let revealingShot = false;
  let savingToLocalStorage = false;
  let copyingToClipboard = false;

  // Format time remaining for display
  const formatTime = (seconds) => {
    if (seconds <= 0) return '';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Start cooldown timer
  const startCooldownTimer = () => {
    if (cooldownTimer) {
      clearInterval(cooldownTimer);
    }

    cooldownTimer = setInterval(async () => {
      timeRemaining = $cooldownRemaining;
      if (timeRemaining <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        
        // CRITICAL FIX: Refresh player data when cooldown expires
        // This ensures canShoot is updated properly when cooldown reaches zero
        const wallet = get(walletStore);
        if (wallet.connected && wallet.address) {
          console.log('🔄 Cooldown expired - refreshing player data to update canShoot state');
          try {
            await gameStore.loadPlayerData(wallet.address);
            console.log('✅ Player data refreshed after cooldown expiry');
          } catch (error) {
            console.error('❌ Failed to refresh player data after cooldown:', error);
          }
        }
      }
    }, 1000);
  };

  // Handle taking a shot
  const handleTakeShot = async () => {
    console.log('🎯 TAKE SHOT BUTTON CLICKED!');
    console.log('🔍 Button click handler executing...');
    
    console.log('Debug info:', {
      isConnected: $isConnected,
      isCorrectNetwork: $isCorrectNetwork,
      canTakeShot: $canTakeShot,
      contractDeployed: $contractDeployed,
      isLoading: $isLoading,
      gameError: $gameError
    });

    if (!$isConnected) {
      console.log('❌ Wallet not connected - stopping here');
      toastStore.error('Please connect your wallet first');
      return;
    }

    if (!$isCorrectNetwork) {
      console.log('❌ Wrong network - stopping here');
      toastStore.error('Please switch to the correct network');
      return;
    }

    if (!$canTakeShot) {
      console.log('❌ Cannot take shot - stopping here');
      toastStore.error('Cannot take shot at this time');
      return;
    }

    console.log('✅ All checks passed, calling gameStore.takeShot()');
    console.log('🚀 About to call gameStore.takeShot()...');
    
    try {
      const gameState = gameStore.getGameState();
      const walletStore = gameStore.getWalletStore();
      const wallet = get(walletStore);
      
      const result = await GameActions.takeShot({
        useDiscount: false,
        discountId: null,
        customShotCost: null,
        gameState,
        wallet,
        contract: gameStore.getContract(),
        ethers: gameStore.getEthers(),
        updateGameState: gameStore.updateState,
        loadGameState: gameStore.loadGameState,
        loadPlayerData: gameStore.loadPlayerData
      });
      console.log('✅ GameActions.takeShot() completed:', result);
      
      // CRITICAL FIX: Show reveal confirmation modal with the secret
      if (result && result.secret) {
        console.log('🎯 Shot committed successfully, showing reveal modal');
        pendingSecret = result.secret;
        pendingTxHash = result.hash;
        showRevealModal = true;
        toastStore.success('Shot committed! Click "Reveal Now" to complete your shot.');
      }
    } catch (error) {
      console.error('❌ Failed to take shot:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      toastStore.error('Failed to take shot: ' + error.message);
    }
  };

  // Handle taking the first shot (when pot is empty)
  const handleTakeFirstShot = async () => {
    console.log('🎯 TAKE FIRST SHOT BUTTON CLICKED!');
    console.log('🔍 First shot handler executing...');
    
    console.log('Debug info:', {
      isConnected: $isConnected,
      isCorrectNetwork: $isCorrectNetwork,
      canTakeShot: $canTakeShot,
      contractDeployed: $contractDeployed,
      isLoading: $isLoading,
      currentPot: $currentPot,
      gameError: $gameError
    });

    if (!$isConnected) {
      console.log('❌ Wallet not connected - stopping here');
      toastStore.error('Please connect your wallet first');
      return;
    }

    if (!$isCorrectNetwork) {
      console.log('❌ Wrong network - stopping here');
      toastStore.error('Please switch to the correct network');
      return;
    }

    if (!$canTakeShot) {
      console.log('❌ Cannot take shot - stopping here');
      toastStore.error('Cannot take shot at this time');
      return;
    }

    console.log('✅ All checks passed, calling gameStore.takeShot() with first shot cost');
    console.log('🚀 About to call gameStore.takeShot() for first shot...');
    
    try {
      const gameState = gameStore.getGameState();
      const walletStore = gameStore.getWalletStore();
      const wallet = get(walletStore);
      
      const result = await GameActions.takeShot({
        useDiscount: false,
        discountId: null,
        customShotCost: GAME_CONFIG.FIRST_SHOT_COST_ETH,
        gameState,
        wallet,
        contract: gameStore.getContract(),
        ethers: gameStore.getEthers(),
        updateGameState: gameStore.updateState,
        loadGameState: gameStore.loadGameState,
        loadPlayerData: gameStore.loadPlayerData
      });
      console.log('✅ GameActions.takeShot() (first shot) completed:', result);
      
      // CRITICAL FIX: Show reveal confirmation modal with the secret
      if (result && result.secret) {
        console.log('🎯 First shot committed successfully, showing reveal modal');
        pendingSecret = result.secret;
        pendingTxHash = result.hash;
        showRevealModal = true;
        toastStore.success('First shot committed! Click "Reveal Now" to complete your shot.');
      }
    } catch (error) {
      console.error('❌ Failed to take first shot:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      toastStore.error('Failed to take first shot: ' + error.message);
    }
  };

  // Handle sponsor round
  const handleSponsorRound = async () => {
    console.log('💰 SPONSOR ROUND BUTTON CLICKED!');
    
    if (!$isConnected) {
      toastStore.error('Please connect your wallet first');
      return;
    }

    if (!$isCorrectNetwork) {
      toastStore.error('Please switch to the correct network');
      return;
    }

    try {
      const gameState = gameStore.getGameState();
      const walletStore = gameStore.getWalletStore();
      const wallet = get(walletStore);
      
      const result = await GameActions.sponsorRound({
        name: 'Anonymous Sponsor',
        logoUrl: '/icons/sponsor-default.png',
        sponsorUrl: null,
        gameState,
        wallet,
        contract: gameStore.getContract(),
        ethers: gameStore.getEthers(),
        loadGameState: gameStore.loadGameState
      });
      console.log('✅ GameActions.sponsorRound() completed:', result);
    } catch (error) {
      console.error('❌ Failed to sponsor round:', error);
      toastStore.error('Failed to sponsor round: ' + error.message);
    }
  };

  // Switch to correct network
  const handleSwitchNetwork = async () => {
    try {
      await walletStore.switchNetwork(NETWORK_CONFIG.CHAIN_ID);
    } catch (error) {
      toastStore.error('Failed to switch network');
    }
  };

  // Manual refresh for debugging
  const handleManualRefresh = async () => {
    console.log('🔄 Manual refresh triggered');
    const wallet = get(walletStore);
    if (wallet.connected && wallet.address) {
      console.log('🔄 Refreshing player data manually...', {
        address: wallet.address,
        currentCanShoot: $canTakeShot,
        currentCooldown: $cooldownRemaining,
        currentPot: $currentPot
      });
      try {
        await gameStore.loadPlayerData(wallet.address);
        console.log('✅ Manual player data refresh completed', {
          newCanShoot: $canTakeShot,
          newCooldown: $cooldownRemaining
        });
        toastStore.success('Player data refreshed');
      } catch (error) {
        console.error('❌ Manual refresh failed:', error);
        toastStore.error('Failed to refresh: ' + error.message);
      }
    } else {
      toastStore.error('Wallet not connected');
    }
  };

  // Deep contract debugging
  const handleDeepDebug = async () => {
    console.log('🔍 Deep contract debugging...');
    const wallet = get(walletStore);
    if (!wallet.connected || !wallet.address) {
      toastStore.error('Wallet not connected');
      return;
    }

    try {
      // Access the contract directly for debugging
      const gameState = get(gameStore);
      console.log('🔍 Current game state:', {
        contractDeployed: $contractDeployed,
        isLoading: $isLoading,
        gameError: $gameError
      });

      // Check for pending shots - this is likely the issue!
      console.log('🔍 Checking for pending shots...');
      toastStore.info('Checking for pending shots that might be blocking new shots...');
      
      // Force a complete game state reload
      await gameStore.loadGameState();
      await gameStore.loadPlayerData(wallet.address);
      
      console.log('🔍 After forced reload:', {
        canShoot: $canTakeShot,
        cooldown: $cooldownRemaining,
        pot: $currentPot,
        contractDeployed: $contractDeployed
      });
      
    } catch (error) {
      console.error('❌ Deep debug failed:', error);
      toastStore.error('Debug failed: ' + error.message);
    }
  };

  // Check for pending shots that might be blocking new shots
  const handleCheckPendingShot = async () => {
    console.log('🔍 Checking for pending shots...');
    const wallet = get(walletStore);
    if (!wallet.connected || !wallet.address) {
      toastStore.error('Wallet not connected');
      return;
    }

    try {
      console.log('🔍 COMPREHENSIVE GAME STATE CHECK:');
      console.log('=====================================');
      
      // Get current game state
      const gameState = get(gameStore);
      console.log('📋 Current game state:', {
        contractDeployed: gameState.contractDeployed,
        canShoot: gameState.canShoot,
        cooldownRemaining: gameState.cooldownRemaining,
        currentPot: gameState.currentPot,
        loading: gameState.loading,
        takingShot: gameState.takingShot,
        error: gameState.error
      });
      
      // Check wallet state
      console.log('📋 Wallet state:', {
        connected: wallet.connected,
        address: wallet.address,
        network: wallet.network
      });
      
      // Force refresh player data and check again
      console.log('🔄 Force refreshing player data...');
      await gameStore.loadPlayerData(wallet.address);
      
      // Get updated state after refresh
      const updatedState = get(gameStore);
      console.log('📋 Updated game state after refresh:', {
        canShoot: updatedState.canShoot,
        cooldownRemaining: updatedState.cooldownRemaining,
        lastShotTime: updatedState.playerStats?.lastShotTime,
        totalShots: updatedState.playerStats?.totalShots
      });
      
      // Analyze the issue
      if (updatedState.contractDeployed === false) {
        console.log('🚨 CONTRACT NOT DEPLOYED!');
        toastStore.error('Contract is not deployed. This is the root issue.');
      } else if (updatedState.cooldownRemaining > 0) {
        console.log('⏳ COOLDOWN STILL ACTIVE:', updatedState.cooldownRemaining, 'seconds');
        toastStore.info(`Cooldown still active: ${Math.ceil(updatedState.cooldownRemaining / 60)} minutes remaining`);
      } else if (!updatedState.canShoot) {
        console.log('🚨 CANNOT SHOOT - LIKELY PENDING SHOT ISSUE');
        console.log('🚨 This suggests you have a pending shot that was never revealed.');
        console.log('🚨 The commit-reveal process requires both commit AND reveal steps.');
        console.log('🚨 If you only did the commit (first shot), you need to reveal it.');
        console.log('🚨 If the reveal window expired (>256 blocks), this is a contract bug.');
        
        toastStore.info('You have a pending shot that needs to be resolved. Check the pending shot manager above for options.');
        
        // Provide specific guidance
        console.log('');
        console.log('🔧 POSSIBLE SOLUTIONS:');
        console.log('  1. If you remember your secret from the first shot, try to reveal it');
        console.log('  2. Wait for the contract to be updated with a cleanup function');
        console.log('  3. Contact the developers about this expired pending shot issue');
        
      } else if (updatedState.canShoot && updatedState.cooldownRemaining === 0) {
        console.log('✅ CONTRACT STATE SAYS YOU CAN SHOOT!');
        console.log('✅ This might be a UI synchronization issue.');
        toastStore.success('Game state says you can shoot! The UI might be out of sync.');
      } else {
        console.log('❓ UNKNOWN ISSUE - Check the debug info above');
        toastStore.info('Unknown issue. Check console for detailed debug information.');
      }
      
      console.log('=====================================');
      
    } catch (error) {
      console.error('❌ Game state check failed:', error);
      toastStore.error('State check failed: ' + error.message);
    }
  };

  // Handle revealing the shot immediately
  const handleRevealNow = async () => {
    if (!pendingSecret) {
      toastStore.error('No secret available to reveal');
      return;
    }

    console.log('🎯 Revealing shot with secret:', pendingSecret);
    revealingShot = true;
    
    try {
      const gameState = gameStore.getGameState();
      const walletStore = gameStore.getWalletStore();
      const wallet = get(walletStore);
      
      const result = await GameActions.revealShot({
        secret: pendingSecret,
        gameState,
        wallet,
        contract: gameStore.getContract(),
        ethers: gameStore.getEthers(),
        loadGameState: gameStore.loadGameState,
        loadPlayerData: gameStore.loadPlayerData
      });
      
      console.log('✅ Shot revealed successfully:', result);
      
      // Show appropriate message based on win/loss
      if (result.won) {
        toastStore.success('🎉 JACKPOT! YOU WON! 🎊');
        console.log('🎉 Shot revealed - YOU WON THE JACKPOT!');
      } else {
        toastStore.info('🎲 Shot revealed - No win this time. Better luck next shot!');
        console.log('🎲 Shot revealed - No win this time');
      }
      
      // Close the modal and clear state
      showRevealModal = false;
      pendingSecret = null;
      pendingTxHash = null;
      
      // Remove the revealed secret from localStorage
      try {
        const wallet = get(walletStore);
        if (wallet.connected && wallet.address) {
          const savedSecretsKey = `ethshot_saved_secrets_${wallet.address}`;
          const existingSecrets = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
          
          // Filter out the revealed secret
          const updatedSecrets = existingSecrets.filter(key => {
            const secretDataStr = localStorage.getItem(key);
            if (secretDataStr) {
              const secretData = JSON.parse(secretDataStr);
              return secretData.txHash !== result.receipt.hash;
            }
            return true;
          });
          
          // Update the saved secrets list
          localStorage.setItem(savedSecretsKey, JSON.stringify(updatedSecrets));
          
          // Also remove the individual secret entry
          const secretKey = `ethshot_secret_${wallet.address}_${result.receipt.hash.slice(0, 10)}`;
          localStorage.removeItem(secretKey);
        }
      } catch (error) {
        console.error('❌ Failed to remove revealed secret from localStorage:', error);
      }
      
    } catch (error) {
      console.error('❌ Failed to reveal shot:', error);
      toastStore.error('Failed to reveal shot: ' + error.message);
    } finally {
      revealingShot = false;
    }
  };

  // Handle saving secret to localStorage
  const handleSaveToLocalStorage = () => {
    if (!pendingSecret || !pendingTxHash) {
      toastStore.error('No secret or transaction hash available to save');
      return;
    }

    savingToLocalStorage = true;
    
    try {
      const wallet = get(walletStore);
      const secretData = {
        secret: pendingSecret,
        txHash: pendingTxHash,
        walletAddress: wallet.address,
        timestamp: Date.now(),
        blockNumber: null // Will be filled when we get block info
      };

      // Create a unique key for this secret
      const secretKey = `ethshot_secret_${wallet.address}_${pendingTxHash.slice(0, 10)}`;
      
      // Save to localStorage
      localStorage.setItem(secretKey, JSON.stringify(secretData));
      
      // Also maintain a list of all saved secrets for this wallet
      const savedSecretsKey = `ethshot_saved_secrets_${wallet.address}`;
      const existingSecrets = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
      
      // Add this secret to the list if not already there
      if (!existingSecrets.includes(secretKey)) {
        existingSecrets.push(secretKey);
        localStorage.setItem(savedSecretsKey, JSON.stringify(existingSecrets));
      }
      
      toastStore.success('Secret saved to browser storage! You can retrieve it later from the debug panel.');
      console.log('💾 Secret saved to localStorage:', secretKey);
      
    } catch (error) {
      console.error('❌ Failed to save secret to localStorage:', error);
      toastStore.error('Failed to save secret to browser storage');
    } finally {
      savingToLocalStorage = false;
    }
    
    // Don't close modal - let user choose to reveal or close manually
    // showRevealModal = false;
    // pendingSecret = null;
    // pendingTxHash = null;
  };

  // Handle saving secret for later (clipboard + localStorage)
  const handleSaveForLater = () => {
    if (!pendingSecret) {
      toastStore.error('No secret available to copy');
      return;
    }
    
    copyingToClipboard = true;
    
    // Copy secret to clipboard
    navigator.clipboard.writeText(pendingSecret).then(() => {
      toastStore.success(`Secret copied to clipboard: ${pendingSecret}`);
    }).catch(() => {
      toastStore.info(`Save this secret: ${pendingSecret}`);
    }).finally(() => {
      copyingToClipboard = false;
    });
    
    // Don't close modal - let user choose to reveal or close manually
    // showRevealModal = false;
    // pendingSecret = null;
    // pendingTxHash = null;
  };

  // Clean up expired pending shot
  const handleCleanupExpiredShot = async () => {
    console.log('🧹 Cleaning up expired pending shot...');
    const wallet = get(walletStore);
    if (!wallet.connected || !wallet.address) {
      toastStore.error('Wallet not connected');
      return;
    }

    try {
      const gameState = get(gameStore);
      if (!gameState.contractDeployed) {
        toastStore.error('Contract not deployed');
        return;
      }

      console.log('🧹 Attempting to clean up expired pending shot for:', wallet.address);
      toastStore.info('Attempting to clean up expired pending shot...');
      
      // Call the cleanup function from the service
      const cleanupGameState = gameStore.getGameState();
      const cleanupWalletStore = gameStore.getWalletStore();
      const cleanupWallet = get(cleanupWalletStore);
      
      await GameActions.cleanupExpiredPendingShot({
        playerAddress: cleanupWallet.address,
        gameState: cleanupGameState,
        wallet: cleanupWallet,
        contract: gameStore.getContract(),
        ethers: gameStore.getEthers()
      });
      
      console.log('✅ Expired pending shot cleanup completed');
      toastStore.success('Expired pending shot cleaned up! You can now take shots again.');
      
      // Refresh player data
      await gameStore.loadPlayerData(wallet.address);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      
      let errorMessage = 'Cleanup failed';
      if (error.message.includes('No pending shot to clean up')) {
        errorMessage = 'No pending shot found to clean up';
      } else if (error.message.includes('Pending shot not yet expired')) {
        errorMessage = 'Pending shot has not expired yet (need to wait 256 blocks ≈ 51-85 minutes)';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction cancelled';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toastStore.error(errorMessage);
    }
  };

  // Reactive statements
  $: timeRemaining = $cooldownRemaining;
  $: if (timeRemaining > 0 && !cooldownTimer) {
    startCooldownTimer();
  }
  
  // Get individual loading states from the store
  $: gameState = $gameStore;
  $: isPreparingData = gameState.loading && !gameState.takingShot;
  $: isTakingShot = gameState.takingShot;
  
  // Enhanced loading state detection with specific messages
  $: isLoadingState = $isLoading;
  $: loadingMessage = isTakingShot ? 'Processing your shot...' : 'Loading game data...';
  
  // Check if pot is empty (first shot scenario) - simplified to handle both string and numeric values
  $: isPotEmpty = parseFloat($currentPot || '0') === 0;
  $: isFirstShotReady = isPotEmpty && $canTakeShot && !$isLoading && timeRemaining <= 0;
  
  // CRITICAL FIX: Regular shot should be available when canTakeShot is true AND pot is NOT empty
  $: isRegularShotReady = !isPotEmpty && $canTakeShot && !$isLoading && timeRemaining <= 0;

  // Check for saved secrets in localStorage on component mount
  const checkForSavedSecrets = () => {
    try {
      const wallet = get(walletStore);
      if (!wallet.connected || !wallet.address) {
        return;
      }

      // Get the list of saved secrets for this wallet
      const savedSecretsKey = `ethshot_saved_secrets_${wallet.address}`;
      let savedSecretKeys = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
      
      // Filter out any invalid or expired secrets
      savedSecretKeys = savedSecretKeys.filter(key => {
        try {
          const secretDataStr = localStorage.getItem(key);
          if (!secretDataStr) return false;
          
          const secretData = JSON.parse(secretDataStr);
          // Basic validation - check if required fields exist
          return secretData.secret && secretData.txHash && secretData.walletAddress === wallet.address;
        } catch (e) {
          // Remove invalid entries
          return false;
        }
      });
      
      // Update the saved secrets list in localStorage
      localStorage.setItem(savedSecretsKey, JSON.stringify(savedSecretKeys));
      
      // If we have saved secrets, get the most recent one
      if (savedSecretKeys.length > 0) {
        // Get the most recent secret (last in the array)
        const mostRecentKey = savedSecretKeys[savedSecretKeys.length - 1];
        const secretDataStr = localStorage.getItem(mostRecentKey);
        
        if (secretDataStr) {
          const secretData = JSON.parse(secretDataStr);
          
          // Set the pending secret and show the reveal modal
          pendingSecret = secretData.secret;
          pendingTxHash = secretData.txHash;
          showRevealModal = true;
          
          toastStore.info('Found saved shot! Click "Reveal Now" to complete your shot.');
          console.log('💾 Found saved secret in localStorage:', mostRecentKey);
        }
      }
    } catch (error) {
      console.error('❌ Failed to check for saved secrets in localStorage:', error);
    }
  };

  onMount(() => {
    console.log('🔧 GameButton onMount called');
    console.log('🔧 Cooldown remaining:', $cooldownRemaining);
    
    // Check for saved secrets in localStorage
    checkForSavedSecrets();
    
    if ($cooldownRemaining > 0) {
      startCooldownTimer();
    }
    
    console.log('✅ GameButton component mounted successfully');
  });

  onDestroy(() => {
    if (cooldownTimer) {
      clearInterval(cooldownTimer);
    }
  });
</script>

<div class="flex flex-col items-center space-y-6">
  <!-- Main Game Button -->
  <div class="relative">
    {#if $contractDeployed === false}
      <!-- Contract Not Deployed -->
      <button
        class="btn-game btn-error"
        disabled
      >
        <span class="text-2xl font-bold">Contract Not Deployed</span>
        <span class="text-sm opacity-80">Please deploy the smart contract first</span>
      </button>
    {:else if !$isConnected}
      <!-- Not Connected -->
      <button
        on:click={() => walletStore.connect()}
        class="btn-game btn-connect"
        disabled={$isLoading}
      >
        <span class="text-2xl font-bold">Connect Wallet</span>
        <span class="text-sm opacity-80">to take your shot</span>
      </button>
    {:else if !$isCorrectNetwork}
      <!-- Wrong Network -->
      <button
        on:click={handleSwitchNetwork}
        class="btn-game btn-warning"
        disabled={$isLoading}
      >
        <span class="text-2xl font-bold">Switch Network</span>
        <span class="text-sm opacity-80">to continue playing</span>
      </button>
    {:else if timeRemaining > 0}
      <!-- Cooldown Active -->
      <button
        class="btn-game btn-disabled"
        disabled
      >
        <span class="text-2xl font-bold">Cooldown Active</span>
        <span class="text-sm opacity-80">Next shot in {formatTime(timeRemaining)}</span>
      </button>
    {:else if isLoadingState}
      <!-- Loading State with Spinner -->
      <button
        class="btn-game btn-loading"
        disabled
      >
        <div class="flex items-center space-x-3">
          <div class="spinner w-6 h-6"></div>
          <div class="flex flex-col">
            <span class="text-2xl font-bold">{loadingMessage}</span>
            <span class="text-sm opacity-80">{isTakingShot ? 'Confirm in wallet' : 'Please wait...'}</span>
          </div>
        </div>
      </button>
    {:else if isFirstShotReady}
      <!-- First Shot (Empty Pot) -->
      <div class="flex flex-col space-y-3">
        <button
          on:click={handleTakeFirstShot}
          class="btn-game btn-first-shot animate-glow"
          disabled={false}
          style="pointer-events: auto; cursor: pointer;"
        >
          <span class="text-3xl font-black">🚀 TAKE THE FIRST SHOT</span>
          <span class="text-sm opacity-90">{formatEth(GAME_CONFIG.FIRST_SHOT_COST_ETH)} ETH • Start the pot!</span>
        </button>
        
        <!-- Sponsor Option -->
        <button
          on:click={handleSponsorRound}
          class="btn-sponsor"
          disabled={$isLoading}
        >
          <span class="text-lg font-bold">💰 Sponsor Round</span>
          <span class="text-xs opacity-80">{formatEth(GAME_CONFIG.SPONSOR_COST_ETH)} ETH • Add to pot without playing</span>
        </button>
      </div>
    {:else if isRegularShotReady}
      <!-- Ready to Take Shot -->
      <button
        on:click={handleTakeShot}
        class="btn-game btn-primary animate-glow"
        disabled={false}
        style="pointer-events: auto; cursor: pointer;"
      >
        <span class="text-3xl font-black">🎯 TAKE SHOT</span>
        <span class="text-sm opacity-90">{formatEth(GAME_CONFIG.SHOT_COST_ETH)} ETH • {GAME_CONFIG.WIN_PERCENTAGE}% chance to win</span>
      </button>
    {:else}
      <!-- Cannot Take Shot -->
      <div class="flex flex-col space-y-2">
        <button
          class="btn-game btn-disabled"
          disabled
        >
          <span class="text-2xl font-bold">Cannot Take Shot</span>
          <span class="text-sm opacity-80">Check wallet connection and cooldown</span>
        </button>
        
        <!-- Debug info and manual refresh - only show when debug mode is enabled -->
        {#if $isConnected && $debugMode}
          <div class="text-xs text-gray-400 text-center">
            Debug: canShoot={$canTakeShot}, cooldown={$cooldownRemaining}s, pot={$currentPot}
          </div>
          <div class="flex flex-col space-y-2">
            <button
              on:click={handleManualRefresh}
              class="btn-debug"
              disabled={$isLoading}
            >
              🔄 Refresh Player Data
            </button>
            <button
              on:click={handleCheckPendingShot}
              class="btn-debug"
              disabled={$isLoading}
            >
              🔍 Check Pending Shots
            </button>
            <button
              on:click={handleDeepDebug}
              class="btn-debug"
              disabled={$isLoading}
            >
              🔧 Deep Debug
            </button>
            <button
              on:click={handleCleanupExpiredShot}
              class="btn-debug"
              disabled={$isLoading}
            >
              🧹 Cleanup Expired Shot
            </button>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Pulse Effect for Ready State -->
    {#if isRegularShotReady || isFirstShotReady}
      <div class="absolute inset-0 rounded-2xl bg-red-500/20 animate-ping pointer-events-none"></div>
    {/if}

    <!-- Status Bar for Loading States -->
    {#if isLoadingState}
      <div class="status-bar-container w-80">
        <div class="status-bar">
          <div class="status-bar-fill" style="width: 75%;"></div>
        </div>
        <div class="status-text">
          <span class="status-message">{loadingMessage}</span>
          <span class="status-detail">{isTakingShot ? 'Waiting for wallet confirmation...' : 'Initializing...'}</span>
        </div>
      </div>
    {:else if timeRemaining > 0}
      <!-- Cooldown Status Bar -->
      <div class="status-bar-container w-80">
        <div class="status-bar cooldown-bar">
          <div class="status-bar-fill cooldown-fill" style="width: {Math.max(0, 100 - (timeRemaining / GAME_CONFIG.COOLDOWN_SECONDS * 100))}%;"></div>
        </div>
        <div class="status-text">
          <span class="status-message">Cooldown Active</span>
          <span class="status-detail">Next shot in {formatTime(timeRemaining)}</span>
        </div>
      </div>
    {/if}
  </div>

  <!-- Game Stats -->
  <div class="grid grid-cols-3 gap-4 text-center">
    <div class="bg-gray-800/50 rounded-lg p-3">
      <div class="text-lg font-bold text-yellow-400">{GAME_CONFIG.WIN_PERCENTAGE}%</div>
      <div class="text-xs text-gray-400">Win Chance</div>
    </div>
    <div class="bg-gray-800/50 rounded-lg p-3">
      <div class="text-lg font-bold text-green-400">{GAME_CONFIG.WINNER_PERCENTAGE}%</div>
      <div class="text-xs text-gray-400">Winner Gets</div>
    </div>
    <div class="bg-gray-800/50 rounded-lg p-3">
      <div class="text-lg font-bold text-blue-400">{configFormatTime(GAME_CONFIG.COOLDOWN_SECONDS)}</div>
      <div class="text-xs text-gray-400">Cooldown</div>
    </div>
  </div>

  <!-- Error Message -->
  {#if $gameError}
    <div class="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-center max-w-md">
      <div class="text-red-400 font-semibold mb-2">⚠️ Game Error</div>
      <div class="text-red-300 text-sm">{$gameError}</div>
      {#if $contractDeployed === false}
        <div class="text-red-200 text-xs mt-2">
          Deploy the smart contract using: <code class="bg-red-800/30 px-1 rounded">pnpm run deploy:testnet</code>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Risk Warning -->
  <div class="text-center text-xs text-gray-500 max-w-md">
    <p>
      ⚠️ This is a game of chance. Only play with ETH you can afford to lose.
      Each shot has a {GAME_CONFIG.WIN_PERCENTAGE}% chance of winning the current pot.
    </p>
  </div>
</div>

<!-- Reveal Confirmation Modal -->
{#if showRevealModal}
  <div class="modal-overlay" on:click|self={() => showRevealModal = false}>
    <div class="reveal-modal">
      <div class="modal-header">
        <h2>🎯 Shot Committed Successfully!</h2>
        <button
          class="close-btn"
          on:click={() => showRevealModal = false}
          disabled={revealingShot}
        >
          ✕
        </button>
      </div>
      
      <div class="modal-content">
        <p class="success-message">
          Your shot has been committed to the blockchain! Now you need to reveal it to see if you won.
        </p>
        
        {#if pendingTxHash}
          <div class="tx-info">
            <p><strong>Transaction:</strong> <code class="tx-hash">{pendingTxHash.slice(0, 10)}...{pendingTxHash.slice(-8)}</code></p>
          </div>
        {/if}
        
        <div class="secret-info">
          <p><strong>Your Secret:</strong></p>
          <div class="secret-display">
            <code class="secret-code">{pendingSecret}</code>
          </div>
          <p class="secret-warning">
            ⚠️ <strong>Important:</strong> Save this secret! You'll need it to reveal your shot if you don't do it now.
          </p>
        </div>
        
        {#if revealingShot}
          <div class="status-message">
            <div class="flex items-center space-x-2">
              <div class="spinner-small"></div>
              <span>Communicating with blockchain...</span>
            </div>
          </div>
        {/if}
        
        {#if savingToLocalStorage}
          <div class="status-message">
            <div class="flex items-center space-x-2">
              <div class="spinner-small"></div>
              <span>Saving to browser storage...</span>
            </div>
          </div>
        {/if}
        
        {#if copyingToClipboard}
          <div class="status-message">
            <div class="flex items-center space-x-2">
              <div class="spinner-small"></div>
              <span>Copying to clipboard...</span>
            </div>
          </div>
        {/if}
        
        <div class="modal-actions">
          <button
            class="reveal-now-btn"
            on:click={handleRevealNow}
            disabled={revealingShot || savingToLocalStorage || copyingToClipboard}
          >
            {#if revealingShot}
              <div class="spinner-small"></div>
              Revealing...
            {:else}
              🎲 Reveal Now
            {/if}
          </button>
          
          <button
            class="save-storage-btn"
            on:click={handleSaveToLocalStorage}
            disabled={revealingShot || savingToLocalStorage || copyingToClipboard}
          >
            {#if savingToLocalStorage}
              <div class="spinner-small"></div>
              Saving...
            {:else}
              💾 Save to Browser
            {/if}
          </button>
          
          <button
            class="save-clipboard-btn"
            on:click={handleSaveForLater}
            disabled={revealingShot || savingToLocalStorage || copyingToClipboard}
          >
            {#if copyingToClipboard}
              <div class="spinner-small"></div>
              Copying...
            {:else}
              📋 Copy to Clipboard
            {/if}
          </button>
        </div>
        
        <div class="modal-footer">
          <p class="footer-text">
            You can reveal your shot anytime within 256 blocks (~51-85 minutes) after committing.
          </p>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .btn-game {
    @apply relative flex flex-col items-center justify-center;
    @apply w-80 h-32 rounded-2xl border-2;
    @apply font-bold text-white transition-all duration-300;
    @apply focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-gray-900;
    @apply transform hover:scale-105 active:scale-95;
  }

  .btn-primary {
    @apply bg-gradient-to-br from-red-500 to-red-600;
    @apply border-red-400 hover:from-red-400 hover:to-red-500;
    @apply shadow-lg hover:shadow-xl;
    @apply focus:ring-red-500;
  }

  .btn-connect {
    @apply bg-gradient-to-br from-blue-500 to-blue-600;
    @apply border-blue-400 hover:from-blue-400 hover:to-blue-500;
    @apply shadow-lg hover:shadow-xl;
    @apply focus:ring-blue-500;
  }

  .btn-warning {
    @apply bg-gradient-to-br from-yellow-500 to-yellow-600;
    @apply border-yellow-400 hover:from-yellow-400 hover:to-yellow-500;
    @apply shadow-lg hover:shadow-xl;
    @apply focus:ring-yellow-500;
  }

  .btn-error {
    @apply bg-gradient-to-br from-red-800 to-red-900;
    @apply border-red-700 cursor-not-allowed;
    @apply opacity-80;
  }

  .btn-disabled {
    @apply bg-gray-700 border-gray-600 cursor-not-allowed;
    @apply opacity-60;
  }

  .btn-loading {
    @apply bg-gradient-to-br from-purple-500 to-purple-600;
    @apply border-purple-400;
    @apply focus:ring-purple-500;
  }

  .btn-first-shot {
    @apply bg-gradient-to-br from-green-500 to-green-600;
    @apply border-green-400 hover:from-green-400 hover:to-green-500;
    @apply shadow-lg hover:shadow-xl;
    @apply focus:ring-green-500;
  }

  .btn-sponsor {
    @apply relative flex flex-col items-center justify-center;
    @apply w-80 h-20 rounded-xl border-2;
    @apply font-bold text-white transition-all duration-300;
    @apply focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-gray-900;
    @apply transform hover:scale-105 active:scale-95;
    @apply bg-gradient-to-br from-yellow-600 to-yellow-700;
    @apply border-yellow-500 hover:from-yellow-500 hover:to-yellow-600;
    @apply shadow-md hover:shadow-lg;
    @apply focus:ring-yellow-500;
  }

  .btn-sponsor:disabled {
    @apply transform-none hover:scale-100;
    @apply opacity-60 cursor-not-allowed;
  }

  .btn-game:disabled {
    @apply transform-none hover:scale-100;
  }

  .spinner {
    @apply border-2 border-gray-300 border-t-white rounded-full animate-spin;
  }

  /* Status Bar Styles */
  .status-bar-container {
    @apply w-full mt-4;
  }

  .status-bar {
    @apply w-full h-2 bg-gray-700 rounded-full overflow-hidden;
  }

  .status-bar-fill {
    @apply h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out;
    position: relative;
    overflow: hidden;
  }

  .status-bar-fill::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    animation: shimmer 2s infinite;
  }

  .cooldown-bar {
    @apply bg-gray-600;
  }

  .cooldown-fill {
    @apply bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all duration-1000 ease-out;
    position: relative;
    overflow: hidden;
  }

  .cooldown-fill::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .status-text {
    @apply mt-2 text-center space-y-1;
  }

  .status-message {
    @apply text-sm font-semibold text-white;
  }

  .status-detail {
    @apply text-xs text-gray-400;
  }

  @keyframes glow {
    0%, 100% {
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
    }
    50% {
      box-shadow: 0 0 40px rgba(239, 68, 68, 0.8);
    }
  }

  .animate-glow {
    animation: glow 2s ease-in-out infinite;
  }

  @keyframes ping {
    75%, 100% {
      transform: scale(1.1);
      opacity: 0;
    }
  }

  .animate-ping {
    animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  .btn-debug {
    @apply px-4 py-2 text-xs font-medium text-gray-300;
    @apply bg-gray-700 hover:bg-gray-600 border border-gray-600;
    @apply rounded-lg transition-colors duration-200;
    @apply focus:outline-none focus:ring-2 focus:ring-gray-500;
  }

  .btn-debug:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  /* Reveal Modal Styles */
  .modal-overlay {
    @apply fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50;
    backdrop-filter: blur(4px);
  }

  .reveal-modal {
    @apply bg-gray-900 border-2 border-red-500 rounded-2xl p-6 max-w-md w-full mx-4;
    @apply shadow-2xl;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    animation: modalSlideIn 0.3s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      transform: translateY(-20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    @apply flex justify-between items-center mb-4;
  }

  .modal-header h2 {
    @apply text-xl font-bold text-green-400 m-0;
  }

  .close-btn {
    @apply text-gray-400 hover:text-white text-xl font-bold;
    @apply w-8 h-8 flex items-center justify-center rounded-full;
    @apply hover:bg-gray-700 transition-colors duration-200;
    @apply border-none bg-transparent cursor-pointer;
  }

  .close-btn:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .modal-content {
    @apply text-white;
  }

  .success-message {
    @apply text-green-300 mb-4 text-sm leading-relaxed;
  }

  .tx-info {
    @apply bg-gray-800 rounded-lg p-3 mb-4;
  }

  .tx-info p {
    @apply text-sm text-gray-300 m-0;
  }

  .tx-hash {
    @apply bg-gray-700 px-2 py-1 rounded text-xs font-mono text-blue-300;
  }

  .secret-info {
    @apply bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded-lg p-4 mb-4;
  }

  .secret-info p {
    @apply text-sm text-yellow-200 m-0 mb-2;
  }

  .secret-display {
    @apply bg-gray-800 rounded-lg p-3 mb-3;
  }

  .secret-code {
    @apply font-mono text-lg text-green-400 font-bold;
    word-break: break-all;
  }

  .secret-warning {
    @apply text-xs text-yellow-300 font-medium;
  }

  .modal-actions {
    @apply flex flex-col gap-2 mb-4;
  }

  .reveal-now-btn {
    @apply w-full bg-gradient-to-r from-green-500 to-green-600;
    @apply text-white font-bold py-3 px-4 rounded-lg;
    @apply hover:from-green-400 hover:to-green-500 transition-all duration-200;
    @apply border-none cursor-pointer;
    @apply flex items-center justify-center gap-2;
  }

  .save-storage-btn {
    @apply w-full bg-gradient-to-r from-purple-500 to-purple-600;
    @apply text-white font-bold py-3 px-4 rounded-lg;
    @apply hover:from-purple-400 hover:to-purple-500 transition-all duration-200;
    @apply border-none cursor-pointer;
  }

  .save-clipboard-btn {
    @apply w-full bg-gradient-to-r from-blue-500 to-blue-600;
    @apply text-white font-bold py-3 px-4 rounded-lg;
    @apply hover:from-blue-400 hover:to-blue-500 transition-all duration-200;
    @apply border-none cursor-pointer;
  }

  .reveal-now-btn:disabled,
  .save-storage-btn:disabled,
  .save-clipboard-btn:disabled {
    @apply opacity-60 cursor-not-allowed;
  }

  .spinner-small {
    @apply w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin;
  }

  .modal-footer {
    @apply border-t border-gray-700 pt-3;
  }

  .footer-text {
    @apply text-xs text-gray-400 text-center m-0;
  }

  .status-message {
    @apply bg-gray-800 rounded-lg p-3 mb-4 text-center;
  }

  .status-message span {
    @apply text-sm text-blue-300 font-medium;
  }

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .btn-game {
      @apply w-72 h-28;
    }
    
    .btn-game span:first-child {
      @apply text-xl;
    }
    
    .btn-sponsor {
      @apply w-72 h-16;
    }
    
    .btn-sponsor span:first-child {
      @apply text-base;
    }

    .reveal-modal {
      @apply mx-2 p-4;
    }

    .modal-actions {
      @apply flex-col gap-2;
    }
    
    .reveal-now-btn,
    .save-storage-btn,
    .save-clipboard-btn {
      @apply text-sm py-2;
    }

    /* Mobile Status Bar Styles */
    .status-bar-container {
      @apply w-72;
    }
    
    .status-message {
      @apply text-xs;
    }
    
    .status-detail {
      @apply text-xs;
    }
  }
</style>