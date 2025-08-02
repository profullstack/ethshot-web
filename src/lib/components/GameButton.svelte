<script>
  console.log('🔧 GameButton component loading...');
  
  import { gameStore, canTakeShot, cooldownRemaining, isLoading, contractDeployed, gameError, currentPot } from '../stores/game/index.js';
  import { walletStore, isConnected, isCorrectNetwork } from '../stores/wallet.js';
  import { toastStore } from '../stores/toast.js';
  import { debugMode } from '../stores/debug.js';
  import { GAME_CONFIG } from '../config.js';
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';

  // Import utilities
  import {
    createStatusUpdateHandler,
    createCooldownTimer,
    calculateCooldownProgress,
    resetTransactionStatus,
    setCooldownStatus,
    formatTime
  } from '../utils/game-button-utils.js';
  import { createGameActionHandlers } from '../utils/game-button-handlers.js';
  import { checkForSavedSecrets } from '../utils/game-button-storage.js';
  import { cleanupExpiredPendingShot } from '../services/game-actions.js';

  // Import sub-components
  import MainGameButton from './MainGameButton.svelte';
  import StatusBar from './StatusBar.svelte';
  import GameStats from './GameStats.svelte';
  import ErrorMessage from './ErrorMessage.svelte';
  import RevealModal from './RevealModal.svelte';
  import DebugPanel from './DebugPanel.svelte';

  console.log('✅ GameButton imports loaded successfully');

  // State variables
  let timeRemaining = 0;
  let transactionStatus = 'idle'; // 'idle', 'preparing', 'checking_balance', etc.
  let statusMessage = '';
  let progressPercentage = 0;
  
  // Reveal confirmation modal state
  let showRevealModal = false;
  let pendingSecret = null;
  let pendingTxHash = null;
  let revealingShot = false;
  let savingToLocalStorage = false;
  let copyingToClipboard = false;

  // Create status update handler
  const handleStatusUpdate = createStatusUpdateHandler(
    (status) => transactionStatus = status,
    (message) => statusMessage = message,
    (percentage) => progressPercentage = percentage
  );

  // Create cooldown timer
  const cooldownTimer = createCooldownTimer(
    () => $cooldownRemaining,
    (remaining) => timeRemaining = remaining,
    async () => {
      // CRITICAL FIX: Refresh player data when cooldown expires
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
  );

  // Create game action handlers
  const gameHandlers = createGameActionHandlers({
    gameStore,
    walletStore,
    toastStore,
    handleStatusUpdate,
    setTransactionStatus: (status) => transactionStatus = status,
    setStatusMessage: (message) => statusMessage = message,
    setProgressPercentage: (percentage) => progressPercentage = percentage,
    setPendingSecret: (secret) => pendingSecret = secret,
    setPendingTxHash: (hash) => pendingTxHash = hash,
    setShowRevealModal: (show) => showRevealModal = show,
    setRevealingShot: (revealing) => revealingShot = revealing,
    setSavingToLocalStorage: (saving) => savingToLocalStorage = saving,
    setCopyingToClipboard: (copying) => copyingToClipboard = copying,
    timeRemaining,
    // Add reactive store getters
    getIsConnected: () => $isConnected,
    getIsCorrectNetwork: () => $isCorrectNetwork,
    getCanTakeShot: () => $canTakeShot,
    getContractDeployed: () => $contractDeployed,
    getIsLoading: () => $isLoading,
    getGameError: () => $gameError
  });

  // Debug handlers
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
      
      await cleanupExpiredPendingShot({
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

  // Modal handlers
  const handleRevealNow = async () => {
    const result = await gameHandlers.handleRevealNow(pendingSecret);
    if (result.success) {
      // Close the modal and clear state
      showRevealModal = false;
      pendingSecret = null;
      pendingTxHash = null;
    }
  };

  const handleSaveToLocalStorage = () => {
    gameHandlers.handleSaveToLocalStorage(pendingSecret, pendingTxHash);
  };

  const handleSaveForLater = () => {
    gameHandlers.handleSaveForLater(pendingSecret);
  };

  const handleCloseModal = () => {
    showRevealModal = false;
    pendingSecret = null;
    pendingTxHash = null;
  };

  // Reactive statements
  $: timeRemaining = $cooldownRemaining;
  $: if (timeRemaining > 0 && !cooldownTimer) {
    cooldownTimer.start();
  }
  
  // Get individual loading states from the store
  $: gameState = $gameStore;
  $: isPreparingData = gameState.loading && !gameState.takingShot;
  $: isTakingShot = gameState.takingShot;
  
  // Enhanced loading state detection with specific messages
  $: isLoadingState = $isLoading || (transactionStatus !== 'idle' && transactionStatus !== 'cooldown');
  $: loadingMessage = (transactionStatus !== 'idle' && transactionStatus !== 'cooldown') ? statusMessage : (isTakingShot ? 'Processing your shot...' : 'Loading game data...');
  
  // Cooldown state detection
  $: isCooldownState = transactionStatus === 'cooldown' || timeRemaining > 0;
  $: cooldownMessage = transactionStatus === 'cooldown' ? statusMessage : `Cooldown: ${formatTime(timeRemaining)}`;
  
  // Check if pot is empty (first shot scenario) - simplified to handle both string and numeric values
  $: isPotEmpty = parseFloat($currentPot || '0') === 0;
  $: isFirstShotReady = isPotEmpty && $canTakeShot && !$isLoading && timeRemaining <= 0 && transactionStatus === 'idle';
  
  // CRITICAL FIX: Regular shot should be available when canTakeShot is true AND pot is NOT empty
  $: isRegularShotReady = !isPotEmpty && $canTakeShot && !$isLoading && timeRemaining <= 0 && transactionStatus === 'idle';
  
  // Transaction in progress
  $: isTransactionInProgress = transactionStatus !== 'idle' && transactionStatus !== 'completed' && transactionStatus !== 'cooldown';

  // Update status message during cooldown
  $: if (timeRemaining > 0 && transactionStatus === 'idle') {
    setCooldownStatus(
      (status) => transactionStatus = status,
      (message) => statusMessage = message,
      (percentage) => progressPercentage = percentage,
      `Shot committed successfully! Cooldown: ${Math.ceil(timeRemaining / 1000)}s remaining`,
      calculateCooldownProgress(timeRemaining)
    );
  } else if (timeRemaining <= 0 && transactionStatus === 'cooldown') {
    resetTransactionStatus(
      (status) => transactionStatus = status,
      (message) => statusMessage = message,
      (percentage) => progressPercentage = percentage,
      0
    );
  }

  // Update cooldown message dynamically
  $: if (transactionStatus === 'cooldown' && timeRemaining > 0) {
    statusMessage = `Shot committed successfully! Cooldown: ${Math.ceil(timeRemaining / 1000)}s remaining`;
    progressPercentage = calculateCooldownProgress(timeRemaining);
  }

  // Check for saved secrets in localStorage on component mount
  const checkForSavedSecretsOnMount = () => {
    try {
      const wallet = get(walletStore);
      if (!wallet.connected || !wallet.address) {
        return;
      }

      const savedSecret = checkForSavedSecrets(wallet.address);
      if (savedSecret) {
        // Set the pending secret and show the reveal modal
        pendingSecret = savedSecret.secret;
        pendingTxHash = savedSecret.txHash;
        showRevealModal = true;
        
        toastStore.info('Found saved shot! Click "Reveal Now" to complete your shot.');
        console.log('💾 Found saved secret in localStorage for wallet:', wallet.address);
      }
    } catch (error) {
      console.error('❌ Failed to check for saved secrets in localStorage:', error);
    }
  };

  onMount(() => {
    console.log('🔧 GameButton onMount called');
    console.log('🔧 Cooldown remaining:', $cooldownRemaining);
    
    // Check for saved secrets in localStorage
    checkForSavedSecretsOnMount();
    
    if ($cooldownRemaining > 0) {
      cooldownTimer.start();
    }
    
    console.log('✅ GameButton component mounted successfully');
  });

  onDestroy(() => {
    cooldownTimer.stop();
  });
</script>

<div class="flex flex-col items-center space-y-6">
  <!-- Main Game Button -->
  <MainGameButton
    {contractDeployed}
    isConnected={$isConnected}
    isCorrectNetwork={$isCorrectNetwork}
    {timeRemaining}
    {isLoadingState}
    {loadingMessage}
    {progressPercentage}
    {isTransactionInProgress}
    {isTakingShot}
    {isFirstShotReady}
    {isRegularShotReady}
    currentPot={$currentPot}
    isLoading={$isLoading}
    onConnect={() => walletStore.connect()}
    onSwitchNetwork={gameHandlers.handleSwitchNetwork}
    onTakeFirstShot={gameHandlers.handleTakeFirstShot}
    onTakeShot={gameHandlers.handleTakeShot}
    onSponsorRound={gameHandlers.handleSponsorRound}
  />

  <!-- Status Bar -->
  <StatusBar
    {isLoadingState}
    {isCooldownState}
    {progressPercentage}
    {loadingMessage}
    {statusMessage}
    {transactionStatus}
    {timeRemaining}
    {isTransactionInProgress}
    {isTakingShot}
  />

  <!-- Game Stats -->
  <GameStats />

  <!-- Error Message -->
  <ErrorMessage gameError={$gameError} {contractDeployed} />

  <!-- Debug Panel -->
  <DebugPanel
    isConnected={$isConnected}
    debugMode={$debugMode}
    canTakeShot={$canTakeShot}
    cooldownRemaining={$cooldownRemaining}
    currentPot={$currentPot}
    isLoading={$isLoading}
    onManualRefresh={handleManualRefresh}
    onCheckPendingShot={handleCheckPendingShot}
    onDeepDebug={handleDeepDebug}
    onCleanupExpiredShot={handleCleanupExpiredShot}
  />

  <!-- Risk Warning -->
  <div class="text-center text-xs text-gray-500 max-w-md">
    <p>
      ⚠️ This is a game of chance. Only play with ETH you can afford to lose.
      Each shot has a {GAME_CONFIG.WIN_PERCENTAGE}% chance of winning the current pot.
    </p>
  </div>
</div>

<!-- Reveal Confirmation Modal -->
<RevealModal
  {showRevealModal}
  {pendingSecret}
  {pendingTxHash}
  {revealingShot}
  {savingToLocalStorage}
  {copyingToClipboard}
  onClose={handleCloseModal}
  onRevealNow={handleRevealNow}
  onSaveToLocalStorage={handleSaveToLocalStorage}
  onSaveForLater={handleSaveForLater}
/>