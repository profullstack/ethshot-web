<script>
  import { gameStore, availableDiscounts, discountCount, canUseDiscount, isLoading, nextDiscount } from '../stores/game/index.js';
  import { walletStore } from '../stores/wallet.js';
  import { toastStore } from '../stores/toast.js';

  // Reactive statements
  $: wallet = $walletStore;
  $: discounts = $availableDiscounts;
  $: discountAvailable = $discountCount;
  $: canUse = $canUseDiscount;
  $: loading = $isLoading;
  // Note: revealing, pendingShot, and canCommit are not available in the new game store
  // The discount system uses the simplified takeShot approach
  $: discount = $nextDiscount;

  // Calculate discount percentage and savings
  $: discountPercentage = discount ? Math.round(discount.discount_percentage * 100) : 20;
  $: discountSavings = discount ? (0.0005 * discount.discount_percentage).toFixed(4) : '0.0001';

  // Handle discount shot
  async function handleDiscountShot() {
    if (!wallet.connected) {
      toastStore.error('Please connect your wallet first');
      return;
    }

    if (!discount) {
      toastStore.error('No discounts available');
      return;
    }

    try {
      // Use the new takeShot API with discount parameters
      await gameStore.takeShot(true, discount.id); // Pass true to use discount and discount ID
    } catch (error) {
      console.error('Failed to take discount shot:', error);
      toastStore.error('Failed to apply discount');
    }
  }
</script>

{#if wallet.connected && discountAvailable > 0 && discount}
  <div class="discount-container">
    <!-- Use Discount Shot -->
    <button
      class="discount-btn"
      class:disabled={!canUse || loading}
      disabled={!canUse || loading}
      on:click={handleDiscountShot}
    >
      {#if loading}
        <div class="loading-spinner"></div>
        <span>Taking Shot...</span>
      {:else}
        <div class="discount-icon">💰</div>
        <div class="discount-content">
          <div class="discount-title">Use {discountPercentage}% Discount</div>
          <div class="discount-details">
            <span class="discount-count">{discountAvailable} available</span>
            <span class="discount-savings">Save {discountSavings} ETH</span>
          </div>
        </div>
      {/if}
    </button>
    
    <div class="discount-info">
      <span class="info-icon">ℹ️</span>
      <span class="info-text">Discounts earned from referrals!</span>
    </div>
  </div>
{/if}

<style>
  .discount-container {
    @apply w-full space-y-2;
  }

  .discount-btn {
    @apply w-full px-6 py-4 rounded-xl font-bold text-lg transition-all duration-200;
    @apply bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700;
    @apply text-white shadow-lg hover:shadow-xl transform hover:scale-105;
    @apply flex items-center justify-center space-x-3;
    @apply border-2 border-green-400/30 hover:border-green-300/50;
  }

  .discount-btn:disabled {
    @apply opacity-50 cursor-not-allowed transform-none hover:shadow-lg;
    @apply hover:from-green-600 hover:to-emerald-600 hover:border-green-400/30;
  }

  .discount-btn.disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .loading-spinner {
    @apply w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin;
  }

  .discount-icon {
    @apply text-3xl;
  }

  .discount-content {
    @apply flex flex-col items-start;
  }

  .discount-title {
    @apply text-lg font-bold leading-tight;
  }

  .discount-details {
    @apply flex items-center space-x-3 text-sm opacity-90 leading-tight;
  }

  .discount-count {
    @apply text-sm;
  }

  .discount-savings {
    @apply text-sm font-semibold text-green-200;
  }

  .discount-info {
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
    .discount-btn {
      @apply px-4 py-3 text-base;
    }

    .discount-icon {
      @apply text-2xl;
    }

    .discount-title {
      @apply text-base;
    }

    .discount-details {
      @apply text-xs flex-col space-x-0 space-y-1 items-start;
    }
  }

  /* Animation for discount button */
  .discount-btn {
    animation: discountGlow 2s ease-in-out infinite alternate;
  }

  @keyframes discountGlow {
    0% {
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
    }
    100% {
      box-shadow: 0 0 30px rgba(34, 197, 94, 0.5), 0 0 40px rgba(16, 185, 129, 0.3);
    }
  }

  .discount-btn:hover {
    animation: none;
  }
</style>