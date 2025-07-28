<script>
  console.log('🔧 GameButton component loading...');
  
  import { gameStore, canTakeShot, cooldownRemaining, isLoading, contractDeployed, gameError, currentPot } from '../stores/game/index.js';
  import { walletStore, isConnected, isCorrectNetwork } from '../stores/wallet.js';
  import { toastStore } from '../stores/toast.js';
  import { GAME_CONFIG, NETWORK_CONFIG, formatEth, formatTime as configFormatTime } from '../config.js';
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';

  console.log('✅ GameButton imports loaded successfully');

  let cooldownTimer = null;
  let timeRemaining = 0;

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
      const result = await gameStore.takeShot();
      console.log('✅ gameStore.takeShot() completed:', result);
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
      // Use the first shot cost instead of regular shot cost
      // Parameters: useDiscount, discountId, customShotCost
      const result = await gameStore.takeShot(false, null, GAME_CONFIG.FIRST_SHOT_COST_ETH);
      console.log('✅ gameStore.takeShot() (first shot) completed:', result);
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
      const result = await gameStore.sponsorRound();
      console.log('✅ gameStore.sponsorRound() completed:', result);
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

  // Reactive statements
  $: timeRemaining = $cooldownRemaining;
  $: if (timeRemaining > 0 && !cooldownTimer) {
    startCooldownTimer();
  }
  
  // Check if pot is empty (first shot scenario) - simplified to handle both string and numeric values
  $: isPotEmpty = parseFloat($currentPot || '0') === 0;
  $: isFirstShotReady = isPotEmpty && $canTakeShot && !$isLoading && timeRemaining <= 0;
  
  // CRITICAL FIX: Regular shot should be available when canTakeShot is true AND pot is NOT empty
  $: isRegularShotReady = !isPotEmpty && $canTakeShot && !$isLoading && timeRemaining <= 0;

  onMount(() => {
    console.log('🔧 GameButton onMount called');
    console.log('🔧 Cooldown remaining:', $cooldownRemaining);
    
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
    {:else if $isLoading}
      <!-- Taking Shot -->
      <button
        class="btn-game btn-loading"
        disabled
      >
        <div class="flex items-center space-x-3">
          <div class="spinner w-6 h-6"></div>
          <div class="flex flex-col">
            <span class="text-2xl font-bold">Taking Shot...</span>
            <span class="text-sm opacity-80">Confirm in wallet</span>
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
        
        <!-- Debug info and manual refresh -->
        {#if $isConnected}
          <div class="text-xs text-gray-400 text-center">
            Debug: canShoot={$canTakeShot}, cooldown={$cooldownRemaining}s, pot={$currentPot}
          </div>
          <button
            on:click={handleManualRefresh}
            class="btn-debug"
            disabled={$isLoading}
          >
            🔄 Refresh Player Data
          </button>
        {/if}
      </div>
    {/if}

    <!-- Pulse Effect for Ready State -->
    {#if isRegularShotReady || isFirstShotReady}
      <div class="absolute inset-0 rounded-2xl bg-red-500/20 animate-ping pointer-events-none"></div>
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
  }
</style>