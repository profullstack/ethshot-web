<script>
  import { GAME_CONFIG } from '../config.js';
  import { formatTime } from '../utils/ethshot-button-utils.js';

  // Props
  export let isLoadingState = false;
  export let isCooldownState = false;
  export let progressPercentage = 0;
  export let loadingMessage = '';
  export let statusMessage = '';
  export let transactionStatus = 'idle';
  export let timeRemaining = 0;
  export let isTransactionInProgress = false;
  export let isTakingShot = false;
</script>

{#if isLoadingState}
  <!-- Enhanced Status Bar for Loading States -->
  <div class="status-bar-container">
    <div class="status-bar">
      <div class="status-bar-fill transaction-progress" style="width: {progressPercentage}%;"></div>
    </div>
    <div class="status-text">
      <span class="status-message">{loadingMessage}</span>
      <span class="status-detail">
        {#if isTransactionInProgress}
          {#if progressPercentage <= 50}
            Commit Phase: Step {Math.ceil(progressPercentage / 10)} of 10 • {progressPercentage}% complete
          {:else if progressPercentage <= 95}
            Reveal Phase: Step {Math.ceil((progressPercentage - 50) / 9)} of 5 • {progressPercentage}% complete
          {:else}
            Finalizing: {progressPercentage}% complete
          {/if}
        {:else if isTakingShot}
          Waiting for wallet confirmation...
        {:else}
          Initializing...
        {/if}
      </span>
    </div>
  </div>
{:else if isCooldownState}
  <!-- Cooldown Status Bar -->
  <div class="status-bar-container">
    <div class="status-bar cooldown-bar">
      <div class="status-bar-fill cooldown-fill" style="width: {Math.max(0, 100 - (timeRemaining / (GAME_CONFIG.COOLDOWN_SECONDS * 1000)) * 100)}%;"></div>
    </div>
    <div class="status-text">
      <span class="status-message">{transactionStatus === 'cooldown' ? 'Shot Committed!' : 'Cooldown Active'}</span>
      <span class="status-detail">
        {#if transactionStatus === 'cooldown'}
          {statusMessage}
        {:else}
          Next shot in {formatTime(timeRemaining)}
        {/if}
      </span>
    </div>
  </div>
{/if}

<style>
  /* Status Bar Styles */
  .status-bar-container {
    @apply w-80 mt-4 mx-auto;
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

  .transaction-progress {
    @apply bg-gradient-to-r from-green-500 to-blue-500;
  }

  .transaction-progress::after {
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    animation: shimmer 1.5s infinite;
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

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .status-bar-container {
      @apply w-72 mx-auto;
    }
    
    .status-message {
      @apply text-xs;
    }
    
    .status-detail {
      @apply text-xs;
    }
  }
</style>