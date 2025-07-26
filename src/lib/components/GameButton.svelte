<script>
  console.log('🔧 GameButton component loading...');
  
  import { gameStore, canTakeShot, cooldownRemaining, isLoading, contractDeployed, gameError } from '../stores/game-unified.js';
  import { walletStore, isConnected, isCorrectNetwork } from '../stores/wallet.js';
  import { toastStore } from '../stores/toast.js';
  import { GAME_CONFIG, NETWORK_CONFIG, formatEth, formatTime as configFormatTime } from '../config.js';
  import { onMount, onDestroy } from 'svelte';

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

    cooldownTimer = setInterval(() => {
      timeRemaining = $cooldownRemaining;
      if (timeRemaining <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
      }
    }, 1000);
  };

  // Handle committing a shot
  const handleCommitShot = async () => {
    console.log('🎯 COMMIT SHOT BUTTON CLICKED!');
    console.log('🔍 Button click handler executing...');
    
    console.log('Debug info:', {
      isConnected: $isConnected,
      isCorrectNetwork: $isCorrectNetwork,
      canCommitShot: $canCommitShot,
      contractDeployed: $contractDeployed,
      isLoading: $isLoading,
      gameError: $gameError,
      hasPendingShot: $hasPendingShot
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

    if ($hasPendingShot) {
      console.log('❌ Already have pending shot - stopping here');
      toastStore.error('You already have a pending shot. Please reveal it first.');
      return;
    }

    console.log('✅ All checks passed, calling gameStore.commitShot()');
    console.log('🚀 About to call gameStore.commitShot()...');
    
    try {
      const result = await gameStore.commitShot();
      console.log('✅ gameStore.commitShot() completed:', result);
    } catch (error) {
      console.error('❌ Failed to commit shot:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      toastStore.error('Failed to commit shot: ' + error.message);
    }
  };

  // Handle revealing a shot
  const handleRevealShot = async () => {
    console.log('🔓 REVEAL SHOT BUTTON CLICKED!');
    console.log('🔍 Button click handler executing...');
    
    console.log('Debug info:', {
      isConnected: $isConnected,
      isCorrectNetwork: $isCorrectNetwork,
      canRevealShot: $canRevealShot,
      pendingShot: $pendingShot,
      isRevealing: $isRevealing
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

    if (!$pendingShot?.exists) {
      console.log('❌ No pending shot - stopping here');
      toastStore.error('No pending shot to reveal. Please commit a shot first.');
      return;
    }

    console.log('✅ All checks passed, calling gameStore.revealShot()');
    console.log('🚀 About to call gameStore.revealShot()...');
    
    try {
      const result = await gameStore.revealShot();
      console.log('✅ gameStore.revealShot() completed:', result);
    } catch (error) {
      console.error('❌ Failed to reveal shot:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      toastStore.error('Failed to reveal shot: ' + error.message);
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

  // Reactive statements
  $: timeRemaining = $cooldownRemaining;
  $: if (timeRemaining > 0 && !cooldownTimer) {
    startCooldownTimer();
  }

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
      <!-- Committing Shot -->
      <button
        class="btn-game btn-loading"
        disabled
      >
        <div class="flex items-center space-x-3">
          <div class="spinner w-6 h-6"></div>
          <div class="flex flex-col">
            <span class="text-2xl font-bold">Committing Shot...</span>
            <span class="text-sm opacity-80">Confirm in wallet</span>
          </div>
        </div>
      </button>
    {:else if $isRevealing}
      <!-- Revealing Shot -->
      <button
        class="btn-game btn-loading"
        disabled
      >
        <div class="flex items-center space-x-3">
          <div class="spinner w-6 h-6"></div>
          <div class="flex flex-col">
            <span class="text-2xl font-bold">Revealing Shot...</span>
            <span class="text-sm opacity-80">Confirm in wallet</span>
          </div>
        </div>
      </button>
    {:else if $hasPendingShot && $canRevealShot}
      <!-- Ready to Reveal -->
      <button
        on:click={handleRevealShot}
        class="btn-game btn-reveal animate-glow"
        disabled={false}
        style="pointer-events: auto; cursor: pointer;"
      >
        <span class="text-2xl font-bold">🔓 Reveal Shot</span>
        <span class="text-sm opacity-80">Click to reveal your committed shot</span>
      </button>
    {:else if $hasPendingShot && !$canRevealShot}
      <!-- Waiting for Reveal Window -->
      <button
        class="btn-game btn-waiting"
        disabled
      >
        <span class="text-2xl font-bold">⏳ Waiting...</span>
        <span class="text-sm opacity-80">Reveal window opens next block</span>
      </button>
    {:else if $canCommitShot}
      <!-- Ready to Commit -->
      <button
        on:click={handleCommitShot}
        class="btn-game btn-primary animate-glow"
        disabled={false}
        style="pointer-events: auto; cursor: pointer;"
      >
        <span class="text-3xl font-black">🎯 COMMIT SHOT</span>
        <span class="text-sm opacity-90">{formatEth(GAME_CONFIG.SHOT_COST)} ETH • {GAME_CONFIG.WIN_PERCENTAGE}% chance to win</span>
      </button>
    {:else}
      <!-- Cannot Commit -->
      <button
        class="btn-game btn-disabled"
        disabled
      >
        <span class="text-2xl font-bold">Cannot Take Shot</span>
        <span class="text-sm opacity-80">Check wallet connection and cooldown</span>
      </button>
    {/if}

    <!-- Pulse Effect for Ready State -->
    {#if ($canCommitShot || ($hasPendingShot && $canRevealShot)) && !$isLoading && !$isRevealing && timeRemaining <= 0}
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
  }
</style>