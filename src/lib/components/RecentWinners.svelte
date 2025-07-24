<script>
  import { onMount } from 'svelte';
  import { recentWinners } from '../stores/game-unified.js';
  import { db, formatAddress, formatTimeAgo } from '../supabase.js';
  import { NETWORK_CONFIG, calculateUSDValue } from '../config.js';

  let winners = [];
  let loading = true;
  let error = null;

  // Load winners from database on mount
  onMount(async () => {
    await loadWinners();
  });

  async function loadWinners() {
    try {
      loading = true;
      error = null;
      
      // Try to get winners from database first
      const dbWinners = await db.getRecentWinners(10);
      
      if (dbWinners && dbWinners.length > 0) {
        // Transform database format to component format
        winners = dbWinners.map(winner => ({
          winner: winner.winner_address,
          amount: winner.amount,
          timestamp: winner.timestamp,
          blockNumber: winner.block_number,
          txHash: winner.tx_hash
        }));
      } else {
        // Fall back to store data if database is empty
        winners = $recentWinners || [];
      }
    } catch (err) {
      console.error('Error loading winners:', err);
      error = 'Failed to load recent winners';
      // Fall back to store data on error
      winners = $recentWinners || [];
    } finally {
      loading = false;
    }
  }

  // Truncate address for display
  const truncateAddress = (address) => {
    return formatAddress(address);
  };

  // Format time ago
  const timeAgo = (timestamp) => {
    return formatTimeAgo(timestamp);
  };

  // React to store changes for real-time updates
  $: if ($recentWinners && $recentWinners.length > 0) {
    winners = $recentWinners;
  }
</script>

<div class="recent-winners">
  <div class="winners-header">
    <h3 class="text-lg font-bold text-white flex items-center space-x-2">
      <span>🎉</span>
      <span>Recent Winners</span>
    </h3>
    <p class="text-sm text-gray-400">Latest jackpot winners</p>
  </div>

  <div class="winners-list">
    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p class="text-gray-400">Loading recent winners...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <div class="error-text">
          <p class="text-red-400">{error}</p>
          <button
            class="retry-button"
            on:click={loadWinners}
          >
            Try Again
          </button>
        </div>
      </div>
    {:else if winners.length > 0}
      {#each winners as winner (winner.blockNumber || winner.txHash)}
        <div class="winner-row">
          <!-- Winner Icon -->
          <div class="winner-icon">
            <div class="icon-container">
              🏆
            </div>
          </div>

          <!-- Winner Info -->
          <div class="winner-info">
            <div class="winner-address">
              <a
                href="{NETWORK_CONFIG.BLOCK_EXPLORER_URL}/address/{winner.winner}"
                target="_blank"
                rel="noopener noreferrer"
                class="address-link"
              >
                {truncateAddress(winner.winner)}
              </a>
            </div>
            <div class="winner-time">
              {timeAgo(winner.timestamp)}
            </div>
          </div>

          <!-- Winner Amount -->
          <div class="winner-amount">
            <div class="amount-value">
              +{parseFloat(winner.amount).toFixed(3)} ETH
            </div>
            <div class="amount-usd">
              ${calculateUSDValue(winner.amount)}
            </div>
          </div>

          <!-- Celebration Effect -->
          <div class="celebration-effect">
            <span class="confetti">🎊</span>
          </div>
        </div>
      {/each}
    {:else}
      <div class="no-winners">
        <div class="no-winners-icon">🎯</div>
        <div class="no-winners-text">
          <p class="text-gray-400">No winners yet!</p>
          <p class="text-sm text-gray-500">Be the first to win the jackpot</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- Winners Stats -->
  <div class="winners-stats">
    <div class="stat-item">
      <div class="stat-value">{winners.length}</div>
      <div class="stat-label">Winners Today</div>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item">
      <div class="stat-value">
        {winners.reduce((sum, w) => sum + parseFloat(w.amount), 0).toFixed(3)}
      </div>
      <div class="stat-label">ETH Won Today</div>
    </div>
  </div>
</div>

<style>
  .recent-winners {
    @apply bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6;
  }

  .winners-header {
    @apply mb-6 text-center;
  }

  .winners-list {
    @apply space-y-4 mb-6;
    max-height: 300px;
    overflow-y: auto;
  }

  .winner-row {
    @apply relative flex items-center space-x-4 p-4 rounded-lg;
    @apply bg-gradient-to-r from-green-900/20 to-yellow-900/20;
    @apply border border-green-700/30;
    @apply hover:from-green-900/30 hover:to-yellow-900/30 transition-all;
    animation: slideIn 0.5s ease-out;
  }

  .winner-icon {
    @apply flex-shrink-0;
  }

  .icon-container {
    @apply w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500;
    @apply rounded-full flex items-center justify-center text-lg;
    @apply shadow-lg;
    animation: bounce 2s infinite;
  }

  .winner-info {
    @apply flex-1 min-w-0;
  }

  .winner-address {
    @apply font-mono text-sm;
  }

  .address-link {
    @apply text-white hover:text-yellow-400 transition-colors;
    @apply underline decoration-dotted underline-offset-2;
  }

  .winner-time {
    @apply text-xs text-gray-400 mt-1;
  }

  .winner-amount {
    @apply text-right flex-shrink-0;
  }

  .amount-value {
    @apply font-mono text-lg font-bold text-green-400;
  }

  .amount-usd {
    @apply text-xs text-gray-400;
  }

  .celebration-effect {
    @apply absolute -top-1 -right-1;
  }

  .confetti {
    @apply text-lg;
    animation: celebrate 2s ease-in-out infinite;
  }

  .no-winners {
    @apply flex items-center space-x-4 p-6 text-center;
    @apply bg-gray-900/50 rounded-lg border border-gray-700;
  }

  .no-winners-icon {
    @apply text-4xl opacity-50;
  }

  .no-winners-text {
    @apply flex-1;
  }

  .winners-stats {
    @apply flex items-center justify-center space-x-6 pt-4;
    @apply border-t border-gray-700;
  }

  .stat-item {
    @apply text-center;
  }

  .stat-value {
    @apply text-xl font-bold text-white;
  }

  .stat-label {
    @apply text-xs text-gray-400;
  }

  .stat-divider {
    @apply w-px h-10 bg-gray-600;
  }

  /* Custom scrollbar */
  .winners-list::-webkit-scrollbar {
    width: 4px;
  }

  .winners-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .winners-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }

  /* Loading and Error States */
  .loading-state {
    @apply flex flex-col items-center justify-center p-8 text-center;
  }

  .loading-spinner {
    @apply w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full;
    animation: spin 1s linear infinite;
  }

  .error-state {
    @apply flex items-center space-x-4 p-6 text-center;
    @apply bg-red-900/20 rounded-lg border border-red-700/30;
  }

  .error-icon {
    @apply text-2xl;
  }

  .error-text {
    @apply flex-1;
  }

  .retry-button {
    @apply mt-2 px-4 py-2 bg-red-600 hover:bg-red-700;
    @apply text-white text-sm rounded-lg transition-colors;
  }

  /* Animations */
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-5px);
    }
    60% {
      transform: translateY(-3px);
    }
  }

  @keyframes celebrate {
    0%, 100% {
      transform: rotate(0deg) scale(1);
    }
    25% {
      transform: rotate(-10deg) scale(1.1);
    }
    75% {
      transform: rotate(10deg) scale(1.1);
    }
  }

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .recent-winners {
      @apply p-4;
    }

    .winner-row {
      @apply space-x-3 p-3;
    }

    .icon-container {
      @apply w-8 h-8 text-base;
    }

    .amount-value {
      @apply text-base;
    }

    .winners-stats {
      @apply space-x-4;
    }

    .stat-value {
      @apply text-lg;
    }
  }
</style>