<script>
  import { gameStore, bonusShotsAvailable, canUseBonusShot, isLoading } from '../stores/game-unified.js';
  import { walletStore } from '../stores/wallet.js';
  import { toastStore } from '../stores/toast.js';

  // Reactive statements
  $: wallet = $walletStore;
  $: bonusShots = $bonusShotsAvailable;
  $: canUseBonus = $canUseBonusShot;
  $: loading = $isLoading;

  // Handle bonus shot click
  async function handleBonusShot() {
    if (!wallet.connected) {
      toastStore.error('Please connect your wallet first');
      return;
    }

    if (bonusShots <= 0) {
      toastStore.error('No bonus shots available');
      return;
    }

    try {
      await gameStore.takeShot(true); // Pass true to use bonus shot
    } catch (error) {
      console.error('Failed to use bonus shot:', error);
      toastStore.error('Failed to use bonus shot');
    }
  }
</script>

{#if wallet.connected && bonusShots > 0}
  <div class="bonus-shot-container">
    <button
      class="bonus-shot-btn"
      class:disabled={!canUseBonus || loading}
      disabled={!canUseBonus || loading}
      on:click={handleBonusShot}
    >
      {#if loading}
        <div class="loading-spinner"></div>
        <span>Taking Shot...</span>
      {:else}
        <div class="bonus-icon">🎁</div>
        <div class="bonus-content">
          <div class="bonus-title">Use Bonus Shot</div>
          <div class="bonus-count">{bonusShots} available</div>
        </div>
      {/if}
    </button>
    
    <div class="bonus-info">
      <span class="info-icon">ℹ️</span>
      <span class="info-text">Free shots earned from referrals!</span>
    </div>
  </div>
{/if}

<style>
  .bonus-shot-container {
    @apply w-full space-y-2;
  }

  .bonus-shot-btn {
    @apply w-full px-6 py-4 rounded-xl font-bold text-lg transition-all duration-200;
    @apply bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700;
    @apply text-white shadow-lg hover:shadow-xl transform hover:scale-105;
    @apply flex items-center justify-center space-x-3;
    @apply border-2 border-purple-400/30 hover:border-purple-300/50;
  }

  .bonus-shot-btn:disabled {
    @apply opacity-50 cursor-not-allowed transform-none hover:shadow-lg;
    @apply hover:from-purple-600 hover:to-pink-600 hover:border-purple-400/30;
  }

  .bonus-shot-btn.disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .loading-spinner {
    @apply w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin;
  }

  .bonus-icon {
    @apply text-3xl;
  }

  .bonus-content {
    @apply flex flex-col items-start;
  }

  .bonus-title {
    @apply text-lg font-bold leading-tight;
  }

  .bonus-count {
    @apply text-sm opacity-90 leading-tight;
  }

  .bonus-info {
    @apply flex items-center justify-center space-x-2 text-sm text-gray-400;
  }

  .info-icon {
    @apply text-base;
  }

  .info-text {
    @apply text-center;
  }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .bonus-shot-btn {
      @apply px-4 py-3 text-base;
    }

    .bonus-icon {
      @apply text-2xl;
    }

    .bonus-title {
      @apply text-base;
    }

    .bonus-count {
      @apply text-xs;
    }
  }

  /* Animation for bonus shot button */
  .bonus-shot-btn {
    animation: bonusGlow 2s ease-in-out infinite alternate;
  }

  @keyframes bonusGlow {
    0% {
      box-shadow: 0 0 20px rgba(147, 51, 234, 0.3);
    }
    100% {
      box-shadow: 0 0 30px rgba(147, 51, 234, 0.5), 0 0 40px rgba(219, 39, 119, 0.3);
    }
  }

  .bonus-shot-btn:hover {
    animation: none;
  }
</style>