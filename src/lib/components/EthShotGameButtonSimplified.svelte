<script>
  console.log('🔧 Simplified GameButton component loading...');
  
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
  } from '../utils/ethshot-button-utils.js';
  import { createGameActionHandlers } from '../utils/ethshot-button-handlers-simplified.js';

  // Import sub-components
  import EthShotMainButton from './EthShotMainButton.svelte';
  import EthShotStatusBar from './EthShotStatusBar.svelte';
  import EthShotGameStats from './EthShotGameStats.svelte';
  import EthShotErrorMessage from './EthShotErrorMessage.svelte';
  import EthShotDebugPanel from './EthShotDebugPanel.svelte';

  console.log('✅ Simplified GameButton imports loaded successfully');

  // State variables
  let timeRemaining = 0;
  let transactionStatus = 'idle'; // 'idle', 'preparing', 'checking_balance', etc.
  let statusMessage = '';
  let progressPercentage = 0;
  
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
      `Shot completed successfully! Cooldown: ${Math.ceil(timeRemaining / 1000)}s remaining`,
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
    statusMessage = `Shot completed successfully! Cooldown: ${Math.ceil(timeRemaining / 1000)}s remaining`;
    progressPercentage = calculateCooldownProgress(timeRemaining);
  }

  onMount(() => {
    console.log('🔧 Simplified GameButton onMount called');
    console.log('🔧 Cooldown remaining:', $cooldownRemaining);
    
    if ($cooldownRemaining > 0) {
      cooldownTimer.start();
    }
    
    console.log('✅ Simplified GameButton component mounted successfully');
  });

  onDestroy(() => {
    cooldownTimer.stop();
  });
</script>

<div class="flex flex-col items-center space-y-6">
  <!-- Main Game Button -->
  <EthShotMainButton
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
  <EthShotStatusBar
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
  <EthShotGameStats />

  <!-- Error Message -->
  <EthShotErrorMessage gameError={$gameError} {contractDeployed} />

  <!-- Debug Panel -->
  <EthShotDebugPanel
    isConnected={$isConnected}
    debugMode={$debugMode}
    canTakeShot={$canTakeShot}
    cooldownRemaining={$cooldownRemaining}
    currentPot={$currentPot}
    isLoading={$isLoading}
    onManualRefresh={handleManualRefresh}
  />

  <!-- Risk Warning -->
  <div class="text-center text-xs text-gray-500 max-w-md">
    <p>
      ⚠️ This is a game of chance. Only play with ETH you can afford to lose.
      Each shot has a {GAME_CONFIG.WIN_PERCENTAGE}% chance of winning the current pot.
    </p>
  </div>
</div>