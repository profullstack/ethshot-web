<script>
  import { GAME_CONFIG, formatEth } from '../config.js';
  import { formatTime } from '../utils/game-button-utils.js';

  // Props
  export let contractDeployed;
  export let isConnected;
  export let isCorrectNetwork;
  export let timeRemaining;
  export let isLoadingState;
  export let loadingMessage;
  export let progressPercentage;
  export let isTransactionInProgress;
  export let isTakingShot;
  export let isFirstShotReady;
  export let isRegularShotReady;
  export let currentPot;
  export let isLoading;

  // Event handlers (passed from parent)
  export let onConnect;
  export let onSwitchNetwork;
  export let onTakeFirstShot;
  export let onTakeShot;
  export let onSponsorRound;
</script>

<div class="relative">
  {#if contractDeployed === false}
    <!-- Contract Not Deployed -->
    <button
      class="btn-game btn-error"
      disabled
    >
      <span class="text-2xl font-bold">Contract Not Deployed</span>
      <span class="text-sm opacity-80">Please deploy the smart contract first</span>
    </button>
  {:else if !isConnected}
    <!-- Not Connected -->
    <button
      on:click={onConnect}
      class="btn-game btn-connect"
      disabled={isLoading}
    >
      <span class="text-2xl font-bold">Connect Wallet</span>
      <span class="text-sm opacity-80">to take your shot</span>
    </button>
  {:else if !isCorrectNetwork}
    <!-- Wrong Network -->
    <button
      on:click={onSwitchNetwork}
      class="btn-game btn-warning"
      disabled={isLoading}
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
    <!-- Enhanced Loading State with Detailed Status -->
    <button
      class="btn-game btn-loading"
      disabled
    >
      <div class="flex items-center space-x-3 px-4">
        <div class="spinner w-6 h-6 flex-shrink-0"></div>
        <div class="flex flex-col">
          <span class="text-2xl font-bold">{loadingMessage}</span>
          <span class="text-sm opacity-80">
            {#if isTransactionInProgress}
              {progressPercentage}% complete
            {:else if isTakingShot}
              Confirm in wallet
            {:else}
              Please wait...
            {/if}
          </span>
        </div>
      </div>
    </button>
  {:else if isFirstShotReady}
    <!-- First Shot (Empty Pot) -->
    <div class="flex flex-col space-y-3">
      <button
        on:click={onTakeFirstShot}
        class="btn-game btn-first-shot animate-glow"
        disabled={false}
        style="pointer-events: auto; cursor: pointer;"
      >
        <span class="text-3xl font-black">🚀 TAKE THE FIRST SHOT</span>
        <span class="text-sm opacity-90">{formatEth(GAME_CONFIG.FIRST_SHOT_COST_ETH)} ETH • Start the pot!</span>
      </button>
      
      <!-- Sponsor Option -->
      <button
        on:click={onSponsorRound}
        class="btn-sponsor"
        disabled={isLoading}
      >
        <span class="text-lg font-bold">💰 Sponsor Round</span>
        <span class="text-xs opacity-80">{formatEth(GAME_CONFIG.SPONSOR_COST_ETH)} ETH • Add to pot without playing</span>
      </button>
    </div>
  {:else if isRegularShotReady}
    <!-- Ready to Take Shot -->
    <button
      on:click={onTakeShot}
      class="btn-game btn-primary animate-glow"
      disabled={false}
      style="pointer-events: auto; cursor: pointer;"
    >
      <span class="text-3xl font-black">🎯 TAKE SHOT</span>
      <span class="text-sm opacity-90">{formatEth(GAME_CONFIG.SHOT_COST_ETH)} ETH • {GAME_CONFIG.WIN_PERCENTAGE}% chance to win</span>
    </button>
  {:else}
    <!-- Cannot Take Shot -->
    <button
      class="btn-game btn-disabled"
      disabled
    >
      <span class="text-2xl font-bold">Cannot Take Shot</span>
      <span class="text-sm opacity-80">Check wallet connection and cooldown</span>
    </button>
  {/if}

  <!-- Pulse Effect for Ready State -->
  {#if isRegularShotReady || isFirstShotReady}
    <div class="absolute inset-0 rounded-2xl bg-red-500/20 animate-ping pointer-events-none"></div>
  {/if}
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
    aspect-ratio: 1;
    width: 1.5rem;
    height: 1.5rem;
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